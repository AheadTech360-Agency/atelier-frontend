// Regenerate or check src/api-types from the Rust backend (ts-rs).
//
//   npm run sync-types    regenerate src/api-types from the backend
//   npm run check-types   fail if the committed src/api-types are stale
//
// The backend is found at ../atelier-backend, or ATELIER_BACKEND_DIR. Builds use one job and no
// debug info so they fit on an 8 GB machine.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const frontend = resolve(here, "..");
const typesDir = join(frontend, "src", "api-types");
const backend = resolve(process.env.ATELIER_BACKEND_DIR ?? join(frontend, "..", "atelier-backend"));
const mode = process.argv[2];

if (mode !== "sync" && mode !== "check") {
  console.error("usage: node scripts/types.mjs sync|check");
  process.exit(2);
}
if (!existsSync(join(backend, "Cargo.toml"))) {
  console.error(`Backend not found at ${backend}. Clone atelier-backend next to this repo, or set ATELIER_BACKEND_DIR.`);
  process.exit(2);
}

function generate(outDir) {
  console.log(`Generating types from ${backend} ...`);
  const r = spawnSync("cargo", ["test", "-j", "1", "--quiet", "export_bindings"], {
    cwd: backend,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, TS_RS_EXPORT_DIR: outDir, CARGO_PROFILE_DEV_DEBUG: "0", CARGO_PROFILE_TEST_DEBUG: "0" },
  });
  if (r.status !== 0) {
    console.error("Type generation failed (cargo test export_bindings).");
    process.exit(r.status ?? 1);
  }
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

if (mode === "sync") {
  rmSync(typesDir, { recursive: true, force: true }); // removed Rust types disappear too
  generate(typesDir);
  console.log(`Wrote ${listFiles(typesDir).length} type files to src/api-types.`);
} else {
  const tmp = mkdtempSync(join(tmpdir(), "atelier-types-"));
  try {
    generate(tmp);
    const want = new Map(listFiles(tmp).map((p) => [relative(tmp, p), read(p)]));
    const have = new Map(listFiles(typesDir).map((p) => [relative(typesDir, p), read(p)]));
    const problems = [];
    for (const [f, body] of want) {
      if (!have.has(f)) problems.push(`missing: ${f}`);
      else if (have.get(f) !== body) problems.push(`changed: ${f}`);
    }
    for (const f of have.keys()) if (!want.has(f)) problems.push(`no longer in the backend: ${f}`);
    if (problems.length) {
      console.error(`src/api-types is out of date with the backend:\n  ${problems.join("\n  ")}\nRun: npm run sync-types`);
      process.exit(1);
    }
    console.log(`src/api-types matches the backend (${want.size} files).`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
