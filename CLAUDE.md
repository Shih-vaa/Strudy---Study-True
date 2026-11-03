# Strudy (True Study): Focused Lecture Player

## 1. What this is

**App name:** Strudy (short for "True Study"). Use "Strudy" for the window title, productName, appId (`com.strudy.app`), installer names, and the README.

A desktop video player for locally stored lecture files (e.g. downloaded PW lectures). It tracks real study time and discourages distraction: the app can be locked in kiosk mode, and anything that looks like not-studying (video paused, window unfocused, no human presence) stops the timer and is logged.

**Context:** The owner (Apoorv, on a Mac) wants his younger sister to study seriously from downloaded lectures. She knows the app exists. The goal is honest, visible tracking plus friction against distraction, not spyware. Do not add webcam, screen capture, keylogging, or any hidden monitoring.

## 2. Platforms

- Primary: macOS (Apple Silicon and Intel). Develop and test here first.
- Also: Windows 10/11. Must build and run, with documented weaker lock behavior.
- Mac-specific code must be isolated behind `process.platform` checks.

## 3. Tech stack

- Electron (latest stable), TypeScript
- React + Vite (renderer)
- Zustand for renderer state
- `electron-builder` for packaging (dmg for Mac, nsis for Windows)
- Storage: a local JSON file via `electron-store` (simple), with sessions stored as an array. SQLite is not needed.
- Password hashing: Node `crypto.scrypt` with a random salt (no native modules).
- Security: `contextIsolation: true`, `nodeIntegration: false`, a preload script exposing a minimal typed API via `contextBridge`.

## 4. Features (v1)

### 4.1 Player

- Open a single file or a folder (playlist of .mp4/.mkv/.webm/.mov/.m4v, sorted naturally by filename).
- Play, pause, seek bar, skip back/forward 10s, replay (restart current video), previous/next in playlist.
- Speed selector: 0.5x to 2x in 0.25 steps. Hard cap at 2x.
- Hold-to-boost: pressing and holding the mouse on the video area for more than 250 ms sets playbackRate to 2x. Releasing restores the previously selected speed. A short click (under 250 ms) toggles play/pause instead. Show a small "2x" badge while boosting.
- Remember the last position per file and resume on reopen.
- Keyboard: Space = play/pause, Left/Right = -/+10s, Up/Down = speed step, `R` = replay.

### 4.2 Study timer (core feature)

Counts wall-clock seconds, not video time. Speed changes must never affect it.

A second counts as study time only when ALL of these are true:

1. A video is loaded and actually playing (`!video.paused && !video.ended && video.readyState >= 3`)
2. The app window is focused
3. The window is visible (not minimized)
4. The presence check is not pending/failed (see 4.3)
5. The system is not suspended/locked (Electron `powerMonitor`)

Implementation rules:

- Tick every 1000 ms using `performance.now()` deltas, not a counter incremented per interval (intervals drift and throttle).
- On each tick: `delta = now - lastTick`. If `delta > 2500 ms` (sleep, throttling), discard that delta. Otherwise, if all conditions hold, add `delta` to `studyMs`.
- Keep the timer in a single module (`src/renderer/timer/studyTimer.ts`) with pure logic that takes injected `now()` and condition flags, so it can be unit-tested.
- Show the current session's study time in a small clock in the corner (HH:MM:SS), plus today's total.

### 4.3 Presence check ("still watching?")

- At random intervals (every 8 to 15 minutes), show a modal: "Still studying? Click to continue." The video keeps playing, but the timer pauses until she clicks.
- If not dismissed within 30 seconds, also pause the video and log a `presence_missed` event.
- Interval range is configurable in settings.

### 4.4 Focus lock

- Focus loss (`blur` on BrowserWindow): pause video, stop timer, log `focus_lost` with timestamp, show an overlay "Come back to study" when focus returns, and try `win.focus()` / `win.moveTop()` shortly after.
- Kiosk mode (toggle in settings, default ON during a session):
  - macOS: `kiosk: true` / fullscreen with presentation options so Cmd+Tab, Dock, and menu bar are hidden. Verify it.
  - Windows: `kiosk: true`, `alwaysOnTop: true` ('screen-saver' level). Be honest in the README that Ctrl+Alt+Del and the Win key can't be fully blocked without native hooks. Don't attempt low-level keyboard hooks in v1.
- Block in-app shortcuts: reload, devtools (production build only), Cmd/Ctrl+W, Cmd/Ctrl+Q, Alt+F4, F11, Escape-exit-fullscreen. Use `before-input-event` on webContents.
- Intercept the window `close` event: prevent it unless the exit password was verified.
- Password exit: an "Exit" button opens a password dialog. The renderer sends the password to main over IPC (`auth:verify`); main verifies against the stored scrypt hash and, on success, sets `allowQuit = true`, ends the session, and quits. Never verify in the renderer. Log failed attempts.
- First run: setup screen to create the exit password (min 6 chars) and confirm it.

