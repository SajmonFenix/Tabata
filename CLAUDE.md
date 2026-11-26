# Tabata (web / PWA)

Interval timer (Tabata, HIIT, EMOM) — web port of a colleague's Android app `sk.ddesign.tabata` v1.1
(Kotlin + Jetpack Compose). Goal: run on an iPhone **without an Apple developer account** (no 7-day
re-signing) → static PWA hosted on **GitHub Pages**, added to the home screen from Safari.

Owner's GitHub account: `SajmonFenix`. Language of the owner: Slovak (UI of the app is English, like the original).

## Status
- App is **finished and tested locally** (logic in Node, UI flow in headless Chrome at iPhone size).
- **Not yet pushed to GitHub / Pages not enabled** (the session that built it had no valid GitHub token).
- **Not yet tested on a real iPhone** — see "Open risks".

## Next steps (for Claude Code)
1. `git init`, commit, create a **public** repo (e.g. `tabata`) under SajmonFenix (`gh repo create SajmonFenix/tabata --public --source . --push`).
   Public is required: Pages on a free plan needs a public repo.
2. Enable Pages from branch `main`, folder `/` (`gh api -X POST repos/SajmonFenix/tabata/pages -f 'source[branch]=main' -f 'source[path]=/'`).
3. Open `https://sajmonfenix.github.io/tabata/` on the iPhone → Share → Add to Home Screen → open from the icon.
4. Verify on the iPhone (see risks), then fix whatever breaks.

## Architecture (no build step, plain ES modules)
- `index.html`, `css/style.css`, `fonts/Teko.ttf` (font taken from the APK, SIL OFL)
- `js/timeline.js` — pure logic: config → phases (GET READY, WORK, REST, SET REST) → audio cues (CD3/CD2/CD1, GO, REST, HALF, FINISH). No rest after the final WORK; between sets SET REST (falls back to REST if 0); zero-length phases dropped.
- `js/audio.js` — synthesizes 4 sound styles (CLASSIC, DIGITAL, RISING, BOXING GONG) and **renders the whole workout into one WAV track** (8 kHz mono 16-bit, ~16 kB/s, cue-by-cue into an Int16 array).
- `js/store.js` — localStorage (`tabata.v1`): workouts + settings; 4 themes with exact colours from the APK (work palette / rest palette).
- `js/app.js` — UI (home, editor + custom keypad, settings, timer, done), runner, Wake Lock, Media Session, vibration (Android only).
- `sw.js` — network-first cache for offline use. Bump `CACHE` when shipping changes if needed.

### Key design decision: audio track as the clock
iOS freezes JS and Web Audio when the screen locks, but keeps playing an `<audio>` element. So the app
pre-renders every beep into one WAV and plays it; the on-screen time is derived from `audio.currentTime`,
so display and sound never drift. Pause = `audio.pause()`, skip = seek to next phase start.
Limits: workouts > 3 h are refused (memory); 1 h ≈ 57 MB in memory.

## Open risks (verify on a real iPhone)
- Does the track keep playing with the **screen locked** in the standalone PWA (iOS version-dependent)? Silent switch / ringer mode may mute it.
- Starting a workout pauses music from other apps (web cannot mix audio).
- `navigator.vibrate` does not exist on iOS Safari → vibration setting only works on Android.
- Wake Lock needs iOS 16.4+ (keeps the screen on while the timer runs).

## Reverse-engineering notes (from the APK)
- Screens: MY WORKOUTS, NEW WORKOUT / EDIT, START FROM TEMPLATE (TABATA, HIIT, EMOM), SETTINGS (theme, sound, halfway, vibrate, templates).
- Config per workout: prep, work, rest, rounds, sets, setRest. Notification actions in the original: Pause/Resume, Skip, Stop.
- Original sound synthesis was **not copied exactly** — tones here are own approximations with the same style names.
- Default template values and default new-workout values are own choices (TABATA 20/10 ×8, HIIT 40/20 ×10, EMOM 60/0 ×10; new workout 10 prep, 20/10 ×8).

## Tests
`/tests` is not part of the repo. Logic tests cover phase building, cues, normalization and WAV rendering; UI flow was driven with Playwright (create workout via keypad, save, start, pause, skip, finish).
