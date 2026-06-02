let mechanics = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noStroke();

  mechanics = [
    new AudioMechanic(),
    new TimeMechanic(),
    new RandomMechanic(),
    new InputMechanic(),
  ];

  for (const mechanic of mechanics) {
    mechanic.setup();
  }
}

function draw() {
  background(5, 7, 19);

  for (const mechanic of mechanics) {
    mechanic.draw();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  for (const mechanic of mechanics) {
    mechanic.windowResized();
  }
}
