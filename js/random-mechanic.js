class RandomMechanic {
  constructor() {
    this.label = 'Random';
    this.rows = 12;
    this.columns = 12;
    this.heightGrid = [];
  }

  setup() {
    this.heightGrid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.columns }, () => Math.random()),
    );
  }

  draw() {}

  windowResized() {}
}
