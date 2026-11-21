/* Trace engine, lifted from Activity Compilation / see-trace-name-letters v1.0.0
   (sections 2 and 6 of that file, unchanged except for the wrapper and the `looseness` option).
   Usage:
     const T = TraceEngine.create(strokeJson, { looseness: 1.5 });
     const letter = T.letters.b;            // strokes with .pts, .start, .len, .d (SVG path)
     const tol = T.tolFor('mouse');         // 'pen' | 'touch' | 'mouse'
     const r = T.analyzeStroke(userPts, letter, strokeIdx, tol, null, new Set());
     // r.kind: complete | partial | off-path | wrong-start | wrong-direction | wrong-order | scribble | missing-lift | ignore
   Points are in the stroke frame: width 100, x-height y=50, baseline y=150 (see the JSON). */
(function (global) {
'use strict';
function create(STROKE_DATA, opts) {
const LOOSE = (opts && opts.looseness) || 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const XH = STROKE_DATA.frame.x_height;
const SAMPLE = 2;
function parseDSL(d) {
  const t = d.trim().split(/\s+/); let i = 0; const pts = [];
  const push = (x, y) => { const l = pts[pts.length - 1]; if (!l || Math.hypot(l[0] - x, l[1] - y) > 0.01) pts.push([x, y]); };
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M' || c === 'L') { push(+t[i++], +t[i++]); }
    else if (c === 'A' || c === 'E') {
      const cx = +t[i++], cy = +t[i++], rx = +t[i++], ry = (c === 'E') ? +t[i++] : rx, a0 = +t[i++], a1 = +t[i++];
      const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 6));
      for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180; push(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); }
    }
  }
  return pts;
}
function pathLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }
function resample(pts, step) {
  const out = [[pts[0][0], pts[0][1]]]; let need = step;
  for (let i = 1; i < pts.length; i++) {
    let x0 = pts[i - 1][0], y0 = pts[i - 1][1]; const x1 = pts[i][0], y1 = pts[i][1];
    let seg = Math.hypot(x1 - x0, y1 - y0);
    while (seg >= need && seg > 0) { const u = need / seg; x0 += (x1 - x0) * u; y0 += (y1 - y0) * u; out.push([x0, y0]); seg -= need; need = step; }
    need -= seg;
  }
  const last = pts[pts.length - 1], o = out[out.length - 1];
  if (Math.hypot(o[0] - last[0], o[1] - last[1]) > 1e-6) out.push([last[0], last[1]]);
  return out;
}
function pointAtFraction(pts, f) {
  const total = pathLength(pts); let target = total * f;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (target <= seg || i === pts.length - 1) {
      const u = seg ? clamp(target / seg, 0, 1) : 0;
      const p = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
      const angle = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) * 180 / Math.PI;
      return { p, angle };
    }
    target -= seg;
  }
  return { p: pts[pts.length - 1], angle: 0 };
}
function nearestIndex(pt, C) { let bi = 0, bd = Infinity; for (let j = 0; j < C.length; j++) { const d = dist(pt, C[j]); if (d < bd) { bd = d; bi = j; } } return { idx: bi, d: bd }; }
function polyToPath(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '); }
/* Unit ids are lower-case letters everywhere in data; the glyph shown is the run-case form. */
function buildLetters(data, kase) {
  const out = {};
  for (const [rawCh, def] of Object.entries((data && data.letters) || {})) {
    const ch = rawCh.toLowerCase();
    if (!def || !Array.isArray(def.strokes) || !def.strokes.length) continue;
    const strokes = def.strokes.map((s, idx) => {
      const raw = parseDSL(s.d); const len = pathLength(raw); const isDot = len < 15;
      const pts = isDot ? raw : resample(raw, SAMPLE);
      const arrows = isDot ? [] : (len > 120 ? [0.3, 0.72] : [0.5]).map(f => pointAtFraction(raw, f));
      return { idx, name: s.name, hint: s.hint || 'dot', raw, pts, len, isDot, start: raw[0], end: raw[raw.length - 1], arrows, d: isDot ? null : polyToPath(raw) };
    });
    const conf = def.confusions || {};
    out[ch] = { ch, glyph: kase === 'upper' ? ch.toUpperCase() : ch, kase, strokes, totalLen: strokes.reduce((a, s) => a + s.len, 0), formation: def.formation || '', cv: (conf.visual || []).map(x => x.toLowerCase()), cn: (conf.name || []).map(x => x.toLowerCase()) };
  }
  return out;
}
const TOL = {                       // fractions of x-height; TR-3 defaults, finger loosened per TR-13
  pen:   { mean: 0.15, max: 0.30, start: 0.20 },
  touch: { mean: 0.18, max: 0.40, start: 0.22 },
  mouse: { mean: 0.18, max: 0.40, start: 0.22 }
};
function tolFor(pointerType) { const t = TOL[pointerType] || TOL.touch; const k = LOOSE; return { mean: t.mean * XH * k, max: t.max * XH * k, start: t.start * XH * k, band: t.max * XH * k, profile: TOL[pointerType] ? pointerType : 'touch' }; }
function tangents(C) {
  const N = C.length; const t = new Array(N);
  for (let j = 0; j < N; j++) { const a = C[Math.max(0, j - 1)], b = C[Math.min(N - 1, j + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; t[j] = [dx / L, dy / L]; }
  return t;
}
/* Forward-window matcher. Each user point is matched to a canonical point within a window ahead of
   the current progress; a small penalty prefers the nearest index ahead, and a direction term
   penalises canonical points whose tangent opposes the finger's motion. The direction term is what
   resolves retraces (m, u): the up-going half of an overlapping line wins whenever the finger is
   moving up, wherever it turned around. */
function matchForward(user, C, band, startIdx = 0) {
  const N = C.length; let p = startIdx, cur = startIdx, anchor = startIdx;
  let devSum = 0, flips = 0, dir = 0, tailStart = -1; const devs = [];
  const AHEAD = Math.max(12, Math.round(N * 0.25)), BACK = Math.max(10, Math.round(N * 0.4));
  const FWD = 0.10 * SAMPLE, BWD = 0.16 * SAMPLE, H = 10;   // H: a reversal counts only past 20 units (TR-2), not finger tremor
  const T = tangents(C), LAMBDA = 8, MIN_MOVE = 1.5;
  for (let i = 0; i < user.length; i++) {
    const u = user[i]; let best = -1, bestScore = Infinity, bestDist = Infinity;
    let vx = 0, vy = 0, moving = false;
    if (i >= 1) { const prev = user[Math.max(0, i - 2)]; vx = u[0] - prev[0]; vy = u[1] - prev[1]; const vm = Math.hypot(vx, vy); if (vm >= MIN_MOVE) { vx /= vm; vy /= vm; moving = true; } }
    const lo = Math.max(0, cur - BACK), hi = Math.min(N - 1, p + AHEAD);
    for (let j = lo; j <= hi; j++) {
      const d = dist(u, C[j]); let s = d + (j >= cur ? (j - cur) * FWD : (cur - j) * BWD);
      if (moving) s += LAMBDA * (1 - (vx * T[j][0] + vy * T[j][1]));
      if (s < bestScore) { bestScore = s; best = j; bestDist = d; }
    }
    devs.push(bestDist); devSum += bestDist;
    if (bestDist <= band) {
      const delta = best - anchor;
      if (Math.abs(delta) >= H) { const nd = Math.sign(delta); if (dir !== 0 && nd !== dir) flips++; dir = nd; anchor = best; }
      cur = best; if (best > p) p = best;
      if (tailStart < 0 && p >= N - 3) tailStart = i;
    }
  }
  const sorted = devs.slice().sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
  return { coverage: (p + 1) / N, meanDev: user.length ? devSum / user.length : 0, maxDev: sorted.length ? sorted[sorted.length - 1] : 0, p95, flips, tailStart, progress: p };
}

/* Returns {kind, ...}. kinds: complete | partial | ignore | wrong-start | wrong-direction |
   wrong-order | scribble | missing-lift | off-path.  `open` = {progress, uLen} for a stroke
   the child lifted from part-way and may be continuing; `doneSet` = completed stroke indices. */
function smoothPath(pts) {       // 3-point mean: finger tremor must not inflate path length into a false "scribble"
  if (pts.length < 5) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) out.push([(pts[i - 1][0] + pts[i][0] + pts[i + 1][0]) / 3, (pts[i - 1][1] + pts[i][1] + pts[i + 1][1]) / 3]);
  out.push(pts[pts.length - 1]); return out;
}
function analyzeStroke(userRaw, letter, expectedIdx, tol, open, doneSet) {
  const S = letter.strokes[expectedIdx]; const C = S.pts; const N = C.length;
  const user = smoothPath(userRaw);
  const uLen = pathLength(user); const startPt = user[0];
  if (S.isDot) {
    const d = dist(startPt, S.start);
    if (d <= tol.start + 6 && uLen < 45) return { kind: 'complete', metrics: { startDev: d, uLen, canonLen: S.len } };
    if (uLen < 8) return { kind: 'ignore', metrics: { startDev: d, uLen } };
    return { kind: 'wrong-start', hint: 'dot', metrics: { startDev: d, uLen, canonLen: S.len } };
  }
  if (uLen < 8) return { kind: 'ignore', metrics: { uLen } };
  const startDev = dist(startPt, S.start);
  /* A stroke the child lifted from part-way can be continued: from where it stopped, or from a later
     point on the path when the skipped stretch is a retrace of ink already laid down (the lifted m:
     hump one down to the baseline, lift, hump two from the top). Lifts are recorded, not penalised. */
  let startIdx = 0, continuing = false, retraceSkip = false;
  if (open) {
    if (dist(startPt, C[open.progress]) <= tol.start) { continuing = true; startIdx = open.progress; }
    else {
      let k = -1, kd = Infinity;
      for (let j = open.progress + 1; j < N; j++) { const d = dist(startPt, C[j]); if (d <= tol.start && d < kd) { kd = d; k = j; } }
      if (k > 0) {
        const laid = open.pts || [];
        let ok = true;
        for (let j = open.progress + 1; j < k; j += 2) { if (!laid.some(q => dist(C[j], q) <= tol.band)) { ok = false; break; } }
        if (ok) { continuing = true; startIdx = k; retraceSkip = true; }
      }
    }
  }
  const fwd = matchForward(user, C, tol.band, startIdx);
  const totalLen = uLen + (continuing ? open.uLen : 0);
  const base = { startDev, uLen, totalLen, canonLen: S.len, ratio: totalLen / S.len, coverage: fwd.coverage, meanDev: fwd.meanDev, maxDev: fwd.maxDev, p95: fwd.p95, flips: fwd.flips, continuing, lifts: open ? open.lifts : 0, retraceSkip };
  const startOK = continuing || startDev <= tol.start;
  const within = fwd.meanDev <= tol.mean && fwd.p95 <= tol.max;
  const rev = C.slice().reverse();

  if (startOK && fwd.coverage >= 0.8 && within && fwd.flips <= 2) {
    const next = letter.strokes[expectedIdx + 1];
    if (next && !next.isDot && fwd.tailStart >= 0) {
      const tail = user.slice(fwd.tailStart); const tailLen = pathLength(tail);
      if (tailLen > Math.max(25, 0.3 * next.len)) {
        const t = matchForward(tail, next.pts, tol.band, 0);
        if (t.coverage >= 0.5) return { kind: 'missing-lift', metrics: { ...base, tailLen, nextCoverage: t.coverage } };
      }
    }
    if (totalLen > 2.0 * S.len) return { kind: 'scribble', metrics: base };
    return { kind: 'complete', metrics: base, progress: fwd.progress };
  }
  if ((totalLen > 2.0 * S.len && fwd.meanDev <= tol.max) || fwd.flips > 2) return { kind: 'scribble', metrics: base };

  const r0 = matchForward(user, rev, tol.band, 0);       // traced backward? (closed circles share start/end)
  if (fwd.coverage < 0.5 && r0.coverage >= 0.6) return { kind: 'wrong-direction', metrics: { ...base, revCoverage: r0.coverage } };

  if (!startOK) {
    for (let k = 0; k < letter.strokes.length; k++) {   // started on another stroke → wrong order
      if (k === expectedIdx || doneSet.has(k)) continue;
      const O = letter.strokes[k];
      if (dist(startPt, O.start) > tol.start) continue;
      if (O.isDot) { if (uLen < 45) return { kind: 'wrong-order', other: k, metrics: base }; continue; }
      const m = matchForward(user, O.pts, tol.band, 0);
      if (m.coverage >= 0.6) return { kind: 'wrong-order', other: k, metrics: { ...base, otherCoverage: m.coverage } };
    }
    return { kind: 'wrong-start', hint: S.hint, metrics: base };
  }
  if (fwd.coverage >= 0.3 && within) return { kind: 'partial', metrics: base, progress: fwd.progress };
  if (fwd.p95 > tol.max || fwd.meanDev > tol.mean) return { kind: 'off-path', metrics: base };
  if (uLen < 20) return { kind: 'ignore', metrics: base };
  return { kind: 'partial', metrics: base, progress: fwd.progress };
}

const letters = buildLetters(STROKE_DATA, 'lower');
return { letters, buildLetters, parseDSL, pathLength, resample, polyToPath, tolFor, analyzeStroke, frame: STROKE_DATA.frame };
}
global.TraceEngine = { create };
})(typeof window !== 'undefined' ? window : globalThis);
