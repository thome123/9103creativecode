// Input mechanic placeholder generated with help from ChatGPT/Codex.
// Teammates can replace this file with their own mouse/keyboard mechanic implementation.
class InputMechanic {
  setup(cityState) {
    this.infoPanel = document.getElementById('buildingInfo');
  }

  update(cityState) {
    cityState.hoveredBuilding = this.findBuildingUnderMouse(cityState);
  }

  draw(cityState) {
    if (!cityState.hoveredBuilding) return;
    const building = cityState.hoveredBuilding;
    if (!building.bounds) return;

    push();
    noFill();
    stroke('#178f92');
    strokeWeight(1.5);
    rectMode(CORNERS);
    rect(building.bounds.minX - 3, building.bounds.minY - 3, building.bounds.maxX + 3, building.bounds.maxY + 3);
    pop();
  }

  mousePressed(cityState) {
    cityState.selectedBuilding = cityState.hoveredBuilding;
    this.renderInfo(cityState.selectedBuilding);
  }

  findBuildingUnderMouse(cityState) {
    for (let i = cityState.buildings.length - 1; i >= 0; i--) {
      const building = cityState.buildings[i];
      if (!building.bounds) continue;
      if (
        mouseX >= building.bounds.minX &&
        mouseX <= building.bounds.maxX &&
        mouseY >= building.bounds.minY &&
        mouseY <= building.bounds.maxY
      ) {
        return building;
      }
    }
    return null;
  }

  renderInfo(building) {
    if (!this.infoPanel) return;
    if (!building) {
      this.infoPanel.innerHTML = '<h2>Building Archive</h2><p>Click a generated building to inspect its audio data.</p>';
      return;
    }

    this.infoPanel.innerHTML = `
      <h2>Building #${building.id}</h2>
      <p>${building.type} generated at ${building.createdAtLabel} from the uploaded track.</p>
      <div class="data-row"><span>Height</span><strong>${building.height.toFixed(1)} px</strong></div>
      <div class="data-row"><span>Random seed</span><strong>${building.seed}</strong></div>
      <div class="data-row"><span>Dominant band</span><strong>${building.dominant}</strong></div>
      <div class="data-row"><span>Level</span><strong>${building.audioLevel.toFixed(3)}</strong></div>
      <div class="data-row"><span>Bass</span><strong>${building.bass.toFixed(0)}</strong></div>
      <div class="data-row"><span>Mid</span><strong>${building.mid.toFixed(0)}</strong></div>
      <div class="data-row"><span>Treble</span><strong>${building.treble.toFixed(0)}</strong></div>
    `;
  }

  windowResized(cityState) {}
}
