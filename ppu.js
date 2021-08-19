class PPU {
  constructor(io) {
    this.io = io;
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
