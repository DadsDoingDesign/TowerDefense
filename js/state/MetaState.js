import { META_UPGRADES, OFFLINE } from '../constants.js';

export class MetaState {
  constructor() {
    this.cores = 0;
    this.purchasedLevels = {}; // { upgradeId: level }
    this.unlockedCardIds = [];
    this.lifetimeStats = { totalRuns: 0, bestTierReached: 0, totalCoresEarned: 0 };
  }

  static create() {
    return new MetaState();
  }

  static fromSaveBlob(blob) {
    const meta = new MetaState();
    if (!blob) return meta;
    meta.cores = blob.cores ?? 0;
    meta.purchasedLevels = blob.purchasedLevels ?? {};
    meta.unlockedCardIds = blob.unlockedCardIds ?? [];
    meta.lifetimeStats = blob.lifetimeStats ?? meta.lifetimeStats;
    return meta;
  }

  toSaveBlob() {
    return {
      schemaVersion: 1,
      cores: this.cores,
      purchasedLevels: this.purchasedLevels,
      unlockedCardIds: this.unlockedCardIds,
      lifetimeStats: this.lifetimeStats,
    };
  }

  levelOf(upgradeId) {
    return this.purchasedLevels[upgradeId] ?? 0;
  }

  canPurchase(upgradeId) {
    const def = META_UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return false;
    const level = this.levelOf(upgradeId);
    if (level >= def.maxLevel) return false;
    const cost = def.costs[level];
    return this.cores >= cost;
  }

  purchase(upgradeId) {
    const def = META_UPGRADES.find((u) => u.id === upgradeId);
    if (!def || !this.canPurchase(upgradeId)) return false;
    const level = this.levelOf(upgradeId);
    const cost = def.costs[level];
    this.cores -= cost;
    this.purchasedLevels[upgradeId] = level + 1;
    if (def.bonusPerLevel.unlockCard) {
      this.unlockedCardIds.push(def.bonusPerLevel.unlockCard);
    }
    return true;
  }

  /** Aggregate all purchased levels into a flat bonus object consumed by RunState.create(). */
  getBonuses() {
    const bonuses = {
      startGold: 0,
      startBaseHP: 0,
      extraSlots: 0,
      troopCostMult: 1,
      troopValueMult: 1,
      offlineEfficiency: OFFLINE.baseEfficiency,
      offlineCapSeconds: OFFLINE.baseCapHours * 3600,
    };
    for (const def of META_UPGRADES) {
      const level = this.levelOf(def.id);
      if (level <= 0) continue;
      const perLevel = def.bonusPerLevel;
      if (perLevel.startGold) bonuses.startGold += perLevel.startGold * level;
      if (perLevel.startBaseHP) bonuses.startBaseHP += perLevel.startBaseHP * level;
      if (perLevel.extraSlots) bonuses.extraSlots += perLevel.extraSlots * level;
      if (perLevel.troopCostMult) bonuses.troopCostMult += perLevel.troopCostMult * level;
      if (perLevel.troopValueMult) bonuses.troopValueMult += perLevel.troopValueMult * level;
      if (perLevel.offlineEfficiencyAdd) bonuses.offlineEfficiency += perLevel.offlineEfficiencyAdd * level;
      if (perLevel.offlineCapHoursAdd) bonuses.offlineCapSeconds += perLevel.offlineCapHoursAdd * level * 3600;
    }
    bonuses.offlineEfficiency = Math.min(1, bonuses.offlineEfficiency);
    bonuses.unlockedCardIds = this.unlockedCardIds.slice();
    return bonuses;
  }

  recordRunEnd(coresEarned, loopTierReached) {
    this.cores += coresEarned;
    this.lifetimeStats.totalRuns += 1;
    this.lifetimeStats.totalCoresEarned += coresEarned;
    this.lifetimeStats.bestTierReached = Math.max(this.lifetimeStats.bestTierReached, loopTierReached);
  }
}
