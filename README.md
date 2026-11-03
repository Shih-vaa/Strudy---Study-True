# Strudy (True Study)

A focused desktop player for lecture videos stored on your computer. Strudy tracks **real** study time: a second only counts while you are actually watching, and anything that looks like not studying (paused, window unfocused, minimized, computer asleep) stops the clock.

> **Status: work in progress.** Milestones 1–4 of 10 are done: the player, hold-to-boost and the study timer. The focus lock, password exit, kiosk mode, presence checks, reports and installers are still to come. See the [roadmap](#roadmap).

## Why it exists

Strudy is for studying seriously from downloaded lectures, such as recorded classes. The goal is **honest, visible tracking plus friction against distraction**, not spyware. Everyone using it knows it is there and can see exactly what it records.

**What Strudy will never do:**

- no webcam, screen capture, keylogging or any other hidden monitoring
- no accounts, telemetry or network calls: everything stays on this computer

## What works today

### Player

- Open a single video or a whole folder. Folders become a playlist, sorted naturally (`Lecture 2` before `Lecture 10`). Supported: `.mp4` `.mkv` `.webm` `.mov` `.m4v`.
- Play/pause, seek bar, ±10 s skip, replay, previous/next, and auto-advance to the next video.
- Speed from 0.5x to 2x in 0.25 steps, **hard-capped at 2x**.
- **Hold to boost:** press and hold the mouse on the video for more than 250 ms to play at 2x, with a "2x" badge. Release and you are back at exactly the speed you selected. A short click toggles play/pause instead.
- **Resume:** the position of every video is remembered. Reopen a folder and each partly watched video shows "Resume 12:34".

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Back / forward 10 s |
| `↑` / `↓` | Speed up / down one step |
| `R` | Replay from the start |

### Study timer

The clock in the top bar shows **Session** and **Today** as `HH:MM:SS`. Its dot is green only while time is being counted.

It counts **wall-clock** seconds, so playback speed never changes it (1 real second is 1 study second at 0.5x, 1x, 2x and while boosting). A second counts only when **all** of these hold:

1. A video is loaded and actually playing (not paused, not ended, buffered enough to play)
2. The app window is focused
3. The window is visible (not minimized)
4. No presence check is pending *(placeholder until the presence check is built)*
5. The computer is not asleep and the screen is not locked

Gaps longer than 2.5 s between ticks (sleep, throttling) are discarded rather than credited. Pauses and focus changes are accounted for at the moment they happen, not rounded to the next second.

### Sessions

A session starts when the first video plays after launch. The running session is saved every 10 seconds and when you leave the player, so a hard power-off still keeps everything up to the last save. A session that never ended cleanly keeps `endedAt: null`, which makes an abrupt stop visible. **Today** adds up every session that started today.

## Getting started

**Requirements:** Node.js 22 or newer and npm. macOS is the primary platform. Windows 10/11 is intended to work but has not been tested yet.

```bash
git clone https://github.com/Shih-vaa/Strudy---Study-True.git
cd Strudy---Study-True
npm install
npm run dev
```

The first run downloads the Electron binary, so it needs internet once. If that step fails, run `npx install-electron --no` and try again.

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the app with the Vite dev server (hot reload for the UI; restart after changing main or preload code) |
| `npm start` | Build everything and run the production build |
| `npm run build` | Build main, preload and renderer into `dist/` |
| `npm test` | Run the unit tests (Vitest) |
| `npm run typecheck` | Type-check main, renderer and tests |

## Privacy and data

- **Local only.** There are no network calls. The renderer runs under a strict Content Security Policy (`connect-src 'none'`), and the main process cancels any request that is not local.
- **What is stored:** resume positions and session records (start time, study time, the list of videos watched). Nothing else.
- **Where:** `strudy.json` in the app data folder: `~/Library/Application Support/Strudy` on macOS, `%APPDATA%\Strudy` on Windows. Delete the file to erase everything.
- **Local files:** videos are served through a private `strudy-media://` protocol, and only files you picked in the open dialog this launch. `webSecurity` stays on.

## Known limitations

- Strudy is a **deterrent and a logger**, not security. Even once the lock is built, anyone can still shut the lid or power off. The log is what makes that visible.
- Opening a folder does not look inside subfolders.
- Playback uses Chromium's codecs. Some files (for example certain HEVC or MKV variants) may not play and will show an error instead.
- Chromium pauses video that has no audio track when the window is hidden. Normal lectures have audio, so this mostly shows up with silent test clips.
- The clock has whole-second resolution. A session counts toward the day it started, even if it runs past midnight.

## Roadmap

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Electron + Vite + React + TypeScript scaffold | Done |
| 2 | Player: open file/folder, custom protocol, seek, speed, resume | Done |
| 3 | Hold-to-boost (250 ms threshold) | Done |
| 4 | Study timer, unit tests, on-screen clock | Done |
| 5 | Focus handling: pause on blur, overlay, log | Planned |
| 6 | Exit password, hashed storage, close interception | Planned |
| 7 | Kiosk mode and shortcut blocking (macOS first, then Windows) | Planned |
| 8 | "Still studying?" presence checks | Planned |
| 9 | Session summary, 7-day chart, CSV export | Planned |
| 10 | Packaging (dmg and Windows installer) and platform notes | Planned |

**Platform honesty, for the lock to come:** on Windows, Ctrl+Alt+Del and the Windows key cannot be fully blocked without low-level keyboard hooks, which Strudy deliberately does not use. If something cannot be reliably blocked on an OS, this README will say so plainly rather than pretend.

## Project layout

```
src/
  main/       Electron main process: window, IPC, media protocol, storage, power events
  preload/    The small typed API exposed to the UI (contextBridge)
  shared/     Types and helpers used by both sides
  renderer/   React UI
    screens/    Library, Player
    components/ Video player, controls, study clock
    player/     Playback hooks, speed, hold-to-boost gesture
    timer/      Study timer (pure logic), clock helpers, session persistence
    state/      Zustand store
scripts/      Dev runner
CLAUDE.md     The project spec and working rules
```

The window is created with `contextIsolation` on, `nodeIntegration` off and the renderer sandboxed. The renderer can only talk to the main process through the typed `window.api`, and main validates what it receives.

## Contributing

The full spec, milestone order and working rules live in [CLAUDE.md](CLAUDE.md). The study-timer rules are implemented as pure, unit-tested logic in `src/renderer/timer/studyTimer.ts`, so changes there should come with tests.

## License

No license has been chosen yet. All rights reserved by the author.
