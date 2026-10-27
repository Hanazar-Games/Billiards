// F1-03: shot events (ball_ball, ball_cushion, pocket, first_contact).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';
const run = name => { const c = CORPUS.find(x => x.name === name); return simulateShot(c.table, c.shot); };

test('a abertura toca as tabelas (detecta mundo sem tabelas)', () => {
  assert.ok(run('break').events.filter(e => e.type === 'ball_cushion').length >= 10);
});
test('first_contact da abertura é a bola 1 e coincide com o primeiro ball_ball da branca', () => {
  const ev = run('break').events;
  const fc = ev.find(e => e.type === 'first_contact');
  const bb = ev.find(e => e.type === 'ball_ball' && e.a === 0);
  assert.equal(fc.ball, 1); assert.equal(fc.t, bb.t); assert.equal(bb.b, 1);
  assert.equal(ev.filter(e => e.type === 'first_contact').length, 1);
});
test('encaçape gera evento pocket com o índice da caçapa', () => {
  const p = run('pot-side').events.filter(e => e.type === 'pocket');
  assert.deepEqual(p.map(e => [e.ball, e.pocket]), [[1, 2]]);
});
test('eventos ordenados por t e sem par repetido em passos consecutivos', () => {
  assert.ok(run('break').events.some(e => e.type === 'ball_ball'), 'a abertura gera ball_ball');
  for (const c of CORPUS) {
    const ev = run(c.name).events;
    for (let i = 1; i < ev.length; i++) assert.ok(ev[i].t >= ev[i - 1].t, c.name);
    const last = new Map();
    for (const e of ev.filter(e => e.type === 'ball_ball')) {
      const k = `${e.a}-${e.b}`;
      if (last.has(k)) assert.ok(e.t - last.get(k) > 1 / 180 - 1e-12, `${c.name} ${k} at ${e.t}`);
      last.set(k, e.t);
    }
  }
});
test('tacada só da branca na tabela não gera ball_ball', () => {
  const ev = run('rail-straight').events;
  assert.equal(ev.filter(e => e.type === 'ball_ball').length, 0);
  assert.ok(ev.some(e => e.type === 'ball_cushion'));
});
