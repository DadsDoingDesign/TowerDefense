/**
 * Local leaderboard backed by localStorage.
 * Stores top 10 scores keyed by difficulty.
 */
const STORAGE_KEY = 'td_leaderboard_v1';
const MAX_ENTRIES = 10;

export class Leaderboard {
  static _data = null;

  static _load() {
    if (Leaderboard._data) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      Leaderboard._data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      Leaderboard._data = {};
    }
  }

  static _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Leaderboard._data));
    } catch (_) {
      // Quota exceeded or private mode — fail silently
    }
  }

  /**
   * Submit a score. Returns the rank (1-based) if it made the board, else null.
   * @param {string} difficultyLabel - e.g. 'Normal'
   * @param {number} score
   * @param {number} wave - wave reached
   */
  static submit(difficultyLabel, score, wave) {
    Leaderboard._load();
    const key     = difficultyLabel.toLowerCase();
    const entries = Leaderboard._data[key] ?? [];

    const entry = { score, wave, date: new Date().toISOString().slice(0, 10) };
    entries.push(entry);
    entries.sort((a, b) => b.score - a.score);
    entries.splice(MAX_ENTRIES);

    Leaderboard._data[key] = entries;
    Leaderboard._save();

    const rank = entries.findIndex(e => e === entry) + 1;
    return rank <= MAX_ENTRIES ? rank : null;
  }

  /**
   * Returns top entries for a difficulty (sorted desc by score).
   */
  static getTop(difficultyLabel) {
    Leaderboard._load();
    const key = difficultyLabel.toLowerCase();
    return Leaderboard._data[key] ?? [];
  }

  static clear() {
    Leaderboard._data = {};
    Leaderboard._save();
  }
}
