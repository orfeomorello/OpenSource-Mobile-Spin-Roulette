import wheelConfig from "../../config/wheel-spin.json" with { type: "json" };
import type { SpinResult, TableVariant } from "../core/types.ts";

const TAU = Math.PI * 2;
const RED = new Set(["1", "3", "5", "7", "9", "12", "14", "16", "18", "19", "21", "23", "25", "27", "30", "32", "34", "36"]);
export const MAX_WHEEL_DPR = 2;

interface WheelLayerCache {
  variant: TableVariant;
  cssSize: number;
  pixelSize: number;
  scale: number;
  base: HTMLCanvasElement;
  ring: HTMLCanvasElement;
}

const wheelLayerCaches = new WeakMap<HTMLCanvasElement, WheelLayerCache>();

export interface WheelAnimationHandle {
  cancel: () => void;
  endAngle: number;
}

interface WheelFrame {
  wheelAngle: number;
  ballAngle: number;
  ballRadius: number;
  speed: number;
  result: string | null;
  settle: number;
}

function pocketsFor(variant: TableVariant): readonly string[] {
  return wheelConfig.variants[variant].pockets;
}

function positiveAngle(value: number): number {
  return ((value % TAU) + TAU) % TAU;
}

export function cappedWheelDpr(value: number): number {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 1;
  return Math.min(MAX_WHEEL_DPR, safeValue);
}

export function getSpinEndAngle(fromAngle: number, variant: TableVariant, result: string, turns: number): number {
  const pockets = pocketsFor(variant);
  const index = Math.max(0, pockets.indexOf(result));
  const targetPhase = positiveAngle(-index * (TAU / pockets.length));
  const phaseDelta = positiveAngle(targetPhase - positiveAngle(fromAngle));
  return fromAngle + Math.max(2, turns) * TAU + phaseDelta;
}

/** Resting ball sits in the middle of the numbered pocket ring (not the green bowl). */
const BALL_RADIUS_TRACK = 0.86;
const BALL_RADIUS_POCKET = 0.71;

/** World-space angle of pocket center (matches pocket drawing + spin lock). */
function pocketWorldAngle(wheelAngle: number, pocketIndex: number, pocketCount: number): number {
  const slice = TAU / pocketCount;
  return -Math.PI / 2 + wheelAngle + pocketIndex * slice;
}

function settledBallFrame(
  variant: TableVariant,
  wheelAngle: number,
  result: string | null,
): Pick<WheelFrame, "ballAngle" | "ballRadius" | "settle"> {
  if (!result) {
    // No result yet: park ball under the pointer on the outer track.
    return { ballAngle: -Math.PI / 2, ballRadius: BALL_RADIUS_TRACK, settle: 0 };
  }
  const pockets = pocketsFor(variant);
  const index = Math.max(0, pockets.indexOf(result));
  return {
    ballAngle: pocketWorldAngle(wheelAngle, index, pockets.length),
    ballRadius: BALL_RADIUS_POCKET,
    settle: 1,
  };
}

export function drawStaticWheel(canvas: HTMLCanvasElement, variant: TableVariant, wheelAngle = 0, result: string | null = null): void {
  const ball = settledBallFrame(variant, wheelAngle, result);
  drawFrame(canvas, variant, {
    wheelAngle,
    ballAngle: ball.ballAngle,
    ballRadius: ball.ballRadius,
    speed: 0,
    result,
    settle: ball.settle,
  });
  canvas.dataset.state = "settled";
}

