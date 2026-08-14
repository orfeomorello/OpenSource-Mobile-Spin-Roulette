import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP_ID = "io.mobilespinroulette.app";
const FELT = "#06100d";
const INK = "#081611";
const GOLD = "#d6b66f";

function writeIfDifferent(file, next) {
  const previous = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (previous === next) return;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, next);
}

const gradlePath = path.join("android", "app", "build.gradle");
if (!existsSync(gradlePath)) {
  throw new Error("android/app/build.gradle is missing — run npx cap add android first");
}

let gradle = readFileSync(gradlePath, "utf8");
if (!gradle.includes(`applicationId "${APP_ID}"`)) {
  gradle = gradle.replace(/applicationId\s+"[^"]+"/, `applicationId "${APP_ID}"`);
}
if (!gradle.includes("MOBILESPINROULETTE_KEYSTORE")) {
  throw new Error("android/app/build.gradle is missing the release keystore hook; restore it from git");
}
writeIfDifferent(gradlePath, gradle);

const manifestPath = path.join("android", "app", "src", "main", "AndroidManifest.xml");
let manifest = readFileSync(manifestPath, "utf8");
if (manifest.includes("android:screenOrientation=")) {
  manifest = manifest.replace(/android:screenOrientation="[^"]*"/, 'android:screenOrientation="fullUser"');
} else {
  manifest = manifest.replace(
    'android:launchMode="singleTask"',
    'android:launchMode="singleTask"\n            android:screenOrientation="fullUser"',
  );
}
if (!manifest.includes('android:usesCleartextTraffic="false"')) {
  manifest = manifest.replace("<application", '<application\n        android:usesCleartextTraffic="false"');
}
if (manifest.includes("android:windowSoftInputMode=")) {
  manifest = manifest.replace(/android:windowSoftInputMode="[^"]*"/, 'android:windowSoftInputMode="adjustResize"');
} else {
  manifest = manifest.replace(
    'android:screenOrientation="fullUser"',
    'android:screenOrientation="fullUser"\n            android:windowSoftInputMode="adjustResize"',
  );
}
writeIfDifferent(manifestPath, manifest);

writeIfDifferent(
  path.join("android", "app", "src", "main", "res", "values", "colors.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${INK}</color>
    <color name="colorPrimaryDark">${FELT}</color>
    <color name="colorAccent">${GOLD}</color>
</resources>
`,
);

writeIfDifferent(
  path.join("android", "app", "src", "main", "res", "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${INK}</color>
</resources>
`,
);

const stringsPath = path.join("android", "app", "src", "main", "res", "values", "strings.xml");
let strings = readFileSync(stringsPath, "utf8");
strings = strings.replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">MobileSpinRoulette</string>');
strings = strings.replace(/<string name="title_activity_main">[^<]*<\/string>/, '<string name="title_activity_main">MobileSpinRoulette</string>');
strings = strings.replace(/<string name="package_name">[^<]*<\/string>/, `<string name="package_name">${APP_ID}</string>`);
strings = strings.replace(/<string name="custom_url_scheme">[^<]*<\/string>/, `<string name="custom_url_scheme">${APP_ID}</string>`);
writeIfDifferent(stringsPath, strings);

const stylesPath = path.join("android", "app", "src", "main", "res", "values", "styles.xml");
let styles = readFileSync(stylesPath, "utf8");
styles = styles.replace(
  /<item name="android:background">@drawable\/splash<\/item>/,
  '<item name="android:background">@color/colorPrimaryDark</item>',
);
writeIfDifferent(stylesPath, styles);

const iconSource = path.join("public", "roulette-icon-512.png");
if (!existsSync(iconSource)) {
  throw new Error("public/roulette-icon-512.png is missing — run npm run generate:icons");
}
for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  const dir = path.join("android", "app", "src", "main", "res", `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });
  for (const name of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
    copyFileSync(iconSource, path.join(dir, name));
  }
}

console.log("Patched Android applicationId, orientation, labels and launcher icons");
