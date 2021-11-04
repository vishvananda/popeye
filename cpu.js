// NES emulator
function toHex8(val) {
  return ("00" + val.toString(16).toUpperCase()).slice(-2);
}
function toHex16(val) {
  return ("0000" + val.toString(16).toUpperCase()).slice(-4);
}

class Nes6502 {
  constructor(bus) {
    this.bus = bus;
    let indx = "($%1,X) @ %x = %abs = %v";
    let indy = "($%1),Y = %yyy @ %abs = %v";
    this.lookup = {
      // nop
      0xea: ["NOP", 1, this.nop],
      // BIT This instructions is used to test if one or more bits are set in a target memory location. The mask pattern in A is ANDed with the value in memory to set or clear the zero flag, but the result is not kept. Bits 7 and 6 of the value from memory are copied into the N and V flags.
      0x24: ["BIT $%1 = %v", 2, this.bit, Mode.ZERO, 3],
      0x2c: ["BIT $%2%1 = %v", 3, this.bit, Mode.ABS, 4],

      // The BRK instruction forces the generation of an interrupt request. The program counter and processor status are pushed on the stack then the IRQ interrupt vector at $FFFE/F is loaded into the PC and the break flag in the status set to one.
      // 0x00: [this.brk, Mode.IMP, 7],

      // clears
      0x18: ["CLC", 1, this.flag, St.CARRY, true],
      0xd8: ["CLD", 1, this.flag, St.DEC, true],
      0x58: ["CLI", 1, this.flag, St.INTD, true],
      0xb8: ["CLV", 1, this.flag, St.OVER, true],
      // sets
      0x38: ["SEC", 1, this.flag, St.CARRY, false],
      0xf8: ["SED", 1, this.flag, St.DEC, false],
      0x78: ["SEI", 1, this.flag, St.INTD, false],
      // loads
      0xa2: ["LDX #$%1", 2, this.load, Mode.IMM, "X", null, 2],
      0xa6: ["LDX $%1 = %v", 2, this.load, Mode.ZERO, "X", null, 3],
      0xb6: ["LDX $%1,Y @ %r = %v", 2, this.load, Mode.ZERO, "X", "Y", 4],
      0xae: ["LDX $%2%1 = %v", 3, this.load, Mode.ABS, "X", null, 4],
      0xbe: ["LDX $%2%1,Y @ %abs = %v", 3, this.load, Mode.ABS, "X", "Y", 4], //+1 if page crossed
      0xa0: ["LDY #$%1", 2, this.load, Mode.IMM, "Y", null, 2],
      0xa4: ["LDY $%1 = %v", 2, this.load, Mode.ZERO, "Y", null, 3],
      0xb4: ["LDY $%1,X @ %r = %v", 2, this.load, Mode.ZERO, "Y", "X", 4],
      0xac: ["LDY $%2%1 = %v", 3, this.load, Mode.ABS, "Y", null, 4],
      0xbc: ["LDY $%2%1,X @ %abs = %v", 3, this.load, Mode.ABS, "Y", "X", 4], //+1 if page crossed
      0xa9: ["LDA #$%1", 2, this.load, Mode.IMM, "A", null, 2],
      0xa5: ["LDA $%1 = %v", 2, this.load, Mode.ZERO, "A", null, 3],
      0xb5: ["LDA $%1,X @ %r = %v", 2, this.load, Mode.ZERO, "A", "X", 4],
      0xad: ["LDA $%2%1 = %v", 3, this.load, Mode.ABS, "A", null, 4],
      0xbd: ["LDA $%2%1,X @ %abs = %v", 3, this.load, Mode.ABS, "A", "X", 4],
      0xb9: ["LDA $%2%1,Y @ %abs = %v", 3, this.load, Mode.ABS, "A", "Y", 4],
      0xa1: [`LDA ${indx}`, 2, this.load, Mode.IND, "A", "X", 6],
      0xb1: [`LDA ${indy}`, 2, this.load, Mode.IND, "A", "Y", 5],

      // stores
      0x86: ["STX $%1 = %v", 2, this.store, Mode.ZERO, "X", null, 3],
      0x96: ["STX $%1,Y @ %r = %v", 2, this.store, Mode.ZERO, "X", "Y", 4],
      0x8e: ["STX $%2%1 = %v", 3, this.store, Mode.ABS, "X", null, 4],
      0x84: ["STY $%1 = %v", 2, this.store, Mode.ZERO, "Y", null, 3],
      0x94: ["STY $%1,X @ %r = %v", 2, this.store, Mode.ZERO, "Y", "X", 4],
      0x8c: ["STY $%2%1 = %v", 3, this.store, Mode.ABS, "Y", null, 4],
      0x85: ["STA $%1 = %v", 2, this.store, Mode.ZERO, "A", null, 3],
      0x95: ["STA $%1,X @ %r = %v", 2, this.store, Mode.ZERO, "A", "X", 4],
      0x8d: ["STA $%2%1 = %v", 3, this.store, Mode.ABS, "A", null, 4],
      0x9d: ["STA $%2%1,X @ %abs = %v", 3, this.store, Mode.ABS, "A", "X", 5],
      0x99: ["STA $%2%1,Y @ %abs = %v", 3, this.store, Mode.ABS, "A", "Y", 5],
      0x81: [`STA ${indx}`, 2, this.store, Mode.IND, "A", "X", 6],
      0x91: [`STA ${indy}`, 2, this.store, Mode.IND, "A", "Y", 6],

      // transfers
      0xaa: ["TAX", 1, this.tx, "A", "X"],
      0xa8: ["TAY", 1, this.tx, "A", "Y"],
      0xba: ["TSX", 1, this.tx, "Stack", "X"],
      0x8a: ["TXA", 1, this.tx, "X", "A"],
      0x9a: ["TXS", 1, this.tx, "X", "Stack"],
      0x98: ["TYA", 1, this.tx, "Y", "A"],

      // jumps
      0x4c: ["JMP $%2%1", 3, this.jmp, Mode.ABS, 3], // JMP absolute. Sets the program counter to the address specified by the operand.
      0x6c: ["JMP ($%2%1) = %abs", 3, this.jmp, Mode.IND, 5], // JMP indirect. Sets the program counter to the address specified by the operand.
      0x20: ["JSR $%2%1", 3, this.jsr], // JSR. The JSR instruction pushes the address (minus one) of the return point on to the stack and then sets the program counter to the target memory address.

      // returns
      0x40: ["RTI", 1, this.rti], // The RTI instruction is used at the end of an interrupt processing routine. It pulls the processor flags from the stack followed by the program counter.
      0x60: ["RTS", 1, this.rts], // The RTS instruction is used at the end of a subroutine to return to the calling routine. It pulls the program counter (minus one) from the stack.

      //push
      0x48: ["PHA", 1, this.push, "A"],
      0x08: ["PHP", 1, this.push, "Status"],

      //pull
      0x68: ["PLA", 1, this.pull, "A"],
      0x28: ["PLP", 1, this.pull, "Status"],

      // branch
      0x90: ["BCC $%abs", 2, this.branch, St.CARRY, true],
      0xb0: ["BCS $%abs", 2, this.branch, St.CARRY, false],
      0xd0: ["BNE $%abs", 2, this.branch, St.ZERO, true],
      0xf0: ["BEQ $%abs", 2, this.branch, St.ZERO, false],
      0x10: ["BPL $%abs", 2, this.branch, St.NEG, true],
      0x30: ["BMI $%abs", 2, this.branch, St.NEG, false],
      0x50: ["BVC $%abs", 2, this.branch, St.OVER, true],
      0x70: ["BVS $%abs", 2, this.branch, St.OVER, false],

      // adc
      0x69: ["ADC #$%1", 2, this.add, false, Mode.IMM, null, 2],
      0x65: ["ADC $%1 = %v", 2, this.add, false, Mode.ZERO, null, 3],
      0x75: ["ADC $%1,X @ %r = %v", 2, this.add, false, Mode.ZERO, "X", 4],
      0x6d: ["ADC $%2%1 = %v", 3, this.add, false, Mode.ABS, null, 4],
      0x7d: ["ADC $%2%1,X @ %abs = %v", 3, this.add, false, Mode.ABS, "X", 4], // +1 if page crossed
      0x79: ["ADC $%2%1,Y @ %abs = %v", 3, this.add, false, Mode.ABS, "Y", 4], // +1 if page crossed
      0x61: [`ADC ${indx}`, 2, this.add, false, Mode.IND, "X", 6],
      0x71: [`ADC ${indy}`, 2, this.add, false, Mode.IND, "Y", 5], // +1 if page crossed

      // sbc
      0xe9: ["SBC #$%1", 2, this.add, true, Mode.IMM, null, 2],
      0xe5: ["SBC $%1 = %v", 2, this.add, true, Mode.ZERO, null, 3],
      0xf5: ["SBC $%1,X @ %r = %v", 2, this.add, true, Mode.ZERO, "X", 4],
      0xed: ["SBC $%2%1 = %v", 3, this.add, true, Mode.ABS, null, 4],
      0xfd: ["SBC $%2%1,X @ %abs = %v", 3, this.add, true, Mode.ABS, "X", 4], // +1 if page crossed
      0xf9: ["SBC $%2%1,Y @ %abs = %v", 3, this.add, true, Mode.ABS, "Y", 4], // +1 if page crossed
      0xe1: [`SBC ${indx}`, 2, this.add, true, Mode.IND, "X", 6],
      0xf1: [`SBC ${indy}`, 2, this.add, true, Mode.IND, "Y", 5], // +1 if page crossed

      // logical
      0x29: ["AND #$%1", 2, this.and, Mode.IMM, null, 2],
      0x25: ["AND $%1 = %v", 2, this.and, Mode.ZERO, null, 3],
      0x35: ["AND $%1,X @ %r = %v", 2, this.and, Mode.ZERO, "X", 4],
      0x2d: ["AND $%2%1 = %v", 3, this.and, Mode.ABS, null, 4],
      0x3d: ["AND $%2%1,X @ %abs = %v", 3, this.and, Mode.ABS, "X", 4], // +1 if page crossed
      0x39: ["AND $%2%1,Y @ %abs = %v", 3, this.and, Mode.ABS, "Y", 4], // +1 if page crossed
      0x21: [`AND ${indx}`, 2, this.and, Mode.IND, "X", 6],
      0x31: [`AND ${indy}`, 2, this.and, Mode.IND, "Y", 5], // +1 if page crossed
      0x49: ["EOR #$%1", 2, this.xor, Mode.IMM, null, 2],
      0x45: ["EOR $%1 = %v", 2, this.xor, Mode.ZERO, null, 3],
      0x55: ["EOR $%1,X @ %r = %v", 2, this.xor, Mode.ZERO, "X", 4],
      0x4d: ["EOR $%2%1 = %v", 3, this.xor, Mode.ABS, null, 4],
      0x5d: ["EOR $%2%1,X @ %abs = %v", 3, this.xor, Mode.ABS, "X", 4], // +1 if page crossed
      0x59: ["EOR $%2%1,Y @ %abs = %v", 3, this.xor, Mode.ABS, "Y", 4], // +1 if page crossed
      0x41: [`EOR ${indx}`, 2, this.xor, Mode.IND, "X", 6],
      0x51: [`EOR ${indy}`, 2, this.xor, Mode.IND, "Y", 5], // +1 if page crossed
      0x09: ["ORA #$%1", 2, this.or, Mode.IMM, null, 2],
      0x05: ["ORA $%1 = %v", 2, this.or, Mode.ZERO, null, 3],
      0x15: ["ORA $%1,X @ %r = %v", 2, this.or, Mode.ZERO, "X", 4],
      0x0d: ["ORA $%2%1 = %v", 3, this.or, Mode.ABS, null, 4],
      0x1d: ["ORA $%2%1,X @ %abs = %v", 3, this.or, Mode.ABS, "X", 4], // +1 if page crossed
      0x19: ["ORA $%2%1,Y @ %abs = %v", 3, this.or, Mode.ABS, "Y", 4], // +1 if page crossed
      0x01: [`ORA ${indx}`, 2, this.or, Mode.IND, "X", 6],
      0x11: [`ORA ${indy}`, 2, this.or, Mode.IND, "Y", 5], // +1 if page crossed

      // comparison
      0xc9: ["CMP #$%1", 2, this.cmp, Mode.IMM, "A", null, 2], //IMM. 2 cyc
      0xc5: ["CMP $%1 = %v", 2, this.cmp, Mode.ZERO, "A", null, 3], //zero page. 3 cyc
      0xd5: ["CMP $%1,X @ %r = %v", 2, this.cmp, Mode.ZERO, "A", "X", 4], //zero page, X
      0xcd: ["CMP $%2%1 = %v", 3, this.cmp, Mode.ABS, "A", null, 4], //ABS
      0xdd: ["CMP $%2%1,X @ %abs = %v", 3, this.cmp, Mode.ABS, "A", "X", 4], //ABS, X +1 cycle if page cross
      0xd9: ["CMP $%2%1,Y @ %abs = %v", 3, this.cmp, Mode.ABS, "A", "Y", 4], //ABS, Y +1 cycle if page cross
      0xc1: [`CMP ${indx}`, 2, this.cmp, Mode.IND, "A", "X", 6], //IND, X
      0xd1: [`CMP ${indy}`, 2, this.cmp, Mode.IND, "A", "Y", 5], //IND, Y +1 cycle if page cross
      0xe0: ["CPX #$%1", 2, this.cmp, Mode.IMM, "X", null, 2], //IMM, compare X with another value
      0xe4: ["CPX $%1 = %v", 2, this.cmp, Mode.ZERO, "X", null, 3], //ZERO, compare X with another value
      0xec: ["CPX $%2%1 = %v", 3, this.cmp, Mode.ABS, "X", null, 4], //ABS, compare X with another value
      0xc0: ["CPY #$%1", 2, this.cmp, Mode.IMM, "Y", null, 2], //IMM, compare Y with another value
      0xc4: ["CPY $%1 = %v", 2, this.cmp, Mode.ZERO, "Y", null, 3], //ZERO, compare Y with another value
      0xcc: ["CPY $%2%1 = %v", 3, this.cmp, Mode.ABS, "Y", null, 4], //ABS, compare Y with another value

      // shifts
      0x0a: ["ASL A", 1, this.sh, this.asl, Mode.ACC, null, 2],
      0x06: ["ASL $%1 = %v", 2, this.sh, this.asl, Mode.ZERO, null, 5],
      0x16: ["ASL $%1,X @ %r = %v", 2, this.sh, this.asl, Mode.ZERO, "X", 6],
      0x0e: ["ASL $%2%1 = %v", 3, this.sh, this.asl, Mode.ABS, null, 6],
      0x1e: ["ASL $%2%1,X @ %abs = %v", 3, this.sh, this.asl, Mode.ABS, "X", 7],
      0x4a: ["LSR A", 1, this.sh, this.lsr, Mode.ACC, null, 2],
      0x46: ["LSR $%1 = %v", 2, this.sh, this.lsr, Mode.ZERO, null, 5],
      0x56: ["LSR $%1,X @ %r = %v", 2, this.sh, this.lsr, Mode.ZERO, "X", 6],
      0x4e: ["LSR $%2%1 = %v", 3, this.sh, this.lsr, Mode.ABS, null, 6],
      0x5e: ["LSR $%2%1,X @ %abs = %v", 3, this.sh, this.lsr, Mode.ABS, "X", 7],
      0x2a: ["ROL A", 1, this.sh, this.rol, Mode.ACC, null, 2],
      0x26: ["ROL $%1 = %v", 2, this.sh, this.rol, Mode.ZERO, null, 5],
      0x36: ["ROL $%1,X @ %r = %v", 2, this.sh, this.rol, Mode.ZERO, "X", 6],
      0x2e: ["ROL $%2%1 = %v", 3, this.sh, this.rol, Mode.ABS, null, 6],
      0x3e: ["ROL $%2%1,X @ %abs = %v", 3, this.sh, this.rol, Mode.ABS, "X", 7],
      0x6a: ["ROR A", 1, this.sh, this.ror, Mode.ACC, null, 2],
      0x66: ["ROR $%1 = %v", 2, this.sh, this.ror, Mode.ZERO, null, 5],
      0x76: ["ROR $%1,X @ %r = %v", 2, this.sh, this.ror, Mode.ZERO, "X", 6],
      0x6e: ["ROR $%2%1 = %v", 3, this.sh, this.ror, Mode.ABS, null, 6],
      0x7e: ["ROR $%2%1,X @ %abs = %v", 3, this.sh, this.ror, Mode.ABS, "X", 7],

      // inc/dec
      0xe6: ["INC $%1 = %v", 2, this.inc, Mode.ZERO, true, null, 5],
      0xf6: ["INC $%1,X @ %r = %v", 2, this.inc, Mode.ZERO, true, "X", 6],
      0xee: ["INC $%2%1 = %v", 3, this.inc, Mode.ABS, true, null, 6],
      0xfe: ["INC $%2%1,X @ %abs = %v", 3, this.inc, Mode.ABS, true, "X", 7],
      0xc6: ["DEC $%1 = %v", 2, this.inc, Mode.ZERO, false, null, 5],
      0xd6: ["DEC $%1,X @ %r = %v", 2, this.inc, Mode.ZERO, false, "X", 6],
      0xce: ["DEC $%2%1 = %v", 3, this.inc, Mode.ABS, false, null, 6],
      0xde: ["DEC $%2%1,X @ %abs = %v", 3, this.inc, Mode.ABS, false, "X", 7],
      0xe8: ["INX", 1, this.incReg, "X"],
      0xc8: ["INY", 1, this.incReg, "Y"],
      0xca: ["DEX", 1, this.decReg, "X"],
      0x88: ["DEY", 1, this.decReg, "Y"],

      // need to add rest of instructions from http://www.obelisk.me.uk/6502/reference.html#STX -- Ox is $
    };
  }

