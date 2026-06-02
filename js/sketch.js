function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noStroke();
}

function draw() {
  background(5, 7, 19);

  const pulse = 0.5 + 0.5 * sin(frameCount * 0.04);
  const radius = min(width, height) * (0.18 + pulse * 0.08);

  fill(255, 210, 108, 120);
  circle(width * 0.5, height * 0.5, radius);

  fill(60, 120, 255, 80);
  circle(width * 0.5, height * 0.5, radius * 1.8);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
