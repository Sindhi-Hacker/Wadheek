import { uid } from '@/lib/id';
import type { MediaRecord } from '@/features/media/types';
import { defaultTextProps, makeClip } from '@/features/projects/types';

/**
 * First-run sample data. Everything is generated procedurally in the browser
 * (canvas art + synthesized WAV tones) and stored through the same IndexedDB
 * pipeline as user imports — nothing is hardcoded in the UI.
 */

type Palette = [string, string, string];

function artImage(w: number, h: number, palette: Palette, variant: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const [a, b, c] = palette;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, a);
  g.addColorStop(0.55, b);
  g.addColorStop(1, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // soft light beams
  for (let i = 0; i < 5; i++) {
    const beam = ctx.createLinearGradient(0, 0, w, h);
    beam.addColorStop(0, 'rgba(255,255,255,0.18)');
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.translate((w * (i + variant)) / 6, 0);
    ctx.rotate((18 + i * 9) * (Math.PI / 180));
    ctx.fillStyle = beam;
    ctx.fillRect(-w * 0.1, -h, w * 0.24, h * 3);
    ctx.restore();
  }

  // horizon glow
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.62, 10, w * 0.5, h * 0.62, w * 0.55);
  glow.addColorStop(0, 'rgba(255,255,255,0.35)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // grain-free vignette
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? new Blob()), 'image/jpeg', 0.85));
}

function artThumb(blobUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = Math.round((img.naturalHeight / img.naturalWidth) * 320);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve('');
    img.src = blobUrl;
  });
}

/** Encode mono Float32 PCM samples into a 16-bit WAV blob. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

/** A gentle synthesized chord pad with an arpeggio — ~16 s, 44.1 kHz. */
function synthTone(): { blob: Blob; peaks: number[] } {
  const sr = 44100;
  const dur = 16;
  const n = sr * dur;
  const out = new Float32Array(n);
  const note = (freq: number) => 440 * Math.pow(2, (freq - 69) / 12);
  const chords: number[][] = [
    [57, 64, 69, 72],
    [55, 62, 67, 71],
    [53, 60, 65, 69],
    [52, 59, 64, 67],
  ];
  const arp = [69, 72, 76, 72, 74, 77, 81, 77];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const barLen = dur / chords.length;
    const chord = chords[Math.floor(t / barLen) % chords.length];
    let v = 0;
    for (const m of chord) {
      const f = note(m);
      v += Math.sin(2 * Math.PI * f * t) * 0.11;
      v += Math.sin(2 * Math.PI * f * 2 * t) * 0.025;
    }
    // arpeggio sparkle
    const arpStep = Math.floor((t % 4) / 0.5) % arp.length;
    const af = note(arp[arpStep]);
    const arpEnv = Math.exp(-((t % 0.5) / 0.5) * 5);
    v += Math.sin(2 * Math.PI * af * t) * 0.08 * arpEnv;
    // master envelope: fade in/out
    const env = Math.min(1, t / 1.2) * Math.min(1, (dur - t) / 1.6);
    out[i] = v * env;
  }
  const peaks: number[] = [];
  const buckets = 1600;
  const step = Math.floor(n / buckets);
  for (let b = 0; b < buckets; b++) {
    let peak = 0;
    for (let j = b * step; j < (b + 1) * step; j += 16) {
      const a = Math.abs(out[j]);
      if (a > peak) peak = a;
    }
    peaks.push(Math.min(1, peak * 1.4));
  }
  return { blob: encodeWav(out, sr), peaks };
}

async function imageAsset(name: string, palette: Palette, variant: number): Promise<MediaRecord> {
  const blob = await artImage(1920, 1080, palette, variant);
  const url = URL.createObjectURL(blob);
  const thumbnail = await artThumb(url);
  URL.revokeObjectURL(url);
  return {
    id: uid('med_'),
    name,
    kind: 'image',
    mime: 'image/jpeg',
    size: blob.size,
    duration: 0,
    width: 1920,
    height: 1080,
    createdAt: Date.now(),
    thumbnail,
    filmstrip: [],
    waveform: null,
    blob,
  };
}

