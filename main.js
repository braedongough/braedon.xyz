/* main.js — Genesis site behaviors.
   HUD,
   starfield injection, arrow-key cursors (nav + contact menu),
   starfield steering, reading list filters, Konami flames, 404 countdown.
   Switch: ?nostars (skip starfield). */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const on404 = document.body.dataset.page === "404";

  /* ---------------- Starfield (every page incl. 404) ---------------- */

  if (!new URLSearchParams(window.location.search).has("nostars")) {
    const sf = document.createElement("script");
    sf.src = "/starfield.js";
    sf.defer = true;
    document.head.appendChild(sf);
  }

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

    bar.append(left, ul);
    hud.appendChild(bar);
    navEl.replaceWith(hud);
  }

  /* ---------------- 404 countdown ---------------- */

  const countdownEl = $("#countdown");
  if (countdownEl && on404) {
    let n = 10;
    let cancelled = false;
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
  }


  // arrow keys and WASD belong to the field while typing or picking an option
  const inField = (e) => e.target instanceof Element && e.target.closest("input, select, textarea");

  window.addEventListener("keydown", (e) => {
    if (inField(e)) return;
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
    if (navArmed || inField(e)) return;
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

  /* ---------------- Reading list: search, filter, sort (Up next) ---------------- */

  const reading = $("[data-reading]");
  const readingList = reading && $(".reading-next .book-list", reading);
  if (readingList) {
    const columns = JSON.parse($(".reading-columns", reading).textContent);
    const books = Array.from(readingList.children);
    const head = $(".reading-next .reading-head", reading);
    const count = $(".reading-count", head);
    const typeKey = reading.dataset.type || "";
    const val = (book, key) => book.getAttribute("data-" + key) || "";
    const valuesOf = (key) => [...new Set(books.map((b) => val(b, key)).filter(Boolean))].sort();
    const params = new URLSearchParams(window.location.search);
    const el = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text) node.textContent = text;
      return node;
    };

    const tools = el("div", "reading-tools");
    const search = el("input");
    search.type = "search";
    search.placeholder = "Search up next";
    search.setAttribute("aria-label", "Search up next");
    search.value = params.get("q") || "";
    tools.appendChild(search);

    // one-click switch for the colour-coded Type column
    let typeValue = "";
    const typeButtons = [];
    if (typeKey) {
      const types = valuesOf(typeKey);
      const seg = el("div", "seg");
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", columns.find((c) => c.key === typeKey).label);
      typeValue = types.includes(params.get(typeKey)) ? params.get(typeKey) : "";
      for (const v of ["", ...types]) {
        const b = el("button", "", v || "All");
        b.type = "button";
        b.dataset.value = v;
        b.addEventListener("click", () => {
          typeValue = v;
          apply();
        });
        typeButtons.push(b);
        seg.appendChild(b);
      }
      tools.appendChild(seg);
    }

    const dateCol = columns.find((c) => c.kind === "date");
    const sorts = dateCol ? [[dateCol.key + ":desc", "Newest"], [dateCol.key + ":asc", "Oldest"]] : [];
    for (const c of columns.slice(0, 2)) sorts.push([c.key + ":asc", c.label + " A\u2013Z"]);
    const sortEl = el("select", "reading-sort");
    sortEl.setAttribute("aria-label", "Sort");
    for (const [v, text] of sorts) sortEl.add(new Option(text, v));
    sortEl.value = sorts.some(([v]) => v === params.get("sort")) ? params.get("sort") : sorts[0][0];
    sortEl.addEventListener("change", apply);
    tools.appendChild(sortEl);

    // less-used filters live in a panel behind one button
    const panel = el("div", "reading-filters");
    panel.id = "reading-filters";
    const filterEls = [];
    for (const c of columns) {
      if (c.kind !== "filter" || c.key === typeKey) continue;
      const values = valuesOf(c.key);
      if (values.length < 2) continue;
      const sel = el("select");
      sel.add(new Option("All", ""));
      for (const v of values) sel.add(new Option(v, v));
      sel.value = values.includes(params.get(c.key)) ? params.get(c.key) : "";
      sel.addEventListener("change", apply);
      const label = el("label");
      label.append(el("span", "", c.label), sel);
      panel.appendChild(label);
      filterEls.push([c, sel]);
    }
    const moreBtn = el("button", "btn reading-more");
    moreBtn.type = "button";
    moreBtn.setAttribute("aria-controls", panel.id);
    moreBtn.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      apply();
    });
    panel.hidden = !filterEls.some(([, sel]) => sel.value);
    if (filterEls.length) tools.appendChild(moreBtn);

    const empty = el("p", "reading-empty", "NO MATCHES. TRY ANOTHER FILTER.");
    head.after(tools, panel);
    readingList.after(empty);

    function apply() {
      const q = search.value.trim().toLowerCase();
      const active = filterEls.filter(([, sel]) => sel.value);
      const [key, dir] = sortEl.value.split(":");

      const shown = books.filter((b) => {
        if (typeValue && val(b, typeKey) !== typeValue) return false;
        if (active.some(([c, sel]) => val(b, c.key) !== sel.value)) return false;
        return !q || columns.some((c) => val(b, c.key).toLowerCase().includes(q));
      });
      // books missing the sort value always go last
      shown.sort((a, b) => {
        const x = val(a, key);
        const y = val(b, key);
        if (!x || !y) return (x ? 0 : 1) - (y ? 0 : 1);
        const cmp = x.localeCompare(y, undefined, { sensitivity: "base" });
        return dir === "desc" ? -cmp : cmp;
      });

      books.forEach((b) => (b.hidden = true));
      for (const b of shown) {
        b.hidden = false;
        readingList.appendChild(b);
      }
      count.textContent = shown.length === books.length ? books.length : shown.length + "/" + books.length;
      empty.hidden = shown.length > 0;
      typeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === typeValue)));
      moreBtn.textContent = "Filters" + (active.length ? " \u00B7 " + active.length : "") + (panel.hidden ? " \u25BE" : " \u25B4");
      moreBtn.setAttribute("aria-expanded", String(!panel.hidden));

      // keep unrelated switches like ?nostars
      const next = new URLSearchParams(window.location.search);
      for (const k of ["q", "sort", "dir", typeKey, ...filterEls.map(([c]) => c.key)]) if (k) next.delete(k);
      if (q) next.set("q", search.value.trim());
      if (typeValue) next.set(typeKey, typeValue);
      for (const [c, sel] of active) next.set(c.key, sel.value);
      if (sortEl.value !== sorts[0][0]) next.set("sort", sortEl.value);
      const qs = next.toString();
      history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
    }

    search.addEventListener("input", apply);
    apply();
  }

  /* ---------------- Konami code → pixel flames ---------------- */

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

  // Doom-style pixel fire rising from the bottom edge, burns out on its own.
  function flames() {
    if (REDUCED || $(".konami-fire")) return;
    const CELL = 6; // CSS px per fire pixel
    const MAX = 36;
    const css = getComputedStyle(document.documentElement);
    const rgb = (name) => {
      const hex = css.getPropertyValue(name).trim().slice(1);
      return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    };
    const palette = [null, ...["--magenta", "--danger", "--danger-hot", "--gold-deep", "--gold", "--cream"].map(rgb)];
    const cols = Math.ceil(window.innerWidth / CELL);
    const rows = Math.ceil(window.innerHeight / CELL);
    const heat = new Uint8Array(cols * rows);

    const canvas = document.createElement("canvas");
    canvas.className = "konami-fire";
    canvas.width = cols;
    canvas.height = rows;
    canvas.style.height = rows * CELL + "px";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(cols, rows);

    const start = performance.now();
    function frame(now) {
      // fuel: full blaze for 2.5s, then the base cools and the fire dies down
      const t = now - start;
      const fuel = t < 2500 ? MAX : Math.max(0, MAX - Math.floor((t - 2500) / 40));
      const base = (rows - 1) * cols;
      for (let x = 0; x < cols; x++) heat[base + x] = fuel && Math.random() < 0.85 ? fuel : fuel >> 1;
      for (let y = 1; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const src = y * cols + x;
          const decay = (Math.random() * 4) | 0;
          const dst = src - cols - decay + 1; // drift sideways as it rises
          heat[Math.max(0, Math.min(heat.length - 1, dst))] = Math.max(0, heat[src] - (decay & 1));
        }
      }
      let alive = false;
      for (let i = 0; i < heat.length; i++) {
        const c = palette[Math.ceil((heat[i] / MAX) * (palette.length - 1))];
        const o = i * 4;
        if (c) {
          alive = true;
          img.data[o] = c[0];
          img.data[o + 1] = c[1];
          img.data[o + 2] = c[2];
          img.data[o + 3] = 255;
        } else {
          img.data[o + 3] = 0;
        }
      }
      ctx.putImageData(img, 0, 0);
      if (alive || fuel) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  const seq = [];

  window.addEventListener("keydown", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    seq.push(key);
    if (seq.length > KONAMI.length) seq.shift();
    if (seq.length === KONAMI.length && KONAMI.every((k, i) => k === seq[i])) {
      seq.length = 0;
      flames();
      showToast("\u2605 CHEAT ACTIVATED \u2605", "gold");
    }
  });
})();