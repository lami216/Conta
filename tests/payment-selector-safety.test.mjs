import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/conta-app.tsx", import.meta.url), "utf8");
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

test("new sales and purchases start and reset without a payment account", () => {
  const pos = between("function Pos", "function CompactPaymentSelector");
  const purchases = between("function Purchases", "function Expenses");
  for (const workspace of [pos, purchases]) {
    assert.match(workspace, /payment[^\n]*useSessionDraft\("(?:sale|purchase)-payment", ""\)/);
    assert.match(workspace, /setPayment\(""\)/);
    assert.match(workspace, /\(payment !== "note" && !payment\)/);
    assert.match(workspace, /const loadedPayment = document\.paymentMethod/);
  }
  assert.doesNotMatch(pos + purchases, /setPayment\("cash"\)/);
});

test("compact selector represents an explicitly empty payment", () => {
  const selector = between("function CompactPaymentSelector", "function InvoiceEditorToolbar");
  assert.match(selector, /const cashSelected = Boolean/);
  assert.match(selector, /aria-pressed=\{cashSelected\}/);
  assert.match(selector, /value=\{selectedBank\?\.id \?\? ""\}/);
  assert.match(selector, /<option value="">اختر بنك<\/option>/);
  assert.doesNotMatch(selector, /aria-pressed=\{!selectedBank\}/);
});

test("expense transaction selectors expose names only and recurring payment state is independent", () => {
  const expenses = between("function Expenses", "type FinancialDetail");
  assert.match(expenses, /\{a\.name\}<\/option>/);
  assert.doesNotMatch(expenses, /money\(a\.balance\)|a\.balance|MRU/);
  assert.match(expenses, /\[recurringPaymentMethod, setRecurringPaymentMethod\] = useState\(""\)/);
  assert.match(expenses, /disabled=\{!recurringPaymentMethod\}/);
  assert.match(expenses, /setPaymentMethod\(""\)/);
});

test("party movements require and reset an explicitly selected account", () => {
  const party = between("function PartyPage", "export function periodQuantity");
  assert.match(party, /\[paymentMethod,setPaymentMethod\]=useState\(""\)/);
  assert.match(party, /<option value="">اختر وسيلة الدفع<\/option>/);
  assert.match(party, /disabled=\{!paymentMethod\|\|/);
  assert.match(party, /setPaymentMethod\(""\)/);
});

test("bank inspection retains protected balance rendering", () => {
  const banks = between("function Banks", "function Parties");
  assert.match(banks, /<PrivateMoney value=\{account\.balance\}/);
});
