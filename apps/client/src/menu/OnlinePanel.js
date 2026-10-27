/**
 * OnlinePanel — the online entry (D063): a guest name, the 1×1 queue, a
 * private room with its code, joining by code and the return to a match left
 * after a reload. The logic is here; OnlinePanelView draws it (tests give
 * their own view). Texts in PT-BR.
 */
import { OnlineMatchController } from '../match/OnlineMatchController.js';
import { getTableProfile } from '../game/TableProfiles.js';

export const ONLINE_PANEL_TEXT = Object.freeze({
  title: 'Jogar online',
  unavailable: 'Jogo online indisponível nesta versão',
  connecting: 'Conectando…',
  username: 'Seu nome',
  save: 'Salvar',
  queue8: 'Fila 8-ball',
  queue9: 'Fila 9-ball',
  createRoom: 'Criar sala',
  joinByCode: 'Entrar com código',
  roomCode: 'Código da sala',
  cancel: 'Cancelar',
  back: 'Voltar',
  waiting: 'Aguardando o adversário…',
  searching: 'Procurando adversário…',
  returning: 'Voltando à partida…',
  noShow: 'O adversário não apareceu',
});

const ERROR_TEXT = {
  USERNAME_INVALID: 'Nome inválido (3 a 16 letras, números ou _)',
  USERNAME_TAKEN: 'Esse nome já existe',
  CODE_INVALID: 'Código inválido',
  ROOM_NOT_FOUND: 'Sala não encontrada',
  ROOM_FULL: 'Sala cheia',
  PROTOCOL_MISMATCH: 'O jogo foi atualizado. Recarregue a página.',
  NETWORK: 'Sem conexão com o servidor',
};

/** The message of a failed online action. */
export const errorText = (err) => ERROR_TEXT[err?.code] ?? ERROR_TEXT.NETWORK;

export class OnlinePanel {
  /**
   * @param {{ config: object | null, createSession: (config: object) => any, onStart: (controller: any) => void,
   *   onBack: () => void, createController?: (options: object) => any, view?: OnlinePanelView }} options
   */
  constructor({ config, createSession, onStart, onBack, createController = (o) => new OnlineMatchController(o), view = new OnlinePanelView() }) {
    this.config = config;
    this.createSession = createSession;
    this.createController = createController;
    this.onStart = onStart;
    this.onBack = onBack;
    this.view = view;
    this.session = null;
    this.model = { state: 'connecting', username: '', code: '', message: '' };
    /** The match being entered (a room waiting, a join), until the game starts. */
    this._entry = null;
    this._destroyed = false;
    this._onConnection = null;
  }

  _render(changes) {
    if (this._destroyed) return;
    Object.assign(this.model, changes);
    this.view.render({ ...this.model });
  }

  async show() {
    this.view.show();
    this.view.bind(this);
    if (!this.config) {
      this._render({ state: 'unavailable', message: ONLINE_PANEL_TEXT.unavailable });
      return;
    }
    this._render({ state: 'connecting', message: ONLINE_PANEL_TEXT.connecting });
    try {
      this.session = this.createSession(this.config);
      this._watchConnection();
      const { username } = await this.session.start();
      this._render({ state: 'lobby', username: username ?? '', message: '' });
    } catch (err) {
      this._render({ state: 'offline', message: errorText(err) });
      return;
    }
    const stored = this.session.storedMatchId();
    if (!stored) return;
    try {
      this._render({ state: 'joining', message: ONLINE_PANEL_TEXT.returning });
      await this._enter(stored, null);
    } catch (err) {
      this._render({ state: 'lobby', message: err?.code === 'MATCH_ENDED' ? '' : errorText(err) });
    }
  }

  async setUsername(name) {
    try {
      const username = await this.session.setUsername(String(name ?? '').trim());
      this._render({ username, message: '' });
    } catch (err) {
      this._render({ message: errorText(err) });
    }
  }

  async queue(mode) {
    this._render({ state: 'queue', message: ONLINE_PANEL_TEXT.searching });
    let matchId;
    try {
      matchId = await this.session.queue(mode);
    } catch (err) {
      this._render({ state: 'lobby', message: err?.code === 'CANCELLED' ? '' : errorText(err) });
      return;
    }
    if (this._destroyed) return; // the panel closed while queued: the match goes without us
    await this._enterOrLobby(matchId, mode);
  }

