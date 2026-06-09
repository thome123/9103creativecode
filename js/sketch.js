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
  roofWarm: '#d8bd6a',
  roofCool: '#7fb8d6',
  park: '#b9d9b4',
  parkDark: '#6fa878',
  light: '#f4d980',
  front: '#f7faf5',
  side: '#e4ece8',
  shadow: '#9fb7b2',
};

const BUILDING_HOVER_LIFT = 18;
const BUILDING_HOVER_FLOAT = 3;
const BUILDING_HOVER_SPEED = 0.14;
const BUILDING_VIEW_MARGIN = 12;
const BUILDING_SAFE_HEIGHT = 96;

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
  audioMechanic.setup(cityState, resetCityForNewAudio);
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
  drawAudioPulseRings();
  drawRoadGrid();
  drawGeneratedLots();
  drawParks();
  drawBuildings();
  drawTimeIndicator();
  inputMechanic.draw(cityState);
  audioMechanic.updateHud(cityState);
}

function initCityState() {
  cityState = createDefaultCityState();
  updateCityLayout();
  cityState.plannedStreetTarget = countPlannedStreetCells();
}

function resetCityForNewAudio() {
  Object.assign(cityState, createDefaultCityState());
  updateCityLayout();
  cityState.plannedStreetTarget = countPlannedStreetCells();

  if (randomMechanic) {
    randomMechanic.setup(cityState);
  }

  if (inputMechanic) {
    inputMechanic.windowResized(cityState);
    inputMechanic.renderInfo(null);
  }

  window.cityState = cityState;
}

function createDefaultCityState() {
  return {
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
    generationPhase: 'roads',
    plannedStreetTarget: 0,
    developmentLots: [],
    parkTiles: new Set(),
    pulseRings: [],
    nextBuildingId: 1,
    maxBuildings: 105, // Fallback only; audio duration updates this target after a track loads.
    selectedBuilding: null,
    hoveredBuilding: null,
    audioSnapshot: null,
    lotsExhausted: false,
    growthStalls: 0,
    timeOfDay: 0,
    timeLabel: 'Morning',
    centerCell: { x: 14, y: 11 },
  };
}

function updateCityLayout() {
  cityState.tileW = constrain(width / 36, 22, 44);
  cityState.tileH = cityState.tileW * 0.5;
  const viewBounds = getCityViewBounds();
  const viewCenterX = (viewBounds.left + viewBounds.right) * 0.5;
  const viewCenterY = (viewBounds.top + viewBounds.bottom) * 0.5;
  cityState.originX = viewCenterX - (cityState.gridColumns - cityState.gridRows) * cityState.tileW * 0.25;
  cityState.originY = max(88, viewCenterY - (cityState.gridColumns + cityState.gridRows) * cityState.tileH * 0.25);
}

function getCityViewBounds() {
  if (width <= 760) {
    return {
      left: 12,
      right: width - 12,
      top: 12,
      bottom: height - 12,
    };
  }

  if (width <= 1120) {
    return {
      left: 22,
      right: width - 22,
      top: 230,
      bottom: max(438, height - 330),
    };
  }

  return {
    left: 382,
    right: width - 342,
    top: 22,
    bottom: height - 22,
  };
}

function processAudioBuildingRequests() {
  const requests = audioMechanic.consumeBuildRequests();
  for (const snapshot of requests) {
    if (cityState.generationPhase === 'roads') {
      generateStreetPlan(snapshot);
      continue;
    }

    if (cityState.buildings.length >= cityState.maxBuildings) return;

    const cell = pickNextBuildCell(snapshot);
    if (!cell) {
      cityState.lotsExhausted = true;
      return;
    }

    cityState.lotsExhausted = false;
    const remainingBuildings = cityState.maxBuildings - cityState.buildings.length;
    if (remainingBuildings > 6 && random() >= 0.8) {
      cityState.parkTiles.add(cellKey(cell.x, cell.y));
      continue;
    }

    const building = createBuildingFromMechanics(cell, snapshot, cityState.nextBuildingId);
    if (!isBuildingDrawable(building)) {
      cityState.lotsExhausted = true;
      return;
    }

    initializeBuildingHoverState(building);
    building.createdFrame = frameCount;
    cityState.nextBuildingId += 1;
    cityState.buildings.push(building);
    markBuildingFootprint(building);
    addPulseRingForBuilding(building, snapshot);
  }
}

