/* Resolves the colour theme before first paint so there is no flash, then wires
   up the header toggle. Loaded synchronously from <head> for that reason. */
(function () {
  var STORAGE_KEY = "theme";
  var root = document.documentElement;
  var systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function savedTheme() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch (error) {
      return null;
    }
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
  }

  apply(savedTheme() || (systemDark.matches ? "dark" : "light"));

  systemDark.addEventListener("change", function (event) {
    if (!savedTheme()) {
      apply(event.matches ? "dark" : "light");
    }
  });

  function describe(button) {
    var isDark = root.getAttribute("data-theme") === "dark";
    var label = isDark ? "Switch to light mode" : "Switch to dark mode";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.setAttribute("aria-pressed", isDark ? "true" : "false");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.querySelector(".theme-toggle");
    if (!button) {
      return;
    }

    describe(button);

    button.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (error) {
        /* Private browsing: the choice just will not persist. */
      }
      apply(next);
      describe(button);
    });
  });
})();
