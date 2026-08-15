/* Full-screen photo viewer for the gallery. Clicking a .photo-card opens the
   full-resolution original in a <dialog>, with EXIF read from data attributes
   the build script wrote. Without JS the cards stay plain links to the photo.

   Keys: arrows browse, i toggles details, f toggles fullscreen, Esc closes. */
(function () {
  var dialog = document.querySelector(".viewer");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".photo-card"));

  if (!dialog || !cards.length || typeof dialog.showModal !== "function") {
    return;
  }

  var image = dialog.querySelector(".viewer__figure img");
  var caption = dialog.querySelector(".viewer__caption");
  var exif = dialog.querySelector(".viewer__exif");
  var exifButton = dialog.querySelector('[data-action="exif"]');
  var FIELDS = ["date", "camera", "lens", "settings"];
  var STORAGE_KEY = "viewer-exif-v2";
  var current = 0;

  function detailsWanted() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "off") {
        return false;
      }
    } catch (error) {
      /* Private browsing: fall through to the default. */
    }
    /* Settings are the reason the viewer exists, so they start visible. */
    return true;
  }

  function showDetails(on) {
    /* A class, not the hidden attribute: .viewer__exif { display: flex }
       otherwise wins over [hidden] and the toggle does nothing. */
    exif.classList.toggle("is-visible", on);
    exifButton.setAttribute("aria-pressed", on ? "true" : "false");
    try {
      localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    } catch (error) {
      /* Private browsing: the preference just will not persist. */
    }
  }

  /* Decoding a 20-megapixel neighbour in advance makes arrowing feel instant. */
  function preload(index) {
    var card = cards[(index + cards.length) % cards.length];
    var img = new Image();
    img.src = card.getAttribute("href");
  }

  function show(index) {
    current = (index + cards.length) % cards.length;
    var card = cards[current];
    var location = card.getAttribute("data-location") || "";

    image.src = card.getAttribute("href");
    image.alt = location ? "Photograph from " + location : "";
    caption.textContent =
      location + " · " + (current + 1) + " of " + cards.length;

    FIELDS.forEach(function (field) {
      var value = card.getAttribute("data-" + field);
      var cell = exif.querySelector('[data-field="' + field + '"]');
      cell.textContent = value || "—";
      cell.parentNode.classList.toggle("is-empty", !value);
    });

    preload(current + 1);
    preload(current - 1);
  }

  function open(index) {
    showDetails(detailsWanted());
    show(index);
    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function fullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (dialog.requestFullscreen) {
      dialog.requestFullscreen().catch(function () {
        /* Safari refuses in some contexts; the viewer is already full-bleed. */
      });
    }
  }

  cards.forEach(function (card, index) {
    card.addEventListener("click", function (event) {
      /* Let modified clicks open the photo in a new tab as usual. */
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      open(index);
    });
  });

  dialog.querySelector(".viewer__nav--prev").addEventListener("click", function () {
    show(current - 1);
  });

  dialog.querySelector(".viewer__nav--next").addEventListener("click", function () {
    show(current + 1);
  });

  dialog.addEventListener("click", function (event) {
    var action = event.target.closest && event.target.closest("[data-action]");
    if (!action) {
      /* Clicking the dark surround closes; clicks on the photo should not. */
      if (event.target === dialog || event.target.classList.contains("viewer__stage")) {
        dialog.close();
      }
      return;
    }

    var name = action.getAttribute("data-action");
    if (name === "close") {
      dialog.close();
    } else if (name === "exif") {
      showDetails(!exif.classList.contains("is-visible"));
    } else if (name === "fullscreen") {
      fullscreen();
    }
  });

  dialog.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      show(current + 1);
    } else if (event.key === "i" || event.key === "I") {
      showDetails(!exif.classList.contains("is-visible"));
    } else if (event.key === "f" || event.key === "F") {
      fullscreen();
    }
  });

  /* Swipe between photos on touch screens. */
  var touchStart = null;

  dialog.addEventListener("touchstart", function (event) {
    touchStart = event.changedTouches[0].clientX;
  }, { passive: true });

  dialog.addEventListener("touchend", function (event) {
    if (touchStart === null) {
      return;
    }
    var travel = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(travel) > 50) {
      show(travel < 0 ? current + 1 : current - 1);
    }
    touchStart = null;
  }, { passive: true });

  dialog.addEventListener("close", function () {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    /* Drop the decoded original so a long session does not pile up memory. */
    image.removeAttribute("src");
    if (/^#photo-\d+$/.test(location.hash)) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  });

  function openFromHash() {
    var match = /^#photo-(\d+)$/.exec(location.hash);
    if (!match) {
      return;
    }
    var index = Number(match[1]);
    if (cards[index]) {
      open(index);
    }
  }

  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
