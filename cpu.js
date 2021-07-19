// NES emulator

class Nes6502 {
  constructor(bus) {
    this.bus = bus;
    this.reset();
    this.lookup = {
      // nop
      0xea: [this.nop],
      // BIT This instructions is used to test if one or more bits are set in a target memory location. The mask pattern in A is ANDed with the value in memory to set or clear the zero flag, but the result is not kept. Bits 7 and 6 of the value from memory are copied into the N and V flags.
      0x24: [this.bit, Mode.ZERO, 3],
      0x2c: [this.bit, Mode.ABS, 4],

      // The BRK instruction forces the generation of an interrupt request. The program counter and processor status are pushed on the stack then the IRQ interrupt vector at $FFFE/F is loaded into the PC and the break flag in the status set to one.
      // 0x00: [this.brk, Mode.IMP, 7],

      // clear; CLC CLD CLI CLV
      0x18: [this.flag, St.CARRY, true],
      0xd8: [this.flag, St.DEC, true],
      0x58: [this.flag, St.INTD, true],
      0xb8: [this.flag, St.OVER, true],
      // set; SEC SED SEI
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
      0xaa: [this.tx, "A", "X"], // tax
      0xa8: [this.tx, "A", "Y"], // tay
      0xba: [this.tx, "Stack", "X"], // tsx
      0x8a: [this.tx, "X", "A"], // txa
      0x9a: [this.tx, "X", "Stack"], // txs
      0x98: [this.tx, "Y", "A"], // tya

      // jmp, jsr
      0x4c: [this.jmp, Mode.ABS, 3], // JMP absolute. Sets the program counter to the address specified by the operand.
      0x6c: [this.jmp, Mode.IND, 5], // JMP indirect. Sets the program counter to the address specified by the operand.
      0x20: [this.jsr], // JSR. The JSR instruction pushes the address (minus one) of the return point on to the stack and then sets the program counter to the target memory address.

      //rti (return from interrupt)
      0x40: [this.rti], // The RTI instruction is used at the end of an interrupt processing routine. It pulls the processor flags from the stack followed by the program counter.

      //rts (return from subroutine)
      0x60: [this.rts], // The RTS instruction is used at the end of a subroutine to return to the calling routine. It pulls the program counter (minus one) from the stack.

      //push
      //PHA: Pushes a copy of the accumulator on to the stack.
      0x48: [this.push, "A"], //3 cycles
      //PHP: Pushes a copy of the status flags on to the stack.
      0x08: [this.push, "Status"], //3 cycles

      //pull
      //PLA: Pulls an 8 bit value from the stack and into the accumulator. The zero and negative flags are set as appropriate
      0x68: [this.pull, "A"], //4 cycles
      //PLP: Pulls an 8 bit value from the stack and into the processor flags. The flags will take on new states as determined by the value pulled.
      0x28: [this.pull, "Status"], //4 cycles

      // branch
      0x90: [this.branch, St.CARRY, true], // bcc
      0xb0: [this.branch, St.CARRY, false], // bcs
      0xd0: [this.branch, St.ZERO, true], // bne
      0xf0: [this.branch, St.ZERO, false], // beq
      0x10: [this.branch, St.NEG, true], // bpl
      0x30: [this.branch, St.NEG, false], // bmi
      0x50: [this.branch, St.OVER, true], // bvc
      0x70: [this.branch, St.OVER, false], // bvs

      // adc
      0x69: [this.addSub, false, Mode.IMM, null, 2],
      0x65: [this.addSub, false, Mode.ZERO, null, 3],
      0x75: [this.addSub, false, Mode.ZERO, "X", 4],
      0x6d: [this.addSub, false, Mode.ABS, null, 4],
      0x7d: [this.addSub, false, Mode.ABS, "X", 4], // +1 if page crossed
      0x79: [this.addSub, false, Mode.ABS, "Y", 4], // +1 if page crossed
      0x61: [this.addSub, false, Mode.IND, "X", 6],
      0x71: [this.addSub, false, Mode.IND, "Y", 5], // +1 if page crossed

      // sbc
      0xe9: [this.addSub, true, Mode.IMM, null, 2],
      0xe5: [this.addSub, true, Mode.ZERO, null, 3],
      0xf5: [this.addSub, true, Mode.ZERO, "X", 4],
      0xed: [this.addSub, true, Mode.ABS, null, 4],
      0xfd: [this.addSub, true, Mode.ABS, "X", 4], // +1 if page crossed
      0xf9: [this.addSub, true, Mode.ABS, "Y", 4], // +1 if page crossed
      0xe1: [this.addSub, true, Mode.IND, "X", 6],
      0xf1: [this.addSub, true, Mode.IND, "Y", 5], // +1 if page crossed

      // and
      0x29: [this.and, Mode.IMM, null, 2],
      0x25: [this.and, Mode.ZERO, null, 3],
      0x35: [this.and, Mode.ZERO, "X", 4],
      0x2d: [this.and, Mode.ABS, null, 4],
      0x3d: [this.and, Mode.ABS, "X", 4], // +1 if page crossed
      0x39: [this.and, Mode.ABS, "Y", 4], // +1 if page crossed
      0x21: [this.and, Mode.IND, "X", 6],
      0x31: [this.and, Mode.IND, "Y", 5], // +1 if page crossed
      // eor (xor)
      0x49: [this.xor, Mode.IMM, null, 2],
      0x45: [this.xor, Mode.ZERO, null, 3],
      0x55: [this.xor, Mode.ZERO, "X", 4],
      0x4d: [this.xor, Mode.ABS, null, 4],
      0x5d: [this.xor, Mode.ABS, "X", 4], // +1 if page crossed
      0x59: [this.xor, Mode.ABS, "Y", 4], // +1 if page crossed
      0x41: [this.xor, Mode.IND, "X", 6],
      0x51: [this.xor, Mode.IND, "Y", 5], // +1 if page crossed
      // ora
      0x09: [this.or, Mode.IMM, null, 2],
      0x05: [this.or, Mode.ZERO, null, 3],
      0x15: [this.or, Mode.ZERO, "X", 4],
      0x0d: [this.or, Mode.ABS, null, 4],
      0x1d: [this.or, Mode.ABS, "X", 4], // +1 if page crossed
      0x19: [this.or, Mode.ABS, "Y", 4], // +1 if page crossed
      0x01: [this.or, Mode.IND, "X", 6],
      0x11: [this.or, Mode.IND, "Y", 5], // +1 if page crossed

      // cmp
      0xc9: [this.cmp, Mode.IMM, "A", null, 2], //IMM. 2 cyc
      0xc5: [this.cmp, Mode.ZERO, "A", null, 3], //zero page. 3 cyc
      0xd5: [this.cmp, Mode.ZERO, "A", "X", 4], //zero page, X
      0xcd: [this.cmp, Mode.ABS, "A", null, 4], //ABS
      0xdd: [this.cmp, Mode.ABS, "A", "X", 4], //ABS, X +1 cycle if page cross
      0xd9: [this.cmp, Mode.ABS, "A", "Y", 4], //ABS, Y +1 cycle if page cross
      0xc1: [this.cmp, Mode.IND, "A", "X", 6], //IND, X
      0xd1: [this.cmp, Mode.IND, "A", "Y", 5], //IND, Y +1 cycle if page cross
      //cpx
      0xe0: [this.cmp, Mode.IMM, "X", null, 2], //IMM, compare X with another value
      0xe4: [this.cmp, Mode.ZERO, "X", null, 3], //ZERO, compare X with another value
      0xec: [this.cmp, Mode.ABS, "X", null, 4], //ABS, compare X with another value
      //cpy
      0xc0: [this.cmp, Mode.IMM, "Y", null, 2], //IMM, compare Y with another value
      0xc4: [this.cmp, Mode.ZERO, "Y", null, 3], //ZERO, compare Y with another value
      0xcc: [this.cmp, Mode.ABS, "Y", null, 4], //ABS, compare Y with another value

      // asl
      0x0a: [this.log, this.asl, Mode.ACC, null, 2],
      0x06: [this.log, this.asl, Mode.ZERO, null, 5],
      0x16: [this.log, this.asl, Mode.ZERO, "X", 6],
      0x0e: [this.log, this.asl, Mode.ABS, null, 6],
      0x1e: [this.log, this.asl, Mode.ABS, "X", 7],
      // lsr
      0x4a: [this.log, this.lsr, Mode.ACC, null, 2],
      0x46: [this.log, this.lsr, Mode.ZERO, null, 5],
      0x56: [this.log, this.lsr, Mode.ZERO, "X", 6],
      0x4e: [this.log, this.lsr, Mode.ABS, null, 6],
      0x5e: [this.log, this.lsr, Mode.ABS, "X", 7],
      // rol
      0x2a: [this.log, this.rol, Mode.ACC, null, 2],
      0x26: [this.log, this.rol, Mode.ZERO, null, 5],
      0x36: [this.log, this.rol, Mode.ZERO, "X", 6],
      0x2e: [this.log, this.rol, Mode.ABS, null, 6],
      0x3e: [this.log, this.rol, Mode.ABS, "X", 7],
      // ror
      0x6a: [this.log, this.ror, Mode.ACC, null, 2],
      0x66: [this.log, this.ror, Mode.ZERO, null, 5],
      0x76: [this.log, this.ror, Mode.ZERO, "X", 6],
      0x6e: [this.log, this.ror, Mode.ABS, null, 6],
      0x7e: [this.log, this.ror, Mode.ABS, "X", 7],

      // inc/dec
      0xe6: [this.incDec, Mode.ZERO, true, null, 5],
      0xf6: [this.incDec, Mode.ZERO, true, "X", 6],
      0xee: [this.incDec, Mode.ABS, true, null, 6],
      0xfe: [this.incDec, Mode.ABS, true, "X", 7],
      0xc6: [this.incDec, Mode.ZERO, false, null, 5],
      0xd6: [this.incDec, Mode.ZERO, false, "X", 6],
      0xce: [this.incDec, Mode.ABS, false, null, 6],
      0xde: [this.incDec, Mode.ABS, false, "X", 7],
      0xe8: [this.incReg, "X"], // inx
      0xc8: [this.incReg, "Y"], // iny
      0xca: [this.decReg, "X"], // dex
      0x88: [this.decReg, "Y"], // dey

      // need to add rest of instructions from http://www.obelisk.me.uk/6502/reference.html#STX -- Ox is $
    };
  }