async function toneAsset(name: string): Promise<MediaRecord> {
  const { blob, peaks } = synthTone();
  return {
    id: uid('med_'),
    name,
    kind: 'audio',
    mime: 'audio/wav',
    size: blob.size,
    duration: 16,
    width: 0,
    height: 0,
    createdAt: Date.now(),
    thumbnail: null,
    filmstrip: [],
    waveform: peaks,
    blob,
  };
}

export interface SeedResult {
  media: MediaRecord[];
  sampleProject: {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    width: number;
    height: number;
    fps: number;
    background: string;
    tracks: { id: string; kind: 'video' | 'audio'; name: string; muted: boolean; hidden: boolean; locked: boolean }[];
    clips: ReturnType<typeof makeClip>[];
  };
}

/** Generate the first-run media library + a demo project. */
export async function generateSeed(): Promise<SeedResult> {
  const aurora = await imageAsset('Aurora horizon', ['#1b2a6b', '#5d4bd4', '#e58a6b'], 0);
  const ridge = await imageAsset('Teal ridge', ['#0f3b42', '#1f8f7c', '#cfe3bd'], 2);
  const dusk = await imageAsset('Dusk bloom', ['#2f1a38', '#b25f92', '#f6c087'], 4);
  const tone = await toneAsset('Ambient chord pad');

  const media = [aurora, ridge, dusk, tone];

  const v1 = { id: uid('trk_'), kind: 'video' as const, name: 'V1', muted: false, hidden: false, locked: false };
  const v2 = { id: uid('trk_'), kind: 'video' as const, name: 'V2', muted: false, hidden: false, locked: false };
  const v3 = { id: uid('trk_'), kind: 'video' as const, name: 'V3', muted: false, hidden: false, locked: false };
  const a1 = { id: uid('trk_'), kind: 'audio' as const, name: 'A1', muted: false, hidden: false, locked: false };

  const now = Date.now();
  const sampleProject = {
    id: uid('prj_'),
    name: 'Welcome to Wadheek',
    createdAt: now,
    updatedAt: now,
    width: 1920,
    height: 1080,
    fps: 30,
    background: '#000000',
    tracks: [v1, v2, v3, a1],
    clips: [
      makeClip({
        trackId: v1.id,
        kind: 'image',
        name: aurora.name,
        mediaId: aurora.id,
        start: 0,
        duration: 5,
        fadeIn: 0.6,
        fadeOut: 0.5,
      }),
      makeClip({
        trackId: v1.id,
        kind: 'image',
        name: ridge.name,
        mediaId: ridge.id,
        start: 5,
        duration: 5,
        fadeOut: 0.6,
      }),
      makeClip({
        trackId: v1.id,
        kind: 'image',
        name: dusk.name,
        mediaId: dusk.id,
        start: 10,
        duration: 5,
        fadeOut: 1.2,
      }),
      makeClip({
        trackId: v2.id,
        kind: 'text',
        name: 'Title — Wadheek',
        start: 0.8,
        duration: 4.4,
        text: { ...defaultTextProps(), content: 'WADHEEK', size: 128, shadow: true },
        fadeIn: 0.5,
        fadeOut: 0.5,
      }),
      makeClip({
        trackId: v3.id,
        kind: 'text',
        name: 'Subtitle',
        start: 1.8,
        duration: 3.4,
        y: 150,
        text: {
          ...defaultTextProps(),
          content: 'Edit locally. Stay private.',
          size: 40,
          bold: false,
          color: '#e8e4ff',
          shadow: true,
        },
        fadeIn: 0.5,
        fadeOut: 0.5,
      }),
      makeClip({
        trackId: a1.id,
        kind: 'audio',
        name: tone.name,
        mediaId: tone.id,
        start: 0,
        duration: 15,
        volume: 0.8,
        fadeIn: 1,
        fadeOut: 1.5,
      }),
    ],
  };

  return { media, sampleProject };
}
