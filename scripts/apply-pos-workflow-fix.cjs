const fs = require("fs");

const appPath = "app/conta-app.tsx";
const cssPath = "app/globals.css";
let app = fs.readFileSync(appPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

function replaceOnce(label, from, to) {
  if (!app.includes(from)) {
    throw new Error(`Patch failed (${label}): expected source block was not found`);
  }
  app = app.replace(from, to);
}

replaceOnce(
  "sale line carton counter",
  `  const qty = val(line.quantity),\n    cartons = Math.floor(qty / product.piecesPerCarton);`,
  `  const qty = val(line.quantity);`,
);

replaceOnce(
  "sale piece price handler",
  `              onChange={(v) => onChange({ ...line, piecePrice: v, pricingMode: "piece" })}`,
  `              onChange={(v) => onChange({ ...line, piecePrice: v })}`,
);

replaceOnce(
  "remove sale carton pricing controls",
  `        {mode === "sale" && cartons > 0 && <label>طريقة التسعير<select value={line.pricingMode} onChange={e => onChange({ ...line, pricingMode: e.target.value as "piece" | "carton" })}><option value="piece">سعر الفرد</option><option value="carton">سعر الكرتون</option></select></label>}\n        {mode === "sale" && cartons > 0 && line.pricingMode === "carton" && <label>سعر الكرتون<Num value={line.cartonPrice} onChange={v => onChange({ ...line, cartonPrice: v })} /></label>}\n`,
  ``,
);

replaceOnce(
  "sale editor total is always piece price",
  `            saleLineTotal(\n              qty,\n              product.piecesPerCarton,\n              val(line.piecePrice),\n              val(line.cartonPrice),\n              line.pricingMode,\n            ),`,
  `            saleLineTotal(\n              qty,\n              product.piecesPerCarton,\n              val(line.piecePrice),\n              0,\n              "piece",\n            ),`,
);

replaceOnce(
  "POS pending state",
  `  const [query, setQuery] = useState(""),\n    [lines, setLines] = useState<DraftLine[]>([]),`,
  `  const [query, setQuery] = useState(""),\n    [pending, setPending] = useState<DraftLine | null>(null),\n    [lines, setLines] = useState<DraftLine[]>([]),`,
);

replaceOnce(
  "POS pending product",
  `  const wh = data.warehouses.find((w) => w.isSalesDefault),\n    details = lines.flatMap((l) => {`,
  `  const wh = data.warehouses.find((w) => w.isSalesDefault),\n    pendingProduct = pending\n      ? data.products.find((p) => p.id === pending.productId) ?? null\n      : null,\n    details = lines.flatMap((l) => {`,
);

replaceOnce(
  "POS line totals are always piece price",
  `              total: saleLineTotal(\n                val(l.quantity),\n                p.piecesPerCarton,\n                val(l.piecePrice),\n                val(l.cartonPrice),\n                l.pricingMode,\n              ),`,
  `              total: saleLineTotal(\n                val(l.quantity),\n                p.piecesPerCarton,\n                val(l.piecePrice),\n                0,\n                "piece",\n              ),`,
);

replaceOnce(
  "POS stage before invoice",
  `  function add(p: Product) {\n    setLines((x) => [lineFor(p), ...x.filter((l) => l.productId !== p.id)]);\n    setQuery("");\n  }`,
  `  function add(p: Product) {\n    const existing = lines.find((l) => l.productId === p.id);\n    setPending(existing ? { ...existing, pricingMode: "piece" } : lineFor(p));\n    setQuery("");\n  }\n  function confirmPending() {\n    if (!pending || val(pending.quantity) <= 0) return;\n    setLines((current) => [\n      { ...pending, pricingMode: "piece" },\n      ...current.filter((line) => line.productId !== pending.productId),\n    ]);\n    setPending(null);\n  }`,
);

replaceOnce(
  "sale payload piece pricing only",
  `          piecePrice: val(l.piecePrice),\n          cartonPrice: val(l.cartonPrice),\n          pricingMode: l.pricingMode,`,
  `          piecePrice: val(l.piecePrice),\n          pricingMode: "piece",`,
);

replaceOnce(
  "clear pending after sale",
  `    setLines([]);\n    openDoc(id);`,
  `    setLines([]);\n    setPending(null);\n    openDoc(id);`,
);

replaceOnce(
  "POS pending editor UI",
  `          <div\n            className={\n              lines.length > 3 ? "invoice-lines scroll" : "invoice-lines"\n            }\n          >\n            {lines.length ? (\n              details.map(({ l, p }) => (\n                <LineEditor\n                  key={l.productId}\n                  line={l}\n                  product={p}\n                  mode="sale"\n                  onChange={(x) =>\n                    setLines((s) =>\n                      s.map((a) => (a.productId === x.productId ? x : a)),\n                    )\n                  }\n                  onRemove={() =>\n                    setLines((s) =>\n                      s.filter((a) => a.productId !== l.productId),\n                    )\n                  }\n                />\n              ))\n            ) : (\n              <Empty text="ابحث عن منتج لإضافته إلى الفاتورة" />\n            )}\n          </div>`,
  `          <div className="invoice-lines pending-sale-area">\n            {pending && pendingProduct ? (\n              <div className="pending-sale-line">\n                <LineEditor\n                  key={pending.productId}\n                  line={pending}\n                  product={pendingProduct}\n                  mode="sale"\n                  onChange={setPending}\n                  onRemove={() => setPending(null)}\n                />\n                <button\n                  type="button"\n                  className="primary wide confirm-sale-line"\n                  disabled={val(pending.quantity) <= 0}\n                  onClick={confirmPending}\n                >\n                  تأكيد وإضافة للفاتورة\n                </button>\n              </div>\n            ) : (\n              <Empty text="اختر منتجًا، أدخل الكمية وسعر الفرد ثم أكد إضافته" />\n            )}\n          </div>`,
);

replaceOnce(
  "remove carton state from product form",
  `    [price, setPrice] = useState(String(product?.piecePrice ?? "")),\n    [carton, setCarton] = useState(String(product?.cartonPrice ?? "")),\n    [pack, setPack] = useState(String(product?.piecesPerCarton ?? 1)),`,
  `    [price, setPrice] = useState(String(product?.piecePrice ?? "")),\n    [pack, setPack] = useState(String(product?.piecesPerCarton ?? 1)),`,
);

replaceOnce(
  "remove carton price from product payload",
  `            piecePrice: price,\n            cartonPrice: carton,\n            piecesPerCarton: val(pack),`,
  `            piecePrice: price,\n            piecesPerCarton: val(pack),`,
);

replaceOnce(
  "remove carton price product field",
  `      <label>\n        سعر بيع الكرتون (اختياري)\n        <Num value={carton} onChange={setCarton} />\n      </label>\n`,
  ``,
);

const cssMarker = "/* POS confirmation flow + strong card borders */";
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.sidebar nav { overflow: visible; }\n.nav-menu { z-index: 85; }\n.pending-sale-area { height: auto; min-height: 410px; overflow: visible; }\n.pending-sale-line { display: grid; gap: 12px; align-content: start; margin-top: 14px; }\n.confirm-sale-line { min-height: 52px; }\n.panel, .hero, .stat, .party-grid, .party-card, .document, .line, .invoice-card, .invoice-preview, .meta-option, .choice, .warehouse-chip, .date-chip, .side-foot, .product-row, .list-row { border-color: #171717 !important; }\n@media (max-width: 760px) {\n  .pending-sale-area { min-height: 260px; }\n}\n`;
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);
console.log("POS/UI patch applied successfully");
