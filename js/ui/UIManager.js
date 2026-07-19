import { TOWERS, ENEMIES, META_UPGRADES } from '../constants.js';

const TROOP_TYPES = Object.values(ENEMIES).filter((e) => e.kind !== 'auto');

function fmt(n) {
  return Math.floor(n).toLocaleString();
}

function fmtDuration(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export class UIManager {
  constructor() {
    this.selectedSlot = null;
    this.selectedSlotOccupied = false;
    this.selectedTowerInfo = null;
    this.handlers = {};
    this._cacheDom();
    this._buildTroopButtons();
    this._bindStaticButtons();
    this._renderBuildPanel(null);
  }

  bindHandlers(handlers) {
    this.handlers = handlers;
  }

  _cacheDom() {
    this.el = {
      gold: document.getElementById('hud-gold'),
      baseHpFill: document.getElementById('hud-basehp-fill'),
      baseHpText: document.getElementById('hud-basehp-text'),
      tierLabel: document.getElementById('hud-tier-label'),
      cores: document.getElementById('hud-cores'),
      tierProgressFill: document.getElementById('tier-progress-fill'),
      tierProgressLabel: document.getElementById('tier-progress-label'),
      tierBanner: document.getElementById('tier-banner'),
      tierBannerText: document.getElementById('tier-banner-text'),
      expandBtn: document.getElementById('expand-btn'),
      towerButtons: document.getElementById('tower-buttons'),
      troopButtons: document.getElementById('troop-buttons'),
      cashoutBtn: document.getElementById('cashout-btn'),
      backdrop: document.getElementById('modal-backdrop'),
      modalStart: document.getElementById('modal-start'),
      startCores: document.getElementById('start-cores'),
      startNewRunBtn: document.getElementById('start-newrun-btn'),
      startMetashopBtn: document.getElementById('start-metashop-btn'),
      modalUpgrade: document.getElementById('modal-upgrade'),
      upgradeChoices: document.getElementById('upgrade-choices'),
      modalRunEnd: document.getElementById('modal-runend'),
      runEndStats: document.getElementById('runend-stats'),
      runEndCores: document.getElementById('runend-cores'),
      runEndNewRunBtn: document.getElementById('runend-newrun-btn'),
      runEndMetashopBtn: document.getElementById('runend-metashop-btn'),
      modalMetaShop: document.getElementById('modal-metashop'),
      metaShopCores: document.getElementById('metashop-cores'),
      metaShopList: document.getElementById('metashop-list'),
      metaShopCloseBtn: document.getElementById('metashop-close-btn'),
      modalOffline: document.getElementById('modal-offline'),
      offlineSummary: document.getElementById('offline-summary'),
      offlineDismissBtn: document.getElementById('offline-dismiss-btn'),
    };
  }

  _buildTroopButtons() {
    this.el.troopButtons.innerHTML = '';
    for (const def of TROOP_TYPES) {
      const btn = document.createElement('button');
      btn.className = 'action-btn troop-btn';
      btn.dataset.type = def.id;
      btn.innerHTML = `<span class="swatch" style="background:${def.color}"></span><span class="label">${def.label}</span><span class="cost">${def.cost}g</span><span class="value">kill: +${def.killValue}</span>`;
      btn.addEventListener('click', () => this.handlers.onSelectTroop && this.handlers.onSelectTroop(def.id));
      this.el.troopButtons.appendChild(btn);
    }
  }

  _bindStaticButtons() {
    this.el.cashoutBtn.addEventListener('click', () => this.handlers.onCashOut && this.handlers.onCashOut());
    this.el.expandBtn.addEventListener('click', () => this.handlers.onExpandTier && this.handlers.onExpandTier());
    this.el.startNewRunBtn.addEventListener('click', () => this.handlers.onStartNewRun && this.handlers.onStartNewRun());
    this.el.startMetashopBtn.addEventListener('click', () => this.handlers.onOpenMetaShop && this.handlers.onOpenMetaShop());
    this.el.runEndNewRunBtn.addEventListener('click', () => this.handlers.onStartNewRun && this.handlers.onStartNewRun());
    this.el.runEndMetashopBtn.addEventListener('click', () => this.handlers.onOpenMetaShop && this.handlers.onOpenMetaShop());
    this.el.metaShopCloseBtn.addEventListener('click', () => {
      if (this._metaShopReturnModal) {
        this._showModal(this._metaShopReturnModal);
        this._metaShopReturnModal = null;
      } else {
        this.hideAllModals();
      }
      this.handlers.onCloseMetaShop && this.handlers.onCloseMetaShop();
    });
    this.el.offlineDismissBtn.addEventListener('click', () => this.handlers.onDismissOffline && this.handlers.onDismissOffline());
  }

  // --- Ring slot selection -> contextual build panel ---------------------

  /** Called whenever the player taps a ring slot (empty or occupied). */
  selectSlot(slotIndex, occupied, tower) {
    this.selectedSlot = slotIndex;
    this.selectedSlotOccupied = occupied;
    this.selectedTowerInfo = tower ?? null;
  }

  clearSlotSelection() {
    this.selectedSlot = null;
    this.selectedSlotOccupied = false;
    this.selectedTowerInfo = null;
  }

  _renderBuildPanel(runState) {
    const signature = `${this.selectedSlot}|${this.selectedSlotOccupied}`;
    if (this._buildPanelSignature !== signature) {
      this._buildPanelSignature = signature;
      this._rebuildBuildPanel(runState);
      return;
    }
    if (runState && this.selectedSlot != null && !this.selectedSlotOccupied) {
      this._refreshBuildButtonsAffordability(runState);
    }
  }

  _refreshBuildButtonsAffordability(runState) {
    this.el.towerButtons.querySelectorAll('.build-btn').forEach((btn) => {
      const id = btn.dataset.type;
      const def = TOWERS[id];
      const locked = !runState.unlockedTowerTypes.includes(id);
      btn.disabled = locked || runState.gold < def.cost;
      btn.querySelector('.cost').textContent = locked ? 'Locked' : `${def.cost}g`;
    });
  }

  _rebuildBuildPanel(runState) {
    const container = this.el.towerButtons;
    container.innerHTML = '';

    if (this.selectedSlot == null || !runState) {
      const hint = document.createElement('div');
      hint.className = 'build-hint';
      hint.textContent = 'Tap a ring slot to build';
      container.appendChild(hint);
      return;
    }

    if (this.selectedSlotOccupied) {
      const def = this.selectedTowerInfo.def;
      const info = document.createElement('div');
      info.className = 'tower-info';
      info.innerHTML = `
        <span class="swatch" style="background:${def.color}"></span>
        <span class="label">${def.label}</span>
        <span class="stat">DMG ${def.damage}</span>
        <span class="stat">RNG ${def.range}</span>
        <span class="stat">RATE ${def.fireRate}/s</span>
      `;
      container.appendChild(info);
      const closeBtn = document.createElement('button');
      closeBtn.className = 'action-btn';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', () => this.handlers.onDeselectSlot && this.handlers.onDeselectSlot());
      container.appendChild(closeBtn);
      return;
    }

    const hint = document.createElement('div');
    hint.className = 'build-hint';
    hint.textContent = `Build at slot ${this.selectedSlot + 1}`;
    container.appendChild(hint);

    for (const def of Object.values(TOWERS)) {
      const locked = !runState.unlockedTowerTypes.includes(def.id);
      const btn = document.createElement('button');
      btn.className = 'action-btn build-btn';
      btn.dataset.type = def.id;
      btn.disabled = locked || runState.gold < def.cost;
      btn.innerHTML = `<span class="swatch" style="background:${def.color}"></span><span class="label">${def.label}</span><span class="cost">${locked ? 'Locked' : `${def.cost}g`}</span>`;
      btn.addEventListener('click', () => {
        this.handlers.onBuildAtSlot && this.handlers.onBuildAtSlot(this.selectedSlot, def.id);
      });
      container.appendChild(btn);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'action-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.handlers.onDeselectSlot && this.handlers.onDeselectSlot());
    container.appendChild(cancelBtn);
  }

  // --- HUD -----------------------------------------------------------

  updateHUD(runState, metaState, loopManager) {
    this.el.gold.textContent = fmt(runState.gold);
    this.el.cores.textContent = fmt(metaState.cores);

    const hpFrac = runState.baseMaxHP > 0 ? runState.baseHP / runState.baseMaxHP : 0;
    this.el.baseHpFill.style.width = `${Math.max(0, hpFrac * 100)}%`;
    this.el.baseHpFill.classList.toggle('low', hpFrac <= 0.3);
    this.el.baseHpText.textContent = `${Math.max(0, Math.round(runState.baseHP))}/${runState.baseMaxHP}`;

    this.el.tierLabel.textContent = loopManager.getCurrentTier().name;

    const next = loopManager.getNextTier();
    if (next) {
      const frac = Math.min(1, runState.lifetimeGoldEarned / next.unlockThreshold);
      this.el.tierProgressFill.style.width = `${frac * 100}%`;
      this.el.tierProgressLabel.textContent = `${fmt(runState.lifetimeGoldEarned)} / ${fmt(next.unlockThreshold)} to ${next.name}`;
    } else {
      this.el.tierProgressFill.style.width = '100%';
      this.el.tierProgressLabel.textContent = 'Max ring size reached';
    }

    this._renderBuildPanel(runState);
    this._updateTroopButtons(runState);
  }

  _updateTroopButtons(runState) {
    this.el.troopButtons.querySelectorAll('.troop-btn').forEach((btn) => {
      const id = btn.dataset.type;
      const def = ENEMIES[id];
      const cost = Math.round(def.cost * runState.modifiers.troopCostMult);
      const value = Math.round(def.killValue * runState.modifiers.troopValueMult);
      btn.disabled = runState.gold < cost;
      btn.querySelector('.cost').textContent = `${cost}g`;
      btn.querySelector('.value').textContent = `kill: +${value}`;
    });
  }

  // --- Tier expansion banner -------------------------------------------

  showTierBanner(nextTier) {
    this.el.tierBannerText.textContent = `${nextTier.name} available — expand for ${nextTier.slotCount} slots`;
    this.el.tierBanner.classList.remove('hidden');
  }

  hideTierBanner() {
    this.el.tierBanner.classList.add('hidden');
  }

  // --- Modals ------------------------------------------------------------

  _showModal(modalEl) {
    this.el.backdrop.classList.remove('hidden');
    document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
    modalEl.classList.remove('hidden');
  }

  hideAllModals() {
    this.el.backdrop.classList.add('hidden');
    document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
  }

  showStartModal(metaState) {
    this.el.startCores.textContent = fmt(metaState.cores);
    this._showModal(this.el.modalStart);
  }

  showUpgradeModal(choices, onPick) {
    this.el.upgradeChoices.innerHTML = '';
    for (const card of choices) {
      const cardEl = document.createElement('button');
      cardEl.className = 'upgrade-card';
      cardEl.innerHTML = `<div class="card-title">${card.label}</div><div class="card-desc">${card.description}</div>`;
      cardEl.addEventListener('click', () => {
        onPick(card);
      });
      this.el.upgradeChoices.appendChild(cardEl);
    }
    this._showModal(this.el.modalUpgrade);
  }

  showRunEndModal(stats, cores) {
    this.el.runEndStats.innerHTML = `
      <div>Gold earned: <strong>${fmt(stats.goldEarned)}</strong></div>
      <div>Loop tier reached: <strong>${stats.tierName}</strong></div>
      <div>Kills: <strong>${fmt(stats.kills)}</strong></div>
      <div>Time survived: <strong>${fmtDuration(stats.runSeconds)}</strong></div>
    `;
    this.el.runEndCores.textContent = fmt(cores);
    this._showModal(this.el.modalRunEnd);
  }

  showMetaShopModal(metaState) {
    const visible = document.querySelector('.modal:not(.hidden)');
    if (visible && visible.id !== 'modal-metashop') this._metaShopReturnModal = visible;
    this.el.metaShopCores.textContent = fmt(metaState.cores);
    this.el.metaShopList.innerHTML = '';
    for (const def of META_UPGRADES) {
      const level = metaState.levelOf(def.id);
      const maxed = level >= def.maxLevel;
      const cost = maxed ? null : def.costs[level];
      const row = document.createElement('div');
      row.className = 'metashop-row';
      row.innerHTML = `
        <div class="metashop-info">
          <div class="metashop-title">${def.label} <span class="metashop-level">${level}/${def.maxLevel}</span></div>
          <div class="metashop-desc">${def.description}</div>
        </div>
        <button class="action-btn metashop-buy" ${maxed || metaState.cores < cost ? 'disabled' : ''}>
          ${maxed ? 'Maxed' : `Buy — ${cost} Cores`}
        </button>
      `;
      row.querySelector('.metashop-buy').addEventListener('click', () => {
        this.handlers.onPurchaseMeta && this.handlers.onPurchaseMeta(def.id);
      });
      this.el.metaShopList.appendChild(row);
    }
    this._showModal(this.el.modalMetaShop);
  }

  showOfflineModal(result) {
    const capNote = result.wasCapped ? ' (capped)' : '';
    this.el.offlineSummary.innerHTML = `
      <div>You were away for <strong>${fmtDuration(result.elapsedSec)}</strong>.</div>
      <div>Your towers kept farming grunts and earned <strong>+${fmt(result.offlineGold)} gold</strong>${capNote}.</div>
    `;
    this._showModal(this.el.modalOffline);
  }
}
