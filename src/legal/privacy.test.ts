import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { LOCALE_IDS } from "../i18n/localeMeta.ts";
import {
  allPrivacyDocuments,
  privacyDocument,
  privacyStorePath,
} from "./privacy.ts";

function test(name: string, body: () => void): void {
  try {
    body();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("privacy copy covers every UI locale", () => {
  const docs = allPrivacyDocuments();
  assert.equal(docs.length, LOCALE_IDS.length);
  const expected = privacyDocument("en").sections.length;
  for (const locale of LOCALE_IDS) {
    const doc = privacyDocument(locale);
    assert.equal(doc.locale, locale);
    assert.ok(doc.title.trim());
    assert.ok(doc.noticeLead.trim());
    assert.ok(doc.noticeRest.trim());
    assert.equal(doc.sections.length, expected, locale);
    for (const section of doc.sections) {
      assert.ok(section.heading.trim(), locale);
      assert.ok(section.body.trim(), locale);
    }
  }
});

test("English privacy keeps Play / PWA legal phrases", () => {
  const en = privacyDocument("en");
  const blob = `${en.noticeLead} ${en.noticeRest} ${en.sections.map((section) => section.body).join(" ")}`;
  assert.match(blob, /virtual points only/i);
  assert.match(blob, /does not collect, transmit, sell or share personal data/);
});

test("each language has a standalone generated store page", () => {
  for (const locale of LOCALE_IDS) {
    const file = `public/${privacyStorePath(locale)}`;
    assert.equal(existsSync(file), true, file);
    const html = readFileSync(file, "utf8");
    const doc = privacyDocument(locale);
    assert.match(html, new RegExp(`lang="${doc.htmlLang}"`));
    assert.ok(html.includes(doc.noticeLead));
    assert.ok(!html.includes('id="italiano"'), file);
  }
});
