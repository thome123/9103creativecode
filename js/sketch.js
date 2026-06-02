// Overall city structure generated with help from ChatGPT/Codex.
// It coordinates the separate mechanic files required by the final brief.
let cityState;
let audioMechanic;
let timeMechanic;
let randomMechanic;
let inputMechanic;

const CITY_PALETTE = {
  paper: '#f5f7f1',
  road: '#dcefed',
  line: '#233a38',
  roof: '#79c7c8',
  roofDark: '#54aeb0',
  park: '#b9d9b4',
  parkDark: '#6fa878',
  front: '#f7faf5',
  side: '#e4ece8',
  shadow: '#9fb7b2',
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont('Georgia');
  initCityState();

  randomMechanic = new RandomMechanic();
  timeMechanic = new TimeMechanic();
  audioMechanic = new AudioMechanic();
  inputMechanic = new InputMechanic();

  randomMechanic.setup(cityState);
  timeMechanic.setup(cityState);
  audioMechanic.setup(cityState);
  inputMechanic.setup(cityState);
}

function draw() {
  timeMechanic.update(cityState);
  audioMechanic.update(cityState);
  processAudioBuildingRequests();
  inputMechanic.update(cityState);

  drawCityBackground();
  drawRoadGrid();
  drawGeneratedLots();
  drawParks();
  drawBuildings();
  inputMechanic.draw(cityState);
  audioMechanic.updateHud(cityState);
}

function initCityState() {
  cityState = {
    palette: CITY_PALETTE,
    gridColumns: 14,
    gridRows: 12,
    tileW: 76,
    tileH: 38,
    originX: width * 0.5,
    originY: 112,
    buildings: [],
    occupied: new Set(),
    roadTiles: new Set(),
    roadData: new Map(),
    parkTiles: new Set(),
    nextBuildingId: 1,
    maxBuildings: 82,
    selectedBuilding: null,
    hoveredBuilding: null,
    audioSnapshot: null,
    timeOfDay: 0,
    timeLabel: 'Morning',
    centerCell: { x: 7, y: 6 },
  };
  updateCityLayout();
}

function updateCityLayout() {
  cityState.tileW = constrain(width / 18, 52, 82);
  cityState.tileH = cityState.tileW * 0.5;
  cityState.originX = width * 0.5;
  cityState.originY = max(88, height * 0.08);
}

function processAudioBuildingRequests() {
  const requests = audioMechanic.consumeBuildRequests();
  for (const snapshot of requests) {
    if (cityState.buildings.length >= cityState.maxBuildings) return;

    extendRoadNetwork(snapshot);
    maybeGenerateParkTile(snapshot);

    const cell = pickNextBuildCell();
    if (!cell) return;

    const building = createBuildingFromMechanics(cell, snapshot, cityState.nextBuildingId);
    cityState.nextBuildingId += 1;
    cityState.buildings.push(building);
    cityState.occupied.add(cellKey(cell.x, cell.y));
  }
}

function createBuildingFromMechanics(cell, audioSnapshot, id) {
  if (typeof randomMechanic.createBuilding === 'function') {
    return randomMechanic.createBuilding(cell, audioSnapshot, id);
  }

  const heightUnit = getRandomHeightForCell(cell);
  const height = map(heightUnit, 0, 1, 28, 148);
  const stories = max(1, floor(height / 18));
  const type = pickBuildingType(audioSnapshot, height);

  return {
    id,
    gridX: cell.x,
    gridY: cell.y,
    height,
    stories,
    type,
    roofColour: pickRoofColour(audioSnapshot, type),
    seed: floor(heightUnit * 1000000),
    createdAtSeconds: audioSnapshot.seconds,
    createdAtLabel: audioSnapshot.timeLabel,
    audioLevel: audioSnapshot.level,
    bass: audioSnapshot.bass,
    mid: audioSnapshot.mid,
    treble: audioSnapshot.treble,
    dominant: audioSnapshot.dominant,
    bounds: null,
  };
}

