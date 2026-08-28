import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterDocumentsByDate, localBusinessDay, sortDocumentsBySequence } from "../app/history-filters.ts";

const document = (id, sequence, day) => ({ id, sequence, occurredAt: `${day}T12:00:00.000Z`, businessDate: day });

test("history date scope defaults can use today's local business day", () => {
  assert.match(localBusinessDay(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(filterDocumentsByDate([document("today", 1, localBusinessDay()), document("old", 2, "2020-01-01")], localBusinessDay(), localBusinessDay(), false)[0].id, "today");
});

test("all-time ignores dates and a subsequent date-mode filter applies immediately", () => {
  const docs = [document("new", 2, "2026-08-27"), document("old", 1, "2020-01-01")];
  assert.deepEqual(filterDocumentsByDate(docs, "2026-08-27", "2026-08-27", true).map(item => item.id), ["new", "old"]);
  assert.deepEqual(filterDocumentsByDate(docs, "2020-01-01", "2020-01-01", false).map(item => item.id), ["old"]);
});

test("invoice history has no 100-row cap and orders numeric sequences newest-first", () => {
  const docs = Array.from({ length: 125 }, (_, index) => document(String(index), index + 1, "2026-08-27"));
  const ordered = sortDocumentsBySequence([...docs, document("legacy-a", undefined, "2026-08-27"), document("legacy-b", undefined, "2026-08-27")]);
  assert.equal(ordered.length, 127);
  assert.equal(ordered[0].sequence, 125);
  assert.deepEqual(ordered.slice(-2).map(item => item.id), ["legacy-a", "legacy-b"]);
});

test("expense defaults and all-time controls remain explicit", () => {
  const source = readFileSync(new URL("../app/conta-app.tsx", import.meta.url), "utf8");
  const expenses = source.slice(source.indexOf("function Expenses"), source.indexOf("function Banks"));
  assert.match(expenses, /expense-date", localBusinessDay\(\)/);
  assert.match(expenses, /useState\(today\).*historyAllTime/s);
  assert.match(expenses, /onAllTime=\{\(\) => setHistoryAllTime\(true\)\}/);
});

test("product picker and document overlay regression checkpoints remain mounted", () => {
  const source = readFileSync(new URL("../app/conta-app.tsx", import.meta.url), "utf8");
  const picker = source.slice(source.indexOf("function ProductSearchPicker"), source.indexOf("const SearchProducts"));
  for (const behavior of ["barcode === term", "onDoubleClick={() => add(product)}", "stockInWarehouse", "isProductExpired", "sellingPrice"]) assert.match(picker, new RegExp(behavior.replace(/[(){}]/g, "\\$&")));
  assert.match(source, /\{doc && <div className="modal-overlay"/);
  assert.doesNotMatch(source, /\) : doc \? \(/);
});