export function animateWheel(
  canvas: HTMLCanvasElement,
  variant: TableVariant,
  plan: SpinResult,
  fromAngle: number,
  durationMs: number,
  reducedMotion: boolean,
): WheelAnimationHandle {
  let cancelled = false;
  let requestId = 0;
  const pockets = pocketsFor(variant);
  const winnerIndex = Math.max(0, pockets.indexOf(plan.winningNumber));
  const endAngle = getSpinEndAngle(fromAngle, variant, plan.winningNumber, plan.turns);
  // Ball ends in the winning pocket (same pose as drawStaticWheel after settle).
  const ballEnd = pocketWorldAngle(endAngle, winnerIndex, pockets.length);
  const ballStart = ballEnd + (Math.max(6, plan.turns * 1.65) + 5) * TAU;
  const duration = reducedMotion ? 160 : durationMs;
  const startedAt = performance.now();
  canvas.dataset.state = "spinning";

  const frame = (now: number): void => {
    if (cancelled) return;
    const t = Math.min(1, (now - startedAt) / duration);
    const wheelEase = 1 - Math.pow(1 - t, 3.35);
    const ballEase = 1 - Math.pow(1 - t, 4.4);
    const wheelAngle = fromAngle + (endAngle - fromAngle) * wheelEase;
    let ballAngle = ballStart + (ballEnd - ballStart) * ballEase;

    const lockStart = 0.82;
    if (t > lockStart) {
      const pocketAngle = pocketWorldAngle(wheelAngle, winnerIndex, pockets.length);
      const nearbyPocket = pocketAngle + Math.round((ballAngle - pocketAngle) / TAU) * TAU;
      const lock = smoothstep((t - lockStart) / (1 - lockStart));
      ballAngle += (nearbyPocket - ballAngle) * lock;
    }

    const dropStart = 0.62;
    const drop = t <= dropStart ? 0 : smoothstep((t - dropStart) / (1 - dropStart));
    const bounce = drop > 0 ? Math.sin(drop * Math.PI * 9) * (1 - drop) * 0.012 : 0;
    // Outer track → into numbered pocket ring (was dropping into the green bowl by mistake).
    const ballRadius = BALL_RADIUS_TRACK + (BALL_RADIUS_POCKET - BALL_RADIUS_TRACK) * drop + bounce;
    drawFrame(canvas, variant, {
      wheelAngle,
      ballAngle,
      ballRadius,
      speed: 1 - ballEase,
      result: plan.winningNumber,
      settle: drop,
    });

    if (t < 1) requestId = requestAnimationFrame(frame);
    else {
      canvas.dataset.state = "settled";
      drawStaticWheel(canvas, variant, endAngle, plan.winningNumber);
    }
  };

  requestId = requestAnimationFrame(frame);
  return {
    endAngle,
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(requestId);
    },
  };
}

function configureWheelContext(context: CanvasRenderingContext2D, scale: number): void {
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
}

function prepareWheelLayers(canvas: HTMLCanvasElement, variant: TableVariant): WheelLayerCache | null {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 480;
  const height = rect.height || width;
  const cssSize = Math.max(1, Math.round(Math.min(width, height) * 100) / 100);
  const dpr = cappedWheelDpr(window.devicePixelRatio || 1);
  const pixelSize = Math.max(1, Math.round(cssSize * dpr));
  const scale = pixelSize / cssSize;
  const cached = wheelLayerCaches.get(canvas);
  if (cached && cached.variant === variant && cached.cssSize === cssSize && cached.pixelSize === pixelSize) {
    return cached;
  }

  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const base = document.createElement("canvas");
  const ringLayer = document.createElement("canvas");
  base.width = pixelSize;
  base.height = pixelSize;
  ringLayer.width = pixelSize;
  ringLayer.height = pixelSize;
  const baseContext = base.getContext("2d");
  const ringContext = ringLayer.getContext("2d");
  if (!baseContext || !ringContext) return null;
  configureWheelContext(baseContext, scale);
  configureWheelContext(ringContext, scale);
  paintWheelBase(baseContext, cssSize);
  paintNumberRing(ringContext, variant, cssSize);
  const next = { variant, cssSize, pixelSize, scale, base, ring: ringLayer };
  wheelLayerCaches.set(canvas, next);
  canvas.dataset.renderDpr = String(dpr);
  canvas.dataset.renderLayers = "cached-base-ring";
  return next;
}

