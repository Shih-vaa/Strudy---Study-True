import { useCallback, useEffect, useRef, useState } from 'react';
import { play } from '../player/actions';
import { useSessionStore } from '../state/useSessionStore';
import { describeCameraError } from './cameraErrors';
import { hasSeenCameraNotice, markCameraNoticeSeen } from './cameraNotice';
import {
  CAMERA_FACE_FRAMES,
  DISABLED_CAMERA,
  graceSecondsLeft,
  STARTING_CAMERA,
  type CameraConfig,
  type CameraPhase,
} from './cameraPresence';
import type { FaceDetector } from './faceDetector';
import { loadFaceDetector } from './loadFaceDetector';

/** One look per second is plenty to tell whether someone is there, and is gentle on the battery. */
const LOOK_EVERY_MS = 1000;
/** When the camera or detector could not start, try again this often. */
const RETRY_EVERY_MS = 10_000;

// A small picture is enough to find a face, and costs less to process.
const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 10 } },
};

export interface CameraUi {
  /** null until Settings has been read. */
  enabled: boolean | null;
  phase: CameraPhase;
  /** Why the camera is unavailable. */
  reason: string | null;
  /** The live camera, for the always-visible preview. */
  stream: MediaStream | null;
  /** While no one is seen but the grace period has not run out: whole seconds until the clock stops. */
  graceLeft: number | null;
  /** The configured grace period, for the notice. */
  graceSeconds: number;
  /** The one-time "the camera check is on" notice is showing; the camera starts after it is closed. */
  noticeOpen: boolean;
  acknowledgeNotice: () => void;
}

interface LoadedSettings {
  on: boolean;
  graceSeconds: number;
}

/**
 * Runs the camera presence check for the player screen. While Settings has it on, the camera
 * looks for a face about once a second; the study clock counts only while someone is there. Each
 * frame is looked at and dropped: nothing is recorded, saved or sent. Leaving the player turns
 * the camera off.
 */
export function useCameraPresence(video: HTMLVideoElement | null): CameraUi {
  const camera = useSessionStore((s) => s.camera);
  const [settings, setSettings] = useState<LoadedSettings | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const resumeOnReturn = useRef(false);

  // 1. Read Settings. The state starts as "starting", which does not count, until this says
  //    whether the check is on at all.
  useEffect(() => {
    let cancelled = false;
    const store = useSessionStore.getState;
    void window.api
      .getSettings()
      .then((loaded) => {
        if (cancelled) return;
        const on = loaded.cameraCheck;
        setSettings({ on, graceSeconds: loaded.cameraGraceSeconds });
        store().setCamera(on ? STARTING_CAMERA : DISABLED_CAMERA);
        if (on && !hasSeenCameraNotice()) {
          setNoticeOpen(true);
          store().setCameraNoticeOpen(true);
        }
      })
      // Settings could not be read: the state stays "starting", so the clock does not count.
      .catch(() => undefined);
    return () => {
      cancelled = true;
      // Leaving the player: the camera is off and nothing counts until the next visit decides.
      store().setCamera(STARTING_CAMERA);
      store().setCameraNoticeOpen(false);
    };
  }, []);

  const acknowledgeNotice = useCallback(() => {
    markCameraNoticeSeen();
    setNoticeOpen(false);
    useSessionStore.getState().setCameraNoticeOpen(false);
  }, []);

  // 2. The camera and the detection loop, for as long as the check is on and the notice is closed.
  const on = settings?.on === true;
  const graceSeconds = settings?.graceSeconds ?? 0;
  useEffect(() => {
    if (!on || noticeOpen) return;

    const store = useSessionStore.getState;
    const config: CameraConfig = { graceMs: graceSeconds * 1000, faceFrames: CAMERA_FACE_FRAMES };
    let cancelled = false;
    let opened: MediaStream | null = null;
    let detector: FaceDetector | null = null;
    let retryTimer: number | undefined;
    let looking = false;

    // Reads frames from the camera. Never shown, never copied: it exists so the detector has a
    // <video> to look at. The visible preview is a separate element on the same stream.
    const probe = document.createElement('video');
    probe.muted = true;
    probe.playsInline = true;

    // The grace period starts with the first frame the camera delivers, not when it is asked for:
    // opening the camera can wait on macOS's permission prompt, and loading the detector takes a
    // moment, and neither should use up the grace period. (If no one ever shows up once frames
    // arrive, that is "away" too. If no frames ever arrive, the clock simply does not count.)
    store().setCamera(STARTING_CAMERA);

    const fail = (reason: string) =>
      store().applyCamera({ kind: 'failed', reason }, config, performance.now(), Date.now());

    const release = () => {
      opened?.getTracks().forEach((track) => track.stop());
      opened = null;
      probe.srcObject = null;
      setStream(null);
    };

    const scheduleRetry = () => {
      if (cancelled || retryTimer !== undefined) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void ensureRunning();
      }, RETRY_EVERY_MS);
    };

    // The camera was unplugged, or macOS took it back.
    const onTrackEnded = () => {
      if (cancelled) return;
      release();
      fail('The camera was disconnected.');
      scheduleRetry();
    };

    async function ensureRunning(): Promise<void> {
      if (!opened) {
        try {
          const got = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
          if (cancelled) {
            got.getTracks().forEach((track) => track.stop());
            return;
          }
          opened = got;
          got.getVideoTracks().forEach((track) => track.addEventListener('ended', onTrackEnded));
          probe.srcObject = got;
          await probe.play();
          setStream(got);
        } catch (error) {
          if (cancelled) return;
          release();
          fail(describeCameraError(error));
          scheduleRetry();
          return;
        }
      }
      if (!detector) {
        try {
          const loaded = await loadFaceDetector();
          if (cancelled) {
            loaded.close();
            return;
          }
          detector = loaded;
        } catch {
          if (cancelled) return;
          fail('The face detector could not start.');
          scheduleRetry();
        }
      }
    }

    const look = async () => {
      if (looking || !detector || !opened || probe.readyState < 2) return;
      looking = true;
      try {
        const faceSeen = await detector.hasFace(probe);
        if (!cancelled) {
          store().applyCamera({ kind: 'sample', faceSeen }, config, performance.now(), Date.now());
        }
      } catch {
        if (!cancelled) fail('The face detector stopped working.');
      } finally {
        looking = false;
      }
    };

    void ensureRunning();
    const interval = window.setInterval(() => void look(), LOOK_EVERY_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      detector?.close();
      release();
    };
  }, [on, noticeOpen, graceSeconds]);

  // 3. While no one is there the video is paused (so it cannot play on to the end unwatched),
  //    and it carries on by itself when someone is back.
  useEffect(() => {
    if (!video) return;
    return useSessionStore.subscribe((state, prev) => {
      const now = state.camera.phase;
      const before = prev.camera.phase;
      if (now === 'away' && before !== 'away') {
        resumeOnReturn.current = !video.paused && !video.ended;
        video.pause();
      } else if (before === 'away' && now !== 'away') {
        if (now === 'present' && resumeOnReturn.current) play(video);
        resumeOnReturn.current = false;
      }
    });
  }, [video]);

  return {
    enabled: settings === null ? null : settings.on,
    phase: camera.phase,
    reason: camera.reason,
    stream,
    graceLeft: graceSecondsLeft(camera, performance.now(), graceSeconds * 1000),
    graceSeconds,
    noticeOpen,
    acknowledgeNotice,
  };
}
