// NES emulator

const { extensionSupported } = require("glfw-raub");

class Nes6502 {
  constructor(bus) {
    this.bus = bus;
    this.reset();
    this.lookup = {
      // nop
      0xea: [this.nop],
      // clear
      0x18: [this.flag, St.CARRY, true],
      0xd8: [this.flag, St.DEC, true],
      0x58: [this.flag, St.INTD, true],
      0xb8: [this.flag, St.OVER, true],
      // set
      0x38: [this.flag, St.CARRY, false],
      0xf8: [this.flag, St.DEC, false],
      0x78: [this.flag, St.INTD, false],
      // load
      0xa2: [this.load, Mode.IMM, "X", null, 2],
      0xa6: [this.load, Mode.ZERO, "X", null, 3],
      0xb6: [this.load, Mode.ZERO, "X", "Y", 4],
      0xae: [this.load, Mode.ABS, "X", null, 4],
      0xbe: [this.load, Mode.ABS, "X", "Y", 4], //+1 if page crossed
      0xa0: [this.load, Mode.IMM, "Y", null, 2],
      0xa4: [this.load, Mode.ZERO, "Y", null, 3],
      0xb4: [this.load, Mode.ZERO, "Y", "X", 4],
      0xac: [this.load, Mode.ABS, "Y", null, 4],
      0xbc: [this.load, Mode.ABS, "Y", "X", 4], //+1 if page crossed
      0xa9: [this.load, Mode.IMM, "A", null, 2],
      0xa5: [this.load, Mode.ZERO, "A", null, 3],
      0xb5: [this.load, Mode.ZERO, "A", "X", 4],
      0xad: [this.load, Mode.ABS, "A", null, 4],
      0xbd: [this.load, Mode.ABS, "A", "X", 4],
      0xb9: [this.load, Mode.ABS, "A", "Y", 4],
      0xa1: [this.load, Mode.IND, "A", "X", 6],
      0xb1: [this.load, Mode.IND, "A", "Y", 5],

      // store
      0x86: [this.store, Mode.ZERO, "X", null, 3],
      0x96: [this.store, Mode.ZERO, "X", "Y", 4],
      0x8e: [this.store, Mode.ABS, "X", null, 4],
      0x84: [this.store, Mode.ZERO, "Y", null, 3],
      0x94: [this.store, Mode.ZERO, "Y", "X", 4],
      0x8c: [this.store, Mode.ABS, "Y", null, 4],
      0x85: [this.store, Mode.ZERO, "A", null, 3],
      0x95: [this.store, Mode.ZERO, "A", "X", 4],
      0x8d: [this.store, Mode.ABS, "A", null, 4],
      0x9d: [this.store, Mode.ABS, "A", "X", 5],
      0x99: [this.store, Mode.ABS, "A", "Y", 5],
      0x81: [this.store, Mode.IND, "A", "X", 6],
      0x91: [this.store, Mode.IND, "A", "Y", 6],

      // tx

      // jmp

      // branch
      0x90: [this.branch, St.CARRY, true], // bcc
      0xb0: [this.branch, St.CARRY, false], // bcs
      0xd0: [this.branch, St.ZERO, true], // bne
      0xf0: [this.branch, St.ZERO, false], // beq
      0x10: [this.branch, St.NEG, true], // bpl
      0x30: [this.branch, St.NEG, false], // bmi
      0x50: [this.branch, St.OVER, true], // bvc
      0x70: [this.branch, St.OVER, false], // bvs

      // alu
      0x6d: [this.adc, Mode.ABS, "A", null, 4], // ADC absolute
      0x88: [this.dey, Mode.ABS, "A", null, 2], // Decrement Y

      // need to add rest of instructions from http://www.obelisk.me.uk/6502/reference.html#STX -- Ox is $
    };
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

  nop() {
    return 2;
  }

  flag(flag, clear) {
    if (clear) {
      this.clearStatus(flag);
    } else {
      this.setStatus(flag);
    }
    return 2;
  }

  load(mode, tgt, off, cycles) {
    if (mode == Mode.IMM) {
      this[tgt] = this.read(this.PC);
      this.PC++;
      return cycles;
    }
    let [addr, extra] = this.calc_address(mode, off);
    this[tgt] = this.read(addr);
    return cycles + extra;
  }

  store(mode, tgt, off, cycles) {
    let [addr, ,] = this.calc_address(mode, off);
    this.write(addr, this[tgt]);
    return cycles;
  }

  adc(mode, tgt, off, cycles) {
    // Add to accumulator with a Carry
    // This instruction adds the contents of a memory location to the accumulator together with the carry bit. If overflow occurs the carry bit is set, this enables multiple byte addition to be performed.
    let lo = this.read(this.PC);
    this.PC++;
    let hi = this.read(this.PC);
    this.PC++;
    let addr = (hi << 8) | lo;

    lo = this.read(addr);
    // the carry flag is bit 0 so we can use the value directly
    let sum = this.A + lo + (this.Status & St.CARRY);
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
    return cycles;
  }

  dey(mode, tgt, off, cycles) {
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
    return cycles;
  }

  branch(flag, invert) {
    // read the ofset
    let lo = this.read(this.PC);
    this.PC++;
    let cycles = 2;
    if (this.getStatus(flag) ^ invert) {
      cycles += 1; // if branch succeeds +1
      if (lo > 127) {
        lo -= 256;
      }
      let hi = this.PC >> 8;
      this.PC += lo;
      if (this.PC >> 8 != hi) {
        cycles += 1; // if new page +1
      }
    }
    return cycles;
  }

  calc_address(mode, off) {
    let addr = 0;
    let first = this.read(this.PC);
    let hi = 0;
    let extra = 0;
    this.PC++;
    switch (mode) {
      case Mode.ZERO:
        addr = first;
        if (off === "X") {
          addr += this.X;
        } else if (off === "Y") {
          addr += this.Y;
        }
        addr &= 0xff;
        break;
      case Mode.ABS:
        hi = this.read(this.PC);
        this.PC++;
        addr = (hi << 8) | first;
        if (off === "X") {
          addr += this.X;
        } else if (off === "Y") {
          addr += this.Y;
        }
        // check page cross
        if (addr >> 8 > hi) {
          extra = 1;
        }
        break;
      case Mode.IND:
        if (off === "X") {
          let ind = (first + this.X) & 0xff;
          let lo = this.read(first + ind);
          let hi = this.read(first + ind + 1);
          addr = (hi << 8) | lo;
        } else {
          let lo = this.read(first);
          let hi = this.read(first + 1);
          addr = ((hi << 8) | lo) + this.Y;
          // check page cross
          if (addr >> 8 > hi) {
            extra = 1;
          }
        }
        break;
    }
    return [addr, extra];
  }

  execute(ins) {
    let parts = this.lookup[ins];
    if (parts !== undefined) {
      let [fn, ...args] = parts;
      return fn.apply(this, args);
    }
    console.log("unknown instruction");
    process.exit(1);
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

const Mode = {
  IMM: 1 << 0,
  ZERO: 1 << 1,
  ABS: 1 << 2,
  IND: 1 << 3,
  ACC: 1 << 4,
};

module.exports = Nes6502;
