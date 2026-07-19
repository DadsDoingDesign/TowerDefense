import { ENEMIES } from '../constants.js';

let nextId = 1;

export class Enemy {
  constructor(typeId) {
    this.id = nextId++;
    this.typeId = typeId;
    this.def = ENEMIES[typeId];
    this.maxHp = this.def.hp;
    this.hp = this.def.hp;
    this.progress = 0; // 0..1 fraction around the ring
    this.lapsCompleted = 0;
    this.dead = false;
    this.leashed = false;
  }

  get isAuto() {
    return this.def.kind === 'auto';
  }

  get isBuffer() {
    return this.def.kind === 'buffer';
  }

  /** Advances position along the ring. Sets `this.leashed = true` once the lap limit is hit. */
  update(dt, circumference, buffState, leashLaps) {
    const speedMult = this.isAuto ? buffState.speedMult : 1;
    const effectiveSpeed = this.def.speed * speedMult;
    this.progress += (effectiveSpeed * dt) / circumference;
    if (this.progress >= 1) {
      this.progress -= Math.floor(this.progress);
      this.lapsCompleted += 1;
      if (this.lapsCompleted >= leashLaps) {
        this.leashed = true;
      }
    }
  }

  takeDamage(amount, buffState) {
    const mult = this.isAuto ? buffState.damageTakenMult : 1;
    this.hp -= amount * mult;
    if (this.hp <= 0) this.dead = true;
    return this.dead;
  }

  positionOn(loopManager) {
    return loopManager.getPositionForProgress(this.progress);
  }
}
