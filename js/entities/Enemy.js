import { ENEMIES, COLORS, WAVE_HP_SCALE, WAVE_SPEED_SCALE } from '../constants.js';

export class Enemy {
  constructor(type, wave, pathPixels, grid) {
    const def = ENEMIES[type];

    this.type    = type;
    this.active  = true;
    this.reached = false;   // true when enemy exits the map

    // Stats (scaled per wave)
    this.maxHp   = def.hp    * Math.pow(WAVE_HP_SCALE,    wave - 1);
    this.hp      = this.maxHp;
    this.speed   = def.speed * Math.pow(WAVE_SPEED_SCALE, wave - 1) * grid.tileSize; // px/sec
    this.reward  = def.reward;
    this.size    = def.size  * grid.tileSize;  // px radius
    this.color   = def.color;

    // Slow effect
    this.slowTimer = 0;
    this.slowFactor = 1.0;

    // Path traversal
    this.pathPixels    = pathPixels;
    this.pathIndex     = 0;
    this.x = pathPixels[0].x;
    this.y = pathPixels[0].y;

    // Visual — death animation
    this.dying     = false;
    this.dieTimer  = 0;
    this.dieDuration = 0.25;
    this.opacity   = 1.0;
  }

  update(dt) {
    if (this.dying) {
      this.dieTimer += dt;
      this.opacity   = 1.0 - (this.dieTimer / this.dieDuration);
      if (this.dieTimer >= this.dieDuration) this.active = false;
      return;
    }

    // Slow timer
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowTimer  = 0;
        this.slowFactor = 1.0;
      }
    }

    const effectiveSpeed = this.speed * this.slowFactor;
    let remaining = effectiveSpeed * dt;

    while (remaining > 0 && this.pathIndex < this.pathPixels.length - 1) {
      const target = this.pathPixels[this.pathIndex + 1];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (remaining >= dist) {
        this.x = target.x;
        this.y = target.y;
        this.pathIndex++;
        remaining -= dist;
      } else {
        const ratio = remaining / dist;
        this.x += dx * ratio;
        this.y += dy * ratio;
        remaining = 0;
      }
    }

    // Reached end of path
    if (this.pathIndex >= this.pathPixels.length - 1) {
      this.reached = true;
      this.active  = false;
    }
  }

  takeDamage(amount, slow = 1.0, slowDuration = 0) {
    if (this.dying) return;
    this.hp -= amount;
    if (slow < 1.0) {
      this.slowFactor = Math.min(this.slowFactor, slow);
      this.slowTimer  = Math.max(this.slowTimer, slowDuration);
    }
    if (this.hp <= 0) {
      this.hp    = 0;
      this.dying = true;
    }
  }

  applyFreeze(slowFactor, duration) {
    this.slowFactor = Math.min(this.slowFactor, slowFactor);
    this.slowTimer  = Math.max(this.slowTimer, duration);
  }

  get hpFraction() {
    return Math.max(0, this.hp / this.maxHp);
  }

  get isFrozen() {
    return this.slowTimer > 0 && this.slowFactor < 0.9;
  }
}
