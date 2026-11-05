import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Generates the animated SVGs in docs/svg/ (hero, worlds, atmospheres, ripple).
// Usage: node scripts/generate-svgs.mjs [outDir]
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const out = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'svg');
const TAU = Math.PI * 2;
const f1 = n => (Math.round(n * 10) / 10).toString();
const f2 = n => (Math.round(n * 100) / 100).toString();
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hex = a => '#' + a.map(v => v.toString(16).padStart(2, '0')).join('');
const P = {
  sage:    { name: 'Sage',    acc: '#d2edbc', rgb: [185, 227, 160], sec: [80, 173, 145],  bg: '#08110f' },
  ember:   { name: 'Ember',   acc: '#efc394', rgb: [248, 195, 133], sec: [205, 103, 64],  bg: '#160e0c' },
  glacier: { name: 'Glacier', acc: '#a7d9f0', rgb: [162, 219, 247], sec: [64, 145, 197],  bg: '#080f17' },
  rose:    { name: 'Rose',    acc: '#e9aec6', rgb: [242, 180, 207], sec: [178, 95, 154],  bg: '#160b14' },
};
const FONT = "Manrope, 'DM Sans', 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// ---- same target shapes as the app (index.html) ----
function target(world, p, i, time = 0) {
  const a = p.v * TAU, b = p.w * TAU; let x, y, z;
  if (world === 0) {
    const r = Math.pow(p.u, .62) * 2.85, arm = i % 4, theta = r * 1.48 + arm * TAU / 4 + (p.v - .5) * (.3 + 1.15 * r / 3);
    x = Math.cos(theta) * r; y = (p.w - .5) * (.1 + .28 * (1 - r / 3)); z = Math.sin(theta) * r;
    if (p.j > .91) { x *= .26; y = (p.v - .5) * .55; z *= .26; }
  } else if (world === 1) {
    const r = 2.05 + (p.w - .5) * .1, yy = 1 - 2 * p.u, rr = Math.sqrt(1 - yy * yy), theta = i * 2.3999632297;
    x = Math.cos(theta) * rr * r; y = yy * r; z = Math.sin(theta) * rr * r;
  } else if (world === 2) {
    x = (p.u - .5) * 6.1; z = (p.v - .5) * 4.5;
    y = Math.sin(x * 1.55 + time * .6) * .32 + Math.cos(z * 1.8 - time * .45) * .35 + Math.sin(x + z + time * .3) * .2;
  } else if (world === 3) {
    const theta = p.u * TAU * 13, phi = p.v * Math.PI, r = (1.65 + .7 * Math.sin(theta * 5 + phi * 2)) * (.4 + .6 * Math.sin(phi));
    x = r * Math.cos(theta) * Math.sin(phi); y = r * Math.cos(phi) * 1.25; z = r * Math.sin(theta) * Math.sin(phi);
  } else {
    const ringR = 1.88 + .18 * Math.cos(a * 3 + time * .2), tube = .5 * Math.sqrt(p.w);
    x = (ringR + tube * Math.cos(b)) * Math.cos(a); y = tube * Math.sin(b); z = (ringR + tube * Math.cos(b)) * Math.sin(a);
    if (p.j > .94) { x *= .12; y *= .5; z *= .12; }
  }
  return [x, y, z];
}
function project(t, world, scale, angle = .35) {
  const rotX = world === 1 ? .1 : world === 3 ? .2 : .49;
  const ca = Math.cos(angle), sa = Math.sin(angle), cr = Math.cos(rotX), sr = Math.sin(rotX);
  let x = t[0] * ca - t[2] * sa, z = t[0] * sa + t[2] * ca, y = t[1] * cr - z * sr; z = t[1] * sr + z * cr;
  const per = 7 / (7 + z);
  return { x: x * scale * per, y: y * scale * per, per };
}
function makeParticles(n, seed) {
  const r = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => ({ u: (i + .5) / n, v: r(), w: r(), j: r(), size: .35 + r() * 1.4 }));
}

