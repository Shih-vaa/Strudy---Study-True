interface CameraNoticeProps {
  graceSeconds: number;
  onAcknowledge: () => void;
}

/** Shown once, before the camera first starts, so nobody is surprised by it. */
export default function CameraNotice({ graceSeconds, onAcknowledge }: CameraNoticeProps) {
  return (
    <div className="presence-backdrop">
      <div className="presence-modal camera-notice" role="alertdialog" aria-modal="true" aria-labelledby="camera-notice-title">
        <h2 id="camera-notice-title">The camera check is on</h2>
        <ul>
          <li>
            Strudy uses your camera only to see whether someone is in front of it while a lecture plays. A small
            picture of what it sees stays in the corner, and your Mac&rsquo;s camera light is on, the whole time.
          </li>
          <li>
            <strong>Nothing is recorded, saved or sent anywhere.</strong> Each picture is looked at and thrown away
            at once. The only thing kept is a note in your study log when no one is seen.
          </li>
          <li>
            Your study clock counts only while you are there. If no one is seen for {graceSeconds} seconds, the
            clock stops and the video pauses; it carries on when you are back. Looking down to take notes is fine.
          </li>
          <li>Only the person with the exit password can switch this off.</li>
        </ul>
        <button className="btn primary" autoFocus onClick={onAcknowledge}>
          OK, I understand
        </button>
      </div>
    </div>
  );
}
