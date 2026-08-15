/* Command palette: ⌘K (or Ctrl+K) opens a fuzzy search over every page, post,
   and photo on the site, plus a few actions. The index comes from
   assets/search-index.js, which tools/build_search_index.py generates.

   Pages only need a .palette-open button in the header; the dialog is built
   here so the markup does not have to be repeated on 20 pages. */
(function () {
  var TRIGGER = document.querySelector(".palette-open");
  var root = document.documentElement;

  /* Pages sit at different depths, so resolve the index and any result URL
     relative to this script rather than to the page. */
  var script = document.currentScript;
  var base = script ? script.src.replace(/assets\/palette\.js.*$/, "") : "/";

  var dialog = null;
  var input = null;
  var results = null;
  var items = [];
  var selected = 0;
  var index = null;

  var ACTIONS = [
    {
      title: "Toggle dark mode",
      group: "Actions",
      meta: "theme",
      keywords: "dark light theme mode appearance",
      run: function () {
        var button = document.querySelector(".theme-toggle");
        if (button) {
          button.click();
        } else {
          var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
          root.setAttribute("data-theme", next);
          try {
            localStorage.setItem("theme", next);
          } catch (error) {
            /* Private browsing: the choice just will not persist. */
          }
        }
      },
    },
  ];

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Scores one entry against the query. Returns -1 for no match.

     Multi-word queries match each word anywhere, so "hood ski" still finds
     "Ski Mount Hood". A single word also matches as a subsequence the way
     editor palettes do, so "sahcam" finds "Cascade Pass to Sahale Camp". */
  function score(haystack, needle) {
    if (!needle) {
      return 0;
    }

    var text = haystack.toLowerCase();
    var words = needle.split(/\s+/);

    if (words.length > 1) {
      var total = 0;
      for (var w = 0; w < words.length; w++) {
        var at = text.indexOf(words[w]);
        if (at === -1) {
          return -1;
        }
        total += at;
      }
      return 900 - Math.round(total / words.length);
    }

    var direct = text.indexOf(needle);
    if (direct !== -1) {
      /* Prefer earlier, word-initial hits. */
      return 1000 - direct - (direct === 0 ? 0 : 5);
    }

    /* Try every possible starting letter and keep the tightest run, so
       "sahcam" lands on "Sahale Camp" instead of straggling from "Cascade". */
    var best = -1;
    var start = text.indexOf(needle.charAt(0));
    while (start !== -1) {
      var position = start + 1;
      var complete = true;
      for (var i = 1; i < needle.length; i++) {
        var found = text.indexOf(needle.charAt(i), position);
        if (found === -1) {
          complete = false;
          break;
        }
        position = found + 1;
      }
      if (!complete) {
        /* A later start has even less text left to match. */
        break;
      }
      if (best === -1 || position - start < best) {
        best = position - start;
      }
      start = text.indexOf(needle.charAt(0), start + 1);
    }

    /* Letters scattered across a whole entry are a coincidence, not a match:
       "rainier" should not pull in "Ski Montana". */
    if (best === -1 || best > needle.length * 3 + 4) {
      return -1;
    }
    return 500 - (best - needle.length);
  }

  function search(query) {
    var needle = query.trim().toLowerCase();
    var pool = (index || []).concat(ACTIONS);

    if (!needle) {
      /* Empty query: show a useful starting set rather than nothing. */
      return pool
        .filter(function (entry) {
          return entry.group !== "Photos";
        })
        .slice(0, 12);
    }

    return pool
      .map(function (entry) {
        var haystack = [entry.title, entry.meta, entry.keywords]
          .filter(Boolean)
          .join(" ");
        return { entry: entry, score: score(haystack, needle) };
      })
      .filter(function (hit) {
        return hit.score >= 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 30)
      .map(function (hit) {
        return hit.entry;
      });
  }

  function render(matches) {
    items = matches;
    selected = 0;

    if (!matches.length) {
      results.innerHTML =
        '<li class="palette__empty">No matches. Try “rainier”, “ski”, or “glacier”.</li>';
      return;
    }

    var html = "";
    var group = null;
    matches.forEach(function (entry, position) {
      if (entry.group !== group) {
        group = entry.group;
        html += '<li class="palette__group" role="presentation">' +
          escapeHtml(group) + "</li>";
      }

      var thumb = entry.thumb
        ? '<img class="palette__thumb" src="' + escapeHtml(base + entry.thumb) +
          '" alt="" loading="lazy" />'
        : "";

      html +=
        '<li role="option" aria-selected="' + (position === 0) + '"' +
        ' data-position="' + position + '" class="palette__item">' +
        thumb +
        '<span class="palette__title">' + escapeHtml(entry.title) + "</span>" +
        '<span class="palette__meta">' + escapeHtml(entry.meta || "") + "</span>" +
        "</li>";
    });

    results.innerHTML = html;
  }

  function highlight(position) {
    var nodes = results.querySelectorAll(".palette__item");
    if (!nodes.length) {
      return;
    }

    selected = (position + nodes.length) % nodes.length;
    Array.prototype.forEach.call(nodes, function (node) {
      var active = Number(node.getAttribute("data-position")) === selected;
      node.setAttribute("aria-selected", active ? "true" : "false");
      if (active) {
        node.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function choose(position) {
    var entry = items[position];
    if (!entry) {
      return;
    }

    if (entry.run) {
      entry.run();
      return;
    }

    close();
    if (entry.photo !== undefined) {
      /* Photos live on the gallery page; jump there and open the viewer. */
      var target = base + entry.url;
      if (document.querySelector(".photo-card")) {
        var cards = document.querySelectorAll(".photo-card");
        if (cards[entry.photo]) {
          cards[entry.photo].click();
          return;
        }
      }
      window.location.href = target + "#photo-" + entry.photo;
      return;
    }

    window.location.href = base + entry.url;
  }

  function load() {
    /* assets/search-index.js sets this global. It is a script rather than JSON
       so the palette also works when a page is opened straight from disk,
       where fetch() of a file:// URL is blocked. */
    index = window.SITE_SEARCH_INDEX || [];
  }

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "palette";
    dialog.setAttribute("aria-label", "Search the site");
    dialog.innerHTML =
      '<div class="palette__field">' +
      '<span class="palette__prompt" aria-hidden="true">$</span>' +
      '<input class="palette__input" type="text" autocomplete="off"' +
      ' spellcheck="false" aria-label="Search pages, posts, and photos"' +
      ' aria-controls="palette-results" placeholder="Search posts, photos, pages…" />' +
      "</div>" +
      '<ul class="palette__results" id="palette-results" role="listbox"' +
      ' aria-label="Results"></ul>' +
      '<p class="palette__footer">' +
      "<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>" +
      "<span><kbd>↵</kbd> open</span>" +
      "<span><kbd>Esc</kbd> close</span>" +
      "</p>";

    document.body.appendChild(dialog);
    input = dialog.querySelector(".palette__input");
    results = dialog.querySelector(".palette__results");

    input.addEventListener("input", function () {
      render(search(input.value));
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        highlight(selected + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        highlight(selected - 1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        choose(selected);
      }
    });

    results.addEventListener("click", function (event) {
      var item = event.target.closest(".palette__item");
      if (item) {
        choose(Number(item.getAttribute("data-position")));
      }
    });

    results.addEventListener("mousemove", function (event) {
      var item = event.target.closest(".palette__item");
      if (item) {
        highlight(Number(item.getAttribute("data-position")));
      }
    });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        close();
      }
    });
  }

  function open() {
    if (!dialog) {
      build();
    }

    load();
    input.value = "";
    render(search(""));

    if (!dialog.open) {
      dialog.showModal();
    }
    input.focus();
  }

  function close() {
    if (dialog && dialog.open) {
      dialog.close();
    }
  }

  document.addEventListener("keydown", function (event) {
    var isK = event.key === "k" || event.key === "K";
    if (isK && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (dialog && dialog.open) {
        close();
      } else {
        open();
      }
      return;
    }

    /* "/" is the other muscle memory for search, but not while typing. */
    if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
      var tag = (event.target.tagName || "").toLowerCase();
      var typing = tag === "input" || tag === "textarea" || event.target.isContentEditable;
      if (!typing) {
        event.preventDefault();
        open();
      }
    }
  });

  window.openSitePalette = open;

  if (TRIGGER) {
    TRIGGER.addEventListener("click", open);
    /* Show the real shortcut for the visitor's platform. */
    var key = TRIGGER.querySelector("kbd");
    if (key && !/Mac|iPhone|iPad/.test(navigator.platform)) {
      key.textContent = "Ctrl K";
    }
  }
})();
