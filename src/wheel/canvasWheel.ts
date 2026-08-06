import wheelConfig from "../../config/wheel-spin.json" with { type: "json" };
import type { SpinResult, TableVariant } from "../core/types.ts";

const TAU = Math.PI * 2;
const RED = new Set(["1", "3", "5", "7", "9", "12", "14", "16", "18", "19", "21", "23", "25", "27", "30", "32", "34", "36"]);

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

export function getSpinEndAngle(fromAngle: number, variant: TableVariant, result: string, turns: number): number {
  const pockets = pocketsFor(variant);
  const index = Math.max(0, pockets.indexOf(result));
  const targetPhase = positiveAngle(-index * (TAU / pockets.length));
  const phaseDelta = positiveAngle(targetPhase - positiveAngle(fromAngle));
  return fromAngle + Math.max(2, turns) * TAU + phaseDelta;
}

export function drawStaticWheel(canvas: HTMLCanvasElement, variant: TableVariant, wheelAngle = 0, result: string | null = null): void {
  drawFrame(canvas, variant, {
    wheelAngle,
    ballAngle: -Math.PI / 2,
    ballRadius: 0.344,
    speed: 0,
    result,
    settle: result ? 1 : 0,
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
  const ballEnd = -Math.PI / 2;
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
      const pocketAngle = -Math.PI / 2 + wheelAngle + winnerIndex * (TAU / pockets.length);
      const nearbyPocket = pocketAngle + Math.round((ballAngle - pocketAngle) / TAU) * TAU;
      const lock = smoothstep((t - lockStart) / (1 - lockStart));
      ballAngle += (nearbyPocket - ballAngle) * lock;
    }

    const dropStart = 0.62;
    const drop = t <= dropStart ? 0 : smoothstep((t - dropStart) / (1 - dropStart));
    const bounce = drop > 0 ? Math.sin(drop * Math.PI * 9) * (1 - drop) * 0.018 : 0;
    const ballRadius = 0.438 + (0.344 - 0.438) * drop + bounce;
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

function drawFrame(canvas: HTMLCanvasElement, variant: TableVariant, frame: WheelFrame): void {
  const rect = canvas.getBoundingClientRect();
  const cssSize = Math.max(240, Math.min(rect.width || 480, rect.height || rect.width || 480));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pixelSize = Math.round(cssSize * dpr);
  if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
    canvas.width = pixelSize;
    canvas.height = pixelSize;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssSize, cssSize);

  const center = cssSize / 2;
  const radius = cssSize * 0.47;
  context.save();
  context.translate(center, center);

  context.beginPath();
  context.ellipse(0, radius * 0.12, radius * 1.03, radius * 0.97, 0, 0, TAU);
  context.fillStyle = "rgba(0,0,0,.62)";
  context.filter = "blur(10px)";
  context.fill();
  context.filter = "none";

  const wood = context.createRadialGradient(0, 0, radius * 0.62, 0, 0, radius);
  wood.addColorStop(0, "#d7a64d");
  wood.addColorStop(0.68, "#8a5127");
  wood.addColorStop(0.86, "#3d1f12");
  wood.addColorStop(1, "#d9ae59");
  disk(context, 0, 0, radius, wood);
  ring(context, radius * 0.91, radius * 0.12, "#130c08");
  ring(context, radius * 0.84, radius * 0.025, "#e1b95f");

  const pockets = pocketsFor(variant);
  const slice = TAU / pockets.length;
  const outer = radius * 0.82;
  const inner = radius * 0.60;
  context.save();
  context.rotate(frame.wheelAngle);
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
    context.strokeStyle = "rgba(234,204,129,.72)";
    context.lineWidth = Math.max(1, radius * 0.006);
    context.stroke();

    if (frame.result === pocket && frame.settle > 0.78) {
      context.save();
      context.shadowBlur = 18 * frame.settle;
      context.shadowColor = "#fff088";
      context.strokeStyle = "#ffe97d";
      context.lineWidth = radius * 0.025;
      context.stroke();
      context.restore();
    }

    const labelRadius = radius * 0.715;
    context.save();
    context.translate(Math.cos(centerAngle) * labelRadius, Math.sin(centerAngle) * labelRadius);
    let textAngle = centerAngle + Math.PI / 2;
    if (Math.cos(centerAngle) < 0) textAngle += Math.PI;
    context.rotate(textAngle);
    context.fillStyle = "#fff8df";
    context.font = `900 ${Math.max(7, radius * 0.052)}px "Arial Narrow", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "#000";
    context.shadowBlur = 2;
    context.fillText(pocket, 0, 0);
    context.restore();
  });
  context.restore();

  const bowl = context.createRadialGradient(-radius * 0.12, -radius * 0.18, radius * 0.04, 0, 0, radius * 0.59);
  bowl.addColorStop(0, "#376f58");
  bowl.addColorStop(0.55, "#123f30");
  bowl.addColorStop(1, "#061710");
  disk(context, 0, 0, radius * 0.585, bowl);
  ring(context, radius * 0.575, radius * 0.025, "#d3a54c");
  ring(context, radius * 0.49, radius * 0.012, "rgba(238,205,123,.5)");

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
  context.save();
  context.shadowColor = "#fff";
  context.shadowBlur = 10;
  const ball = context.createRadialGradient(ballX - radius * 0.018, ballY - radius * 0.025, 1, ballX, ballY, radius * 0.042);
  ball.addColorStop(0, "#ffffff");
  ball.addColorStop(0.6, "#f6ebc8");
  ball.addColorStop(1, "#8d7b55");
  disk(context, ballX, ballY, radius * 0.041, ball);
  context.restore();

  context.restore();

  context.save();
  context.translate(center, center);
  context.beginPath();
  context.moveTo(0, -radius * 1.035);
  context.lineTo(-radius * 0.065, -radius * 0.91);
  context.lineTo(radius * 0.065, -radius * 0.91);
  context.closePath();
  context.fillStyle = "#ffe47a";
  context.shadowColor = "#ffcf42";
  context.shadowBlur = 12;
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