  reset() {
    // for logging
    this.addr = 0; // stores last memory address location
    this.last = 0; // stores value of last memory address location
    this.ind = 0; // stores the indirect location

    this.A = 0x00; // 8-bit accumulator
    this.X = 0x00; // 8-bit x register
    this.Y = 0x00; // 8-bit y register
    this.Status = 0x00 | St.UN | St.INTD; // 8-bit flags

    let abs = 0xfffc;
    let lo = this.read(abs + 0);
    let hi = this.read(abs + 1);
    this.PC = (hi << 8) | lo; // 16-bit program counter

    // emulate the interrupt handling code
    this.Stack = 0xfd; // 8-bit stack
    // reset takes 7 cycles (execution happens on remaining == 0)
    this.remaining = 6;
    this.cycles = 0;
  }

  storeLogVars(addr) {
    this.addr = addr;
    if (addr >= 0x0000 && addr <= 0x1fff) {
      this.last = this.read(addr);
    } else {
      this.last = 0;
    }
    if (this.last === undefined) {
      console.log("Undefined value at ", addr);
    }
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

  nmi() {
    this.write(0x100 | this.Stack, this.PC >> 8);
    this.Stack--;
    this.write(0x100 | this.Stack, this.PC & 0xff);
    this.Stack--;

    this.clearStatus(St.BREAK);
    this.setStatus(St.UN);
    this.setStatus(St.INTD);
    this.write(0x100 | this.Stack, this.Status);
    this.Stack--;

    let lo = this.read(0xfffa);
    let hi = this.read(0xfffb);
    this.PC = (hi << 8) | lo;

    this.remaining = 8;
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
      this.setFlags(this[tgt]);
      this.PC++;
      return cycles;
    }
    let [addr, extra] = this.calcAddress(mode, off);
    this[tgt] = this.read(addr);
    this.setFlags(this[tgt]);
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
    this.storeLogVars(addr);
    return [this.read(addr), extra];
  }

