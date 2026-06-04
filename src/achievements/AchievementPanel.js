/**
 * AchievementPanel — UI for viewing and tracking achievements.
 *
 * Features:
 *   - Slide-in notification toast when an achievement unlocks
   *   - Full achievement wall (accessible from main menu)
   *   - Category filtering
   *   - Progress counters
   */
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from './AchievementData.js';
import { animMs, isReducedMotion } from '../core/AnimSpeed.js';


export class AchievementPanel {
  constructor(achievementSystem) {
    this.system = achievementSystem;
    this.toastContainer = null;
    this.wallContainer = null;
    this._wallShown = false;
    this._activeToasts = [];   // { element, dismissTimer, removeTimer }
    this._toastQueue = [];     // queued achievement ids
    this._toastRaf = null;
    this._ownsToastContainer = false;
    this._maxVisibleToasts = 3;
    this._buildToast();
    this._setupKeyboard();
  }

  // ── Toast Notification ──

  _buildToast() {
    // Singleton: reuse existing toast container if present
    const existing = document.getElementById('achievement-toast-container');
    if (existing) {
      this.toastContainer = existing;
      this._ownsToastContainer = false;
      return;
    }

    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'achievement-toast-container';
    this.toastContainer.style.cssText = `
      position: fixed;
      top: calc(var(--hud-top-safe) + 16px);
      right: calc(var(--hud-right-safe) + 16px);
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      z-index: 100;
      pointer-events: none;
      max-height: calc(100vh - var(--hud-top-safe) - var(--hud-bottom-safe) - 32px);
      overflow: hidden;
    `;
    document.body.appendChild(this.toastContainer);
    this._ownsToastContainer = true;
  }

  showToast(id) {
    if (!this.toastContainer) return;
    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    if (!ach) return;

    if (this._activeToasts.length >= this._maxVisibleToasts) {
      if (!this._toastQueue.includes(id)) this._toastQueue.push(id);
      return;
    }

    this._renderToast(ach);
  }

  _renderToast(ach) {
    const cat = ACHIEVEMENT_CATEGORIES[ach.category];
    const reduced = isReducedMotion();

    const toast = document.createElement('div');
    toast.style.cssText = `
      display: flex; align-items: center; gap: 14px;
      padding: 14px 20px;
      background: rgba(12,15,18,0.9);
      border: 1px solid ${cat.color}66;
      border-radius: 8px;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 16px ${cat.color}22;
      transform: translateX(120%);
      opacity: 0;
      transition: transform ${reduced ? '0.01ms' : 'calc(0.5s / var(--ui-anim-speed))'} cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${reduced ? '0.01ms' : '0.4s'} ease;
      pointer-events: none;
      min-width: 280px;
      max-width: min(400px, calc(100vw - var(--hud-right-safe) - var(--hud-left-safe) - 32px));
    `;

    const icon = document.createElement('div');
    icon.textContent = ach.icon;
    icon.style.cssText = 'font-size: 32px; line-height: 1;';
    toast.appendChild(icon);

    const textBlock = document.createElement('div');
    textBlock.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const titleRow = document.createElement('div');
    titleRow.innerHTML = `<span style="color:${cat.color};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">成就解锁</span>`;
    textBlock.appendChild(titleRow);

    const nameRow = document.createElement('div');
    nameRow.textContent = ach.name;
    nameRow.style.cssText = 'font-size: 16px; font-weight: 700; color: #fff;';
    textBlock.appendChild(nameRow);

    const descRow = document.createElement('div');
    descRow.textContent = ach.desc;
    descRow.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.6);';
    textBlock.appendChild(descRow);

    toast.appendChild(textBlock);
    this.toastContainer.appendChild(toast);

    const entry = { element: toast, dismissTimer: null, removeTimer: null };
    this._activeToasts.push(entry);

