import { ENEMIES, WAVE_HP_SCALE, WAVE_SPEED_SCALE, ANIM_ENEMY_DEATH } from '../constants.js';

export class Enemy {
  constructor(type, wave, pathPixels, grid, hpMult = 1, spdMult = 1) {
    const def = ENEMIES[type];

    this.type    = type;
    this.active  = true;
    this.reached = false;

    this.maxHp  = def.hp    * Math.pow(WAVE_HP_SCALE,    wave - 1) * hpMult;
    this.hp     = this.maxHp;
    this.speed  = def.speed * Math.pow(WAVE_SPEED_SCALE, wave - 1) * spdMult * grid.tileSize;
    this.reward = def.reward;
    this.size   = def.size  * grid.tileSize;
    this.color  = def.color;
    this.armor  = def.armor  ?? 0;
    this.isBoss = def.isBoss ?? false;

    this.slowTimer  = 0;
    this.slowFactor = 1.0;

    this.pathPixels = pathPixels;
    this.pathIndex  = 0;
    this.x = pathPixels[0].x;
    this.y = pathPixels[0].y;

    this.dying    = false;
    this.dieTimer = 0;
    this.opacity  = 1.0;

    // Internal reward tracking — kept here to avoid external mutation
    this._rewarded = false;
  }

  update(dt) {
    if (this.dying) {
      this.dieTimer += dt;
      this.opacity   = 1.0 - (this.dieTimer / ANIM_ENEMY_DEATH);
      if (this.dieTimer >= ANIM_ENEMY_DEATH) this.active = false;
      return;
    }

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowTimer  = 0;
        this.slowFactor = 1.0;
      }
    }

    let remaining = this.speed * this.slowFactor * dt;

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

    if (this.pathIndex >= this.pathPixels.length - 1) {
      this.reached = true;
      this.active  = false;
    }
  }

  takeDamage(amount, slow = 1.0, slowDuration = 0) {
    if (this.dying) return;
    this.hp -= Math.max(1, amount - this.armor);
    if (slow < 1.0) {
      this.slowFactor = Math.min(this.slowFactor, slow);
      this.slowTimer  = Math.max(this.slowTimer, slowDuration);
    }
    if (this.hp <= 0) {
      this.hp    = 0;
      this.dying = true;
    }
  }

  get hpFraction() {
    return Math.max(0, this.hp / this.maxHp);
  }

  get isFrozen() {
    return this.slowTimer > 0 && this.slowFactor < 0.9;
  }
}
