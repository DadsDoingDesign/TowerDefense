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
    // Guard: scale=0 means update() hasn't ticked yet — draw at full size
    const s   = tower.scale > 0 ? tower.scale : 1;
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

    // Level indicator dots (1 per upgrade level, stacked in corner)
    if (tower.level > 1) {
      const dotColors = [COLORS.accentAmber, COLORS.accentGreen, COLORS.accentRed];
      const dots = tower.level - 1;
      for (let d = 0; d < dots; d++) {
        ctx.fillStyle   = dotColors[d] ?? COLORS.accentRed;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(ts * 0.32, -ts * 0.22 - d * 7, 3, 0, Math.PI * 2);
        ctx.fill();
      }
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
      case 'meta': {
        // Infinity / data-loop: two overlapping circles
        ctx.globalAlpha = 0.9;
        const cr = h * 0.28;
        ctx.lineWidth   = Math.max(2, h * 0.22);
        ctx.strokeStyle = TOWERS[type].color;
        ctx.beginPath();
        ctx.arc(-cr * 0.85, 0, cr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc( cr * 0.85, 0, cr, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'amazon': {
        // Cardboard box with lid lines
        const bw = h * 0.8, bh = h * 0.7;
        ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
        ctx.strokeStyle = TOWERS[type].color;
        ctx.lineWidth = Math.max(1, h * 0.1);
        // Smile arrow across bottom of box
        ctx.strokeStyle = COLORS.bgBase;
        ctx.lineWidth   = Math.max(1.5, h * 0.14);
        ctx.beginPath();
        ctx.moveTo(-bw * 0.35, bh * 0.1);
        ctx.quadraticCurveTo(0, bh * 0.42, bw * 0.35, bh * 0.1);
        ctx.stroke();
        // Lid lines
        ctx.strokeStyle = COLORS.bgBase;
        ctx.lineWidth   = Math.max(1, h * 0.1);
        ctx.beginPath();
        ctx.moveTo(0, -bh / 2);
        ctx.lineTo(0, -bh * 0.05);
        ctx.stroke();
        break;
      }
      case 'uber': {
        // Car silhouette — top-down (rounded rectangle body)
        const cw = h * 0.9, ch = h * 0.55;
        this._roundRect(ctx, -cw / 2, -ch / 2, cw, ch, ch * 0.2);
        ctx.fill();
        // Cabin cutout
        ctx.fillStyle = COLORS.bgBase;
        ctx.globalAlpha = 0.45;
        const cabW = cw * 0.5, cabH = ch * 0.58;
        ctx.fillRect(-cabW / 2, -cabH / 2, cabW, cabH);
        ctx.globalAlpha = 1;
        break;
      }
      case 'tesla': {
        // Lightning bolt
        ctx.beginPath();
        ctx.moveTo( h * 0.18, -h * 0.6);
        ctx.lineTo(-h * 0.22,  h * 0.05);
        ctx.lineTo( h * 0.08,  h * 0.05);
        ctx.lineTo(-h * 0.18,  h * 0.6);
        ctx.lineTo( h * 0.22, -h * 0.05);
        ctx.lineTo(-h * 0.08, -h * 0.05);
        ctx.closePath();
        ctx.fill();
        break;
      }
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

    // Slow tint halo
    if (enemy.isFrozen) {
      ctx.fillStyle = COLORS.slowTint;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, r * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dispatch to themed shape
    switch (enemy.type) {
      case 'basic':   this._drawIntern(enemy, r);      break;
      case 'fast':    this._drawGrowthHacker(enemy, r); break;
      case 'tank':    this._drawVCMoney(enemy, r);      break;
      case 'armored': this._drawConsultant(enemy, r);   break;
      case 'boss':    this._drawDisruptor(enemy, r);    break;
      default: {
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (!enemy.dying) this._drawHpBar(enemy, r);
    ctx.restore();
  }

  // Intern — gray person silhouette (circle head + body + tie)
  _drawIntern(e, r) {
    const { ctx } = this;
    const headR = r * 0.42;
    const bodyW = r * 0.52;
    const bodyH = r * 0.72;
    const bodyY = e.y + headR * 0.5;

    ctx.fillStyle = e.color;
    // Body
    this._roundRect(ctx, e.x - bodyW / 2, bodyY - bodyH * 0.05, bodyW, bodyH, bodyW * 0.25);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(e.x, bodyY - headR * 0.9, headR, 0, Math.PI * 2);
    ctx.fill();
    // Tiny tie
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(e.x, bodyY + r * 0.02);
    ctx.lineTo(e.x - r * 0.1, bodyY + r * 0.38);
    ctx.lineTo(e.x, bodyY + r * 0.32);
    ctx.lineTo(e.x + r * 0.1, bodyY + r * 0.38);
    ctx.closePath();
    ctx.fill();
  }

  // Growth Hacker — green rocket pointing in travel direction
  _drawGrowthHacker(e, r) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);

    // Body
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(r * 0.12, -r * 0.44);
    ctx.lineTo(-r * 0.65, -r * 0.28);
    ctx.lineTo(-r * 0.65,  r * 0.28);
    ctx.lineTo(r * 0.12,  r * 0.44);
    ctx.closePath();
    ctx.fill();
    // Exhaust flame
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-r * 0.65, -r * 0.2);
    ctx.lineTo(-r * 1.05, 0);
    ctx.lineTo(-r * 0.65,  r * 0.2);
    ctx.closePath();
    ctx.fill();
    // Window dot
    ctx.fillStyle = COLORS.bgBase;
    ctx.beginPath();
    ctx.arc(r * 0.3, 0, r * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // VC Money — red money bag (fat circle + $ sign)
  _drawVCMoney(e, r) {
    const { ctx } = this;
    // Bag body
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y + r * 0.1, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    // Bag neck/knot
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y - r * 0.72, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    // Tie line
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth   = r * 0.18;
    ctx.beginPath();
    ctx.moveTo(e.x - r * 0.25, e.y - r * 0.5);
    ctx.lineTo(e.x + r * 0.25, e.y - r * 0.5);
    ctx.stroke();
    // $ symbol
    ctx.fillStyle  = 'rgba(255,255,255,0.82)';
    ctx.font       = `bold ${r * 0.85}px sans-serif`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', e.x, e.y + r * 0.12);
    // Outer stroke
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y + r * 0.1, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Consultant — armored briefcase shape
  _drawConsultant(e, r) {
    const { ctx } = this;
    const bw = r * 1.55, bh = r * 1.0;
    const bx = e.x - bw / 2, by = e.y - bh / 2 + r * 0.12;
    const hh = r * 0.32, hw = bw * 0.38;

    // Handle
    ctx.strokeStyle = e.color;
    ctx.lineWidth   = r * 0.22;
    ctx.beginPath();
    this._roundRect(ctx, e.x - hw / 2, by - hh, hw, hh, r * 0.1);
    ctx.stroke();
    // Case body
    ctx.fillStyle = e.color;
    this._roundRect(ctx, bx, by, bw, bh, r * 0.18);
    ctx.fill();
    // Centre divider
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth   = r * 0.12;
    ctx.beginPath();
    ctx.moveTo(e.x, by + r * 0.14);
    ctx.lineTo(e.x, by + bh - r * 0.14);
    ctx.stroke();
    // Latch dot
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(e.x, e.y + r * 0.12, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Outer accent stroke
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = 1.5;
    this._roundRect(ctx, bx, by, bw, bh, r * 0.18);
    ctx.stroke();
  }

  // Disruptor — boss star-burst with pulsing aura
  _drawDisruptor(e, r) {
    const { ctx } = this;
    // Outer pulsing ring
    ctx.strokeStyle = e.color;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = e.opacity * 0.35;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 1.65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = e.opacity;

    // 8-point star burst
    const spikes = 8, innerR = r * 0.55;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const rr = i % 2 === 0 ? r : innerR;
      const px = e.x + rr * Math.cos(angle);
      const py = e.y + rr * Math.sin(angle);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Core glow
    ctx.fillStyle = 'rgba(255,80,80,0.55)';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // ⚡ icon hint
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font      = `bold ${r * 0.55}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', e.x, e.y);
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

    // Glow pass
    ctx.save();
    ctx.globalAlpha = 0.22;
    Projectile.pool.forEachActive(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Shape pass
    ctx.globalAlpha = 1;
    Projectile.pool.forEachActive(p => {
      ctx.fillStyle = p.color;
      const s = p.size;
      switch (p.shape) {
        case 'amazon': {
          // Cardboard box — small square with lid line
          ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
          ctx.strokeStyle = COLORS.bgBase;
          ctx.lineWidth   = Math.max(0.8, s * 0.4);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x, p.y + s * 0.2);
          ctx.stroke();
          break;
        }
        case 'uber': {
          // Tiny car — wider rectangle
          this._roundRect(ctx, p.x - s * 1.4, p.y - s * 0.7, s * 2.8, s * 1.4, s * 0.4);
          ctx.fill();
          break;
        }
        case 'tesla': {
          // Mini lightning bolt
          ctx.beginPath();
          ctx.moveTo(p.x + s * 0.35, p.y - s);
          ctx.lineTo(p.x - s * 0.35, p.y);
          ctx.lineTo(p.x + s * 0.1,  p.y);
          ctx.lineTo(p.x - s * 0.35, p.y + s);
          ctx.lineTo(p.x + s * 0.35, p.y);
          ctx.lineTo(p.x - s * 0.1,  p.y);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'meta':
        default: {
          // Data packet — small square (slightly rotated diamond for meta)
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7);
          ctx.restore();
          break;
        }
      }
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
