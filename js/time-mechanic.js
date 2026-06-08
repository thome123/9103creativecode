// Time mechanic generated with help from ChatGPT/Codex.
// It keeps the city readable while cycling through soft architectural day phases.
class TimeMechanic {
  constructor() {
    this.cycleDurationMs = 90000;
  }

  setup(cityState) {
    cityState.timeOfDay = 0;
    cityState.timeLabel = 'Morning';
  }

  update(cityState) {
    const progress = (millis() % this.cycleDurationMs) / this.cycleDurationMs;
    cityState.timeOfDay = progress;
    cityState.timeLabel = this.getTimeLabel(progress);
  }

  getTimeLabel(progress) {
    if (progress < 0.25) return 'Morning';
    if (progress < 0.5) return 'Day';
    if (progress < 0.75) return 'Sunset';
    return 'Night';
  }

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

  getNightAmount(cityState) {
    const p = cityState.timeOfDay;
    if (p < 0.55) return 0;
    if (p < 0.75) return map(p, 0.55, 0.75, 0, 1);
    return map(p, 0.75, 1, 1, 0.24);
  }

  getWindowLightAmount(cityState) {
    const p = cityState.timeOfDay;
    if (p < 0.48) return 0;
    if (p < 0.72) return map(p, 0.48, 0.72, 0, 0.62);
    if (p < 0.9) return 1;
    return map(p, 0.9, 1, 1, 0.38);
  }

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