function paintWheelBase(context: CanvasRenderingContext2D, cssSize: number): void {
  const center = cssSize / 2;
  const radius = cssSize * 0.47;
  context.clearRect(0, 0, cssSize, cssSize);
  context.save();
  context.translate(center, center);

  // Soft contact shadow — a scaled fill, never context.filter (blur is expensive on mobile GPUs).
  context.save();
  context.translate(0, radius * 0.09);
  context.scale(1, 0.86);
  context.beginPath();
  context.arc(0, 0, radius * 1.04, 0, TAU);
  context.fillStyle = "rgba(0,0,0,.42)";
  context.fill();
  context.restore();

  const wood = context.createRadialGradient(-radius * 0.18, -radius * 0.22, radius * 0.08, 0, 0, radius);
  wood.addColorStop(0, "#f0c56a");
  wood.addColorStop(0.22, "#c48a3d");
  wood.addColorStop(0.58, "#8a5127");
  wood.addColorStop(0.84, "#3d1f12");
  wood.addColorStop(0.94, "#c9a050");
  wood.addColorStop(1, "#6a3a16");
  disk(context, 0, 0, radius, wood);
  paintWoodGrain(context, radius);

  ring(context, radius * 0.985, radius * 0.02, "#f0d28a");
  ring(context, radius * 0.91, radius * 0.11, "#140c08");
  ring(context, radius * 0.855, radius * 0.012, "rgba(80,42,18,.85)");
  ring(context, radius * 0.838, radius * 0.028, "#e6c36a");
  drawTrackDiamonds(context, radius * 0.875, radius * 0.026);

  const bowl = context.createRadialGradient(-radius * 0.16, -radius * 0.22, radius * 0.04, 0, 0, radius * 0.59);
  bowl.addColorStop(0, "#4a8a6c");
  bowl.addColorStop(0.38, "#1a5640");
  bowl.addColorStop(0.72, "#0c3224");
  bowl.addColorStop(1, "#05140e");
  disk(context, 0, 0, radius * 0.585, bowl);
  ring(context, radius * 0.575, radius * 0.026, "#d8b056");
  ring(context, radius * 0.552, radius * 0.006, "rgba(255,236,180,.45)");
  ring(context, radius * 0.49, radius * 0.01, "rgba(238,205,123,.42)");
  context.restore();
}