// ---- SMIL helpers ----
// hold-then-morph cycle across n states; `hold` = fraction of each segment spent holding.
function cycle(attr, vals, dur, hold = .7, ease = '.45 0 .2 1') {
  const n = vals.length, kt = [], v = [], ks = [];
  for (let i = 0; i < n; i++) {
    kt.push(i / n); v.push(vals[i]); ks.push('0 0 1 1');
    kt.push((i + hold) / n); v.push(vals[i]); ks.push(ease);
  }
  kt.push(1); v.push(vals[0]);
  return `<animate attributeName="${attr}" values="${v.join(';')}" keyTimes="${kt.map(f2).join(';')}" calcMode="spline" keySplines="${ks.join(';')}" dur="${dur}s" repeatCount="indefinite"/>`;
}
// opacity schedule: visible while state i is held.
function show(i, n, dur, hold = 1) {
  // visible over [i/n, (i+hold)/n]: fade in right after the window opens, fade out right before it
  // closes, so neighbouring labels never overlap (a very brief gap instead of ghosted text).
  const a = i / n, b = (i + hold) / n, fd = .025;
  const clamp = x => Math.max(0, Math.min(1, x));
  const f1v = t => clamp((t - a) / fd) * (1 - clamp((t - (b - fd)) / fd));
  const f = t => Math.max(f1v(t), f1v(t + 1), f1v(t - 1));
  const ts = new Set([0, 1]);
  for (const e of [a, a + fd, b - fd, b]) { const w = ((e % 1) + 1) % 1; ts.add(Math.round(w * 1000) / 1000); }
  const pts = [...ts].sort((x, y) => x - y).map(t => [t, f(t)]);
  return `<animate attributeName="opacity" values="${pts.map(p => f2(p[1])).join(';')}" keyTimes="${pts.map(p => f2(p[0])).join(';')}" dur="${dur}s" repeatCount="indefinite"/>`;
}
const twinkle = (lo, hi, dur, begin) => `<animate attributeName="opacity" values="${lo};${hi};${lo}" dur="${f1(dur)}s" begin="-${f1(begin)}s" repeatCount="indefinite"/>`;
const glow = (id, rgb, a0 = .16) => `<radialGradient id="${id}"><stop offset="0" stop-color="rgb(${rgb})" stop-opacity="${a0}"/><stop offset=".5" stop-color="rgb(${rgb})" stop-opacity="${a0 / 3}"/><stop offset="1" stop-color="rgb(${rgb})" stop-opacity="0"/></radialGradient>`;
const svgOpen = (w, h, title, desc) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d"><title id="t">${title}</title><desc id="d">${desc}</desc>`;

// ---- dot colour pick, same thresholds as the app ----
function dotColor(p, pal) { return p.j > .77 ? '#f5f4df' : p.j > .35 ? hex(pal.rgb) : hex(pal.sec); }

// ===================== 1. hero =====================
{
  const W = 1200, H = 420, cx = 840, cy = 215, s = 108;
  const pal = P.sage, ps = makeParticles(1100, 7), rnd = mulberry32(99);
  let dots = '';
  ps.forEach((p, i) => {
    const t = target(0, p, i); const x = t[0] * s, y = t[2] * s;
    const r = Math.max(.6, p.size * (p.j > .96 ? 1.7 : 1.05)), op = Math.min(.95, .4 + p.j * .55);
    const tw = i % 11 === 0 ? twinkle(f2(op * .35), f2(op), 2 + rnd() * 3, rnd() * 5) : '';
    if (p.j > .96) dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(r * 4)}" fill="${hex(pal.rgb)}" opacity=".05"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(r * 2)}" fill="${hex(pal.rgb)}" opacity=".12"/>`;
    dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(r)}" fill="${dotColor(p, pal)}" opacity="${f2(op)}">${tw}</circle>`;
  });
  let stars = '';
  for (let i = 0; i < 70; i++) stars += `<circle cx="${f1(rnd() * W)}" cy="${f1(rnd() * H)}" r="${f2(.3 + rnd() * .8)}" fill="#b9cdb8" opacity=".2">${twinkle(.08, .42, 3 + rnd() * 4, rnd() * 6)}</circle>`;
  const svg = `${svgOpen(W, H, 'aether', 'A rotating spiral galaxy of luminous particles beside the words Make room for wonder.')}
<defs>${glow('g', pal.sec, .2)}<radialGradient id="v" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#030907" stop-opacity="0"/><stop offset="1" stop-color="#030907" stop-opacity=".75"/></radialGradient></defs>
<rect width="${W}" height="${H}" rx="22" fill="${pal.bg}"/>
<ellipse cx="${cx}" cy="${cy}" rx="420" ry="230" fill="url(#g)"/>
${stars}
<g transform="translate(${cx} ${cy}) scale(1 .5)"><g>${dots}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="110s" repeatCount="indefinite"/></g></g>
<rect width="${W}" height="${H}" rx="22" fill="url(#v)"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="21.5" fill="none" stroke="#ffffff" stroke-opacity=".08"/>
<g font-family="${FONT}">
<circle cx="76" cy="112" r="3" fill="${pal.acc}">${twinkle(.35, 1, 2.4, 0)}</circle>
<text x="92" y="117" font-size="12" letter-spacing="3.4" fill="${pal.acc}" font-weight="600">A LITTLE UNIVERSE, ENTIRELY YOURS</text>
<text x="72" y="206" font-size="76" font-weight="300" letter-spacing="-3.5" fill="#f1f2e9">Make room</text>
<text x="72" y="284" font-size="76" font-weight="300" letter-spacing="-3.5" fill="#f1f2e9">for <tspan fill="${pal.acc}">wonder.</tspan></text>
<text x="76" y="346" font-size="14" fill="#98a59d" letter-spacing=".3">5 worlds  ·  4 atmospheres  ·  2,800 luminous particles  ·  one HTML file</text>
</g>
</svg>`;
  writeFileSync(join(out, 'hero.svg'), svg);
}

