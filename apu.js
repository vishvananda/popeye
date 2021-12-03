const SMath = require("smath");
class APU {
  constructor(rate) {
    this.bitDepth = 16;
    this.channels = 1;
    this.samples = 0;
    this.rate = rate;
    this.harmonics = 20; // more harmonics is more accurate square wave
    this.outAmp = 32760; // Max amplitude for 16-bit audio
    // the frequency to play
    // the "angle" used in the function, adjusted for the number of
    // channels and sample rate. This value is like the period of the wave.
    // this.t = (Math.PI * 2 * this.freq) / this.rate;
    this.sMath = new SMath();
    this.time = 0;
    this.ticks = 0;
    this.frameTicks = 0;

    // pulse 1 for now
    this.dutycycle = 0.5;
    this.halt = 0;
    this.volume = 0;
    this.disable = 0;
    this.freq = 440.0; // Concert A, default tone
    this.amp = 1;
    this.reload = 0;
    this.enabled = 0;
  }

  sample() {
    this.samples++;
    if (!this.enabled) {
      return 0;
    }
    let a = 0;
    let b = 0;
    let p = this.dutycycle * 2.0 * Math.PI;
    for (let i = 1; i < this.harmonics; i++) {
      let c = i * this.freq * 2.0 * Math.PI * this.time;
      a += -this.sinc(c) / i;
      b += -this.sinc(c - p * i) / i;
    }
    let output = ((2.0 * this.amp / Math.PI) * (a - b));

    // let output = this.sinc(this.t * this.samples); // sine wave
    output = Math.min(Math.max(output, -1.0), 1.0);
    return Math.round(this.outAmp * output);

  }
  write(address, data) {
    switch (address) {
      case 0x4000:
        switch ((data & 0xc0) >> 6)
        {
          case 0x00: this.dutycycle = 0.125; break;
          case 0x01: this.dutycycle = 0.250; break;
          case 0x02: this.dutycycle = 0.500; break;
          case 0x03: this.dutycycle = 0.750; break;
        }
        this.halt = (data & 0x20);
        this.volume = (data & 0x0f);
        this.disable = (data & 0x10);
        break;
      case 0x4001:
        // pulse1_sweep.enabled = data & 0x80;
        // pulse1_sweep.period = (data & 0x70) >> 4;
        // pulse1_sweep.down = data & 0x08;
        // pulse1_sweep.shift = data & 0x07;
        // pulse1_sweep.reload = true;
        break;

      case 0x4002:
        this.reload = (this.reload & 0xff00) | data;
        break;

      case 0x4003:
        this.reload = (data & 0x07) << 8 | (this.reload & 0x00ff);
        // pulse1_seq.timer = pulse1_seq.reload;
        // pulse1_seq.sequence = pulse1_seq.new_sequence;
        // pulse1_lc.counter = length_table[(data & 0xF8) >> 3];
        // pulse1_env.start = true;
        break;
      case 0x4015: // APU STATUS
        this.enabled = data & 0x01 == 0x01;
        // pulse2_enable = data & 0x02;
        // noise_enable = data & 0x04;
        break;
    }
  }

  tick() {
    this.time += (0.3333333333 / 1789773);
    if (this.ticks % 6 == 0) {
      let quarter = false;
      let half = false;
      this.frameTicks++;
      // 4-Step Sequence Mode
      if (this.frameTicks == 3729)
      {
        quarter = true;
      }
      if (this.frameTicks == 7457)
      {
        quarter = true;
        half = true;
      }
      if (this.frameTicks == 11186)
      {
        quarter = true;
      }
      if (this.frameTicks == 14916)
      {
        quarter = true;
        half = true;
        this.frameTicks = 0;
      }

      if(quarter) {
        // TODO: tick envelope
      }

      if(half) {
        // TODO: tick sweeper and note length
      }

      this.freq = 1789773.0 / (16.0 * this.reload + 1);
      // should be getting volume from envelope
      this.amp = (this.volume - 1) / 16.0;
    }

    // TODO: track sweeper changes
    this.ticks++;
  }

  sina(x){
    return Math.sin(x);
  }
  sinb(x){
    return this.sMath.sin(x);
  }
  sinc(x){
    let j = x * 0.15915;
    j -= Math.floor(j);
    return 20.785 * j * (j - 0.5) * (j - 1.0);
  }
}

module.exports = APU;
