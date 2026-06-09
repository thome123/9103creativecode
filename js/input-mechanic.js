// Handles user input for inspecting audio-generated buildings.
class InputMechanic {
  // Sets up the info panel, cursor state, and Escape key behavior.
  setup(cityState) {
    this.infoPanel = document.getElementById('buildingInfo');
    this.hoverPadding = 5;
    this.defaultCursor = ARROW;
    this.ensureValueStyles();

    this.escapeHandler = (event) => {
      if (event.key !== 'Escape') return;
      cityState.selectedBuilding = null;
      this.renderInfo(null);
    };

    window.addEventListener('keydown', this.escapeHandler);
  }

  // Adds numeric font styles used by the building info panel.
  ensureValueStyles() {
    if (document.getElementById('building-value-styles')) return;

    const style = document.createElement('style');
    style.id = 'building-value-styles';
    style.textContent = `
      .building-info .data-row strong {
        font-family: "Segoe UI", Arial, sans-serif;
        font-variant-numeric: lining-nums tabular-nums;
        font-feature-settings: "lnum" 1, "tnum" 1;
      }
    `;
    document.head.appendChild(style);
  }

  // Updates the hovered building each frame and changes the cursor.
  update(cityState) {
    cityState.hoveredBuilding = this.findBuildingUnderMouse(cityState);
    cursor(cityState.hoveredBuilding ? 'pointer' : this.defaultCursor);
  }

  // Draws highlight frames for the selected or hovered building.
  draw(cityState) {
    if (cityState.selectedBuilding) {
      this.drawBuildingFrame(cityState.selectedBuilding, {
        colour: '#0f6f73',
        alpha: 210,
        weight: 2.4,
        padding: 8,
        cornerLength: 14,
      });
    }

    if (
      cityState.hoveredBuilding &&
      (!cityState.selectedBuilding || cityState.hoveredBuilding.id !== cityState.selectedBuilding.id)
    ) {
      this.drawBuildingFrame(cityState.hoveredBuilding, {
        colour: '#178f92',
        alpha: 175,
        weight: 1.5,
        padding: this.hoverPadding,
        cornerLength: 0,
      });
    }
  }

  // Selects the clicked building and refreshes the info panel.
  mousePressed(cityState) {
    const clickedBuilding = this.findBuildingUnderMouse(cityState);
    cityState.selectedBuilding = clickedBuilding;
    this.renderInfo(cityState.selectedBuilding);
  }

  // Finds the topmost building under the mouse pointer.
  findBuildingUnderMouse(cityState) {
    for (let i = cityState.buildings.length - 1; i >= 0; i--) {
      const building = cityState.buildings[i];
      if (!building.bounds) continue;
      if (!this.isPointInsideBounds(mouseX, mouseY, building.bounds)) continue;
      if (!building.hitPolygons || this.isPointInsideBuildingFaces(mouseX, mouseY, building.hitPolygons)) {
        return building;
      }
    }
    return null;
  }

  // Quickly checks whether a point is inside a building's bounds.
  isPointInsideBounds(x, y, bounds) {
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
  }

  // Checks whether a point is inside any visible isometric face.
  isPointInsideBuildingFaces(x, y, hitPolygons) {
    return Object.values(hitPolygons).some((polygon) => this.isPointInsidePolygon(x, y, polygon));
  }

  // Uses ray casting to test whether a point is inside a polygon.
  isPointInsidePolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const current = polygon[i];
      const previous = polygon[j];
      if (this.isPointOnSegment(x, y, previous, current)) return true;

      const crossesY = current.y > y !== previous.y > y;
      if (!crossesY) continue;

      const intersectionX = ((previous.x - current.x) * (y - current.y)) / (previous.y - current.y) + current.x;
      if (x < intersectionX) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Treats points on polygon edges as hits.
  isPointOnSegment(x, y, start, end) {
    const tolerance = 0.5;
    const length = dist(start.x, start.y, end.x, end.y);
    if (length === 0) return dist(x, y, start.x, start.y) <= tolerance;

    const cross = (x - start.x) * (end.y - start.y) - (y - start.y) * (end.x - start.x);
    if (abs(cross) / length > tolerance) return false;

    return (
      x >= min(start.x, end.x) - tolerance &&
      x <= max(start.x, end.x) + tolerance &&
      y >= min(start.y, end.y) - tolerance &&
      y <= max(start.y, end.y) + tolerance
    );
  }

