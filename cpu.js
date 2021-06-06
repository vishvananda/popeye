// NES emulator

class Nes6502 {
  constructor(bus) {
    this.bus = bus;
    this.reset();
  }

  reset() {
    this.A = 0x00; // 8-bit accumulator
    this.X = 0x00; // 8-bit x register
    this.Y = 0x00; // 8-bit y register
    this.Stack = 0x00; // 8-bit stack
    this.Status = 0x00 | St.UN; // 8-bit flags

    var abs = 0xfffc;
    var lo = this.read(abs + 0);
    var hi = this.read(abs + 1);
    this.PC = (hi << 8) | lo; // 16-bit program counter
  }

  setStatus(flag) {
    this.Status |= flag;
  }

  clearStatus(flag) {
    this.Status &= ~flag;
  }

  getStatus(flag) {
    return (this.Status & flag) != 0;
  }

  read(address) {
    return this.bus.read(address);
  }

  write(address, data) {
    this.bus.write(address, data);
  }

  execute(ins) {
    switch (ins) {
      case 0xa2: // LDX
        // store the next value into X
        this.X = this.read(this.PC);
        this.PC++;
        break;
      case 0x8e: // STX
        // read the address
        var lo = this.read(this.PC);
        this.PC++;
        var hi = this.read(this.PC);
        this.PC++;
        //  hi 0x80 0001000b
        //  lo 0x40 0000100b
        //  hi << 8 0x8000 000100000000000b
        //  lo      0x0040 000000000000100b
        //  hi | lo 0x8040 000100000000100b
        var addr = (hi << 8) | lo;
        // store the value at X into address
        this.write(addr, this.X);
        break;
      default:
        console.log("unknown instruction");
        break;
    }
  }

  clock() {
    let ins = this.read(this.PC);
    this.PC++;
    this.execute(ins);
  }
}

const St = {
  CARRY: 1 << 0,
  ZERO: 1 << 1,
  INTD: 1 << 2,
  DEC: 1 << 3,
  BREAK: 1 << 4,
  UN: 1 << 5,
  OVER: 1 << 6,
  NEG: 1 << 7,
};

module.exports = Nes6502;
