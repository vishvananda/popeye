const hex = require("./hex");

const PAL = [
  [84, 84, 84],
  [0, 30, 116],
  [8, 16, 144],
  [48, 0, 136],
  [68, 0, 100],
  [92, 0, 48],
  [84, 4, 0],
  [60, 24, 0],
  [32, 42, 0],
  [8, 58, 0],
  [0, 64, 0],
  [0, 60, 0],
  [0, 50, 60],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],

  [152, 150, 152],
  [8, 76, 196],
  [48, 50, 236],
  [92, 30, 228],
  [136, 20, 176],
  [160, 20, 100],
  [152, 34, 32],
  [120, 60, 0],
  [84, 90, 0],
  [40, 114, 0],
  [8, 124, 0],
  [0, 118, 40],
  [0, 102, 120],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],

  [236, 238, 236],
  [76, 154, 236],
  [120, 124, 236],
  [176, 98, 236],
  [228, 84, 236],
  [236, 88, 180],
  [236, 106, 100],
  [212, 136, 32],
  [160, 170, 0],
  [116, 196, 0],
  [76, 208, 32],
  [56, 204, 108],
  [56, 180, 204],
  [60, 60, 60],
  [0, 0, 0],
  [0, 0, 0],

  [236, 238, 236],
  [168, 204, 236],
  [188, 188, 236],
  [212, 178, 236],
  [236, 174, 236],
  [236, 174, 212],
  [236, 180, 176],
  [228, 196, 144],
  [204, 210, 120],
  [180, 222, 120],
  [168, 226, 144],
  [152, 226, 180],
  [160, 214, 228],
  [160, 162, 160],
  [0, 0, 0],
  [0, 0, 0],
];

const CR = {
  NAMETABLE1: 1 << 0,
  NAMETABLE2: 1 << 1,
  VRAM_ADD_INCREMENT: 1 << 2,
  SPRITE_PATTERN_ADDR: 1 << 3,
  BACKGROUND_PATTERN_ADDR: 1 << 4,
  SPRITE_SIZE: 1 << 5,
  MASTER_SLAVE_SELECT: 1 << 6,
  GENERATE_NMI: 1 << 7,
};

const Mask = {
  GRAYSCALE: 1 << 0,
  BACK_LEFT: 1 << 1,
  SPRITE_LEFT: 1 << 2,
  BACKGROUND: 1 << 3,
  SPRITE: 1 << 4,
  RED: 1 << 5,
  GREEN: 1 << 6,
  BLUE: 1 << 7,
};

const St = {
  OVERFLOW: 1 << 5,
  SPRITE_ZERO: 1 << 6,
  VERTICAL_BLANK: 1 << 7,
};

class PPU {
  constructor(io) {
    this.control = 0;
    this.status = 0;
    this.mask = 0;
    this.addr = 0;
    this.addrHi = true;
    this.oamAddr = 0;
    this.io = io;
    this.buffer = 0;
    this.x = 0;
    this.y = 0;
    this.scrollx = true;
    this.cycle = 0;
    this.scanline = 0;
    this.upper = 0;
    this.lower = 0;
    this.tile = null;
    this.bgpal = null;
    this.nmi = false;
  }

  reverse(b) {
    b = ((b & 0xf0) >> 4) | ((b & 0x0f) << 4);
    b = ((b & 0xcc) >> 2) | ((b & 0x33) << 2);
    b = ((b & 0xaa) >> 1) | ((b & 0x55) << 1);
    return b;
  }

  tick() {
    if (this.scanline >= -1 && this.scanline < 240) {
      if (this.scanline == -1 && this.cycle == 1) {
        // clear vblank;
        this.status &= ~St.VERTICAL_BLANK;
      }
      if (this.cycle >= 1 && this.cycle <= 256) {
        // update tile
        let [x, y] = [this.cycle - 1, this.scanline];
        if (x % 8 == 0) {
          let row = Math.floor(y / 8);
          let column = x / 8;
          let bank = (this.control & CR.BACKGROUND_PATTERN_ADDR) >> 4;
          let offset = row * 32 + column;
          // using first nametable
          let num = this.vram[offset];
          this.tile = this.cart.getTile(bank, num);
          let finey = y % 8;
          this.upper = this.reverse(this.tile[finey]);
          this.lower = this.reverse(this.tile[finey + 8]);

          let aoffset = Math.floor(row / 4) * 8 + Math.floor(column / 4);
          // using first nametable
          let attr = this.vram[0x3c0 + aoffset];

          // shift bytes to get the proper color
          if (row % 4 > 1) {
            attr >>= 4;
          }
          if (column % 4 > 1) {
            attr >>= 2;
          }

          // use bottom two bytes to find palette index
          let start = 1 + (attr & 0x03) * 4;
          this.bgpal = [
            PAL[this.palette[0]],
            PAL[this.palette[start]],
            PAL[this.palette[start + 1]],
            PAL[this.palette[start + 2]],
          ];
        }

        let value = ((1 & this.lower) << 1) | (1 & this.upper);
        this.upper >>= 1;
        this.lower >>= 1;
        // get the right color
        let [r, g, b] = this.bgpal[value];

        this.io.setPixel(x, y, r, g, b);
      }
    }

    if (this.scanline == 241 && this.cycle == 1) {
      this.status |= St.VERTICAL_BLANK;
      // should trigger nmi interrupt if control register says to
      if (this.control & CR.GENERATE_NMI) {
        this.nmi = true;
      }
    }
    this.cycle++;
    if (this.cycle >= 341) {
      this.cycle = 0;
      this.scanline++;
      if (this.scanline >= 261) {
        this.scanline = -1;
        this.frame = true;
        this.odd = !this.odd;
      }
    }
  }

