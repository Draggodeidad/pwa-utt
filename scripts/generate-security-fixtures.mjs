// Reproducible W09-T10 replacements. Vector primitives only; no source photos.
import sharp from "sharp";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
for (const [name, accent, format] of [
  ["laboratory-evidence-1.jpeg", "#f59e0b", "jpeg"],
  ["laboratory-evidence-2.jpeg", "#38bdf8", "jpeg"],
  ["finding-evidence.png", "#a3e635", "png"],
]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#0f172a"/>
    <rect x="40" y="40" width="560" height="280" rx="16" fill="#1e293b" stroke="${accent}" stroke-width="4"/>
    <path d="M80 120 H240 V240 H560 M80 240 H160 V120 H560" fill="none" stroke="${accent}" stroke-width="12"/>
    <rect x="280" y="90" width="80" height="180" fill="#334155" stroke="#e2e8f0" stroke-width="4"/>
    <circle cx="480" cy="180" r="28" fill="${accent}"/>
  </svg>`;
  // Sharp strips source metadata by default; never call keepMetadata here.
  await sharp(Buffer.from(svg))[format]().toFile(resolve(root, "public/inspection-assets", name));
}
console.log("W09: tres diagramas sintéticos generados sin fotos de personas.");
