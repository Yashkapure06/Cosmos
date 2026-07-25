import { useEffect } from "react";
import { useStore } from "../store/useStore";
import {
  armAudioUnlock,
  disableAudio,
  enableAudio,
  playCue,
} from "../lib/audio";

export function AudioToggle() {
  const muted = useStore((s) => s.audioMuted);
  const toggle = useStore((s) => s.toggleAudioMuted);

  useEffect(() => {
    armAudioUnlock();
  }, []);

  return (
    <button
      className={`audio-toggle${muted ? "" : " active"}`}
      onClick={() => {
        if (muted) {
          // Must unlock + start inside this gesture (browser autoplay policy)
          void enableAudio().then(() => playCue("select"));
          toggle();
        } else {
          disableAudio();
          toggle();
        }
      }}
      title={muted ? "Enable ambient audio" : "Mute ambient audio"}
    >
      <span className="dot" />
      <span>{muted ? "AUDIO OFF" : "AUDIO ON"}</span>
    </button>
  );
}
