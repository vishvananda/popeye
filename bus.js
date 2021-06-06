class Bus {
  constructor() {
    this.ram = new Uint8Array(1 << 16);
    this.ram.fill(0);
  }

  read(address) {
    return this.ram[address];
  }

  write(address, data) {
    this.ram[address] = data;
  }
}

module.exports = Bus;
