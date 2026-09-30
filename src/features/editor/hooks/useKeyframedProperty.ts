import { useEditor, useEditorStore } from "./useEditorStore";
import {
  KEYFRAME_PROPERTIES,
  sampleTrack,
  keyframeAt,
} from "../lib/keyframes";
import type { Clip, KeyframeProperty } from "../types/clip";

export interface KeyframedPropertyApi {
  /** Value to display: keyframed value at the playhead, else the static value. */
  value: number;
  onChange: (v: number) => void;
  hasTrack: boolean;
  hasKeyAtPlayhead: boolean;
  toggleKeyframe: () => void;
}

/**
 * Binds a numeric clip property to the keyframe system:
 * - reads the interpolated value at the playhead when the property is animated
 * - writes go to the static value, and additionally to a keyframe at the
 *   playhead when auto-key is enabled (or the property is already animated)
 */
export function useKeyframedProperty(clip: Clip, prop: KeyframeProperty): KeyframedPropertyApi {
  const currentTime = useEditor((s) => s.currentTime);
  const fps = useEditor((s) => s.settings.fps);
  const track = clip.keyframes?.[prop] ?? [];
  const hasTrack = track.length > 0;
  const sampled = hasTrack ? sampleTrack(track, currentTime) : null;
  const value = sampled ?? KEYFRAME_PROPERTIES[prop].getValue(clip);
  const hasKeyAtPlayhead = hasTrack && keyframeAt(track, currentTime, fps) !== undefined;

  const onChange = (v: number) => {
    const store = useEditorStore.getState();
    if (hasTrack || store.autoKeyframes) {
      store.setKeyframedValue(clip.id, prop, v);
    } else {
      store.updateClip(clip.id, (c) => {
        const draft = { ...c };
        KEYFRAME_PROPERTIES[prop].apply(draft, v);
        return draft;
      });
    }
  };

  const toggleKeyframe = () => {
    useEditorStore.getState().toggleClipKeyframe(clip.id, prop);
  };

  return { value, onChange, hasTrack, hasKeyAtPlayhead, toggleKeyframe };
}
