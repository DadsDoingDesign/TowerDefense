import { ECONOMY, KILLS_PER_CARD_OFFER, OFFLINE } from '../constants.js';
import { Tower } from '../entities/Tower.js';

const CRIT_CHANCE_CAP = 0.5;

export class RunState {
  constructor() {
    this.gold = ECONOMY.startGold;
    this.baseHP = ECONOMY.startBaseHP;
    this.baseMaxHP = ECONOMY.startBaseHP;
    this.loopTierIndex = 0;
    this.extraSlots = 0;
    this.towers = []; // live Tower instances
    this.enemies = []; // live Enemy instances, never serialized
    this.killCount = 0;
    this.lifetimeGoldEarned = 0;
    this.leashLaps = ECONOMY.startLeashLaps;
    this.unlockedTowerTypes = ['spike'];
    this.unlockedCardIds = []; // from meta purchases, e.g. 'split_shot'
    this.modifiers = {
      damageMult: 1,
      fireRateMult: 1,
      troopCostMult: 1,
      troopValueMult: 1,
      gruntIntervalMult: 1,
      critChance: 0,
      extraTargets: 0,
    };
    this.idleGoldWindow = []; // [{t, amount}] rolling window of grunt-kill gold
    this.idleGoldPerSecAtSave = 0;
    this.offlineEfficiency = OFFLINE.baseEfficiency;
    this.offlineCapSeconds = OFFLINE.baseCapHours * 3600;
    this.runStartedAt = Date.now();
    this.lastSaveTimestamp = Date.now();
    this.nextCardThreshold = KILLS_PER_CARD_OFFER;
    this.gameOver = false;
  }

  static create(metaBonuses) {
    const run = new RunState();
    if (metaBonuses) {
      run.gold += metaBonuses.startGold ?? 0;
      run.baseHP += metaBonuses.startBaseHP ?? 0;
      run.baseMaxHP += metaBonuses.startBaseHP ?? 0;
      run.extraSlots = metaBonuses.extraSlots ?? 0;
      run.modifiers.troopCostMult = metaBonuses.troopCostMult ?? 1;
      run.modifiers.troopValueMult = metaBonuses.troopValueMult ?? 1;
      run.offlineEfficiency = metaBonuses.offlineEfficiency ?? OFFLINE.baseEfficiency;
      run.offlineCapSeconds = metaBonuses.offlineCapSeconds ?? OFFLINE.baseCapHours * 3600;
      run.unlockedCardIds = metaBonuses.unlockedCardIds ?? [];
    }
    return run;
  }

  static fromSaveBlob(blob) {
    const run = new RunState();
    if (!blob) return run;
    run.gold = blob.gold ?? run.gold;
    run.baseHP = blob.baseHP ?? run.baseHP;
    run.baseMaxHP = blob.baseMaxHP ?? run.baseMaxHP;
    run.loopTierIndex = blob.loopTierIndex ?? 0;
    run.extraSlots = blob.extraSlots ?? 0;
    run.towers = (blob.towers ?? []).map((t) => new Tower(t.type, t.slotIndex));
    run.killCount = blob.killCount ?? 0;
    run.lifetimeGoldEarned = blob.lifetimeGoldEarned ?? 0;
    run.leashLaps = blob.leashLaps ?? ECONOMY.startLeashLaps;
    run.unlockedTowerTypes = blob.unlockedTowerTypes ?? ['spike'];
    run.unlockedCardIds = blob.unlockedCardIds ?? [];
    run.modifiers = blob.modifiers ?? run.modifiers;
    run.idleGoldPerSecAtSave = blob.idleGoldPerSecAtSave ?? 0;
    run.offlineEfficiency = blob.offlineEfficiency ?? OFFLINE.baseEfficiency;
    run.offlineCapSeconds = blob.offlineCapSeconds ?? OFFLINE.baseCapHours * 3600;
    run.runStartedAt = blob.runStartedAt ?? Date.now();
    run.lastSaveTimestamp = blob.lastSaveTimestamp ?? Date.now();
    run.nextCardThreshold = blob.nextCardThreshold ?? KILLS_PER_CARD_OFFER;
    return run;
  }

  toSaveBlob() {
    return {
      schemaVersion: 1,
      gold: this.gold,
      baseHP: this.baseHP,
      baseMaxHP: this.baseMaxHP,
      loopTierIndex: this.loopTierIndex,
      extraSlots: this.extraSlots,
      towers: this.towers.map((t) => ({ slotIndex: t.slotIndex, type: t.typeId })),
      killCount: this.killCount,
      lifetimeGoldEarned: this.lifetimeGoldEarned,
      leashLaps: this.leashLaps,
      unlockedTowerTypes: this.unlockedTowerTypes,
      unlockedCardIds: this.unlockedCardIds,
      modifiers: this.modifiers,
      idleGoldPerSecAtSave: this.idleGoldPerSecAtSave,
      offlineEfficiency: this.offlineEfficiency,
      offlineCapSeconds: this.offlineCapSeconds,
      runStartedAt: this.runStartedAt,
      lastSaveTimestamp: this.lastSaveTimestamp,
      nextCardThreshold: this.nextCardThreshold,
    };
  }

  applyUpgradeCard(card) {
    const fx = card.effect;
    if (fx.damageMult) this.modifiers.damageMult *= fx.damageMult;
    if (fx.fireRateMult) this.modifiers.fireRateMult *= fx.fireRateMult;
    if (fx.troopCostMult) this.modifiers.troopCostMult *= fx.troopCostMult;
    if (fx.troopValueMult) this.modifiers.troopValueMult *= fx.troopValueMult;
    if (fx.gruntIntervalMult) this.modifiers.gruntIntervalMult *= fx.gruntIntervalMult;
    if (fx.critChanceAdd) this.modifiers.critChance = Math.min(CRIT_CHANCE_CAP, this.modifiers.critChance + fx.critChanceAdd);
    if (fx.extraTargets) this.modifiers.extraTargets += fx.extraTargets;
    if (fx.leashLapsAdd) this.leashLaps += fx.leashLapsAdd;
    if (fx.baseMaxHPAdd) this.baseMaxHP += fx.baseMaxHPAdd;
    if (fx.baseHPAdd) this.baseHP = Math.min(this.baseMaxHP, this.baseHP + fx.baseHPAdd);
    if (fx.unlockTower && !this.unlockedTowerTypes.includes(fx.unlockTower)) {
      this.unlockedTowerTypes.push(fx.unlockTower);
    }
  }

  recordGruntKillGold(amount, now = Date.now()) {
    this.idleGoldWindow.push({ t: now, amount });
    const cutoff = now - OFFLINE.idleWindowSeconds * 1000;
    while (this.idleGoldWindow.length && this.idleGoldWindow[0].t < cutoff) {
      this.idleGoldWindow.shift();
    }
    const windowTotal = this.idleGoldWindow.reduce((sum, e) => sum + e.amount, 0);
    this.idleGoldPerSecAtSave = windowTotal / OFFLINE.idleWindowSeconds;
  }

  runSeconds(now = Date.now()) {
    return (now - this.runStartedAt) / 1000;
  }
}
