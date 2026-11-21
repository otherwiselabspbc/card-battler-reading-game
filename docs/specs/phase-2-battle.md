# Phase 2 demo spec — Solo battle with Basic Cards

_Status: built (v1), awaiting playtest_ · _Demo: `demos/phase-2-battle/`_

## Goal of this demo
Let the owner play one full battle against a computer opponent and judge whether tracing, naming and sounding out a letter *feel like* casting a card. It also tests whether cue cards and defend-and-steal add good tension.

## In scope / out of scope
- **In:** one battle (coin flip to win or lose), hand of 5, discard and draw, cue cards, the three-act attack (trace → name → sound), defend and steal, two bonus effects, health bars, energy-burst animation, win/lose screen with "play again."
- **Out:** library lesson, sensei, training rooms, deck building and mastery gates, card collection, upper case, multiple opponents, saving progress. The deck is fixed.

## Content
Ten Basic Cards, drawn from `Target Units` Group 1 and the digraph groups. Letters follow the common s-a-t-p-i-n start, plus m and c so the cue words work. Each card appears twice, so the deck has 20 cards.

| Card | Name said | Sound said | Type | Damage | Bonus effect |
|---|---|---|---|---|---|
| m | "em" | /m/ (mmm) | consonant | 3 | — |
| s | "es" | /s/ (sss) | consonant | 3 | — |
| t | "tee" | /t/ | consonant | 3 | — |
| p | "pee" | /p/ | consonant | 3 | **Pause:** opponent skips their next turn |
| n | "en" | /n/ (nnn) | consonant | 3 | — |
| c | "see" | /k/ | consonant | 3 | — |
| a | "ay" | short /a/ (apple) | vowel | 4 | — |
| i | "eye" | short /i/ (itch) | vowel | 4 | — |
| sh | "es aitch" | /sh/ (shh) | consonant digraph | 5 | **Shush:** opponent discards a random card |
| ee | "ee ee" | long /ee/ (see) | vowel digraph | 5 | — |

**Cue cards** show a picture and a word with one gap. Playing the card that fills the gap adds **+3 damage**. Each player gets 5, drawn from this pool:

| Cue | Picture | Fits |
|---|---|---|
| _ a t | 🐱 cat | c |
| m _ p | 🗺️ map | a |
| p _ n | 📌 pin | i |
| _ i p | 🚢 ship | sh |
| b _ _ | 🐝 bee | ee |
| _ n t | 🐜 ant | a |
| _ a n | 🍳 pan | p |
| s _ t | 🪑 sit | i |
| _ u n | ☀️ sun | s |
| pa _ | 🍳 pan | n |

## Turn flow
**Turn 0.** Both players draw 5 cards and get 5 cue cards. Each player's first cue is face up. A coin flip picks who starts.

**Player's turn: choose one.**
1. **Attack.** Tap a card in your hand to pick it up.
   1. *Trace* the letter on a big tracing pad to **select** it.
   2. *Say its name* to **place** it on the table.
   3. *Say its sound* to **blow energy** through it. The card fires a burst at the opponent equal to its damage (+3 if it fits your cue). Then the bonus effect fires, the used cue flips to the next one, and you draw back up to 5.
2. **Discard.** Pick up to 5 cards, discard them, and draw the same number.

**Opponent's turn.** The opponent picks a card: one that fits its cue if it has one, otherwise its highest damage. It traces the card (animated), places it face up, and *pauses before naming it*. From turn 2 on, the player gets a choice:
- **Defend!** Say the card's sound. If you get it right, the attack is blocked and **you steal the card** into your hand. Defending *uses your next turn*, so the opponent goes again.
- **Let it through.** The opponent names the card, says its sound, and attacks. Then it's your turn as normal.

The opponent says the name and the sound aloud every time it plays. That gives the player a correct model to hear between their own turns.

## Reading acts
| Act | What the player does | How it's checked | Miss | Fallback |
|---|---|---|---|---|
| Trace | Trace the letter with mouse or finger. For digraphs, trace both letters. | `TraceEngine` with `looseness: 1.5`, stroke by stroke. Accepts only `complete`. | The letter's formation is animated ("Watch: down, then around"), then retry. After 2 misses: "Let's do it together", a guided trace along the dots that is always accepted. | — |
| Name | Say the letter name ("em"). Digraph: both names ("es aitch"). | `SpeechLetters.scoreTranscript`. Same-family names are *uncertain*, not wrong. | Wrong: "This one is m. Say m." and say it again. Uncertain: "I didn't quite catch that. Say it again?" once. | 3 name buttons. Each plays its name; tap the right one. |
| Sound | Say the sound (/m/). | New `shared/speech-sounds.js` lexicon. **v1 accepts anything that maps to the target letter, as a name or a sound**, because the recogniser can't reliably tell /m/ from "em" (see Decisions). | Same pattern: model the sound, then retry. | 3 sound buttons. Each plays its sound; tap the right one. |

## Rules and numbers
- Health: **20 each**. Win when the opponent hits 0.
- Damage: consonant 3, vowel 4, digraph 5, +3 when it fits your cue. A typical attack is 3–8, so a battle runs about **5–8 player turns**, matching the concept doc.
- Hand 5. When the deck runs out, the discard pile is shuffled back in.
- The opponent never fumbles a card in v1, and it never defends against the player's attacks (see Decisions).
- There is no timer anywhere. The opponent waits for the player to choose Defend or Let it through.

## Feedback
- **Success:** a short chime, the card glows, and the act's word appears ("Selected!" / "Placed!"). The sound step fires the energy burst and the opponent's health bar drops with a damage number.
- **Miss:** no buzzer. Calm voice: "This one is m. Say /m/." Then a retry.
- **Didn't catch that:** "I didn't quite catch that. Say it again?" said once, then the tap buttons.
- **Cue match:** the cue card flashes, and "+3!" is added to the burst.

## Decisions (owner, please check these)
1. **Defending costs your next turn.** The concept doc says "The opponent will then take the next turn." I read that as: a successful defend uses up your turn. A failed defend lets the attack land, but you keep your turn, to keep it gentle.
2. **The sound step is honest about what it checks.** Browser speech recognition usually writes /m/ as "M", the same as the name. In v1, saying the name in the sound step also passes. The demo will log what the recogniser heard (in `?debug=1`) so we can see how far we can tighten it with your own voice.
3. **Spoken models use the browser's voice** (`speechSynthesis`), which is poor at isolated sounds like /t/. Splitting your recorded clips (Sets A–D) into per-sound files would fix that. It can come in v1.1 if the robot voice gets in the way.
4. **The opponent doesn't defend or fumble in v1.** That way all the reading acts are the player's, and the opponent is just a steady clock. Turning these on later is easy.
5. **Activity Compilation conflict:** its "minimally gamified" principle doesn't apply here (see `docs/reference-material.md`). No-timer and no-buzzer rules are kept.

## Test checklist
- [ ] Full match with mic on, won and lost.
- [ ] Full match with `?speech=off` (taps only).
- [ ] Every card traces and names correctly, including both digraphs.
- [ ] Defend succeeds and steals the card; defend fails and the attack lands.
- [ ] Pause skips the opponent's turn. Shush removes an opponent card.
- [ ] Cue bonus applies, and the cue advances.
- [ ] Deck reshuffles when it runs out.

## Playtest notes
_(after the owner plays it)_