function paintNumberRing(context: CanvasRenderingContext2D, variant: TableVariant, cssSize: number): void {
  const center = cssSize / 2;
  const radius = cssSize * 0.47;
  const pockets = pocketsFor(variant);
  const slice = TAU / pockets.length;
  const outer = radius * 0.82;
  const inner = radius * 0.60;
  context.clearRect(0, 0, cssSize, cssSize);
  context.save();
  context.translate(center, center);
  pockets.forEach((pocket, index) => {
    const centerAngle = -Math.PI / 2 + index * slice;
    const start = centerAngle - slice / 2;
    const end = centerAngle + slice / 2;
    context.beginPath();
    context.arc(0, 0, outer, start, end);
    context.arc(0, 0, inner, end, start, true);
    context.closePath();
    context.fillStyle = pocketColor(pocket);
    context.fill();

    context.beginPath();
    context.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
    context.lineTo(Math.cos(start) * outer, Math.sin(start) * outer);
    context.strokeStyle = "rgba(236, 210, 140, .92)";
    context.lineWidth = Math.max(1.15, radius * 0.0075);
    context.stroke();

    const labelRadius = radius * 0.715;
    context.save();
    context.translate(Math.cos(centerAngle) * labelRadius, Math.sin(centerAngle) * labelRadius);
    let textAngle = centerAngle + Math.PI / 2;
    if (Math.cos(centerAngle) < 0) textAngle += Math.PI;
    context.rotate(textAngle);
    const fontPx = Math.max(11, Math.round(radius * 0.061));
    context.font = `900 ${fontPx}px system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.miterLimit = 2;
    context.lineWidth = Math.max(1.2, fontPx * 0.12);
    context.strokeStyle = "rgba(0,0,0,0.96)";
    context.fillStyle = "#ffffff";
    context.strokeText(pocket, 0, 0);
    context.fillText(pocket, 0, 0);
    context.restore();
  });
  context.restore();
}

function drawWinningPocketHighlight(
  context: CanvasRenderingContext2D,
  variant: TableVariant,
  radius: number,
  frame: WheelFrame,
): void {
  if (!frame.result || frame.settle <= 0.78) return;
  const pockets = pocketsFor(variant);
  const index = pockets.indexOf(frame.result);
  if (index < 0) return;
  const slice = TAU / pockets.length;
  const centerAngle = -Math.PI / 2 + frame.wheelAngle + index * slice;
  const start = centerAngle - slice / 2;
  const end = centerAngle + slice / 2;
  context.save();
  context.beginPath();
  context.arc(0, 0, radius * 0.82, start, end);
  context.arc(0, 0, radius * 0.60, end, start, true);
  context.closePath();
  context.strokeStyle = `rgba(255, 233, 125, ${0.55 + 0.45 * frame.settle})`;
  context.lineWidth = radius * 0.022;
  context.stroke();
  context.restore();
}

function drawFrame(canvas: HTMLCanvasElement, variant: TableVariant, frame: WheelFrame): void {
  const layers = prepareWheelLayers(canvas, variant);
  if (!layers) return;
  const { cssSize, pixelSize, scale } = layers;
  const context = canvas.getContext("2d");
  if (!context) return;
  configureWheelContext(context, scale);
  context.clearRect(0, 0, cssSize, cssSize);
  context.drawImage(layers.base, 0, 0, pixelSize, pixelSize, 0, 0, cssSize, cssSize);

  const center = cssSize / 2;
  const radius = cssSize * 0.47;
  context.save();
  context.translate(center, center);
  context.rotate(frame.wheelAngle);
  context.drawImage(layers.ring, 0, 0, pixelSize, pixelSize, -center, -center, cssSize, cssSize);
  context.restore();

  context.save();
  context.translate(center, center);

  drawWinningPocketHighlight(context, variant, radius, frame);

  const showCenterResult = frame.result !== null && frame.speed <= 0.025 && frame.settle >= 0.99;
  if (showCenterResult) {
    const result = frame.result!;
    const resultRadius = radius * 0.485;
    const resultFill = context.createRadialGradient(-resultRadius * 0.22, -resultRadius * 0.25, 2, 0, 0, resultRadius);
    const baseColor = pocketColor(result);
    resultFill.addColorStop(0, result === "0" || result === "00" ? "#25a76b" : RED.has(result) ? "#e54a43" : "#39413e");
    resultFill.addColorStop(0.68, baseColor);
    resultFill.addColorStop(1, "#07100c");
    disk(context, 0, 0, resultRadius, resultFill);
    ring(context, resultRadius * 0.96, radius * 0.025, "#e1bd68");
    ring(context, resultRadius * 0.82, radius * 0.009, "rgba(255,238,184,.58)");

    const fontPx = Math.max(44, Math.round(radius * (result.length > 1 ? 0.37 : 0.46)));
    context.save();
    context.font = `900 ${fontPx}px system-ui, "Segoe UI", Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.lineWidth = Math.max(4, radius * 0.026);
    context.strokeStyle = "rgba(0,0,0,.78)";
    context.fillStyle = "#fff9e8";
    context.shadowColor = "rgba(255,226,145,.55)";
    context.shadowBlur = radius * 0.055;
    context.strokeText(result, 0, radius * 0.015);
    context.fillText(result, 0, radius * 0.015);
    context.restore();
  } else {
    context.save();
    context.rotate(frame.wheelAngle * 0.55);
    context.fillStyle = "#c89a43";
    for (let arm = 0; arm < 4; arm += 1) {
      context.rotate(Math.PI / 2);
      roundRect(context, -radius * 0.035, -radius * 0.46, radius * 0.07, radius * 0.36, radius * 0.02);
      context.fill();
    }
    context.restore();

    const spindle = context.createRadialGradient(-radius * 0.04, -radius * 0.05, 2, 0, 0, radius * 0.18);
    spindle.addColorStop(0, "#fff2a6");
    spindle.addColorStop(0.35, "#c99c43");
    spindle.addColorStop(1, "#5d361c");
    disk(context, 0, 0, radius * 0.18, spindle);
    disk(context, 0, -radius * 0.04, radius * 0.07, "#f1cf70");
  }

  if (frame.speed > 0.025) {
    for (let tail = 6; tail >= 1; tail -= 1) {
      const angle = frame.ballAngle + tail * 0.035;
      const r = radius * frame.ballRadius;
      context.beginPath();
      context.arc(Math.cos(angle) * r, Math.sin(angle) * r, radius * (0.018 + (6 - tail) * 0.002), 0, TAU);
      context.fillStyle = `rgba(255,248,217,${(7 - tail) * 0.035 * frame.speed})`;
      context.fill();
    }
  }

  const ballX = Math.cos(frame.ballAngle) * radius * frame.ballRadius;
  const ballY = Math.sin(frame.ballAngle) * radius * frame.ballRadius;
  const ballRadius = radius * 0.041;
  context.beginPath();
  context.arc(ballX + ballRadius * 0.18, ballY + ballRadius * 0.42, ballRadius * 0.92, 0, TAU);
  context.fillStyle = "rgba(0,0,0,.35)";
  context.fill();
  const ball = context.createRadialGradient(
    ballX - radius * 0.018,
    ballY - radius * 0.025,
    1,
    ballX,
    ballY,
    ballRadius,
  );
  ball.addColorStop(0, "#ffffff");
  ball.addColorStop(0.55, "#f4ead0");
  ball.addColorStop(1, "#8a7860");
  disk(context, ballX, ballY, ballRadius, ball);

  context.restore();

  context.save();
  context.translate(center, center);
  context.beginPath();
  context.moveTo(0, -radius * 1.035);
  context.lineTo(-radius * 0.065, -radius * 0.91);
  context.lineTo(radius * 0.065, -radius * 0.91);
  context.closePath();
  context.fillStyle = "#ffe47a";
  context.fill();
  context.beginPath();
  context.moveTo(0, -radius * 1.01);
  context.lineTo(-radius * 0.028, -radius * 0.94);
  context.lineTo(radius * 0.028, -radius * 0.94);
  context.closePath();
  context.fillStyle = "#fff6c4";
  context.fill();
  context.restore();
}

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function pocketColor(pocket: string): string {
  if (pocket === "0" || pocket === "00") return "#137347";
  return RED.has(pocket) ? "#b72e27" : "#111714";
}

function paintWoodGrain(context: CanvasRenderingContext2D, radius: number): void {
  context.save();
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.arc(0, 0, radius * 0.835, 0, TAU, true);
  context.clip();
  context.globalAlpha = 0.22;
  for (let i = 0; i < 20; i += 1) {
    const r = radius * (0.845 + (i % 7) * 0.018);
    context.beginPath();
    context.arc(-radius * 0.06, -radius * 0.04, r, 0, TAU);
    context.strokeStyle = i % 2 ? "rgba(48, 22, 8, .7)" : "rgba(232, 196, 118, .45)";
    context.lineWidth = 1;
    context.stroke();
  }
  context.restore();
}

/** Static bowl markers — they do not spin with the numbered ring. */
function drawTrackDiamonds(context: CanvasRenderingContext2D, radius: number, size: number): void {
  for (let i = 0; i < 8; i += 1) {
    const angle = -Math.PI / 2 + (i * TAU) / 8;
    context.save();
    context.rotate(angle);
    context.beginPath();
    context.moveTo(0, -radius - size);
    context.lineTo(size * 0.58, -radius);
    context.lineTo(0, -radius + size);
    context.lineTo(-size * 0.58, -radius);
    context.closePath();
    const gloss = context.createLinearGradient(-size, -radius, size, -radius);
    gloss.addColorStop(0, "#7a5618");
    gloss.addColorStop(0.45, "#fff4c8");
    gloss.addColorStop(1, "#9a6e22");
    context.fillStyle = gloss;
    context.fill();
    context.restore();
  }
}

function disk(context: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string | CanvasGradient): void {
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.fillStyle = fill;
  context.fill();
}

function ring(context: CanvasRenderingContext2D, radius: number, width: number, color: string): void {
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