function getRandomHeightForCell(cell) {
  if (typeof randomMechanic.getHeight === 'function') {
    const row = cell.y % randomMechanic.rows;
    const column = cell.x % randomMechanic.columns;
    const storedHeight = randomMechanic.getHeight(row, column);
    if (storedHeight !== null) return storedHeight;
  }

  return noise(cell.x * 0.22, cell.y * 0.22, cityState.nextBuildingId * 0.04);
}

function pickBuildingType(audioSnapshot, height) {
  if (audioSnapshot.dominant === 'bass' || height > 105) return 'civic block';
  if (audioSnapshot.dominant === 'treble') return 'light pavilion';
  if (height < 48) return 'low-rise';
  return 'mixed-use';
}

function pickRoofColour(audioSnapshot, type) {
  if (type === 'light pavilion') return '#92d6d4';
  if (type === 'civic block') return '#62b9bb';
  if (audioSnapshot.dominant === 'mid') return '#79c7c8';
  return '#86cccc';
}

function extendRoadNetwork(snapshot) {
  const steps = snapshot.strength > 0.9 ? 3 : snapshot.strength > 0.45 ? 2 : 1;

  for (let i = 0; i < steps; i++) {
    const roadCell = pickNextRoadCell(snapshot);
    if (!roadCell) return;
    const key = cellKey(roadCell.x, roadCell.y);
    cityState.roadTiles.add(key);
    cityState.roadData.set(key, {
      dominant: snapshot.dominant,
      strength: snapshot.strength,
      createdAtLabel: snapshot.timeLabel,
    });
  }
}