  add(sub, mode, off, cycles) {
    // the carry flag is bit 0 so we can use the value directly
    let carry = this.Status & St.CARRY;
    let [res, over, extra] = this.addImpl(sub, mode, "A", off, carry);
    this.A = res;
    if (over) {
      this.setStatus(St.OVER);
    } else {
      this.clearStatus(St.OVER);
    }
    return cycles + extra;
  }

  // split into function so it can be used by cmp as well
  addImpl(sub, mode, tgt, off, carry) {
    let [val, extra] = this.getVal(mode, off);
    if (sub) {
      val = val ^ 0xff;
    }
    let sum = this[tgt] + val + carry;
    let over = false;

    // Overflow Flag Set if sign bit is incorrect
    // check if this val is correct for sub
    if ((this[tgt] ^ sum) & (val ^ sum) & 0x80) {
      over = true;
    }

    // Carry Set if value over 8 bits.
    if (sum > 0xff) {
      this.setStatus(St.CARRY);
    } else {
      this.clearStatus(St.CARRY);
    }

    let res = sum & 0xff;
    this.setFlags(res);
    return [res, over, extra];
  }

  bit(mode, cycles) {
    let [val, ,] = this.getVal(mode, null);
    // the carry flag is bit 0 so we can use the value directly
    let tmp = this.A & val;
    this.setFlags(tmp);
    this.Status = (this.Status & 0x3f) | (val & 0xc0);
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

  sh(opfn, mode, off, cycles) {
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
      this.write(addr, res);
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
      res |= 0x01;
    }
    return res;
  }

