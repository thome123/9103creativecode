// Audio mechanic generated with help from ChatGPT/Codex.
// It uses p5.sound to extract level/frequency data from an uploaded track.
// Frequency analysis follows the p5.FFT and p5.Amplitude references:
// https://p5js.org/reference/p5.FFT/
// https://p5js.org/reference/p5.Amplitude/
// Principle: p5.FFT separates music into frequency bands, while p5.Amplitude reads overall loudness.
// p5.sound is loaded here so this mechanic can follow the Week 12 p5 sound workflow
// without changing index.html or the other mechanic files.
if (typeof p5 !== 'undefined' && !(p5.FFT && p5.Amplitude && typeof loadSound === 'function')) {
  document.write('<script src="https://cdn.jsdelivr.net/npm/p5@1.9.3/lib/addons/p5.sound.min.js"><\\/script>');
}

class AudioMechanic {
  // Store all audio, UI, and generation pacing state inside one mechanic object.
  // This keeps the audio responsibility separate from the shared sketch renderer.
  constructor() {
    this.soundFile = null;
    this.soundUrl = '';
    this.fft = null;
    this.amplitude = null;
    this.p5SoundPromise = null;
    this.p5SoundReady = false;
    this.loadingSound = false;
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

  // Connect the audio mechanic to the shared city state and to the HTML controls.
  // The sketch passes in resetCity so the audio file can restart the generated map cleanly.
  setup(cityState, resetCity) {
    this.cityState = cityState;
    this.status = document.getElementById('audioStatus');
    this.stats = document.getElementById('cityStats');
    this.chooseAudio = document.getElementById('chooseAudio');
    this.playPause = document.getElementById('playPause');
    this.clearCity = document.getElementById('clearCity');
    this.audioInput = document.getElementById('audioInput');
    this.trackProgressFill = document.getElementById('trackProgressFill');
    this.trackProgressText = document.getElementById('trackProgressText');
    this.cityProgressFill = document.getElementById('cityProgressFill');
    this.cityProgressText = document.getElementById('cityProgressText');
    this.resetCity = resetCity;

    if (typeof p5 === 'undefined') {
      this.status.textContent = 'p5.js is required before the audio mechanic can run.';
      this.chooseAudio.disabled = true;
      return;
    }

    this.chooseAudio.disabled = true;
    this.status.textContent = 'Loading p5.sound...';
    this.ensureP5SoundLibrary()
      .then(() => {
        this.chooseAudio.disabled = false;
        this.status.textContent = 'No audio loaded.';
      })
      .catch(() => {
        this.status.textContent = 'p5.sound could not be loaded. Check the internet connection.';
        this.chooseAudio.disabled = true;
      });

    this.chooseAudio.addEventListener('click', () => this.audioInput.click());
    this.audioInput.addEventListener('change', (event) => this.loadAudio(event));
    this.playPause.addEventListener('click', async () => this.togglePlayback());
    this.clearCity.addEventListener('click', () => this.clearGeneratedCity());
  }

  // Load a local audio file selected by the user.
  // URL.createObjectURL() lets the browser play the file without uploading it anywhere.
  async loadAudio(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      await this.ensureP5SoundLibrary();
    } catch (error) {
      this.status.textContent = 'p5.sound could not be loaded. Try again with internet access.';
      return;
    }

    if (this.soundFile) {
      this.soundFile.stop();
    }
    if (this.soundUrl) {
      URL.revokeObjectURL(this.soundUrl);
    }

    this.resetGenerationState();
    this.audioDuration = 0;
    this.currentFileName = file.name;
    this.ready = false;
    this.loadingSound = true;
    this.playPause.disabled = true;
    this.playPause.textContent = 'Play';
    this.status.textContent = `Loading: ${file.name}`;
    if (typeof this.resetCity === 'function') {
      this.resetCity();
    }

    this.soundUrl = URL.createObjectURL(file);
    this.soundFile = loadSound(
      this.soundUrl,
      (loadedSound) => {
        this.soundFile = loadedSound || this.soundFile;
        this.loadingSound = false;
        this.ready = true;
        this.configureP5Analyzers();
        this.updateAudioDuration();
        this.playPause.disabled = false;
        this.playPause.textContent = 'Play';
        if (this.soundFile && typeof this.soundFile.onended === 'function') {
          this.soundFile.onended(() => {
            this.playPause.textContent = 'Play';
            this.status.textContent = 'Audio ended.';
          });
        }
      },
      () => {
        this.loadingSound = false;
        this.ready = false;
        this.playPause.disabled = true;
        this.status.textContent = 'Audio failed to load. Try another file.';
      },
    );
    this.updateProgressDisplay(this.cityState);
  }

