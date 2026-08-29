import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/conta-app.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("PrivateMoney is independently masked by default and has an accessible toggle", () => {
  const component = source.slice(source.indexOf("export function PrivateMoney"), source.indexOf("function PermissionNavItem"));
  assert.match(component, /useState\(false\)/);
  assert.match(component, /"\*\*\*\*\*\* MRU"/);
  assert.match(component, /revealed\?money\(value\)/);
  assert.match(component, /setRevealed\(value=>!value\)/);
  assert.match(component, /"إظهار المبلغ"/);
  assert.match(component, /"إخفاء المبلغ"/);
  assert.match(component, /aria-label=\{revealed\?undefined:"المبلغ مخفي"\}/);
  assert.match(component, /<EyeOff/);
  assert.match(component, /<Eye /);
});

test("masked money is neutral, revealed tones are semantic, and print keeps real money", () => {
  assert.match(css, /\.money-masked\s*\{[^}]*color:#475467!important/);
  assert.match(css, /\.money-positive\s*\{[^}]*#15803d/);
  assert.match(css, /\.money-negative\s*\{[^}]*#b91c1c/);
  assert.match(source, /className="financial-amount print-only">\{money\(value\)\}/);
  assert.match(css, /font-family:"Bahnschrift","Segoe UI",Arial,Tahoma,sans-serif/);
  assert.match(css, /font-variant-numeric:tabular-nums lining-nums/);
});

test("privacy is used in banks, party displays and report money while inputs and counts stay readable", () => {
  const banks = source.slice(source.indexOf("function Banks"), source.indexOf("function PaymentAccountDialog"));
  const parties = source.slice(source.indexOf("function Parties"), source.indexOf("export function periodQuantity"));
  const reports = source.slice(source.indexOf("function Reports"), source.indexOf("type OfficialPresentation"));
  assert.ok((banks.match(/<PrivateMoney/g) ?? []).length >= 8);
  assert.ok((parties.match(/<PrivateMoney/g) ?? []).length >= 8);
  assert.match(reports, /monetaryKeys\.has\(key\)\?<PrivateMoney/);
  assert.match(banks, /<label>المبلغ<Num value=\{amount\}/);
  assert.match(banks, /<label>المبلغ<Num value=\{adjustmentAmount\}/);
  assert.match(parties, /:number\(summary\?\.supplierInvoiceCount\?\?0\)/);
  assert.doesNotMatch(source.slice(source.indexOf("function OfficialRecordSheet"), source.indexOf("function PrintableDocument")), /PrivateMoney|\*\*\*\*\*\*/);
});
