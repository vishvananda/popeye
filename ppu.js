const fs = require("fs");
const hex = require("./hex");

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

const Mirror = {
  HORIZONTAL: 0,
  VERTICAL: 1,
  FOUR_SCREEN: 2,
};

const St = {
  OVERFLOW: 1 << 5,
  SPRITE_ZERO: 1 << 6,
  VERTICAL_BLANK: 1 << 7,
};
// 76543210
// ||||||||
// |||||||+- Bank ($0000 or $1000) of tiles
// +++++++-- Tile number of top of sprite (0 to 254; bottom half gets the next tile)
const SpriteByteOne = {
  BANK: 1 << 0,
};
// 76543210
// ||||||||
// ||||||++- Palette (4 to 7) of sprite
// |||+++--- Unimplemented
// ||+------ Priority (0: in front of background; 1: behind background)
// |+------- Flip sprite horizontally
// +-------- Flip sprite vertically
const SpriteByteTwo = {
  PRIORITY: 1 << 5,
  FLIP_HORIZONTAL: 1 << 6,
  FLIP_VERTICAL: 1 << 7,
};

class PPU {
  constructor(io, palette = "nes.pal") {
    this.io = io;
    this.pal = this.loadPalette(palette);
  }

  loadPalette(fileName) {
    let data = fs.readFileSync(fileName);
    let ret = [];
    for (let i = 0; i < 64; i++) {
      ret.push(data.slice(i * 3, (i + 1) * 3));
    }
    return ret;
  }

  reset() {
    this.control = 0;
    this.status = 0;
    this.mask = 0;
    this.addr = 0;
    this.addrHi = true;
    this.oamAddr = 0;
    this.buffer = 0;
    this.x = 0;
    this.y = 0;
    this.scrollx = true;
    this.cycle = 0;
    this.scanline = 0;
    this.bgLo = 0;
    this.bgHi = 0;
    this.bgpal = null;
    this.nmi = false;
    this.sprites = new Uint8Array(32);
    this.odd = false;
    this.zeroHit = false;
  }