  // Start or pause playback. Browsers require this to happen after a user action,
  // so the audio context is created only when the user presses Play.
  async togglePlayback() {
    if (!this.ready || this.loadingSound || !this.soundFile) return;
    await this.ensureP5Audio();

    if (!this.soundFile.isPlaying()) {
      try {
        if (this.hasTrackDuration() && this.getCurrentTime() >= this.audioDuration - 0.05) {
          this.soundFile.stop();
        }
        this.soundFile.play();
        this.playPause.textContent = 'Pause';
        this.status.textContent = 'Audio is generating the city.';
      } catch (error) {
        this.status.textContent = 'Playback failed. Try another audio file.';
      }
    } else {
      this.soundFile.pause();
      this.playPause.textContent = 'Play';
      this.status.textContent = 'Audio paused.';
    }
  }

  // Clear queued generation requests and return the audio analysis snapshot to silence.
  // This is used both when a new file loads and when the city is manually cleared.
  resetGenerationState() {
    this.requests.length = 0;
    this.lastBuildFrame = 0;
    this.buildPhaseStartSeconds = null;
    this.snapshot = this.emptySnapshot();
  }

  // Once metadata is available, read the track duration and resize the city target.
  // This prevents a short track and a long track from generating the same amount of city.
  updateAudioDuration() {
    if (!this.soundFile || typeof this.soundFile.duration !== 'function') return;

    this.audioDuration = this.soundFile.duration();
    if (!Number.isFinite(this.audioDuration)) return;
    this.applyDynamicBuildTarget();
    this.updateProgressDisplay(this.cityState);
    if (this.currentFileName) {
      this.status.textContent = `Loaded: ${this.currentFileName} (${this.formatTime(this.audioDuration)}) | Target: ${this.cityState.maxBuildings} buildings`;
    }
  }

