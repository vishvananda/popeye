//control register starter code
const ControlRegister = {
  NAMETABLE1: 1 << 0,
  NAMETABLE2: 1 << 1,
  VRAM_ADD_INCREMENT: 1 << 2,
  SPRITE_PATTERN_ADDR: 1 << 3,
  BACKGROUND_PATTERN_ADDR: 1 << 4,
  SPRITE_SIZE: 1 << 5,
  MASTER_SLAVE_SELECT: 1 << 6,
  GENERATE_NMI: 1 << 7,
};
class CR {
  //below are two functions in rust code, not sure what they are doing
  // pub fn new() -> Self {
  //   ControlRegister::from_bits_truncate(0b00000000)
  // }
  // pub fn update(&mut self, data: u8) {
  //   self.bits = data
  // }

  vramAddrIncrement() {
    //Rust has increment(&self) -> u8
    if (!this.includes(ControlRegister.VRAM_ADD_INCREMENT)) {
      1;
    } else {
      32;
    }
  }
}
class PPU {
  constructor(io) {
    this.io = io;
    //added for control, possibly incorrect
    this.ctrl = CR; //we also need a function for write to ctrl, and read from PPU memory
    // then buffer behavior to hold value from previous read request, then
    // -mirroring
    // -connecting PPU to bus
    // -if haven't yet, modeling address register and expose as being writable
  }

  loadCart(cart) {
    this.cart = cart;
    this.palette_table = new Uint8Array(32);
    this.vram = new Uint8Array(2048);
    this.oam_data = new Uint8Array(256);
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

  read(address) {
    process.exit(1);
  }

  write(address) {
    process.exit(1);
  }
}

module.exports = PPU;
