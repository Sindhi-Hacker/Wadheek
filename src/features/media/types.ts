/** Media asset records persisted in IndexedDB (Blob + metadata). */

export type MediaKind = 'video' | 'audio' | 'image';

export interface MediaRecord {
  id: string;
  name: string;
  kind: MediaKind;
  mime: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  createdAt: number;
  /** Cover thumbnail as data URL. */
  thumbnail: string | null;
  /** Filmstrip frames as data URLs (video only). */
  filmstrip: string[];
  /** Peak envelope, values 0..1, uniformly spanning the duration. */
  waveform: number[] | null;
  blob: Blob;
}

export function mediaDurationLabel(m: MediaRecord): string {
  if (m.kind === 'image') return 'still';
  const t = Math.round(m.duration);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
