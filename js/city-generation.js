// Audio-paced city growth and building placement helpers.
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

function isBuildableCell(x, y) {
  if (!isInBounds(x, y)) return false;
  if (cityState.occupied.has(cellKey(x, y))) return false;
  if (isRoadCell(x, y)) return false;
  if (isParkCell(x, y)) return false;
  if (isPlannedStreetCorridor(x, y)) return false;
  return true;
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
