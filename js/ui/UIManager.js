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
    this.selectedTower = null;
    this.handlers = {};
    this._cacheDom();
    this._buildButtons();
    this._bindStaticButtons();
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

  _buildButtons() {
    this.el.towerButtons.innerHTML = '';
    for (const def of Object.values(TOWERS)) {
      const btn = document.createElement('button');
      btn.className = 'action-btn build-btn';
      btn.dataset.type = def.id;
      btn.innerHTML = `<span class="swatch" style="background:${def.color}"></span><span class="label">${def.label}</span><span class="cost">${def.cost}g</span>`;
      btn.addEventListener('click', () => this._onTowerButtonClick(def.id));
      this.el.towerButtons.appendChild(btn);
    }

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

  _onTowerButtonClick(typeId) {
    this.selectedTower = this.selectedTower === typeId ? null : typeId;
    this._refreshTowerSelection();
    this.handlers.onSelectTower && this.handlers.onSelectTower(this.selectedTower);
  }

  clearTowerSelection() {
    this.selectedTower = null;
    this._refreshTowerSelection();
  }

  _refreshTowerSelection() {
    this.el.towerButtons.querySelectorAll('.build-btn').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.type === this.selectedTower);
    });
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

    this._updateBuildButtons(runState);
    this._updateTroopButtons(runState);
  }

  _updateBuildButtons(runState) {
    this.el.towerButtons.querySelectorAll('.build-btn').forEach((btn) => {
      const id = btn.dataset.type;
      const def = TOWERS[id];
      const locked = !runState.unlockedTowerTypes.includes(id);
      btn.classList.toggle('locked', locked);
      btn.disabled = locked || runState.gold < def.cost;
      const costEl = btn.querySelector('.cost');
      costEl.textContent = locked ? 'Locked' : `${def.cost}g`;
    });
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