  clock(cycles) {
    let sl = this.scanline;
    let c = this.cycle;
    for (let i = 0; i < cycles; i++) {
      this.tick();
    }
    return [sl, c];
  }

  loadCart(cart) {
    this.cart = cart;
    this.palette = new Uint8Array(32);
    this.vram = new Uint8Array(2048);
    this.oam = new Uint8Array(256);
    this.mirroring = cart.mirroring;
  }

  showTile(xloc, yloc, bank, num) {
    let tile = this.cart.getTile(bank, num);
    for (let y = 0; y < 8; y++) {
      let upper = this.reverse(tile[y]);
      let lower = this.reverse(tile[y + 8]);
      for (let x = 0; x < 8; x++) {
        let value = ((1 & lower) << 1) | (1 & upper);
        upper >>= 1;
        lower >>= 1;
        let [r, g, b] = [0, 0, 0];
        switch (value) {
          case 0:
            [r, g, b] = [255, 0, 0];
            break;
          case 1:
            [r, g, b] = [255, 255, 0];
            break;
          case 2:
            [r, g, b] = [255, 0, 255];
            break;
          case 3:
            [r, g, b] = [0, 255, 0];
            break;
          default:
            console.log("invalid color");
            process.exit(1);
            break;
        }
        this.io.setPixel(xloc + x, yloc + y, r, g, b);
      }
    }
  }

  incAddr() {
    if ((this.control & CR.VRAM_ADD_INCREMENT) == CR.VRAM_ADD_INCREMENT) {
      this.addr += 32;
    } else {
      this.addr += 1;
    }
    this.addr &= 0x3fff;
  }

  readData() {
    let addr = this.addr;
    this.incAddr();
    if (addr >= 0x0000 && addr <= 0x1fff) {
      // read from chr
      let result = this.buffer;
      this.buffer = this.cart.chr[addr];
      return result;
    } else if (addr >= 0x2000 && addr <= 0x2fff) {
      // read from ram
      // TODO: mirroring
      let result = this.buffer;
      this.buffer = this.vram[addr - 0x2000];
      return result;
    } else if (addr >= 0x3000 && addr <= 0x3eff) {
      console.log("illegal read " + hex.toHex16(addr));
      process.exit(1);
    } else if (addr >= 0x3f00 && addr <= 0x3fff) {
      // sets internal buffer from weird address
      this.buffer = this.vram[addr - 0x1000];
      // $3F10/$3F14/$3F18/$3F1C are mirrors of $3F00/$3F04/$3F08/$3F0C
      return this.palette[addr - 0x3f00];
    } else {
      console.log("oops broken mirroring " + hex.toHex16(addr));
      process.exit(1);
    }
  }

  writeAddr(data) {
    if (this.addrHi) {
      this.addr = (this.addr & 0x00ff) | (data << 8);
    } else {
      this.addr = (this.addr & 0xff00) | data;
    }
    this.addrHi = !this.addrHi;
  }

  readStatus() {
    let status = this.status;
    // reset addr latch
    this.addr = 0;
    this.addrHi = true;
    // clear vblank;
    this.status &= ~St.VERTICAL_BLANK;
    return status;
  }

  writeData(data) {
    let addr = this.addr;
    this.incAddr();
    if (addr >= 0x0000 && addr <= 0x1fff) {
      console.log("illegal write to chr data " + hex.toHex16(addr));
      process.exit(1);
    } else if (addr >= 0x2000 && addr <= 0x2fff) {
      // write to ram
      // TODO: mirroring
      this.vram[addr - 0x2000] = data;
    } else if (addr >= 0x3000 && addr <= 0x3eff) {
      console.log("illegal write " + hex.toHex16(addr));
      process.exit(1);
    } else if (addr >= 0x3f00 && addr <= 0x3fff) {
      // $3F10/$3F14/$3F18/$3F1C are mirrors of $3F00/$3F04/$3F08/$3F0C
      if ((addr & 0xf3) == 0x10) {
        addr -= 0x10;
      }
      // f3 = 1111 00 11
      //    &
      // 10 = 0001 00 00
      // 14 = 0001 01 00
      // 18 = 0001 10 00
      // 1C = 0001 11 00
      // f5 = 1111 01 01
      // ---------------
      // f1 = 1111 00 01
      this.palette[addr - 0x3f00] = data;
    } else {
      console.log("oops broken mirroring " + hex.toHex16(addr));
      process.exit(1);
    }
  }

  read(address) {
    switch (address) {
      case 0x2002:
        // Status
        return this.readStatus();
      case 0x2004:
        // OAM Data
        // shouldn't be read in most games
        console.log("read from oam data");
        return this.oam[this.oamAddr];
      case 0x2007:
        return this.readData();
      default:
        console.log("read from unknown ppu register " + hex.toHex16(address));
        process.exit(1);
    }
  }
  write(address, data) {
    this.status = (this.status & 0xe0) | (data & 0x1f);
    switch (address) {
      case 0x2000:
        this.control = data;
        break;
      case 0x2001:
        this.mask = data;
        break;
      case 0x2003:
        this.oamAddr = data;
        // OAM Address
        break;
      case 0x2004:
        // OAM Data
        this.oam[this.oamAddr] = data;
        this.oamAddr++;
        this.oamAddr &= 0xff;
        break;
      case 0x2005:
        // Scroll
        if (this.scrollx) {
          this.x = data;
        } else {
          this.y = data;
        }
        this.scrollx = !this.scrollx;
        break;
      case 0x2006:
        // address register
        this.writeAddr(data);
        break;
      case 0x2007:
        // data register
        this.writeData(data);
        break;
      default:
        console.log("write to unknown ppu register " + hex.toHex16(address));
        process.exit(1);
    }
  }
}

module.exports = PPU;
