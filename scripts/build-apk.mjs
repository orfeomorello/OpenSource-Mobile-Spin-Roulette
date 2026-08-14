import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const bundle = process.argv.includes("--bundle");
const releaseApk = process.argv.includes("--release");
const skipWeb = process.argv.includes("--skip-web");
const root = process.cwd();
if (bundle && releaseApk) {
  fail("use --bundle or --release, not both");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed`);
  }
}

function firstExisting(candidates) {
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

if (!existsSync(path.join("android", "app", "build.gradle"))) {
  fail("android/ is missing. From the repo root run: npx cap add android && node scripts/patch-android.mjs");
}

if (!skipWeb) {
  run("npm.cmd", ["run", "build"]);
}
if (!existsSync(path.join("dist", "index.html"))) {
  fail("dist/index.html is missing. The APK packages the Vite production build.");
}

run("npx.cmd", ["cap", "sync", "android"]);
run("node", ["scripts/patch-android.mjs"]);

const sdkDir = firstExisting([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk"),
  path.join(root, ".android-sdk"),
]);
if (!sdkDir) {
  fail([
    "Android SDK not found.",
    "Install Android Studio (or the command-line tools) and set ANDROID_HOME.",
    "Typical Windows path: %LOCALAPPDATA%\\Android\\Sdk",
  ].join("\n"));
}

function javaMajor(home) {
  const binary = existsSync(path.join(home, "bin", "java.exe"))
    ? path.join(home, "bin", "java.exe")
    : path.join(home, "bin", "java");
  const result = spawnSync(binary, ["-version"], { encoding: "utf8" });
  const text = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
  const match = text.match(/version "(\d+)/);
  return match ? Number(match[1]) : 0;
}

function hasJavac(home) {
  return existsSync(path.join(home, "bin", "javac.exe")) || existsSync(path.join(home, "bin", "javac"));
}

const javaHome = [
  process.env.JAVA_HOME,
  process.env.ANDROID_STUDIO_JDK,
  "C:\\Program Files\\Microsoft\\jdk-21.0.12.8-hotspot",
  "C:\\Program Files\\Microsoft\\jdk-21",
  "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.12.8-hotspot",
  "C:\\Program Files\\Eclipse Adoptium\\jdk-21",
  "C:\\Program Files\\Java\\jdk-21",
  "C:\\Program Files\\Android\\Android Studio\\jbr",
].find((candidate) => candidate && existsSync(candidate) && hasJavac(candidate) && javaMajor(candidate) <= 21);

if (!javaHome) {
  fail([
    "JDK 21 with javac is required. Gradle 8.14 cannot use Android Studio's JBR 25.",
    "Install Microsoft OpenJDK 21 and set JAVA_HOME to that folder.",
  ].join("\n"));
}

writeFileSync(
  path.join("android", "local.properties"),
  `sdk.dir=${sdkDir.replaceAll("\\", "\\\\")}\n`,
);

const env = {
  ...process.env,
  ANDROID_HOME: sdkDir,
  ANDROID_SDK_ROOT: sdkDir,
  JAVA_HOME: javaHome,
};

const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const signed = bundle || releaseApk;
if (signed) {
  const keystore = process.env.MOBILESPINROULETTE_KEYSTORE;
  if (!keystore || !existsSync(keystore)) {
    fail("npm run aab / apk:release needs MOBILESPINROULETTE_KEYSTORE (and alias / passwords).");
  }
}

const task = bundle ? "bundleRelease" : releaseApk ? "assembleRelease" : "assembleDebug";
run(gradle, [task, "--quiet"], { cwd: path.join(root, "android"), env });

const outputDir = path.join(root, "android-dist");
mkdirSync(outputDir, { recursive: true });

if (bundle) {
  const from = path.join("android", "app", "build", "outputs", "bundle", "release", "app-release.aab");
  const to = path.join(outputDir, "MobileSpinRoulette.aab");
  if (!existsSync(from)) fail(`Expected bundle missing: ${from}`);
  copyFileSync(from, to);
  console.log(`Wrote ${to}`);
} else if (releaseApk) {
  const from = path.join("android", "app", "build", "outputs", "apk", "release", "app-release.apk");
  const to = path.join(outputDir, "MobileSpinRoulette.apk");
  if (!existsSync(from)) fail(`Expected release APK missing: ${from}`);
  copyFileSync(from, to);
  console.log(`Wrote ${to}`);
  console.log("Release APK is for GitHub Releases / sideload. Play Console still wants the AAB.");
} else {
  const from = path.join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  const to = path.join(outputDir, "MobileSpinRoulette-debug.apk");
  if (!existsSync(from)) fail(`Expected APK missing: ${from}`);
  copyFileSync(from, to);
  console.log(`Wrote ${to}`);
  console.log("Debug APK is for local tests. GitHub Releases want npm run apk:release. Play wants npm run aab.");
}
