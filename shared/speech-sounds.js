/* Sound (phoneme) and digraph-name scoring for the Web Speech API. New game work, not lifted.
   Browser recognisers are built for words, so an isolated /m/ usually comes back as "M", "mm",
   "um" or nothing. Phase 2 spec, decision 2: v1 is LOOSE. A sound step passes on anything that maps
   to the target, whether it is a sound spelling or the letter name. `strict: true` turns off name
   acceptance, for later tightening against the owner's real captures (see ?debug=1 logs).
   Usage:
     const SS = SpeechSounds.create(SpeechLetters.create(letters));
     SS.scoreSound(alts, 'm')            // -> { score: 'correct'|'uncertain'|'incorrect', heard, via }
     SS.scoreName(alts, 'sh')            // digraph-aware name scoring; single letters defer to SpeechLetters */
(function (global) {
'use strict';

/* How recognisers tend to spell each sound. Lower-case, punctuation removed, spaces kept. */
const SOUND_SPELLINGS = {
  m:  ['m', 'mm', 'mmm', 'mmmm', 'hmm', 'hm', 'um', 'em', 'mhm', 'ma', 'muh', 'me'],
  s:  ['s', 'ss', 'sss', 'ssss', 'hiss', 'es', 'ess', 'yes', 'see', 'sa', 'sir'],
  t:  ['t', 'tuh', 'ta', 'tea', 'tee', 'to', 'too', 'two', 'ti', 'it'],
  p:  ['p', 'puh', 'pa', 'pah', 'pee', 'pea', 'pe', 'pop', 'up'],
  n:  ['n', 'nn', 'nnn', 'en', 'in', 'an', 'and', 'no', 'na', 'nuh', 'um', 'hmm'],
  c:  ['k', 'c', 'kuh', 'cuh', 'ca', 'ka', 'kay', 'okay', 'ok', 'cut', 'see', 'key', 'que', 'cue', 'q'],
  a:  ['a', 'ah', 'aa', 'aah', 'ahh', 'at', 'add', 'ad', 'and', 'an', 'apple', 'ha', 'hey', 'eh', 'ay', 'uh', 'ash'],
  i:  ['i', 'ih', 'it', 'in', 'is', 'if', 'eh', 'e', 'eye', 'hi', 'ick', 'itch', 'ee'],
  sh: ['sh', 'shh', 'shhh', 'shhhh', 'ssh', 'shush', 'shu', 'shoe', 'she', 'shop', 'ship', 'ch', 'sure', 'shut'],
  ee: ['e', 'ee', 'eee', 'eeee', 'he', 'me', 'we', 'see', 'tea', 'tree', 'bee', 'b', 'yee', 'eat', 'easy']
};
/* Accepted renderings of digraph NAMES ("es aitch", "ee ee"). */
const DIGRAPH_NAMES = {
  sh: ['s h', 'sh', 'es h', 'ess h', 'es aitch', 'ess aitch', 'as h', 's age', 's each', 's8', 's 8', 'sha', 'esh', 'ash', 'ssh', 'shh', 's and h', 'is h', 'yes h'],
  ee: ['e e', 'ee', 'e', 'eee', 'double e', 'ee ee', 'he he', 'e and e', 'ea', 'eat', 'easy', 'ee e']
};

function norm(t) {
  return String(t == null ? '' : t).toLowerCase().replace(/['’]/g, '').replace(/-/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
const FILLER = /^(its|it is|thats|that is|the|a|um|uh|er|i say|say|letter|sound)\s+/;

function create(SL) {
  /* Map one transcript to the set of targets it could be a SOUND of. */
  function soundsOf(text) {
    let s = norm(text); let prev;
    do { prev = s; s = s.replace(FILLER, ''); } while (s !== prev && s.includes(' '));
    const out = new Set(); if (!s) return out;
    const toks = s.split(' ');
    for (const [k, list] of Object.entries(SOUND_SPELLINGS)) {
      if (list.includes(s) || list.includes(toks[0]) || (toks.length > 1 && toks.every(t => list.includes(t)))) out.add(k);
    }
    if (/^m{2,}$/.test(s)) out.add('m'); if (/^s{2,}$/.test(s)) out.add('s'); if (/^n{2,}$/.test(s)) out.add('n');
    if (/^sh+$/.test(s)) out.add('sh'); if (/^e{2,}$/.test(s)) out.add('ee');
    return out;
  }

  function scoreSound(alternatives, target, opts = {}) {
    const alts = (alternatives || []).map(a => ({ transcript: String(a.transcript || ''), confidence: a.confidence }));
    const res = { score: 'uncertain', reason: 'no-match', heard: null, via: null, alts };
    if (!alts.length || alts.every(a => !norm(a.transcript))) { res.reason = 'silence'; return res; }
    for (let r = 0; r < alts.length; r++) {
      const set = soundsOf(alts[r].transcript);
      if (set.has(target)) { res.score = 'correct'; res.reason = 'sound'; res.heard = target; res.via = 'sound-spelling'; res.rank = r + 1; return res; }
    }
    if (!opts.strict) {                                   // loose v1: the letter's name also passes
      const n = scoreName(alternatives, target);
      if (n.score === 'correct') { res.score = 'correct'; res.reason = 'name-accepted'; res.heard = target; res.via = 'name'; return res; }
    }
    /* A clear, confident sound of a different card is a real miss; anything murkier is "didn't catch that". */
    const top = soundsOf(alts[0].transcript);
    if (top.size === 1) {
      const other = [...top][0];
      if (other !== target && (alts[0].confidence == null || alts[0].confidence >= 0.5)) { res.score = 'incorrect'; res.reason = 'other-sound'; res.heard = other; return res; }
    }
    return res;
  }

  function scoreName(alternatives, target, ctx = {}) {
    const alts = (alternatives || []);
    if (DIGRAPH_NAMES[target]) {
      for (let r = 0; r < alts.length; r++) {
        const s = norm(alts[r].transcript).replace(FILLER, '');
        if (DIGRAPH_NAMES[target].includes(s)) return { score: 'correct', reason: 'match', heard: target, rank: r + 1 };
      }
      if (!alts.length || alts.every(a => !norm(a.transcript))) return { score: 'uncertain', reason: 'silence', heard: null };
      return { score: 'uncertain', reason: 'no-match', heard: null };
    }
    const r = SL.scoreTranscript(alts, target, { units: ctx.units || [] });
    if (r.score === 'ignored') return { ...r, score: 'uncertain' };
    return r;
  }

  return { scoreSound, scoreName, soundsOf, SOUND_SPELLINGS, DIGRAPH_NAMES };
}
global.SpeechSounds = { create };
})(typeof window !== 'undefined' ? window : globalThis);
