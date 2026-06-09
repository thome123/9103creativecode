// Time mechanic generated with help from ChatGPT/Codex.
// It keeps the city readable while cycling through soft architectural day phases.
// Colour interpolation follows the p5.js lerpColor() reference:
// https://p5js.org/reference/p5/lerpColor/
// Principle: colours are blended with a 0-1 amount to create gradual time-of-day transitions.
class TimeMechanic {
  // One full visual day lasts 90 seconds, independent from the audio track length.
  // This makes the city keep changing even if the music is paused or very long.
  constructor() {
    this.cycleDurationMs = 90000;
  }

  // Initialize the shared time values that the renderer and HUD read each frame.
  setup(cityState) {
    cityState.timeOfDay = 0;
    cityState.timeLabel = 'Morning';
  }

  // Convert p5's running clock into a normalized 0-1 day cycle.
  // Other drawing functions use this single value for sky, tint, shadows, and lights.
  update(cityState) {
    const progress = (millis() % this.cycleDurationMs) / this.cycleDurationMs;
    cityState.timeOfDay = progress;
    cityState.timeLabel = this.getTimeLabel(progress);
  }

  // Human-readable labels for the interface.
  // Each quarter of the cycle represents a different lighting phase.
  getTimeLabel(progress) {
    if (progress < 0.25) return 'Morning';
    if (progress < 0.5) return 'Day';
    if (progress < 0.75) return 'Sunset';
    return 'Night';
  }

  // AI-assisted: blends morning, day, sunset, and night colours into a continuous background gradient.
  // verticalPosition adds a subtle top-to-bottom shift so the background feels spatial, not flat.
  getSkyColour(cityState, verticalPosition) {
    const p = cityState.timeOfDay;
    const morning = color('#f7ead8');
    const day = color('#eef8f6');
    const sunset = color('#f2b78a');
    const night = color('#18283b');
    const deepNight = color('#0d1929');

    let base;
    if (p < 0.25) {
      base = lerpColor(morning, day, p / 0.25);
    } else if (p < 0.5) {
      base = lerpColor(day, sunset, (p - 0.25) / 0.25);
    } else if (p < 0.75) {
      base = lerpColor(sunset, night, (p - 0.5) / 0.25);
    } else {
      base = lerpColor(night, morning, (p - 0.75) / 0.25);
    }

    return lerpColor(base, deepNight, verticalPosition * (0.14 + this.getNightAmount(cityState) * 0.32));
  }

  // AI-assisted: tints building colours according to time of day while keeping the architectural palette readable.
  // The tint is deliberately soft so the project still looks like an architectural drawing.
  tintBuildingColour(hexColour, cityState, brightnessBoost = 1) {
    const base = color(hexColour);
    const p = cityState.timeOfDay;
    const nightAmount = this.getNightAmount(cityState);
    const sunsetAmount = p > 0.45 && p < 0.72 ? sin(map(p, 0.45, 0.72, 0, PI)) * 0.28 : 0;
    let tinted = lerpColor(base, color('#9fb4c3'), nightAmount * 0.62);
    tinted = lerpColor(tinted, color('#f0bf8e'), sunsetAmount);
    const brightness = brightnessBoost * (1 - nightAmount * 0.24);
    return color(red(tinted) * brightness, green(tinted) * brightness, blue(tinted) * brightness, 255);
  }

  // Return how strongly night should affect the scene.
  // The value fades in after sunset and never drops instantly, which makes the cycle smoother.
  getNightAmount(cityState) {
    const p = cityState.timeOfDay;
    if (p < 0.55) return 0;
    if (p < 0.75) return map(p, 0.55, 0.75, 0, 1);
    return map(p, 0.75, 1, 1, 0.24);
  }

  // Windows are dark during the day and become brighter from sunset into night.
  // The sketch combines this with audio level so night lights can still react to music.
  getWindowLightAmount(cityState) {
    const p = cityState.timeOfDay;
    if (p < 0.48) return 0;
    if (p < 0.72) return map(p, 0.48, 0.72, 0, 0.62);
    if (p < 0.9) return 1;
    return map(p, 0.9, 1, 1, 0.38);
  }

  // AI-assisted: changes shadow direction and strength across the day-night cycle.
  // Morning and sunset cast longer shadows, while midday keeps shadows short and clean.
  getShadowProfile(cityState) {
    const p = cityState.timeOfDay;
    const nightAmount = this.getNightAmount(cityState);

    if (p < 0.25) {
      return { x: 18, y: 10, alpha: 1.2, stretch: 1.35 };
    }
    if (p < 0.5) {
      return { x: 6, y: 5, alpha: 0.58, stretch: 0.68 };
    }
    if (p < 0.75) {
      return { x: -22, y: 13, alpha: 1.34, stretch: 1.7 };
    }
    return { x: 3, y: 9, alpha: 0.46 + nightAmount * 0.28, stretch: 1.1 };
  }
}
