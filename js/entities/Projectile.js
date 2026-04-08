import { MAX_PROJECTILES } from '../constants.js';

export class Projectile {
  constructor() {
    this.active = false;
    this.reset();
  }

  reset() {
    this.x            = 0;
    this.y            = 0;
    this.targetEnemy  = null;
    this.damage       = 0;
    this.speed        = 0;
    this.splashRadius = 0;
    this.slowFactor   = 1.0;
    this.slowDuration = 0;
    this.color        = '#fff';
    this.size         = 4;
    this.active       = false;
    this.hit          = false;
  }

  fire(x, y, enemy, damage, speed, splashRadius, slowFactor, slowDuration, color, size) {
    this.x            = x;
    this.y            = y;
    this.targetEnemy  = enemy;
    this.damage       = damage;
    this.speed        = speed;
    this.splashRadius = splashRadius;
    this.slowFactor   = slowFactor;
    this.slowDuration = slowDuration;
    this.color        = color;
    this.size         = size;
    this.active       = true;
    this.hit          = false;
  }

  update(dt, enemies, onSplash) {
    if (!this.active) return;

    if (!this.targetEnemy || !this.targetEnemy.active) {
      this._release();
      return;
    }

    const tx = this.targetEnemy.x;
    const ty = this.targetEnemy.y;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const move = this.speed * dt;

    if (move >= dist) {
      this.x = tx;
      this.y = ty;

      if (this.splashRadius > 0) {
        onSplash(this.x, this.y, this.splashRadius, this.damage, this.slowFactor, this.slowDuration);
      } else {
        this.targetEnemy.takeDamage(this.damage, this.slowFactor, this.slowDuration);
      }

      this.hit = true;
      this._release();
    } else {
      this.x += (dx / dist) * move;
      this.y += (dy / dist) * move;
    }
  }

  _release() {
    this.active = false;
  }
}

// ----------------------------------------------------------------
// Object Pool
// ----------------------------------------------------------------
Projectile.pool = {
  _pool: [],

  init() {
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this._pool.push(new Projectile());
    }
  },

  acquire() {
    for (const p of this._pool) {
      if (!p.active) return p;
    }
    // Pool exhausted — log warning and grow
    console.warn('[ProjectilePool] Pool exhausted — growing. Consider raising MAX_PROJECTILES.');
    const p = new Projectile();
    this._pool.push(p);
    return p;
  },

  /** Iterate active projectiles without allocating an array. */
  forEachActive(fn) {
    for (const p of this._pool) {
      if (p.active) fn(p);
    }
  },

  /** Deactivate all projectiles — called on game reset. */
  resetAll() {
    for (const p of this._pool) {
      p.reset();
    }
  },
};

Projectile.pool.init();
