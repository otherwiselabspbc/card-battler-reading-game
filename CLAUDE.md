# CLAUDE.md — Card Battler Reading Game demos

This repo holds playable browser demos of **Legendary Card Competition**, a card battler (Slay the Spire / Yu-Gi-Oh! style) that teaches foundational reading. Demos are built phase by phase. Each phase builds on the last, so reuse what earlier demos made instead of starting over.

## Who the demos are for

Right now the only player is the project owner, who is playtesting the *feel* of each loop. So:
- Spend effort on turn flow, feedback timing, and whether the reading act feels like the game action.
- Simple shapes, CSS and emoji are fine for art. No asset pipeline, no build step.
- Don't build telemetry, results payloads, accounts, or tutor dashboards unless a spec asks for them.

## Read before building anything

1. `docs/concept.md` — the game concept (converted from `Concept Document.docx`). It's the source for what each phase is.
2. `docs/reference-material.md` — what the Activity Compilation project offers, which of its rules apply to the game, and which don't.
3. The phase's spec in `docs/specs/` — the decisions for this demo. **If there is no spec for the phase, write one from `docs/specs/TEMPLATE.md` and get it approved before writing code.**
4. `demos/` — earlier demos, to reuse their code.

## How to build a demo

- **One self-contained HTML file per demo** at `demos/<phase-slug>/index.html`. It loads only the files in `shared/` by relative path (`../../shared/...`), and runs from GitHub Pages or a local static server. (`file://` blocks the mic and `fetch`, so test over http.)
- **Plain JavaScript, no framework, no bundler.** Inline CSS and JS in the demo file. Code that a second demo will need moves into `shared/`.
- **Target browser: desktop Chrome**, mouse or finger. Speech uses the browser's built-in Web Speech API (decided 2026-11-21). Spoken prompts use `speechSynthesis` until recorded clips are split and added.
- **Every speech step needs a tap fallback** that appears when the recogniser fails, is refused, or isn't available. The demo must be playable end to end with the mic off (`?speech=off`).
- **Tracing is loose for demos**: use `TraceEngine.create(strokes, { looseness: 1.5 })` and accept `complete`. Treat any other result as "try again", with the engine's hint where there is one.
- Add a `?seed=` param for repeatable shuffles and a `?debug=1` panel that shows state, the recogniser's alternatives, and a "skip this step" button, so the owner can test a turn quickly.
- Update `demos/index.html` (the landing page) with a link and a one-line description.

## Shared modules (`shared/`)

Test a demo headlessly with Playwright: serve the repo root over http, set `window.__fast = true` in an init script (speeds up waits and skips speech synthesis), load with `?speech=off&debug=1&seed=N`, trace with real mouse moves along `TE.letters[ch].strokes[i].pts` mapped through the SVG's `getScreenCTM()`, and tap through the fallbacks. `window.__game` and `window.__tracing` expose state for this.

| File | What it is |
|---|---|
| `strokes-lowercase.json`, `strokes-uppercase.json` | Stroke definitions for a–z / A–Z (provisional ball-and-stick print). From Activity Compilation. |
| `trace-engine.js` | `TraceEngine.create(strokes, {looseness})` → `letters`, `tolFor(pointerType)`, `analyzeStroke(...)`. Scores the motion, not just the ink. |
| `speech-letters.js` | `SpeechLetters.create(letters)` → `scoreTranscript(alts, target, {units})` for letter **names**. Same-family names (b/d/e…) come back `uncertain`, never `incorrect`. |
| `speech-sounds.js` | `SpeechSounds.create(speechLetters)` → `scoreSound(alts, target, {strict})` for sounds, and `scoreName` that also handles digraph names ("es aitch"). Loose by default: the name passes for the sound. New game work, tuned only by guesswork so far. |

Both modules were lifted unchanged from `activities/see-trace-name-letters` in Activity Compilation, apart from their wrappers. Fix bugs here, and note the fix in the file header so it can go back upstream. **Sound recognition is the weakest part**: browser speech recognition is built for words, so an isolated /m/ often comes back as "M" or nothing. `speech-sounds.js` holds guessed spellings. Tighten them from real captures logged by `?debug=1`.

## Working rules

- Keep the reading act the game action. Tracing selects a card, naming places it, saying the sound fires it. Don't swap in a tap or a multiple-choice question as the main act; taps are only fallbacks.
- Feedback is warm and specific. No buzzers and no "wrong!". A miss gets the correct model ("This one is m. Say /m/.") and a retry.
- If the concept doc is silent, decide, then write the decision in the spec's "Decisions" section so the next phase inherits it.
- If the concept doc and the Activity Compilation rules conflict, the concept doc wins for the game. Note the conflict in the spec.
- After a playtest, record what the owner changed in the spec's "Playtest notes", and move lasting lessons into this file.

## Publishing

`main` is published with GitHub Pages (Settings → Pages → branch `main`, root). A demo's URL is `https://otherwiselabspbc.github.io/card-battler-reading-game/demos/<phase-slug>/`. The repo is public, so keep private notes and student data out of it.
