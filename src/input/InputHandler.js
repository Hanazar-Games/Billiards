export class InputHandler {
  constructor(element) {
    this.element = element;
    this.mouseX = 0;
    this.mouseY = 0;
    this.isDown = false;
    this.rightDown = false;

    this.onMouseMove = null;
    this.onMouseDown = null;
    this.onMouseUp = null;
    this.onRightMouseDown = null;
    this.onRightMouseUp = null;

    this._handleMouseMove = this.handleMouseMove.bind(this);
    this._handleMouseDown = this.handleMouseDown.bind(this);
    this._handleMouseUp = this.handleMouseUp.bind(this);
    this._handleContextMenu = (e) => e.preventDefault();

    element.addEventListener('mousemove', this._handleMouseMove);
    element.addEventListener('mousedown', this._handleMouseDown);
    window.addEventListener('mouseup', this._handleMouseUp);
    element.addEventListener('contextmenu', this._handleContextMenu);
  }

  handleMouseMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    if (this.onMouseMove) {
      this.onMouseMove(e.clientX, e.clientY);
    }
  }

  handleMouseDown(e) {
    if (e.button === 0) {
      // Left click: only trigger if target is canvas (not UI)
      if (e.target.tagName === 'CANVAS') {
        this.isDown = true;
        if (this.onMouseDown) this.onMouseDown();
      }
    } else if (e.button === 2) {
      this.rightDown = true;
      if (this.onRightMouseDown) this.onRightMouseDown();
    }
  }

  handleMouseUp(e) {
    if (e.button === 0 && this.isDown) {
      this.isDown = false;
      if (this.onMouseUp) this.onMouseUp();
    } else if (e.button === 2 && this.rightDown) {
      this.rightDown = false;
      if (this.onRightMouseUp) this.onRightMouseUp();
    }
  }

  dispose() {
    this.element.removeEventListener('mousemove', this._handleMouseMove);
    this.element.removeEventListener('mousedown', this._handleMouseDown);
    window.removeEventListener('mouseup', this._handleMouseUp);
    this.element.removeEventListener('contextmenu', this._handleContextMenu);
  }
}
