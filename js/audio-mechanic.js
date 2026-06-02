class AudioMechanic {
  constructor() {
    this.label = 'Audio';
    this.level = 0;
  }

  setup() {
    // Placeholder value until the audio upload/player is added.
    this.level = 0;
  }

  draw() {
    const pulse = 0.5 + 0.5 * sin(frameCount * 0.04);
    this.level = lerp(this.level, pulse, 0.04);

    push();
    blendMode(ADD);
    noStroke();
    fill(255, 196, 83, 80);
    circle(width * 0.5, height * 0.5, min(width, height) * (0.16 + this.level * 0.08));
    pop();
  }

  windowResized() {}
}
