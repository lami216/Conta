import assert from "node:assert/strict";
import test from "node:test";
import { parseReportFilters } from "../lib/reports.ts";
const parse = query => parseReportFilters(new URL(`http://localhost/api/reports?${query}`));
test("report periods are inclusive calendar inputs with validated paging", () => {
  const value=parse("type=sales&from=2026-08-01&to=2026-08-21&page=2&pageSize=100");
  assert.deepEqual([value.from,value.to,value.page,value.pageSize],["2026-08-01","2026-08-21",2,100]);
});
test("report API rejects inverted dates, unknown reports, and unbounded pages", () => {
  assert.throws(()=>parse("type=sales&from=2026-08-22&to=2026-08-21"),/بداية الفترة/);
  assert.throws(()=>parse("type=tax&from=2026-08-01&to=2026-08-21"),/نوع التقرير/);
  assert.throws(()=>parse("type=sales&from=2026-08-01&to=2026-08-21&pageSize=1000"),/الصفحة/);
});
test("report parameters use strict allowlists",()=>assert.throws(()=>parse("type=profit&from=2026-08-01&to=2026-08-21&groupBy=%24where"),/groupBy/));
