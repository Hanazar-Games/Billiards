// Turns the JUnit report of the integration run into GitHub annotations, which
// can be read without signing in: one error per failing test (with its first
// message lines) and a notice with the totals. GitHub keeps 10 per type and step.
import { readFileSync, existsSync } from 'node:fs';

const file = process.argv[2] ?? 'integration-junit.xml';
const title = process.argv[3] ?? 'integration';
if (!existsSync(file)) {
  console.log(`::warning title=${title}::no report at ${file}`);
  process.exit(0);
}
const xml = readFileSync(file, 'utf8');
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const oneLine = (s) => s.replace(/%/g, '%25').replace(/\r?\n/g, ' ⏎ ').slice(0, 400);

let passed = 0;
const failures = [];
for (const match of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
  const name = unescape(/name="([^"]*)"/.exec(match[1])?.[1] ?? '?');
  const body = match[3] ?? '';
  const failure = /<failure\b([^>]*)>([\s\S]*?)<\/failure>|<failure\b([^>]*)\/>/.exec(body);
  if (!failure) { passed++; continue; }
  const attrMessage = /message="([^"]*)"/.exec(failure[1] ?? failure[3] ?? '')?.[1] ?? '';
  const detail = unescape(failure[2] ?? '').split('\n').filter((l) => l.trim() && !/^\s+at /.test(l)).slice(0, 6).join('\n');
  failures.push({ name, message: unescape(attrMessage) + (detail ? ` | ${detail}` : '') });
}
console.log(`::notice title=${title} totals::${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`::error title=${oneLine(f.name)}::${oneLine(f.message)}`);
