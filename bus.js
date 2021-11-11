const Cart = require("./cart");
const hex = require("./hex");

class Bus {
  constructor(input, ppu, cpu) {
    this.input = input;
    this.cpu = cpu;
    this.cpu.setBus(this);
    this.ppu = ppu;
    this.ram = new Uint8Array(0x0800);
  }

  loadRom(file) {
    this.cart = new Cart(file);
    this.reset();
  }

  reset() {
    this.cpu.reset();
    this.ppu.reset();
    this.ppu.loadCart(this.cart);
    this.cycles = 0;
    this.dummy = true;
    this.dma = false;
    this.dmaaddr = 0;
    this.dmapage = 0;
    this.dmadata = 0;
    this.ram = new Uint8Array(0x2000);
  }

  read(address) {
    if (address >= 0x0000 && address <= 0x1fff) {
      return this.ram[address & 0x07ff];
    } else if (address >= 0x2000 && address <= 0x3fff) {
      return this.ppu.read(address);
    } else if (address >= 0x4016 && address <= 0x4017) {
      return this.input.read(address);
    } else if (address >= 0x6000 && address <= 0x7fff) {
      return this.ram[address & 0x1fff];
    } else if (address >= 0x8000 && address <= 0xffff) {
      return this.cart.read(address);
    } else {
      return 0x00;
    }
  }

  write(address, data) {
    if (address >= 0x0000 && address <= 0x1fff) {
      this.ram[address & 0x7ff] = data;
    } else if (address >= 0x2000 && address <= 0x3fff) {
      return this.ppu.write(address, data);
    } else if (address == 0x4014) {
      this.dma = true;
      this.dmaaddr = 0;
      this.dmapage = data;
    } else if (address >= 0x4016 && address <= 0x4017) {
      this.input.write(address, data);
    } else if (address >= 0x6000 && address <= 0x7fff) {
      this.ram[address & 0x1fff] = data;
    } else if (address >= 0x8000 && address <= 0xffff) {
      return this.cart.write(address, data);
    }
  }
  output() {
    console.log("OUTPUT", hex.toHex8(this.ram[0x0000]));
    let nul = this.ram.indexOf(0, 4);
    console.log("TEXT", String.fromCharCode(...this.ram.slice(4, nul)));
  }

  tick(logCallback = null) {
    this.cycles++;
    this.ppu.tick();
    if (this.cycles % 3 == 0) {
      if (this.dma) {
        if (this.dummy) {
          if (this.cycles % 2 == 1) {
            this.dummy = false;
          }
        } else {
          if (this.cycles % 2 == 0) {
            this.dmadata = this.read((this.dmapage << 8) | this.dmaaddr);
          } else {
            this.ppu.oam[this.dmaaddr] = this.dmadata;
            this.dmaaddr++;
            if (this.dmaaddr > 255) {
              this.dma = false;
              this.dummy = true;
            }
          }
        }
      } else {
        let bLog = logCallback != null;
        let log = this.cpu.tick(bLog);
        if (log !== undefined && bLog) {
          let s = ("   " + this.ppu.scanline).slice(-3);
          let p = ("   " + this.ppu.cycle).slice(-3);
          log = log.replace("%ppu", s + "," + p);
          logCallback(log);
        }
      }
    }

    if (this.ppu.nmi) {
      this.ppu.nmi = false;
      this.cpu.nmi();
    }
  }
}

module.exports = Bus;
