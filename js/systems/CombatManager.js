import { ENEMIES } from '../constants.js';
import { EconomyManager } from './EconomyManager.js';

export class CombatManager {
  /**
   * Advances enemies, resolves tower fire, and applies kill/leash outcomes.
   * Returns per-frame events for the renderer/UI to react to (floating text, FX).
   */
  update(dt, runState, loopManager) {
    const circumference = loopManager.getCircumference();
    const buffState = this._computeBuffState(runState.enemies);

    for (const enemy of runState.enemies) {
      enemy.update(dt, circumference, buffState, runState.leashLaps);
    }

    const leashEvents = [];
    runState.enemies = runState.enemies.filter((enemy) => {
      if (enemy.leashed) {
        runState.baseHP -= enemy.def.leashDamage;
        leashEvents.push(enemy);
        return false;
      }
      return true;
    });

    const shotEvents = [];
    for (const tower of runState.towers) {
      const shots = tower.update(dt, runState.enemies, loopManager, runState.modifiers, buffState);
      shotEvents.push(...shots);
    }

    const killEvents = [];
    runState.enemies = runState.enemies.filter((enemy) => {
      if (enemy.dead) {
        const value = EconomyManager.earnKill(enemy, runState);
        runState.killCount += 1;
        killEvents.push({ enemy, value });
        return false;
      }
      return true;
    });

    if (runState.baseHP <= 0) {
      runState.baseHP = 0;
      runState.gameOver = true;
    }

    return { shotEvents, killEvents, leashEvents, buffActive: buffState.active };
  }

  _computeBuffState(enemies) {
    const bufferDef = ENEMIES.buffer;
    const active = enemies.some((e) => !e.dead && e.isBuffer);
    return {
      active,
      speedMult: active ? bufferDef.buffSpeedMult : 1,
      damageTakenMult: active ? bufferDef.buffDamageTakenMult : 1,
    };
  }
}
