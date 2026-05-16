/**
 * OnboardingStore — Lightweight first-time user guidance state.
 *
 * Saved independently from settings so a reset tutorial does not wipe
 * player preferences.  Each flag defaults to false (not yet shown).
 */

const STORAGE_KEY = 'billiards_onboarding_v1';

const DEFAULTS = {
  gameTutorialStep: 0,      // 0=none, 1=aim, 2=charge, 3=spin, 4=done
  foulExplained: false,
  ballInHandExplained: false,
  settingsExplained: false,
};

export class OnboardingStore {
  constructor() {
    this._data = { ...DEFAULTS };
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this._data = { ...DEFAULTS, ...parsed };
      }
    } catch (e) {
      console.warn('Onboarding load failed');
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.warn('Onboarding save failed');
    }
  }

  get(key) {
    return this._data[key];
  }

  set(key, value) {
    this._data[key] = value;
    this._save();
  }

  /** Mark one tutorial step as shown. */
  step(key) {
    if (!this._data[key]) {
      this._data[key] = true;
      this._save();
    }
  }

  /** Advance game tutorial to next step (1→2→3→4). */
  advanceGameTutorial() {
    if (this._data.gameTutorialStep < 4) {
      this._data.gameTutorialStep++;
      this._save();
    }
  }

  /** Whether any onboarding is still pending. */
  isNewPlayer() {
    return Object.values(this._data).some((v) => v === false || (typeof v === 'number' && v < 4));
  }

  /** Reset everything so tips appear again. */
  reset() {
    this._data = { ...DEFAULTS };
    this._save();
  }
}

export const onboarding = new OnboardingStore();
