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

    window.randomHeightProvider = this;
  }

  // The city rendering mechanic reads the generated heights and draws the buildings.
  draw() {}

  // Keep building heights stable while the renderer adjusts to the new canvas size.
  windowResized() {}

  getHeight(row, column) {
    if (row < 0 || row >= this.rows || column < 0 || column >= this.columns) {
      return null;
    }

    return this.heightGrid[row][column];
  }

  getHeightGrid() {
    return this.heightGrid.map((row) => [...row]);
  }
}
