// Date-only formatting guards against RangeError for nullable/invalid inspection dates.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const Module = require("node:module");
const typescript = require("typescript");

const root = resolve(__dirname, "..");
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const source = readFileSync(filename, "utf8");
    const output = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS, jsx: typescript.JsxEmit.ReactJSX, target: typescript.ScriptTarget.ES2022 } });
    module._compile(output.outputText, filename);
  };
}
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) return originalResolve.call(this, resolve(root, "src", request.slice(2)), ...args);
  return originalResolve.call(this, request, ...args);
};
const { parseDateOnly, formatDateOnly } = require("../src/lib/format-date.ts");
const { InspectionCard } = require("../src/features/inspections/components/InspectionCard.tsx");
const { InspectionList } = require("../src/features/inspections/components/InspectionList.tsx");

const formatter = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

function baseItem(overrides = {}) {
  return {
    id: "inspection-001",
    location: "Laboratorio de Cómputo A",
    laboratoryCode: "LAB-COMP-01",
    date: "2026-08-28",
    inspector: "Técnica A",
    result: "without_findings",
    findingCount: 0,
    syncStatus: "synced",
    workflowStatus: "completed",
    summary: "Revisión visual.",
    ...overrides,
  };
}

async function main() {
  assert.equal(parseDateOnly("2026-08-28") instanceof Date, true);
  assert.equal(parseDateOnly("2026-08-28").toISOString().slice(0, 10), "2026-08-28");
  assert.equal(formatDateOnly("2026-08-28", formatter), formatter.format(new Date("2026-08-28T12:00:00")));

  assert.equal(parseDateOnly(null), null);
  assert.equal(formatDateOnly(null, formatter), "Sin fecha");

  assert.equal(parseDateOnly(undefined), null);
  assert.equal(formatDateOnly(undefined, formatter), "Sin fecha");

  assert.equal(parseDateOnly(""), null);
  assert.equal(formatDateOnly("", formatter), "Sin fecha");
  assert.equal(formatDateOnly("   ", formatter), "Sin fecha");

  assert.equal(parseDateOnly("invalid-date"), null);
  assert.equal(formatDateOnly("invalid-date", formatter), "Sin fecha");
  assert.equal(parseDateOnly("2026-13-45"), null);
  assert.equal(formatDateOnly("2026-13-45", formatter), "Sin fecha");

  const mixed = [{ date: "2026-08-28" }, { date: "" }, { date: null }, { date: "invalid-date" }];
  const formatted = mixed.map((item) => formatDateOnly(item.date, formatter));
  assert.deepEqual(formatted, [formatter.format(new Date("2026-08-28T12:00:00")), "Sin fecha", "Sin fecha", "Sin fecha"]);

  const list = [
    baseItem({ id: "inspection-001" }),
    baseItem({ id: "inspection-002", location: "Laboratorio de Cómputo B", date: "", summary: "Borrador sin fecha." }),
    baseItem({ id: "inspection-003", location: "Laboratorio de Cómputo C", date: "invalid-date", summary: "Dato corrupto." }),
  ];
  const markup = renderToStaticMarkup(createElement(InspectionList, { inspections: list }));
  assert.match(markup, /Laboratorio de Cómputo A/);
  assert.match(markup, /Laboratorio de Cómputo B/);
  assert.match(markup, /Laboratorio de Cómputo C/);
  assert.match(markup, /Sin fecha/);
  assert.doesNotMatch(markup, /Invalid Date/);

  const cardMarkup = renderToStaticMarkup(createElement(InspectionCard, { inspection: baseItem({ date: "" }) }));
  assert.match(cardMarkup, /Sin fecha/);
  assert.doesNotMatch(cardMarkup, /Invalid Date/);

  console.log("date-format.spec.ts: PASS");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });