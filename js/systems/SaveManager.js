import { SAVE_KEYS } from '../constants.js';
import { RunState } from '../state/RunState.js';
import { MetaState } from '../state/MetaState.js';

export const SaveManager = {
  saveRun(runState) {
    try {
      runState.lastSaveTimestamp = Date.now();
      localStorage.setItem(SAVE_KEYS.RUN, JSON.stringify(runState.toSaveBlob()));
    } catch (err) {
      console.warn('Loopward: failed to save run', err);
    }
  },

  loadRun() {
    try {
      const raw = localStorage.getItem(SAVE_KEYS.RUN);
      if (!raw) return null;
      return RunState.fromSaveBlob(JSON.parse(raw));
    } catch (err) {
      console.warn('Loopward: failed to load run', err);
      return null;
    }
  },

  clearRun() {
    try {
      localStorage.removeItem(SAVE_KEYS.RUN);
    } catch (err) {
      // ignore — nothing meaningful to recover from a clear failure
    }
  },

  saveMeta(metaState) {
    try {
      localStorage.setItem(SAVE_KEYS.META, JSON.stringify(metaState.toSaveBlob()));
    } catch (err) {
      console.warn('Loopward: failed to save meta progression', err);
    }
  },

  loadMeta() {
    try {
      const raw = localStorage.getItem(SAVE_KEYS.META);
      if (!raw) return MetaState.create();
      return MetaState.fromSaveBlob(JSON.parse(raw));
    } catch (err) {
      console.warn('Loopward: failed to load meta progression', err);
      return MetaState.create();
    }
  },
};
