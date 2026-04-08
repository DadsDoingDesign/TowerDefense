import {
  STARTING_GOLD, STARTING_LIVES,
  WAVE_END_BONUS_BASE, WAVE_END_BONUS_SCALE,
  TOWERS, DIFFICULTIES,
} from '../constants.js';

export class EconomyManager {
  constructor() {
    this.gold  = STARTING_GOLD;
    this.lives = STARTING_LIVES;
    this.score = 0;
    this.difficulty = DIFFICULTIES.normal;
  }

  reset(difficulty = DIFFICULTIES.normal) {
    this.difficulty = difficulty;
    this.gold  = difficulty.startGold;
    this.lives = difficulty.startLives;
    this.score = 0;
  }

  canAfford(towerType) {
    return this.gold >= TOWERS[towerType].cost;
  }

  canAffordAmount(amount) {
    return this.gold >= amount;
  }

  spend(towerType) {
    const cost = TOWERS[towerType].cost;
    if (this.gold < cost) return false;
    this.gold -= cost;
    return true;
  }

  earnKill(reward) {
    this.gold  += reward;
    this.score += reward * 10;
  }

  earnWaveBonus(wave) {
    const bonus = WAVE_END_BONUS_BASE + wave * WAVE_END_BONUS_SCALE;
    this.gold  += bonus;
    this.score += wave * 100;
    return bonus;
  }

  loseLife(count = 1) {
    this.lives = Math.max(0, this.lives - count);
  }

  get isDead() {
    return this.lives <= 0;
  }
}
