/* Docs stay in sync with shipped functionality. The README and the guide must
 * mention the major user-facing capabilities, so the docs can't silently rot as
 * features land — a keyword tripwire, coarse but enforced in CI: shipping a
 * capability without documenting it fails the build. This is the "definition of
 * done" from the README, made executable. When you add a capability, add a row. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(fileURLToPath(new URL(p, root)), 'utf8').toLowerCase();
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

const readme = read('README.md');
const guide = read('guide.html');

// capabilities that BOTH the README and the guide must mention. Match
// feature-SPECIFIC phrases, not bare keywords: a plain /import/ also matches the
// README's unrelated roadmap line, so deleting the shipped system-file docs
// would still pass. Require the `.cadence.json` phrase itself.
// \s+ (not a literal space) so markdown line-wrapping between the two words —
// "My\n  systems" in the README — can't silently defeat the tripwire.
const CAPS = [
  ['save & name systems', /my\s+system|save\s+a\s+system/],
  ['import / export a system file', /\.cadence\.json/],
];
for (const [name, re] of CAPS) {
  assert(`README documents: ${name}`, re.test(readme));
  assert(`guide documents: ${name}`, re.test(guide));
}
// the README must also cover the older, still-shipped capabilities
assert('README documents token export', /export/.test(readme));
assert('README documents the preset picker (load a system)', /load a system/.test(readme));
// and its status line must not be frozen at a stale prototype version
assert('README status is not frozen at a stale v0.x', !/prototype \(v0\.\d\)/.test(readme));
