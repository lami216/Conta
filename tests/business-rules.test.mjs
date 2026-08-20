import assert from "node:assert/strict";
import test from "node:test";
import { quantity, saleLineTotal } from "../app/domain.ts";

test("sales use quantity multiplied by piece price only", () => {
  assert.equal(saleLineTotal(27, 100), 2700);
  assert.equal(saleLineTotal(13, 100), 1300);
});
test("quantity is always displayed as individual pieces", () => assert.equal(quantity(177), "177 فرد"));
test("invalid sale quantities total zero", () => assert.equal(saleLineTotal(-1, 100), 0));
