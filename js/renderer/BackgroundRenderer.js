import { COLORS } from '../constants.js';
import { TILE } from '../grid.js';

/**
 * Renders the static layer: grid lines, path tiles, and decorative grid labels.
 * Redraws only on canvas resize — not every frame.
 */
export class BackgroundRenderer {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.grid   = grid;
  }

  draw() {
    const { ctx, grid } = this;
    const { tileSize, cols, rows, offsetX, offsetY } = grid;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Fill base background
    ctx.fillStyle = COLORS.bgBase;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Fill grid area background (slightly different from page bg)
    ctx.fillStyle = COLORS.bgSurface;
    ctx.fillRect(offsetX, offsetY, tileSize * cols, tileSize * rows);

    // Path tiles
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid.tiles[r][c].type === TILE.PATH) {
          this._drawPathTile(c, r);
        }
      }
    }

    // Draw subtle path connector lines between adjacent path tiles
    this._drawPathConnectors();

    // Grid lines (drawn on top, very subtle)
    this._drawGridLines();

    // Entry / exit markers
    this._drawEntryExit();
  }

  _drawPathTile(col, row) {
    const { ctx, grid } = this;
    const { tileSize, offsetX, offsetY } = grid;
    const x = offsetX + col * tileSize;
    const y = offsetY + row * tileSize;

    ctx.fillStyle = COLORS.pathFill;
    ctx.fillRect(x, y, tileSize, tileSize);
  }

  _drawPathConnectors() {
    // Draw the center-line of the path for visual clarity
    const { ctx, grid } = this;
    if (!grid.pathPixels.length) return;

    ctx.save();
    ctx.strokeStyle = COLORS.pathBorder;
    ctx.lineWidth   = Math.max(1, grid.tileSize * 0.08);
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.setLineDash([grid.tileSize * 0.15, grid.tileSize * 0.35]);
    ctx.globalAlpha = 0.4;

    ctx.beginPath();
    const pts = grid.pathPixels;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawGridLines() {
    const { ctx, grid } = this;
    const { tileSize, cols, rows, offsetX, offsetY } = grid;

    ctx.save();
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth   = 1;

    // Vertical lines
    for (let c = 0; c <= cols; c++) {
      const x = offsetX + c * tileSize;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + rows * tileSize);
      ctx.stroke();
    }

    // Horizontal lines
    for (let r = 0; r <= rows; r++) {
      const y = offsetY + r * tileSize;
      ctx.beginPath();
      ctx.moveTo(offsetX,                 y);
      ctx.lineTo(offsetX + cols * tileSize, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawEntryExit() {
    const { ctx, grid } = this;
    const { tileSize, offsetX, offsetY } = grid;
    const pts = grid.pathPixels;
    if (!pts.length) return;

    const r = tileSize * 0.18;

    // Entry arrow — left side
    const entry = pts[0];
    ctx.save();
    ctx.fillStyle = COLORS.accentGreen;
    ctx.globalAlpha = 0.7;
    ctx.font = `bold ${Math.max(10, tileSize * 0.4)}px Inter, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶', entry.x, entry.y);
    ctx.restore();

    // Exit marker — right side
    const exit = pts[pts.length - 1];
    ctx.save();
    ctx.fillStyle = COLORS.accentRed;
    ctx.globalAlpha = 0.7;
    ctx.font = `bold ${Math.max(10, tileSize * 0.4)}px Inter, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬛', exit.x, exit.y);
    ctx.restore();
  }
}
