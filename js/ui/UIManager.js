import { TOWERS } from '../constants.js';

/**
 * Manages all DOM UI: HUD stats, tower selection, modals, toasts, float text.
 */
export class UIManager {
  constructor() {
    // Stat displays
    this._goldEl  = document.getElementById('gold-value');
    this._livesEl = document.getElementById('lives-value');
    this._waveEl  = document.getElementById('wave-value');
    this._scoreEl = document.getElementById('score-value');

    // Tower strip
    this._towerBtns = document.querySelectorAll('.tower-btn');
    this._startBtn  = document.getElementById('start-wave-btn');
    this._startLbl  = document.getElementById('start-wave-label');

    // Modal
    this._modalOverlay = document.getElementById('modal-overlay');
    this._modalHeader  = document.getElementById('modal-header');
    this._modalBody    = document.getElementById('modal-body');
    this._modalActions = document.getElementById('modal-actions');

    // Toast
    this._toast      = document.getElementById('toast');
    this._toastTimer = null;

    // Floats
    this._floatsEl = document.getElementById('floats');

    this.selectedTower = null;
    this._onSelectTower = null;
    this._onStartWave   = null;

    this._bindTowerButtons();
    this._bindStartButton();
  }

  // ----------------------------------------------------------------
  // Callbacks
  // ----------------------------------------------------------------

  onSelectTower(fn) { this._onSelectTower = fn; }
  onStartWave(fn)   { this._onStartWave   = fn; }

  // ----------------------------------------------------------------
  // HUD updates
  // ----------------------------------------------------------------

  updateGold(gold) {
    if (this._goldEl) this._goldEl.textContent = gold;
    this._refreshAffordability(gold);
  }

  updateLives(lives) {
    if (this._livesEl) this._livesEl.textContent = lives;
  }

  updateWave(wave) {
    if (this._waveEl) this._waveEl.textContent = wave === 0 ? '—' : wave;
  }

  updateScore(score) {
    if (this._scoreEl) this._scoreEl.textContent = score.toLocaleString();
  }

  setStartButtonState(canStart, label) {
    if (!this._startBtn) return;
    this._startBtn.disabled = !canStart;
    if (this._startLbl) this._startLbl.textContent = label;
  }

  // ----------------------------------------------------------------
  // Tower selection
  // ----------------------------------------------------------------

  selectTower(type) {
    this.selectedTower = type;
    this._towerBtns.forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.tower === type);
    });
  }

  deselectTower() {
    this.selectedTower = null;
    this._towerBtns.forEach(btn => btn.classList.remove('selected'));
  }

  _refreshAffordability(gold) {
    this._towerBtns.forEach(btn => {
      const cost = TOWERS[btn.dataset.tower]?.cost ?? Infinity;
      btn.classList.toggle('unaffordable', gold < cost);
    });
  }

  _bindTowerButtons() {
    this._towerBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.tower;
        if (this.selectedTower === type) {
          this.deselectTower();
          this._onSelectTower?.(null);
        } else {
          this.selectTower(type);
          this._onSelectTower?.(type);
        }
      });
    });
  }

  _bindStartButton() {
    this._startBtn?.addEventListener('click', () => {
      this._onStartWave?.();
    });
  }

  // ----------------------------------------------------------------
  // Toast
  // ----------------------------------------------------------------

  showToast(message, duration = 2200) {
    const t = this._toast;
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), duration);
  }

  // ----------------------------------------------------------------
  // Gold float text
  // ----------------------------------------------------------------

  showGoldFloat(screenX, screenY, amount) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = `+${amount}`;
    el.style.left = `${screenX}px`;
    el.style.top  = `${screenY - 10}px`;
    this._floatsEl?.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // ----------------------------------------------------------------
  // Modal
  // ----------------------------------------------------------------

  showModal({ header, body, actions }) {
    if (!this._modalOverlay) return;
    this._modalHeader.innerHTML  = header;
    this._modalBody.innerHTML    = body;
    this._modalActions.innerHTML = '';

    for (const { label, primary, onClick } of actions) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className   = primary ? 'action-btn' : 'secondary-btn';
      btn.addEventListener('click', () => {
        this.hideModal();
        onClick?.();
      });
      this._modalActions.appendChild(btn);
    }

    this._modalOverlay.classList.remove('hidden');
  }

  hideModal() {
    this._modalOverlay?.classList.add('hidden');
  }

  // ----------------------------------------------------------------
  // Prebuilt modals
  // ----------------------------------------------------------------

  showStartScreen(onStart) {
    this.showModal({
      header: 'Ops Console',
      body: `
        <p>Threats are inbound. Deploy defenses along the perimeter to prevent a breach.</p>
        <p style="margin-top:10px;color:var(--text-muted);font-size:12px;">
          Tap a tower type, then tap the grid to deploy.<br>
          Start each wave when ready.
        </p>
      `,
      actions: [{ label: 'Begin deployment', primary: true, onClick: onStart }],
    });
  }

  showWaveComplete(wave, bonus, onContinue) {
    this.showModal({
      header: `Wave ${wave} cleared`,
      body: `<p>+${bonus} credits awarded.</p><p>Reinforce your perimeter before the next incursion.</p>`,
      actions: [{ label: `Start wave ${wave + 1}`, primary: true, onClick: onContinue }],
    });
  }

  showGameOver(wave, score, onRestart) {
    this.showModal({
      header: 'Connection lost',
      body: `
        <p>Perimeter breached. 0 lives remaining.</p>
        <p style="margin-top:8px">
          <span style="color:var(--text-secondary)">Survived:</span>
          <span style="font-family:var(--font-mono);margin-left:8px">Wave ${wave}</span>
        </p>
        <p>
          <span style="color:var(--text-secondary)">Final score:</span>
          <span style="font-family:var(--font-mono);margin-left:8px">${score.toLocaleString()}</span>
        </p>
      `,
      actions: [{ label: 'Restart deployment', primary: true, onClick: onRestart }],
    });
  }

  showVictory(score, onRestart) {
    this.showModal({
      header: 'Perimeter secured',
      body: `
        <p>All waves repelled. The network is safe.</p>
        <p style="margin-top:8px">
          <span style="color:var(--text-secondary)">Final score:</span>
          <span style="font-family:var(--font-mono);margin-left:8px">${score.toLocaleString()}</span>
        </p>
      `,
      actions: [
        { label: 'Deploy again', primary: true, onClick: onRestart },
      ],
    });
  }
}
