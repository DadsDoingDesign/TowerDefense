import { CORES_REWARD } from '../constants.js';

export const MetaProgressionManager = {
  computeReward(runState) {
    return CORES_REWARD(runState.lifetimeGoldEarned, runState.loopTierIndex, runState.runSeconds());
  },

  /** Rolls the run's performance into Cores and records it against the persistent meta state. */
  finalizeRun(runState, metaState) {
    const cores = this.computeReward(runState);
    metaState.recordRunEnd(cores, runState.loopTierIndex);
    return cores;
  },
};
