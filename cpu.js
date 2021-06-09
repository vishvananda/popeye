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
        case 0xac: // LDY
        // store the next value into Y
        this.Y = this.read(this.PC);
        this.PC++;
        break;
        case 0xa9: // LDA
        // store the next value into A
        this.A = this.read(this.PC);
        this.PC++;
        break;
        case 0x18: // CLC
        // Not sure what CLC does?
        this.PC++;
        break;
        //note : does "LOOP" need a case here? 
        case 0xa9: // ADC
        // Add to accumulator with a Carry
        this.A++ // How does carry work just having a read statement below?
        this.A = this.read(this.A);
        this.PC++;
        break;
        case 0x88: // DEY
        // What is DEY? Delete (reset) Y?
        this.Y = 0
        this.PC++;
        break;
        case 0xd0: // BNE (loop)
        // Branch n bytes if Z flag = 0 according to laboseur.com PDF but not sure what this means
        this.Y = 0x00
        this.PC++;
        break;
        case 0x8e: // STA
        // read the address
        var lo = this.read(this.PC);
        this.PC++;
        var hi = this.read(this.PC);
        this.PC++;
        var addr = (hi << 8) | lo;
        // store the value at A into address
        this.write(addr, this.A);
        break;
        case 0x88: // NOP
        // No operation, (EA) -- so no PC++ , or PC++ and nothing else?
        // this.PC++;
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
