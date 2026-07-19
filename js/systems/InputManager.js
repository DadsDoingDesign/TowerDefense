export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this._tapHandlers = [];
    this._hoverHandlers = [];
    this._leaveHandlers = [];
    this._bind();
  }

  onTap(fn) {
    this._tapHandlers.push(fn);
  }

  onHover(fn) {
    this._hoverHandlers.push(fn);
  }

  onLeave(fn) {
    this._leaveHandlers.push(fn);
  }

  _bind() {
    this.canvas.addEventListener('click', (e) => {
      const { x, y } = this._toCanvasCoords(e.clientX, e.clientY);
      this._tapHandlers.forEach((fn) => fn(x, y));
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this._toCanvasCoords(e.clientX, e.clientY);
      this._hoverHandlers.forEach((fn) => fn(x, y));
    });
    this.canvas.addEventListener('mouseleave', () => {
      this._leaveHandlers.forEach((fn) => fn());
    });
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        const { x, y } = this._toCanvasCoords(touch.clientX, touch.clientY);
        this._tapHandlers.forEach((fn) => fn(x, y));
      },
      { passive: true }
    );
  }

  _toCanvasCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }
}
