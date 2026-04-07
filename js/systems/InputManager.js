/**
 * Unified input manager: handles both touch and mouse events.
 * Translates input events into game-level actions via callbacks.
 */
export class InputManager {
  /**
   * @param {HTMLCanvasElement} canvas - the game canvas (receives input)
   * @param {Object} handlers - { onTap(x, y), onHover(x, y), onLeave() }
   */
  constructor(canvas, handlers) {
    this.canvas   = canvas;
    this.handlers = handlers;

    this._lastTouchX = 0;
    this._lastTouchY = 0;
    this._touchMoved = false;

    this._bindMouse();
    this._bindTouch();
  }

  // ----------------------------------------------------------------
  // Mouse
  // ----------------------------------------------------------------

  _bindMouse() {
    this.canvas.addEventListener('click', e => {
      const { x, y } = this._relativePos(e.clientX, e.clientY);
      this.handlers.onTap?.(x, y);
    });

    this.canvas.addEventListener('mousemove', e => {
      const { x, y } = this._relativePos(e.clientX, e.clientY);
      this.handlers.onHover?.(x, y);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.handlers.onLeave?.();
    });
  }

  // ----------------------------------------------------------------
  // Touch
  // ----------------------------------------------------------------

  _bindTouch() {
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      this._lastTouchX = t.clientX;
      this._lastTouchY = t.clientY;
      this._touchMoved = false;
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - this._lastTouchX);
      const dy = Math.abs(t.clientY - this._lastTouchY);
      if (dx > 8 || dy > 8) this._touchMoved = true;
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (this._touchMoved) return;  // was a scroll/drag, not a tap
      const t = e.changedTouches[0];
      const { x, y } = this._relativePos(t.clientX, t.clientY);
      this.handlers.onTap?.(x, y);
    }, { passive: false });
  }

  // ----------------------------------------------------------------
  // Coordinate helper
  // ----------------------------------------------------------------

  _relativePos(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }

  destroy() {
    // Clone and replace canvas node to remove all listeners (simple teardown)
    // Not needed for normal use but useful for tests / restarts
  }
}