  async cancelQueue() {
    await this.session?.cancelQueue();
  }

  /** Cancelar: out of the queue, or out of the room or match being entered, back to the lobby. */
  async cancel() {
    if (this.model.state === 'queue') {
      await this.cancelQueue();
      return;
    }
    await this._abandonEntry({ leave: true });
    this._render({ state: 'lobby', code: '', message: '' });
  }

  /** A connection lost for good stops any wait: nothing starts later on its own. */
  _watchConnection() {
    if (this._onConnection || typeof this.session?.addEventListener !== 'function') return;
    this._onConnection = (e) => {
      const state = e.detail?.state;
      if (state !== 'offline' && state !== 'replaced') return;
      this._abandonEntry({ leave: false });
      this._render({ state: 'offline', code: '', message: errorText({ code: 'NETWORK' }) });
    };
    this.session.addEventListener('connection', this._onConnection);
  }

  /** Drops the match being entered; `leave` also takes this player out of it on the server. */
  async _abandonEntry({ leave }) {
    const entry = this._entry;
    if (!entry) return;
    this._entry = null;
    entry.controller?.dispose();
    if (leave) await this.session.leaveMatch().catch(() => {});
  }

  async createRoom(mode) {
    try {
      const { matchId, code } = await this.session.createRoom(mode);
      this._render({ state: 'room', code, message: ONLINE_PANEL_TEXT.waiting });
      await this._enter(matchId, mode, { room: true });
    } catch (err) {
      this._render({ state: 'lobby', code: '', message: errorText(err) });
    }
  }

  async joinByCode(code) {
    const normalized = String(code ?? '').trim().toUpperCase();
    try {
      const matchId = await this.session.joinByCode(normalized);
      await this._enter(matchId, null);
    } catch (err) {
      this._render({ state: 'lobby', message: errorText(err) });
    }
  }

  async _enterOrLobby(matchId, mode) {
    try {
      await this._enter(matchId, mode);
    } catch (err) {
      this._render({ state: 'lobby', message: errorText(err) });
    }
  }

  /**
   * Joins the match and waits for its first snapshot (the server sends it when
   * both seats are taken, or on a return) before the game starts.
   */
  async _enter(matchId, modeId, { room = false } = {}) {
    this._render({ state: room ? 'room' : 'joining', message: room ? ONLINE_PANEL_TEXT.waiting : this.model.message || ONLINE_PANEL_TEXT.waiting });
    const entry = { controller: null };
    this._entry = entry;
    // Cancelled (or closed, or disconnected) meanwhile: whatever comes later is dropped.
    const dropped = () => this._entry !== entry;
    try {
      await this.session.joinMatch(matchId);
    } catch (err) {
      if (dropped()) return;
      this._entry = null;
      throw err;
    }
    if (dropped()) return;
    const controller = this.createController({ session: this.session, matchId, modeId, tableProfile: getTableProfile('pool9ft') });
    entry.controller = controller;
    try {
      await controller.whenReady();
    } catch (err) {
      controller.dispose();
      if (dropped()) return;
      this._entry = null;
      if (err?.end) {
        // A queue match whose opponent never came (30 s) ends before it starts.
        this.session.forgetMatch();
        this._render({ state: 'lobby', code: '', message: ONLINE_PANEL_TEXT.noShow });
        return;
      }
      throw err;
    }
    if (dropped()) {
      controller.dispose();
      return;
    }
    this._entry = null;
    this.onStart(controller);
  }

  /** The panel closes (Voltar, or the game starts): a room or queue left open goes with it. */
  destroy() {
    if (this.model.state === 'queue') this.cancelQueue().catch(() => {});
    this._abandonEntry({ leave: true });
    this._destroyed = true;
    if (this._onConnection) this.session?.removeEventListener('connection', this._onConnection);
    this._onConnection = null;
    this.view.destroy();
  }
}

/** The panel's DOM, in the menu layer like the other panels. */
export class OnlinePanelView {
  constructor() {
    this.container = null;
    this._els = {};
  }

