class RandomMechanic {
  constructor() {
    this.label = 'Random';
    this.points = [];
  }

  setup() {
    randomSeed(9103);
    this.points = Array.from({ length: 80 }, () => ({
      x: random(width),
      y: random(height),
      size: random(2, 7),
      alpha: random(30, 110),
    }));
  }

  draw() {
    push();
    noStroke();
    for (const point of this.points) {
      fill(255, 238, 170, point.alpha);
      circle(point.x, point.y, point.size);
    }
    pop();
  }

  windowResized() {
    this.setup();
  }
}
