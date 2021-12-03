const fs = require("fs");
const HEADER = Buffer.from([0x4e, 0x45, 0x53, 0x1a]);
const PRG_PAGE_SIZE = 16 * 1024;
const CHR_PAGE_SIZE = 8 * 1024;
class Cart {
  constructor(file) {
    let data = fs.readFileSync(file);
    if (!HEADER.equals(data.slice(0, 4))) {
      console.log("invalid rom file");
      process.exit(1);
    }
    if (((data[7] >> 2) & 0x03) != 0) {
      console.log("invalid ines version");
      process.exit(1);
    }
    if ((data[6] & 0x08) != 0) {
      this.mirroring = Mirror.FOUR_SCREEN;
    } else {
      this.mirroring = data[6] & 0x01;
    }

    let prgSize = data[4] * PRG_PAGE_SIZE;
    this.chrSize = data[5] * CHR_PAGE_SIZE;
    this.banks = data[4];
    this.mapper = (data[7] & 0xf0) | (data[6] >> 4);
    if (this.mapper === 2) {
      // PRG ROM capacity	256K/4096K
      // PRG ROM window	16K + 16K fixed
      // PRG RAM capacity	None
      // CHR capacity	8K
      // CHR window	n/a
      // Nametable mirroring	Fixed H or V, controlled by solder pads
      this.prgLo = 0;
      this.prgHi = this.banks - 1;
    } else if (this.mapper === 1) {
      console.log("this rom is mapper1");
      // PRG ROM capacity	256K (512K)
      // PRG ROM window	16K + 16K fixed or 32K
      // PRG RAM capacity	32K
      // PRG RAM window	8K
      // CHR capacity	128K
      // CHR window	4K + 4K or 8K
      // Nametable mirroring	H, V, or 1, switchable
      this.prgLo = 0;
      this.prgHi = this.banks - 1;
      this.prg32 = 0;
      this.chrLo = 0;
      this.chrHi = 0;
      this.chr8 = 0;
      this.ctl1 = 0x1c;
      this.load1 = 0x00;
      this.load1Count = 0;
    } else if (this.mapper != 0) {
      console.log("mapper not supported");
      process.exit(1);
    }

    // only some mappers support ram, but many debug roms
    // use it with the wrong mapper so always use it
    this.ram = new Uint8Array(0x2000);

    let prgStart = 16;
    if ((data[6] & 0x06) != 0) {
      // skip trainer
      prgStart += 512;
    }
    this.prg = data.slice(prgStart, prgStart + prgSize);
    // console.log("prg", prgSize / 1024);
    if (this.chrSize == 0) {
      // chr ram
      this.chr = new Uint8Array(0x2000);
    } else {
      let chrStart = prgStart + prgSize;
      this.chr = data.slice(chrStart, chrStart + this.chrSize);
      // console.log("chr", this.chrSize / 1024);
    }
  }

  read(address) {
    if (address >= 0x6000 && address <= 0x7fff) {
      return this.ram[address & 0x1fff];
    }
    return this.prg[this.prgOffset(address)];
  }

  prgOffset(address) {
    if (this.mapper === 0) {
      address -= 0x8000;
      if (this.prg.length == 0x4000) {
        address &= 0x3fff;
      }
    } else if (this.mapper === 2 || (this.mapper === 1 && this.ctl1 & 0x08)) {
      if (address >= 0x8000 && address <= 0xbfff) {
        address = this.prgLo * 0x4000 + (address & 0x3fff);
      } else if (address >= 0xc000 && address <= 0xffff) {
        address = this.prgHi * 0x4000 + (address & 0x3fff);
      }
    } else if (this.mapper === 1) {
      address = this.prg32 * 0x8000 + (address & 0x7fff);
    }
    return address;
  }

  write(address, data) {
    if (address >= 0x6000 && address <= 0x7fff) {
      this.ram[address & 0x1fff] = data;
      return;
    }
    if (this.mapper === 0) {
      console.log("illegal write to address", address);
    } else if (this.mapper === 2) {
      // set prgLo to whatever current program bank is (first 4 bits), and cpu will read it later
      this.prgLo = data & 0x0f;
    } else if (this.mapper === 1) {
      this.write1(address, data);
    }
  }

  write1(address, data) {
    if (data & 0x80) {
      // reset serial loading
      this.load1 = 0x00;
      this.load1Count = 0;
      this.ctl1 |= 0x0c;
    } else {
      // load data into load register
      this.load1 >>= 1;
      this.load1 |= (data & 0x01) << 4;
      this.load1Count++;
      if (this.load1Count == 5) {
        switch ((address >> 13) & 0x03) {
          case 0:
            // control register 8000 - A000
            this.ctl1 = this.load1 & 0x1f;
            switch (this.ctl1 & 0x03) {
              case 0:
                this.mirroring = Mirror.ONESCREEN_LO;
                break;
              case 1:
                this.mirroring = Mirror.ONESCREEN_HI;
                break;
              case 2:
                this.mirroring = Mirror.VERTICAL;
                break;
              case 3:
                this.mirroring = Mirror.HORIZONTAL;
                break;
            }
            break;
          case 1:
            // chr lo - A000 - C000
            if (this.ctl1 & 0x10) {
              this.chrLo = this.load1 & 0x1f;
            } else {
              this.chr8 = this.load1 & 0x1e;
            }
            break;
          case 2:
            // chr hi - C000 - E000
            this.chrHi = this.load1 & 0x1f;
            break;
          case 3:
            // prg - E000 - FFFF
            switch ((this.ctl1 >> 2) & 0x03) {
              case 0:
              case 1:
                this.prg32 = (this.load1 & 0x0e) >> 1;
                break;
              case 2:
                this.prgLo = 0;
                this.prgHi = this.load1 & 0x0f;
                break;
              case 3:
                this.prgLo = this.load1 & 0x0f;
                this.prgHi = this.banks - 1;
                break;
            }
            break;
        }
        this.load1 = 0x00;
        this.load1Count = 0;
      }
    }
  }

  ppuWrite(address, data) {
    if (this.chrSize === 0) {
      this.chr[address] = data;
    } else {
      console.log("illegal ppu write to address", address);
    }
  }

  ppuRead(address) {
    if (this.mapper === 1 && this.chrSize !== 0) {
      if (this.ctl1 & 0x10) {
        // 4k chr
        if (address >= 0x0000 && address <= 0x0fff) {
          address = this.chrLo * 0x1000 + (address & 0x0fff);
        } else if (address >= 0x1000 && address <= 0x1fff) {
          address = this.chrHi * 0x1000 + (address & 0x0fff);
        }
      } else {
        // 8k chr
        address = this.chr8 * 0x2000 + (address & 0x1fff);
      }
    }
    return this.chr[address];
  }
}

const Mirror = {
  HORIZONTAL: 0,
  VERTICAL: 1,
  FOUR_SCREEN: 2,
  ONESCREEN_LO: 3,
  ONESCREEN_HI: 4,
};

module.exports = Cart;
