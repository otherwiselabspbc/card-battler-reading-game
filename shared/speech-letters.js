/* Letter-name speech scoring, lifted from Activity Compilation / see-trace-name-letters v1.0.0
   (section 7: lexicon, name families, normaliseTranscript, scoreTranscript), unchanged except for the wrapper.
   It scores Web Speech API alternatives against a target letter NAME. Phoneme (sound) scoring is new
   game work and lives elsewhere; SOUND_TOKENS here only detect a sound given where a name was asked.
   Usage:
     const S = SpeechLetters.create(TraceEngine.create(strokes).letters);
     S.scoreTranscript([{transcript:'bee', confidence:0.9}], 'b', { units:['b','m','s'] })
     // -> { score: 'correct' | 'incorrect' | 'uncertain' | 'ignored', reason, heard, ... } */
(function (global) {
'use strict';
function create(LOWER) {
const LETTERS = { lower: LOWER };
const LET = (ch) => LOWER[ch];
function confusionType(target, chosen) { const L = LET(target); if (L.cv.includes(chosen)) return 'visual'; if (L.cn.includes(chosen)) return 'name'; return 'other'; }
const LEXICON = {
  a: ['a', 'ay', 'ey', 'hey', 'eigh'],
  b: ['b', 'bee', 'be', 'bea', 'bees'],
  c: ['c', 'see', 'sea', 'cee', 'si'],
  d: ['d', 'dee', 'de', 'dea'],
  e: ['e', 'ee', 'eee', 'he', 'ea'],
  f: ['f', 'ef', 'eff'],
  g: ['g', 'gee', 'jee', 'ji', 'ge'],
  h: ['h', 'aitch', 'aich', 'age', 'ache', 'hatch', 'each', 'haitch', 'eight', '8'],
  i: ['i', 'eye', 'aye', 'ai', 'hi'],
  j: ['j', 'jay', 'jae', 'ja'],
  k: ['k', 'kay', 'kae', 'ka', 'cay', 'okay', 'ok'],
  l: ['l', 'el', 'ell', 'elle', 'al'],
  m: ['m', 'em', 'emm', 'im'],
  n: ['n', 'en', 'enn', 'in', 'an', 'ann', 'end'],
  o: ['o', 'owe', 'ow'],
  p: ['p', 'pee', 'pea', 'pe'],
  q: ['q', 'cue', 'queue', 'kew', 'que', 'kyu'],
  r: ['r', 'are', 'ar', 'our', 'arr', 'hour'],
  s: ['s', 'es', 'ess', 'ass'],
  t: ['t', 'tee', 'tea', 'te', 'ti'],
  u: ['u', 'you', 'yu', 'yoo', 'ewe'],
  v: ['v', 'vee', 've', 'vi', 'we', 'wee'],
  w: ['w', 'doubleu', 'doubleyou', 'doubleyoo', 'dubya'],
  x: ['x', 'ex', 'ecks', 'eks', 'eggs'],
  y: ['y', 'why', 'wye', 'wi', 'wai'],
  z: ['z', 'zee', 'zed', 'zi', 'ze']
};
const SOUND_TOKENS = {     // sound-of:<letter>; a sound given for a name is a real, corrected error (§8 N2s)
  b: ['buh', 'bah', 'ba', 'bu'], d: ['duh', 'da', 'du'], p: ['puh', 'pah', 'pa'], t: ['tuh', 'ta'], k: ['kuh', 'cuh'], g: ['guh', 'ga'],
  n: ['nnn'], s: ['ss', 'sss', 'hiss'], f: ['ff', 'fff'], v: ['vvv'], z: ['zzz'], l: ['lll', 'luh'], r: ['rrr', 'ruh'], h: ['huh', 'hah'], j: ['juh'], w: ['wuh'], y: ['yuh']
};
const WEAK_TOKENS = { a: 'a', the: 'd', um: 'm', hmm: 'm', mm: 'm', mmm: 'm', oh: 'o', eh: 'a' };   // count only as the sole token
const FILLERS = new Set(['its', 'thats', 'this', 'that', 'one', 'is', 'letter', 'uh', 'er', 'and', 'my', 'it']);
const PHRASES = { 'double u': 'doubleu', 'double you': 'doubleyou', 'double yoo': 'doubleyoo' };
const NAME_FAMILIES = { ee: 'bcdegptvz', ay: 'ajkh', eh: 'flmnsx', eye: 'iy', yoo: 'uqw', oh: 'o', ar: 'r' };
const FAMILY_OF = {}; for (const [fam, s] of Object.entries(NAME_FAMILIES)) for (const ch of s) FAMILY_OF[ch] = fam;
const TOKEN_TO_LETTER = {}, TOKEN_TO_SOUND = {};
(function assertLexicon() {                                  // build-time assertion: a token belongs to exactly one letter
  const seen = new Map(); const dup = [];
  for (const [ch, toks] of Object.entries(LEXICON)) for (const t of new Set(toks)) { if (seen.has(t) && seen.get(t) !== 'name:' + ch) dup.push(t + ' (' + seen.get(t) + ' vs name:' + ch + ')'); seen.set(t, 'name:' + ch); TOKEN_TO_LETTER[t] = ch; }
  for (const [ch, toks] of Object.entries(SOUND_TOKENS)) for (const t of new Set(toks)) { if (seen.has(t) && seen.get(t) !== 'sound:' + ch) dup.push(t + ' (' + seen.get(t) + ' vs sound:' + ch + ')'); seen.set(t, 'sound:' + ch); TOKEN_TO_SOUND[t] = ch; }
  for (const t of Object.keys(WEAK_TOKENS)) if (TOKEN_TO_SOUND[t]) dup.push(t + ' (weak vs sound)');
  if (dup.length) throw new Error('Lexicon duplicate tokens: ' + dup.join(', '));
})();

/* §6.3: lower-case → delete apostrophes → hyphens to spaces → strip other punctuation → collapse spaces
   → multi-word lookup → tokens; leading fillers/weak dropped; run of letter/sound tokens up to the first
   unknown token; trailing tokens logged, not scored. */
function normaliseTranscript(text) {
  let s = String(text == null ? '' : text).toLowerCase().replace(/['’]/g, '').replace(/-/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [ph, tok] of Object.entries(PHRASES)) s = s.split(ph).join(tok);
  const raw = s ? s.split(' ') : [];
  const toks = raw.map(t => {
    if (FILLERS.has(t)) return { t, cls: 'filler' };
    if (WEAK_TOKENS[t] != null) return { t, cls: 'weak', letter: WEAK_TOKENS[t] };
    if (TOKEN_TO_LETTER[t]) return { t, cls: 'name', letter: TOKEN_TO_LETTER[t] };
    if (TOKEN_TO_SOUND[t]) return { t, cls: 'sound', letter: TOKEN_TO_SOUND[t] };
    return { t, cls: 'unknown' };
  });
  const out = { text: s, tokens: toks, kind: 'none', letter: null, sound: null, trailing_tokens: [] };
  if (!toks.length) return out;
  if (toks.length === 1 && toks[0].cls === 'weak') { out.kind = 'letter'; out.letter = toks[0].letter; out.weak = true; return out; }
  if (toks.every(x => x.cls === 'filler' || x.cls === 'weak')) { out.kind = 'ignored'; return out; }
  const run = []; let i = 0;
  while (i < toks.length && (toks[i].cls === 'filler' || toks[i].cls === 'weak')) i++;   // leading-run rule
  for (; i < toks.length; i++) {
    const x = toks[i];
    if (x.cls === 'filler' || x.cls === 'weak') continue;
    if (x.cls === 'unknown') break;
    run.push(x);
  }
  out.trailing_tokens = toks.slice(i).map(x => x.t).slice(0, 8);
  const names = run.filter(x => x.cls === 'name'), sounds = run.filter(x => x.cls === 'sound');
  if (names.length) { const u = [...new Set(names.map(x => x.letter))]; if (u.length === 1) { out.kind = 'letter'; out.letter = u[0]; } else out.kind = 'multi'; }
  else if (sounds.length) { const u = [...new Set(sounds.map(x => x.letter))]; if (u.length === 1) { out.kind = 'sound'; out.sound = u[0]; } else out.kind = 'multi'; }
  return out;
}

/* §6.4: score one capture (a list of {transcript, confidence} alternatives) against the target.
   ctx = { units, kase, prev: {reason, L} of the previous capture on this item }. */
function scoreTranscript(alternatives, target, ctx = {}) {
  const t = target; const units = ctx.units || []; const kase = ctx.kase;
  const mapped = (alternatives || []).map(a => { const n = normaliseTranscript(a.transcript); return { n, confidence: typeof a.confidence === 'number' ? Math.round(a.confidence * 1000) / 1000 : null, transcript: String(a.transcript == null ? '' : a.transcript) }; });
  /* A sole weak token ("um", "oh", "the", "a") is a hesitation as often as a name: it counts as a letter only for the target or its own family; otherwise it is no letter (R-1: when in doubt, uncertain). */
  const alts = mapped.filter(m => m.n.kind === 'letter' || m.n.kind === 'sound').filter(m => !(m.n.weak && m.n.letter !== t && FAMILY_OF[m.n.letter] !== FAMILY_OF[t])).map(m => ({ letter: m.n.kind === 'letter' ? m.n.letter : 'sound-of:' + m.n.sound, confidence: m.confidence }));
  const c = alts.length ? alts[0].confidence : (mapped.length ? mapped[0].confidence : null);
  const known = typeof c === 'number' && c > 0;
  const res = { score: 'uncertain', reason: null, heard: null, heard_sound: null, rank: null, confidence: c, confidence_known: known, alts, alts_count: alts.length, confusion: null, agreement: 1, trailing_tokens: [] };
  const trailing = mapped.flatMap(m => m.n.trailing_tokens); if (trailing.length) res.trailing_tokens = trailing.slice(0, 8);
  const rawText = mapped.map(m => m.n.text).filter(Boolean).join(' | ').slice(0, 40);
  if (mapped.length && mapped.every(m => m.n.kind === 'ignored')) { res.score = 'ignored'; res.reason = 'fillers-only'; return res; }
  if (!alts.length) { res.score = 'uncertain'; res.reason = 'no-letter'; res.transcript = rawText; return res; }   // rule 1: nonsense, noise, words, multi — never accepted
  const L = alts[0].letter; res.top = L;
  const rankT = alts.findIndex(a => a.letter === t); res.rank = rankT >= 0 ? rankT + 1 : null;
  const T = LET(t, kase); const inSet = (x) => units.includes(x) || T.cv.includes(x) || T.cn.includes(x);
  const prev = ctx.prev || null;
  const lowConfidence = (heard, form) => {
    if (prev && prev.reason === 'low-confidence' && prev.L === L) {           // rule 8, second capture agrees → incorrect
      res.score = 'incorrect'; res.agreement = 2;
      if (form === 'sound') { res.reason = 'sound-for-name'; res.confusion = 'sound-for-name'; res.heard = t; res.heard_sound = t; }
      else { res.reason = 'agreed'; res.heard = heard; res.confusion = confusionType(t, heard, kase); }
      return res;
    }
    res.score = 'uncertain'; res.reason = 'low-confidence'; if (form === 'sound') res.heard_sound = t; else res.heard = heard; res.L = L; return res;
  };
  if (L === t) { res.score = 'correct'; res.reason = 'match'; res.heard = t; res.rank = 1; return res; }   // rule 2
  if (L === 'sound-of:' + t) {                                                                              // rule 3
    if (!known) return lowConfidence(null, 'sound');
    res.score = 'incorrect'; res.reason = 'sound-for-name'; res.confusion = 'sound-for-name'; res.heard = t; res.heard_sound = t; return res;
  }
  if (L.startsWith('sound-of:')) { res.score = 'uncertain'; res.reason = 'no-letter'; res.heard_sound = L.slice(9); return res; }   // rule 9
  if (LETTERS.lower[L]) {
    if (FAMILY_OF[L] === FAMILY_OF[t]) { res.score = 'uncertain'; res.reason = 'ambiguous-name'; res.heard = L; return res; }      // rule 4
    if (res.rank != null && res.rank >= 2) { res.score = 'uncertain'; res.reason = 'low-rank'; res.heard = L; return res; }       // rule 5
    if (!inSet(L)) { res.score = 'uncertain'; res.reason = 'out-of-set'; res.heard = L; return res; }                             // rule 6
    if (known && c >= 0.5) { res.score = 'incorrect'; res.reason = 'cross-family'; res.heard = L; res.confusion = confusionType(t, L, kase); return res; }   // rule 7
    return lowConfidence(L, 'name');                                                                                              // rule 8
  }
  res.score = 'uncertain'; res.reason = 'unscored'; res.transcript = rawText; return res;                                          // rule 10
}
return { LEXICON, SOUND_TOKENS, NAME_FAMILIES, FAMILY_OF, normaliseTranscript, scoreTranscript };
}
global.SpeechLetters = { create };
})(typeof window !== 'undefined' ? window : globalThis);
