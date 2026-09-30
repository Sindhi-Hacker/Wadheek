import type { Ctx2D } from "./canvas-compositor";
import type { StickerStyle } from "../types/clip";

/** Vector shape ids available in the sticker picker. */
export const SHAPE_IDS = [
  "rect",
  "rounded-rect",
  "circle",
  "triangle",
  "star",
  "heart",
  "arrow",
  "diamond",
  "burst",
  "bubble",
  "cross",
  "ring",
] as const;

export const SHAPE_LABELS: Record<string, string> = {
  rect: "Rectangle",
  "rounded-rect": "Rounded",
  circle: "Circle",
  triangle: "Triangle",
  star: "Star",
  heart: "Heart",
  arrow: "Arrow",
  diamond: "Diamond",
  burst: "Burst",
  bubble: "Speech",
  cross: "Cross",
  ring: "Ring",
};

/** Categorized emoji catalog for the sticker picker. */
export const EMOJI_CATALOG: { id: string; label: string; emojis: string[] }[] = [
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      "😀", "😂", "🥹", "😍", "🤩", "😎", "🥳", "🤯", "😱", "🤔",
      "😴", "🤠", "🥰", "😘", "😜", "🤪", "😇", "🤗", "😭", "😡",
      "🤬", "🤫", "🤭", "😬", "🥺", "😏", "😌", "🙃", "😷", "🤒",
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    emojis: [
      "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👏", "🙌", "🤝",
      "🙏", "💪", "👀", "🧠", "🫶", "👋", "🤙", "☝️", "👆", "👇",
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "💔", "❣️", "💟", "♥️",
    ],
  },
  {
    id: "effects",
    label: "Effects",
    emojis: [
      "🔥", "✨", "💥", "💫", "⚡", "🌟", "⭐", "🌈", "☀️", "🌙",
      "☁️", "💧", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "💯", "❗",
    ],
  },
  {
    id: "animals",
    label: "Animals",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
      "🦁", "🐮", "🐷", "🐸", "🐵", "🦄", "🐝", "🦋", "🐢", "🐬",
    ],
  },
  {
    id: "food",
    label: "Food",
    emojis: [
      "🍕", "🍔", "🍟", "🌮", "🍿", "🍩", "🍪", "🎂", "🍰", "🍫",
      "🍬", "☕", "🍵", "🧋", " Soda".trim(), "🍺", "🍷", "🥤", "🍎", "🍌",
    ],
  },
  {
    id: "objects",
    label: "Objects",
    emojis: [
      "📱", "💻", "🎧", "🎤", "🎬", "📷", "🕹️", "💡", "🔑", "💰",
      "📌", "✂️", "📎", "🧲", "🧩", "🎨", "🥁", "🎸", "🚀", "🎮",
    ],
  },
  {
    id: "arrows",
    label: "Arrows",
    emojis: [
      "➡️", "⬅️", "⬆️", "⬇️", "↗️", "↘️", "↖️", "↙️", "↔️", "↕️",
      "🔝", "🔜", "🔂", "🔃", "🎯", "📍", "🔴", "🟡", "🟢", "⚪",
    ],
  },
];

const EMOJI_FONT_STACK =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

/**
 * Draw a sticker centered on (0,0) at the given size, in a context that has
 * already been translated/rotated/scaled. Used by the compositor so preview
 * and export render identically.
 */
