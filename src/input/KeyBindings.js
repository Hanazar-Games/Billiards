/**
 * KeyBindings — Centralised keyboard-shortcut manager.
 *
 * Reads/writes bindings via SettingsStore so they persist across sessions.
 * Provides a clean API for Game.js to query "was action X triggered?"
 * without hard-coding key names.
 */
import { settings } from '../core/SettingsStore.js';

export const ACTIONS = {
  cameraFree:   { label: '自由视角',   default: '1' },
  cameraTop:    { label: '俯视视角',   default: '2' },
  cameraFollow: { label: '跟随视角',   default: '3' },
  spinUp:       { label: '高杆',       default: 'w' },
  spinDown:     { label: '低杆',       default: 's' },
  spinLeft:     { label: '左塞',       default: 'a' },
  spinRight:    { label: '右塞',       default: 'd' },
  spinReset:    { label: '重置球杆',   default: 'r' },
  pause:        { label: '暂停',       default: 'escape' },
};

const ACTION_KEYS = Object.keys(ACTIONS);

export class KeyBindings {
  constructor() {
    this._bindings = this._load();
    this._waitingAction = null;
    this._waitingCallback = null;
    this._keyDownHandler = this._onKeyDown.bind(this);
  }

  _load() {
    const stored = settings.get('keyBindings') || {};
    const result = {};
    for (const key of ACTION_KEYS) {
      result[key] = stored[key] ?? ACTIONS[key].default;
    }
    return result;
  }

  _save() {
    settings.set('keyBindings', { ...this._bindings });
  }

  getBinding(action) {
    return this._bindings[action] ?? ACTIONS[action]?.default;
  }

  setBinding(action, key) {
    if (!ACTIONS[action]) return false;
    key = key.toLowerCase();
    // Check for conflicts
    const conflicts = this.getConflicts(action, key);
    if (conflicts.length > 0) {
      // Swap: unbind the conflicting action
      for (const other of conflicts) {
        this._bindings[other] = '';
      }
    }
    this._bindings[action] = key;
    this._save();
    return true;
  }

  getConflicts(action, key) {
    key = key.toLowerCase();
    const conflicts = [];
    for (const [otherAction, boundKey] of Object.entries(this._bindings)) {
      if (otherAction !== action && boundKey === key) {
        conflicts.push(otherAction);
      }
    }
    return conflicts;
  }

  resetToDefaults() {
    for (const key of ACTION_KEYS) {
      this._bindings[key] = ACTIONS[key].default;
    }
    this._save();
  }

  /** Check if a pressed key matches the binding for an action. */
  matches(action, pressedKey) {
    const bound = this.getBinding(action);
    return bound && pressedKey.toLowerCase() === bound;
  }

  /** Enter "listening" mode: the next key pressed becomes the new binding for action. */
  startListening(action, onKey) {
    this._waitingAction = action;
    this._waitingCallback = onKey;
    window.addEventListener('keydown', this._keyDownHandler, { once: true });
  }

  cancelListening() {
    this._waitingAction = null;
    this._waitingCallback = null;
    window.removeEventListener('keydown', this._keyDownHandler);
  }

  _onKeyDown(e) {
    if (!this._waitingAction || !this._waitingCallback) return;
    // Ignore modifier-only keys
    if (['shift', 'control', 'alt', 'meta'].includes(e.key.toLowerCase())) return;
    const key = e.key.toLowerCase();
    this._waitingCallback(this._waitingAction, key);
    this._waitingAction = null;
    this._waitingCallback = null;
  }
}

export const keyBindings = new KeyBindings();