  ror(val) {
    let carry = this.getStatus(St.CARRY);
    let res = this.lsr(val);
    if (carry) {
      res |= 0x80;
    }
    return res;
  }

  cmp(mode, tgt, off, cycles) {
    let [, , extra] = this.addImpl(true, mode, tgt, off, 1);
    return cycles + extra;
  }

  inc(mode, dir, off, cycles) {
    let [addr, ,] = this.calcAddress(mode, off);
    let val = this.read(addr);
    if (dir) {
      val = ++val & 0xff;
    } else {
      val = --val & 0xff;
    }
    this.setFlags(val);
    this.write(addr, val);
    return cycles;
  }

  incReg(reg) {
    // Adds one to the register setting the zero and negative flags as appropriate.
    this[reg] = ++this[reg] & 0xff;
    this.setFlags(this[reg]);
    return 2;
  }

  decReg(reg) {
    // Subtracts one from the register setting the zero and negative flags as appropriate.
    this[reg] = --this[reg] & 0xff;
    this.setFlags(this[reg]);
    return 2;
  }

  tx(source, destination) {
    this[destination] = this[source];
    if (destination != "Stack") {
      //TXS is only one that says not to set flags.
      this.setFlags(this[destination]);
    }
    return 2;
  }

  push(source) {
    let val = this[source];
    if (source == "Status") {
      // always set break and un
      val |= 0x30;
    }
    this.write(0x100 | this.Stack, val);
    this.Stack--;
    return 3;
  }

