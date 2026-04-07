import { TOWERS, COLORS } from '../constants.js';
import { Projectile } from './Projectile.js';

export class Tower {
  constructor(type, col, row, grid) {
    const def = TOWERS[type];

    this.type  = type;
    this.col   = col;
    this.row   = row;
    this.grid  = grid;

    // Stats from definition
    this.damage         = def.damage;
    this.range          = def.range * grid.tileSize;  // px
    this.fireRate       = def.fireRate;               // shots/sec
    this.projectileSpeed = def.projectileSpeed;
    this.splashRadius   = def.splashRadius * grid.tileSize;
    this.slowFactor     = def.slowFactor;
    this.color          = def.color;

    // State
    this.fireCooldown = 0;
    this.target       = null;

    // Visual — placement animation
    this.scale     = 0;
    this.animTimer = 0;
    this.animDuration = 0.2;

    // Pixel center (updated on resize via updatePosition)
    this.updatePosition();
  }

  updatePosition() {
    const center = this.grid.gridToScreen(this.col, this.row);
    this.x = center.x;
    this.y = center.y;
    this.range = TOWERS[this.type].range * this.grid.tileSize;
    this.splashRadius = TOWERS[this.type].splashRadius * this.grid.tileSize;
  }

  update(dt, enemies) {
    // Placement animation
    if (this.animTimer < this.animDuration) {
      this.animTimer += dt;
      const t = Math.min(this.animTimer / this.animDuration, 1);
      // Overshoot: 0 → 1.1 → 1.0
      this.scale = t < 0.7
        ? (t / 0.7) * 1.1
        : 1.1 - ((t - 0.7) / 0.3) * 0.1;
    } else {
      this.scale = 1;
    }

    // Fire cooldown
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }

    // Validate existing target
    if (this.target && (!this.target.active || !this._inRange(this.target))) {
      this.target = null;
    }

    // Acquire target — closest enemy in range that is furthest along the path
    if (!this.target) {
      this.target = this._acquireTarget(enemies);
    }

    // Fire
    if (this.target && this.fireCooldown <= 0) {
      this._fire();
      this.fireCooldown = 1 / this.fireRate;
    }
  }

  _acquireTarget(enemies) {
    let best = null;
    let bestPathIndex = -1;

    for (const e of enemies) {
      if (!e.active || e.dying) continue;
      if (!this._inRange(e)) continue;
      // Prefer enemy furthest along the path (highest pathIndex)
      if (e.pathIndex > bestPathIndex) {
        bestPathIndex = e.pathIndex;
        best = e;
      }
    }
    return best;
  }

  _inRange(enemy) {
    const dx = enemy.x - this.x;
    const dy = enemy.y - this.y;
    return (dx * dx + dy * dy) <= (this.range * this.range);
  }

  _fire() {
    const p = Projectile.pool.acquire();
    const slowDuration = this.type === 'frost' ? 1.8 : 0;
    const pSize = this.type === 'laser' ? 3 : this.type === 'cannon' ? 6 : 4;

    p.fire(
      this.x, this.y,
      this.target,
      this.damage,
      this.projectileSpeed,
      this.splashRadius,
      this.slowFactor,
      slowDuration,
      this.color,
      pSize,
    );
  }
}
