import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the Vercel-ready application structure", async () => {
  const [page, stockApp, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/stock-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(stockApp, /Indumentaria Fit/);
  assert.match(page, /force-dynamic/);
  assert.match(layout, /<html lang="es">/i);
  assert.match(layout, /Indumentaria Fit · Control de stock/);
  assert.match(packageJson, /"build": "vinext build"/);
});

test("keeps the starter preview out of the finished application", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/stock-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Indumentaria Fit/);
  assert.match(page, /reserve_stock/);
  assert.match(page, /confirm_reserved_sale/);
  assert.match(page, /stockOverviewGrid/);
  assert.match(page, /colorVariantGroup/);
  assert.match(page, /saleColors\.map/);
  assert.match(page, /downloadSaleReceipt/);
  assert.match(page, /Confirmar y descargar comprobante/);
  assert.doesNotMatch(page, /view: "home"|view: "transfers"|view: "orders"/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(page, /SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
