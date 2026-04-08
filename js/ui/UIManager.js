import { TOWERS, UPGRADES, DIFFICULTIES, MAPS } from '../constants.js';

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
    this._towerPanel    = document.getElementById('tower-panel');
    this._tpName        = document.getElementById('tp-name');
    this._tpLevel       = document.getElementById('tp-level');
    this._tpStats       = document.getElementById('tp-stats');
    this._tpUpgradeBtnA = document.getElementById('tp-upgrade-a');
    this._tpUpgradeBtnB = document.getElementById('tp-upgrade-b');
    this._tpUpgradePaths = document.getElementById('tp-upgrade-paths');
    this._tpSellBtn     = document.getElementById('tp-sell');
    this._tpCloseBtn    = document.getElementById('tp-close');

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
    if (counts.boss)    parts.push(`⚠ ${counts.boss} zero-day`);
    if (counts.basic)   parts.push(`${counts.basic} bot`);
    if (counts.fast)    parts.push(`${counts.fast} script`);
    if (counts.tank)    parts.push(`${counts.tank} flood`);
    if (counts.armored) parts.push(`${counts.armored} apt`);
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

    const def  = TOWERS[tower.type];
    const ups  = UPGRADES[tower.type];
    const upA  = ups?.a;
    const upB  = ups?.b;

    this._tpName.textContent  = def.displayName;
    this._tpLevel.textContent = tower.level === 2 ? 'LVL 2 — MAX' : 'LVL 1';

    const dmgFmt = tower.damage.toFixed(0);
    const frFmt  = tower.fireRate.toFixed(1);

    this._tpStats.innerHTML = `
      DMG&nbsp;&nbsp;${dmgFmt}&nbsp;&nbsp;|&nbsp;&nbsp;RNG&nbsp;${(tower._def.range * (tower._upgradeRangeX || 1)).toFixed(1)} tiles&nbsp;&nbsp;|&nbsp;&nbsp;RATE&nbsp;${frFmt}/s
      ${tower.type === 'uber' ? `<br>SLOW ${(tower.slowFactor * 100).toFixed(0)}%&nbsp;&nbsp;|&nbsp;&nbsp;DUR ${tower.slowDuration}s` : ''}
    `;

    if (tower.canUpgrade && upA && upB) {
      const canAffordA = this._currentGold >= upA.cost;
      const canAffordB = this._currentGold >= upB.cost;

      this._tpUpgradeBtnA.innerHTML = `<span class="upgrade-name">${upA.displayName}</span><span class="upgrade-lore">${upA.lore}</span>`;
      this._tpUpgradeBtnA.disabled  = !canAffordA;
      this._tpUpgradeBtnA.title     = `${upA.cost} cr`;

      this._tpUpgradeBtnB.innerHTML = `<span class="upgrade-name">${upB.displayName}</span><span class="upgrade-lore">${upB.lore}</span>`;
      this._tpUpgradeBtnB.disabled  = !canAffordB;
      this._tpUpgradeBtnB.title     = `${upB.cost} cr`;

      this._tpUpgradePaths.style.display = '';
    } else {
      this._tpUpgradePaths.style.display = 'none';
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

    this._tpUpgradeBtnA?.addEventListener('click', () => {
      if (this._activeTower) this._onUpgradeTower?.(this._activeTower, 'a');
      if (this._activeTower) this.showTowerPanel(this._activeTower);
    });

    this._tpUpgradeBtnB?.addEventListener('click', () => {
      if (this._activeTower) this._onUpgradeTower?.(this._activeTower, 'b');
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
    let selectedMapIndex = 0;
    let selectedDiff     = 'normal';

    // Build map toggle options — split "Alpha — Gateway" into label + sub
    const mapToggles = MAPS.map((m, i) => {
      const parts = m.name.split(' — ');
      const label = parts[0].trim();
      const sub   = parts[1] ? parts[1].trim() : '';
      return `<button class="toggle-opt${i === 0 ? ' selected' : ''}" data-map="${i}">
        <span class="toggle-opt-label">${label}</span>
        ${sub ? `<span class="toggle-opt-sub">${sub}</span>` : ''}
      </button>`;
    }).join('');

    // Build difficulty toggle options
    const diffKeys    = Object.keys(DIFFICULTIES);
    const diffToggles = diffKeys.map(key => {
      const d = DIFFICULTIES[key];
      return `<button class="toggle-opt${key === 'normal' ? ' selected' : ''}" data-diff="${key}">
        <span class="toggle-opt-label">${d.label}</span>
      </button>`;
    }).join('');

    this.showModal({
      header: 'SENTINEL',
      body: `
        <p style="font-size:12px;color:var(--text-secondary);line-height:1.5;margin-bottom:18px">
          Intrusion detected. Configure your defense perimeter to neutralize incoming threat vectors.
        </p>

        <p class="modal-section-label">Network Zone</p>
        <div class="toggle-group" id="map-select">${mapToggles}</div>
        <p id="map-desc" class="toggle-hint">${MAPS[0].description}</p>

        <p class="modal-section-label" style="margin-top:16px">Threat Level</p>
        <div class="toggle-group" id="difficulty-select">${diffToggles}</div>
        <p id="diff-desc" class="toggle-hint">${DIFFICULTIES.normal.description}</p>
      `,
      actions: [{ label: 'Initialize Defense', primary: true, onClick: () => {
        onStart(DIFFICULTIES[selectedDiff], selectedMapIndex);
      }}],
    });

    const mapContainer  = document.getElementById('map-select');
    const diffContainer = document.getElementById('difficulty-select');
    const mapDescEl     = document.getElementById('map-desc');
    const diffDescEl    = document.getElementById('diff-desc');

    mapContainer?.querySelectorAll('.toggle-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMapIndex = parseInt(btn.dataset.map, 10);
        mapContainer.querySelectorAll('.toggle-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (mapDescEl) mapDescEl.textContent = MAPS[selectedMapIndex].description;
      });
    });

    diffContainer?.querySelectorAll('.toggle-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDiff = btn.dataset.diff;
        diffContainer.querySelectorAll('.toggle-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (diffDescEl) diffDescEl.textContent = DIFFICULTIES[selectedDiff].description;
      });
    });
  }

  showWaveComplete(wave, bonus, onContinue) {
    this.showModal({
      header: `Q${wave} Report: Threats Neutralized`,
      body: `<p style="color:var(--accent-green);font-family:var(--font-mono);font-size:13px">+${bonus} cr allocated to defense budget.</p><p style="margin-top:6px">Board is pleased. Synergies detected. Reinforce before the next earnings call.</p>`,
      actions: [{ label: `Deploy wave ${wave + 1}`, primary: true, onClick: onContinue }],
    });
  }

  showGameOver(wave, score, diffLabel, rank, topScores, onRestart) {
    const acquiAmount = `$${((wave * 500_000) + (score * 750)).toLocaleString()}`;
    this.showModal({
      header: 'Acqui-Hired',
      body: `
        <p style="color:var(--text-secondary);font-size:12px">Perimeter collapsed. Leadership has accepted an acqui-hire offer.</p>
        <p style="margin-top:10px;font-family:var(--font-mono);font-size:15px;color:var(--accent-amber)">${acquiAmount}</p>
        <p style="font-size:11px;color:var(--text-muted);margin-top:2px;font-family:var(--font-mono)">total acquisition value</p>
        <p style="margin-top:10px">
          <span style="color:var(--text-secondary)">Survived:</span>
          <span style="font-family:var(--font-mono);margin-left:8px">Wave ${wave}</span>
        </p>
        <p>
          <span style="color:var(--text-secondary)">Stage:</span>
          <span style="font-family:var(--font-mono);margin-left:8px">${diffLabel}</span>
        </p>
        <p>
          <span style="color:var(--text-secondary)">Score:</span>
          <span style="font-family:var(--font-mono);margin-left:8px">${score.toLocaleString()}</span>
        </p>
        ${rank ? `<p style="margin-top:4px;color:var(--accent-amber);font-family:var(--font-mono);font-size:12px">#${rank} on ${diffLabel} leaderboard</p>` : ''}
        ${this._renderLeaderboard(topScores)}
      `,
      actions: [{ label: 'Pivot and retry', primary: true, onClick: () => this.showStartScreen(onRestart) }],
    });
  }

  showVictory(score, rank, topScores, onRestart) {
    const valuation = `$${((score * 12_500) + 420_000_000).toLocaleString()}`;
    this.showModal({
      header: 'Successful Exit',
      body: `
        <p style="color:var(--accent-green);font-size:12px">All threat vectors neutralized. SENTINEL IPO approved.</p>
        <p style="margin-top:10px;font-family:var(--font-mono);font-size:15px;color:var(--accent-green)">${valuation}</p>
        <p style="font-size:11px;color:var(--text-muted);margin-top:2px;font-family:var(--font-mono)">post-money valuation</p>
        <p style="margin-top:10px">
          <span style="color:var(--text-secondary)">Final score:</span>
          <span style="font-family:var(--font-mono);margin-left:8px">${score.toLocaleString()}</span>
        </p>
        ${rank ? `<p style="margin-top:4px;color:var(--accent-amber);font-family:var(--font-mono);font-size:12px">#${rank} on leaderboard</p>` : ''}
        ${this._renderLeaderboard(topScores)}
      `,
      actions: [{ label: 'Ring the bell again', primary: true, onClick: () => this.showStartScreen(onRestart) }],
    });
  }

  _renderLeaderboard(entries) {
    if (!entries || entries.length === 0) return '';
    const rows = entries.slice(0, 5).map((e, i) => `
      <tr>
        <td style="color:var(--text-muted);padding-right:8px;font-family:var(--font-mono);font-size:10px">#${i + 1}</td>
        <td style="font-family:var(--font-mono);font-size:12px;color:var(--text-primary)">${e.score.toLocaleString()}</td>
        <td style="color:var(--text-secondary);padding-left:8px;font-family:var(--font-mono);font-size:11px">W${e.wave}</td>
        <td style="color:var(--text-muted);padding-left:8px;font-size:10px;font-family:var(--font-mono)">${e.date}</td>
      </tr>
    `).join('');
    return `
      <p style="margin-top:14px;font-size:10px;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">Leaderboard</p>
      <table style="margin-top:6px;border-collapse:collapse;width:100%">${rows}</table>
    `;
  }
}