  show() {
    if (this.container) return;
    const layer = document.getElementById('menu-layer');
    if (!layer) return;
    const T = ONLINE_PANEL_TEXT;
    const el = (tag, css, text) => {
      const node = document.createElement(tag);
      if (css) node.style.cssText = css;
      if (text) node.textContent = text;
      return node;
    };
    const button = (text) => el('button', 'padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;cursor:pointer;font-size:14px;', text);
    const input = (placeholder) => {
      const node = el('input', 'flex:1;min-width:0;padding:10px 12px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;background:rgba(255,255,255,0.06);color:#fff;');
      node.placeholder = placeholder;
      return node;
    };
    const row = () => el('div', 'display:flex;gap:8px;align-items:center;');

    this.container = el('div', 'display:flex;align-items:center;justify-content:center;position:absolute;inset:0;z-index:2;');
    this.container.id = 'online-panel';
    const card = el('div', 'background:var(--panel-strong, rgba(20,24,28,0.92));border:1px solid var(--line, rgba(255,255,255,0.12));border-radius:16px;padding:28px 32px;min-width:340px;max-width:420px;display:flex;flex-direction:column;gap:14px;box-shadow:0 24px 80px rgba(0,0,0,0.5);');
    card.appendChild(el('div', 'font-size:20px;font-weight:800;color:#fff;text-align:center;', `🌐 ${T.title}`));
    const message = el('div', 'min-height:20px;color:#d8b15f;font-size:14px;text-align:center;');
    card.appendChild(message);

    const nameRow = row();
    const name = input(T.username);
    name.maxLength = 16;
    const save = button(T.save);
    nameRow.append(name, save);

    const queueRow = row();
    const queue8 = button(T.queue8);
    const queue9 = button(T.queue9);
    queueRow.append(queue8, queue9);

    const roomRow = row();
    const roomMode = el('select', 'padding:9px;border-radius:8px;background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.2);');
    for (const [value, label] of [['8ball', '8-ball'], ['9ball', '9-ball']]) {
      const option = el('option', '', label);
      option.value = value;
      roomMode.appendChild(option);
    }
    const create = button(T.createRoom);
    roomRow.append(roomMode, create);

    const codeRow = row();
    const code = input(T.roomCode);
    code.maxLength = 8;
    const join = button(T.joinByCode);
    codeRow.append(code, join);

    const roomCode = el('div', 'font-size:28px;font-weight:800;letter-spacing:6px;color:#fff;text-align:center;');
    const cancel = button(T.cancel);
    const back = button(T.back);

    card.append(nameRow, queueRow, roomRow, codeRow, roomCode, cancel, back);
    this.container.appendChild(card);
    layer.appendChild(this.container);
    this._els = { message, name, save, queue8, queue9, roomMode, create, code, join, roomCode, cancel, back, rows: { nameRow, queueRow, roomRow, codeRow } };
  }

  /** Wires the controls to the panel's actions. */
  bind(panel) {
    const e = this._els;
    if (!e.save) return;
    e.save.onclick = () => panel.setUsername(e.name.value);
    e.queue8.onclick = () => panel.queue('8ball');
    e.queue9.onclick = () => panel.queue('9ball');
    e.create.onclick = () => panel.createRoom(e.roomMode.value);
    e.join.onclick = () => panel.joinByCode(e.code.value);
    e.cancel.onclick = () => panel.cancel();
    e.back.onclick = () => panel.onBack();
  }

  render(model) {
    const e = this._els;
    if (!e.message) return;
    e.message.textContent = model.message ?? '';
    if (document.activeElement !== e.name) e.name.value = model.username ?? '';
    const lobby = model.state === 'lobby';
    for (const r of Object.values(e.rows)) r.style.display = lobby ? 'flex' : 'none';
    e.roomCode.textContent = model.state === 'room' ? model.code : '';
    e.roomCode.style.display = model.state === 'room' ? 'block' : 'none';
    e.cancel.style.display = ['queue', 'room', 'joining'].includes(model.state) ? 'block' : 'none';
    e.back.style.display = lobby || model.state === 'unavailable' || model.state === 'offline' ? 'block' : 'none';
  }

  hide() {
    if (this.container) this.container.style.display = 'none';
  }

  destroy() {
    this.container?.remove();
    this.container = null;
    this._els = {};
  }
}
