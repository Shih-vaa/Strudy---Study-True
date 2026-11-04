# Strudy (True Study)

A focused desktop player for lecture videos stored on your computer. Strudy tracks **real** study time: a second only counts while you are actually watching, and anything that looks like not studying (paused, window unfocused, minimized, computer asleep) stops the clock.

> **Status: work in progress.** The player, hold-to-boost, the study timer, focus handling, the exit password, a Settings screen and "Still studying?" checks are done. Kiosk mode was skipped by choice. Reports and installers are still to come. See the [roadmap](#roadmap).

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
4. No "Still studying?" check is waiting for a click
5. The computer is not asleep and the screen is not locked

Gaps longer than 2.5 s between ticks (sleep, throttling) are discarded rather than credited. Pauses and focus changes are accounted for at the moment they happen, not rounded to the next second.

### Focus handling

When you leave Strudy while a lecture is open (switching apps, clicking another window, minimizing):

1. The video **pauses** and the study clock stops.
2. A `focus_lost` event is **logged** with its time, and when you come back it is completed with how long you were away (for example `away 42s`).
3. Strudy tries to **take focus back** about a quarter of a second later.
4. A **"Come back to study"** screen covers the window, with how long you were away. Nothing plays or responds behind it until you press **Resume studying** (click, `Enter` or `Space`). The video resumes only if it was playing when you left; a video you had paused yourself stays paused.

Leaving again before you dismiss the screen counts as a new loss. Leaving Strudy while on the library (no lecture open) is not counted. The window does not fight Strudy's own file-open dialog.

### "Still studying?" checks

Every so often, while you are studying, a box asks **"Still studying? Click to continue."**

- The gap is a random number of minutes of *studying* (8 to 15 by default, changeable in Settings). Time spent paused or away does not count towards it, so a check never appears over a paused video.
- While the box is up the video keeps playing, but the **study clock stops** until you click.
- If nobody clicks within **30 seconds**, the video **pauses**, a `presence_missed` event is logged, and the miss is counted. Clicking afterwards resumes the video if it was playing.
- If you leave Strudy while a check is up, the check is dropped (leaving is already logged as a focus loss).

### Exit password

On first run Strudy asks you to create an **exit password** (at least 6 characters, entered twice). After that the app cannot be closed without it:

- The window's close button, `Cmd+W`, `Cmd+Q` and `Alt+F4` are all blocked. Instead of closing, they open an **Exit** dialog (the **Exit** button in the top bar opens the same one).
- The password is checked in the **main process only**, against a salted **scrypt** hash. The password itself is never stored.
- A wrong password does nothing except get **logged** as an `auth_failed` event on the running session.
- The right password **ends and saves the session first** (it gets an `endedAt` time), saves the resume position, then quits.
- Shutting down, restarting or logging out is never blocked.
- Until a password exists there is nothing to ask for, so a half-set-up app can always be closed.

There is no way to change or recover the password in this version.

### Settings

The **Settings** button on the library opens a screen that asks for the exit password first, because settings can switch the locks off. It stays unlocked for five minutes, or until you leave the screen. The check is made in the main process, so the screen cannot be talked into changing anything while locked.

- **Bring Strudy back to the front when I leave it** (on by default). Turn it off and leaving still pauses the video, stops the clock and is logged; Strudy just does not pull itself back.
- **"Still studying?" checks.** The shortest and longest gap, in whole minutes of studying (1 to 180). They are saved together, and the shortest cannot be longer than the longest.
- **Change the exit password.** It asks for the current password again, and the new one needs at least 6 characters, entered twice.

Wrong passwords typed here are logged like wrong ones at the exit dialog.

### Sessions

A session starts when the first video plays after launch. The running session is saved every 10 seconds, when you leave the player, and straight away when something is logged, so a hard power-off still keeps everything up to the last save. A session that never ended cleanly keeps `endedAt: null`, which makes an abrupt stop visible. **Today** adds up every session that started today.

## Getting started

**Requirements:** Node.js 22 or newer and npm. macOS is the only platform being built and tested for now. Windows is not a priority at the moment and has not been tested.

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

While developing you will not want the locks in your way. These switches work only when running from source and are **ignored in packaged builds**:

```bash
STRUDY_FOCUS_LOCK=0 npm run dev   # stop Strudy pulling itself back to the front (pausing, logging and the overlay still work)
STRUDY_EXIT_LOCK=0 npm run dev    # let the window close without the password
STRUDY_PRESENCE_FAST=1 npm run dev # "Still studying?" every 4 to 6 seconds of studying, 4 seconds to answer
```

`Ctrl+C` in the terminal always stops `npm run dev` (it force-quits Strudy if the window has not closed after two seconds).

## Privacy and data

- **Local only.** There are no network calls. The renderer runs under a strict Content Security Policy (`connect-src 'none'`), and the main process cancels any request that is not local.
- **What is stored:** resume positions, session records (start and end time, study time, the videos watched, focus losses and wrong-password attempts) and a scrypt hash of the exit password. Nothing else.
- **Where:** `strudy.json` in the app data folder: `~/Library/Application Support/Strudy` on macOS, `%APPDATA%\Strudy` on Windows. Delete the file to erase everything.
- **Local files:** videos are served through a private `strudy-media://` protocol, and only files you picked in the open dialog this launch. `webSecurity` stays on.

## Known limitations

- Strudy is a **deterrent and a logger**, not security. Anyone can still shut the lid, power off, Force Quit it (`Cmd+Option+Esc` on macOS, Task Manager on Windows), or delete `strudy.json`. The log is what makes that visible: a session that never ended has no `endedAt`.
- A plain `kill` (SIGTERM) does not close a locked Strudy either, because Electron answers it by closing the window and the lock refuses. Use Force Quit or `kill -9`.
- **Forgot the password?** Settings cannot help, since it needs the password too. Quit Strudy by Force Quit, then delete the `auth` entry in `strudy.json` (or the whole file, which also deletes your history). The next launch asks for a new password.
- Taking focus back is best effort. There is no kiosk mode (skipped by choice), so `Cmd+Tab` still switches away and Strudy pulls itself back a moment later. Reload and DevTools shortcuts are not blocked yet either. On Windows the OS may refuse to give focus to a background app and flash its taskbar button instead; that cannot be fixed without native hooks.
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
| 5 | Focus handling: pause on blur, overlay, log | Done |
| 6 | Exit password, hashed storage, close interception | Done |
| 7 | Kiosk mode and shortcut blocking | Kiosk skipped by choice; blocking reload/DevTools still open |
| 8 | "Still studying?" presence checks | Done |
| 9 | Session summary, 7-day chart, CSV export | Planned |
| 10 | Packaging (dmg and Windows installer) and platform notes | Planned |

**Platform honesty, for the lock to come:** on Windows, Ctrl+Alt+Del and the Windows key cannot be fully blocked without low-level keyboard hooks, which Strudy deliberately does not use. If something cannot be reliably blocked on an OS, this README will say so plainly rather than pretend.

## Project layout

```
src/
  main/       Electron main process: window, IPC, media protocol, storage, exit password, power and focus events
  preload/    The small typed API exposed to the UI (contextBridge)
  shared/     Types and helpers used by both sides
  renderer/   React UI
    screens/    Library, Player
    components/ Video player, controls, study clock, focus overlay
    player/     Playback hooks, speed, hold-to-boost gesture
    focus/      Focus-loss logging logic and the pause/overlay hook
    presence/   "Still studying?" logic (pure) and the hook that runs it
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
