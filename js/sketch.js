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
  window.cityState = cityState;
  window.audioMechanic = audioMechanic;
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
    gridColumns: 28,
    gridRows: 22,
    tileW: 76,
    tileH: 38,
    originX: width * 0.5,
    originY: 112,
    buildings: [],
    occupied: new Set(),
    roadTiles: new Set(),
    roadData: new Map(),
    roadFrontiers: [],
    maxRoadFrontiers: 12,
    blockSize: 5,
    parkTiles: new Set(),
    nextBuildingId: 1,
    maxBuildings: 180,
    selectedBuilding: null,
    hoveredBuilding: null,
    audioSnapshot: null,
    growthStalls: 0,
    timeOfDay: 0,
    timeLabel: 'Morning',
    centerCell: { x: 14, y: 11 },
  };
  updateCityLayout();
}

function updateCityLayout() {
  cityState.tileW = constrain(width / 36, 22, 44);
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

    const cell = pickNextBuildCell(snapshot);
    if (!cell) return;

    const building = createBuildingFromMechanics(cell, snapshot, cityState.nextBuildingId);
    cityState.nextBuildingId += 1;
    cityState.buildings.push(building);
    markBuildingFootprint(building);
  }
}

function createBuildingFromMechanics(cell, audioSnapshot, id) {
  if (typeof randomMechanic.createBuilding === 'function') {
    return randomMechanic.createBuilding(cell, audioSnapshot, id);
  }

  const heightUnit = getRandomHeightForCell(cell);
  const height = map(heightUnit, 0, 1, 16, 76);
  const stories = max(1, floor(height / 12));
  const type = pickBuildingType(audioSnapshot, height);

  return {
    id,
    gridX: cell.x,
    gridY: cell.y,
    width: cell.width || 1,
    depth: cell.depth || 1,
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
  if (audioSnapshot.dominant === 'bass' || height > 58) return 'civic block';
  if (audioSnapshot.dominant === 'treble') return 'light pavilion';
  if (height < 28) return 'low-rise';
  return 'mixed-use';
}

function pickRoofColour(audioSnapshot, type) {
  if (type === 'light pavilion') return '#92d6d4';
  if (type === 'civic block') return '#62b9bb';
  if (audioSnapshot.dominant === 'mid') return '#79c7c8';
  return '#86cccc';
}

function extendRoadNetwork(snapshot) {
  if (cityState.roadTiles.size === 0) {
    initializeRoadNetwork(snapshot);
  }

  const roadCapacityTarget = 8 + cityState.buildings.length * 0.44;
  const needsMoreAccess = cityState.roadTiles.size < roadCapacityTarget || pickNextBuildCell(snapshot) === null;
  if (!needsMoreAccess && random() > snapshot.strength * 0.14) return;

  const shouldBranch = snapshot.strength > 1.12 && cityState.roadTiles.size % 9 === 0;
  const steps = shouldBranch ? 2 : 1;

  for (let i = 0; i < steps; i++) {
    const didGrow = advanceRoadNetwork(snapshot);
    if (!didGrow) {
      cityState.growthStalls += 1;
      return;
    }
  }
}

function initializeRoadNetwork(snapshot) {
  addRoadTile(cityState.centerCell.x, cityState.centerCell.y, snapshot, 'central plaza');
  cityState.roadFrontiers = [
    createRoadFrontier(cityState.centerCell.x, cityState.centerCell.y, 1, 0, 'main avenue'),
    createRoadFrontier(cityState.centerCell.x, cityState.centerCell.y, -1, 0, 'main avenue'),
    createRoadFrontier(cityState.centerCell.x, cityState.centerCell.y, 0, 1, 'main avenue'),
    createRoadFrontier(cityState.centerCell.x, cityState.centerCell.y, 0, -1, 'main avenue'),
  ];
}

function createRoadFrontier(x, y, dx, dy, kind, targetLength = null) {
  return {
    x,
    y,
    dx,
    dy,
    kind,
    targetLength,
    age: 0,
    active: true,
  };
}

function advanceRoadNetwork(snapshot) {
  let attempts = 0;
  while (attempts < 8) {
    const frontier = pickRoadFrontier(snapshot) || createFallbackFrontier(snapshot);
    if (!frontier) return false;

    if (advanceRoadFrontier(frontier, snapshot)) {
      return true;
    }
    attempts += 1;
  }
  return false;
}

function pickRoadFrontier(snapshot) {
  const activeFrontiers = cityState.roadFrontiers.filter((frontier) => frontier.active);
  if (activeFrontiers.length === 0) return null;

  const preferredFrontiers = activeFrontiers.filter((frontier) => {
    if (snapshot.dominant === 'bass') return abs(frontier.dy) > 0;
    if (snapshot.dominant === 'mid') return abs(frontier.dx) > 0;
    if (snapshot.dominant === 'treble') return frontier.kind === 'side street';
    return true;
  });
  const candidates = preferredFrontiers.length ? preferredFrontiers : activeFrontiers;

  candidates.sort((a, b) => {
    const aMainBias = a.kind === 'main avenue' ? -0.35 : 0;
    const bMainBias = b.kind === 'main avenue' ? -0.35 : 0;
    return a.age + aMainBias + random(0, 1.2) - (b.age + bMainBias + random(0, 1.2));
  });
  return candidates[0];
}

function advanceRoadFrontier(frontier, snapshot) {
  const nextX = frontier.x + frontier.dx;
  const nextY = frontier.y + frontier.dy;

  if (!isAvailableRoadCell(nextX, nextY)) {
    frontier.active = false;
    return false;
  }

  addRoadTile(nextX, nextY, snapshot, frontier.kind);
  frontier.x = nextX;
  frontier.y = nextY;
  frontier.age += 1;
  maybeCreateRoadBranch(frontier, snapshot);
  if (frontier.targetLength && frontier.age >= frontier.targetLength) {
    frontier.active = false;
  }
  return true;
}

function addRoadTile(x, y, snapshot, kind) {
  const key = cellKey(x, y);
  cityState.roadTiles.add(key);
  cityState.roadData.set(key, {
    dominant: snapshot.dominant,
    strength: snapshot.strength,
    createdAtLabel: snapshot.timeLabel,
    kind,
  });
}

function maybeCreateRoadBranch(frontier, snapshot) {
  const activeCount = cityState.roadFrontiers.filter((item) => item.active).length;
  if (activeCount >= cityState.maxRoadFrontiers) return;

  const shouldCreateBranch =
    (frontier.kind === 'main avenue' && frontier.age >= cityState.blockSize && frontier.age % cityState.blockSize === 0) ||
    (snapshot.dominant === 'treble' && random() < 0.12);
  if (!shouldCreateBranch) return;

  const branchDirections = [
    { dx: frontier.dy, dy: -frontier.dx },
    { dx: -frontier.dy, dy: frontier.dx },
  ].filter((direction) => isAvailableRoadCell(frontier.x + direction.dx, frontier.y + direction.dy));

  if (branchDirections.length === 0) return;
  const direction = random(branchDirections);
  cityState.roadFrontiers.push(
    createRoadFrontier(frontier.x, frontier.y, direction.dx, direction.dy, 'side street', getSideStreetTargetLength(snapshot))
  );
}

function getSideStreetTargetLength(snapshot) {
  const audioStretch = snapshot.dominant === 'bass' ? 1 : 0;
  return floor(random(3, cityState.blockSize + 2 + audioStretch));
}

function createFallbackFrontier(snapshot) {
  const candidates = [];

  for (const key of cityState.roadTiles) {
    const road = parseCellKey(key);
    for (const direction of getPreferredRoadDirections(snapshot)) {
      const nextX = road.x + direction.dx;
      const nextY = road.y + direction.dy;
      if (!isAvailableRoadCell(nextX, nextY)) continue;

      candidates.push({
        x: road.x,
        y: road.y,
        dx: direction.dx,
        dy: direction.dy,
        score: dist(road.x, road.y, cityState.centerCell.x, cityState.centerCell.y) + random(0, 1.6),
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  if (candidates.length === 0) return null;

  const candidate = candidates[0];
  const frontier = createRoadFrontier(candidate.x, candidate.y, candidate.dx, candidate.dy, 'side street', getSideStreetTargetLength(snapshot));
  cityState.roadFrontiers.push(frontier);
  return frontier;
}

function getPreferredRoadDirections(snapshot) {
  if (snapshot.dominant === 'bass') {
    return [
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
    ];
  }
  if (snapshot.dominant === 'mid') {
    return [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
  }
  return shuffle([
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ]);
}

function isAvailableRoadCell(x, y) {
  if (!isInBounds(x, y)) return false;
  const key = cellKey(x, y);
  if (cityState.roadTiles.has(key)) return false;
  if (cityState.occupied.has(key)) return false;
  if (cityState.parkTiles.has(key)) return false;
  return true;
}

function maybeGenerateParkTile(snapshot) {
  const chance = snapshot.dominant === 'treble' ? 0.16 : 0.04 + snapshot.strength * 0.03;
  if (random() > chance) return;

  const candidate = pickAdjacentLotToRoad();
  if (!candidate) return;
  cityState.parkTiles.add(cellKey(candidate.x, candidate.y));
}

function pickNextBuildCell(snapshot) {
  const candidates = [];

  for (const key of cityState.roadTiles) {
    const roadCell = parseCellKey(key);
    for (const neighbour of getNeighbourCells(roadCell.x, roadCell.y)) {
      if (!isBuildableCell(neighbour.x, neighbour.y)) continue;

      for (const footprint of getFootprintOptions(snapshot)) {
        const lot = orientFootprintAwayFromRoad(neighbour, roadCell, footprint);
        if (!lot || !isFootprintBuildable(lot.x, lot.y, lot.width, lot.depth)) continue;

        const centreX = lot.x + lot.width * 0.5;
        const centreY = lot.y + lot.depth * 0.5;
        const distance = dist(centreX, centreY, cityState.centerCell.x, cityState.centerCell.y);
        const roadEdges = countFootprintRoadEdges(lot.x, lot.y, lot.width, lot.depth);
        const occupiedEdges = countFootprintOccupiedEdges(lot.x, lot.y, lot.width, lot.depth);
        const area = lot.width * lot.depth;
        candidates.push({
          ...lot,
          score: distance - roadEdges * 0.8 - area * 0.16 + occupiedEdges * 0.38 + random(0, 1.5),
        });
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.length ? random(candidates.slice(0, min(6, candidates.length))) : null;
}

function getFootprintOptions(snapshot) {
  if (snapshot.dominant === 'bass') {
    return [
      { width: 2, depth: 2 },
      { width: 3, depth: 1 },
      { width: 1, depth: 3 },
      { width: 2, depth: 1 },
      { width: 1, depth: 2 },
      { width: 1, depth: 1 },
    ];
  }

  if (snapshot.dominant === 'mid') {
    return [
      { width: 2, depth: 1 },
      { width: 1, depth: 2 },
      { width: 2, depth: 2 },
      { width: 1, depth: 1 },
    ];
  }

  return [
    { width: 1, depth: 1 },
    { width: 1, depth: 2 },
    { width: 2, depth: 1 },
  ];
}

function orientFootprintAwayFromRoad(neighbour, roadCell, footprint) {
  const awayX = neighbour.x - roadCell.x;
  const awayY = neighbour.y - roadCell.y;
  let x = neighbour.x;
  let y = neighbour.y;

  if (awayX > 0) {
    x = neighbour.x;
    y = neighbour.y - floor((footprint.depth - 1) * 0.5);
  } else if (awayX < 0) {
    x = neighbour.x - footprint.width + 1;
    y = neighbour.y - floor((footprint.depth - 1) * 0.5);
  } else if (awayY > 0) {
    x = neighbour.x - floor((footprint.width - 1) * 0.5);
    y = neighbour.y;
  } else if (awayY < 0) {
    x = neighbour.x - floor((footprint.width - 1) * 0.5);
    y = neighbour.y - footprint.depth + 1;
  } else {
    return null;
  }

  return {
    x,
    y,
    width: footprint.width,
    depth: footprint.depth,
  };
}

function isFootprintBuildable(x, y, width, depth) {
  for (let yy = y; yy < y + depth; yy++) {
    for (let xx = x; xx < x + width; xx++) {
      if (!isBuildableCell(xx, yy)) return false;
    }
  }
  return true;
}

function markBuildingFootprint(building) {
  for (let y = building.gridY; y < building.gridY + building.depth; y++) {
    for (let x = building.gridX; x < building.gridX + building.width; x++) {
      cityState.occupied.add(cellKey(x, y));
    }
  }
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
  if (isProtectedRoadGrowthCell(x, y)) return false;
  if (isPlannedStreetCorridor(x, y)) return false;
  return true;
}

function isProtectedRoadGrowthCell(x, y) {
  for (const frontier of cityState.roadFrontiers) {
    if (!frontier.active) continue;
    const reservedSteps = frontier.kind === 'main avenue' ? 3 : 1;
    for (let step = 1; step <= reservedSteps; step++) {
      if (frontier.x + frontier.dx * step === x && frontier.y + frontier.dy * step === y) return true;
    }
  }
  return false;
}

function isPlannedStreetCorridor(x, y) {
  const fromCenterX = abs(x - cityState.centerCell.x);
  const fromCenterY = abs(y - cityState.centerCell.y);
  return fromCenterX % cityState.blockSize === 0 || fromCenterY % cityState.blockSize === 0;
}

function countFootprintRoadEdges(x, y, width, depth) {
  let total = 0;
  for (const cell of getFootprintEdgeNeighbours(x, y, width, depth)) {
    if (isRoadCell(cell.x, cell.y)) total += 1;
  }
  return total;
}

function countFootprintOccupiedEdges(x, y, width, depth) {
  let total = 0;
  for (const cell of getFootprintEdgeNeighbours(x, y, width, depth)) {
    if (cityState.occupied.has(cellKey(cell.x, cell.y))) total += 1;
  }
  return total;
}

function getFootprintEdgeNeighbours(x, y, width, depth) {
  const neighbours = [];

  for (let xx = x; xx < x + width; xx++) {
    neighbours.push({ x: xx, y: y - 1 });
    neighbours.push({ x: xx, y: y + depth });
  }

  for (let yy = y; yy < y + depth; yy++) {
    neighbours.push({ x: x - 1, y: yy });
    neighbours.push({ x: x + width, y: yy });
  }

  return neighbours.filter((cell) => isInBounds(cell.x, cell.y));
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
      width: building.width,
      depth: building.depth,
      fillColour: color(255, 255, 252, 218),
      strokeColour: cityState.palette.line,
      strokeAlpha: 48,
    });
  }
}

function drawIsoTile(tile) {
  const a = isoToScreen(tile.x, tile.y);
  const b = isoToScreen(tile.x + (tile.width || 1), tile.y);
  const c = isoToScreen(tile.x + (tile.width || 1), tile.y + (tile.depth || 1));
  const d = isoToScreen(tile.x, tile.y + (tile.depth || 1));

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
  const sortedBuildings = [...cityState.buildings].sort(
    (a, b) => (a.gridX + a.gridY + a.width + a.depth) - (b.gridX + b.gridY + b.width + b.depth)
  );
  for (const building of sortedBuildings) {
    drawIsoBuilding(building);
  }
}

function drawIsoBuilding(building) {
  const h = building.height;
  const gx = building.gridX;
  const gy = building.gridY;
  const bw = building.width || 1;
  const bd = building.depth || 1;
  const a0 = isoToScreen(gx, gy, 0);
  const b0 = isoToScreen(gx + bw, gy, 0);
  const c0 = isoToScreen(gx + bw, gy + bd, 0);
  const d0 = isoToScreen(gx, gy + bd, 0);
  const a = isoToScreen(gx, gy, h);
  const b = isoToScreen(gx + bw, gy, h);
  const c = isoToScreen(gx + bw, gy + bd, h);
  const d = isoToScreen(gx, gy + bd, h);
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
