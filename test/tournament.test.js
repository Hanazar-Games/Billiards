/**
 * Tournament system unit tests — Season Experience v2
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { TournamentStore } from '../src/tournament/TournamentStore.js';
import { TournamentEngine } from '../src/tournament/TournamentEngine.js';
import { getStyleMeta, buildMatchPreview } from '../src/tournament/TournamentData.js';

describe('TournamentStore', () => {
  let store;

  test('starts with empty history and default season stats', () => {
    store = new TournamentStore();
    assert.strictEqual(store.getAll().length, 0);
    const stats = store.getSeasonStats();
    assert.strictEqual(stats.totalEntered, 0);
    assert.strictEqual(stats.championships, 0);
    assert.strictEqual(stats.bestRound, -1);
    assert.deepStrictEqual(stats.rivalWins, {});
  });

  test('records a finished tournament and updates season stats', () => {
    store = new TournamentStore();
    const engineState = {
      id: 'test_1',
      status: 'finished',
      createdAt: Date.now(),
      player: { name: 'Player', color: '#d8b15f', isPlayer: true },
      mode: '8ball',
      champion: { name: 'Player', isPlayer: true },
      trophy: { name: '冠军金杯', icon: '🏆', color: '#ffd700' },
      rounds: [
        [
          {
            round: 0, index: 0, played: true,
            player1: { name: 'Player', isPlayer: true },
            player2: { name: 'Opp1', isPlayer: false },
            winner: { name: 'Player', isPlayer: true },
            p1Score: 1, p2Score: 0,
          },
        ],
        [
          {
            round: 1, index: 0, played: true,
            player1: { name: 'Player', isPlayer: true },
            player2: { name: 'Opp2', isPlayer: false },
            winner: { name: 'Player', isPlayer: true },
            p1Score: 2, p2Score: 1,
          },
        ],
        [
          {
            round: 2, index: 0, played: true,
            player1: { name: 'Player', isPlayer: true },
            player2: { name: 'Opp3', isPlayer: false },
            winner: { name: 'Player', isPlayer: true },
            p1Score: 3, p2Score: 2,
          },
        ],
      ],
    };

    const ok = store.record(engineState);
    assert.strictEqual(ok, true);
    assert.strictEqual(store.getAll().length, 1);

    const stats = store.getSeasonStats();
    assert.strictEqual(stats.totalEntered, 1);
    assert.strictEqual(stats.championships, 1);
    assert.strictEqual(stats.bestRound, 2);
    assert.strictEqual(stats.totalWins, 3);
    assert.strictEqual(stats.totalLosses, 0);
    assert.strictEqual(stats.currentStreak, 1);
    assert.strictEqual(stats.bestStreak, 1);
    assert.strictEqual(stats.rivalWins['Opp1'], 1);
    assert.strictEqual(stats.rivalWins['Opp2'], 1);
    assert.strictEqual(stats.rivalWins['Opp3'], 1);
  });

  test('tracks elimination and best round correctly', () => {
    store = new TournamentStore();
    const engineState = {
      id: 'test_2',
      status: 'finished',
      createdAt: Date.now(),
      player: { name: 'Player', isPlayer: true },
      mode: '8ball',
      champion: { name: 'Opp2', isPlayer: false },
      trophy: null,
      rounds: [
        [
          {
            round: 0, index: 0, played: true,
            player1: { name: 'Player', isPlayer: true },
            player2: { name: 'Opp1', isPlayer: false },
            winner: { name: 'Player', isPlayer: true },
            p1Score: 1, p2Score: 0,
          },
        ],
        [
          {
            round: 1, index: 0, played: true,
            player1: { name: 'Player', isPlayer: true },
            player2: { name: 'Opp2', isPlayer: false },
            winner: { name: 'Opp2', isPlayer: false },
            p1Score: 1, p2Score: 2,
          },
        ],
      ],
    };

    store.record(engineState);
    const stats = store.getSeasonStats();
    assert.strictEqual(stats.totalEntered, 1);
    assert.strictEqual(stats.championships, 0);
    assert.strictEqual(stats.bestRound, 1);
    assert.strictEqual(stats.totalWins, 1);
    assert.strictEqual(stats.totalLosses, 1);
    assert.strictEqual(stats.currentStreak, 0);
  });

  test('clear resets everything', () => {
    store = new TournamentStore();
    store.record({
      id: 't', status: 'finished', createdAt: 1,
      player: { name: 'P', isPlayer: true },
      mode: '8ball', champion: { name: 'P', isPlayer: true },
      trophy: { name: 'G', icon: '🏆', color: '#ffd700' },
      rounds: [],
    });
    store.clear();
    assert.strictEqual(store.getAll().length, 0);
    const stats = store.getSeasonStats();
    assert.strictEqual(stats.totalEntered, 0);
  });

  test('ignores unfinished tournament', () => {
    store = new TournamentStore();
    const ok = store.record({ id: 'x', status: 'active' });
    assert.strictEqual(ok, false);
    assert.strictEqual(store.getAll().length, 0);
  });

  test('deduplicates rival wins across multiple tournaments', () => {
    store = new TournamentStore();
    const base = {
      status: 'finished',
      createdAt: Date.now(),
      player: { name: 'P', isPlayer: true },
      mode: '8ball',
      champion: { name: 'P', isPlayer: true },
      trophy: { name: 'G', icon: '🏆', color: '#ffd700' },
      rounds: [
        [{
          round: 0, index: 0, played: true,
          player1: { name: 'P', isPlayer: true },
          player2: { name: 'OppA', isPlayer: false },
          winner: { name: 'P', isPlayer: true },
          p1Score: 1, p2Score: 0,
        }],
      ],
    };
    store.record({ ...base, id: 't1' });
    store.record({ ...base, id: 't2' });
    const stats = store.getSeasonStats();
    assert.strictEqual(stats.rivalWins['OppA'], 2);
    assert.strictEqual(stats.totalEntered, 2);
  });
});

describe('TournamentEngine', () => {
  let engine;

  test('creates a tournament with 8 entrants', () => {
    engine = new TournamentEngine();
    const state = engine.create('TestPlayer', 0, '8ball');
    assert.strictEqual(state.status, 'active');
    assert.strictEqual(state.rounds.length, 3);
    assert.strictEqual(state.rounds[0].length, 4);
    assert.strictEqual(state.rounds[1].length, 2);
    assert.strictEqual(state.rounds[2].length, 1);
  });

  test('getMatchPreview returns null when no active match', () => {
    engine = new TournamentEngine();
    assert.strictEqual(engine.getMatchPreview(), null);
  });

  test('getMatchPreview returns preview for current match', () => {
    engine = new TournamentEngine();
    engine.create('TestPlayer', 0, '8ball');
    const preview = engine.getMatchPreview();
    assert.ok(preview);
    assert.ok(preview.opponent);
    assert.strictEqual(typeof preview.opponent.name, 'string');
    assert.ok(preview.opponent.style);
    assert.ok(preview.opponent.styleIcon);
    assert.strictEqual(typeof preview.roundName, 'string');
    assert.strictEqual(typeof preview.format, 'string');
  });

  test('getTournamentSummary after champion', () => {
    engine = new TournamentEngine();
    engine.create('P', 0, '8ball');
    // Simulate winning all matches
    engine.recordGameResult(true);
    engine.recordGameResult(true);
    engine.recordGameResult(true);
    const summary = engine.getTournamentSummary();
    assert.ok(summary);
    assert.strictEqual(summary.isChampion, true);
    assert.strictEqual(summary.opponentsFaced.length, 3);
  });

  test('getTournamentSummary after elimination', () => {
    engine = new TournamentEngine();
    engine.create('P', 0, '8ball');
    engine.recordGameResult(false);
    const summary = engine.getTournamentSummary();
    assert.ok(summary);
    assert.strictEqual(summary.isChampion, false);
    assert.strictEqual(summary.opponentsFaced.length, 1);
  });
});

describe('TournamentData', () => {
  test('getStyleMeta returns icon and desc', () => {
    const meta = getStyleMeta('进攻型');
    assert.strictEqual(meta.icon, '⚔️');
    assert.ok(meta.desc.length > 0);
  });

  test('getStyleMeta returns fallback for unknown style', () => {
    const meta = getStyleMeta('未知风格');
    assert.strictEqual(meta.icon, '🎱');
  });

  test('buildMatchPreview returns structured preview', () => {
    const match = {
      round: 0,
      gamesNeeded: 1,
      mode: '8ball',
      player1: { name: 'Player', isPlayer: true, style: '自定义' },
      player2: { name: 'Opp', isPlayer: false, style: '进攻型', title: '街头新秀', color: '#e07050' },
    };
    const preview = buildMatchPreview(match, { totalEntered: 5 });
    assert.ok(preview);
    assert.strictEqual(preview.opponent.name, 'Opp');
    assert.strictEqual(preview.opponent.styleIcon, '⚔️');
    assert.strictEqual(preview.seasonStats.totalEntered, 5);
  });

  test('buildMatchPreview handles null match', () => {
    assert.strictEqual(buildMatchPreview(null), null);
  });
});