// ===================== 2. five worlds morph =====================
{
  const W = 900, H = 560, cx = 450, cy = 238, s = 94, N = 420, DUR = 25;
  const pal = P.sage, ps = makeParticles(N, 21), rnd = mulberry32(5);
  const names = [['The spiral galaxy', 'A thousand little lights. One beautifully imperfect orbit.'], ['A world within a world', 'Every point, a possibility. Every angle, a different story.'], ['An ocean without edges', 'Some things make more sense when you let them flow.'], ['Something quietly blooming', 'Even in the infinite, there is room to grow.'], ['The beautiful in-between', 'A delicate balance between holding on and letting go.']];
  const tags = ['Galaxy', 'Sphere', 'Wave', 'Bloom', 'Orbit'];
  let dots = '';
  ps.forEach((p, i) => {
    const pos = [0, 1, 2, 3, 4].map(w => project(target(w, p, i), w, s));
    const xs = pos.map(q => f1(cx + q.x)), ys = pos.map(q => f1(cy + q.y));
    const r = Math.max(.7, p.size * 1.3), op = Math.min(.95, .42 + p.j * .5);
    dots += `<circle r="${f2(r)}" cx="${xs[0]}" cy="${ys[0]}" fill="${dotColor(p, pal)}" opacity="${f2(op)}">${cycle('cx', xs, DUR)}${cycle('cy', ys, DUR)}</circle>`;
  });
  let labels = '', dotsNav = '';
  names.forEach((nm, i) => {
    labels += `<g opacity="${i === 0 ? 1 : 0}">${show(i, 5, DUR)}<text x="450" y="468" text-anchor="middle" font-family="${MONO}" font-size="12" fill="#829285" letter-spacing="2">0${i + 1} — 05 / WORLDS</text><text x="450" y="502" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="400" letter-spacing="-.7" fill="#f1f2e9">${nm[0]}</text><text x="450" y="528" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#98a59d">${nm[1]}</text></g>`;
    dotsNav += `<g transform="translate(${60 + i * 0},${0})"></g>`;
  });
  // world-switcher pills
  let pills = '';
  tags.forEach((t, i) => {
    const x = 450 - 2.5 * 84 + i * 84 + 4;
    pills += `<g><rect x="${x}" y="28" width="76" height="30" rx="15" fill="none" stroke="#d2edbc" stroke-opacity=".08"/><rect x="${x}" y="28" width="76" height="30" rx="15" fill="#d2edbc" fill-opacity=".1" stroke="${pal.acc}" stroke-opacity=".35" opacity="${i === 0 ? 1 : 0}">${show(i, 5, DUR)}</rect><text x="${x + 38}" y="48" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#9fac9f">${t}</text><text x="${x + 38}" y="48" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="600" fill="${pal.acc}" opacity="${i === 0 ? 1 : 0}">${t}${show(i, 5, DUR)}</text></g>`;
  });
  let stars = '';
  for (let i = 0; i < 50; i++) stars += `<circle cx="${f1(rnd() * W)}" cy="${f1(rnd() * H)}" r="${f2(.3 + rnd() * .7)}" fill="#b9cdb8" opacity=".2">${twinkle(.08, .4, 3 + rnd() * 4, rnd() * 6)}</circle>`;
  const svg = `${svgOpen(W, H, 'Five worlds', 'Particles continuously morph between five shapes: a spiral galaxy, a sphere, a wave, a bloom and an orbit ring.')}
<defs>${glow('g', pal.sec, .2)}<radialGradient id="v" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#030907" stop-opacity="0"/><stop offset="1" stop-color="#030907" stop-opacity=".7"/></radialGradient></defs>
<rect width="${W}" height="${H}" rx="22" fill="${pal.bg}"/>
<ellipse cx="${cx}" cy="${cy}" rx="360" ry="220" fill="url(#g)"/>
${stars}
<g>${dots}</g>
<rect width="${W}" height="${H}" rx="22" fill="url(#v)"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="21.5" fill="none" stroke="#ffffff" stroke-opacity=".08"/>
${pills}
${labels}
</svg>`;
  writeFileSync(join(out, 'worlds.svg'), svg);
}