export function drawSticker(ctx: Ctx2D, sticker: StickerStyle, time: number): void {
  const size = sticker.size;
  if (sticker.type === "emoji") {
    ctx.save();
    if (sticker.shadowBlur > 0) {
      ctx.shadowColor = sticker.shadowColor;
      ctx.shadowBlur = sticker.shadowBlur;
    }
    ctx.font = `${size}px ${EMOJI_FONT_STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sticker.content, 0, size * 0.04);
    ctx.restore();
    return;
  }
  drawShape(ctx, sticker.content, size, sticker, time);
}

function drawShape(
  ctx: Ctx2D,
  shape: string,
  size: number,
  style: StickerStyle,
  _time: number
): void {
  const w = size;
  const h = size;
  ctx.save();
  if (style.shadowBlur > 0) {
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowBlur;
  }
  ctx.beginPath();
  switch (shape) {
    case "rect":
      ctx.rect(-w / 2, -h / 2, w, h);
      break;
    case "rounded-rect": {
      const r = Math.min(w, h) * 0.22;
      ctx.moveTo(-w / 2 + r, -h / 2);
      ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
      ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
      ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
      ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
      break;
    }
    case "circle":
    case "ring":
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      break;
    case "triangle":
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(0, h / 2);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      break;
    case "star": {
      starPath(ctx, 0, 0, w / 2, w / 4.8, 5);
      break;
    }
    case "burst": {
      starPath(ctx, 0, 0, w / 2, w / 2.6, 12);
      break;
    }
    case "heart": {
      heartPath(ctx, w);
      break;
    }
    case "arrow": {
      const shaft = w * 0.16;
      ctx.moveTo(-w / 2, -shaft);
      ctx.lineTo(w * 0.1, -shaft);
      ctx.lineTo(w * 0.1, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w * 0.1, h / 2);
      ctx.lineTo(w * 0.1, shaft);
      ctx.lineTo(-w / 2, shaft);
      ctx.closePath();
      break;
    }
    case "bubble": {
      const r = Math.min(w, h) * 0.2;
      ctx.moveTo(-w / 2 + r, -h / 2);
      ctx.arcTo(w / 2, -h / 2, w / 2, h * 0.28, r);
      ctx.arcTo(w / 2, h * 0.28, -w / 2, h * 0.28, r);
      ctx.lineTo(-w * 0.12, h * 0.28);
      ctx.lineTo(-w * 0.3, h / 2);
      ctx.lineTo(-w * 0.22, h * 0.28);
      ctx.lineTo(-w / 2, h * 0.28);
      ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
      break;
    }
    case "cross": {
      const arm = w * 0.3;
      ctx.moveTo(-arm, -h / 2);
      ctx.lineTo(arm, -h / 2);
      ctx.lineTo(arm, -arm);
      ctx.lineTo(w / 2, -arm);
      ctx.lineTo(w / 2, arm);
      ctx.lineTo(arm, arm);
      ctx.lineTo(arm, h / 2);
      ctx.lineTo(-arm, h / 2);
      ctx.lineTo(-arm, arm);
      ctx.lineTo(-w / 2, arm);
      ctx.lineTo(-w / 2, -arm);
      ctx.lineTo(-arm, -arm);
      ctx.closePath();
      break;
    }
    default:
      ctx.rect(-w / 2, -h / 2, w, h);
  }

  if (shape === "ring") {
    ctx.lineWidth = Math.max(2, style.strokeWidth || size * 0.08);
    ctx.strokeStyle = style.stroke || style.fill;
    ctx.stroke();
  } else {
    if (style.strokeWidth > 0) {
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeStyle = style.stroke;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    ctx.fillStyle = style.fill;
    ctx.fill();
  }
  ctx.restore();
}

function starPath(
  ctx: Ctx2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number
): void {
  const step = Math.PI / points;
  let angle = -Math.PI / 2;
  ctx.moveTo(cx + outer * Math.cos(angle), cy + outer * Math.sin(angle));
  for (let i = 0; i < points; i++) {
    angle += step;
    ctx.lineTo(cx + inner * Math.cos(angle), cy + inner * Math.sin(angle));
    angle += step;
    ctx.lineTo(cx + outer * Math.cos(angle), cy + outer * Math.sin(angle));
  }
  ctx.closePath();
}

function heartPath(ctx: Ctx2D, size: number): void {
  const w = size;
  ctx.moveTo(0, w * 0.32);
  ctx.bezierCurveTo(-w * 0.55, -w * 0.08, -w * 0.34, -w * 0.5, 0, -w * 0.2);
  ctx.bezierCurveTo(w * 0.34, -w * 0.5, w * 0.55, -w * 0.08, 0, w * 0.32);
  ctx.closePath();
}
