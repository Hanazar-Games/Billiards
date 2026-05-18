export class InputHandler {
  constructor(element) {
    this.element = element;
    this.mouseX = 0;
    this.mouseY = 0;
    this.isDown = false;
    this.rightDown = false;
    this._capturedPointerId = null;

    this.onMouseMove = null;
    this.onMouseDown = null;
    this.onMouseUp = null;
    this.onRightMouseDown = null;
    this.onRightMouseUp = null;

    this._handleMouseMove = this.handleMouseMove.bind(this);
    this._handlePointerMove = this.handlePointerMove.bind(this);
    this._handlePointerDown = this.handlePointerDown.bind(this);
    this._handleMouseDown = this.handleMouseDown.bind(this);
    this._handleMouseUp = this.handleMouseUp.bind(this);
    this._handlePointerCancel = this._handlePointerCancel.bind(this);
    this._handleBlur = this._handleBlur.bind(this);
    this._handleContextMenu = (e) => e.preventDefault();

    if (typeof window !== 'undefined' && window.PointerEvent) {
      element.addEventListener('pointermove', this._handlePointerMove);
      element.addEventListener('pointerdown', this._handlePointerDown);
      element.addEventListener('pointerup', this._handleMouseUp);
      element.addEventListener('pointercancel', this._handlePointerCancel);
      element.addEventListener('lostpointercapture', this._handlePointerCancel);
      element.addEventListener('pointerleave', this._handlePointerCancel);
      if ('onpointerrawupdate' in window) {
        element.addEventListener('pointerrawupdate', this._handlePointerMove);
      }
    } else {
      element.addEventListener('mousemove', this._handleMouseMove);
      element.addEventListener('mouseleave', this._handlePointerCancel);
    }
    element.addEventListener('mousedown', this._handleMouseDown);
    window.addEventListener('mouseup', this._handleMouseUp);
    window.addEventListener('blur', this._handleBlur);
    element.addEventListener('contextmenu', this._handleContextMenu);
  }

  _isCanvasTarget(e) {
    return e.target && e.target.tagName && e.target.tagName.toUpperCase() === 'CANVAS';
  }

  _handlePointerCancel(e) {
    // Treat pointer cancel/leave as mouse-up to prevent soft-lock
    if (this.isDown) {
      this.isDown = false;
      this._capturedPointerId = null;
      if (this.onMouseUp) this.onMouseUp(e);
    }
  }

  _handleBlur() {
    // Reset state when window loses focus to prevent stuck buttons
    if (this.isDown) {
      this.isDown = false;
      this._capturedPointerId = null;
      if (this.onMouseUp) this.onMouseUp();
    }
    if (this.rightDown) {
      this.rightDown = false;
      this._capturedPointerId = null;
      if (this.onRightMouseUp) this.onRightMouseUp();
    }
  }

  handleMouseMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    if (this.onMouseMove) {
      this.onMouseMove(e.clientX, e.clientY);
    }
  }

  handlePointerMove(e) {
    // Use the event itself for the latest position rather than coalesced events,
    // which may not always include the current frame's final coordinate.
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    if (this.onMouseMove) {
      this.onMouseMove(e.clientX, e.clientY);
    }
  }

  handlePointerDown(e) {
    if (!e.isPrimary || e.shiftKey) return;
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    const isPrimaryButton = e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen';
    if (!isPrimaryButton) return;
    if (!this._isCanvasTarget(e)) return;
    // Prevent duplicate down events (e.g. mousedown following pointerdown)
    if (this.isDown) return;

    this.isDown = true;
    if (this.element.setPointerCapture && e.pointerId != null) {
      try { this.element.setPointerCapture(e.pointerId); this._capturedPointerId = e.pointerId; } catch (err) {}
    }
    if (this.onMouseDown) this.onMouseDown(e);
  }

  handleMouseDown(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    if (e.shiftKey) return;
    if (e.button === 0) {
      // Left click: only trigger if target is canvas (not UI)
      if (this._isCanvasTarget(e)) {
        // Prevent duplicate down events when PointerEvents also fire
        if (this.isDown) return;
        this.isDown = true;
        if (this.onMouseDown) this.onMouseDown(e);
      }
    } else if (e.button === 2) {
      this.rightDown = true;
      if (this.onRightMouseDown) this.onRightMouseDown();
    }
  }

  handleMouseUp(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    if (e.button === 0 && this.isDown) {
      this.isDown = false;
      this._capturedPointerId = null;
      // Always notify game of mouse-up to prevent soft-lock in CHARGING state.
      // Game.js will ignore the release if it lands on interactive UI.
      if (this.onMouseUp) this.onMouseUp(e);
    } else if (e.button === 2 && this.rightDown) {
      this.rightDown = false;
      this._capturedPointerId = null;
      if (this.onRightMouseUp) this.onRightMouseUp();
    }
  }

  dispose() {
    this.element.removeEventListener('mousemove', this._handleMouseMove);
    this.element.removeEventListener('pointermove', this._handlePointerMove);
    this.element.removeEventListener('pointerdown', this._handlePointerDown);
    this.element.removeEventListener('pointerup', this._handleMouseUp);
    this.element.removeEventListener('pointercancel', this._handlePointerCancel);
    this.element.removeEventListener('pointerleave', this._handlePointerCancel);
    this.element.removeEventListener('lostpointercapture', this._handlePointerCancel);
    // Release active pointer capture to prevent browser keeping capture after disposal
    if (this.element.releasePointerCapture && this._capturedPointerId != null) {
      try { this.element.releasePointerCapture(this._capturedPointerId); } catch (e) {}
      this._capturedPointerId = null;
    }
    if (typeof window !== 'undefined' && 'onpointerrawupdate' in window) {
      this.element.removeEventListener('pointerrawupdate', this._handlePointerMove);
    }
    this.element.removeEventListener('mousedown', this._handleMouseDown);
    window.removeEventListener('mouseup', this._handleMouseUp);
    window.removeEventListener('blur', this._handleBlur);
    this.element.removeEventListener('mouseleave', this._handlePointerCancel);
    this.element.removeEventListener('contextmenu', this._handleContextMenu);
  }
}
