import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../app/conta-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
test("remaining ERP pages use framed regions without legacy title bands", () => {
  const expenses = between("function Expenses", "function Banks");
  for (const title of ["مصروف جديد", "المصاريف المستحقة", "سجل المصاريف"]) assert.match(expenses, new RegExp(`FramedSection title=.*${title}`));
  assert.doesNotMatch(expenses, /section-title/);
  const warehouses = between("function Warehouses", "function ProductMovementPanel");
  assert.match(warehouses, /FramedSection title="المخزن"/);
  assert.match(warehouses, /FramedSection title="جرد المخزن"/);
  for (const component of [between("function Transfer", "function Adjustment"), between("function Adjustment", "function Records")]) assert.doesNotMatch(component, /<Heading/);
});
test("parties and banks use framed ERP tables", () => {
  const parties = between("function Parties", "function PartyPage");
  assert.match(parties, /FramedSection title="العملاء والموردون"/);
  assert.doesNotMatch(parties, /زبون ومورد/);
  const banks = between("function Banks", "function PaymentAccountDialog");
  assert.match(banks, /aria-label="وسائل الدفع"/);
  assert.doesNotMatch(banks, /account-card/);
});
test("settings uses full framed workspace with an explicit accent", () => {
  const settings = between("function SettingsPage", "function FramedSection");
  for (const title of ["النسخ الاحتياطي", "الاستعادة والاستيراد", "سجل عمليات الاستيراد"]) assert.match(settings, new RegExp(`FramedSection title="${title}"`));
  assert.doesNotMatch(settings, /compact-counts|settings-title/);
  assert.doesNotMatch(css, /max-width:\s*1120px/);
  assert.match(css, /\.section-settings\s*\{[^}]*--section-color:\s*var\(--color-settings\)/);
  assert.doesNotMatch(css, /\.account-card/);
});
