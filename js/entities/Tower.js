import { TOWERS } from '../constants.js';

export class Tower {
  constructor(typeId, slotIndex) {
    this.typeId = typeId;
    this.slotIndex = slotIndex;
    this.def = TOWERS[typeId];
    this.cooldown = 0;
  }

  /**
   * Acquires and fires at in-range enemies (nearest first, tie-broken toward
   * enemies closest to breaching their leash). Returns shot events for FX —
   * kill/gold resolution happens elsewhere by scanning `enemy.dead`.
   */
  update(dt, enemies, loopManager, modifiers, buffState) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return [];

    const selfPos = loopManager.getSlotPosition(this.slotIndex);
    const inRange = enemies
      .filter((e) => !e.dead)
      .map((e) => {
        const pos = e.positionOn(loopManager);
        const dx = pos.x - selfPos.x;
        const dy = pos.y - selfPos.y;
        return { enemy: e, pos, distSq: dx * dx + dy * dy };
      })
      .filter((entry) => entry.distSq <= this.def.range * this.def.range)
      .sort((a, b) => {
        if (b.enemy.lapsCompleted !== a.enemy.lapsCompleted) {
          return b.enemy.lapsCompleted - a.enemy.lapsCompleted;
        }
        return a.distSq - b.distSq;
      });

    if (inRange.length === 0) return [];

    const fireRate = this.def.fireRate * modifiers.fireRateMult;
    this.cooldown = 1 / fireRate;

    const targetCount = 1 + Math.max(0, modifiers.extraTargets);
    const targets = inRange.slice(0, targetCount);
    const shotEvents = [];

    targets.forEach((entry, index) => {
      const isCrit = Math.random() < modifiers.critChance;
      const damageShare = index === 0 ? 1 : 0.5; // extra targets (Split Shot) take 50%
      const damage = this.def.damage * modifiers.damageMult * damageShare * (isCrit ? 2 : 1);
      entry.enemy.takeDamage(damage, buffState);
      shotEvents.push({ from: selfPos, to: entry.pos, isCrit });
    });

    return shotEvents;
  }
}
