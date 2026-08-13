import { cappedWheelDpr, MAX_WHEEL_DPR, resolveWheelAnimationDuration } from "./canvasWheel.ts";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function test(name: string, body: () => void): void {
  try {
    body();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("wheel DPR is capped at 2×", () => {
  assert(MAX_WHEEL_DPR === 2, `unexpected cap ${MAX_WHEEL_DPR}`);
  assert(cappedWheelDpr(3) === 2, "3× display should render at 2×");
  assert(cappedWheelDpr(2.625) === 2, "fractional HiDPI should render at 2×");
});

test("wheel DPR preserves lower-density displays and sanitizes invalid input", () => {
  assert(cappedWheelDpr(1) === 1, "1× display should stay 1×");
  assert(cappedWheelDpr(1.5) === 1.5, "1.5× display should stay 1.5×");
  assert(cappedWheelDpr(Number.NaN) === 1, "NaN should fall back to 1×");
  assert(cappedWheelDpr(0) === 1, "zero should fall back to 1×");
});

test("wheel animation follows the explicit in-app setting", () => {
  assert(resolveWheelAnimationDuration(5400, true) === 5400, "enabled animation should keep the full spin duration");
  assert(resolveWheelAnimationDuration(5400, false) === 160, "disabled animation should use the short transition");
  assert(resolveWheelAnimationDuration(Number.NaN, true) === 160, "invalid duration should use a safe fallback");
});

console.log("\nCanvasWheel tests passed.");
