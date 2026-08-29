import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
test("desktop navigation has eight unique destinations with reports before settings",async()=>{const source=await readFile(new URL("../app/conta-app.tsx",import.meta.url),"utf8"),match=source.match(/MAIN_NAV_ORDER = \[([^\]]+)\]/);assert.ok(match);const entries=[...match[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);assert.deepEqual(entries,["pos","invoices","warehouses","products","parties","banks","reports","settings"]);assert.equal(new Set(entries).size,entries.length);});

test("submenu current states require their parent view without resetting remembered selections", async () => {
  const source = await readFile(new URL("../app/conta-app.tsx", import.meta.url), "utf8");

  assert.match(source, /className=\{view==="banks"&&bankTab===item\.id\?"active":""\}/);
  assert.match(source, /aria-current=\{view === "reports" && reportType === id \? "page" : undefined\}/);
  assert.match(source, /className=\{view === "reports" && reportType === id \? "active" : ""\}/);

  assert.match(source, /invoiceNav[\s\S]*?className=\{view === n\.id \? "active" : ""\}/);
  assert.match(source, /warehouseNav[\s\S]*?className=\{view === n\.id \? "active" : ""\}/);
  assert.match(source, /party-nav-popover[\s\S]*?className=\{view===item\.id\?"active":""\}/);

  const navigateBody = source.match(/const navigate = \(id: View\) => \{([\s\S]*?)\n  \};/)?.[1];
  assert.ok(navigateBody);
  assert.doesNotMatch(navigateBody, /setBankTab|setReportType/);
});

test("product and report tables use uncapped shared scroll viewports", async () => {
  const source = await readFile(new URL("../app/conta-app.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(source, /slice\(0,\s*20\)/);
  assert.match(source, /FramedSection title="قائمة المنتجات" className="scroll-panel product-management"[\s\S]{0,160}erp-table-wrap product-table-viewport/);
  assert.match(css, /product-table-viewport\{height:100%;overflow:auto;contain:paint;background:#fff\}/);
  assert.match(css, /erp-table thead th\{background:var\(--section-color\);background-clip:padding-box\}/);
});

test("party ledger filters real compatible roles and transient documents overlay mounted content", async () => {
  const source = await readFile(new URL("../app/conta-app.tsx", import.meta.url), "utf8");
  assert.match(source, /filter\(p=>resolvePartyType\(p\)===partyTypeFilter\)/);
  assert.match(source, /search:`\$\{p\.name\} \$\{p\.phone\?\?""\}`/);
  assert.match(source, /setPartyTypeFilter\("supplier"\);setPartyId\(""\);setResult\(null\)/);
  assert.doesNotMatch(source, /\) : doc \? \(/);
  assert.match(source, /\{doc && <div className="modal-overlay"/);
});