  pull(source) {
    this.Stack++;
    let val = this.read(0x100 | this.Stack);
    if (source == "Status") {
      // always set break and un
      val = (val & 0xcf) | (this[source] & 0x30);
    }
    this[source] = val;
    if (source == "A") {
      this.setFlags(this[source]);
    }
    return 4;
  }

  jmp(mode, cycles) {
    let addr = this.readAddr();
    if (mode === Mode.IND) {
      // handle the bug in 6502
      let second = (addr & 0xff00) | ((addr + 1) & 0xff);
      let lo = this.read(addr);
      let hi = this.read(second);
      addr = (hi << 8) | lo;
    }
    this.storeLogVars(addr);
    this.PC = addr;
    return cycles;
  }

  jsr() {
    // the next two instructions are the address to jump too,
    // so set the return value to the last byte of the address
    let ret = this.PC + 1;
    this.write(0x100 | this.Stack, ret >> 8);
    this.Stack--;
    this.write(0x100 | this.Stack, ret & 0xff);
    this.Stack--;
    return this.jmp(Mode.ABS, 6);
  }

  rti() {
    this.pull("Status");
    // the pc is the actual jump address
    return this.jumpStack(0);
  }

  rts() {
    // the stack points to the last byte of the jsr address
    // so increment it by one when setting pc
    return this.jumpStack(1);
  }

