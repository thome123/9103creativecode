// Audio mechanic generated with help from ChatGPT/Codex.
// It uses the Web Audio API AnalyserNode to extract level/frequency data from an uploaded track.
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
    this.minBuildFrames = 96;
    this.snapshot = this.emptySnapshot();
  }

  setup(cityState) {
    this.status = document.getElementById('audioStatus');
    this.stats = document.getElementById('cityStats');
    this.chooseAudio = document.getElementById('chooseAudio');
    this.playPause = document.getElementById('playPause');
    this.audioInput = document.getElementById('audioInput');
    this.audioElement = document.getElementById('audioPlayer');
    this.AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!this.audioElement || !this.AudioContextClass) {
      this.status.textContent = 'This browser does not support the required audio analyser.';
      this.chooseAudio.disabled = true;
      return;
    }

    this.chooseAudio.addEventListener('click', () => this.audioInput.click());
    this.audioInput.addEventListener('change', (event) => this.loadAudio(event));
    this.playPause.addEventListener('click', async () => this.togglePlayback());
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
    this.audioElement.src = URL.createObjectURL(file);
    this.audioElement.load();
    this.ready = true;
    this.playPause.disabled = false;
    this.playPause.textContent = 'Play';
    this.status.textContent = `Loaded: ${file.name}`;
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
      const chance = constrain(0.28 + strength * 0.48, 0.28, 0.82);
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
