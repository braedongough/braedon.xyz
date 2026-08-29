/* main.js — Genesis site behaviors.
   Boot overlay, WebAudio sfx (no files), sound toggle, HUD (XP ladder),
   starfield injection, arrow-key cursors (nav + contact menu),
   starfield steering, Konami chrome mode, 404 countdown.
   Switches: ?noboot (skip boot), ?nostars (skip starfield). */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const on404 = document.body.dataset.page === "404";

  /* ---------------- Audio ---------------- */

  let audioCtx = null;
  let soundOn = localStorage.getItem("snd") === "on";
  let lastTick = 0;

  function getCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, start, dur, gainPeak, type = "square") {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainPeak, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.02);
  }

  /* NES-style LEVEL UP jingle. Square-wave only, ≤1.6s, gain ≤0.06.
     Run: E5 B5 E6 G6 B6 G6 (~90ms each) → land G6 (320ms) → grace E7 (120ms).
     E minor run resolving to high G — reads as "LEVEL UP". */
  let jingleUntil = 0;

  function jingle() {
    if (!soundOn || !getCtx()) return;
    const now = performance.now();
    if (now < jingleUntil) return; // don't stack
    jingleUntil = now + 1600;
    const run = [
      [659.25, 0.0], // E5
      [987.77, 0.09], // B5
      [1318.51, 0.18], // E6
      [1567.98, 0.27], // G6
      [1975.53, 0.36], // B6
      [1567.98, 0.45], // G6
    ];
    for (const [f, t] of run) tone(f, t, 0.09, 0.055);
    tone(1567.98, 0.54, 0.32, 0.06); // sustained high G
    tone(2637.02, 0.62, 0.12, 0.05); // grace octave flourish E7
  }

  function sfx(name) {
    if (!soundOn || !getCtx()) return;
    if (name === "chime") {
      tone(659.25, 0, 0.09, 0.06); // E5
      tone(987.77, 0.1, 0.12, 0.06); // B5
    } else if (name === "blip") {
      tone(880, 0, 0.06, 0.05);
    } else if (name === "unlock") {
      jingle();
    } else if (name === "tick") {
      const now = performance.now();
      if (now - lastTick < 80) return; // rate limit
      lastTick = now;
      tone(1200, 0, 0.02, 0.02);
    } else if (name === "beep") {
      tone(440, 0, 0.18, 0.06);
    }
  }
  /* ---------------- Starfield (every page incl. 404) ---------------- */

  if (!new URLSearchParams(window.location.search).has("nostars")) {
    const sf = document.createElement("script");
    sf.src = "/starfield.js";
    sf.defer = true;
    document.head.appendChild(sf);
  }

  /* ---------------- Sound toggle button ---------------- */

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn snd-toggle";
  btn.textContent = soundOn ? "SND ON" : "SND OFF";
  btn.setAttribute("aria-pressed", String(soundOn));
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    soundOn = !soundOn;
    localStorage.setItem("snd", soundOn ? "on" : "off");
    btn.textContent = soundOn ? "SND ON" : "SND OFF";
    btn.setAttribute("aria-pressed", String(soundOn));
    if (soundOn) sfx("blip");
  });
  document.body.appendChild(btn);

  /* ---------------- HUD chrome (every page except 404) ---------------- */

  const navEl = $("nav");
  let hudNavLinks = [];

  if (navEl && !on404) {
    const links = Array.from(navEl.querySelectorAll("a"));
    hudNavLinks = links;

    const hud = document.createElement("header");
    hud.className = "hud";

    const bar = document.createElement("div");
    bar.className = "hud-bar";

    // left: wordmark home link
    const left = document.createElement("div");
    left.className = "hud-left";
    left.innerHTML = '<a class="hud-wordmark" href="/">BRAEDON.XYZ</a>';

    // center: nav links
    const ul = document.createElement("ul");
    ul.className = "hud-nav";
    for (const a of links) ul.appendChild(a.parentElement); // move <li>
    ul.querySelectorAll("a").forEach((a) => {
      a.addEventListener("mouseenter", () => sfx("tick"));
    });

    // right: LV + XP bar
    const right = document.createElement("div");
    right.className = "hud-right";
    right.setAttribute("aria-hidden", "true");
    right.innerHTML =
      '<span class="hud-lv" id="hud-lv">LV.1</span>' +
      '<span class="xpbar"><span class="xpfill" id="hud-fill"></span></span>';

    bar.append(left, ul, right);
    hud.appendChild(bar);
    navEl.replaceWith(hud);

    const fillEl = $("#hud-fill");
    const lvEl = $("#hud-lv");
    let queued = false;

    function updateHud() {
      queued = false;
      const doc = document.scrollingElement;
      const scrollable = Math.max(0, doc.scrollHeight - window.innerHeight);
      const depth = scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 1;
      if (fillEl) fillEl.style.transform = "scaleX(" + depth.toFixed(4) + ")";
      if (lvEl) lvEl.textContent = "LV." + (1 + Math.floor(depth * 9));
    }

    function scheduleHud() {
      if (queued) return;
      queued = true;
      // rAF stalls on hidden/occluded documents (background tabs, some headless
      // contexts) — guarantee the HUD still settles with a fallback timer.
      let ran = false;
      const run = () => {
        if (ran) return;
        ran = true;
        updateHud();
      };
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(run);
        setTimeout(run, 60);
      } else {
        setTimeout(updateHud, 0);
      }
    }

    window.addEventListener("scroll", scheduleHud, { passive: true });
    updateHud();
  }

  /* ---------------- Boot overlay ---------------- */

  const skipBoot =
    new URLSearchParams(window.location.search).has("noboot") ||
    sessionStorage.getItem("booted") === "1";

  function dismissBoot(overlay) {
    if (!overlay.isConnected) return;
    sfx("chime");
    overlay.classList.add("boot-fading");
    const delay = REDUCED ? 150 : 250;
    setTimeout(() => overlay.remove(), delay);
    sessionStorage.setItem("booted", "1");
    window.removeEventListener("keydown", onBootKey);
    window.removeEventListener("click", onBootClick);
  }

  function onBootKey(e) {
    const overlay = $("#boot-overlay");
    if (overlay) {
      dismissBoot(overlay);
    }
  }

  function onBootClick() {
    const overlay = $("#boot-overlay");
    if (overlay) dismissBoot(overlay);
  }

  if (!skipBoot) {
    const overlay = document.createElement("div");
    overlay.id = "boot-overlay";
    overlay.className = "boot-overlay";
    overlay.innerHTML =
      '<p class="boot-logo">BRAEDON.XYZ</p>' +
      '<p class="boot-sub">16-BIT // SOFTWARE ENGINEER // COPENHAGEN</p>' +
      '<p class="boot-press">PRESS START</p>';
    document.body.appendChild(overlay);
    window.addEventListener("keydown", onBootKey);
    window.addEventListener("click", onBootClick);
  }

  /* ---------------- 404 countdown ---------------- */

  const countdownEl = $("#countdown");
  if (countdownEl && on404) {
    let n = 10;
    let cancelled = false;
    let beepedAt5 = false;
    const render = () => (countdownEl.textContent = "AUTO-CONTINUE IN " + n);
    render();
    const timer = setInterval(() => {
      if (cancelled) return;
      n -= 1;
      if (n <= 0) {
        clearInterval(timer);
        window.location.href = "/";
        return;
      }
      if (n === 5) {
        beepedAt5 = true;
        sfx("beep");
      }
      render();
    }, 1000);
    const cancel = (e) => {
      if (e.type === "keydown" && e.key === "Enter") {
        window.location.href = "/";
        return;
      }
      if (!cancelled) {
        cancelled = true;
        clearInterval(timer);
        countdownEl.textContent = "PRESS ENTER TO CONTINUE";
      }
    };
    window.addEventListener("keydown", cancel);
    window.addEventListener("click", cancel);
  }

  /* ---------------- Arrow-key cursors: nav + selectable lists ---------------- */

  const menuLinks = Array.from(document.querySelectorAll(".contact-list a"));
  let navIndex = -1;
  let navArmed = false;
  let mode = ""; // "nav" | "menu"

  function select(links, i, arr) {
    arr.forEach((a) => a.classList.remove("is-selected"));
    navIndex = (i + arr.length) % arr.length;
    const link = arr[navIndex];
    link.classList.add("is-selected");
    link.focus({ preventScroll: true });
    sfx("blip");
  }


  window.addEventListener("keydown", (e) => {
    // once armed in a mode, stay in that mode until page nav
    if (!navArmed) {
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft"
      ) {
        // explicit [data-select-menu] wins when present (contact SELECT OPTION);
        // otherwise arrow keys drive the HUD nav
        const explicit = document.querySelector("[data-select-menu]");
        const list = explicit
          ? Array.from(explicit.querySelectorAll("a"))
          : hudNavLinks.length
            ? hudNavLinks
            : menuLinks;
        if (!list.length) return;
        navArmed = true;
        mode = list === hudNavLinks ? "nav" : "menu";
        e.preventDefault();
        const start = e.key === "ArrowUp" || e.key === "ArrowLeft" ? list.length - 1 : 0;
        selectNavList(list, start);
      }
      return;
    }
    const arr = mode === "menu" ? menuLinks : hudNavLinks;
    if (!arr.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      selectNavList(arr, navIndex + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      selectNavList(arr, navIndex - 1);
    } else if (e.key === "Enter" && navIndex >= 0) {
      const link = arr[navIndex];
      if (link) window.location.href = link.href || (link.getAttribute("href") || "/");
    }
  });

  function selectNavList(arr, i) {
    const target = arr[(i + arr.length) % arr.length];
    arr.forEach((a) => a.classList.remove("is-selected"));
    navIndex = arr.indexOf(target);
    target.classList.add("is-selected");
    target.focus({ preventScroll: true });
    sfx("blip");
  }

  /* ---------------- Starfield steering (arrows/WASD nudge drift) ---------------- */

  const steerRepeat = () => {
    const sf = window.__starfield;
    if (!sf) return;
    // decay handled in starfield; nudge on a throttle since keydown repeats
    const now = performance.now();
    if (now - (steerRepeat.t || 0) < 90) return;
    steerRepeat.t = now;
    return true;
  };

  window.addEventListener("keydown", (e) => {
    // don't hijack steering when the arrow-key menu/nav cursor is armed
    if (navArmed) return;
    const k = e.key.toLowerCase();
    const map = {
      arrowup: [0, -14],
      arrowdown: [0, 14],
      arrowleft: [-14, 0],
      arrowright: [14, 0],
      w: [0, -14],
      s: [0, 14],
      a: [-14, 0],
      d: [14, 0],
    };
    const v = map[k];
    if (!v) return;
    if (!steerRepeat()) return;
    if (window.__starfield) window.__starfield.nudge(v[0], v[1]);
  });

  /* ---------------- Konami code → chrome mode ---------------- */

  const KONAMI = [
    "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
    "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
    "b", "a",
  ];
  let toastTimer = 0;

  function showToast(text, tone) {
    let host = $("#hud-toast");
    if (!host) {
      host = document.createElement("div");
      host.id = "hud-toast";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    const msg = document.createElement("div");
    msg.className = "toast toast--" + tone;
    msg.textContent = text;
    host.replaceChildren(msg);
    clearTimeout(toastTimer);
    // re-trigger the pop-in animation even if the node is reused
    void msg.offsetWidth;
    msg.classList.add("toast-in");
    toastTimer = setTimeout(() => msg.classList.add("toast-out"), tone === "gold" ? 1600 : 800);
  }

  function chromeFlash() {
    if (REDUCED) return;
    const el = document.createElement("div");
    el.className = "chrome-flash";
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // safety net
  }

  function setChrome(on, { silent = false } = {}) {
    const html = document.documentElement;
    html.classList.toggle("chrome-mode", on);
    sessionStorage.setItem("chrome", on ? "1" : "");
    if (silent) return;
    if (on) {
      chromeFlash();
      showToast("\u2605 CHEAT ACTIVATED \u2605", "gold");
      sfx("unlock");
    } else {
      showToast("CHROME OFF", "cyan");
      sfx("blip");
    }
  }

  // already-unlocked state: apply silently, no fanfare
  if (sessionStorage.getItem("chrome") === "1") {
    document.documentElement.classList.add("chrome-mode");
  }

  const seq = [];

  window.addEventListener("keydown", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    seq.push(key);
    if (seq.length > KONAMI.length) seq.shift();
    if (seq.length === KONAMI.length && KONAMI.every((k, i) => k === seq[i])) {
      seq.length = 0;
      setChrome(!document.documentElement.classList.contains("chrome-mode"));
    }
  });
})();