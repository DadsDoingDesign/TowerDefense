import { MAX_PROJECTILES } from '../constants.js';

/**
 * Projectile with object pool.
 * Call Projectile.pool.acquire() to get a projectile.
 * Call p.release() when done.
 */
export class Projectile {
  constructor() {
    this.active = false;
    this.reset();
  }

  reset() {
    this.x      = 0;
    this.y      = 0;
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

    // If target is gone, just deactivate
    if (!this.targetEnemy || !this.targetEnemy.active) {
      this.release();
      return;
    }

    const tx = this.targetEnemy.x;
    const ty = this.targetEnemy.y;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const move = this.speed * dt;

    if (move >= dist) {
      // Hit
      this.x = tx;
      this.y = ty;

      if (this.splashRadius > 0) {
        // AoE: damage all enemies within splash radius
        onSplash(this.x, this.y, this.splashRadius, this.damage, this.slowFactor, this.slowDuration);
      } else {
        this.targetEnemy.takeDamage(this.damage, this.slowFactor, this.slowDuration);
      }

      this.hit = true;
      this.release();
    } else {
      this.x += (dx / dist) * move;
      this.y += (dy / dist) * move;
    }
  }

  release() {
    this.active = false;
    Projectile.pool.release(this);
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
    // Pool exhausted — create overflow (shouldn't happen normally)
    const p = new Projectile();
    this._pool.push(p);
    return p;
  },

  release(p) {
    p.reset();
  },

  get active() {
    return this._pool.filter(p => p.active);
  },
};

Projectile.pool.init();
