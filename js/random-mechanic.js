class RandomMechanic {
  constructor() {
    this.label = 'Random';
    this.rows = 12;
    this.columns = 12;
    this.heightGrid = [];
    this.streetCells = new Set();
    this.streetOrder = [];
    this.streetCursor = 0;
    this.streetTarget = 0;
    this.streetKinds = new Map();
  }

  setup(cityState) {
    this.generateHeightGrid();
    this.generateStreetBlueprint(cityState);
    window.randomHeightProvider = this;
  }

  generateHeightGrid() {
    const noiseOffset = Math.random() * 1000;

    this.heightGrid = Array.from({ length: this.rows }, (_, row) =>
      Array.from({ length: this.columns }, (_, column) => {
        const randomHeight = Math.random();
        const noiseHeight = noise(noiseOffset + column * 0.18, noiseOffset + row * 0.18);

        return constrain(randomHeight * 0.45 + noiseHeight * 0.55, 0, 1);
      }),
    );
  }

  generateStreetBlueprint(cityState) {
    this.streetCells.clear();
    this.streetOrder = [];
    this.streetKinds.clear();
    this.streetCursor = 0;

    if (!cityState) {
      this.streetTarget = 0;
      return;
    }

    const center = cityState.centerCell;
    const columns = cityState.gridColumns;
    const rows = cityState.gridRows;
    const blockSpacing = this.randomInt(4, 6);
    const secondarySpacing = this.randomInt(4, 7);

    this.addStreetLine(center.x, 0, center.x, rows - 1, 'main avenue');
    this.addStreetLine(0, center.y, columns - 1, center.y, 'main avenue');

    for (const x of this.getStreetOffsets(center.x, columns, blockSpacing)) {
      if (x === center.x || Math.random() < 0.18) continue;
      const margin = this.randomInt(0, 3);
      this.addStreetLine(x, margin, x, rows - 1 - margin, 'block street');
    }

    for (const y of this.getStreetOffsets(center.y, rows, secondarySpacing)) {
      if (y === center.y || Math.random() < 0.22) continue;
      const margin = this.randomInt(0, 4);
      this.addStreetLine(margin, y, columns - 1 - margin, y, 'block street');
    }

    this.addRandomSpurs(cityState, this.randomInt(8, 14));
    this.streetOrder = this.orderStreetsFromCenter(center);
    this.streetTarget = this.streetOrder.length;
  }

  getStreetOffsets(center, limit, spacing) {
    const offsets = [center];

    for (let position = center - spacing; position > 0; position -= this.randomInt(4, 6)) {
      offsets.push(position);
    }

    for (let position = center + spacing; position < limit - 1; position += this.randomInt(4, 6)) {
      offsets.push(position);
    }

    return offsets;
  }

  addRandomSpurs(cityState, count) {
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    for (let i = 0; i < count; i++) {
      const anchor = this.randomStreetCell();
      if (!anchor) return;

      const direction = directions[this.randomInt(0, directions.length - 1)];
      const length = this.randomInt(2, 5);
      let x = anchor.x;
      let y = anchor.y;

      for (let step = 0; step < length; step++) {
        x += direction.x;
        y += direction.y;
        if (!this.isInStreetBounds(x, y, cityState)) break;
        this.addStreetCell(x, y, 'side street');
      }
    }
  }

  randomStreetCell() {
    const cells = Array.from(this.streetCells);
    if (cells.length === 0) return null;
    const [x, y] = cells[this.randomInt(0, cells.length - 1)].split(',').map(Number);
    return { x, y };
  }

  addStreetLine(x1, y1, x2, y2, kind) {
    const steps = max(abs(x2 - x1), abs(y2 - y1));

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = round(lerp(x1, x2, t));
      const y = round(lerp(y1, y2, t));
      this.addStreetCell(x, y, kind);
    }
  }

  addStreetCell(x, y, kind) {
    const key = `${x},${y}`;
    this.streetCells.add(key);
    this.streetKinds.set(key, kind);
  }

  orderStreetsFromCenter(center) {
    return Array.from(this.streetCells)
      .map((key) => {
        const [x, y] = key.split(',').map(Number);
        return {
          x,
          y,
          key,
          kind: this.streetKinds.get(key) || 'block street',
          distance: abs(x - center.x) + abs(y - center.y),
        };
      })
      .sort((a, b) => a.distance + Math.random() * 1.6 - (b.distance + Math.random() * 1.6));
  }

  isInStreetBounds(x, y, cityState) {
    return x >= 0 && x < cityState.gridColumns && y >= 0 && y < cityState.gridRows;
  }

  randomInt(minValue, maxValue) {
    return floor(Math.random() * (maxValue - minValue + 1)) + minValue;
  }

  hasStreetCell(x, y) {
    return this.streetCells.has(`${x},${y}`);
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
