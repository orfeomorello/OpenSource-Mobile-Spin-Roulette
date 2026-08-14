import { existsSync, readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const license = readFileSync("LICENSE", "utf8");
assert(license.includes("GNU GENERAL PUBLIC LICENSE"), "LICENSE must be the GNU GPL");
assert(license.includes("Version 3, 29 June 2007"), "LICENSE must be GPL version 3");
assert(license.includes("Everyone is permitted to copy and distribute verbatim copies"), "LICENSE must be the official GPL text");
assert(license.includes("changing it is not allowed."), "LICENSE must remain the unmodified GPL text");

const notice = readFileSync("NOTICE", "utf8");
assert(notice.includes("GPL-3.0-or-later"), "NOTICE must declare GPL-3.0-or-later for the software");
assert(notice.includes("either version 3 of the License, or"), "NOTICE must include the GNU how-to-apply or-later grant");
assert(notice.includes("Pixabay Content License"), "NOTICE must keep the Pixabay tracks off the GPL");
assert(notice.includes("SIL Open Font License"), "NOTICE must keep Inter under the OFL");
assert(notice.includes("CC0"), "NOTICE must record the CC0 menu loop");
assert(notice.includes("do not relicense third-party") || notice.includes("does not relicense"), "NOTICE must say the GPL does not relicense bundled media");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert(pkg.license === "GPL-3.0-or-later", "package.json license must be GPL-3.0-or-later");

const readme = readFileSync("README.md", "utf8");
assert(readme.includes("GPL-3.0-or-later"), "README must name GPL-3.0-or-later");
assert(readme.includes("./NOTICE"), "README must point at NOTICE");
assert(readme.includes("Pixabay Content License"), "README must not hide the Pixabay license");

const credits = readFileSync("public/audio/CREDITS.md", "utf8");
assert(/not licensed under the GNU GPL/i.test(credits), "CREDITS.md must say the tracks are not GPL");

assert(existsSync("src/assets/fonts/OFL.txt"), "Inter OFL text must remain next to the font");

const stage = readFileSync("scripts/stage-worker.mjs", "utf8");
assert(stage.includes("LICENSE"), "production build must copy LICENSE into dist");
assert(stage.includes("NOTICE"), "production build must copy NOTICE into dist");
assert(stage.includes("OFL.txt"), "production build must copy the Inter OFL into dist");

const zip = readFileSync("scripts/zip-itch.mjs", "utf8");
assert(zip.includes('"LICENSE"'), "itch zip must include LICENSE");
assert(zip.includes('"NOTICE"'), "itch zip must include NOTICE");
assert(zip.includes('"OFL.txt"'), "itch zip must include the Inter OFL");

console.log("✓ license split, NOTICE, package.json and distribution copies are valid");
