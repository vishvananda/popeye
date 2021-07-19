class Bus {
  constructor(input) {
    this.input = input;
    this.ram = new Uint8Array(0x07ff);
    this.ram.fill(0);
    this.rom = new Uint8Array(0xffff);
    this.rom.fill(0);
  }

  read(address) {
    if (address >= 0x0000 && address <= 0x1fff) {
      return this.ram[address & 0x07ff];
    } else if (address >= 0x2000 && address <= 0x3fff) {
      // ppu here
    } else if (address >= 0x4016 && address <= 0x4017) {
      return this.input.read(address);
    } else {
      // temporarily use rom
      return this.rom[address];
    }
  }

  write(address, data) {
    if (address >= 0x0000 && address <= 0x1fff) {
      this.ram[address & 0x7ff] = data;
    } else if (address >= 0x2000 && address <= 0x3fff) {
      // ppu here
    } else if (address >= 0x4016 && address <= 0x4017) {
      this.input.write(address);
    }
  }
}

module.exports = Bus;
