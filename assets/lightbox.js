/* Full-screen photo viewer for the gallery. Clicking a .photo-card opens the
   full-resolution original in a <dialog>; arrow keys and the on-screen buttons
   step through the set. Without JS the cards stay plain links to the photo. */
(function () {
  var dialog = document.querySelector(".lightbox");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".photo-card"));

  if (!dialog || !cards.length || typeof dialog.showModal !== "function") {
    return;
  }

  var image = dialog.querySelector(".lightbox__figure img");
  var caption = dialog.querySelector(".lightbox__caption");
  var current = 0;

  function show(index) {
    current = (index + cards.length) % cards.length;
    var card = cards[current];
    var text = card.getAttribute("data-caption") || "";

    image.src = card.getAttribute("href");
    image.alt = text ? "Photograph from " + text : "";
    caption.textContent =
      text + " · " + (current + 1) + " of " + cards.length;
  }

  function open(index) {
    show(index);
    if (!dialog.open) {
      dialog.showModal();
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

  dialog.querySelector(".lightbox__button--prev").addEventListener("click", function () {
    show(current - 1);
  });

  dialog.querySelector(".lightbox__button--next").addEventListener("click", function () {
    show(current + 1);
  });

  dialog.querySelector(".lightbox__button--close").addEventListener("click", function () {
    dialog.close();
  });

  dialog.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      show(current + 1);
    }
  });

  /* Clicking the dark surround closes; clicks on the photo itself should not. */
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog || event.target.classList.contains("lightbox__stage")) {
      dialog.close();
    }
  });

  dialog.addEventListener("close", function () {
    /* Drop the decoded original so a long session does not pile up memory. */
    image.removeAttribute("src");
  });
})();
