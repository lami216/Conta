import assert from "node:assert/strict";
import test from "node:test";
import { saleLineTotal } from "../app/domain.ts";

test("piece pricing remains piece pricing above a carton", () => assert.equal(saleLineTotal(27, 12, 100, 1000, "piece"), 2700));
test("carton pricing applies its effective unit price to extras", () => assert.equal(saleLineTotal(27, 12, 100, 1000, "carton"), 2250));
test("carton pricing rounds once per line", () => {
  assert.equal(saleLineTotal(13, 12, 100, 1000, "carton"), 1083);
  assert.equal(saleLineTotal(12, 12, 100, 1000, "carton"), 1000);
});
test("less than a carton uses pieces", () => assert.equal(saleLineTotal(8, 12, 100, 1000, "piece"), 800));
test("invalid quantities cannot produce totals", () => {
  assert.equal(saleLineTotal(1, 0, 100, 1000, "piece"), 0);
  assert.equal(saleLineTotal(-1, 12, 100, 1000, "piece"), 0);
});