function addPulseRingForBuilding(building, snapshot) {
  cityState.pulseRings.push({
    gridX: building.gridX + (building.width || 1) * 0.5,
    gridY: building.gridY + (building.depth || 1) * 0.5,
    strength: snapshot.strength,
    dominant: snapshot.dominant,
    startedAt: frameCount,
  });

  cityState.pulseRings = cityState.pulseRings.filter((ring) => frameCount - ring.startedAt < 90).slice(-18);
}

function initializeBuildingHoverState(building) {
  // This code was generated with the help of ChatGPT and initializes per-building hover lift animation state.
  building.hoverLift = building.hoverLift || 0;
  building.hoverLiftTarget = building.hoverLiftTarget || 0;
  building.hoverFloatPhase = building.hoverFloatPhase ?? randomSeeded((building.seed || building.id) + building.id * 19, 0, TWO_PI);
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
    frontColour: pickFacadeColour(audioSnapshot, type, heightUnit, 'front'),
    sideColour: pickFacadeColour(audioSnapshot, type, heightUnit, 'side'),
    facadeStyle: pickFacadeStyle(audioSnapshot, type, cell),
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
  if (audioSnapshot.dominant === 'bass') return '#7fb8d6';
  if (audioSnapshot.dominant === 'treble') return '#d8bd6a';
  if (type === 'light pavilion') return '#92d6d4';
  if (type === 'civic block') return '#62b9bb';
  if (audioSnapshot.dominant === 'mid') return '#79c7c8';
  return '#86cccc';
}

function pickFacadeColour(audioSnapshot, type, heightUnit, face) {
  const frontOptions = ['#fbfcf7', '#f6faf4', '#eef6f0', '#faf3ea'];
  const sideOptions = ['#e7efea', '#dfe9e5', '#eaf0e8', '#eadfd4'];
  const options = face === 'side' ? sideOptions : frontOptions;
  const index = floor((heightUnit * 10 + audioSnapshot.seconds * 0.07) % options.length);

  if (type === 'civic block') return face === 'side' ? '#d9e5e1' : '#f2f7f2';
  if (type === 'light pavilion') return face === 'side' ? '#dceeea' : '#f7fbf7';
  return options[index];
}

function pickFacadeStyle(audioSnapshot, type, cell) {
  if (type === 'civic block') return 'banded';
  if (audioSnapshot.dominant === 'treble') return 'fine-grid';
  if ((cell.width || 1) + (cell.depth || 1) >= 4) return 'block';
  return 'quiet';
}

function generateStreetPlan(snapshot) {
  if (randomMechanic && typeof randomMechanic.generateStreetPlan === 'function') {
    randomMechanic.generateStreetPlan(cityState, snapshot);
  }
}

function findNearestRoadCell(x, y, maxDistance = Infinity) {
  let closest = null;

  for (const key of cityState.roadTiles) {
    const road = parseCellKey(key);
    const distance = abs(x - road.x) + abs(y - road.y);
    if (distance > maxDistance) continue;
    if (!closest || distance < closest.distance) {
      closest = { x: road.x, y: road.y, distance };
    }
  }

  return closest;
}

function maybeGenerateParkTile(snapshot) {
  const chance = snapshot.dominant === 'treble' ? 0.16 : 0.04 + snapshot.strength * 0.03;
  if (random() > chance) return;

  const candidate = pickAdjacentLotToRoad();
  if (!candidate) return;
  cityState.parkTiles.add(cellKey(candidate.x, candidate.y));
}

