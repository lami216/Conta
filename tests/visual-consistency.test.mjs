import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../app/conta-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("../app/api/bootstrap/route.ts", import.meta.url), "utf8");
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
test("remaining ERP pages use framed regions without legacy title bands", () => {
  const expenses = between("function Expenses", "function Banks");
  for (const title of ["مصروف جديد", "المصاريف المستحقة", "سجل المصاريف"]) assert.match(expenses, new RegExp(`FramedSection title=.*${title}`));
  assert.doesNotMatch(expenses, /section-title/);
  const warehouses = between("function Warehouses", "function ProductMovementPanel");
  assert.match(warehouses, /FramedSection title="جرد المخازن"/);
  assert.doesNotMatch(warehouses, /FramedSection title="المخزن"/);
  for (const component of [between("function Transfer", "function Adjustment"), between("function Adjustment", "function Records")]) assert.doesNotMatch(component, /<Heading/);
});
test("parties and banks use framed ERP tables", () => {
  const parties = between("function Parties", "function PartyPage");
  assert.match(parties, /partyType.*customer.*supplier/);
  assert.doesNotMatch(parties, /زبون ومورد/);
  const banks = between("function Banks", "function PaymentAccountDialog");
  assert.match(banks, /aria-label="وسائل الدفع"/);
  assert.doesNotMatch(banks, /account-card/);
});
test("settings uses full framed workspace with an explicit accent", () => {
  const settings = between("function SettingsPage", "function FramedSection");
  for (const title of ["النسخ الاحتياطي", "الاستعادة والاستيراد"]) assert.match(settings, new RegExp(`FramedSection title="${title}"`));
  assert.doesNotMatch(settings, /سجل عمليات الاستيراد|\/api\/settings\/import-runs/);
  assert.match(settings, /className="settings-utility-row"/);
  assert.match(settings, /<UsersPermissions utilities=\{utilities\}/);
  assert.match(app, /<th>رقم<\/th><th>اسم الشاشة<\/th>\{\(\["view","create","edit","delete"\]/);
  assert.doesNotMatch(app, /<th>الصلاحيات<\/th>/);
  assert.match(css, /\.users-permissions-layout\{[^}]*grid-template-columns:minmax\(0,1\.85fr\) minmax\(340px,1fr\)/);
  assert.match(css, /\.settings-utility-row\{[^}]*grid-template-rows:auto auto auto/);
  assert.doesNotMatch(settings, /compact-counts|settings-title/);
  assert.doesNotMatch(css, /max-width:\s*1120px/);
  assert.match(css, /\.section-settings\s*\{[^}]*--section-color:\s*var\(--color-settings\)/);
  assert.doesNotMatch(css, /\.account-card/);
});
test("warehouse summary uses stable metrics and controlled popover overflow", () => {
  const warehouses = between("function Warehouses", "function ProductMovementPanel");
  for (const label of ["عدد المنتجات", "إجمالي الكمية", "قيمة المخزون"]) assert.match(warehouses, new RegExp(label));
  for (const anomaly of ["القيمة المعروفة", "بدون تكلفة فعلية", "تكلفة غير معروفة"]) assert.doesNotMatch(warehouses, new RegExp(anomaly));
  assert.match(warehouses, /className="inventory-overview inventory-toolbar"/);
  assert.match(css, /\.popover-host\s*\{[^}]*overflow:\s*visible/);
  assert.match(css, /\.inventory-panel\{[^}]*grid-template-rows:auto auto minmax\(0,1fr\)/);
  assert.doesNotMatch(warehouses, /browserOpen/);
});
test("product movement details prioritize the table", () => {
  const panel = between("function ProductMovementPanel", "function Products");
  assert.match(panel, /FramedSection title="تفاصيل المنتج وحركته"/);
  for (const metric of ["الكمية في", "إجمالي الكمية", "تكلفة الوحدة", "القيمة في"]) assert.match(panel, new RegExp(metric));
  assert.doesNotMatch(panel, /شراء \/ بيع|تحويل \/ تصحيح|تكلفة غير معروفة/);
  assert.match(panel, /aria-label="سجل حركة المنتج"/);
  for (const heading of ["التاريخ", "العملية", "الطرف / المخزن", "الكمية", "السعر", "المستند"]) assert.equal((panel.match(new RegExp(`<th>${heading}</th>`, "g")) ?? []).length, 1);
  const warehouses = between("function Warehouses", "function ProductMovementPanel");
  assert.match(warehouses, /modal-overlay section-warehouses/);
});
test("stock operations collapse idle search and edit a serial ERP draft", () => {
  const form = between("function MultiStockForm", "function Transfer");
  assert.match(form, /collapseResultsWhenIdle/);
  assert.match(form, /<StockDraftTable/);
  const table = between("function StockDraftTable", "function MultiStockForm");
  for (const heading of ["الكمية للتحويل", "الكمية الفعلية", "تكلفة الوحدة"]) assert.match(table, new RegExp(heading));
  assert.match(table, /number\(index\+1\)/);
  assert.match(table, /أضف منتجًا لبدء العملية/);
});


test("POS checkout, records, scoped stock, and document print retain explicit structures", () => {
  const pos = between("function Pos", "function Purchase");
  assert.match(pos, /checkout-layout.*checkout-body.*checkout-footer/s);
  assert.doesNotMatch(pos, /product-count/);
  assert.match(pos, /floating allowEmpty=\{payment !== "note"\} variant="pos-customer".*resolvePartyType\(p\) === "customer"/s);
  const records = between("function Records", "const reportNames");
  assert.match(records, /records-workspace/);
  assert.match(records, /FramedSection title="بحث السجلات"/);
  const picker = between("function ProductSearchPicker", "const SearchProducts");
  assert.match(picker, /stockScope === "selected-warehouse" \? stockInWarehouse/);
  assert.match(app, /function PrintableDocument/);
  assert.match(css, /@page invoice \{ size: A4 portrait/);
  assert.match(css, /@page report \{ size: A4 landscape/);
});

test("focused banking and transaction editor regressions stay explicit", () => {
  const banks = between("function Banks", "function PaymentAccountDialog");
  assert.ok(banks.indexOf('className="bank-panel"') < banks.indexOf('title="ملخص الحسابات"'));
  for (const label of ["manual-deposit", "opening-balance"]) assert.match(banks, new RegExp(label));
  assert.match(app, /label: "السحب والإيداع"/);
  assert.match(app, /m\.type !== "opening-balance"/);
  assert.match(bootstrap, /\$ne: \["\$type", "opening-balance"\]/);
  const purchase = between("function Purchases", "function Expenses");
  assert.doesNotMatch(purchase, /purchase-locked|تأكيد المورد|تعديل المورد|disabled=\{!locked/);
  assert.match(purchase, /disabled=\{!partyId \|\| !warehouseId \|\| !lines\.length \|\| \(payment !== "note" && !payment\)\}/);
  const pos = between("function Pos", "function CompactPaymentSelector");
  assert.match(pos, /pos-quick-customer-button/);
  assert.doesNotMatch(pos, /pos-add-customer|إضافة عميل<\/button>/);
  assert.match(app, /onDone=\{id => \{ setPartyId\(id\); setQuick\(false\); \}\}/);
});

test("invoice editors expose explicit new, edit, void, history routing and authoritative print lifecycle", () => {
  const pos = between("function Pos", "function CompactPaymentSelector");
  const purchase = between("function Purchases", "function Expenses");
  for (const editor of [pos, purchase]) {
    assert.match(editor, /editingDocumentId \?/);
    assert.match(editor, /displayDocumentNumber\(editingDocument\)/);
    assert.match(editor, /"حفظ التعديلات"/);
    assert.match(editor, /\.status === "posted"/);
    assert.match(editor, /document\.legacyKey \|\| document\.status !== "posted"/);
    assert.match(editor, /تغييرات غير محفوظة/);
  }
  assert.match(pos, /type: wasEditing \? "sale\.update" : "sale\.post"/);
  assert.match(pos, /type: "sale\.void"/);
  assert.match(purchase, /type: wasEditing \? "purchase\.update" : "purchase\.post"/);
  assert.match(purchase, /type: "purchase\.void"/);
  assert.match(app, /setSaleEditRequest\(id\); setView\("pos"\)/);
  assert.match(app, /setPurchaseEditRequest\(id\); setView\("purchases"\)/);
  assert.match(app, /root\.classList\.add\("print-document-mode"\); window\.print\(\)/);
});

test("compact dates, explicit action order, and idle discovery remain structural", () => {
  const dates = between("function CompactDateRange", "function BarcodeScanner");
  assert.ok(dates.indexOf("onApply&&") < dates.indexOf("عرض الكل"));
  assert.match(css, /\.compact-date-range label\{[^}]*width:130px[^}]*border-radius:4px/);
  assert.match(css, /\.compact-date-range input\{[^}]*width:106px/);
  assert.match(css, /\.expense-form input\[type="date"\]\{width:128px\}/);
  for (const editor of [between("function Pos", "function Purchase"), between("function Purchases", "function Expenses")]) assert.match(editor, /collapseResultsWhenIdle/);
  assert.match(css, /grid-template-rows: auto minmax\(0, 1fr\)/);
});

test("desktop discovery reserves a stable product-search track", () => {
  const desktopWorkspace = css.slice(
    css.indexOf("/* Authoritative three-region transaction layout."),
    css.indexOf("@media (max-width: 1050px)", css.indexOf("/* Authoritative three-region transaction layout.")),
  );
  assert.match(desktopWorkspace, /\.workspace-discovery\s*\{[^}]*grid-template-rows:\s*clamp\(220px, 28vh, 250px\) minmax\(0, 1fr\)/);
  assert.doesNotMatch(desktopWorkspace, /\.workspace-discovery\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(desktopWorkspace, /\.workspace-discovery > \.search-panel\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0/);
  assert.match(desktopWorkspace, /\.search-panel \.product-picker\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0/);
});

test("expenses and record filters retain the compact desktop grid", () => {
  const records = between("function Records", "const reportNames");
  assert.match(records, /className="records-kind-filter"/);
  assert.match(css, /\.records-filters \.records-kind-filter\{[^}]*width:180px[^}]*flex:0 0 180px/);
  assert.match(css, /\.expense-form \{ grid-column:1;grid-row:1; \}/);
  assert.match(css, /\.expense-recurring \{[^}]*grid-column:1;grid-row:2/);
  assert.match(css, /\.expense-history \{[^}]*grid-column:2;grid-row:1 \/ span 2/);
  assert.doesNotMatch(css, /\.expense-form\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
});

test("invoice history renders every filtered record and expense actions follow their fields", () => {
  const recent = between("function Recent", "function Heading");
  assert.match(recent, /visibleDocs\.map\(/);
  assert.doesNotMatch(recent, /visibleDocs\.slice\(|visibleDocs\.filter\([^)]*\)\.slice\(/);
  const expenses = between("function Expenses", "function Banks");
  const fields = expenses.slice(expenses.indexOf('className="expense-fields"'), expenses.indexOf("</div>", expenses.indexOf('className="expense-fields"')));
  assert.match(fields, /وسيلة الدفع[\s\S]*className="primary expense-save"/);
  assert.match(css, /\.expense-form-body\s*\{[^}]*display:block/);
  assert.match(css, /\.expense-save\s*\{[^}]*align-self:end[^}]*height:34px/);
});

test("party history footer and framed bank workflows preserve semantic hierarchy", () => {
  const party = between("function PartyPage", "export function periodQuantity");
  assert.doesNotMatch(party, /دفع للطرف/);
  assert.match(party, /دفع لل\{customer\?"عميل":"مورد"\}/);
  assert.match(party, /className="party-history-toolbar"><CompactDateRange/);
  assert.ok(party.indexOf('<Recent title="الحركات"') < party.indexOf('className="party-trade-metrics"'));
  assert.match(css, /\.party-payment-row\{[^}]*grid-template-columns:280px 130px 105px minmax\(150px,1fr\)/);
  assert.match(css, /\.party-cash-direction button\{[^}]*white-space:nowrap[^}]*overflow:visible/);
  assert.doesNotMatch(css, /\.party-history-toolbar (?:label|input)\s*\{/);
  assert.match(css, /\.party-history-toolbar\s*\{[^}]*min-height:34px[^}]*overflow:visible/);
  assert.match(css, /\.party-trade-metrics\{[^}]*justify-content:flex-end[^}]*width:100%/);
  const banks = between("function Banks", "function PaymentAccountDialog");
  for (const title of ["تحويل جديد", "سجل التحويلات", "عملية سحب أو إيداع", "سجل السحب والإيداع"]) assert.match(banks, new RegExp(`FramedSection title="${title}"`));
});

test("party financial summaries use explicit business-semantic tones", () => {
  const parties = between("function Parties", "function PartyPage");
  const party = between("function PartyPage", "export function periodQuantity");
  assert.match(parties, /data\.partyFinancialSummaries/);
  assert.match(parties, /partyTradeMetrics/);
  assert.match(party, /data\.partyFinancialSummaries/);
  assert.match(party, /partyTradeMetrics/);
  assert.match(parties, /grossProfit.*metric-positive.*grossProfit.*metric-negative.*metric-neutral/);
  assert.match(party, /party-trade-metrics.*metric-neutral.*cashIn.*metric-neutral.*cashOut/s);
  assert.match(party, /grossProfit.*metric-positive.*grossProfit.*metric-negative.*metric-neutral/);
  assert.match(parties, /balance>0\?"positive":balance<0\?"negative"/);
  assert.match(css, /\.party-list-metrics b,\.party-trade-metrics b\{[^}]*font-size:16px/);
  assert.match(css, /\.metric-positive,.metric-positive b\{color:#15803d/);
  assert.match(css, /\.metric-negative,.metric-negative b\{color:#b91c1c/);
});

test("account overview is accounts-only, global, and uses a two-region semantic layout", () => {
  const banks = between("function Banks", "function PaymentAccountDialog");
  const accounts = banks.slice(banks.indexOf('{tab==="accounts"&&'), banks.indexOf('{tab==="movements"&&'));
  const afterAccounts = banks.slice(banks.indexOf('{tab==="movements"&&'));
  assert.match(accounts, /bank-accounts-main/);
  assert.match(accounts, /className="bank-summary"/);
  assert.doesNotMatch(afterAccounts, /className="bank-summary"/);
  assert.equal((banks.match(/className="bank-summary"/g) ?? []).length, 1);
  assert.match(banks, /accountSummary=bankScopeMetrics\(data\.paymentAccounts,data\.documents,null\)/);
  assert.doesNotMatch(banks, /accountSummary=bankScopeMetrics\([^;]*movementScope|accountSummary=bankScopeMetrics\([^;]*accountFilter|accountSummary=bankScopeMetrics\([^;]*typeFilter/);
  assert.match(banks, /movements=filterFinancialMovements\(operationalMovements,movementScope\.period,accountFilter,typeFilter\)/);
  assert.match(accounts, /account\.balance>0\?"metric-positive":account\.balance<0\?"metric-negative":"metric-neutral"/);
  assert.match(accounts, /إجمالي المبيعات<\/small><b>\{money\(accountSummary\.sales\)\}/);
  assert.match(css, /\.bank-tab-accounts\{[^}]*grid-template-columns:minmax\(0,2fr\) minmax\(280px,1fr\)/);
  assert.match(css, /\.bank-summary\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /\.banks-workspace\{[^}]*grid-template-rows:[^}]*bank-summary/);
});
