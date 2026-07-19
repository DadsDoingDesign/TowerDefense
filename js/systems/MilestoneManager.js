export const MilestoneManager = {
  isNextTierAvailable(runState, loopManager) {
    const next = loopManager.getNextTier();
    if (!next) return false;
    return runState.lifetimeGoldEarned >= next.unlockThreshold;
  },

  /** Expands the loop to the next tier if the milestone has been reached. Returns true on success. */
  expand(runState, loopManager) {
    if (!this.isNextTierAvailable(runState, loopManager)) return false;
    loopManager.expandTier();
    runState.loopTierIndex = loopManager.tierIndex;
    return true;
  },
};
