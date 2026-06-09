// City state and responsive layout helpers.
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
