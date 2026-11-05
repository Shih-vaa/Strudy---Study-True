# Strudy (True Study)

A focused desktop player for lecture videos stored on your computer. Strudy tracks **real** study time: a second only counts while you are actually watching, and anything that looks like not studying (paused, window unfocused, minimized, computer asleep) stops the clock.

> **Status:** everything in the plan is built for macOS: the player, hold-to-boost, the study timer, focus handling, the exit password, a Settings screen, "Still studying?" checks, a Summary screen with CSV export, reload/DevTools blocking, and a Mac installer. Kiosk mode was skipped by choice, and Windows is not being built or tested for now. See the [roadmap](#roadmap).

## Why it exists

Strudy is for studying seriously from downloaded lectures, such as recorded classes. The goal is **honest, visible tracking plus friction against distraction**, not spyware. Everyone using it knows it is there and can see exactly what it records.

**What Strudy will never do:**

- no screen capture, keylogging or any other hidden monitoring
- no recording of the camera, and no use of it at all unless the owner switches the visible [camera check](#camera-check-optional) on
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
6. If the [camera check](#camera-check-optional) is switched on, someone is in front of the camera

Gaps longer than 2.5 s between ticks (sleep, throttling) are discarded rather than credited. Pauses and focus changes are accounted for at the moment they happen, not rounded to the next second.

### Focus handling

When you leave Strudy while a lecture is open (switching apps, clicking another window, minimizing):

1. The video **pauses** and the study clock stops.
2. A `focus_lost` event is **logged** with its time, and when you come back it is completed with how long you were away (for example `away 42s`).
3. Strudy tries to **take focus back** about a quarter of a second later.
4. A **"Come back to study"** screen covers the window, with how long you were away. Nothing plays or responds behind it until you press **Resume studying** (click, `Enter` or `Space`). The video resumes only if it was playing when you left; a video you had paused yourself stays paused.

Leaving again before you dismiss the screen counts as a new loss. Leaving Strudy while on the library (no lecture open) is not counted. The window does not fight Strudy's own file-open dialog.

### Reload and DevTools are blocked

Reload would wipe the "Come back to study" screen, and DevTools would let someone poke at the running app, so in the installed app:

- The menu has no **View** menu: no Reload, Force Reload or Toggle Developer Tools. It keeps **Edit** (copy, paste and select-all, needed in the password fields), **Window**, and **Exit Strudy**.
- The shortcuts do nothing: `Cmd+R`, `Cmd+Shift+R`, `F5`, `Cmd+Option+I`/`J`/`C`, `F12` and their Windows/Linux equivalents. They are caught on the physical key, so a Mac's Option layer cannot slip past.
- DevTools are switched off completely, so there is no route to them by shortcut, menu or code.

Running from source keeps all of these for development; `STRUDY_DEV_TOOLS=0 npm run dev` makes a source run behave like the installed app.

### "Still studying?" checks

Every so often, while you are studying, a box asks **"Still studying? Click to continue."**

- The gap is a random number of minutes of *studying* (8 to 15 by default, changeable in Settings). Time spent paused or away does not count towards it, so a check never appears over a paused video.
- While the box is up the video keeps playing, but the **study clock stops** until you click.
- If nobody clicks within **30 seconds**, the video **pauses**, a `presence_missed` event is logged, and the miss is counted. Clicking afterwards resumes the video if it was playing.
- If you leave Strudy while a check is up, the check is dropped (leaving is already logged as a focus loss).

### Camera check (optional)

> **Status:** built and unit-tested, and checked in a real window with a synthetic test-pattern camera (notice, preview, "no one there" bar, paused video, stopped clock, log entries, camera released on leaving, microphone and location refused). It has been tried with a real face on a MacBook's built-in camera (it counts while you face it, goes "away" after the grace period, and resumes by itself when you are back; with the optional eyes-and-head check on, looking down at a notebook keeps the clock running, while closed eyes and a turned head stop it after the wait and it recovers when you look back), but only on one person, one machine and in normal room light, so try it yourself (see [Trying it](#trying-the-camera-check)) before relying on it. It is off by default.

Without it, someone could start a lecture and walk away; the "Still studying?" checks limit that, but not completely. The camera check closes the gap: **the study clock counts only while someone is in front of the camera.**

- **Off by default.** Only the owner can switch it on or off, in Settings (behind the exit password). Strudy's main process refuses camera access unless the setting is on, and it never opens the microphone.
- **You always know.** While it runs, a small live picture of what the camera sees and a status line stay in the corner of the player, next to the Mac's own camera light. The first time it starts, a notice explains it and must be accepted.
- **Nothing is recorded, saved or sent.** Each picture is looked at to answer one question, "is a face in view?", and dropped. The only thing written down is a note in the session log when no one is seen.
- **A quick look down is fine.** The clock stops only after no one has been seen for the grace period (10 seconds by default, the shortest allowed; up to 300 in Settings). If notes take longer than that, raise it.
- **When no one is there:** the clock stops, the video pauses, `person_away` is logged ("no one seen for 52 s"), and a red bar says so. When a face is seen again (two looks in a row, and two are needed to count someone as there at all, so one stray detection changes nothing) the video carries on and `person_returned` is logged ("away for 3 min 12 s").
- **If the camera cannot be used** (permission refused, no camera, another app has it, unplugged, or the detector stops), the clock does **not** count, and `camera_unavailable` is logged with the reason. It fails closed rather than silently counting.
- **How it finds a face.** Google's MediaPipe face detector (BlazeFace, short range) runs on the CPU inside the app, using files that ship with it (about 15 MB). It looks about once a second and says only yes or no. With the optional eyes-and-head check on, it uses Google's Face Landmarker model instead (another 3.7 MB, shipped too).
- **What it cannot do.** It sees that a face is there, not that anyone is learning, and a photo held up to the camera can fool it. It is friction and a record, like the rest of Strudy, not proof.

#### Eyes and head direction (optional, a second switch)

A face in front of the camera does not mean someone is awake and facing the lecture. With **Also check the eyes and which way the head points** switched on in Settings (off by default; only available while the camera check is on), a face in view with **closed eyes**, or a **head turned well away** from the screen, counts like no one being there: the clock stops, the video pauses and the log says "eyes closed for 20 s" or "looking away for 1 min 15 s". It carries on when she looks back. These have their own wait, 20 seconds by default (10 to 300), longer than the 10 seconds for "no one there", because resting your eyes or glancing aside is more ordinary than leaving.

- **It never tracks where on the screen she looks.** That is too unreliable on a laptop camera, and a notebook would look the same as a phone. Only the eyelids and the head's direction are read.
- **Looking down at a notebook does not count as closed eyes.** In measurements, looking down at a desk lowered the eyelids as much as really closing them (0.55 against 0.60 on the scale); the head's tip tells them apart (about 24 degrees down against 9). Lowered eyelids with the head tipped down more than 16 degrees are treated as reading or writing. A head tipped down more than 32 degrees (a phone in the lap), turned more than 30 degrees sideways, or tipped up more than 25 degrees counts as looking away.
- **She is told.** Switching it on shows the notice again, with an extra line saying exactly this.
- **Quiet for a glance.** The on-screen countdown ("Eyes closed. The clock stops in 12 s") only appears once the trouble has lasted 3 seconds, so a passing glance or a moving head shows nothing.
- **Limits of the measurement.** The limits come from one person on a MacBook's camera, in normal light. Glasses, a different camera, a different seat or poor light can move the numbers; the limits are in `src/renderer/camera/faceLook.ts` (`DEFAULT_LIMITS`). Someone sleeping with their chin on their chest looks like someone reading, so that is not caught.

#### Trying the camera check

1. `npm run dev`, unlock **Settings**, and switch **Camera check** on.
2. Open a video. The first time, the notice appears; accept it. macOS asks for camera access once.
3. Sit in front of the camera: the dot turns green and the study clock counts. Cover the lens or step away: after the grace period the clock stops, the video pauses and a red bar appears. Come back and it carries on. **Summary** lists the "no one in front of the camera" events.

`STRUDY_CAMERA_FAKE=1 npm run dev` gives a synthetic test-pattern camera with no face in it, which is useful for seeing the "no one there" side without the real camera. If macOS says access was denied, allow Strudy (or Electron, in a dev run) under System Settings, Privacy & Security, Camera.

### Exit password

On first run Strudy asks you to create an **exit password** (at least 6 characters, entered twice). After that the app cannot be closed without it:

- The window's close button, `Cmd+W`, `Cmd+Q` and `Alt+F4` are all blocked. Instead of closing, they open an **Exit** dialog (the **Exit** button in the top bar opens the same one).
- The password is checked in the **main process only**, against a salted **scrypt** hash. The password itself is never stored.
- A wrong password does nothing except get **logged** as an `auth_failed` event on the running session.
- The right password **ends and saves the session first** (it gets an `endedAt` time), saves the resume position, then quits.
- Shutting down, restarting or logging out is never blocked.
- Until a password exists there is nothing to ask for, so a half-set-up app can always be closed.

### Forgot the password? The recovery key

When the password is first set, Strudy shows a **recovery key** once, such as `K7Q2M-X9RTB-4WNHD-PE3FA`, and will not let you continue until you confirm you have saved it. Only a scrambled copy is kept, so it cannot be shown again.

- On the exit box (or the Settings unlock screen) choose **Forgot password?**, enter the key and a new password. The key is checked in the main process, like the password.
- A key works **once**: resetting makes a fresh key, shown the same way, and the old one stops working.
- A reset is **logged** (it shows in the Summary as "Password reset with the recovery key"), and a wrong key counts as a failed attempt.
- Anyone who holds the key can reset the password, so treat it like the password itself. **Do the first-run setup yourself, not the person who will be studying, and keep the key away from them.**
- If a password was set before this existed, or you lose the key, make a new one in **Settings → Recovery key** (this needs the password).
- If both the password and the key are lost, see the last resort under [Known limitations](#known-limitations).

### Settings

The **Settings** button on the library opens a screen that asks for the exit password first, because settings can switch the locks off. It stays unlocked for five minutes, or until you leave the screen. The check is made in the main process, so the screen cannot be talked into changing anything while locked.

- **Bring Strudy back to the front when I leave it** (on by default). Turn it off and leaving still pauses the video, stops the clock and is logged; Strudy just does not pull itself back.
- **"Still studying?" checks.** The shortest and longest gap, in whole minutes of studying (1 to 180). They are saved together, and the shortest cannot be longer than the longest.
- **Camera check.** Switch it on or off, set how many seconds no one may be seen before the clock stops (10 to 300), and switch the eyes-and-head check on or off with its own wait.
- **Recovery key.** Shows whether one is set and can make a new one (which stops the old one working).
- **Change the exit password.** It asks for the current password again, and the new one needs at least 6 characters, entered twice.

Wrong passwords typed here are logged like wrong ones at the exit dialog.

### Summary and export

The **Summary** button on the library shows:

- **Today:** time studied, how many times you left the app, missed "Still studying?" checks, and the number of sessions.
- **Last 7 days:** a bar chart of minutes studied per day (today is highlighted).
- **Sessions:** every session, newest first, with its start, time studied, videos, times left, missed checks and how it ended. A session that never ended properly (Force Quit, power-off) is marked **Not closed properly**. Open a session's events to see exactly when you left, missed a check or typed a wrong password.

**Export CSV** saves every session to a file you choose (a normal Save dialog), one row per session, oldest first: start and end time, study seconds and minutes, the videos, the counts and the events. It opens in Numbers or Excel. Text that starts like a formula (a video named `=...`) is neutralised, so opening the file can never run anything.

A session counts toward the day it started, the same rule as the "Today" clock.

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
| `npm run dist` | Build the Mac installers (Apple silicon and Intel) into `release/`; see [Installing on a Mac](#installing-on-a-mac) |
| `npm run dist:arm64` | The same, for Apple silicon only (it does not need the large Intel download) |
| `npm run pack` / `pack:arm64` | Just the app folder, without the disk images |

While developing you will not want the locks in your way. These switches work only when running from source and are **ignored in packaged builds**:

```bash
STRUDY_FOCUS_LOCK=0 npm run dev   # stop Strudy pulling itself back to the front (pausing, logging and the overlay still work)
STRUDY_EXIT_LOCK=0 npm run dev    # let the window close without the password
STRUDY_PRESENCE_FAST=1 npm run dev # "Still studying?" every 4 to 6 seconds of studying, 4 seconds to answer
STRUDY_DEV_TOOLS=0 npm run dev    # behave like the installed app: no reload, no DevTools, no View menu
STRUDY_CAMERA_FAKE=1 npm run dev  # a synthetic test-pattern camera instead of the real one (no macOS prompt, no camera light)
```

`Ctrl+C` in the terminal always stops `npm run dev` (it force-quits Strudy if the window has not closed after two seconds).

## Installing on a Mac

`npm run dist` makes two disk images in `release/`:

- `Strudy-<version>-arm64.dmg` for Macs with Apple silicon (M1 and later)
- `Strudy-<version>-x64.dmg` for Intel Macs

Not sure which? Apple menu → **About This Mac**: "Chip: Apple M…" means arm64, "Processor: Intel…" means x64.

The app is built and signed by `electron-builder`; the disk image is then made by `scripts/make-dmg.sh` with macOS's own `hdiutil`, because the builder's own disk-image step downloads a helper from GitHub and that download can stall. Building the Intel version downloads Electron's Intel build (about 125 MB) once. If that download is very slow or stalls, use `npm run dist:arm64` for the Apple silicon image now and run `npm run dist` again later for the Intel one.

1. Open the `.dmg` and drag **Strudy** into **Applications**.
2. **First launch:** Strudy is not signed with an Apple Developer ID (that needs a paid Apple account), so macOS will say it cannot check the app. Control-click (or right-click) **Strudy** in Applications, choose **Open**, then **Open** again. You only do this once. If macOS says the app is "damaged", run this in Terminal and try again:

   ```bash
   xattr -dr com.apple.quarantine /Applications/Strudy.app
   ```

3. The first run asks for the exit password and then shows a **recovery key**. Do this step yourself rather than the person who will be studying, and save the key somewhere safe: it is the way back in if the password is forgotten.

To **update**, install the newer `.dmg` over the old app: your history and password are kept. To **uninstall**, drag Strudy to the Trash; delete `~/Library/Application Support/Strudy` as well to erase everything it stored.

### What the installed app does differently

The installed app is locked down further than a run from source:

- Electron's "fuses" are switched in the app itself: it ignores `ELECTRON_RUN_AS_NODE` and `NODE_OPTIONS`, turns the `--inspect` debugger off, and checks that its code file has not been altered.
- It **refuses to start** if launched with a remote-debugging or inspector switch (for example `--remote-debugging-port`), because that would let anyone drive the page from outside.
- DevTools and reload are off, and the development switches (`STRUDY_FOCUS_LOCK=0` and the rest) are ignored.

This is still a deterrent, not a vault: someone with admin rights on the Mac can replace or delete the app itself.

## Privacy and data

- **Local only.** There are no network calls. The renderer runs under a strict Content Security Policy (`connect-src 'self'`, the app's own files only; pinned by a test), and the main process cancels any request that is not local. One thing to know: the camera check's face-detector library has a built-in usage logger that tries to contact a Google address (`odml.pa.googleapis.com`) and cannot be switched off. Both of those refuse it, so nothing is sent; in a development run you will see "blocked request" for it in the terminal.
- **The camera** is used only by the visible camera check, only when the owner has switched it on; see [Camera check](#camera-check-optional). No picture is ever stored or sent. Page permissions are an allow-list: video from the app's own page, nothing else (no microphone, location, notifications and so on).
- **What is stored:** resume positions, session records (start and end time, study time, the videos watched, focus losses, wrong-password attempts and, with the camera check on, when no one was seen), a scrypt hash of the exit password and one of the recovery key (never either in the clear). Nothing else.
- **Where:** `strudy.json` in the app data folder: `~/Library/Application Support/Strudy` on macOS, `%APPDATA%\Strudy` on Windows. Delete the file to erase everything.
- **Local files:** videos are served through a private `strudy-media://` protocol, and only files you picked in the open dialog this launch. `webSecurity` stays on.

## Known limitations

- Strudy is a **deterrent and a logger**, not security. Anyone can still shut the lid, power off, Force Quit it (`Cmd+Option+Esc` on macOS, Task Manager on Windows), or delete `strudy.json`. The log is what makes that visible: a session that never ended has no `endedAt`.
- A plain `kill` (SIGTERM) does not close a locked Strudy either, because Electron answers it by closing the window and the lock refuses. Use Force Quit or `kill -9`.
- **Lost the password and the recovery key?** That is the last resort: quit Strudy by Force Quit, then delete the `auth` and `recovery` entries in `strudy.json` (or the whole file, which also deletes your history). The next launch asks for a new password and shows a new recovery key.
- Taking focus back is best effort. There is no kiosk mode (skipped by choice), so `Cmd+Tab` still switches away and Strudy pulls itself back a moment later. The installed app refuses debugging switches; a run from source (`npm run dev`) does not, by design. On Windows the OS may refuse to give focus to a background app and flash its taskbar button instead; that cannot be fixed without native hooks.
- The camera check cannot tell attention from presence (the optional eyes-and-head check only catches closed eyes and a turned head, not a mind elsewhere), and a photo or a video of a face held up to the camera can fool it. A face turned away or hidden for longer than the grace period counts as "no one there". Face detection is also less reliable in poor light.
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
| 7 | Kiosk mode and shortcut blocking | Reload/DevTools blocking done; kiosk skipped by choice |
| 8 | "Still studying?" presence checks | Done |
| 9 | Session summary, 7-day chart, CSV export | Done |
| 10 | Packaging (Mac installers) and platform notes | Done (Mac only; no Windows installer for now) |
| 11 | Optional camera presence check | Done; tried with a real face on one MacBook camera |

**Platform honesty, for the lock to come:** on Windows, Ctrl+Alt+Del and the Windows key cannot be fully blocked without low-level keyboard hooks, which Strudy deliberately does not use. If something cannot be reliably blocked on an OS, this README will say so plainly rather than pretend.

## Project layout

```
src/
  main/       Electron main process: window, menu, shortcuts, IPC, media protocol, storage, exit password, power and focus events
  preload/    The small typed API exposed to the UI (contextBridge)
  shared/     Types and helpers used by both sides
  renderer/   React UI
    screens/    Library, Player, Settings, Summary
    components/ Video player, controls, study clock, focus overlay
    player/     Playback hooks, speed, hold-to-boost gesture
    summary/    Summary maths: today's totals, the 7-day chart, the session list
    focus/      Focus-loss logging logic and the pause/overlay hook
    presence/   "Still studying?" logic (pure) and the hook that runs it
    camera/     Camera check: presence logic (pure), the camera hook, the face-detector interface, error messages
    timer/      Study timer (pure logic), clock helpers, session persistence
    state/      Zustand store
scripts/      Dev runner and the app-icon generator (make-icon.swift, make-icns.sh)
build/        App icon (icon.icns) for the installer
electron-builder.yml  Packaging settings, including the fuses
CLAUDE.md     The project spec and working rules
```

The window is created with `contextIsolation` on, `nodeIntegration` off and the renderer sandboxed. The renderer can only talk to the main process through the typed `window.api`, and main validates what it receives.

## Contributing

The full spec, milestone order and working rules live in [CLAUDE.md](CLAUDE.md). The study-timer rules are implemented as pure, unit-tested logic in `src/renderer/timer/studyTimer.ts`, so changes there should come with tests.

## License

No license has been chosen yet. All rights reserved by the author.
