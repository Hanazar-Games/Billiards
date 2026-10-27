// Checks the production infra/.env before the stack goes up (F4-13, D065):
// every key present, none left with a development value of infra/.env.example
// or a placeholder of infra/.env.production.example, and every secret matching
// ^[A-Za-z0-9_-]{24,}$ (nothing the Compose file or a shell would expand).
// Usage: node infra/check-env.mjs [file=infra/.env]; exits 1 with the problems.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const infra = dirname(fileURLToPath(import.meta.url));

export const SECRET_KEYS = Object.freeze([
  'NAKAMA_SERVER_KEY', 'NAKAMA_HTTP_KEY', 'NAKAMA_SESSION_KEY', 'NAKAMA_CONSOLE_PASSWORD', 'POSTGRES_PASSWORD', 'SIM_SECRET',
]);
export const REQUIRED_KEYS = Object.freeze(['NAKAMA_DOMAIN', 'ACME_EMAIL', ...SECRET_KEYS]);

const SECRET = /^[A-Za-z0-9_-]{24,}$/;
const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** KEY=value lines; comments and blank lines are skipped. */
export function parseEnv(text) {
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

const readEnv = (file) => (existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {});

/** The problems of `env`, one line per key; empty when it can go to production. */
export function checkEnv(env, examples = [readEnv(join(infra, '.env.example')), readEnv(join(infra, '.env.production.example'))]) {
  const problems = [];
  for (const key of REQUIRED_KEYS) {
    const value = env[key];
    if (!value) {
      problems.push(`${key}: falta`);
    } else if (examples.some((example) => example[key] === value)) {
      problems.push(`${key}: ainda tem o valor de exemplo`);
    } else if (SECRET_KEYS.includes(key) && !SECRET.test(value)) {
      problems.push(`${key}: use 24 ou mais letras, números, _ ou - (node infra/gen-secrets.mjs)`);
    } else if (key === 'NAKAMA_DOMAIN' && !DOMAIN.test(value)) {
      problems.push(`${key}: só o nome do domínio, sem https:// nem porta`);
    } else if (key === 'ACME_EMAIL' && !EMAIL.test(value)) {
      problems.push(`${key}: um e-mail para os avisos do Let's Encrypt`);
    }
  }
  return problems;
}

function main() {
  const file = process.argv[2] ?? join(infra, '.env');
  if (!existsSync(file)) {
    console.error(`check-env: ${file} não existe (docs/f4/implantacao.md)`);
    process.exit(1);
  }
  const problems = checkEnv(parseEnv(readFileSync(file, 'utf8')));
  if (problems.length) {
    console.error(`check-env: ${file} não está pronto para produção:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`check-env: ${file} ok`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
