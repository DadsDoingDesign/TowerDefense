import { ErrorHandler } from './ErrorHandler.js';

/**
 * Canvas-drawn debug overlay — toggled by pressing 'D'.
 * Shows FPS, entity counts, pool usage, and recent warnings.
 */
export class DebugOverlay {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.visible = false;

    this._fps       = 0;
    this._fpsFrames = 0;
    this._fpsTimer  = 0;
    this._lastMs    = performance.now();

    document.addEventListener('keydown', e => {
      if (e.key === 'd' || e.key === 'D') this.visible = !this.visible;
    });
  }

  tick(dt) {
    this._fpsFrames++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      this._fps       = Math.round(this._fpsFrames / this._fpsTimer);
      this._fpsFrames = 0;
      this._fpsTimer  = 0;
    }
  }

  draw(stats) {
    if (!this.visible) return;

    const { ctx, canvas } = this;
    const { towers, enemies, poolSize, poolActive, wave, gameSpeed } = stats;

    const lines = [
      `FPS  ${this._fps}  ×${gameSpeed} speed`,
      `Wave ${wave}`,
      `Towers   ${towers}`,
      `Enemies  ${enemies}`,
      `Pool     ${poolActive}/${poolSize}`,
    ];

    const warnings = ErrorHandler.warnings;
    if (warnings.length > 0) {
      lines.push('');
      lines.push('— recent warnings —');
      for (const w of warnings.slice(-4)) {
        lines.push(w.msg.slice(0, 48));
      }
    }

    const pad  = 10;
    const lh   = 16;
    const w    = 230;
    const h    = pad * 2 + lines.length * lh;
    const x    = canvas.width - w - 8;
    const y    = 8;

    ctx.save();
    ctx.fillStyle   = 'rgba(10,10,11,0.85)';
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth   = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#71717a';
    ctx.font      = '11px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';

    lines.forEach((line, i) => {
      if (line.startsWith('FPS') || line.startsWith('—')) ctx.fillStyle = '#f4f4f5';
      else ctx.fillStyle = '#71717a';
      ctx.fillText(line, x + pad, y + pad + i * lh);
    });

    ctx.restore();
  }
}
