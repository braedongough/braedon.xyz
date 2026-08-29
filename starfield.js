/* starfield.js — Genesis parallax starfield.
   Fixed canvas, z-index 0, pointer-events none. 3 depth layers, quantized twinkle.
   Arrow keys / WASD nudge the drift vector via window.__starfield.nudge (main.js wires keys).
   ?nostars kills init entirely. prefers-reduced-motion → ONE static frame, no loop. */
(() => {
  "use strict";

  if (document.getElementById("starfield")) return;

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.id = "starfield";
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const NEON = ["#00D9E8", "#F02CA8", "#91F26A"];
  const NEON_GOLD = ["#FFD91A", "#FFB500", "#FFF7D0"];
  const TWINKLE = [0.55, 0.75, 0.92, 1.0];
  /* layers: far → near. share = fraction of star count */
  const LAYERS = [
    { speed: 9, mult: 0.35, size: 1, share: 0.55 },
    { speed: 20, mult: 0.65, size: 1, share: 0.3 },
    { speed: 38, mult: 1, size: 2, share: 0.15 },
  ];

  let palette = NEON;

  // gold-family stars while chrome-mode is active; standard set otherwise
  new MutationObserver(() => {
    const gold = document.documentElement.classList.contains("chrome-mode");
    if ((palette === NEON_GOLD) !== gold) {
      palette = gold ? NEON_GOLD : NEON;
      recolor(palette);
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  function recolor(set) {
    for (const s of stars) {
      if (!s.neon) continue;
      s.color = set ? set[(Math.random() * set.length) | 0] : s.color;
    }
    if (REDUCED) draw(0);
  }

  let W = 0;
  let H = 0;
  let stars = [];
  let drift = { x: 0, y: 0 }; // px/sec, decays to 0
  let rafId = 0;
  let lastTs = 0;
  let resizeTimer = 0;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function scatter() {
    const count = Math.round(Math.min(170, Math.max(90, (W * H) / 11000)));
    stars = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let acc = 0;
      let layer = LAYERS[0];
      for (const l of LAYERS) {
        acc += l.share;
        if (r <= acc) {
          layer = l;
          break;
        }
      }
      const neon = Math.random() < 0.30; // colored stars
      stars.push({
        layer,
        x: Math.random() * W,
        y: Math.random() * H,
        neon,
        color: neon
          ? palette[(Math.random() * palette.length) | 0]
          : Math.random() < 0.25
            ? "#FFF7D0"
            : "#FFFFFF",
        base: rand(0.55, 1.0),
        twinkle: Math.random() < 0.4,
        step: 0,
        nextTs: 0,
      });
    }
  }

  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    const scale = dt / 1000;
    for (const s of stars) {
      if (s.twinkle && now >= s.nextTs) {
        s.step = (s.step + 1) & 3; // quantized twinkle, alpha steps
        s.nextTs = now + rand(240, 720);
      }
      s.x += (-s.layer.speed + drift.x * s.layer.mult) * scale;
      s.y += drift.y * s.layer.mult * scale;
      if (s.x < -2) s.x += W + 4;
      else if (s.x > W + 2) s.x -= W + 4;
      let alpha = s.base * (s.twinkle ? TWINKLE[s.step] : 1);
      if (alpha > 1.0) alpha = 1.0;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x | 0, s.y | 0, s.layer.size, s.layer.size);
    }
    ctx.globalAlpha = 1;
  }

  function step(ts) {
    const dt = Math.min(60, ts - lastTs);
    lastTs = ts;
    const decay = Math.max(0, 1 - dt * 0.0014); // drift decays back to base
    drift.x *= decay;
    drift.y *= decay;
    if (Math.abs(drift.x) < 0.05) drift.x = 0;
    if (Math.abs(drift.y) < 0.05) drift.y = 0;
    draw(dt);
    rafId = requestAnimationFrame(step);
  }

  function setRunning(run) {
    if (REDUCED) return;
    if (run && !rafId) {
      lastTs = performance.now();
      rafId = requestAnimationFrame(step);
    } else if (!run && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1); // DPR capped
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scatter();
    if (REDUCED) draw(0); // reduced motion: single static frame
  }

  document.addEventListener("visibilitychange", () => setRunning(!document.hidden));

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150); // debounced
  });

  /* minimal API for main.js ship-steering */
  window.__starfield = {
    nudge(dx, dy) {
      if (REDUCED) return;
      drift.x = Math.max(-90, Math.min(90, drift.x + dx));
      drift.y = Math.max(-70, Math.min(70, drift.y + dy));
    },
  };

  resize();
  draw(0); // guaranteed first paint
  setRunning(true);
})();