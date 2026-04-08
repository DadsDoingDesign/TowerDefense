import { COLORS, TOWERS } from '../constants.js';
import { Projectile } from '../entities/Projectile.js';

/**
 * Renders the dynamic game layer every frame.
 */
export class GameRenderer {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.grid   = grid;

    this.hoverCell     = null;
    this.placingTower  = null;
    this.selectedTower = null; // placed tower tapped for sell/upgrade (Batch 2)
  }

  draw(towers, enemies) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawHoverOverlay();
    this._drawTowers(towers);
    this._drawProjectiles();
    this._drawEnemies(enemies);
  }

  // ----------------------------------------------------------------
  // Hover overlay
  // ----------------------------------------------------------------

  _drawHoverOverlay() {
    if (!this.hoverCell || !this.placingTower) return;
    const { col, row } = this.hoverCell;
    const { grid, ctx } = this;
    const canPlace = grid.canPlaceTower(col, row);

    const tl = grid.gridToScreenTopLeft(col, row);
    ctx.fillStyle = canPlace ? COLORS.tileHover : COLORS.tileInvalid;
    ctx.fillRect(tl.x, tl.y, grid.tileSize, grid.tileSize);

    if (canPlace) {
      const center = grid.gridToScreen(col, row);
      const def    = TOWERS[this.placingTower];
      const range  = def.range * grid.tileSize;
      ctx.save();
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------
  // Towers
  // ----------------------------------------------------------------

  _drawTowers(towers) {
    for (const tower of towers) {
      this._drawTower(tower);
    }
  }

  _drawTower(tower) {
    const { ctx, grid } = this;
    const s   = tower.scale;
    const ts  = grid.tileSize;
    const pad = ts * 0.14;
    const size = (ts - pad * 2) * s;
    const half = size / 2;
    const r    = size * 0.18;

    ctx.save();
    ctx.translate(tower.x, tower.y);

    // Selection ring (shown when tower info panel is open)
    if (this.selectedTower === tower) {
      ctx.strokeStyle = COLORS.accentBlue;
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, ts * 0.56, 0, Math.PI * 2);
      ctx.stroke();
      // Also draw range ring
      ctx.strokeStyle = tower.color;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, tower.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Upgrade tier indicator (small dot in corner)
    if (tower.level === 2) {
      ctx.fillStyle = COLORS.accentAmber;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(ts * 0.3, -ts * 0.3, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.scale(s, s);

    ctx.fillStyle   = COLORS.bgElevated;
    ctx.strokeStyle = tower.color;
    ctx.lineWidth   = Math.max(1.5, ts * 0.06);
    this._roundRect(ctx, -half, -half, size, size, r);
    ctx.fill();
    ctx.stroke();

    this._drawTowerIcon(ctx, tower.type, size);

    ctx.restore();
  }

  _drawTowerIcon(ctx, type, size) {
    const h = size * 0.45;
    ctx.save();
    ctx.fillStyle = TOWERS[type].color;

    switch (type) {
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(-h * 0.5, -h * 0.28);
        ctx.lineTo( h * 0.1, -h * 0.28);
        ctx.lineTo( h * 0.1, -h * 0.55);
        ctx.lineTo( h * 0.55, 0);
        ctx.lineTo( h * 0.1,  h * 0.55);
        ctx.lineTo( h * 0.1,  h * 0.28);
        ctx.lineTo(-h * 0.5,  h * 0.28);
        ctx.closePath();
        ctx.fill();
        break;

      case 'cannon':
        ctx.beginPath();
        ctx.arc(0, 0, h * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(h * 0.2, -h * 0.14, h * 0.5, h * 0.28);
        break;

      case 'frost':
        ctx.lineWidth   = Math.max(1.5, h * 0.2);
        ctx.strokeStyle = TOWERS[type].color;
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 3);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -h * 0.55);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-h * 0.2, -h * 0.35);
          ctx.lineTo( h * 0.2, -h * 0.35);
          ctx.stroke();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0, 0, h * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'laser':
        ctx.beginPath();
        ctx.moveTo(0,        -h * 0.6);
        ctx.lineTo( h * 0.55, 0);
        ctx.lineTo(0,         h * 0.6);
        ctx.lineTo(-h * 0.55, 0);
        ctx.closePath();
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Enemies
  // ----------------------------------------------------------------

  _drawEnemies(enemies) {
    for (const e of enemies) {
      if (!e.active && !e.dying) continue;
      this._drawEnemy(e);
    }
  }

  _drawEnemy(enemy) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = enemy.opacity;

    const r = enemy.size / 2;

    if (enemy.isFrozen) {
      ctx.fillStyle = COLORS.slowTint;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, r * 1.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle   = enemy.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (!enemy.dying) this._drawHpBar(enemy, r);

    ctx.restore();
  }

  _drawHpBar(enemy, r) {
    const { ctx } = this;
    const bw = r * 2.2;
    const bh = Math.max(2, r * 0.35);
    const bx = enemy.x - bw / 2;
    const by = enemy.y - r - bh - 3;

    ctx.fillStyle = COLORS.hpBarBg;
    ctx.fillRect(bx, by, bw, bh);

    const frac = enemy.hpFraction;
    ctx.fillStyle = frac > 0.6 ? COLORS.accentGreen : frac > 0.3 ? COLORS.accentAmber : COLORS.accentRed;
    ctx.fillRect(bx, by, bw * frac, bh);
  }

  // ----------------------------------------------------------------
  // Projectiles — no allocation; iterate pool directly
  // ----------------------------------------------------------------

  _drawProjectiles() {
    const { ctx } = this;

    // Two-pass render: glow ring then core dot.
    // Avoids shadowBlur (GPU compositing — expensive on mobile).
    ctx.save();
    ctx.globalAlpha = 0.25;
    Projectile.pool.forEachActive(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    Projectile.pool.forEachActive(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Utility
  // ----------------------------------------------------------------

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