// ===================== 3. atmospheres =====================
{
  const W = 900, H = 380, cx = 270, cy = 190, s = 74, DUR = 16;
  const keys = ['sage', 'ember', 'glacier', 'rose'];
  const ps = makeParticles(800, 33), rnd = mulberry32(8);
  const A = k => keys.map(x => k === 'bg' ? P[x].bg : k === 'acc' ? P[x].acc : k === 'p' ? hex(P[x].rgb) : hex(P[x].sec));
  let prim = '', sec = '', white = '';
  ps.forEach((p, i) => {
    const t = target(0, p, i), x = t[0] * s, y = t[2] * s, r = Math.max(.6, p.size * (p.j > .96 ? 1.6 : 1.05)), op = Math.min(.95, .4 + p.j * .55);
    const c = `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(r)}" opacity="${f2(op)}"/>`;
    if (p.j > .77) white += c; else if (p.j > .35) prim += c; else sec += c;
  });
  let swatches = '', names = '';
  keys.forEach((k, i) => {
    const x = 566 + i * 56;
    swatches += `<circle cx="${x}" cy="244" r="13" fill="${P[k].acc}" stroke="#111b17" stroke-width="3"/><circle cx="${x}" cy="244" r="17" fill="none" stroke="#f1f2e9" stroke-width="1.2" opacity="${i === 0 ? 1 : 0}">${show(i, 4, DUR)}</circle>`;
    names += `<text x="560" y="190" font-family="${FONT}" font-size="46" font-weight="300" letter-spacing="-2" fill="${P[k].acc}" opacity="${i === 0 ? 1 : 0}">${P[k].name}${show(i, 4, DUR)}</text>`;
  });
  const svg = `${svgOpen(W, H, 'Four atmospheres', 'The same galaxy cycling through four colour atmospheres: Sage, Ember, Glacier and Rose.')}
<defs><radialGradient id="g"><stop offset="0" stop-color="${hex(P.sage.sec)}" stop-opacity=".2">${cycle('stop-color', A('s'), DUR, .75)}</stop><stop offset=".5" stop-color="${hex(P.sage.sec)}" stop-opacity=".07">${cycle('stop-color', A('s'), DUR, .75)}</stop><stop offset="1" stop-color="${hex(P.sage.sec)}" stop-opacity="0">${cycle('stop-color', A('s'), DUR, .75)}</stop></radialGradient></defs>
<rect width="${W}" height="${H}" rx="22" fill="${P.sage.bg}">${cycle('fill', A('bg'), DUR, .75)}</rect>
<ellipse cx="${cx}" cy="${cy}" rx="330" ry="200" fill="url(#g)"/>
<g transform="translate(${cx} ${cy}) scale(1 .52)"><g>
<g fill="${hex(P.sage.sec)}">${cycle('fill', A('s'), DUR, .75)}${sec}</g>
<g fill="${hex(P.sage.rgb)}">${cycle('fill', A('p'), DUR, .75)}${prim}</g>
<g fill="#f5f4df">${white}</g>
<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="100s" repeatCount="indefinite"/></g></g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="21.5" fill="none" stroke="#ffffff" stroke-opacity=".08"/>
<text x="562" y="106" font-family="${FONT}" font-size="11" letter-spacing="3" font-weight="600" fill="#98a59d">ATMOSPHERE</text>
${names}
${swatches}
<text x="562" y="304" font-family="${FONT}" font-size="13" fill="#7f9484">A small change can create a whole new feeling.</text>
</svg>`;
  writeFileSync(join(out, 'atmospheres.svg'), svg);
}

