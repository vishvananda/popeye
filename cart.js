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
    this.mapper = (data[7] & 0xf0) | (data[6] >> 4);
    // no mappers yet
    if (this.mapper != 0) {
      console.log("mapper not supported");
      process.exit(1);
    }
    if (((data[7] >> 2) & 0x03) != 0) {
      console.log("invalid ines version");
      process.exit(1);
    }
    if ((data[6] & 0x08) != 0) {
      this.mirror = Mirror.FOUR_SCREEN;
    } else {
      this.mirror = data[6] & 0x01;
    }

    let prg_size = data[4] * PRG_PAGE_SIZE;
    let chr_size = data[5] * CHR_PAGE_SIZE;

    let prg_start = 16;
    if ((data[6] & 0x06) != 0) {
      // skip trainer
      prg_start += 512;
    }
    let chr_start = prg_start + prg_size;
    this.prg = data.slice(prg_start, prg_start + prg_size);
    this.chr = data.slice(chr_start, chr_start + chr_size);
  }

  read(address) {
    return this.prg[this.prgOffset(address)];
  }
  prgOffset(address) {
    address -= 0x8000;
    if (this.prg.length == 0x4000) {
      address &= 0x3fff;
    }
    return address;
  }

  write(address) {
    console.log("writing not allowed to address", address);
    process.exit(1);
  }

  getTile(bank, num) {
    let start = bank * 0x1000 + num * 16;
    return this.chr.slice(start, start + 15);
  }
}

const Mirror = {
  VERTICAL: 1 << 0,
  HORIZONTAL: 1 << 1,
  FOUR_SCREEN: 1 << 2,
};

module.exports = Cart;
