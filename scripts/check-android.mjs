import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const APP_ID = "io.mobilespinroulette.app";

const configSource = readFileSync("capacitor.config.ts", "utf8");
assert(configSource.includes(`appId: "${APP_ID}"`), `capacitor.config.ts must use ${APP_ID}`);
assert(configSource.includes('webDir: "dist"'), "Capacitor must package the Vite dist/ folder");
assert(!/server\s*:\s*\{[^}]*\burl\s*:/.test(configSource), "Capacitor must not load a remote server URL");
assert(!configSource.includes("orfeomorello"), "Capacitor config must not contain orfeomorello");

const main = readFileSync(path.join("src", "main.ts"), "utf8");
assert(main.includes("isNativeShell()"), "main.ts must detect the Capacitor shell");
assert(main.includes("!isNativeShell()"), "the service worker must stay off in the APK");
assert(main.includes("@capacitor/app"), "the Android back button must use @capacitor/app");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert(pkg.scripts?.apk === "node scripts/build-apk.mjs", "package.json must expose npm run apk");
assert(pkg.scripts?.["apk:release"] === "node scripts/build-apk.mjs --release", "package.json must expose npm run apk:release");
assert(pkg.scripts?.aab === "node scripts/build-apk.mjs --bundle", "package.json must expose npm run aab");
assert(existsSync(path.join("scripts", "build-apk.mjs")), "missing scripts/build-apk.mjs");

const gradle = path.join("android", "app", "build.gradle");
assert(existsSync(gradle), "android/ is missing — run npx cap add android");
const gradleSource = readFileSync(gradle, "utf8");
assert(gradleSource.includes(`applicationId "${APP_ID}"`), `android applicationId must stay ${APP_ID}`);
assert(!gradleSource.includes("orfeomorello"), "Android Gradle files must not contain orfeomorello");

const manifest = readFileSync(path.join("android", "app", "src", "main", "AndroidManifest.xml"), "utf8");
assert(
  manifest.includes('android:screenOrientation="fullUser"')
    || manifest.includes('android:screenOrientation="fullSensor"')
    || manifest.includes('android:screenOrientation="unspecified"'),
  "the main activity must allow portrait and landscape",
);
assert(manifest.includes("orientation|keyboardHidden|keyboard|screenSize"), "configChanges must keep the WebView across rotation");
assert(manifest.includes('android:windowSoftInputMode="adjustResize"'), "the activity must resize when the keyboard opens");

assert(configSource.includes('adjustMarginsForEdgeToEdge: "disable"'), "Capacitor must not add extra system-bar margins in the APK");
const activity = readFileSync(path.join("android", "app", "src", "main", "java", "io", "mobilespinroulette", "app", "MainActivity.java"), "utf8");
assert(activity.includes("WindowInsetsControllerCompat"), "MainActivity must hide the Android system bars");
assert(activity.includes("BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE"), "hidden system bars must return with a swipe");

console.log("✓ Capacitor Android id, local webDir and apk command are valid");
