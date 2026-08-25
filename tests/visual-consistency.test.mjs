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
  assert.match(warehouses, /FramedSection title="المخزن"/);
  assert.match(warehouses, /FramedSection title="جرد المخزن"/);
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
  assert.match(warehouses, /className="warehouse-head" allowOverflow/);
  assert.match(css, /\.popover-host\s*\{[^}]*overflow:\s*visible/);
  assert.match(css, /\.inventory-panel\s*\{[^}]*align-content:\s*start/);
  assert.match(css, /\.inventory-panel\.browser-open\s*\{[^}]*minmax\(0, 1fr\)/);
});
test("product movement details prioritize the table", () => {
  const panel = between("function ProductMovementPanel", "function Products");
  assert.match(panel, /FramedSection title="تفاصيل المنتج وحركته"/);
  for (const metric of ["الكمية في", "إجمالي الكمية", "تكلفة الوحدة", "القيمة في"]) assert.match(panel, new RegExp(metric));
  assert.doesNotMatch(panel, /شراء \/ بيع|تحويل \/ تصحيح|تكلفة غير معروفة/);
  assert.match(panel, /aria-label="سجل حركة المنتج"/);
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
  assert.ok(banks.indexOf('title="البنوك والحسابات"') < banks.indexOf('title="ملخص الحسابات"'));
  for (const label of ["السحب والإيداع", "manual-deposit", "opening-balance"]) assert.match(banks, new RegExp(label));
  assert.match(app, /m\.type !== "opening-balance"/);
  assert.match(bootstrap, /\$ne: \["\$type", "opening-balance"\]/);
  const purchase = between("function Purchases", "function Expenses");
  assert.doesNotMatch(purchase, /purchase-locked|تأكيد المورد|تعديل المورد|disabled=\{!locked/);
  assert.match(purchase, /disabled=\{!partyId \|\| !warehouseId \|\| !lines\.length\}/);
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