  tick() {
    if (this.scanline >= -1 && this.scanline < 240) {
      let rendering = this.mask & (Mask.BACKGROUND | Mask.SPRITE);
      if (this.scanline == 0 && this.cycle == 0 && this.odd && rendering) {
        // skip cycle on odd frames
        this.cycle = 1;
      }
      if (this.scanline == -1 && this.cycle == 1) {
        // clear flags;
        this.status &= ~St.VERTICAL_BLANK;
        this.status &= ~St.OVERFLOW;
        this.status &= ~St.SPRITE_ZERO;
      }
      if (this.cycle >= 1 && this.cycle <= 256) {
        let right = false;
        if (this.cycle > 8) {
          right == true;
        }
        let bg = null;
        let fg = null;
        let front = true;
        // update tile
        let [x, y] = [this.cycle - 1, this.scanline];
        if (x % 8 == 0) {
          let row = Math.floor(y / 8);
          let column = x / 8;
          let bank = (this.control & CR.BACKGROUND_PATTERN_ADDR) >> 4;
          // get the proper nametable offset from the control register
          let nt = (this.control & 0x03) << 10;
          let offset = row * 32 + column;
          let num = this.readVram(nt + offset);
          let tile = this.cart.getTile(bank, num);
          let finey = y % 8;
          this.bgLo = tile[finey];
          this.bgHi = tile[finey + 8];

          let aoffset = Math.floor(row / 4) * 8 + Math.floor(column / 4);
          let attr = this.readVram(nt + 0x3c0 + aoffset);
          // shift attr right based on current quadrant
          attr >>= ((row & 0x02) << 1) | (column & 0x02);
          // explanation for bit math above
          // rquad = row & 0x02 (== 0b10 if row is 3rd or 4th)
          // cquad = col & 0x02 (== 0b10 if col is 3rd or 4th)
          // bit pairs in table are low to high (attr is 0b BR BL TR TL)
          // BITS QUAD ((rquad << 1) | cquad)
          // ------------------------------
          //   10  TL    0b000 | 0b000 = 0
          //   32  TR    0b000 | 0b010 = 2
          //   54  BL    0b100 | 0b000 = 4
          //   76  BR    0b100 | 0b010 = 6
          // eqivalent to
          // if (row % 4 > 1) {
          //   attr >>= 0b100;
          // }
          // if (column % 4 > 1) {
          //   attr >>= 0b010;
          // }

          // use bottom two bytes to find palette index
          let start = 0x01 + (attr & 0x03) * 4;
          this.bgpal = [
            null,
            this.pal[this.palette[start]],
            this.pal[this.palette[start + 1]],
            this.pal[this.palette[start + 2]],
          ];
        }
        if (
          this.mask & Mask.BACKGROUND &&
          (right || this.mask & Mask.BACK_LEFT)
        ) {
          // hi bit from msb of second plane
          let value = ((0x80 & this.bgHi) >> 6) | ((0x80 & this.bgLo) >> 7);
          // shift planes
          this.bgHi <<= 1;
          this.bgLo <<= 1;
          // get the right color
          bg = this.bgpal[value];
        }

        if (
          this.mask & Mask.SPRITE &&
          (right || this.mask & Mask.SPRITE_LEFT)
        ) {
          // check for sprites
          for (let n = 0; n < this.nSprites; n++) {
            let i = n * 4;
            let spriteX = this.sprites[i + 3];
            let attr = this.sprites[i + 2];
            if (x >= spriteX && x < spriteX + 8) {
              // sprites are delayed by one scanline
              let finey = this.scanline - 1 - this.sprites[i];
              // TODO: 16 bit sprites
              if (attr & SpriteByteTwo.FLIP_VERTICAL) {
                finey = 7 - finey;
              }
              let bank = (this.control & CR.SPRITE_PATTERN_ADDR) >> 3;
              let tile = this.cart.getTile(bank, this.sprites[i + 1]);
              let finex = x - spriteX;
              if (attr & SpriteByteTwo.FLIP_HORIZONTAL) {
                finex = 7 - finex;
              }
              let lo = tile[finey] << finex;
              let hi = tile[finey + 8] << finex;
              // foreground palettes are the last 4
              let start = 0x11 + (this.sprites[i + 2] & 0x03) * 4;
              let fgpal = [
                null,
                this.pal[this.palette[start]],
                this.pal[this.palette[start + 1]],
                this.pal[this.palette[start + 2]],
              ];
              let value = ((0x80 & hi) >> 6) | ((0x80 & lo) >> 7);
              fg = fgpal[value];
              if (fg != null) {
                if (this.zeroHit && n == 0 && bg != null && x != 255) {
                  this.status |= St.SPRITE_ZERO;
                }
                // we found a pixel so skip the rest of the sprites
                if (attr & SpriteByteTwo.PRIORITY) {
                  front = false;
                }
                break;
              }
            }
          }

          // start with the background color
          let color = this.pal[this.palette[0]];
          if (fg != null) {
            if (front || bg == null) {
              color = fg;
            }
          } else if (bg != null) {
            color = bg;
          }

          let [r, g, b] = color;
          this.io.setPixel(x, y, r, g, b);
        }
      } else if (this.cycle == 257) {
        this.nSprites = 0;
        this.zeroHit = false;
        for (let i = 0; i < 256; i += 4) {
          let spriteY = this.oam[i];
          let size = this.control & CR.SPRITE_SIZE ? 16 : 8;
          if (this.scanline >= spriteY && this.scanline < spriteY + size) {
            if (i == 0) {
              this.zeroHit = true;
            }
            if (this.nSprites == 8) {
              this.status |= St.OVERFLOW;
              break;
            }
            let j = this.nSprites * 4;
            this.sprites[j] = this.oam[i];
            this.sprites[j + 1] = this.oam[i + 1];
            this.sprites[j + 2] = this.oam[i + 2];
            this.sprites[j + 3] = this.oam[i + 3];
            this.nSprites++;
          }
        }
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
    this.vram = [new Uint8Array(1024), new Uint8Array(1024)];
    this.oam = new Uint8Array(256);
    this.mirroring = cart.mirroring;
  }

  showTile(xloc, yloc, bank, num, palette = undefined) {
    if (palette === undefined) {
      palette = [0, 1, 2, 3];
    }
    let pal = [
      this.pal[palette[0]],
      this.pal[palette[1]],
      this.pal[palette[2]],
      this.pal[palette[3]],
    ];
    let tile = this.cart.getTile(bank, num);
    for (let y = 0; y < 8; y++) {
      let lo = tile[y];
      let hi = tile[y + 8];
      for (let x = 0; x < 8; x++) {
        // hi bit from msb of second plane
        let value = ((0x80 & hi) >> 6) | ((0x80 & lo) >> 7);
        // shift planes
        lo <<= 1;
        hi <<= 1;
        let [r, g, b] = pal[value];
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

  readVram(addr) {
    let table = 0;
    if (this.mirroring == Mirror.VERTICAL) {
      // table = 0 if 0b0000 - 0b0011
      // table = 1 if 0b0100 - 0b0111
      //         0    0b1000 - 0b1011
      //         1    0b1100 - 0b1111
      table = addr & 0x0400 ? 1 : 0;
    } else if (this.mirroring == Mirror.HORIZONTAL) {
      // table = 0 if 0b0000 - 0b0011
      // table = 0 if 0b0100 - 0b0111
      //         1    0b1000 - 0b1011
      //         1    0b1100 - 0b1111
      table = addr & 0x0800 ? 1 : 0;
    }
    return this.vram[table][addr & 0x03ff];
  }

  writeVram(addr, data) {
    let table = 0;
    if (this.mirroring == Mirror.VERTICAL) {
      table = addr & 0x0400 ? 1 : 0;
    } else if (this.mirroring == Mirror.HORIZONTAL) {
      table = addr & 0x0800 ? 1 : 0;
    }
    this.vram[table][addr & 0x03ff] = data;
  }

  readData() {
    let addr = this.addr;
    this.incAddr();
    if (addr >= 0x0000 && addr <= 0x1fff) {
      // read from chr
      let result = this.buffer;
      this.buffer = this.cart.chr[addr];
      return result;
    } else if (addr >= 0x2000 && addr <= 0x3eff) {
      // read from vram
      let result = this.buffer;
      this.buffer = this.readVram(addr);
      return result;
    } else if (addr >= 0x3f00 && addr <= 0x3fff) {
      // TODO: sets internal buffer from weird address
      // this.buffer = this.vram[addr & 0x0fff];
      // $3F10/$3F14/$3F18/$3F1C are mirrors of $3F00/$3F04/$3F08/$3F0C
      if ((addr & 0xf3) == 0x10) {
        addr -= 0x10;
      }
      return this.palette[addr & 0xff];
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
      // TODO: handle CHR RAM?
    } else if (addr >= 0x2000 && addr <= 0x3eff) {
      this.writeVram(addr, data);
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
      this.palette[addr & 0xff] = data;
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
