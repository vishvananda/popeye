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
    // start cycles at 21 for reset
    this.cycles = 21;
    this.scanline = 0;
    this.tiley = 0;
    this.upper = 0;
    this.lower = 0;
    this.tile = null;
  }

  tick() {
    this.cycles++;
    if (this.cycles >= 341) {
      this.cycles -= 341;
      this.scanline++;
      if (this.scanline == 241) {
        this.status |= St.VERTICAL_BLANK;
        // should trigger nmi interrupt
      }

      if (this.scanline > 261) {
        // clear vblank;
        this.status &= ~St.VERTICAL_BLANK;
        this.scanline = 0;
      }
    }

    // update tiles
    if (this.cycles % 8 == 0 || this.scanline % 8 == 0) {
      // TODO: get this from control register
      let bank = 0;
      let offset = this.scanline * 4 + this.cycles / 8;
      let num = this.vram[offset];
      this.tile = this.cart.getTile(bank, num);
      this.tiley = 0;
    } else if (this.tile != null) {
      this.tiley++;
      this.upper = this.tile[this.tiley];
      this.lower = this.tile[this.tiley + 8];
    }

    if ((this.status & St.VERTICAL_BLANK) != St.VERTICAL_BLANK) {
      let [x, y] = [this.cycles, this.scanline];
      let value = ((1 & this.upper) << 1) | (1 & this.lower);
      this.upper >>= 1;
      this.lower >>= 1;
      // get the right color
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
      this.io.setPixel(x, y, r, g, b);
    }
  }

  clock(cycles) {
    let sl = this.scanline;
    let c = this.cycles;
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
      let upper = tile[y];
      let lower = tile[y + 8];
      for (let x = 7; x >= 0; x--) {
        let value = ((1 & upper) << 1) | (1 & lower);
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
      this.buffer = this.chr[addr];
      return result;
    } else if (addr >= 0x2000 && addr <= 0x2fff) {
      // read from ram
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
    console.log(this.addr);
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
      this.vram[addr - 0x2000] = data;
      console.log("writing to vram", addr, data);
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