function pickNextRoadCell(snapshot) {
  if (cityState.roadTiles.size === 0) {
    return { ...cityState.centerCell };
  }

  const candidates = [];
  for (const key of cityState.roadTiles) {
    const roadCell = parseCellKey(key);
    for (const neighbour of getNeighbourCells(roadCell.x, roadCell.y)) {
      if (!isInBounds(neighbour.x, neighbour.y)) continue;
      if (cityState.roadTiles.has(cellKey(neighbour.x, neighbour.y))) continue;
      if (cityState.occupied.has(cellKey(neighbour.x, neighbour.y))) continue;
      if (cityState.parkTiles.has(cellKey(neighbour.x, neighbour.y))) continue;

      const centerDistance = dist(neighbour.x, neighbour.y, cityState.centerCell.x, cityState.centerCell.y);
      const directionBias = getAudioDirectionBias(neighbour.x - roadCell.x, neighbour.y - roadCell.y, snapshot);
      candidates.push({
        ...neighbour,
        score: centerDistance + directionBias + random(0, 1.1),
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.length ? candidates[0] : null;
}

function getAudioDirectionBias(dx, dy, snapshot) {
  if (snapshot.dominant === 'bass') {
    return abs(dy) > 0 ? -0.55 : 0.65;
  }
  if (snapshot.dominant === 'mid') {
    return abs(dx) > 0 ? -0.45 : 0.55;
  }
  if (snapshot.dominant === 'treble') {
    return random(-0.35, 0.35);
  }
  return 0;
}

function maybeGenerateParkTile(snapshot) {
  const chance = snapshot.dominant === 'treble' ? 0.24 : 0.08 + snapshot.strength * 0.06;
  if (random() > chance) return;

  const candidate = pickAdjacentLotToRoad();
  if (!candidate) return;
  cityState.parkTiles.add(cellKey(candidate.x, candidate.y));
}

function pickNextBuildCell() {
  const candidates = [];

  for (const key of cityState.roadTiles) {
    const roadCell = parseCellKey(key);
    for (const neighbour of getNeighbourCells(roadCell.x, roadCell.y)) {
      if (!isBuildableCell(neighbour.x, neighbour.y)) continue;
      const distance = dist(neighbour.x, neighbour.y, cityState.centerCell.x, cityState.centerCell.y);
      candidates.push({ ...neighbour, score: distance + random(0, 1.8) });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.length ? random(candidates.slice(0, min(6, candidates.length))) : null;
}

function pickAdjacentLotToRoad() {
  const candidates = [];
  for (const key of cityState.roadTiles) {
    const roadCell = parseCellKey(key);
    for (const neighbour of getNeighbourCells(roadCell.x, roadCell.y)) {
      if (!isBuildableCell(neighbour.x, neighbour.y)) continue;
      const distance = dist(neighbour.x, neighbour.y, cityState.centerCell.x, cityState.centerCell.y);
      candidates.push({ ...neighbour, score: distance + random(0, 2.4) });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates.length ? candidates[0] : null;
}

function isBuildableCell(x, y) {
  if (!isInBounds(x, y)) return false;
  if (cityState.occupied.has(cellKey(x, y))) return false;
  if (isRoadCell(x, y)) return false;
  if (isParkCell(x, y)) return false;
  return true;
}

function getNeighbourCells(x, y) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}

function isInBounds(x, y) {
  return x >= 0 && x < cityState.gridColumns && y >= 0 && y < cityState.gridRows;
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function parseCellKey(key) {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

function isRoadCell(x, y) {
  return cityState.roadTiles.has(cellKey(x, y));
}

function isParkCell(x, y) {
  return cityState.parkTiles.has(cellKey(x, y));
}

function isoToScreen(gridX, gridY, z = 0) {
  return createVector(
    cityState.originX + (gridX - gridY) * cityState.tileW * 0.5,
    cityState.originY + (gridX + gridY) * cityState.tileH * 0.5 - z
  );
}

function drawCityBackground() {
  const topColour = timeMechanic.getSkyColour(cityState, 0);
  const bottomColour = timeMechanic.getSkyColour(cityState, 1);
  for (let y = 0; y < height; y++) {
    const t = y / max(1, height - 1);
    stroke(lerpColor(topColour, bottomColour, t));
    line(0, y, width, y);
  }
}

function drawRoadGrid() {
  for (const key of cityState.roadTiles) {
    const road = parseCellKey(key);
    const roadMeta = cityState.roadData.get(key);
    drawIsoTile({
      x: road.x,
      y: road.y,
      fillColour: getRoadColour(roadMeta),
      strokeColour: cityState.palette.line,
      strokeAlpha: 92,
    });
  }
}

function getRoadColour(roadMeta) {
  const base = color(cityState.palette.road);
  if (!roadMeta) return base;
  if (roadMeta.dominant === 'bass') return lerpColor(base, color('#c8e1dc'), 0.38);
  if (roadMeta.dominant === 'mid') return lerpColor(base, color('#d6f0ee'), 0.32);
  if (roadMeta.dominant === 'treble') return lerpColor(base, color('#e8f6f2'), 0.42);
  return base;
}

function drawGeneratedLots() {
  for (const building of cityState.buildings) {
    drawIsoTile({
      x: building.gridX,
      y: building.gridY,
      fillColour: color(255, 255, 252, 218),
      strokeColour: cityState.palette.line,
      strokeAlpha: 48,
    });
  }
}

function drawIsoTile(tile) {
  const a = isoToScreen(tile.x, tile.y);
  const b = isoToScreen(tile.x + 1, tile.y);
  const c = isoToScreen(tile.x + 1, tile.y + 1);
  const d = isoToScreen(tile.x, tile.y + 1);

  fill(tile.fillColour);
  strokeWeight(1);
  const strokeC = color(tile.strokeColour || cityState.palette.line);
  stroke(red(strokeC), green(strokeC), blue(strokeC), tile.strokeAlpha ?? 90);
  quad(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
}

function drawParks() {
  for (const key of cityState.parkTiles) {
    const park = parseCellKey(key);
    drawIsoTile({ x: park.x, y: park.y, fillColour: color(cityState.palette.park), strokeColour: cityState.palette.line, strokeAlpha: 64 });

    for (let i = 0; i < 5; i++) {
      const gx = park.x + randomSeeded(i + park.x * 17 + park.y * 31, 0.15, 0.85);
      const gy = park.y + randomSeeded(i + park.x * 11 + park.y * 23, 0.15, 0.85);
      drawTree(gx, gy);
    }
  }
}

function randomSeeded(seed, minValue, maxValue) {
  const value = fract(sin(seed * 12.9898) * 43758.5453);
  return lerp(minValue, maxValue, value);
}

function fract(value) {
  return value - floor(value);
}

function drawTree(gridX, gridY) {
  const base = isoToScreen(gridX, gridY, 0);
  stroke(cityState.palette.line);
  strokeWeight(0.8);
  fill(cityState.palette.parkDark);
  ellipse(base.x, base.y - 7, 9, 17);
  line(base.x, base.y - 1, base.x, base.y + 5);
}

function drawBuildings() {
  const sortedBuildings = [...cityState.buildings].sort((a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY));
  for (const building of sortedBuildings) {
    drawIsoBuilding(building);
  }
}

function drawIsoBuilding(building) {
  const h = building.height;
  const gx = building.gridX;
  const gy = building.gridY;
  const a0 = isoToScreen(gx, gy, 0);
  const b0 = isoToScreen(gx + 1, gy, 0);
  const c0 = isoToScreen(gx + 1, gy + 1, 0);
  const d0 = isoToScreen(gx, gy + 1, 0);
  const a = isoToScreen(gx, gy, h);
  const b = isoToScreen(gx + 1, gy, h);
  const c = isoToScreen(gx + 1, gy + 1, h);
  const d = isoToScreen(gx, gy + 1, h);
  const isHovered = cityState.hoveredBuilding && cityState.hoveredBuilding.id === building.id;
  const isSelected = cityState.selectedBuilding && cityState.selectedBuilding.id === building.id;
  const lineWeight = isHovered || isSelected ? 2.4 : 1.25;
  const lineColour = isHovered || isSelected ? color('#178f92') : color(cityState.palette.line);

  building.bounds = {
    minX: min(a.x, b.x, c.x, d.x, a0.x, b0.x, c0.x, d0.x),
    maxX: max(a.x, b.x, c.x, d.x, a0.x, b0.x, c0.x, d0.x),
    minY: min(a.y, b.y, c.y, d.y, a0.y, b0.y, c0.y, d0.y),
    maxY: max(a.y, b.y, c.y, d.y, a0.y, b0.y, c0.y, d0.y),
  };

  stroke(lineColour);
  strokeWeight(lineWeight);
  fill(timeMechanic.tintBuildingColour(cityState.palette.side, cityState, 0.92));
  quad(b.x, b.y, c.x, c.y, c0.x, c0.y, b0.x, b0.y);
  fill(timeMechanic.tintBuildingColour(cityState.palette.front, cityState, 1));
  quad(c.x, c.y, d.x, d.y, d0.x, d0.y, c0.x, c0.y);
  fill(timeMechanic.tintBuildingColour(building.roofColour, cityState, 1.04));
  quad(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);

  drawWindows(building, b, c, c0, b0);
  drawWindows(building, c, d, d0, c0);
  drawRoofDetails(building, a, b, c, d);
}

function drawWindows(building, topA, topB, bottomB, bottomA) {
  const floors = max(1, floor(building.stories));
  stroke(35, 58, 56, 100);
  strokeWeight(0.7);
  for (let i = 1; i <= floors; i++) {
    const t = i / (floors + 1);
    const left = p5.Vector.lerp(topA, bottomA, t);
    const right = p5.Vector.lerp(topB, bottomB, t);
    const insetA = p5.Vector.lerp(left, right, 0.2);
    const insetB = p5.Vector.lerp(left, right, 0.8);
    line(insetA.x, insetA.y, insetB.x, insetB.y);
  }
}

function drawRoofDetails(building, a, b, c, d) {
  stroke(35, 58, 56, 120);
  strokeWeight(0.8);
  const p1 = p5.Vector.lerp(a, c, 0.35);
  const p2 = p5.Vector.lerp(a, c, 0.65);
  const q1 = p5.Vector.lerp(b, d, 0.35);
  const q2 = p5.Vector.lerp(b, d, 0.65);
  line(p1.x, p1.y, q1.x, q1.y);
  if (building.type !== 'low-rise') {
    line(p2.x, p2.y, q2.x, q2.y);
  }
}

function mousePressed() {
  inputMechanic.mousePressed(cityState);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateCityLayout();
  inputMechanic.windowResized(cityState);
}
