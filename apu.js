class APU {
  constructor(rate) {
    this.bitDepth = 16;
    this.channels = 1;
    this.samples = 0;
    this.rate = rate;
  }
  sample() {
    const amplitude = 32760; // Max amplitude for 16-bit audio
    // the frequency to play
    const freq = 440.0; // Concert A, default tone
    // the "angle" used in the function, adjusted for the number of
    // channels and sample rate. This value is like the period of the wave.
    const t = (Math.PI * 2 * freq) / this.rate;

    this.samples++;
    return Math.round(amplitude * Math.sin(t * this.samples)); // sine wave
  }
}

module.exports = APU;
