export const EconomyManager = {
  canAfford(runState, cost) {
    return runState.gold >= cost;
  },

  spend(runState, amount) {
    runState.gold -= amount;
  },

  /** Applies a kill's gold reward to the run, tracking idle rate for grunt kills only. */
  earnKill(enemy, runState, now = Date.now()) {
    const isAuto = enemy.isAuto;
    const value = isAuto ? enemy.def.killValue : enemy.def.killValue * runState.modifiers.troopValueMult;
    runState.gold += value;
    runState.lifetimeGoldEarned += value;
    if (isAuto) runState.recordGruntKillGold(value, now);
    return value;
  },
};
