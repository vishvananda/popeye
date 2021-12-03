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

    let prg_size = data[4] * PRG_PAGE_SIZE;
    let chr_size = data[5] * CHR_PAGE_SIZE;
    this.nBanks = data[4];
    this.mapper = (data[7] & 0xf0) | (data[6] >> 4);
    if (this.mapper === 2) {
      // PRG ROM capacity	256K/4096K
      // PRG ROM window	16K + 16K fixed
      // PRG RAM capacity	None
      // CHR capacity	8K
      // CHR window	n/a
      // Nametable mirroring	Fixed H or V, controlled by solder pads
      this.nPRGlo = 0;
      this.nPRGhi = this.nBanks - 1;
    } else if (this.mapper === 1) {
      // PRG ROM capacity	256K (512K)
      // PRG ROM window	16K + 16K fixed or 32K
      // PRG RAM capacity	32K
      // PRG RAM window	8K
      // CHR capacity	128K
      // CHR window	4K + 4K or 8K
      // Nametable mirroring	H, V, or 1, switchable
      //TODO
    } else if (this.mapper != 0) {
      console.log("mapper not supported");
      process.exit(1);
    }

    // only some mappers support ram, but many debug roms
    // use it with the wrong mapper so always use it
    this.ram = new Uint8Array(0x2000);

    let prg_start = 16;
    if ((data[6] & 0x06) != 0) {
      // skip trainer
      prg_start += 512;
    }
    this.prg = data.slice(prg_start, prg_start + prg_size);
    if (chr_size == 0) {
      // chr ram
      console.log("using chr ram");
      this.chr = new Uint8Array(0x2000);
    } else {
      let chr_start = prg_start + prg_size;
      this.chr = data.slice(chr_start, chr_start + chr_size);
    }
  }

  read(address) {
    if (address >= 0x6000 && address <= 0x7fff) {
      return this.ram[address & 0x1fff];
    }
    return this.prg[this.prgOffset(address)];
  }

  mapperTwoReset() {
    this.reset = true;
  }
  prgOffset(address) {
    if (this.mapper === 0) {
      address -= 0x8000;
      if (this.prg.length == 0x4000) {
        address &= 0x3fff;
      }
    } else if (this.mapper === 2) {
      if (address >= 0x8000 && address <= 0xbfff) {
        address = this.nPRGlo * 0x4000 + (address & 0x3fff);
      } else if (address >= 0xc000 && address <= 0xffff) {
        address = this.nPRGhi * 0x4000 + (address & 0x3fff);
      }
    } else if (this.mapper === 1) {
      //TODO
    }
    return address;
  }

  write(address, data) {
    if (address >= 0x6000 && address <= 0x7fff) {
      this.ram[address & 0x1fff] = data;
      return;
    }
    if (this.mapper === 0) {
      console.log("writing not allowed to address", address);
      process.exit(1);
    } else if (this.mapper === 2) {
      //set prgLo to whatever current program bank is (first 4 bits), and cpu will read it later
      this.nPRGlo = data & 0x0f;
    } else if (this.mapper === 1) {
      //TODO
    }
  }

  ppuWrite(address, data) {
    // mapper 0
    this.chr[address] = data;
  }
  ppuRead(address) {
    // mapper 0
    return this.chr[address];
  }
}

const Mirror = {
  HORIZONTAL: 0,
  VERTICAL: 1,
  FOUR_SCREEN: 2,
};

module.exports = Cart;
