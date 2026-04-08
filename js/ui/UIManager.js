import { TOWERS, UPGRADES, DIFFICULTIES } from '../constants.js';

export class UIManager {
  constructor() {
    this._goldEl  = document.getElementById('gold-value');
    this._livesEl = document.getElementById('lives-value');
    this._waveEl  = document.getElementById('wave-value');
    this._scoreEl = document.getElementById('score-value');

    this._towerBtns = document.querySelectorAll('.tower-btn');
    this._startBtn  = document.getElementById('start-wave-btn');
    this._startLbl  = document.getElementById('start-wave-label');

    this._modalOverlay = document.getElementById('modal-overlay');
    this._modalHeader  = document.getElementById('modal-header');
    this._modalBody    = document.getElementById('modal-body');
    this._modalActions = document.getElementById('modal-actions');

    this._toast      = document.getElementById('toast');
    this._toastTimer = null;

    this._floatsEl = document.getElementById('floats');

    // Speed control
    this._speedBtn       = document.getElementById('speed-btn');
    this._onSpeedToggle  = null;

    // Wave preview
    this._wavePreviewRow  = document.getElementById('wave-preview-row');
    this._wavePreviewText = document.getElementById('wave-preview-text');

    this._bindSpeedButton();

    // Tower info panel
    this._towerPanel   = document.getElementById('tower-panel');
    this._tpName       = document.getElementById('tp-name');
    this._tpLevel      = document.getElementById('tp-level');
    this._tpStats      = document.getElementById('tp-stats');
    this._tpUpgradeBtn = document.getElementById('tp-upgrade');
    this._tpSellBtn    = document.getElementById('tp-sell');
    this._tpCloseBtn   = document.getElementById('tp-close');

    this.selectedTowerType = null; // placing selection
    this._currentGold = 0;

    this._onSelectTower = null;
    this._onStartWave   = null;
    this._onSellTower   = null;
    this._onUpgradeTower = null;

    this._bindTowerButtons();
    this._bindStartButton();
    this._bindTowerPanel();
  }

  // ----------------------------------------------------------------
  // Callbacks
  // ----------------------------------------------------------------

  onSelectTower(fn)  { this._onSelectTower  = fn; }
  onStartWave(fn)    { this._onStartWave    = fn; }
  onSellTower(fn)    { this._onSellTower    = fn; }
  onUpgradeTower(fn) { this._onUpgradeTower = fn; }
  onSpeedToggle(fn)  { this._onSpeedToggle  = fn; }

  // ----------------------------------------------------------------
  // HUD
  // ----------------------------------------------------------------

