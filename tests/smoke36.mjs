/* The deployed security headers stay strict and in sync with the markup.
 *
 * gen-headers.mjs derives a sha256 per executable inline script from the actual
 * file bytes, so the policy can't drift from the pages. This guards the *shape*
 * the generator must always produce: a hash for every inline script we ship, no
 * 'unsafe-inline' escape hatch for script-src, non-script vectors locked down,
 * and the analytics origins (and nothing else) allowlisted. Loosen the policy or
 * add an un-hashable inline script and CI trips. Pure/offline — no browser. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inlineScriptHashes, cspFrom, headersText } from '../scripts/gen-headers.mjs';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(fileURLToPath(new URL(p, root)), 'utf8');
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

// the pages that actually ship (dist/*.html: the source pages + generated
// changelog, which has no executable inline script of its own)
const PAGES = ['index.html', 'demo.html', 'guide.html', '404.html'];
const allHashes = PAGES.flatMap(p => inlineScriptHashes(read(p)));
const csp = cspFrom(allHashes);
const headers = headersText(csp);

// the two executable inline scripts we ship: the index boot gate (must be inline
// — it sets the view before first paint) and demo.html's token resolver. Each
// gets its own hash; JSON-LD blocks are data and must NOT be hashed.
const bootHashes = inlineScriptHashes(read('index.html'));
const demoHashes = inlineScriptHashes(read('demo.html'));
assert('index has exactly one executable inline script (the boot gate)', bootHashes.length === 1);
assert('demo has exactly one executable inline script (the resolver)', demoHashes.length === 1);
assert('guide has no executable inline script (JSON-LD is not hashed)', inlineScriptHashes(read('guide.html')).length === 0);
assert('CSP carries the boot-gate hash', csp.includes(bootHashes[0]));
assert('CSP carries the demo-resolver hash', csp.includes(demoHashes[0]));

// the strict posture: inline scripts run only by matching hash, never a blanket
// 'unsafe-inline' (which would re-open the inline-injection vector CSP is here to
// close). style-src is the deliberate exception — buildCSS injects a <style>
// whose contents are dynamic and can't be hashed; a stylesheet is not a script.
const scriptSrc = csp.match(/script-src[^;]*/)[0];
assert("script-src runs inline by hash, never 'unsafe-inline'", !scriptSrc.includes("'unsafe-inline'"));
assert('script-src carries a sha256 hash', /'sha256-/.test(scriptSrc));
assert("style-src keeps 'unsafe-inline' (dynamic CSS injection)", /style-src[^;]*'unsafe-inline'/.test(csp));

// non-script vectors are locked down
assert("default-src is 'self'", /default-src 'self'/.test(csp));
assert("object-src is 'none'", /object-src 'none'/.test(csp));
assert("base-uri is 'self'", /base-uri 'self'/.test(csp));
assert("frame-ancestors is 'self' (clickjacking)", /frame-ancestors 'self'/.test(csp));
assert("form-action is 'self'", /form-action 'self'/.test(csp));
assert('font-src is self-only', /font-src 'self'(;|$)/.test(csp));

// exactly the analytics origins are allowlisted — the beacon script + its RUM POST
assert('analytics script origin allowlisted', scriptSrc.includes('https://static.cloudflareinsights.com'));
assert('analytics beacon connect origin allowlisted', /connect-src[^;]*https:\/\/cloudflareinsights\.com/.test(csp));

// the companion hardening headers ride along in the generated file
assert('_headers applies to every path (/*)', /^\/\*/m.test(headers));
assert('_headers sets X-Content-Type-Options: nosniff', /X-Content-Type-Options: nosniff/.test(headers));
assert('_headers sets a Referrer-Policy', /Referrer-Policy:\s*\S/.test(headers));
assert('_headers sets a Permissions-Policy', /Permissions-Policy:\s*\S/.test(headers));
assert('_headers sets X-Frame-Options: SAMEORIGIN', /X-Frame-Options: SAMEORIGIN/.test(headers));