  jumpStack(offset) {
    this.Stack++;
    let lo = this.read(0x100 | this.Stack);
    this.Stack++;
    let hi = this.read(0x100 | this.Stack);
    this.PC = ((hi << 8) | lo) + offset;
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
    if (lo > 127) {
      lo -= 256;
    }
    this.PC++;
    let cycles = 2;
    let addr = this.PC;
    addr += lo;
    this.storeLogVars(addr);
    if (this.getStatus(flag) ^ invert) {
      cycles += 1; // if branch succeeds +1
      if (addr >> 8 != this.PC >> 8) {
        cycles += 1; // if new page +1
      }
      this.PC = addr;
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
        addr &= 0xffff;
        // check page cross
        if (addr >> 8 != hi) {
          extra = 1;
        }
        break;
      case Mode.IND:
        if (off === "X") {
          this.ind = (first + this.X) & 0xff;
          let lo = this.read(this.ind);
          let hi = this.read((this.ind + 1) & 0xff);
          addr = (hi << 8) | lo;
        } else {
          let lo = this.read(first);
          let hi = this.read((first + 1) & 0xff);
          this.ind = (hi << 8) | lo;
          addr = (this.ind + this.Y) & 0xffff;
          // check page cross
          if (addr >> 8 != hi) {
            extra = 1;
          }
        }
        break;
    }
    // save the memory at current address for logging
    this.storeLogVars(addr);
    return [addr, extra];
  }

