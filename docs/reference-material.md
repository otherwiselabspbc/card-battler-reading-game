# Reference material: Activity Compilation

The **Activity Compilation** project is a separate repository of evidence-based dyslexia tutoring activities, digitized for ages 6–8. It *informs* this game but does not *dictate* it. Its documents live on the owner's computer (`Activity Compilation/`). The published activities are at https://github.com/otherwiselabspbc/activity-compilation.

| Document | What it holds | Use it for |
|---|---|---|
| `Target Units.docx` | Letter and grapheme units: name, sound, key words (a: ant, cat, sad; b: bat, big, bug…), digraph groups (ff/ll/ss, ee/oo/ie…) | Card content, cue-card words, which digraphs come first |
| `Activity Corpus` (.docx) | The tutoring activities themselves | Mini-games for training rooms (later phases) |
| `Pedagogical Knowledge.md` | How practice, feedback and mastery work (rules `L-`, `P-`, `F-`, `M-`, `R-`, `V-`, `A-`) | Feedback wording, mastery checks for deck building |
| `Respository - Vision.md` | Product and technical contract for activities (rules `FI-`, `AC-`, `NA-`, `SR-`, `TR-`, `TN-`, `MM-`, `VZ-`, `PL-`) | How speech and tracing should behave |
| `activities/see-trace-name-letters/` | Working trace + name activity, with `BUILD-NOTES.md` | Source of `shared/trace-engine.js` and `shared/speech-letters.js` |
| `audio recordings/` | Raw voice memos: letter names (Set A), short vowels (B), consonants (C), digraphs and long vowels (D), r-controlled (E), the remaining phonemes (F). `Audio Recording Key.docx` lists the order. | Future: split into per-sound clips for card sounds and models. Not split yet. |

## What carries over to the game

- **Fidelity (`FI-1`)**: the act the player performs is the reading act (trace, name, say the sound). Tapping is a fallback, never the main move.
- **Speech honesty (`SR-1`, `R-1`)**: "I didn't hear that" is not "you were wrong." Same-family letter names (b/d/e/p/t/v/z) can't be told apart by the recogniser, so treat them as uncertain. Offer one neutral retry ("I didn't quite catch that. Say it again?"), then the tap fallback.
- **Tracing (`TR-1`–`TR-5`)**: the engine scores start point, direction and stroke order, not just coverage, and rejects scribbling. Demos loosen the tolerances.
- **Feedback (`F-` rules, `TN-`)**: name what to do next, show the correct model, and have the player reproduce it. No buzzer.
- **One step per instruction (`A-8`, `L-2`)**: ages 6–8 get one action per prompt ("Trace the letter." then "Say its sound.").

## What does not carry over

- **"Minimally gamified"** (Vision principle 5). This project is a game on purpose: damage, health bars, opponents and bonus effects are the point.
- **The 2-minute activity contract (`AC-3`)** and session playlists. A battle is 5–8 turns and runs as long as it takes.
- **Result payloads, manifests and tutor drawer.** Not needed while the owner is the only player.
- **Recorded narration as a requirement.** Demos use `speechSynthesis` until the clips are split.

## Known tension to keep an eye on

A competitive opponent is a timing pressure. Vision `TN-7` says latency is never shown to the child. In the game, the opponent's turn should never be a race against the player's response time unless a spec decides otherwise.