// AI-assisted: scores legal building lots by road access, spacing, footprint size, block density, and centre distance.
function pickNextBuildCell(snapshot) {
  const candidates = [];

  for (const anchor of getCandidateDevelopmentAnchors()) {
    if (!isBuildableCell(anchor.x, anchor.y)) continue;
    const roadCell = anchor.roadCell || findNearestRoadCell(anchor.x, anchor.y, getBuildRoadSearchDistance());
    if (!roadCell) continue;

    for (const footprint of getFootprintOptions(snapshot)) {
      const lot = orientFootprintAwayFromRoad(anchor, roadCell, footprint);
      if (!lot || !isFootprintBuildable(lot.x, lot.y, lot.width, lot.depth)) continue;
      if (!isFootprintDrawable(lot.x, lot.y, lot.width, lot.depth, BUILDING_SAFE_HEIGHT)) continue;

      const centreX = lot.x + lot.width * 0.5;
      const centreY = lot.y + lot.depth * 0.5;
      const distance = dist(centreX, centreY, cityState.centerCell.x, cityState.centerCell.y);
      const roadEdges = countFootprintRoadEdges(lot.x, lot.y, lot.width, lot.depth);
      const occupiedEdges = countFootprintOccupiedEdges(lot.x, lot.y, lot.width, lot.depth);
      const blockLoad = countBuildingsInBlock(lot.x, lot.y);
      const area = lot.width * lot.depth;
      if (area > 1 && occupiedEdges > 0 && !shouldRelaxBuildSpacing()) continue;
      if (occupiedEdges > getNeighbourPressureLimit(snapshot)) continue;
      if (blockLoad >= getBlockBuildingLimit(snapshot)) continue;

      candidates.push({
        ...lot,
        score: distance - roadEdges * 0.42 - area * 0.08 + occupiedEdges * 0.84 + blockLoad * 0.58 + getSetbackScore(anchor) + random(0, 1.7),
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.length ? random(candidates.slice(0, min(6, candidates.length))) : null;
}

function getCandidateDevelopmentAnchors() {
  if (cityState.developmentLots.length > 0) {
    if (!shouldRelaxBuildSpacing()) return cityState.developmentLots;
    return [...cityState.developmentLots, ...getRoadDevelopmentAnchors()];
  }

  return getRoadDevelopmentAnchors();
}

function getRoadDevelopmentAnchors() {
  const anchors = [];
  for (const key of cityState.roadTiles) {
    const roadCell = parseCellKey(key);
    anchors.push(...getBuildAnchorsFromRoad(roadCell).map((anchor) => ({ ...anchor, roadCell })));
  }
  return anchors;
}

function getNeighbourPressureLimit(snapshot) {
  if (snapshot.dominant === 'bass') return 3;
  if (snapshot.dominant === 'treble') return 1;
  return 2;
}

function getBlockBuildingLimit(snapshot) {
  const lateCityBonus = shouldRelaxBuildSpacing() ? 2 : 0;
  if (snapshot.dominant === 'bass') return 6 + lateCityBonus;
  if (snapshot.dominant === 'treble') return 4 + lateCityBonus;
  return 5 + lateCityBonus;
}

function getBuildAnchorsFromRoad(roadCell) {
  const anchors = [];
  const maxSetback = shouldRelaxBuildSpacing() ? 3 : 2;

  for (const direction of getCardinalDirections()) {
    for (let setback = 0; setback <= maxSetback; setback++) {
      const x = roadCell.x + direction.dx * (setback + 1);
      const y = roadCell.y + direction.dy * (setback + 1);
      if (!isInBounds(x, y) || isRoadCell(x, y) || isPlannedStreetCorridor(x, y)) break;
      anchors.push({ x, y, setback });
    }
  }

  return anchors;
}

function shouldRelaxBuildSpacing() {
  return cityState.lotsExhausted || cityState.buildings.length >= cityState.maxBuildings * 0.65;
}

function getBuildRoadSearchDistance() {
  return shouldRelaxBuildSpacing() ? 4 : 3;
}

function getSetbackScore(anchor) {
  if (anchor.setback === 0) return 0.45;
  if (anchor.setback === 1) return -0.16;
  return 0.08;
}

function getFootprintOptions(snapshot) {
  if (snapshot.dominant === 'bass') {
    return [
      { width: 2, depth: 2 },
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

function isFootprintDrawable(x, y, footprintWidth, footprintDepth, projectedHeight) {
  const bounds = getProjectedBuildingBounds(x, y, footprintWidth, footprintDepth, projectedHeight + BUILDING_HOVER_LIFT + BUILDING_HOVER_FLOAT);
  return isProjectedBoundsInsideCanvas(bounds);
}

function isBuildingDrawable(building) {
  const projectedHeight = (building.height || BUILDING_SAFE_HEIGHT) + BUILDING_HOVER_LIFT + BUILDING_HOVER_FLOAT;
  const bounds = getProjectedBuildingBounds(building.gridX, building.gridY, building.width || 1, building.depth || 1, projectedHeight);
  return isProjectedBoundsInsideCanvas(bounds);
}

function getProjectedBuildingBounds(gridX, gridY, footprintWidth, footprintDepth, projectedHeight) {
  const groundPoints = [
    isoToScreen(gridX, gridY, 0),
    isoToScreen(gridX + footprintWidth, gridY, 0),
    isoToScreen(gridX + footprintWidth, gridY + footprintDepth, 0),
    isoToScreen(gridX, gridY + footprintDepth, 0),
  ];
  const roofPoints = groundPoints.map((point) => createVector(point.x, point.y - projectedHeight));
  const points = [...groundPoints, ...roofPoints];
  const pointXValues = points.map((point) => point.x);
  const pointYValues = points.map((point) => point.y);

  return {
    minX: Math.min(...pointXValues),
    maxX: Math.max(...pointXValues),
    minY: Math.min(...pointYValues),
    maxY: Math.max(...pointYValues),
  };
}

function isProjectedBoundsInsideCanvas(bounds) {
  const viewBounds = getCityViewBounds();
  return (
    bounds.minX >= viewBounds.left + BUILDING_VIEW_MARGIN &&
    bounds.maxX <= viewBounds.right - BUILDING_VIEW_MARGIN &&
    bounds.minY >= viewBounds.top + BUILDING_VIEW_MARGIN &&
    bounds.maxY <= viewBounds.bottom - BUILDING_VIEW_MARGIN
  );
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

function countPlannedStreetCells() {
  let total = 0;
  for (let y = 0; y < cityState.gridRows; y++) {
    for (let x = 0; x < cityState.gridColumns; x++) {
      if (isPlannedStreetCorridor(x, y)) total += 1;
    }
  }
  return total;
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

function countBuildingsInBlock(x, y) {
  const blockKey = getUrbanBlockKey(x, y);
  return cityState.buildings.filter((building) => getUrbanBlockKey(building.gridX, building.gridY) === blockKey).length;
}

function getUrbanBlockKey(x, y) {
  const column = floor((x - cityState.centerCell.x + cityState.gridColumns * cityState.blockSize) / cityState.blockSize);
  const row = floor((y - cityState.centerCell.y + cityState.gridRows * cityState.blockSize) / cityState.blockSize);
  return `${column},${row}`;
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
  return getCardinalDirections().map((direction) => ({ x: x + direction.dx, y: y + direction.dy }));
}

function getCardinalDirections() {
  return [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
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

// AI-assisted: converts square grid coordinates into 2.5D isometric screen coordinates.
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

function drawTimeIndicator() {
  const nightAmount = timeMechanic.getNightAmount(cityState);
  const viewBounds = getCityViewBounds();
  const markerX = constrain(viewBounds.right - 88, viewBounds.left + 88, viewBounds.right - 88);
  const markerY = viewBounds.top + 46;
  const isNight = nightAmount > 0.48;
  const iconColour = isNight ? color('#e8eff5') : color('#f0b25f');

  push();
  rectMode(CENTER);
  noStroke();
  fill(250, 248, 239, 196);
  rect(markerX, markerY, 156, 58, 3);

  stroke(35, 58, 56, 70);
  strokeWeight(1);
  line(markerX - 52, markerY + 9, markerX + 52, markerY + 9);

  const orbitPosition = map(cityState.timeOfDay, 0, 1, -52, 52);
  const orbitLift = sin(cityState.timeOfDay * TWO_PI) * 12;
  noStroke();
  fill(iconColour);
  ellipse(markerX + orbitPosition, markerY + 9 - orbitLift, 18, 18);

  if (isNight) {
    fill(250, 248, 239, 220);
    ellipse(markerX + orbitPosition + 6, markerY + 5 - orbitLift, 15, 15);
  }

  fill(31, 45, 43, 190);
  textAlign(CENTER, CENTER);
  textSize(11);
  textStyle(BOLD);
  text(cityState.timeLabel, markerX, markerY - 16);
  pop();
}

function drawAudioPulseRings() {
  cityState.pulseRings = cityState.pulseRings.filter((ring) => frameCount - ring.startedAt < 90);

  push();
  noFill();
  for (const ring of cityState.pulseRings) {
    const age = frameCount - ring.startedAt;
    const fade = 1 - age / 90;
    const radius = cityState.tileW * (0.36 + age * 0.022 + ring.strength * 0.38);
    const centre = isoToScreen(ring.gridX, ring.gridY, 2);
    const ringColour = getBandColour(ring.dominant);
    stroke(red(ringColour), green(ringColour), blue(ringColour), 88 * fade);
    strokeWeight(1.2 + ring.strength * 1.5);
    beginShape();
    vertex(centre.x, centre.y - radius * 0.48);
    vertex(centre.x + radius, centre.y);
    vertex(centre.x, centre.y + radius * 0.48);
    vertex(centre.x - radius, centre.y);
    endShape(CLOSE);
  }
  pop();
}

function getBandColour(dominant) {
  if (dominant === 'bass') return color(cityState.palette.roofCool);
  if (dominant === 'treble') return color(cityState.palette.roofWarm);
  if (dominant === 'mid') return color(cityState.palette.roof);
  return color(cityState.palette.line);
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
      strokeWeight: roadMeta && roadMeta.kind === 'main avenue' ? 1.25 : 0.75,
    });
  }
}

function getRoadColour(roadMeta) {
  const base = color(cityState.palette.road);
  if (!roadMeta) return base;
  if (roadMeta.kind === 'main avenue') return lerpColor(base, color('#c8ddda'), 0.44);
  if (roadMeta.dominant === 'bass') return lerpColor(base, color('#c8deea'), 0.38);
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
  strokeWeight(tile.strokeWeight || 1);
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
  const sortedBuildings = [...cityState.buildings].sort(compareBuildingsForIsoDraw);
  for (const building of sortedBuildings) {
    drawIsoBuildingShadow(building);
  }

  for (const building of sortedBuildings) {
    drawIsoBuilding(building);
  }
}

// AI-assisted: sorts isometric buildings from back to front so closer buildings cover farther ones correctly.
function compareBuildingsForIsoDraw(a, b) {
  const aDepth = getBuildingBaseDepth(a);
  const bDepth = getBuildingBaseDepth(b);
  if (aDepth !== bDepth) return aDepth - bDepth;
  if (a.gridY !== b.gridY) return a.gridY - b.gridY;
  if (a.gridX !== b.gridX) return a.gridX - b.gridX;
  return (a.height || 0) - (b.height || 0);
}

function getBuildingBaseDepth(building) {
  return building.gridX + building.gridY + (building.width || 1) + (building.depth || 1);
}

function drawIsoBuildingShadow(building) {
  const gx = building.gridX;
  const gy = building.gridY;
  const bw = building.width || 1;
  const bd = building.depth || 1;
  const a0Ground = isoToScreen(gx, gy, 0);
  const b0Ground = isoToScreen(gx + bw, gy, 0);
  const c0Ground = isoToScreen(gx + bw, gy + bd, 0);
  const d0Ground = isoToScreen(gx, gy + bd, 0);
  drawBuildingShadow(a0Ground, b0Ground, c0Ground, d0Ground, building);
}

function drawIsoBuilding(building) {
  push();
  initializeBuildingHoverState(building);
  const h = building.height;
  const gx = building.gridX;
  const gy = building.gridY;
  const bw = building.width || 1;
  const bd = building.depth || 1;
  const isHovered = cityState.hoveredBuilding && cityState.hoveredBuilding.id === building.id;
  const isSelected = cityState.selectedBuilding && cityState.selectedBuilding.id === building.id;
  const lineWeight = isHovered || isSelected ? 2.4 : 1.25;
  const lineColour = isHovered || isSelected ? color('#178f92') : color(cityState.palette.line);
  const liftOffset = updateBuildingHoverLift(building, isHovered);

  const a0 = isoToScreen(gx, gy, liftOffset);
  const b0 = isoToScreen(gx + bw, gy, liftOffset);
  const c0 = isoToScreen(gx + bw, gy + bd, liftOffset);
  const d0 = isoToScreen(gx, gy + bd, liftOffset);
  const a = isoToScreen(gx, gy, h + liftOffset);
  const b = isoToScreen(gx + bw, gy, h + liftOffset);
  const c = isoToScreen(gx + bw, gy + bd, h + liftOffset);
  const d = isoToScreen(gx, gy + bd, h + liftOffset);

  building.bounds = {
    minX: min(a.x, b.x, c.x, d.x, a0.x, b0.x, c0.x, d0.x),
    maxX: max(a.x, b.x, c.x, d.x, a0.x, b0.x, c0.x, d0.x),
    minY: min(a.y, b.y, c.y, d.y, a0.y, b0.y, c0.y, d0.y),
    maxY: max(a.y, b.y, c.y, d.y, a0.y, b0.y, c0.y, d0.y),
  };
  // This code was generated with the help of ChatGPT and stores visible isometric faces for precise hit testing.
  building.hitPolygons = {
    roof: [a, b, c, d],
    side: [b, c, c0, b0],
    front: [c, d, d0, c0],
  };

  stroke(lineColour);
  strokeWeight(lineWeight);
  fill(timeMechanic.tintBuildingColour(building.sideColour || cityState.palette.side, cityState, 0.92));
  quad(b.x, b.y, c.x, c.y, c0.x, c0.y, b0.x, b0.y);
  fill(timeMechanic.tintBuildingColour(building.frontColour || cityState.palette.front, cityState, 1));
  quad(c.x, c.y, d.x, d.y, d0.x, d0.y, c0.x, c0.y);
  fill(timeMechanic.tintBuildingColour(building.roofColour, cityState, 1.04));
  quad(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);

  drawWindows(building, b, c, c0, b0, 'side');
  drawWindows(building, c, d, d0, c0, 'front');
  drawRoofDetails(building, a, b, c, d);
  pop();
}

function updateBuildingHoverLift(building, isHovered) {
  // This code was generated with the help of ChatGPT and makes hovered buildings rise, float, then settle back down.
  building.hoverLiftTarget = isHovered ? BUILDING_HOVER_LIFT : 0;
  building.hoverLift = lerp(building.hoverLift, building.hoverLiftTarget, BUILDING_HOVER_SPEED);

  if (abs(building.hoverLift) < 0.05 && building.hoverLiftTarget === 0) {
    building.hoverLift = 0;
  }

  const liftAmount = constrain(building.hoverLift / BUILDING_HOVER_LIFT, 0, 1);
  const floatOffset = sin(frameCount * 0.08 + building.hoverFloatPhase) * BUILDING_HOVER_FLOAT * liftAmount;
  return building.hoverLift + floatOffset;
}

function drawBuildingShadow(a0, b0, c0, d0, building) {
  const age = building.createdFrame ? min(1, (frameCount - building.createdFrame) / 36) : 1;
  const growOffset = (1 - age) * 9;
  const shadowAlpha = map(constrain(building.height, 12, 88), 12, 88, 20, 46);
  const liftAmount = constrain((building.hoverLift || 0) / BUILDING_HOVER_LIFT, 0, 1);
  const shadow = timeMechanic.getShadowProfile(cityState);

  push();
  noStroke();
  fill(20, 35, 45, shadowAlpha * shadow.alpha * age * (1 - liftAmount * 0.34));
  quad(
    a0.x + shadow.x * 0.4 + growOffset + liftAmount * 5,
    a0.y + shadow.y * 0.7,
    b0.x + shadow.x * 0.72 + growOffset + liftAmount * 5,
    b0.y + shadow.y * 0.7,
    c0.x + shadow.x * shadow.stretch + growOffset + liftAmount * 7,
    c0.y + shadow.y * shadow.stretch,
    d0.x + shadow.x * 1.08 + growOffset + liftAmount * 7,
    d0.y + shadow.y * shadow.stretch,
  );
  pop();
}

function drawWindows(building, topA, topB, bottomB, bottomA, face) {
  const floors = max(1, floor(building.stories));
  const divisions = getFacadeDivisions(building, face);
  stroke(35, 58, 56, building.facadeStyle === 'quiet' ? 72 : 104);
  strokeWeight(0.7);
  for (let i = 1; i <= floors; i++) {
    const t = i / (floors + 1);
    const left = p5.Vector.lerp(topA, bottomA, t);
    const right = p5.Vector.lerp(topB, bottomB, t);
    const insetA = p5.Vector.lerp(left, right, 0.2);
    const insetB = p5.Vector.lerp(left, right, 0.8);
    line(insetA.x, insetA.y, insetB.x, insetB.y);
  }

  stroke(35, 58, 56, building.facadeStyle === 'fine-grid' ? 82 : 50);
  strokeWeight(0.55);
  for (let j = 1; j <= divisions; j++) {
    const t = j / (divisions + 1);
    const top = p5.Vector.lerp(topA, topB, t);
    const bottom = p5.Vector.lerp(bottomA, bottomB, t);
    const start = p5.Vector.lerp(top, bottom, 0.12);
    const end = p5.Vector.lerp(top, bottom, 0.86);
    line(start.x, start.y, end.x, end.y);
  }

  drawWindowLights(building, topA, topB, bottomB, bottomA, face, floors, divisions);
}

// AI-assisted: uses deterministic seeds so window lights flicker with music but stay attached to each building.
function drawWindowLights(building, topA, topB, bottomB, bottomA, face, floors, divisions) {
  const nightAmount = timeMechanic.getWindowLightAmount(cityState);
  const musicGlow = cityState.audioSnapshot ? cityState.audioSnapshot.level : 0;
  const lightChance = constrain(nightAmount * 0.9 + musicGlow * 0.24, 0, 0.92);
  if (lightChance <= 0.02) return;

  push();
  drawingContext.shadowColor = `rgba(255, 214, 112, ${0.24 + nightAmount * 0.42})`;
  drawingContext.shadowBlur = 3 + nightAmount * 7;
  stroke(255, 228, 138, 175 + nightAmount * 80);
  strokeWeight(1.25 + nightAmount * 0.75);
  for (let floorIndex = 1; floorIndex <= floors; floorIndex++) {
    const t = floorIndex / (floors + 1);
    const left = p5.Vector.lerp(topA, bottomA, t);
    const right = p5.Vector.lerp(topB, bottomB, t);

    for (let divisionIndex = 0; divisionIndex < divisions; divisionIndex++) {
      const seed = building.seed + floorIndex * 31 + divisionIndex * 67 + (face === 'front' ? 7 : 17);
      if (randomSeeded(seed, 0, 1) > lightChance) continue;

      const startT = map(divisionIndex, 0, divisions, 0.24, 0.72);
      const endT = startT + 0.1;
      const start = p5.Vector.lerp(left, right, startT);
      const end = p5.Vector.lerp(left, right, min(0.82, endT));
      line(start.x, start.y, end.x, end.y);
    }
  }
  drawingContext.shadowBlur = 0;
  pop();
}

function getFacadeDivisions(building, face) {
  if (building.facadeStyle === 'fine-grid') return face === 'front' ? 4 : 3;
  if (building.facadeStyle === 'banded') return 3;
  if (building.facadeStyle === 'block') return 2;
  return 1;
}

function drawRoofDetails(building, a, b, c, d) {
  stroke(35, 58, 56, 120);
  strokeWeight(0.8);
  noFill();
  const centre = createVector((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4);
  const ia = p5.Vector.lerp(a, centre, 0.14);
  const ib = p5.Vector.lerp(b, centre, 0.14);
  const ic = p5.Vector.lerp(c, centre, 0.14);
  const id = p5.Vector.lerp(d, centre, 0.14);
  quad(ia.x, ia.y, ib.x, ib.y, ic.x, ic.y, id.x, id.y);

  const p1 = p5.Vector.lerp(a, c, 0.35);
  const p2 = p5.Vector.lerp(a, c, 0.65);
  const q1 = p5.Vector.lerp(b, d, 0.35);
  const q2 = p5.Vector.lerp(b, d, 0.65);
  line(p1.x, p1.y, q1.x, q1.y);
  if (building.type !== 'low-rise') {
    line(p2.x, p2.y, q2.x, q2.y);
  }

  if (building.facadeStyle === 'banded' || building.facadeStyle === 'block') {
    drawRooftopUnit(building, a, b, c, d);
  }

  drawRoofAudioMark(building, a, b, c, d);
}

function drawRooftopUnit(building, a, b, c, d) {
  const left = p5.Vector.lerp(a, b, 0.56);
  const right = p5.Vector.lerp(a, b, 0.76);
  const back = p5.Vector.lerp(d, c, 0.76);
  const front = p5.Vector.lerp(d, c, 0.56);
  const u1 = p5.Vector.lerp(left, front, 0.36);
  const u2 = p5.Vector.lerp(right, back, 0.36);
  const u3 = p5.Vector.lerp(right, back, 0.58);
  const u4 = p5.Vector.lerp(left, front, 0.58);

  fill(timeMechanic.tintBuildingColour('#edf4ef', cityState, 0.98));
  stroke(35, 58, 56, 105);
  strokeWeight(0.65);
  quad(u1.x, u1.y, u2.x, u2.y, u3.x, u3.y, u4.x, u4.y);
}

function drawRoofAudioMark(building, a, b, c, d) {
  const centre = createVector((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4);
  const accent = getBandColour(building.dominant);
  const activeBoost = cityState.audioSnapshot && cityState.audioSnapshot.dominant === building.dominant ? cityState.audioSnapshot.level : 0;

  push();
  stroke(red(accent), green(accent), blue(accent), 130 + activeBoost * 85);
  strokeWeight(0.9 + activeBoost * 1.4);

  if (building.dominant === 'treble') {
    fill(red(accent), green(accent), blue(accent), 52 + activeBoost * 90);
    ellipse(centre.x, centre.y, 5 + activeBoost * 8, 3 + activeBoost * 4);
  } else if (building.dominant === 'bass') {
    const p1 = p5.Vector.lerp(a, c, 0.42);
    const p2 = p5.Vector.lerp(a, c, 0.58);
    const q1 = p5.Vector.lerp(b, d, 0.42);
    const q2 = p5.Vector.lerp(b, d, 0.58);
    line(p1.x, p1.y, q1.x, q1.y);
    line(p2.x, p2.y, q2.x, q2.y);
  } else {
    noFill();
    const ia = p5.Vector.lerp(a, centre, 0.36);
    const ib = p5.Vector.lerp(b, centre, 0.36);
    const ic = p5.Vector.lerp(c, centre, 0.36);
    const id = p5.Vector.lerp(d, centre, 0.36);
    quad(ia.x, ia.y, ib.x, ib.y, ic.x, ic.y, id.x, id.y);
  }
  pop();
}

function mousePressed() {
  inputMechanic.mousePressed(cityState);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateCityLayout();
  inputMechanic.windowResized(cityState);
}