    // Animate in
    const animateIn = () => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    };

    if (reduced) {
      animateIn();
    } else {
      if (this._toastRaf) cancelAnimationFrame(this._toastRaf);
      this._toastRaf = requestAnimationFrame(() => {
        this._toastRaf = null;
        animateIn();
      });
    }

    // Auto dismiss
    const dismissMs = reduced ? 2000 : 3500;
    entry.dismissTimer = setTimeout(() => {
      toast.style.transform = 'translateX(120%)';
      toast.style.opacity = '0';
      entry.removeTimer = setTimeout(() => {
        this._removeToastEntry(entry);
      }, reduced ? 50 : animMs(500));
    }, dismissMs);
  }

  _removeToastEntry(entry) {
    const idx = this._activeToasts.indexOf(entry);
    if (idx !== -1) this._activeToasts.splice(idx, 1);
    if (entry.element && entry.element.parentNode) {
      entry.element.parentNode.removeChild(entry.element);
    }
    if (entry.dismissTimer) { clearTimeout(entry.dismissTimer); entry.dismissTimer = null; }
    if (entry.removeTimer) { clearTimeout(entry.removeTimer); entry.removeTimer = null; }

    // Process queue
    if (this._toastQueue.length > 0) {
      const nextId = this._toastQueue.shift();
      const ach = ACHIEVEMENTS.find((a) => a.id === nextId);
      if (ach) this._renderToast(ach);
    }
  }

  // ── Achievement Wall (Full Screen) ──

  showWall() {
    if (this._wallShown) return;
    this._wallShown = true;
    if (this.wallContainer) {
      this.wallContainer.style.display = 'flex';
      this._renderWall();
      return;
    }

    this.wallContainer = document.createElement('div');
    this.wallContainer.id = 'achievement-wall';
    this.wallContainer.style.cssText = `
      position: fixed; inset: 0;
      display: none; flex-direction: column;
      align-items: center;
      background:
        linear-gradient(135deg, rgba(16,100,66,0.22), rgba(9,11,13,0.96) 42%),
        linear-gradient(25deg, rgba(122,26,38,0.16), rgba(9,11,13,0.96) 38%);
      backdrop-filter: blur(20px);
      z-index: 200;
      padding: 40px 20px;
      overflow-y: auto;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between;
      align-items: center; width: 100%;
      max-width: 900px; margin-bottom: 30px;
    `;

    const title = document.createElement('div');
    title.innerHTML = '<span style="font-size:28px;font-weight:850;color:#f4f7f4;">成就墙</span>';
    header.appendChild(title);

    const progress = document.createElement('div');
    progress.id = 'ach-progress';
    progress.style.cssText = 'font-size:14px;color:rgba(255,255,255,0.6);';
    header.appendChild(progress);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'ui-action';
    closeBtn.style.cssText = `
      width: 40px; height: 40px;
      font-size: 20px;
      border-radius: 50%;
      pointer-events: auto;
    `;
    closeBtn.onclick = () => this.hideWall();
    header.appendChild(closeBtn);

    this.wallContainer.appendChild(header);

    // Category tabs
    const tabs = document.createElement('div');
    tabs.id = 'ach-tabs';
    tabs.style.cssText = `
      display: flex; gap: 10px; margin-bottom: 24px;
      max-width: 900px; width: 100%;
    `;
    this.wallContainer.appendChild(tabs);

    // Grid
    const grid = document.createElement('div');
    grid.id = 'ach-grid';
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 14px; max-width: 900px; width: 100%;
    `;
    this.wallContainer.appendChild(grid);

    document.body.appendChild(this.wallContainer);
    this._renderWall();
    this.wallContainer.style.display = 'flex';
    if (isReducedMotion()) {
      this.wallContainer.style.animation = 'none';
    } else {
      this.wallContainer.style.animation = 'panelIn calc(0.26s / var(--ui-anim-speed)) cubic-bezier(0.2,0.8,0.2,1) both';
    }
  }

  hide() {
    this.hideWall();
  }

  hideWall() {
    this._wallShown = false;
    if (this.wallContainer) {
      this.wallContainer.style.display = 'none';
    }
  }

  _renderWall() {
    const all = this.system.getAllAchievements();
    const unlockedCount = all.filter((a) => a.unlocked).length;
    const totalCount = all.length;

    // Progress
    const progress = document.getElementById('ach-progress');
    if (progress) {
      progress.textContent = `${unlockedCount} / ${totalCount} 已解锁`;
    }

    // Tabs
    const tabs = document.getElementById('ach-tabs');
    if (tabs) {
      tabs.innerHTML = '';
      const categories = ['ALL', 'SKILL', 'CAREER', 'SPECIAL'];
      categories.forEach((cat) => {
        const btn = document.createElement('button');
        const isAll = cat === 'ALL';
        const catInfo = isAll ? null : ACHIEVEMENT_CATEGORIES[cat];
        const label = isAll ? '全部' : catInfo.label;
        btn.textContent = label;
        btn.style.cssText = `
          padding: 8px 18px; font-size: 13px; font-weight: 600;
          color: #f4f7f4; background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 8px; cursor: pointer;
          pointer-events: auto; transition: all calc(0.2s / var(--ui-anim-speed));
        `;
        btn.onmouseenter = () => {
          btn.style.background = 'rgba(255,255,255,0.16)';
        };
        btn.onmouseleave = () => {
          btn.style.background = 'rgba(255,255,255,0.08)';
        };
        btn.onclick = () => this._renderGrid(cat);
        tabs.appendChild(btn);
      });
    }

    // Initial grid render
    this._renderGrid('ALL');
  }

  _renderGrid(category) {
    const grid = document.getElementById('ach-grid');
    if (!grid) return;
    grid.innerHTML = '';

    let items = this.system.getAllAchievements();
    if (category !== 'ALL') {
      items = items.filter((a) => a.category === category);
    }

    items.forEach((ach) => {
      const cat = ACHIEVEMENT_CATEGORIES[ach.category];
      const isUnlocked = ach.unlocked;

      const card = document.createElement('div');
      card.style.cssText = `
        display: flex; align-items: center; gap: 12px;
        padding: 14px 16px;
        background: ${isUnlocked ? 'rgba(12,15,18,0.74)' : 'rgba(12,15,18,0.42)'};
        border: 1px solid ${isUnlocked ? cat.color + '44' : 'rgba(255,255,255,0.08)'};
        border-radius: 8px;
        transition: all calc(0.2s / var(--ui-anim-speed));
        opacity: ${isUnlocked ? 1 : 0.55};
        box-shadow: 0 14px 38px rgba(0,0,0,0.22);
      `;

      const icon = document.createElement('div');
      icon.textContent = isUnlocked ? ach.icon : '🔒';
      icon.style.cssText = `font-size: 28px; line-height: 1; ${isUnlocked ? '' : 'filter: grayscale(1);'}`;
      card.appendChild(icon);

      const text = document.createElement('div');
      text.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

      const name = document.createElement('div');
      name.textContent = isUnlocked || !ach.hidden ? ach.name : '???';
      name.style.cssText = `
        font-size: 14px; font-weight: 700;
        color: ${isUnlocked ? '#fff' : 'rgba(255,255,255,0.5)'};
      `;
      text.appendChild(name);

      const desc = document.createElement('div');
      desc.textContent = isUnlocked || !ach.hidden ? ach.desc : '隐藏成就 — 解锁后显示';
      desc.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.5);';
      text.appendChild(desc);

      if (isUnlocked && ach.unlockedAt) {
        const date = document.createElement('div');
        date.textContent = new Date(ach.unlockedAt).toLocaleDateString();
        date.style.cssText = 'font-size: 10px; color: ' + cat.color + '88;';
        text.appendChild(date);
      }

      card.appendChild(text);
      grid.appendChild(card);
    });
  }

  destroy() {
    this._wallShown = false;

    // Clear all active toasts and their timers
    this._toastQueue = [];
    for (const entry of this._activeToasts) {
      if (entry.dismissTimer) clearTimeout(entry.dismissTimer);
      if (entry.removeTimer) clearTimeout(entry.removeTimer);
      if (entry.element && entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
    }
    this._activeToasts = [];
    if (this._toastRaf) { cancelAnimationFrame(this._toastRaf); this._toastRaf = null; }

    if (this.toastContainer && this.toastContainer.parentNode && this._ownsToastContainer) {
      this.toastContainer.parentNode.removeChild(this.toastContainer);
    }
    if (this.wallContainer) {
      this.wallContainer.innerHTML = '';
      if (this.wallContainer.parentNode) {
        this.wallContainer.parentNode.removeChild(this.wallContainer);
      }
    }
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    this.toastContainer = null;
    this.wallContainer = null;
  }

  _setupKeyboard() {
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this._wallShown) {
        this.hideWall();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }
}
