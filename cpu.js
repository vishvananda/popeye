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

    let abs = 0xfffc;
    let lo = this.read(abs + 0);
    let hi = this.read(abs + 1);
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
    let lo = 0;
    let hi = 0;
    let addr = 0;
    switch (ins) {
      case 0xa2: // LDX IMM
        // store the next value into X
        this.X = this.read(this.PC);
        this.PC++;
        break;
      case 0x8e: // STX (absolute)
        // read the address
        lo = this.read(this.PC);
        this.PC++;
        hi = this.read(this.PC);
        this.PC++;
        //  hi 0x80 0001000b
        //  lo 0x40 0000100b
        //  hi << 8 0x8000 000100000000000b
        //  lo      0x0040 000000000000100b
        //  hi | lo 0x8040 000100000000100b
        addr = (hi << 8) | lo;
        // store the value at X into address
        this.write(addr, this.X);
        break;
      case 0xac: // LDY ABS
        lo = this.read(this.PC);
        this.PC++;
        hi = this.read(this.PC);
        this.PC++;
        addr = (hi << 8) | lo;
        this.Y = this.read(addr);
        break;
      case 0xa9: // LDA
        // store the next value into A
        this.A = this.read(this.PC);
        this.PC++;
        break;
      case 0x18: // CLC
        // Clear Carry flag, set to 0
        this.clearStatus(St.CARRY);
        break;
      //note : loop will start back here after BNE
      case 0x6d: // ADC
        // Add to accumulator with a Carry
        // This instruction adds the contents of a memory location to the accumulator together with the carry bit. If overflow occurs the carry bit is set, this enables multiple byte addition to be performed.
        lo = this.read(this.PC);
        this.PC++;
        hi = this.read(this.PC);
        this.PC++;
        addr = (hi << 8) | lo;

        lo = this.read(addr);
        // the carry flag is bit 0 so we can use the value directly
        var sum = this.A + lo + (this.Status & St.CARRY);
        // additional instructions for ADC:
        // Zero Flag	Set if A = 0
        if (sum === 0) {
          this.setStatus(St.ZERO);
        }
        {
          this.clearStatus(St.ZERO);
        }
        // 0x80 the top bit  is 10000000b
        // Negative Flag	Set if bit 7 set
        if (sum & 0x80) {
          this.setStatus(St.NEG);
        } else {
          this.clearStatus(St.NEG);
        }

        // Overflow Flag Set if sign bit is incorrect
        if ((this.A ^ sum) & (lo ^ sum) & 0x80) {
          this.setStatus(St.OVER);
        } else {
          this.clearStatus(St.OVER);
        }

        // Carry Set if value over 8 bits.
        if (sum > 0xff) {
          this.setStatus(St.CARRY);
        } else {
          this.clearStatus(St.CARRY);
        }

        this.A = sum & 0xff;
        break;
      case 0x88: // DEY
        // Subtracts one from the Y register setting the zero and negative flags as appropriate.
        this.Y--;
        if (this.Y === 0) {
          this.setStatus(St.ZERO);
        } else {
          this.clearStatus(St.ZERO);
        }
        // Negative FlagSet if bit 7 of Y is set
        if (this.Y & 0x80) {
          this.setStatus(St.NEG);
        } else {
          this.clearStatus(St.NEG);
        }
        break;
      case 0xd0: // BNE (loop)
        // read the offset
        lo = this.read(this.PC);
        this.PC++;
        // If the zero flag is clear then add the relative displacement to the program counter to cause a branch to a new location. Unsure how to do this
        if (!this.getStatus(St.ZERO)) {
          if (lo > 127) {
            lo -= 256;
          }
          this.PC += lo;
        }
        break;
      case 0x8d: // STA (absolute)
        // read the address
        lo = this.read(this.PC);
        this.PC++;
        hi = this.read(this.PC);
        this.PC++;
        addr = (hi << 8) | lo;
        // store the value at A into address
        this.write(addr, this.A);
        break;
      case 0xea: // NOP
        // No operation PC++ and nothing else
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
