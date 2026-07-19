import { OFFLINE } from '../constants.js';

export class OfflineManager {
  /**
   * Approximates earnings for time spent away, at a fraction of the live idle
   * rate — not a full lap-by-lap re-simulation. Gaps under the silent
   * threshold are treated as ordinary tab-switches (no popup, no earnings).
   */
  computeOfflineEarnings(runState, now = Date.now()) {
    const elapsedSec = Math.max(0, (now - runState.lastSaveTimestamp) / 1000);
    if (elapsedSec <= OFFLINE.silentThresholdSeconds) {
      return { silent: true, offlineGold: 0, elapsedSec, cappedSec: elapsedSec, wasCapped: false };
    }
    const cappedSec = Math.min(elapsedSec, runState.offlineCapSeconds);
    const offlineGold = runState.idleGoldPerSecAtSave * cappedSec * runState.offlineEfficiency;
    return { silent: false, offlineGold, elapsedSec, cappedSec, wasCapped: elapsedSec > runState.offlineCapSeconds };
  }

  applyOfflineEarnings(runState, result) {
    runState.gold += result.offlineGold;
    runState.lifetimeGoldEarned += result.offlineGold;
  }

  /** Wires the 10s autosave heartbeat plus save-on-hide/unload hooks. */
  startAutosave(saveFn, intervalMs = 10000) {
    this.intervalId = setInterval(saveFn, intervalMs);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveFn();
    });
    window.addEventListener('beforeunload', saveFn);
  }

  stopAutosave() {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
