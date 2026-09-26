// Procedural sound effects + generative music via Web Audio API.
// Every sound is synthesized (oscillators + noise), so it loads instantly
// with zero network cost — perfect for a browser game with a lot of maps.

class SoundFX {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.volume = 1.0;      // master effects volume
    this.musicVolume = 0.35; // music sits lower than effects
    // Music state (see startMusic / stopMusic)
    this._music = null;
  }

  // Lazily create/resume the AudioContext (browsers require a user gesture)
  _ensure() {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        // Master effects bus (music has its own bus below)
        this._sfxGain = this.ctx.createGain();
        this._sfxGain.gain.value = 1;
        this._sfxGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch (e) {
      return null;
    }
  }

  // Simple oscillator note with a gain envelope
  _tone(type, f0, f1, t0, dur, vol) {
    const ctx = this._ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    const start = ctx.currentTime + (t0 || 0);
    osc.frequency.setValueAtTime(f0, start);
    if (f1 !== null && f1 !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), start + dur);
    }
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime((vol || 0.3) * this.volume, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this._sfxGain || ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  // Short filtered noise burst (footsteps, brush strokes)
  _noise(dur, filterFreq, vol, t0) {
    const ctx = this._ensure();
    if (!ctx) return;
    const start = ctx.currentTime + (t0 || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 800;
    const g = ctx.createGain();
    g.gain.setValueAtTime((vol || 0.2) * this.volume, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(g).connect(this._sfxGain || ctx.destination);
    src.start(start);
  }

  // ======================= Effect sounds =======================

  // 🔫 Laser: fast downward pew
  laser() {
    this._tone('sawtooth', 950, 160, 0, 0.22, 0.45);
    this._tone('square', 1400, 300, 0, 0.12, 0.22);
  }

  // 👣 Footstep: soft thump, pitch alternates left/right. Seekers hear hiders
  // moving nearby, quieter the further away they are.
  footstep(alt, vol) {
    this._noise(0.07, alt ? 500 : 380, vol === undefined ? 0.4 : vol);
  }

  // 💓 Heartbeat: thump-thump, louder and tighter as danger (0..1) rises
  heartbeat(danger) {
    const v = 0.16 + (danger || 0) * 0.5;
    this._tone('sine', 62, 40, 0, 0.13, v);
    this._tone('sine', 58, 36, 0.17, 0.11, v * 0.7);
  }

  // 🦘 Jump: rising boing
  jump() {
    this._tone('sine', 260, 680, 0, 0.18, 0.3);
  }

  // Landing thump
  land() {
    this._tone('sine', 150, 60, 0, 0.12, 0.35);
    this._noise(0.06, 300, 0.15);
  }

  // 🎨 Brush stroke swish
  paint() {
    this._noise(0.09, 1600, 0.2);
  }

  // 💉 Eyedropper suck: quick up-chirp pop
  suck() {
    this._tone('sine', 300, 900, 0, 0.15, 0.3);
    this._tone('sine', 900, 1300, 0.12, 0.08, 0.2);
  }

  // 🚨 Siren "wee-woo" when a hidden target is found
  siren(cycles) {
    const n = cycles || 3;
    for (let i = 0; i < n; i++) {
      this._tone('square', 880, 870, i * 0.5, 0.24, 0.35);       // wee
      this._tone('square', 620, 610, i * 0.5 + 0.25, 0.24, 0.35); // woo
    }
  }

  // ✅ Correct answer: two rising notes
  correct() {
    this._tone('sine', 523, 524, 0, 0.14, 0.3);      // C5
    this._tone('sine', 784, 786, 0.15, 0.22, 0.3);   // G5
  }

  // ❌ Wrong answer: low buzz
  wrong() {
    this._tone('sawtooth', 220, 140, 0, 0.3, 0.2);
  }

  // 🎡 Pose change whoosh
  whoosh() {
    this._noise(0.14, 900, 0.3);
  }

  // ======================= New effect sounds =======================

  // 🖱️ Menu click / UI button tap
  click() {
    this._tone('square', 620, 780, 0, 0.05, 0.15);
  }

  // ✨ Menu hover / open picker
  hover() {
    this._tone('sine', 480, 900, 0, 0.08, 0.12);
  }

  // 🔓 Power/color unlocked: sparkly ascending arpeggio
  unlock() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone('triangle', f, f, i * 0.06, 0.18, 0.25));
    this._noise(0.35, 8000, 0.08);
  }

  // ⏰ Countdown tick (used by the last-10s clock)
  tick() {
    this._tone('square', 1200, 1200, 0, 0.05, 0.18);
  }

  // ⏳ Phase change fanfare when the hunt begins
  huntStart() {
    this._tone('sawtooth', 220, 220, 0, 0.15, 0.35);
    this._tone('sawtooth', 330, 330, 0.15, 0.15, 0.35);
    this._tone('sawtooth', 440, 440, 0.3, 0.35, 0.4);
    this._noise(0.25, 500, 0.2, 0.28);
  }

  // 💀 Caught fanfare (played when the LOCAL player is tagged)
  caught() {
    this._tone('sawtooth', 440, 110, 0, 0.6, 0.4);
    this._tone('square', 220, 55, 0.15, 0.5, 0.3);
    this._noise(0.3, 400, 0.25, 0.2);
  }

  // 🏆 Victory jingle at game end
  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this._tone('triangle', f, f, i * 0.12, 0.4, 0.35));
    this._tone('sine', 1568, 1568, 0.7, 0.6, 0.3);
  }

  // 😢 Defeat jingle at game end
  defeat() {
    [523, 494, 466, 415, 349].forEach((f, i) =>
      this._tone('triangle', f, f, i * 0.18, 0.35, 0.3));
  }

  // 💥 Impact / bump when you run into a wall (throttled by the caller)
  bump() {
    this._tone('sine', 90, 45, 0, 0.09, 0.2);
    this._noise(0.05, 220, 0.12);
  }

  // 🎈 Room-joined pop (welcome another player)
  pop() {
    this._tone('sine', 660, 990, 0, 0.1, 0.22);
  }

  // 👤 Someone left the room
  leave() {
    this._tone('sine', 620, 340, 0, 0.15, 0.2);
  }

  // 🧗 Climb tick (each rung, throttled)
  climb() {
    this._tone('sine', 380, 460, 0, 0.06, 0.15);
    this._noise(0.05, 700, 0.08);
  }

  // 🎯 Aim lock chime (when the crosshair snaps onto a hider)
  lock() {
    this._tone('square', 1400, 1600, 0, 0.06, 0.18);
  }

  // 💨 Shot missed (short air whiff, for feedback when the laser hits nothing)
  swish() {
    this._noise(0.12, 2400, 0.14);
  }

  // 🌀 Dimension-jump cutscene: portal opening → charging → warp zap → flash.
  // ~2.4s total, layered to sync with the CSS portal animation. Returns the
  // total duration in seconds so the caller can schedule the visual fade-out.
  dimensionJump() {
    const ctx = this._ensure();
    if (!ctx) return 2.4;
    // Portal opening rumble (low sine sweep + noise wash)
    this._tone('sine', 60, 220, 0, 0.9, 0.35);
    this._noise(1.2, 1200, 0.18);
    // Charging: rising sawtooth arpeggio
    [220, 330, 440, 550, 660, 770].forEach((f, i) =>
      this._tone('sawtooth', f, f * 1.1, 0.15 + i * 0.09, 0.22, 0.22));
    // The zap that snaps you across
    this._tone('square', 1200, 220, 0.9, 0.35, 0.4);
    this._noise(0.4, 4000, 0.35, 0.9);
    // Arrival chime: bright triad ringing out on the other side
    [784, 988, 1319, 1568].forEach((f, i) =>
      this._tone('triangle', f, f, 1.6 + i * 0.05, 0.6, 0.28));
    // Landing thump so it feels like your feet touch a new floor
    this._tone('sine', 140, 60, 2.05, 0.2, 0.4);
    return 2.4;
  }

  // ======================= Generative background music =======================

  // Start a light generative track. Each map has its own mood (scale, tempo,
  // pad colour) so switching maps feels like a new place. Idempotent —
  // calling with the same mapId does nothing.
  startMusic(mapId) {
    const ctx = this._ensure();
    if (!ctx) return;
    if (this._music && this._music.mapId === mapId) return;
    this.stopMusic();

    // Per-map moods. Scale is an array of semitone offsets from the tonic;
    // pad is a background chord swell, tempo controls the pulse.
    const MOODS = {
      meadow:    { key: 65, scale: [0,2,4,7,9,12,14],  tempo: 92,  pad: 'triangle', drums: true  }, // F major pentatonic-ish
      forest:    { key: 62, scale: [0,3,5,7,10,12,14], tempo: 78,  pad: 'triangle', drums: true  }, // D minor
      desert:    { key: 67, scale: [0,2,4,5,7,9,11,12],tempo: 88,  pad: 'sawtooth', drums: true  }, // G major
      snow:      { key: 60, scale: [0,2,4,7,9,12,14],  tempo: 72,  pad: 'sine',     drums: false }, // C major, quiet
      city:      { key: 62, scale: [0,3,5,6,7,10,12],  tempo: 108, pad: 'sawtooth', drums: true  }, // D blues, groovy
      ocean:     { key: 65, scale: [0,2,5,7,9,12,14],  tempo: 68,  pad: 'sine',     drums: false }, // dreamy pentatonic
      space:     { key: 60, scale: [0,3,7,10,12,15],   tempo: 74,  pad: 'sine',     drums: false }, // C minor pentatonic, ethereal
      volcano:   { key: 55, scale: [0,3,5,6,7,10,12],  tempo: 96,  pad: 'sawtooth', drums: true  }, // G minor blues, intense
      farm:      { key: 67, scale: [0,2,4,7,9,12,14],  tempo: 100, pad: 'triangle', drums: true  }, // G major, cheerful
      village:   { key: 65, scale: [0,2,4,5,7,9,11,12],tempo: 96,  pad: 'triangle', drums: true  }, // F major
      mansion:   { key: 60, scale: [0,2,3,5,7,8,11,12],tempo: 80,  pad: 'triangle', drums: false }, // C harmonic minor, elegant
      nighttown: { key: 57, scale: [0,1,3,5,7,8,10,12],tempo: 66,  pad: 'sawtooth', drums: false }, // A phrygian-ish, creepy
      classroom: { key: 67, scale: [0,2,4,7,9,12,14],  tempo: 96,  pad: 'triangle', drums: true  },
      school:    { key: 67, scale: [0,2,4,7,9,12,14],  tempo: 96,  pad: 'triangle', drums: true  },
      hallway:   { key: 60, scale: [0,2,3,5,7,8,11,12],tempo: 76,  pad: 'triangle', drums: false },
      laundry:   { key: 60, scale: [0,2,3,5,7,8,11,12],tempo: 78,  pad: 'sawtooth', drums: false },
      mall:      { key: 62, scale: [0,3,5,6,7,10,12],  tempo: 110, pad: 'sawtooth', drums: true  },
      castle:    { key: 55, scale: [0,2,3,5,7,8,11,12],tempo: 74,  pad: 'triangle', drums: false },
      shopstreet:{ key: 65, scale: [0,2,4,5,7,9,11,12],tempo: 98,  pad: 'triangle', drums: true  }
    };
    const mood = MOODS[mapId] || MOODS.meadow;

    // Music bus with global music volume
    const musicGain = ctx.createGain();
    musicGain.gain.value = this.musicVolume;
    musicGain.connect(ctx.destination);

    const beat = 60 / mood.tempo;
    // Convert MIDI note -> Hz
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    // Pluck: a soft envelope on a triangle wave, feels like a marimba/harp
    const pluck = (freq, at, dur, vol) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = at;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(musicGain);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    };
    // Pad: slow swell that holds a chord (3 notes)
    const pad = (rootMidi, at, dur, vol) => {
      const chord = [0, 4, 7]; // major triad by default
      chord.forEach(step => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = mood.pad || 'triangle';
        osc.frequency.value = midi(rootMidi + step);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(vol, at + dur * 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(g).connect(musicGain);
        osc.start(at);
        osc.stop(at + dur + 0.05);
      });
    };
    // Kick: a bass thump
    const kick = (at) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(120, at);
      osc.frequency.exponentialRampToValueAtTime(40, at + 0.08);
      g.gain.setValueAtTime(0.35, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      osc.connect(g).connect(musicGain);
      osc.start(at);
      osc.stop(at + 0.15);
    };
    // Hi-hat: tiny noise tick on the off-beat
    const hat = (at) => {
      const len = Math.floor(ctx.sampleRate * 0.03);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 6000;
      const g = ctx.createGain(); g.gain.value = 0.15;
      src.connect(f).connect(g).connect(musicGain);
      src.start(at);
    };

    // Scheduler runs every 200ms, pushes notes ~1s ahead so timing is tight
    const state = { mapId, musicGain, bar: 0, nextAt: ctx.currentTime + 0.15, timer: null };
    const scheduleAhead = () => {
      const horizon = ctx.currentTime + 1.2;
      while (state.nextAt < horizon) {
        const t = state.nextAt;
        // A "bar" = 8 half-beats (eighth notes)
        for (let step = 0; step < 8; step++) {
          const at = t + step * beat / 2;
          // Melody: pick a note from the scale, with rests for space
          if (Math.random() < 0.7) {
            const scale = mood.scale;
            const octave = Math.random() < 0.25 ? 12 : 0;
            const note = mood.key + scale[Math.floor(Math.random() * scale.length)] + octave;
            pluck(midi(note), at, 0.4, 0.18);
          }
          // Bass on the down-beat
          if (step === 0 || step === 4) pluck(midi(mood.key - 12), at, 0.5, 0.15);
          // Drums (skipped for quiet maps)
          if (mood.drums) {
            if (step === 0 || step === 4) kick(at);
            if (step % 2 === 1) hat(at);
          }
        }
        // Pad swell over the whole bar
        pad(mood.key + 12, t, beat * 4, 0.05);
        state.nextAt += beat * 4; // one bar advanced
        state.bar++;
      }
    };
    scheduleAhead();
    state.timer = setInterval(scheduleAhead, 200);
    this._music = state;
  }

  stopMusic() {
    if (!this._music) return;
    if (this._music.timer) clearInterval(this._music.timer);
    // Fade the music bus out over 300ms to avoid a click
    try {
      const ctx = this.ctx;
      const g = this._music.musicGain;
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 400);
    } catch (e) { /* ignore */ }
    this._music = null;
  }

  // Player toggled the sound button: mute/unmute both music and sfx
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopMusic();
    return this.enabled;
  }
}

// Global sound effects instance
const soundFX = new SoundFX();
