// Time mechanic generated with help from ChatGPT/Codex.
// It keeps the city readable while cycling through soft architectural day phases.
class TimeMechanic {
  constructor() {
    this.cycleDurationMs = 60000;
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
    const morning = color('#f5f7f1');
    const day = color('#eef8f6');
    const sunset = color('#f6e4d1');
    const night = color('#d7e4ea');
    const deepNight = color('#c9d9df');

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

    return lerpColor(base, deepNight, verticalPosition * 0.18);
  }

  tintBuildingColour(hexColour, cityState, brightnessBoost = 1) {
    const base = color(hexColour);
    const p = cityState.timeOfDay;
    const nightAmount = p > 0.72 ? map(p, 0.72, 1, 0.12, 0.34) : 0;
    const sunsetAmount = p > 0.45 && p < 0.72 ? sin(map(p, 0.45, 0.72, 0, PI)) * 0.16 : 0;
    let tinted = lerpColor(base, color('#d8e5e8'), nightAmount);
    tinted = lerpColor(tinted, color('#f1d0b9'), sunsetAmount);
    return color(red(tinted) * brightnessBoost, green(tinted) * brightnessBoost, blue(tinted) * brightnessBoost);
  }
}