// ===================== 4. ripple =====================
{
  const W = 900, H = 400, ox = 450, oy = 200, MAXR = 440, DUR = 4.5, SPEED_FRAC = .72;
  const pal = P.sage, rnd = mulberry32(77);
  let dots = '';
  for (let i = 0; i < 260; i++) {
    const x = 30 + rnd() * (W - 60), y = 24 + rnd() * (H - 48), size = .7 + rnd() * 1.6, j = rnd();
    const dx = x - ox, dy = y - oy, d = Math.hypot(dx, dy) || 1, th = (d / MAXR) * SPEED_FRAC;
    const col = j > .77 ? '#f5f4df' : j > .35 ? hex(pal.rgb) : hex(pal.sec), op = Math.min(.95, .4 + j * .55);
    let anim = '';
    if (th < .94) {
      const amp = 26 * Math.max(.25, 1 - th / SPEED_FRAC * .75);
      const px = f1(x + dx / d * amp), py = f1(y + dy / d * amp);
      const kt = []; const vx = [], vy = [];
      const add = (t, a, b) => { if (!kt.length || t > kt[kt.length - 1] + .001) { kt.push(t); vx.push(a); vy.push(b); } };
      add(0, f1(x), f1(y)); add(Math.max(.002, th - .05), f1(x), f1(y)); add(th, px, py); add(Math.min(.985, th + .09), f1(x), f1(y)); add(1, f1(x), f1(y));
      const ks = kt.slice(1).map(() => '.3 0 .3 1').join(';');
      anim = `<animate attributeName="cx" values="${vx.join(';')}" keyTimes="${kt.map(f2).join(';')}" calcMode="spline" keySplines="${ks}" dur="${DUR}s" repeatCount="indefinite"/><animate attributeName="cy" values="${vy.join(';')}" keyTimes="${kt.map(f2).join(';')}" calcMode="spline" keySplines="${ks}" dur="${DUR}s" repeatCount="indefinite"/>`;
    }
    dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(size)}" fill="${col}" opacity="${f2(op)}">${anim}</circle>`;
  }
  const ring = (w, delay, o) => `<circle cx="${ox}" cy="${oy}" r="0" fill="none" stroke="${pal.acc}" stroke-width="${w}" opacity="0"><animate attributeName="r" values="0;${MAXR};${MAXR}" keyTimes="0;${SPEED_FRAC};1" dur="${DUR}s" begin="${delay}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;${o};0;0" keyTimes="0;.03;${SPEED_FRAC};1" dur="${DUR}s" begin="${delay}s" repeatCount="indefinite"/></circle>`;
  const svg = `${svgOpen(W, H, 'Ripple', 'A click sends an expanding ripple through the particles, pushing each one outward as the wave passes.')}
<defs>${glow('g', pal.sec, .16)}<radialGradient id="v" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#030907" stop-opacity="0"/><stop offset="1" stop-color="#030907" stop-opacity=".7"/></radialGradient></defs>
<rect width="${W}" height="${H}" rx="22" fill="${pal.bg}"/>
<ellipse cx="${ox}" cy="${oy}" rx="380" ry="200" fill="url(#g)"/>
${ring(1.2, 0, .55)}${ring(.6, .12, .3)}
<g>${dots}</g>
<g transform="translate(${ox} ${oy})"><circle r="5" fill="${pal.acc}" opacity=".9"><animate attributeName="r" values="5;11;5" keyTimes="0;.06;.25" dur="${DUR}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".95;.25;.95" keyTimes="0;.06;.25" dur="${DUR}s" repeatCount="indefinite"/></circle></g>
<rect width="${W}" height="${H}" rx="22" fill="url(#v)"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="21.5" fill="none" stroke="#ffffff" stroke-opacity=".08"/>
<text x="36" y="48" font-family="${MONO}" font-size="12" letter-spacing="2.4" fill="#829285">CLICK  →  RIPPLE</text>
<text x="36" y="370" font-family="${FONT}" font-size="13" fill="#7f9484">Every particle is pushed outward as the wave passes through it.</text>
</svg>`;
  writeFileSync(join(out, 'ripple.svg'), svg);
}
console.log('done');
