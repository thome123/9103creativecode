class InputMechanic {
  constructor() {
    this.label = 'Input';
  }

  setup() {}

  draw() {
    const cursorSize = mouseIsPressed ? 56 : 34;

    push();
    noFill();
    stroke(255, 245, 198, 120);
    strokeWeight(2);
    circle(mouseX, mouseY, cursorSize);
    pop();
  }

  windowResized() {}
}
