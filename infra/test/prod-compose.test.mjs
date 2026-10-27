// F4-13 (D065): in the production compose only Caddy publishes ports (80 and
// 443); the console stays on 127.0.0.1 and PostgreSQL and the sim publish none.
// Needs Docker (docker compose config); the integration workflow runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const infra = join(dirname(fileURLToPath(import.meta.url)), '..');
const docker = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
// Skipped only outside CI: in the workflow, a missing Docker is a failure, not a skip.
const noDocker = docker.status !== 0 && !process.env.CI && 'sem Docker Compose nesta máquina';

/** The merged production config, from a generated .env. */
function prodConfig() {
  const dir = mkdtempSync(join(tmpdir(), 'prod-compose-'));
  const secrets = spawnSync(process.execPath, [join(infra, 'gen-secrets.mjs')], { encoding: 'utf8' }).stdout;
  const env = join(dir, '.env');
  writeFileSync(env, `NAKAMA_DOMAIN=jogo.exemplo.com.br\nACME_EMAIL=ops@exemplo.com.br\n${secrets}`);
  const out = spawnSync('docker', ['compose', '-f', join(infra, 'docker-compose.yml'), '-f', join(infra, 'docker-compose.prod.yml'),
    '--env-file', env, 'config', '--format', 'json'], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  return JSON.parse(out.stdout);
}

const published = (service) => (service.ports ?? []).map((p) => `${p.host_ip ?? ''}:${p.published}:${p.target}`);

test('no compose de produção só o Caddy publica 80 e 443; o console fica em 127.0.0.1', { skip: noDocker }, () => {
  const config = prodConfig();
  assert.deepEqual(published(config.services.caddy).sort(), [':443:443', ':80:80']);
  assert.deepEqual(published(config.services.nakama), ['127.0.0.1:7351:7351']);
  assert.deepEqual(published(config.services.postgres), []);
  assert.deepEqual(published(config.services.sim), []);
  assert.ok(config.volumes.caddy_data && config.volumes.caddy_config, 'volumes do Caddy');
  const caddyMounts = config.services.caddy.volumes.map((v) => v.target);
  assert.ok(caddyMounts.includes('/data') && caddyMounts.includes('/config') && caddyMounts.includes('/etc/caddy/Caddyfile'));
});

test('em produção os serviços voltam sozinhos depois de uma queda ou reinício', { skip: noDocker }, () => {
  const config = prodConfig();
  for (const name of ['postgres', 'sim', 'nakama', 'caddy']) assert.equal(config.services[name].restart, 'unless-stopped', name);
});
