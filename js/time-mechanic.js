class TimeMechanic {
  constructor() {
    this.label = 'Time';
  }

  setup() {}

  draw() {
    const sweep = (frameCount * 0.004) % 1;
    const x = width * sweep;

    push();
    stroke(108, 171, 255, 80);
    strokeWeight(2);
    line(x, 0, x, height);
    pop();
  }

  windowResized() {}
}