  updateGold(gold) {
    this._currentGold = gold;
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
  // Tower selection (placing)
  // ----------------------------------------------------------------

  selectTower(type) {
    this.selectedTowerType = type;
    this._towerBtns.forEach(btn => btn.classList.toggle('selected', btn.dataset.tower === type));
  }

  deselectTower() {
    this.selectedTowerType = null;
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
        if (this.selectedTowerType === type) {
          this.deselectTower();
          this._onSelectTower?.(null);
        } else {
          this.deselectTower();
          this.hideTowerPanel();
          this.selectTower(type);
          this._onSelectTower?.(type);
        }
      });
    });
  }

  _bindStartButton() {
    this._startBtn?.addEventListener('click', () => this._onStartWave?.());
  }

  _bindSpeedButton() {
    this._speedBtn?.addEventListener('click', () => this._onSpeedToggle?.());
  }

  // ----------------------------------------------------------------
  // Speed display
  // ----------------------------------------------------------------

  setSpeed(multiplier) {
    if (!this._speedBtn) return;
    const isFast = multiplier > 1;
    this._speedBtn.textContent = `${multiplier}×`;
    this._speedBtn.classList.toggle('fast', isFast);
    this._speedBtn.setAttribute('aria-label', `Speed: ${multiplier}×`);
  }

  // ----------------------------------------------------------------
  // Wave preview
  // ----------------------------------------------------------------

  updateWavePreview(counts) {
    if (!this._wavePreviewRow || !this._wavePreviewText) return;
    const parts = [];
    if (counts.basic) parts.push(`${counts.basic} basic`);
    if (counts.fast)  parts.push(`${counts.fast} fast`);
    if (counts.tank)  parts.push(`${counts.tank} tank`);
    if (parts.length === 0) {
      this._wavePreviewRow.classList.add('hidden');
    } else {
      this._wavePreviewText.textContent = parts.join('  ·  ');
      this._wavePreviewRow.classList.remove('hidden');
    }
  }

  hideWavePreview() {
    this._wavePreviewRow?.classList.add('hidden');
  }

  // ----------------------------------------------------------------
  // Tower info panel
  // ----------------------------------------------------------------

  showTowerPanel(tower) {
    if (!this._towerPanel) return;

    const def = TOWERS[tower.type];
    const up  = UPGRADES[tower.type];

    this._tpName.textContent  = def.displayName;
    this._tpLevel.textContent = tower.level === 2 ? 'LVL 2 — MAX' : 'LVL 1';

    const dmgFmt   = tower.damage.toFixed(0);
    const rangeFmt = (tower.range / this._lastTileSize || 1).toFixed(1);
    const frFmt    = tower.fireRate.toFixed(1);

    this._tpStats.innerHTML = `
      DMG&nbsp;&nbsp;${dmgFmt}&nbsp;&nbsp;|&nbsp;&nbsp;RNG&nbsp;${(tower._def.range * (tower._upgradeRangeX || 1)).toFixed(1)} tiles&nbsp;&nbsp;|&nbsp;&nbsp;RATE&nbsp;${frFmt}/s
      ${tower.type === 'frost' ? `<br>SLOW ${(tower.slowFactor * 100).toFixed(0)}%&nbsp;&nbsp;|&nbsp;&nbsp;DUR ${tower.slowDuration}s` : ''}
    `;

    if (tower.canUpgrade) {
      const canAfford = this._currentGold >= up.cost;
      this._tpUpgradeBtn.textContent = `Upgrade — ${up.cost} cr`;
      this._tpUpgradeBtn.disabled    = !canAfford;
      this._tpUpgradeBtn.style.display = '';
    } else {
      this._tpUpgradeBtn.style.display = 'none';
    }

    this._tpSellBtn.textContent = `Sell — +${tower.sellValue} cr`;

    this._activeTower = tower;
    this._towerPanel.classList.remove('hidden');
  }

  hideTowerPanel() {
    this._towerPanel?.classList.add('hidden');
    this._activeTower = null;
  }

  /** Called on resize so stat display has correct tile size */
  setTileSize(px) { this._lastTileSize = px; }

  _bindTowerPanel() {
    this._tpCloseBtn?.addEventListener('click', () => {
      this.hideTowerPanel();
      this._onSellTower?.(null); // null = just deselect
    });

    this._tpSellBtn?.addEventListener('click', () => {
      if (this._activeTower) this._onSellTower?.(this._activeTower);
      this.hideTowerPanel();
    });

    this._tpUpgradeBtn?.addEventListener('click', () => {
      if (this._activeTower) this._onUpgradeTower?.(this._activeTower);
      // Refresh panel stats after upgrade
      if (this._activeTower) this.showTowerPanel(this._activeTower);
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
  // Gold floats
  // ----------------------------------------------------------------

  showGoldFloat(screenX, screenY, amount) {
    const el = document.createElement('div');
    el.className    = 'float-text';
    el.textContent  = `+${amount}`;
    el.style.left   = `${screenX}px`;
    el.style.top    = `${screenY}px`;
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
          Tap a tower type to select, then tap the grid to deploy.<br>
          Tap a placed tower to upgrade or sell it.<br>
          Start each wave when ready.
        </p>
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:6px;" id="difficulty-select">
          ${Object.entries(DIFFICULTIES).map(([key, d]) => `
            <button class="secondary-btn diff-btn" data-diff="${key}" style="text-align:left;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:500;color:var(--text-primary)">${d.label}</span>
              <span style="font-size:11px;color:var(--text-secondary)">${d.description}</span>
            </button>
          `).join('')}
        </div>
      `,
      actions: [],
    });

    // Wire difficulty buttons (they replace the modal actions)
    const container = document.getElementById('difficulty-select');
    if (container) {
      container.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.diff;
          this.hideModal();
          onStart(DIFFICULTIES[key]);
        });
      });
      // Default highlight
      container.querySelector('[data-diff="normal"]')?.classList.add('selected');
    }
  }

  showWaveComplete(wave, bonus, onContinue) {
    this.showModal({
      header: `Wave ${wave} cleared`,
      body: `<p>+${bonus} credits awarded.</p><p>Reinforce your perimeter before the next incursion.</p>`,
      actions: [{ label: `Start wave ${wave + 1}`, primary: true, onClick: onContinue }],
    });
  }

  showGameOver(wave, score, diffLabel, onRestart) {
    this.showModal({
      header: 'Connection lost',
      body: `
        <p>Perimeter breached. 0 lives remaining.</p>
        <p style="margin-top:8px">
          <span style="color:var(--text-secondary)">Survived:</span>
          <span style="font-family:var(--font-mono);margin-left:8px">Wave ${wave}</span>
        </p>
        <p>
          <span style="color:var(--text-secondary)">Difficulty:</span>
          <span style="font-family:var(--font-mono);margin-left:8px">${diffLabel}</span>
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
      actions: [{ label: 'Deploy again', primary: true, onClick: onRestart }],
    });
  }
}
