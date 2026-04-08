import { TOWERS, UPGRADES, SELL_RATE, ANIM_TOWER_SPAWN } from '../constants.js';
import { Projectile } from './Projectile.js';

export class Tower {
  constructor(type, col, row, grid) {
    this._def = TOWERS[type];

    this.type  = type;
    this.col   = col;
    this.row   = row;
    this.grid  = grid;
    this.level = 1;

    // Mutable stats (upgrade modifies these in place)
    this.damage          = this._def.damage;
    this.fireRate        = this._def.fireRate;
    this.projectileSpeed = this._def.projectileSpeed;
    this.slowFactor      = this._def.slowFactor;
    this.slowDuration    = this._def.slowDuration;
    this.color           = this._def.color;

    // Mechanical upgrade flags
    this.multiTarget     = 1;   // how many targets to fire at per cycle
    this.burstShots      = 1;   // projectiles fired per trigger
    this.chainDamage     = 0;   // projectile chains to N nearby enemies on hit
    this.slowSpreadTiles = 0;   // slow spreads to enemies within N tiles on hit

    // Pixel-scaled — set by updatePosition()
    this.range        = 0;
    this.splashRadius = 0;
    this.x = 0;
    this.y = 0;

    this.fireCooldown = 0;
    this.target       = null;

    this.scale     = 0;
    this.animTimer = 0;

    // Economy tracking
    this._totalSpent    = this._def.cost;
    this._upgradeRangeX  = 1;
    this._upgradeSplashX = 1;

    this.updatePosition();
  }

  updatePosition() {
    const center = this.grid.gridToScreen(this.col, this.row);
    this.x = center.x;
    this.y = center.y;
    this.range        = this._def.range       * this.grid.tileSize * this._upgradeRangeX;
    this.splashRadius = this._def.splashRadius * this.grid.tileSize * this._upgradeSplashX;
  }

  upgrade(option = 'a') {
    if (!this.canUpgrade) return false;

    // Choose the right upgrade block based on current level
    let key;
    if (this.level === 1) key = option;      // 'a' or 'b'
    else if (this.level === 2) key = 'c';
    else if (this.level === 3) key = 'd';
    else return false;

    const up = UPGRADES[this.type]?.[key];
    if (!up) return false;

    // Stat multipliers
    if (up.damageX)   this.damage    *= up.damageX;
    if (up.fireRateX) this.fireRate  *= up.fireRateX;
    if (up.slowFactor   !== undefined) this.slowFactor   = up.slowFactor;
    if (up.slowDuration !== undefined) this.slowDuration = up.slowDuration;

    // Range / splash multipliers (cumulative across upgrades)
    if (up.rangeX) {
      this._upgradeRangeX *= up.rangeX;
      this.range = this._def.range * this.grid.tileSize * this._upgradeRangeX;
    }
    if (up.splashX) {
      this._upgradeSplashX *= up.splashX;
      this.splashRadius = this._def.splashRadius * this.grid.tileSize * this._upgradeSplashX;
    }

    // Mechanical upgrades
    if (up.multiTarget !== undefined) this.multiTarget     = up.multiTarget;
    if (up.burstShots  !== undefined) this.burstShots      = up.burstShots;
    if (up.chainDamage !== undefined) this.chainDamage     = up.chainDamage;
    if (up.slowSpread  !== undefined) this.slowSpreadTiles = up.slowSpread;

    this._totalSpent += up.cost;
    this.level++;

    // Restart spawn animation to signal upgrade
    this.animTimer = 0;
    this.scale     = 0;
    return true;
  }

  get canUpgrade()   { return this.level < 4; }
  get sellValue()    { return Math.floor(this._totalSpent * SELL_RATE); }

  /** Cost of the next upgrade given the option key ('a','b','c','d'). */
  nextUpgradeCost(option = 'a') {
    const key = this.level === 1 ? option : this.level === 2 ? 'c' : 'd';
    return UPGRADES[this.type]?.[key]?.cost ?? 0;
  }

  update(dt, enemies) {
    // Spawn animation
    if (this.animTimer < ANIM_TOWER_SPAWN) {
      this.animTimer += dt;
      const t = Math.min(this.animTimer / ANIM_TOWER_SPAWN, 1);
      this.scale = t < 0.7 ? (t / 0.7) * 1.1 : 1.1 - ((t - 0.7) / 0.3) * 0.1;
    } else {
      this.scale = 1;
    }

    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    if (this.fireCooldown <= 0 && enemies.length > 0) {
      const targets = this._acquireTargets(enemies, this.multiTarget);
      if (targets.length > 0) {
        this.target = targets[0];
        for (const t of targets) {
          for (let b = 0; b < this.burstShots; b++) {
            this._fireAt(t);
          }
        }
        this.fireCooldown = 1 / this.fireRate;
      } else {
        this.target = null;
      }
    }

    // Keep target display valid
    if (this.target && (!this.target.active || !this._inRange(this.target))) {
      this.target = null;
    }
  }

  _acquireTargets(enemies, maxCount = 1) {
    const inRange = [];
    for (const e of enemies) {
      if (!e.active || e.dying) continue;
      if (this._inRange(e)) inRange.push(e);
    }
    // Prioritise furthest along path
    inRange.sort((a, b) => b.pathIndex - a.pathIndex);
    return maxCount >= 99 ? inRange : inRange.slice(0, maxCount);
  }

  _inRange(enemy) {
    const dx = enemy.x - this.x;
    const dy = enemy.y - this.y;
    return (dx * dx + dy * dy) <= (this.range * this.range);
  }

  _fireAt(target) {
    const p = Projectile.pool.acquire();
    p.fire(
      this.x, this.y,
      target,
      this.damage,
      this.projectileSpeed,
      this.splashRadius,
      this.slowFactor,
      this.slowDuration,
      this.color,
      this._def.projectileSize,
      this.type,
      this.chainDamage,
      this.slowSpreadTiles * this.grid.tileSize,
    );
  }
}
