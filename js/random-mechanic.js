class RandomMechanic {
  constructor() {
    this.label = 'Random';
    this.rows = 12;
    this.columns = 12;
    this.heightGrid = [];
  }

  setup() {
    const noiseOffset = Math.random() * 1000;

    this.heightGrid = Array.from({ length: this.rows }, (_, row) =>
      Array.from({ length: this.columns }, (_, column) => {
        const randomHeight = Math.random();
        const noiseHeight = noise(noiseOffset + column * 0.18, noiseOffset + row * 0.18);

        return constrain(randomHeight * 0.45 + noiseHeight * 0.55, 0, 1);
      }),
    );
  }

  draw() {}

  windowResized() {}
}