### 4.4b What the lock does NOT do

It is a deterrent and logger. Anyone can still shut the laptop or hard power off. The log makes that visible.

### 4.5 Sessions and reports

- A session starts when the first video plays in a launch and ends on exit.
- Store per session: id, startedAt, endedAt, studyMs, videosWatched[], focusLostCount, presenceMissedCount, pauseCount, events[] (type, timestamp, detail).
- Summary screen after exit/on demand: today's study minutes, per-session list, focus-loss count, and a 7-day bar chart of study minutes.
- Export sessions as CSV.
- Everything stays local. No network calls, no accounts, no telemetry.

## 5. Architecture

```
strudy/
  CLAUDE.md
  package.json
  electron-builder.yml
  src/
    main/
      index.ts            # app lifecycle, create window, allowQuit flag
      window.ts           # BrowserWindow creation, kiosk/focus handlers, platform branches
      ipc.ts              # ipcMain handlers (typed channel names)
      auth.ts             # scrypt hash/verify, first-run setup
      store.ts            # electron-store wrapper: settings, sessions, positions
      shortcuts.ts        # before-input-event blocking
    preload/
      index.ts            # contextBridge: exposes window.api
    shared/
      types.ts            # Session, StudyEvent, Settings, IPC channel types
    renderer/
      main.tsx
      App.tsx
      screens/
        SetupPassword.tsx
        Library.tsx       # open file/folder, playlist, resume
        Player.tsx
        Summary.tsx
        Settings.tsx
      components/
        VideoPlayer.tsx   # <video>, controls, hold-to-boost
        Controls.tsx
        StudyClock.tsx
        PresenceModal.tsx
        FocusOverlay.tsx
        PasswordDialog.tsx
      timer/
        studyTimer.ts     # pure logic
        studyTimer.test.ts
      state/
        useSessionStore.ts
```

### IPC contract (main <-> renderer)

- `auth:isSetup` -> boolean
- `auth:setup(password)` -> void
- `auth:verifyAndQuit(password)` -> boolean
- `files:openDialog(kind: 'file'|'folder')` -> string[]
- `store:getSettings` / `store:setSettings`
- `sessions:save(session)` / `sessions:list`
- `positions:get(path)` / `positions:set(path, seconds)`
- main -> renderer events: `window:blur`, `window:focus`, `power:suspend`, `power:resume`

### Loading local video safely

Register a custom protocol (e.g. `strudy-media://`) in main that streams the file with range-request support so seeking works. Do not disable `webSecurity` to load `file://`.

## 6. Build order (do one milestone at a time, run the app after each)

1. Scaffold Electron + Vite + React + TS; window opens with a hello screen.
2. Player: file/folder open, custom protocol, play/pause/seek/replay/speed, resume position.
3. Hold-to-boost with the 250 ms threshold.
4. Study timer module + unit tests + on-screen clock.
5. Focus handling: blur/focus events, overlay, pause and log.
6. Password setup, hashed storage, password-gated exit, close interception.
7. Kiosk mode and shortcut blocking (Mac first, then Windows branches).
8. Presence checks.
9. Sessions storage, Summary screen, CSV export.
10. Packaging for Mac and Windows, README with caveats.

## 7. Acceptance checklist

- Timer does NOT advance when: paused, window unfocused, minimized, presence modal pending, or after the machine slept.
- Timer advances at 1 real second per second at 0.5x, 1x, and 2x playback, and during hold-boost.
- Releasing the mouse after a hold restores the exact previous speed. A quick click toggles play/pause only.
- Cmd+Tab (Mac) doesn't switch away in kiosk mode. If the window does lose focus by any means, the video pauses, the event is logged, and the app tries to regain focus.
- Wrong password never quits. Right password saves the session first, then quits.
- Quitting the app via Cmd+Q, Alt+F4, or the window close button is blocked without the password.
- Closing and reopening restores the last position of each video.
- No outbound network requests anywhere.
- Unit tests pass for `studyTimer`.

## 8. Rules for the AI working on this repo

- Ask before adding dependencies beyond the stack in section 3.
- Keep platform-specific code in clearly marked branches. Don't break Windows while working on Mac.
- Don't add any hidden monitoring (screenshots, webcam, keylogging, network reporting).
- Prefer small, typed, testable modules. Keep the timer logic pure.
- After each milestone, tell me exactly how to run and manually verify it.
- If something can't be reliably blocked on an OS, say so plainly and log it in the README instead of faking it.
