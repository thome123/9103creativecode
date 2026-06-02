// Audio mechanic generated with help from ChatGPT/Codex.
// It uses p5.sound FFT/Amplitude to trigger city-building events from an uploaded track.
class AudioMechanic {
  constructor() {
    this.soundFile = null;
    this.fft = null;
    this.amplitude = null;
    this.ready = false;
    this.requests = [];
    this.lastBuildFrame = 0;
    this.minBuildFrames = 34;
    this.snapshot = this.emptySnapshot();
  }

  setup(cityState) {
    this.status = document.getElementById('audioStatus');
    this.stats = document.getElementById('cityStats');
    this.chooseAudio = document.getElementById('chooseAudio');
    this.playPause = document.getElementById('playPause');
    this.audioInput = document.getElementById('audioInput');

    if (typeof p5.FFT !== 'function' || typeof loadSound !== 'function') {
      this.status.textContent = 'p5.sound failed to load.';
      this.chooseAudio.disabled = true;
      return;
    }

    this.fft = new p5.FFT(0.82, 1024);
    this.amplitude = new p5.Amplitude(0.82);
    this.chooseAudio.addEventListener('click', () => this.audioInput.click());
    this.audioInput.addEventListener('change', (event) => this.loadAudio(event));
    this.playPause.addEventListener('click', async () => this.togglePlayback());
  }

  loadAudio(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (this.soundFile) {
      this.soundFile.stop();
    }

    this.ready = false;
    this.playPause.disabled = true;
    this.playPause.textContent = 'Play';
    this.status.textContent = `Loading ${file.name}...`;

    const reader = new FileReader();
    reader.onload = () => {
      loadSound(
        reader.result,
        (loadedSound) => {
          this.soundFile = loadedSound;
          this.soundFile.setVolume(0.88);
          this.soundFile.onended(() => {
            this.playPause.textContent = 'Play';
            this.status.textContent = 'Audio ended.';
          });
          this.fft.setInput(this.soundFile);
          this.amplitude.setInput(this.soundFile);
          this.ready = true;
          this.playPause.disabled = false;
          this.status.textContent = `Loaded: ${file.name}`;
        },
        () => {
          this.status.textContent = 'Could not load this audio file.';
        }
      );
    };
    reader.readAsDataURL(file);
  }

  async togglePlayback() {
    if (!this.ready || !this.soundFile) return;
    if (typeof userStartAudio === 'function') {
      await userStartAudio();
    }

    if (this.soundFile.isPlaying()) {
      this.soundFile.pause();
      this.playPause.textContent = 'Play';
      this.status.textContent = 'Audio paused.';
    } else {
      this.soundFile.play();
      this.playPause.textContent = 'Pause';
      this.status.textContent = 'Audio is generating the city.';
    }
  }

  update(cityState) {
    if (!this.ready || !this.soundFile || !this.soundFile.isPlaying()) {
      this.snapshot = this.emptySnapshot();
      cityState.audioSnapshot = this.snapshot;
      return;
    }

    this.fft.analyze();
    const level = this.amplitude.getLevel();
    const bass = this.fft.getEnergy('bass');
    const mid = this.fft.getEnergy('mid');
    const treble = this.fft.getEnergy('treble');
    const seconds = this.soundFile.currentTime();
    const strength = constrain(level * 3.2 + (bass + mid + treble) / 900, 0, 1.4);

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

    if (frameCount - this.lastBuildFrame >= this.minBuildFrames && cityState.buildings.length < cityState.maxBuildings) {
      const chance = constrain(0.18 + strength * 0.58, 0.18, 0.9);
      if (random() < chance) {
        this.requests.push({ ...this.snapshot });
        this.lastBuildFrame = frameCount;
      }
    }
  }

  consumeBuildRequests() {
    const pending = [...this.requests];
    this.requests.length = 0;
    return pending;
  }

  updateHud(cityState) {
    if (!this.stats) return;
    const label = cityState.timeLabel || 'Day';
    this.stats.textContent = `Buildings: ${cityState.buildings.length}/${cityState.maxBuildings} | Time: ${label}`;
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
    if (bass >= mid && bass >= treble) return 'bass';
    if (mid >= bass && mid >= treble) return 'mid';
    return 'treble';
  }
}
