// Audio mechanic generated with help from ChatGPT/Codex.
// It uses the Web Audio API AnalyserNode to extract level/frequency data from an uploaded track.
// Frequency analysis follows the MDN Web Audio API AnalyserNode reference:
// https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
class AudioMechanic {
  constructor() {
    this.audioElement = null;
    this.audioContext = null;
    this.analyser = null;
    this.sourceNode = null;
    this.frequencyData = null;
    this.ready = false;
    this.requests = [];
    this.lastBuildFrame = 0;
    this.minBuildFrames = 72;
    this.cityState = null;
    this.defaultMaxBuildings = 105;
    this.minDynamicBuildings = 48;
    this.maxDynamicBuildings = 132;
    this.roadDurationRatio = 0.14;
    this.audioDuration = 0;
    this.currentFileName = '';
    this.buildPhaseStartSeconds = null;
    this.silenceThreshold = 0.035;
    this.maxQueuedRequests = 1;
    this.snapshot = this.emptySnapshot();
    this.resetCity = null;
  }

  setup(cityState, resetCity) {
    this.cityState = cityState;
    this.status = document.getElementById('audioStatus');
    this.stats = document.getElementById('cityStats');
    this.chooseAudio = document.getElementById('chooseAudio');
    this.playPause = document.getElementById('playPause');
    this.clearCity = document.getElementById('clearCity');
    this.audioInput = document.getElementById('audioInput');
    this.audioElement = document.getElementById('audioPlayer');
    this.trackProgressFill = document.getElementById('trackProgressFill');
    this.trackProgressText = document.getElementById('trackProgressText');
    this.cityProgressFill = document.getElementById('cityProgressFill');
    this.cityProgressText = document.getElementById('cityProgressText');
    this.AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.resetCity = resetCity;

    if (!this.audioElement || !this.AudioContextClass) {
      this.status.textContent = 'This browser does not support the required audio analyser.';
      this.chooseAudio.disabled = true;
      return;
    }

    this.chooseAudio.addEventListener('click', () => this.audioInput.click());
    this.audioInput.addEventListener('change', (event) => this.loadAudio(event));
    this.playPause.addEventListener('click', async () => this.togglePlayback());
    this.clearCity.addEventListener('click', () => this.clearGeneratedCity());
    this.audioElement.addEventListener('loadedmetadata', () => this.updateAudioDuration());
    this.audioElement.addEventListener('ended', () => {
      this.playPause.textContent = 'Play';
      this.status.textContent = 'Audio ended.';
    });
  }

  loadAudio(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (this.audioElement.src) {
      URL.revokeObjectURL(this.audioElement.src);
    }

    this.audioElement.pause();
    this.resetGenerationState();
    this.audioDuration = 0;
    this.currentFileName = file.name;
    if (typeof this.resetCity === 'function') {
      this.resetCity();
    }

    this.audioElement.src = URL.createObjectURL(file);
    this.audioElement.load();
    this.ready = true;
    this.playPause.disabled = false;
    this.playPause.textContent = 'Play';
    this.status.textContent = `Loaded: ${file.name}`;
    this.updateProgressDisplay(this.cityState);
  }

  async togglePlayback() {
    if (!this.ready || !this.audioElement.src) return;
    await this.ensureAudioContext();

    if (this.audioElement.paused) {
      try {
        await this.audioElement.play();
        this.playPause.textContent = 'Pause';
        this.status.textContent = 'Audio is generating the city.';
      } catch (error) {
        this.status.textContent = 'Playback failed. Try another audio file.';
      }
    } else {
      this.audioElement.pause();
      this.playPause.textContent = 'Play';
      this.status.textContent = 'Audio paused.';
    }
  }

  resetGenerationState() {
    this.requests.length = 0;
    this.lastBuildFrame = 0;
    this.buildPhaseStartSeconds = null;
    this.snapshot = this.emptySnapshot();
  }

