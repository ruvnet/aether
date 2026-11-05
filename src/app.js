(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    canvas = $("cosmos"),
    ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    $("world-title").textContent = "Your browser needs a little more space";
    $("world-description").textContent = "Please open Aether in a browser with Canvas support.";
    return;
  }
  const TAU = Math.PI * 2,
    N = 2800,
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let W = innerWidth,
    H = innerHeight,
    dpr = 1,
    time = 0,
    last = 0,
    world = 0,
    energy = 0.5,
    gravity = 0.6,
    paused = reduced.matches,
    palette = 0,
    seed = Math.random() * 1000,
    toastTimer,
    frame = 0;
  const pointer = { x: 0, y: 0, active: false, down: false },
    ripples = [],
    particles = [],
    stars = [];
  const worlds = [
    ["The spiral galaxy", "A thousand little lights.<br>One beautifully imperfect orbit."],
    ["A world within a world", "Every point, a possibility.<br>Every angle, a different story."],
    ["An ocean without edges", "Some things make more sense<br>when you let them flow."],
    ["Something quietly blooming", "Even in the infinite,<br>there is room to grow."],
    ["The beautiful in-between", "A delicate balance<br>between holding on and letting go."],
  ];
  const palettes = [
    {
      name: "Sage",
      accent: "#d2edbc",
      rgb: [185, 227, 160],
      second: [80, 173, 145],
      bg: [8, 17, 15],
    },
    {
      name: "Ember",
      accent: "#efc394",
      rgb: [248, 195, 133],
      second: [205, 103, 64],
      bg: [22, 14, 12],
    },
    {
      name: "Glacier",
      accent: "#a7d9f0",
      rgb: [162, 219, 247],
      second: [64, 145, 197],
      bg: [8, 15, 23],
    },
    {
      name: "Rose",
      accent: "#e9aec6",
      rgb: [242, 180, 207],
      second: [178, 95, 154],
      bg: [22, 11, 20],
    },
  ];
  function rand(i, j) {
    const n = Math.sin(i * 127.1 + j * 311.7 + seed) * 43758.5453;
    return n - Math.floor(n);
  }
  for (let i = 0; i < N; i++)
    particles.push({
      x: 0,
      y: 0,
      z: 0,
      u: (i + 0.5) / N,
      v: rand(i, 2),
      w: rand(i, 3),
      j: rand(i, 4),
      size: 0.35 + rand(i, 5) * 1.4,
      sx: 0,
      sy: 0,
      pz: 1,
    });
  for (let i = 0; i < 170; i++)
    stars.push({
      x: rand(i, 8),
      y: rand(i, 9),
      r: rand(i, 10) * 0.9 + 0.2,
      phase: rand(i, 11) * TAU,
    });
  function resize() {
    W = innerWidth;
    H = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (paused) render();
  }
  resize();
  function target(p, i) {
    let x, y, z;
    const a = p.v * TAU,
      b = p.w * TAU;
    if (world === 0) {
      const r = Math.pow(p.u, 0.62) * 2.85,
        arm = i % 4,
        theta = r * 1.48 + (arm * TAU) / 4 + (p.v - 0.5) * (0.3 + (1.15 * r) / 3);
      x = Math.cos(theta) * r;
      y = (p.w - 0.5) * (0.1 + 0.28 * (1 - r / 3));
      z = Math.sin(theta) * r;
      if (p.j > 0.91) {
        x *= 0.26;
        y = (p.v - 0.5) * 0.55;
        z *= 0.26;
      }
    } else if (world === 1) {
      const r = 2.05 + (p.w - 0.5) * 0.1,
        yy = 1 - 2 * p.u,
        rr = Math.sqrt(1 - yy * yy),
        theta = i * 2.3999632297;
      x = Math.cos(theta) * rr * r;
      y = yy * r;
      z = Math.sin(theta) * rr * r;
    } else if (world === 2) {
      x = (p.u - 0.5) * 6.1;
      z = (p.v - 0.5) * 4.5;
      y =
        Math.sin(x * 1.55 + time * 0.6) * 0.32 +
        Math.cos(z * 1.8 - time * 0.45) * 0.35 +
        Math.sin(x + z + time * 0.3) * 0.2;
    } else if (world === 3) {
      const theta = p.u * TAU * 13,
        phi = p.v * Math.PI,
        r = (1.65 + 0.7 * Math.sin(theta * 5 + phi * 2)) * (0.4 + 0.6 * Math.sin(phi));
      x = r * Math.cos(theta) * Math.sin(phi);
      y = r * Math.cos(phi) * 1.25;
      z = r * Math.sin(theta) * Math.sin(phi);
    } else {
      const ringR = 1.88 + 0.18 * Math.cos(a * 3 + time * 0.2),
        tube = 0.5 * Math.sqrt(p.w);
      x = (ringR + tube * Math.cos(b)) * Math.cos(a);
      y = tube * Math.sin(b);
      z = (ringR + tube * Math.cos(b)) * Math.sin(a);
      if (p.j > 0.94) {
        x *= 0.12;
        y *= 0.5;
        z *= 0.12;
      }
    }
    return [x, y, z];
  }
  function drawPoint(x, y, r, c, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  function render() {
    const pal = palettes[palette],
      bg = pal.bg;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgb(${bg})`;
    ctx.fillRect(0, 0, W, H);
    const mobile = W < 601,
      cx = W * (mobile ? 0.58 : 0.62),
      cy = H * (mobile ? 0.49 : 0.47),
      scale = Math.min(W * (mobile ? 0.185 : 0.125), H * 0.24),
      angle = time * 0.055,
      rotX = world === 1 ? 0.1 : world === 3 ? 0.2 : 0.49;
    let glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 3.1);
    glow.addColorStop(0, `rgba(${pal.second},.075)`);
    glow.addColorStop(0.45, `rgba(${pal.second},.032)`);
    glow.addColorStop(1, `rgba(${pal.second},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    for (const s of stars)
      drawPoint(
        s.x * W,
        s.y * H,
        s.r,
        "#b9cdb8",
        0.13 + 0.2 * (0.5 + 0.5 * Math.sin(time * 0.3 + s.phase)),
      );
    const ca = Math.cos(angle),
      sa = Math.sin(angle),
      cr = Math.cos(rotX),
      sr = Math.sin(rotX);
    const positions = [];
    for (let i = 0; i < N; i++) {
      const p = particles[i],
        t = target(p, i);
      const k = paused ? 1 : 0.045;
      p.x += (t[0] - p.x) * k;
      p.y += (t[1] - p.y) * k;
      p.z += (t[2] - p.z) * k;
      let x = p.x * ca - p.z * sa,
        z = p.x * sa + p.z * ca,
        y = p.y * cr - z * sr;
      z = p.y * sr + z * cr;
      const breathe = 1 + 0.018 * Math.sin(time * 0.4 + p.u * 4);
      x *= breathe;
      y *= breathe;
      const perspective = 7 / (7 + z),
        px = cx + x * scale * perspective,
        py = cy + y * scale * perspective;
      let dx = 0,
        dy = 0;
      if (pointer.active) {
        const ax = pointer.x - px,
          ay = pointer.y - py,
          dist = Math.hypot(ax, ay),
          strength =
            Math.exp((-dist * dist) / (scale * scale * 0.75)) *
            gravity *
            (pointer.down ? 0.36 : 0.19);
        dx = ax * strength;
        dy = ay * strength;
      }
      for (const ripple of ripples) {
        const ax = px - ripple.x,
          ay = py - ripple.y,
          dist = Math.hypot(ax, ay) || 1,
          diff = dist - ripple.age * 220,
          force = Math.exp((-diff * diff) / 1300) * (1 - ripple.age / 2.6) * 26;
        dx += (ax / dist) * force;
        dy += (ay / dist) * force;
      }
      p.sx = px + dx;
      p.sy = py + dy;
      p.pz = perspective;
      positions.push(p);
    }
    positions.sort((a, b) => a.pz - b.pz);
    ctx.globalCompositeOperation = "lighter";
    const rgb = pal.rgb,
      sec = pal.second;
    for (let i = 0; i < N; i++) {
      const p = positions[i],
        alpha = Math.min(0.92, (0.2 + p.j * 0.58) * p.pz),
        r = Math.max(0.25, p.size * p.pz * (p.j > 0.96 ? 1.65 : 1));
      const col = p.j > 0.77 ? "#f5f4df" : p.j > 0.35 ? `rgb(${rgb})` : `rgb(${sec})`;
      if (p.j > 0.96) {
        drawPoint(p.sx, p.sy, r * 4, `rgb(${rgb})`, alpha * 0.035);
        drawPoint(p.sx, p.sy, r * 2, `rgb(${rgb})`, alpha * 0.09);
      }
      drawPoint(p.sx, p.sy, r, col, alpha);
    }
    // A few bright paths make the structure legible without drowning it in lines.
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = `rgb(${rgb})`;
    for (let i = 0; i < N - 4; i += 43) {
      const p = particles[i],
        q = particles[i + 4],
        dist = Math.hypot(p.sx - q.sx, p.sy - q.sy);
      if (dist < scale * 0.48 && dist > 5) {
        ctx.globalAlpha = 0.09;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(q.sx, q.sy);
        ctx.stroke();
      }
    }
    for (const r of ripples) {
      ctx.globalAlpha = Math.max(0, 0.17 * (1 - r.age / 2.6));
      ctx.strokeStyle = `rgb(${rgb})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.age * 220, 0, TAU);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  function loop(stamp) {
    const dt = last ? Math.min((stamp - last) / 1000, 0.04) : 0.016;
    last = stamp;
    if (!paused && !document.hidden) {
      time += dt * (0.2 + energy * 1.8);
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].age += dt;
        if (ripples[i].age > 2.6) ripples.splice(i, 1);
      }
      render();
    }
    frame = requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  render();
  function notify(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
  }
  function selectWorld(n) {
    world = n;
    document
      .querySelectorAll("[data-world]")
      .forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.world) === n)));
    $("world-index").textContent = `0${n + 1} — 05 / WORLDS`;
    $("world-title").textContent = worlds[n][0];
    $("world-description").innerHTML = worlds[n][1];
    if (paused) render();
    if (audio.on) chime(1 + n);
  }
  function setPalette(n) {
    palette = n;
    const p = palettes[n];
    document.documentElement.style.setProperty("--accent", p.accent);
    document.documentElement.style.setProperty("--bg", `rgb(${p.bg})`);
    $("palette-name").textContent = p.name;
    document
      .querySelectorAll("[data-palette]")
      .forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.palette) === n)));
    if (paused) render();
  }
  function togglePause() {
    paused = !paused;
    $("pause").setAttribute("aria-pressed", String(paused));
    $("pause").setAttribute("aria-label", paused ? "Resume motion" : "Pause motion");
    $("pause-icon").innerHTML = paused
      ? '<path d="m8 5 11 7-11 7Z"/>'
      : '<path d="M9 5v14M15 5v14"/>';
    notify(paused ? "A moment of stillness." : "Let it unfold.");
    if (!paused) last = 0;
  }
  if (paused) {
    $("pause").setAttribute("aria-pressed", "true");
    $("pause").setAttribute("aria-label", "Resume motion");
    $("pause-icon").innerHTML = '<path d="m8 5 11 7-11 7Z"/>';
  }
  const audio = { ctx: null, on: false, gain: null, nodes: [] };
  function chime(index) {
    if (!audio.on || !audio.ctx) return;
    const c = audio.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = "sine";
    o.frequency.value = [220, 261.63, 293.66, 329.63, 392, 440, 523.25][index % 7];
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 2.7);
    o.connect(g);
    g.connect(audio.gain);
    o.start();
    o.stop(c.currentTime + 3);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  async function toggleSound() {
    try {
      if (!audio.ctx) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) {
          notify("This browser does not support ambient audio.");
          return;
        }
        audio.ctx = new Audio();
        audio.gain = audio.ctx.createGain();
        audio.gain.gain.value = 0;
        const filter = audio.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 850;
        audio.gain.connect(filter);
        filter.connect(audio.ctx.destination);
        [110, 164.81, 220, 277.18].forEach((f, i) => {
          const o = audio.ctx.createOscillator(),
            g = audio.ctx.createGain();
          o.type = "sine";
          o.frequency.value = f;
          o.detune.value = i * 2 - 3;
          g.gain.value = 0.075;
          o.connect(g);
          g.connect(audio.gain);
          o.start();
          audio.nodes.push(o, g);
        });
      }
      await audio.ctx.resume();
      audio.on = !audio.on;
      audio.gain.gain.cancelScheduledValues(audio.ctx.currentTime);
      audio.gain.gain.setTargetAtTime(audio.on ? 0.48 : 0, audio.ctx.currentTime, 0.5);
      $("sound").setAttribute("aria-pressed", String(audio.on));
      $("sound-label").textContent = audio.on ? "Sound on" : "Sound off";
      if (audio.on) chime(4);
    } catch {
      notify("Audio could not start. Try the sound button again.");
    }
  }
  document
    .querySelectorAll("[data-world]")
    .forEach((b) => b.addEventListener("click", () => selectWorld(Number(b.dataset.world))));
  document
    .querySelectorAll("[data-palette]")
    .forEach((b) => b.addEventListener("click", () => setPalette(Number(b.dataset.palette))));
  $("energy").addEventListener("input", (e) => {
    energy = Number(e.target.value) / 100;
    $("energy-value").value = e.target.value + "%";
  });
  $("gravity").addEventListener("input", (e) => {
    gravity = Number(e.target.value) / 100;
    $("gravity-value").value = e.target.value + "%";
    if (paused) render();
  });
  $("pause").addEventListener("click", togglePause);
  $("sound").addEventListener("click", toggleSound);
  $("tune").addEventListener("click", () => {
    const open = $("settings").hidden;
    $("settings").hidden = !open;
    $("tune").setAttribute("aria-expanded", String(open));
  });
  function shuffle() {
    seed = Math.random() * 1000;
    particles.forEach((p, i) => {
      p.v = rand(i, 2);
      p.w = rand(i, 3);
      p.j = rand(i, 4);
    });
    selectWorld((world + 1 + Math.floor(Math.random() * 4)) % 5);
    setPalette((palette + 1 + Math.floor(Math.random() * 3)) % 4);
    notify("A new universe. Just for you.");
  }
  $("shuffle").addEventListener("click", shuffle);
  canvas.addEventListener("pointermove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    if (paused) render();
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.active = false;
    pointer.down = false;
    if (paused) render();
  });
  canvas.addEventListener("pointerdown", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    pointer.down = true;
    canvas.setPointerCapture(e.pointerId);
    if (!paused) {
      ripples.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (ripples.length > 8) ripples.shift();
    }
    if (audio.on) chime(Math.floor((e.clientX / W) * 7));
    if (paused) render();
  });
  canvas.addEventListener("pointerup", (e) => {
    pointer.down = false;
    if (e.pointerType !== "mouse") pointer.active = false;
    if (paused) render();
  });
  canvas.addEventListener("pointercancel", () => {
    pointer.active = false;
    pointer.down = false;
  });
  async function capture() {
    const b = $("capture");
    b.disabled = true;
    try {
      render();
      const out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height;
      const c = out.getContext("2d");
      c.drawImage(canvas, 0, 0);
      const s = out.width / W;
      c.scale(s, s);
      c.fillStyle = "#f1f2e9";
      c.font = "500 22px sans-serif";
      c.fillText("aether.", 32, H - 50);
      c.fillStyle = palettes[palette].accent;
      c.font = "11px sans-serif";
      c.fillText(worlds[world][0] + "  /  " + new Date().toLocaleDateString(), 32, H - 28);
      const blob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
      if (!blob) throw Error("No image");
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `aether-${["galaxy", "sphere", "wave", "bloom", "orbit"][world]}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      notify("Your moment is ready to keep.");
    } catch {
      notify("Could not capture this moment. Please try again.");
    } finally {
      b.disabled = false;
    }
  }
  $("capture").addEventListener("click", capture);
  const guide = $("guide");
  ["help", "about", "footer-help"].forEach((id) =>
    $(id).addEventListener("click", () => guide.showModal()),
  );
  $("close-guide").addEventListener("click", () => guide.close());
  guide.addEventListener("click", (e) => {
    if (e.target === guide) {
      const r = guide.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        guide.close();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (
      guide.open ||
      ["INPUT", "BUTTON", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (e.key >= "1" && e.key <= "5") selectWorld(Number(e.key) - 1);
    else if (e.code === "Space") {
      e.preventDefault();
      togglePause();
    } else if (e.key.toLowerCase() === "s") toggleSound();
    else if (e.key.toLowerCase() === "r") shuffle();
    else if (e.key === "?") guide.showModal();
    else if (e.key === "Escape") {
      $("settings").hidden = true;
      $("tune").setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("visibilitychange", () => {
    last = 0;
    if (audio.ctx) {
      if (document.hidden) audio.ctx.suspend().catch(() => {});
      else if (audio.on) audio.ctx.resume().catch(() => {});
    }
  });
  window.addEventListener("resize", resize);
  reduced.addEventListener("change", (e) => {
    if (e.matches && !paused) togglePause();
  });
})();
