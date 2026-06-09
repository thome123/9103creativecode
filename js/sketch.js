// Main p5 sketch: coordinates the separate mechanic and helper files.
let cityState;
let audioMechanic;
let timeMechanic;
let randomMechanic;
let inputMechanic;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont('Georgia');
  initCityState();
  setupMechanics();
  exposeDebugState();
}

function draw() {
  updateMechanics();
  drawCityScene();
}

function initCityState() {
  cityState = createDefaultCityState();
  updateCityLayout();
  cityState.plannedStreetTarget = countPlannedStreetCells();
}

function setupMechanics() {
  randomMechanic = new RandomMechanic();
  timeMechanic = new TimeMechanic();
  audioMechanic = new AudioMechanic();
  inputMechanic = new InputMechanic();

  randomMechanic.setup(cityState);
  timeMechanic.setup(cityState);
  audioMechanic.setup(cityState, resetCityForNewAudio);
  inputMechanic.setup(cityState);
}

function updateMechanics() {
  timeMechanic.update(cityState);
  audioMechanic.update(cityState);
  processAudioBuildingRequests();
  inputMechanic.update(cityState);
}

function drawCityScene() {
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

function resetCityForNewAudio() {
  Object.assign(cityState, createDefaultCityState());
  updateCityLayout();
  cityState.plannedStreetTarget = countPlannedStreetCells();

  if (randomMechanic) randomMechanic.setup(cityState);

  if (inputMechanic) {
    inputMechanic.windowResized(cityState);
    inputMechanic.renderInfo(null);
  }

  exposeDebugState();
}

function exposeDebugState() {
  window.cityState = cityState;
  window.audioMechanic = audioMechanic;
}

function mousePressed() {
  inputMechanic.mousePressed(cityState);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateCityLayout();
  inputMechanic.windowResized(cityState);
}
