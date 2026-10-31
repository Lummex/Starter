// Self-test for secret-scan.mjs. Fake keys are built at run time, so this file
// itself never contains anything the scan would flag.
// Usage: node factory/secret-scan.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scanner = path.join(path.dirname(fileURLToPath(import.meta.url)), 'secret-scan.mjs');
const body = 'A1b2C3d4E5f6G7h8J9k0LmNoPq';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role })}.${'x'.repeat(20)}`;
const roleWord = ['service', 'role'].join('_');

const cases = [
  // [description, relative file, content, should fail]
  ['clean file passes', 'notes.md', 'nothing to see here', false],
  ['bare prefixes in docs pass', 'brief.md', 'refuse sb_secret_, sk_live_, sk_test_, whsec_ in commits', false],
  ['role word in SQL passes', 'supabase/migrations/x.sql', `-- never use ${roleWord} here`, false],
  ['public anon JWT passes', 'projects/oreheart-8/src/env.ts', `const k = "${jwt('anon')}";`, false],
  ['Supabase secret key fails', 'a.txt', `key=${'sb_' + 'secret_'}${body}`, true],
  ['Stripe live key fails', 'b.ts', `"${'sk_' + 'live_'}${body}"`, true],
  ['Stripe test key fails', 'c.env', `STRIPE=${'sk_' + 'test_'}${body}`, true],
  ['Stripe restricted key fails', 'd.json', `{"k":"${'rk_' + 'live_'}${body}"}`, true],
  ['webhook secret fails', 'e.yml', `secret: ${'wh' + 'sec_'}${body}`, true],
  ['secret-role JWT fails anywhere', 'supabase/tests/f.sql', `-- ${jwt(roleWord)}`, true],
  ['role word in game code fails', 'projects/oreheart-8/src/net.ts', `// uses ${roleWord}`, true],
  ['role word in admin build fails', 'projects/oreheart-admin/dist/assets/i.js', `x="${roleWord.toUpperCase()}_KEY"`, true],
];

let failed = 0;
for (const [desc, rel, content, shouldFail] of cases) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'));
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  let code = 0;
  try { execFileSync(process.execPath, [scanner, dir], { stdio: 'pipe', cwd: dir }); } catch (e) { code = e.status; }
  const ok = (code !== 0) === shouldFail;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${desc}`);
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(failed ? `${failed} FAILED` : `all ${cases.length} passed`);
process.exit(failed ? 1 : 0);
