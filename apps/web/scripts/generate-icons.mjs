#!/usr/bin/env node
/**
 * Generates PNG and ICO icons from favicon.svg.
 * Run: pnpm --filter @crm/web generate:icons
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const faviconPath = join(publicDir, "favicon.svg");

const sizes = [
  { name: "icon-192", w: 192, h: 192 },
  { name: "icon-512", w: 512, h: 512 },
  { name: "apple-touch-icon", w: 180, h: 180 },
  { name: "favicon-32", w: 32, h: 32 },
];

async function generate() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("sharp not found. Install with: pnpm add -D sharp");
    process.exit(1);
  }

  const svg = readFileSync(faviconPath);
  console.log("Generating icons from favicon.svg...");

  for (const { name, w, h } of sizes) {
    const outPath = join(publicDir, `${name}.png`);
    await sharp(svg).resize(w, h).png().toFile(outPath);
    console.log(`  Created ${name}.png (${w}x${h})`);
  }

  // favicon.ico: copy favicon-32.png and rename for tools that need it, or create manually
  console.log("  (favicon.ico: create manually from favicon-32.png if needed for legacy browsers)");
  console.log("Done.");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
