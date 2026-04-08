/**
 * Frontend error handler — catches uncaught JS errors and unhandled promise
 * rejections and surfaces them as toasts in development, silently logs in prod.
 *
 * Call ErrorHandler.init(uiManager) once at boot.
 */
export class ErrorHandler {
  static _ui = null;

  static init(ui) {
    ErrorHandler._ui = ui;

    window.addEventListener('error', (event) => {
      ErrorHandler._handle(event.message, event.filename, event.lineno);
      return false; // allow default browser logging
    });

    window.addEventListener('unhandledrejection', (event) => {
      const msg = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);
      ErrorHandler._handle(`Unhandled promise: ${msg}`);
    });
  }

  static _handle(message, file = '', line = '') {
    const loc  = file ? ` (${file.split('/').pop()}:${line})` : '';
    const text = `[Error]${loc} ${message}`;
    console.error(text);

    // Show brief toast in browser (useful during dev / on device)
    if (ErrorHandler._ui) {
      try {
        ErrorHandler._ui.showToast(`⚠ ${message.slice(0, 80)}`, 4000);
      } catch (_) {
        // If UI itself is broken, don't recurse
      }
    }
  }

  /** Log a non-fatal warning — visible in debug overlay */
  static warn(message) {
    console.warn('[Game]', message);
    ErrorHandler._warnings.push({ t: Date.now(), msg: message });
    if (ErrorHandler._warnings.length > 20) ErrorHandler._warnings.shift();
  }

  static _warnings = [];
  static get warnings() { return ErrorHandler._warnings; }
}