  log_ins(mne, len) {
    let ins = ["  ", "  ", "  "];
    for (let i = 0; i < len; i++) {
      ins[i] = toHex8(this.read(this.PC + i));
    }
    let pc = toHex16(this.PC);
    mne = mne.replace("%1", ins[1]).replace("%2", ins[2]).padEnd(32);
    let log = `${pc}  ${ins[0]} ${ins[1]} ${ins[2]}  ${mne}`;
    log += `A:${toHex8(this.A)} X:${toHex8(this.X)} Y:${toHex8(this.Y)} `;
    log += `P:${toHex8(this.Status)} SP:${toHex8(this.Stack)} `;
    log += `PPU:%ppu CYC:${this.cycles}`;
    return log;
  }

  tick(shouldLog) {
    if (this.remaining == 0) {
      let parts = this.lookup[this.read(this.PC)];
      if (parts === undefined) {
        console.log("unknown instruction");
        process.exit(1);
      }
      let [mne, len, fn, ...args] = parts;
      let ret = "";
      if (shouldLog) {
        ret = this.log_ins(mne, len);
      }

      this.PC++;
      this.remaining = fn.apply(this, args);

      if (shouldLog) {
        // write calculated values
        ret = ret.replace("%x", toHex8(this.ind));
        ret = ret.replace("%yyy", toHex16(this.ind));
        ret = ret.replace("%r", toHex8(this.addr));
        ret = ret.replace("%abs", toHex16(this.addr));
        ret = ret.replace("%v", toHex8(this.last));
      }
      return ret;
    }

    this.remaining--;
    this.cycles++;

    return undefined;
  }

  complete() {
    return this.remaining == 0;
  }

  clock(shouldLog) {
    let parts = this.lookup[this.read(this.PC)];
    if (parts === undefined) {
      console.log("unknown instruction");
      process.exit(1);
    }
    let [mne, len, fn, ...args] = parts;
    let ret = "";
    if (shouldLog) {
      ret = this.log_ins(mne, len);
    }

    this.PC++;
    let cycles = fn.apply(this, args);
    this.cycles += cycles;

    if (shouldLog) {
      // write calculated values
      ret = ret.replace("%x", toHex8(this.ind));
      ret = ret.replace("%yyy", toHex16(this.ind));
      ret = ret.replace("%r", toHex8(this.addr));
      ret = ret.replace("%abs", toHex16(this.addr));
      ret = ret.replace("%v", toHex8(this.last));
    }
    return [cycles, ret];
  }
}

const St = {
  CARRY: 1 << 0,
  ZERO: 1 << 1,
  INTD: 1 << 2,
  DEC: 1 << 3,
  BREAK: 1 << 4, // 1
  UN: 1 << 5, // 2
  OVER: 1 << 6, // 4
  NEG: 1 << 7, // 8
};

const Mode = {
  IMM: 1 << 0,
  ZERO: 1 << 1,
  ABS: 1 << 2,
  IND: 1 << 3,
  ACC: 1 << 4,
};

module.exports = Nes6502;
