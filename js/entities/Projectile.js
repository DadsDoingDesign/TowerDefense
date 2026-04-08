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
    this.shape        = 'dot';
    this.chainDamage  = 0;   // chain to N nearby enemies on hit
    this.slowSpread   = 0;   // spread slow to enemies within this px radius
    this.active       = false;
    this.hit          = false;
  }

  fire(x, y, enemy, damage, speed, splashRadius, slowFactor, slowDuration, color, size,
       shape = 'dot', chainDamage = 0, slowSpread = 0) {
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
    this.shape        = shape;
    this.chainDamage  = chainDamage;
    this.slowSpread   = slowSpread;
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

      // Chain damage — arc to nearest N enemies not already hit
      if (this.chainDamage > 0) {
        this._applyChain(enemies, this.chainDamage, this.damage * 0.55);
      }

      // Slow spread — propagate slow to nearby enemies
      if (this.slowSpread > 0 && this.slowFactor < 1.0) {
        this._applySlowSpread(enemies, this.slowSpread);
      }

      this.hit = true;
      this._release();
    } else {
      this.x += (dx / dist) * move;
      this.y += (dy / dist) * move;
    }
  }

  _applyChain(enemies, chainsLeft, damage) {
    const CHAIN_RANGE_SQ = 110 * 110;
    const hit = new Set([this.targetEnemy]);
    let src = this.targetEnemy;

    for (let i = 0; i < chainsLeft; i++) {
      let nearest = null;
      let nearestDsq = CHAIN_RANGE_SQ;
      for (const e of enemies) {
        if (hit.has(e) || !e.active || e.dying) continue;
        const dx = e.x - src.x;
        const dy = e.y - src.y;
        const dsq = dx * dx + dy * dy;
        if (dsq < nearestDsq) { nearestDsq = dsq; nearest = e; }
      }
      if (!nearest) break;
      nearest.takeDamage(damage, this.slowFactor, this.slowDuration);
      hit.add(nearest);
      src = nearest;
      damage *= 0.55;
    }
  }

  _applySlowSpread(enemies, radius) {
    const r2 = radius * radius;
    for (const e of enemies) {
      if (e === this.targetEnemy || !e.active || e.dying) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      if (dx * dx + dy * dy <= r2) {
        e.takeDamage(0, this.slowFactor, this.slowDuration);
      }
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

  get size() { return this._pool.length; },

  /** Iterate active projectiles without allocating an array. */
  forEachActive(fn) {
    for (const p of this._pool) {
      if (p.active) fn(p);
    }
  },

  /** Count active projectiles (used by debug overlay). */
  countActive() {
    let n = 0;
    for (const p of this._pool) { if (p.active) n++; }
    return n;
  },

  /** Deactivate all projectiles — called on game reset. */
  resetAll() {
    for (const p of this._pool) {
      p.reset();
    }
  },
};

Projectile.pool.init();