  reset() {
    this.A = 0x00; // 8-bit accumulator
    this.X = 0x00; // 8-bit x register
    this.Y = 0x00; // 8-bit y register
    this.Stack = 0xff; // 8-bit stack
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
    let [addr, extra] = this.calcAddress(mode, off);
    this[tgt] = this.read(addr);
    return cycles + extra;
  }

  store(mode, tgt, off, cycles) {
    let [addr, ,] = this.calcAddress(mode, off);
    this.write(addr, this[tgt]);
    return cycles;
  }

  readAddr() {
    let lo = this.read(this.PC);
    this.PC++;
    let hi = this.read(this.PC);
    this.PC++;
    return (hi << 8) | lo;
  }

  getVal(mode, off) {
    let addr = 0;
    let extra = 0;
    if (mode == Mode.IMM) {
      addr = this.PC;
      this.PC++;
    } else {
      [addr, extra] = this.calcAddress(mode, off);
    }
    return [this.read(addr), extra];
  }

  addSub(sub, mode, off, cycles) {
    let [val, extra] = this.getVal(mode, off);
    console.log(val);
    // the carry flag is bit 0 so we can use the value directly
    if (sub) {
      val ^= 0xff;
    }
    let sum = this.A + val + (this.Status & St.CARRY);
    this.setFlags(sum);

    // Overflow Flag Set if sign bit is incorrect
    // check if this val is correct for sub
    if ((this.A ^ sum) & (val ^ sum) & 0x80) {
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
    return cycles + extra;
  }

  bit(mode, off, cycles) {
    let [val, ,] = this.getVal(mode, off);
    // the carry flag is bit 0 so we can use the value directly
    let tmp = this.A & val;
    this.setFlags(tmp);
    return cycles;
  }

  and(mode, off, cycles) {
    let [val, extra] = this.getVal(mode, off);
    // the carry flag is bit 0 so we can use the value directly
    this.A = this.A & val;
    this.setFlags(this.A);
    return cycles + extra;
  }

  xor(mode, off, cycles) {
    let [val, extra] = this.getVal(mode, off);
    // the carry flag is bit 0 so we can use the value directly
    this.A = this.A ^ val;
    this.setFlags(this.A);
    return cycles + extra;
  }

  or(mode, off, cycles) {
    let [val, extra] = this.getVal(mode, off);
    // the carry flag is bit 0 so we can use the value directly
    this.A = this.A | val;
    this.setFlags(this.A);
    return cycles + extra;
  }

  log(mode, opfn, off, cycles) {
    let addr = 0;
    let val = 0;
    if (mode == Mode.ACC) {
      val = this.A;
    } else {
      [addr, ,] = this.calcAddress(mode, off);
      val = this.read(addr);
    }
    let res = opfn.call(this, val);
    this.setFlags(res);
    if (mode == Mode.ACC) {
      this.A = res;
    } else {
      this.write(addr, val);
    }
    return cycles;
  }

  asl(val) {
    let res = val << 1;
    if (res > 0xff) {
      this.setStatus(St.CARRY);
    } else {
      this.clearStatus(St.CARRY);
    }
    return res & 0xff;
  }

  lsr(val) {
    if (val & 0x01) {
      this.setStatus(St.CARRY);
    } else {
      this.clearStatus(St.CARRY);
    }
    return val >> 1;
  }

  rol(val) {
    let carry = this.getStatus(St.CARRY);
    let res = this.asl(val);
    if (carry) {
      res &= 0x01;
    }
    return res;
  }

  ror(val) {
    let carry = this.getStatus(St.CARRY);
    let res = this.lsr(val);
    if (carry) {
      res &= 0x80;
    }
    return res;
  }

  cmp(mode, tgt, off, cycles) {
    let [val, extra] = this.getVal(mode, off);

    // Zero Flag Set if tgt = val
    if (this[tgt] == val) {
      this.setStatus(St.ZERO);
    } else {
      this.clearStatus(St.ZERO);
    }
    // 0x80 the top bit  is 10000000b
    // Negative Flag	Set if bit 7 set
    if (val & 0x80) {
      this.setStatus(St.NEG);
    } else {
      this.clearStatus(St.NEG);
    }
    // Carry Set if tgt >= val.
    if (this[tgt] >= val) {
      this.setStatus(St.CARRY);
    } else {
      this.clearStatus(St.CARRY);
    }

    return cycles + extra;
  }

  incDec(mode, dir, off, cycles) {
    let [addr, ,] = this.calcAddress(mode, off);
    let val = this.read(addr);
    if (dir) {
      val++;
    } else {
      val--;
    }
    this.setFlags(val);
    this.write(addr, val);
    return cycles;
  }

  incReg(reg) {
    // Adds one to the register setting the zero and negative flags as appropriate.
    this[reg]++;
    this.setFlags(this[reg]);
    return 2;
  }

  decReg(reg) {
    // Subtracts one from the register setting the zero and negative flags as appropriate.
    this[reg]--;
    this.setFlags(this[reg]);
    return 2;
  }

  tx(source, destination) {
    this[destination] = this[source];
    if (destination != "Stack") {
      //TXS is only one that says not to set flags.
      this.setFlags(destination);
    }
    return 2;
  }

  push(source) {
    this.write(0x100 & this.Stack, this[source]);
    this.Stack--;
    return 3;
  }

  pull(source) {
    this.Stack++;
    this[source] = this.read(0x100 & this.Stack);
    if (source == "A") {
      this.setFlags(source);
    }
    return 4;
  }

  jmp(mode, cycles) {
    let addr = this.readAddr();
    if (mode === mode.IND) {
      // handle the bug in 6502
      let second = 0;
      if (addr & (0xff === 0xff)) {
        second = addr & 0xff00;
      } else {
        second = addr + 1;
      }
      let lo = this.read(addr);
      let hi = this.read(second);
      addr = (hi << 8) | lo;
    }
    this.PC = addr;
    return cycles;
  }

  jsr() {
    let ret = this.PC - 1;
    this.write(0x100 & this.Stack, ret >> 8);
    this.Stack--;
    this.write(0x100 & this.Stack, ret & 0xff);
    this.Stack--;
    return this.jmp(Mode.ABS, 6);
  }

  rti() {
    this.pull("Status", 6);
    return this.rts();
  }

  rts() {
    this.Stack++;
    let lo = this.read(0x100 & this.Stack);
    this.Stack++;
    let hi = this.read(0x100 & this.Stack);
    this.PC = ((hi << 8) | lo) + 1;
    return 6;
  }

  setFlags(val) {
    if (val === 0) {
      this.setStatus(St.ZERO);
    } else {
      this.clearStatus(St.ZERO);
    }
    if (val & 0x80) {
      this.setStatus(St.NEG);
    } else {
      this.clearStatus(St.NEG);
    }
  }

  branch(flag, invert) {
    // read the offset
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

  calcAddress(mode, off) {
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
      console.log(ins);
      console.log(parts);
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