  updateAudioDuration() {
    if (!Number.isFinite(this.audioElement.duration)) return;

    this.audioDuration = this.audioElement.duration;
    this.applyDynamicBuildTarget();
    this.updateProgressDisplay(this.cityState);
    if (this.currentFileName) {
      this.status.textContent = `Loaded: ${this.currentFileName} (${this.formatTime(this.audioDuration)}) | Target: ${this.cityState.maxBuildings} buildings`;
    }
  }

  clearGeneratedCity() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }

    this.resetGenerationState();
    if (typeof this.resetCity === 'function') {
      this.resetCity();
    }
    this.applyDynamicBuildTarget();

    this.playPause.textContent = 'Play';
    this.status.textContent = this.ready ? 'City cleared. Press Play to regenerate.' : 'City cleared.';
    this.updateProgressDisplay(this.cityState);
  }

  // AI-assisted: builds the browser audio graph so the uploaded track can be heard and analysed at the same time.
  async ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new this.AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.82;
      this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // AI-assisted: converts raw frequency bins into a compact audio snapshot used by the city generator.
  update(cityState) {
    if (!this.ready || !this.analyser || this.audioElement.paused) {
      this.snapshot = this.emptySnapshot();
      cityState.audioSnapshot = this.snapshot;
      return;
    }

    this.analyser.getByteFrequencyData(this.frequencyData);
    const level = this.averageRange(0, this.frequencyData.length) / 255;
    const bass = this.averageRange(2, 24);
    const mid = this.averageRange(24, 120);
    const treble = this.averageRange(120, 260);
    const seconds = this.audioElement.currentTime;
    const strength = constrain(level * 1.8 + (bass + mid + treble) / 900, 0, 1.4);
    this.updatePhaseTiming(cityState, seconds);

    this.snapshot = {
      level,
      bass,
      mid,
      treble,
      strength,
      seconds,
      timeLabel: this.formatTime(seconds),
      dominant: this.getDominantBand(bass, mid, treble),
    };
    cityState.audioSnapshot = this.snapshot;

    const scheduleLag = this.getScheduleLag(cityState);
    const shouldCatchUp = scheduleLag > 0.05 || this.isNearTrackEnd(cityState);
    const requestInterval = this.getRequestIntervalFrames(cityState);
    const timedGrowth = this.hasTrackDuration();

    // Keep city growth tied to the track timeline, while still responding to audible moments.
    const canRequestGrowth =
      (strength > this.silenceThreshold || shouldCatchUp || timedGrowth) &&
      this.requests.length < this.maxQueuedRequests &&
      frameCount - this.lastBuildFrame >= requestInterval &&
      !this.isGenerationComplete(cityState);

    if (canRequestGrowth) {
      const chance = timedGrowth || shouldCatchUp ? 1 : constrain(0.3 + strength * 0.55, 0.3, 0.88);
      if (random() < chance) {
        this.requests.push({ ...this.snapshot });
        this.lastBuildFrame = frameCount;
      }
    }
  }

  averageRange(start, end) {
    if (!this.frequencyData) return 0;
    let total = 0;
    let count = 0;
    const safeEnd = min(end, this.frequencyData.length);
    for (let i = start; i < safeEnd; i++) {
      total += this.frequencyData[i];
      count += 1;
    }
    return count ? total / count : 0;
  }

  consumeBuildRequests() {
    const pending = [...this.requests];
    this.requests.length = 0;
    return pending;
  }

  updatePhaseTiming(cityState, seconds) {
    if (cityState.generationPhase === 'buildings' && this.buildPhaseStartSeconds === null) {
      this.buildPhaseStartSeconds = seconds;
      this.applyDynamicBuildTarget();
    }
  }

  // AI-assisted: balances track duration with available map capacity so long songs can grow larger cities.
  applyDynamicBuildTarget() {
    if (!this.cityState) return;

    if (!this.hasTrackDuration()) {
      this.cityState.maxBuildings = max(this.cityState.buildings.length, this.defaultMaxBuildings);
      return;
    }

    const durationTarget = this.getDurationBuildingTarget();
    const capacityTarget = this.getCapacityBuildingTarget();
    const target = floor(constrain(durationTarget, this.minDynamicBuildings, min(this.maxDynamicBuildings, capacityTarget)));
    this.cityState.maxBuildings = max(this.cityState.buildings.length, target);
  }

  getDurationBuildingTarget() {
    const seconds = this.audioDuration;
    if (seconds < 75) return round(map(seconds, 30, 75, 42, 62));
    if (seconds < 180) return round(map(seconds, 75, 180, 62, 96));
    if (seconds < 360) return round(map(seconds, 180, 360, 96, 128));
    return this.maxDynamicBuildings;
  }

  getCapacityBuildingTarget() {
    const cityState = this.cityState;
    if (!cityState) return this.defaultMaxBuildings;

    if (cityState.developmentLots && cityState.developmentLots.length > 0) {
      return floor(constrain(cityState.developmentLots.length * 0.72, this.minDynamicBuildings, this.maxDynamicBuildings));
    }

    const gridCells = cityState.gridColumns * cityState.gridRows;
    const reservedCells = max(cityState.plannedStreetTarget || 0, cityState.roadTiles ? cityState.roadTiles.size : 0);
    const estimatedBuildableCells = max(this.minDynamicBuildings, gridCells - reservedCells);
    return floor(constrain(estimatedBuildableCells * 0.28, this.minDynamicBuildings, this.maxDynamicBuildings));
  }

  // AI-assisted: calculates how often growth requests should happen so generation follows the music timeline.
  getRequestIntervalFrames(cityState) {
    if (!this.hasTrackDuration()) {
      return cityState.generationPhase === 'roads' ? 48 : this.minBuildFrames;
    }

    if (cityState.generationPhase === 'roads') {
      const roadDeadline = this.getRoadDeadlineSeconds();
      const remainingRoadTiles = max(1, cityState.plannedStreetTarget - cityState.roadTiles.size);
      const expectedTilesPerRequest = 5.2;
      const remainingRequests = max(1, ceil(remainingRoadTiles / expectedTilesPerRequest));
      const remainingFrames = max(1, (roadDeadline - this.audioElement.currentTime) * 60);
      return floor(constrain(remainingFrames / remainingRequests, 12, 54));
    }

    const remainingBuildings = max(1, cityState.maxBuildings - cityState.buildings.length);
    const remainingFrames = max(1, (this.audioDuration - this.audioElement.currentTime) * 60);
    return floor(constrain(remainingFrames / remainingBuildings, 14, 126));
  }

  // AI-assisted: compares expected progress with real city progress and triggers catch-up growth when needed.
  getScheduleLag(cityState) {
    if (!this.hasTrackDuration()) return 0;

    if (cityState.generationPhase === 'roads') {
      const roadProgress = cityState.plannedStreetTarget > 0 ? cityState.roadTiles.size / cityState.plannedStreetTarget : 1;
      const targetRoadProgress = constrain(this.audioElement.currentTime / this.getRoadDeadlineSeconds(), 0, 1);
      return targetRoadProgress - roadProgress;
    }

    const buildingProgress = cityState.maxBuildings > 0 ? cityState.buildings.length / cityState.maxBuildings : 1;
    const targetBuildingProgress = this.getBuildingTargetProgress(cityState);
    return targetBuildingProgress - buildingProgress;
  }

  getBuildingTargetProgress(cityState) {
    if (!this.hasTrackDuration()) return 1;
    if (cityState.generationPhase === 'roads') return 0;

    const buildStart = this.buildPhaseStartSeconds ?? this.getRoadDeadlineSeconds();
    const buildDuration = max(1, this.audioDuration - buildStart);
    return constrain((this.audioElement.currentTime - buildStart) / buildDuration + 0.015, 0, 1);
  }

  getRoadDeadlineSeconds() {
    if (!this.hasTrackDuration()) return 24;
    return constrain(this.audioDuration * this.roadDurationRatio, 12, 45);
  }

  isNearTrackEnd(cityState) {
    if (!this.hasTrackDuration()) return false;
    return this.audioDuration - this.audioElement.currentTime < 10 && !this.isGenerationComplete(cityState);
  }

  isGenerationComplete(cityState) {
    return cityState.generationPhase !== 'roads' && cityState.buildings.length >= cityState.maxBuildings;
  }

  hasTrackDuration() {
    return Number.isFinite(this.audioDuration) && this.audioDuration > 0;
  }

  updateHud(cityState) {
    this.updateProgressDisplay(cityState);
    if (!this.stats) return;
    const label = cityState.timeLabel || 'Day';
    const audioLabel =
      cityState.audioSnapshot && cityState.audioSnapshot.dominant !== 'none'
        ? ` | Audio: ${cityState.audioSnapshot.dominant}`
        : '';

    if (cityState.generationPhase === 'roads') {
      this.stats.textContent = `Time: ${label}${audioLabel}`;
      return;
    }
    const capacityLabel = cityState.lotsExhausted ? ' | Lots full' : '';
    this.stats.textContent = `Time: ${label}${audioLabel}${capacityLabel}`;
  }

  updateProgressDisplay(cityState) {
    this.updateTrackProgress();
    this.updateCityProgress(cityState);
  }

  updateTrackProgress() {
    if (!this.trackProgressFill || !this.trackProgressText) return;

    const currentSeconds = this.audioElement ? this.audioElement.currentTime || 0 : 0;
    const durationSeconds = this.hasTrackDuration() ? this.audioDuration : 0;
    const percent = durationSeconds > 0 ? (currentSeconds / durationSeconds) * 100 : 0;

    this.setProgressWidth(this.trackProgressFill, percent);
    this.trackProgressText.textContent = `${this.formatTime(currentSeconds)} / ${this.formatTime(durationSeconds)}`;
  }

  updateCityProgress(cityState) {
    if (!this.cityProgressFill || !this.cityProgressText || !cityState) return;

    const roadTarget = Math.max(1, cityState.plannedStreetTarget || 1);
    const roadProgress = Math.min(1, cityState.roadTiles.size / roadTarget);

    if (cityState.generationPhase === 'roads') {
      this.setProgressWidth(this.cityProgressFill, roadProgress * 25);
      this.cityProgressText.textContent = `Planning streets ${cityState.roadTiles.size}/${cityState.plannedStreetTarget || 0}`;
      return;
    }

    const buildingTarget = Math.max(1, cityState.maxBuildings || 1);
    const buildingProgress = Math.min(1, cityState.buildings.length / buildingTarget);
    const fullCityProgress = 25 + buildingProgress * 75;
    const fullLabel = cityState.lotsExhausted ? ' lots full' : '';

    this.setProgressWidth(this.cityProgressFill, fullCityProgress);
    this.cityProgressText.textContent = `Constructing buildings ${cityState.buildings.length}/${cityState.maxBuildings}${fullLabel}`;
  }

  setProgressWidth(element, percent) {
    const safePercent = Math.max(0, Math.min(100, percent));
    element.style.width = `${safePercent.toFixed(1)}%`;
    element.parentElement?.setAttribute('aria-valuenow', safePercent.toFixed(0));
  }

  emptySnapshot() {
    return {
      level: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      strength: 0,
      seconds: 0,
      timeLabel: '00:00',
      dominant: 'none',
    };
  }

  formatTime(seconds) {
    const mins = floor(seconds / 60);
    const secs = floor(seconds % 60);
    return `${nf(mins, 2)}:${nf(secs, 2)}`;
  }

  getDominantBand(bass, mid, treble) {
    const bassScore = bass * 0.85;
    const midScore = mid * 1.1;
    const trebleScore = treble * 1.35;

    if (bassScore >= midScore && bassScore >= trebleScore) return 'bass';
    if (midScore >= bassScore && midScore >= trebleScore) return 'mid';
    return 'treble';
  }
}
