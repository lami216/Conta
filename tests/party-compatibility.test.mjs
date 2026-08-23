import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolvePartyType } from "../app/domain.ts";

test("legacy party roles resolve centrally without changing valid roles",()=>{const parties=[{id:"a"},{id:"b",partyType:"supplier"},{id:"c",partyType:"customer"}];assert.deepEqual(parties.map(resolvePartyType),["supplier","supplier","customer"]);assert.deepEqual(parties.filter(p=>resolvePartyType(p)==="customer").map(p=>p.id),["c"]);assert.deepEqual(parties.filter(p=>resolvePartyType(p)==="supplier").map(p=>p.id),["a","b"]);});

test("POS and party workspaces retain compact role-safe structure and empty rows",async()=>{const source=await readFile(new URL("../app/conta-app.tsx",import.meta.url),"utf8"),css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");assert.match(source,/className="pos-payment-row"/);assert.match(source,/resolvePartyType\(p\) === "customer"/);assert.match(source,/variant="compact" ariaLabel="العميل"/);assert.match(source,/لا يوجد عملاء حتى الآن/);assert.match(source,/لا يوجد موردون/);assert.match(css,/\.pos-payment-row \{[^}]*grid-template-columns: 60px 86px minmax\(135px, 1fr\)/s);assert.match(css,/\.section-parties, \.section-customers, \.section-suppliers/);});

test("comprehensive screen and print omit cash metrics and include bank detail",async()=>{const source=await readFile(new URL("../app/conta-app.tsx",import.meta.url),"utf8");assert.doesNotMatch(source,/إجمالي الداخل إلى الخزنة|إجمالي الخارج من الخزنة|رصيد الخزنة/);assert.match(source,/aria-expanded=\{bankOpen\}/);assert.match(source,/className="bank-detail print-only"/);assert.match(source,/فواتير البيع/);assert.doesNotMatch(source,/قيمة الفاتورة \(MRU\)|التكلفة \(MRU\)|الربح \(MRU\)/);assert.match(source,/<th>رقم<\/th><th>نوع الفاتورة<\/th><th>رقم الفاتورة/);});