  // Reset the visual city while keeping the currently selected audio file available.
  // This lets the viewer replay the same track and watch the city grow again.
  clearGeneratedCity() {
    if (this.soundFile) {
      this.soundFile.stop();
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

  // Load the p5.sound addon without changing index.html.
  // This keeps the project structure stable while still using the Week 12 p5.sound workflow.
  ensureP5SoundLibrary() {
    if (this.hasP5Sound()) {
      this.p5SoundReady = true;
      return Promise.resolve();
    }

    if (this.p5SoundPromise) return this.p5SoundPromise;

    this.p5SoundPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-p5-sound="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (this.hasP5Sound()) {
            this.p5SoundReady = true;
            resolve();
          } else {
            reject(new Error('p5.sound script loaded without expected globals.'));
          }
        });
        existingScript.addEventListener('error', reject);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/p5@1.9.3/lib/addons/p5.sound.min.js';
      script.async = true;
      script.dataset.p5Sound = 'true';
      script.addEventListener('load', () => {
        setTimeout(() => {
          if (this.hasP5Sound()) {
            this.p5SoundReady = true;
            resolve();
          } else {
            reject(new Error('p5.sound loaded but did not expose p5.FFT/loadSound.'));
          }
        }, 0);
      });
      script.addEventListener('error', reject);
      document.head.appendChild(script);
    });

    return this.p5SoundPromise;
  }

  // Check for the p5.sound features used in this mechanic.
  // This mirrors the Week 12 tools: loadSound(), p5.FFT, and p5.Amplitude.
  hasP5Sound() {
    return typeof p5 !== 'undefined' && p5.FFT && p5.Amplitude && typeof loadSound === 'function';
  }

  // Create the p5.FFT and p5.Amplitude objects used in the Week 12 audio lecture.
  // FFT reads frequency bands; Amplitude reads the overall loudness level.
  configureP5Analyzers() {
    if (!this.soundFile || !this.p5SoundReady || !this.hasP5Sound()) return;

    this.fft = new p5.FFT(0.82, 256);
    this.amplitude = new p5.Amplitude(0.82);
    this.fft.setInput(this.soundFile);
    this.amplitude.setInput(this.soundFile);
  }

  // Start the p5 audio context after a user gesture, matching browser autoplay rules from Week 12.
  async ensureP5Audio() {
    await this.ensureP5SoundLibrary();
    if (typeof userStartAudio === 'function') {
      await userStartAudio();
    }

    if (!this.fft || !this.amplitude) {
      this.configureP5Analyzers();
    }
  }

  // AI-assisted: converts raw frequency bins into a compact audio snapshot used by the city generator.
  // The snapshot is the bridge between sound and visuals: it records level, bass, mid,
  // treble, timestamp, and dominant band for the next street or building event.
  update(cityState) {
    if (!this.ready || !this.soundFile || !this.fft || !this.amplitude || !this.soundFile.isPlaying()) {
      this.snapshot = this.emptySnapshot();
      cityState.audioSnapshot = this.snapshot;
      return;
    }

    this.fft.analyze();
    const level = this.amplitude.getLevel();
    const bass = this.fft.getEnergy('bass');
    const mid = this.fft.getEnergy('mid');
    const treble = this.fft.getEnergy('treble');
    const seconds = this.getCurrentTime();
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

  // Give the shared sketch any build requests created during update().
  // The sketch consumes these requests so audio controls timing but does not draw buildings directly.
  consumeBuildRequests() {
    const pending = [...this.requests];
    this.requests.length = 0;
    return pending;
  }

  // Remember when the project changes from street planning to building construction.
  // The remaining audio duration is then used to pace the building phase.
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

  // Convert track length into an approximate city size.
  // Longer music can support a larger city because there is more time for generation.
  getDurationBuildingTarget() {
    const seconds = this.audioDuration;
    if (seconds < 75) return round(map(seconds, 30, 75, 42, 62));
    if (seconds < 180) return round(map(seconds, 75, 180, 62, 96));
    if (seconds < 360) return round(map(seconds, 180, 360, 96, 128));
    return this.maxDynamicBuildings;
  }

  // Estimate the maximum useful building count based on available planned lots.
  // This keeps the target realistic instead of asking the city to build in blocked spaces.
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
      const remainingFrames = max(1, (roadDeadline - this.getCurrentTime()) * 60);
      return floor(constrain(remainingFrames / remainingRequests, 12, 54));
    }

    const remainingBuildings = max(1, cityState.maxBuildings - cityState.buildings.length);
    const remainingFrames = max(1, (this.audioDuration - this.getCurrentTime()) * 60);
    return floor(constrain(remainingFrames / remainingBuildings, 14, 126));
  }

  // AI-assisted: compares expected progress with real city progress and triggers catch-up growth when needed.
  getScheduleLag(cityState) {
    if (!this.hasTrackDuration()) return 0;

    if (cityState.generationPhase === 'roads') {
      const roadProgress = cityState.plannedStreetTarget > 0 ? cityState.roadTiles.size / cityState.plannedStreetTarget : 1;
      const targetRoadProgress = constrain(this.getCurrentTime() / this.getRoadDeadlineSeconds(), 0, 1);
      return targetRoadProgress - roadProgress;
    }

    const buildingProgress = cityState.maxBuildings > 0 ? cityState.buildings.length / cityState.maxBuildings : 1;
    const targetBuildingProgress = this.getBuildingTargetProgress(cityState);
    return targetBuildingProgress - buildingProgress;
  }

  // Expected building progress after the road phase.
  // A small lead-in offset keeps generation from feeling like it starts too late.
  getBuildingTargetProgress(cityState) {
    if (!this.hasTrackDuration()) return 1;
    if (cityState.generationPhase === 'roads') return 0;

    const buildStart = this.buildPhaseStartSeconds ?? this.getRoadDeadlineSeconds();
    const buildDuration = max(1, this.audioDuration - buildStart);
    return constrain((this.getCurrentTime() - buildStart) / buildDuration + 0.015, 0, 1);
  }

  // Roads are generated near the start of the track so the city has structure first.
  // The cap avoids spending too much of a long song on streets only.
  getRoadDeadlineSeconds() {
    if (!this.hasTrackDuration()) return 24;
    return constrain(this.audioDuration * this.roadDurationRatio, 12, 45);
  }

  // Near the end, generation becomes less selective so the city can finish with the music.
  isNearTrackEnd(cityState) {
    if (!this.hasTrackDuration()) return false;
    return this.audioDuration - this.getCurrentTime() < 10 && !this.isGenerationComplete(cityState);
  }

  // A complete city has finished road planning and reached its dynamic building target.
  isGenerationComplete(cityState) {
    return cityState.generationPhase !== 'roads' && cityState.buildings.length >= cityState.maxBuildings;
  }

  // Audio duration is only trusted after p5.sound has loaded the SoundFile.
  hasTrackDuration() {
    return Number.isFinite(this.audioDuration) && this.audioDuration > 0;
  }

  // Read the playback position from p5.SoundFile.
  getCurrentTime() {
    if (!this.soundFile || typeof this.soundFile.currentTime !== 'function') return 0;
    return this.soundFile.currentTime();
  }

  // Update the small text readout beside the controls without changing the canvas.
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

  // Keep both progress bars in sync with the actual track and city state.
  updateProgressDisplay(cityState) {
    this.updateTrackProgress();
    this.updateCityProgress(cityState);
  }

  // Track progress is purely time-based.
  updateTrackProgress() {
    if (!this.trackProgressFill || !this.trackProgressText) return;

    const currentSeconds = this.getCurrentTime();
    const durationSeconds = this.hasTrackDuration() ? this.audioDuration : 0;
    const percent = durationSeconds > 0 ? (currentSeconds / durationSeconds) * 100 : 0;

    this.setProgressWidth(this.trackProgressFill, percent);
    this.trackProgressText.textContent = `${this.formatTime(currentSeconds)} / ${this.formatTime(durationSeconds)}`;
  }

  // City progress uses 25% of the bar for streets and 75% for buildings.
  // This matches the intended sequence: plan the city first, then develop it.
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

  // Clamp a progress value before writing it to CSS and accessibility metadata.
  setProgressWidth(element, percent) {
    const safePercent = Math.max(0, Math.min(100, percent));
    element.style.width = `${safePercent.toFixed(1)}%`;
    element.parentElement?.setAttribute('aria-valuenow', safePercent.toFixed(0));
  }

  // Default snapshot used when no audio is playing.
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

  // Format seconds as MM:SS for the UI and for each building archive record.
  formatTime(seconds) {
    const mins = floor(seconds / 60);
    const secs = floor(seconds % 60);
    return `${nf(mins, 2)}:${nf(secs, 2)}`;
  }

  // Weight the bands so mid and treble are not overwhelmed by bass-heavy music.
  // The result becomes a readable label saved into each generated building.
  getDominantBand(bass, mid, treble) {
    const bassScore = bass * 0.85;
    const midScore = mid * 1.1;
    const trebleScore = treble * 1.35;

    if (bassScore >= midScore && bassScore >= trebleScore) return 'bass';
    if (midScore >= bassScore && midScore >= trebleScore) return 'mid';
    return 'treble';
  }
}
