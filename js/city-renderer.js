// City drawing helpers live outside sketch.js so the main sketch can stay focused on orchestration.
// These functions still use the shared p5 globals, cityState, and mechanic instances.

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
