import { UPGRADE_CARDS, CARD_CHOICES_OFFERED, KILLS_PER_CARD_OFFER } from '../constants.js';

export class UpgradeManager {
  constructor() {
    this.pendingOffers = 0;
  }

  /** Call after every kill. Returns true if a new card offer became pending. */
  checkThreshold(runState) {
    let crossed = false;
    while (runState.killCount >= runState.nextCardThreshold) {
      runState.nextCardThreshold += KILLS_PER_CARD_OFFER;
      crossed = true;
    }
    if (crossed) this.pendingOffers += 1;
    return crossed;
  }

  hasPendingOffer() {
    return this.pendingOffers > 0;
  }

  drawChoices(runState) {
    const pool = UPGRADE_CARDS.filter((card) => this._isEligible(card, runState));
    return this._weightedSample(pool, Math.min(CARD_CHOICES_OFFERED, pool.length));
  }

  applyChoice(card, runState) {
    runState.applyUpgradeCard(card);
    this.pendingOffers = Math.max(0, this.pendingOffers - 1);
  }

  _isEligible(card, runState) {
    if (card.metaGated && !runState.unlockedCardIds.includes(card.id)) return false;
    if (card.onlyIfLocked && runState.unlockedTowerTypes.includes(card.onlyIfLocked)) return false;
    return true;
  }

  _weightedSample(pool, count) {
    const remaining = pool.slice();
    const picks = [];
    for (let i = 0; i < count && remaining.length > 0; i++) {
      const totalWeight = remaining.reduce((sum, c) => sum + c.weight, 0);
      let roll = Math.random() * totalWeight;
      let index = 0;
      for (; index < remaining.length - 1; index++) {
        roll -= remaining[index].weight;
        if (roll <= 0) break;
      }
      picks.push(remaining.splice(index, 1)[0]);
    }
    return picks;
  }
}
