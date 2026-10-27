// Prints where development stands: current phase, next pending features,
// open decisions and the "Próximo passo" section of progress.md.
import { readFileSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
const features = JSON.parse(readFileSync(new URL('feature_list.json', dir), 'utf8'));
const decisions = JSON.parse(readFileSync(new URL('decisions.json', dir), 'utf8'));
const progress = readFileSync(new URL('progress.md', dir), 'utf8');

const pending = features.filter((f) => !f.passes);
const done = features.length - pending.length;
const phase = pending[0]?.phase ?? 'concluído';

console.log(`== Harness: status ==`);
console.log(`features: ${done}/${features.length} passing · fase atual: ${phase}`);
for (const f of pending.slice(0, 5)) console.log(`  [ ] ${f.id} ${f.description}`);

const open = decisions.filter((d) => d.status !== 'accepted' && d.status !== 'superseded');
if (open.length) {
  console.log(`decisões em aberto: ${open.map((d) => `${d.id} (${d.status})`).join(', ')}`);
}

const next = progress.match(/## Próximo passo\n([\s\S]*?)(\n## |$)/);
if (next) console.log(`próximo passo:\n${next[1].trim()}`);
