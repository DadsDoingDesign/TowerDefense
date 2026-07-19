import { ENEMIES, GRUNT_SPAWN_INTERVAL } from '../constants.js';
import { Enemy } from '../entities/Enemy.js';
import { EconomyManager } from './EconomyManager.js';

export class SpawnManager {
  constructor() {
    this.gruntTimer = 0;
  }

  tick(dt, runState) {
    const interval = GRUNT_SPAWN_INTERVAL(runState.loopTierIndex) * runState.modifiers.gruntIntervalMult;
    this.gruntTimer -= dt;
    if (this.gruntTimer <= 0) {
      runState.enemies.push(new Enemy('grunt'));
      this.gruntTimer += interval;
    }
  }

  /** Returns false (no gold spent, no enemy added) if the player can't afford this troop. */
  sendTroop(typeId, runState) {
    const def = ENEMIES[typeId];
    if (!def || def.kind === 'auto') return false;
    const cost = def.cost * runState.modifiers.troopCostMult;
    if (!EconomyManager.canAfford(runState, cost)) return false;
    EconomyManager.spend(runState, cost);
    runState.enemies.push(new Enemy(typeId));
    return true;
  }
}
