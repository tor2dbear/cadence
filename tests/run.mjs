/* Runs every tests/smoke*.mjs in order, aggregates PASS/FAIL, and exits
 * non-zero if any assertion fails or a suite crashes. Used by `npm test`
 * locally and in CI. Each suite is self-contained (derives its own file://
 * base from import.meta.url and launches Playwright's chromium). */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const num = f => parseInt(f.replace(/\D/g, "")) || 0;
const files = readdirSync(here)
  .filter(f => /^smoke\d*\.mjs$/.test(f))
  .sort((a, b) => num(a) - num(b));

let failed = 0, totalPass = 0, totalFail = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [join(here, f)], { encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = (out.match(/^PASS/gm) || []).length;
  const fail = (out.match(/^FAIL/gm) || []).length;
  totalPass += pass; totalFail += fail;
  if (fail > 0 || r.status !== 0) {
    failed++;
    console.log(`✗ ${f}  (${pass} pass, ${fail} fail, exit ${r.status})`);
    out.split("\n").filter(l => /^FAIL/.test(l)).forEach(l => console.log("   " + l));
    if (r.status !== 0) console.log(out.split("\n").slice(-14).map(l => "   " + l).join("\n"));
  } else {
    console.log(`✓ ${f}  (${pass} pass)`);
  }
}
console.log(`\n${files.length} suites · ${totalPass} pass · ${totalFail} fail`);
process.exit(failed ? 1 : 0);