  // Draws either a rectangular frame or face outlines around a building.
  drawBuildingFrame(building, options) {
    if (!building || !building.bounds) return;
    if (building.hitPolygons) {
      this.drawBuildingFaceFrames(building.hitPolygons, options);
      return;
    }

    const bounds = building.bounds;
    const x1 = bounds.minX - options.padding;
    const y1 = bounds.minY - options.padding;
    const x2 = bounds.maxX + options.padding;
    const y2 = bounds.maxY + options.padding;
    const frameColour = color(options.colour);

    push();
    noFill();
    stroke(red(frameColour), green(frameColour), blue(frameColour), options.alpha);
    strokeWeight(options.weight);
    rectMode(CORNERS);

    if (!options.cornerLength) {
      rect(x1, y1, x2, y2);
      pop();
      return;
    }

    const length = min(options.cornerLength, (x2 - x1) * 0.35, (y2 - y1) * 0.35);
    line(x1, y1, x1 + length, y1);
    line(x1, y1, x1, y1 + length);
    line(x2, y1, x2 - length, y1);
    line(x2, y1, x2, y1 + length);
    line(x1, y2, x1 + length, y2);
    line(x1, y2, x1, y2 - length);
    line(x2, y2, x2 - length, y2);
    line(x2, y2, x2, y2 - length);
    pop();
  }

  // Draws highlight outlines around visible isometric faces.
  drawBuildingFaceFrames(hitPolygons, options) {
    const frameColour = color(options.colour);

    push();
    noFill();
    stroke(red(frameColour), green(frameColour), blue(frameColour), options.alpha);
    strokeWeight(options.weight);

    for (const polygon of Object.values(hitPolygons)) {
      beginShape();
      for (const point of polygon) {
        vertex(point.x, point.y);
      }
      endShape(CLOSE);
    }

    pop();
  }

  // Renders the selected building's audio and grid data.
  renderInfo(building) {
    if (!this.infoPanel) return;
    if (!building) {
      this.infoPanel.innerHTML = `
        <div class="panel-kicker">Selected Parcel</div>
        <h2>Building Archive</h2>
        <p>Click a generated building to inspect its audio data.</p>
      `;
      return;
    }

    this.infoPanel.innerHTML = `
      <div class="panel-kicker">Selected Parcel</div>
      <h2>Building #${building.id}</h2>
      <p>${building.type} generated at ${building.createdAtLabel} from the uploaded track.</p>
      <div class="data-row"><span>Footprint</span><strong>${building.width || 1} x ${building.depth || 1} lots</strong></div>
      <div class="data-row"><span>Grid position</span><strong>${building.gridX}, ${building.gridY}</strong></div>
      <div class="data-row"><span>Height</span><strong>${building.height.toFixed(1)} px</strong></div>
      <div class="data-row"><span>Stories</span><strong>${building.stories}</strong></div>
      <div class="data-row"><span>Random seed</span><strong>${building.seed}</strong></div>
      <div class="data-row"><span>Dominant band</span><strong>${building.dominant}</strong></div>
      <div class="data-row"><span>Level</span><strong>${building.audioLevel.toFixed(3)}</strong></div>
      <div class="data-row"><span>Bass</span><strong>${building.bass.toFixed(0)}</strong></div>
      <div class="data-row"><span>Mid</span><strong>${building.mid.toFixed(0)}</strong></div>
      <div class="data-row"><span>Treble</span><strong>${building.treble.toFixed(0)}</strong></div>
    `;
  }

  // Clears hover state after resizing so stale coordinates are not reused.
  windowResized(cityState) {
    cityState.hoveredBuilding = null;
  }
}
