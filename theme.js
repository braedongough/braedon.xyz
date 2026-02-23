(function () {
  var themes = {
    warm: {
      bg: "#FAF6F0",
      text: "#2A2520",
      accent: "#B8860B",
      secondary: "#8B7D6B",
      border: "#D4A854",
      separator: "#e8e0d4"
    },
    blue: {
      bg: "#F0F3FA",
      text: "#1A2333",
      accent: "#2B5EA7",
      secondary: "#6B7A8B",
      border: "#5B8EC9",
      separator: "#D4DCE8"
    },
    green: {
      bg: "#F0F7F2",
      text: "#1E2A22",
      accent: "#2D7A4F",
      secondary: "#6B8B76",
      border: "#4DAA74",
      separator: "#D4E8DB"
    },
    pink: {
      bg: "#FAF0F3",
      text: "#2A1E22",
      accent: "#A94266",
      secondary: "#8B6B78",
      border: "#D4689A",
      separator: "#E8D4DC"
    },
    chrome: {
      bg: "#D8D8E0",
      text: "#1C1C22",
      accent: "#6E6E7A",
      secondary: "#888890",
      border: "#AAAAB4",
      separator: "#C0C0C8"
    }
  };

  function applyTheme(name) {
    var t = themes[name];
    if (!t) {
      return;
    }
    var root = document.documentElement;
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--text", t.text);
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--secondary", t.secondary);
    root.style.setProperty("--border", t.border);
    root.style.setProperty("--separator", t.separator);
    if (name === "chrome") {
      root.setAttribute("data-theme", "chrome");
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function pickRandom() {
    var roll = Math.random() * 100;
    if (roll < 24) {
      return "warm";
    }
    if (roll < 48) {
      return "blue";
    }
    if (roll < 72) {
      return "green";
    }
    if (roll < 96) {
      return "pink";
    }
    return "chrome";
  }

  var chosen;
  var stored = sessionStorage.getItem("theme");
  var isReload = false;
  var navEntries = performance.getEntriesByType("navigation");
  if (navEntries.length > 0) {
    isReload = navEntries[0].type === "reload";
  }

  if (stored === "chrome" && !isReload) {
    chosen = "chrome";
  } else {
    if (isReload) {
      sessionStorage.removeItem("theme");
    }
    chosen = pickRandom();
  }

  applyTheme(chosen);

  document.addEventListener("DOMContentLoaded", function () {
    var trigger = document.getElementById("chrome-trigger");
    if (!trigger) {
      return;
    }
    trigger.addEventListener("click", function () {
      if (sessionStorage.getItem("theme") === "chrome") {
        sessionStorage.removeItem("theme");
        chosen = pickRandom();
      } else {
        sessionStorage.setItem("theme", "chrome");
        chosen = "chrome";
      }
      applyTheme(chosen);
    });
  });
})();
