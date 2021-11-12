const glfw = require("glfw-raub");
const IO = require("./io");
const PPU = require("./ppu");
const Cpu = require("./cpu");
const Bus = require("./bus");
const Input = require("./input");
const fs = require("fs");
const hex = require("./hex");

var running = false;
var debug = false;
var validate = false;
var graphics = true;
var linenum = 0;
var logs = null;
var cycles = 0;
const LOG = "debug.log";
const CANONICAL_LOG = "canonical.nestest.log";

function logCallback(log) {
  fs.appendFileSync(LOG, log + "\n");
  if (validate) {
    let line = logs[linenum++].trim();
    if (log != line) {
      console.log("ERROR ON LINE ", linenum);
      console.log(`OURS:   '${log}'`);
      console.log(`THEIRS: '${line}'`);
      console.log(`CYCLES: '${cycles}'`);
      process.exit(1);
    }
  }
}

function tick() {
  if (debug) {
    bus.tick(logCallback);
  } else {
    bus.tick();
  }
}

function run() {
  if (io.shouldClose || io.getKey(glfw.KEY_ESCAPE)) {
    io.shutdown();
    process.exit(0);
  }
  if (running) {
    do {
      tick();
    } while (!ppu.frame);
    ppu.frame = false;
  }
  io.tick(run, graphics);
}

const w = 256;
const h = 240;

function handleKey(key) {
  switch (key) {
    case "s":
      // single step instruction
      {
        do {
          tick();
        } while (!cpu.complete());
        do {
          tick();
        } while (cpu.complete());
        dump();
      }
      break;
    case "f":
      // single step frame
      {
        do {
          tick();
        } while (!ppu.frame);
        do {
          tick();
        } while (cpu.complete());
        ppu.frame = false;
      }
      break;
    case "g":
      graphics = !graphics;
      break;
    case "d":
      // enable or disable debug
      debug = !debug;
      if (debug) {
        // clear log
        fs.writeFileSync(LOG, "");
      }
      break;
    case "v":
      // enable or disable validate (for nestest)
      validate = !validate;
      if (validate) {
        bus.loadRom("nestest.nes");
        running = true;
        // clear log
        fs.writeFileSync(LOG, "");
        // load canonical log
        logs = fs.readFileSync(CANONICAL_LOG, "utf8").split("\n");
        // force automation mode
        cpu.PC = 0xc000;
      }
      break;
    case "t":
      // draw tiles
      for (let i = 0; i < 256; i++) {
        let y = Math.floor(i / 32);
        let x = i % 32;
        ppu.showTile(x * 8, y * 8, 0, i);
      }
      for (let i = 0; i < 256; i++) {
        let y = Math.floor(i / 32);
        let x = i % 32;
        ppu.showTile(x * 8, y * 8 + 128, 1, i);
      }
      break;
    case "r":
      // run
      running = !running;
      break;
    case "o":
      bus.output();
      break;
    case "y":
      bus.reset();
      break;
    case "1":
      ppu.drawNT(0);
      break;
    case "2":
      ppu.drawNT(1);
      break;
    default:
      return false;
  }
  return true;
}

function dump() {
  console.clear();
  console.log(
    "A: " +
      hex.toHex8(cpu.A) +
      "\t" +
      "X: " +
      hex.toHex8(cpu.X) +
      "\t" +
      "Y: " +
      hex.toHex8(cpu.Y) +
      "\t" +
      "PC: " +
      hex.toHex16(cpu.PC) +
      "\t" +
      "Stk: " +
      hex.toHex8(cpu.Stack) +
      "\t" +
      "Sts: " +
      hex.toHex8(cpu.Status) +
      "\t" +
      "Ins: " +
      hex.toHex8(cpu.read(cpu.PC))
  );
  const buf = Buffer.from(bus.ram);
  const length = 3 * 16;
  var offset = 0x0000;
  console.log(hex.hexdump(buf, offset, length));
  offset = 0x01d0;
  console.log(hex.hexdump(buf, offset, length));
  offset = bus.cart.prgOffset(cpu.PC) & 0xfff0;
  const buf2 = Buffer.from(bus.cart.prg);
  console.log(hex.hexdump(buf2, offset, length));
}

const io = new IO(w, h);
const input = new Input(io);
const ppu = new PPU(io);
const cpu = new Cpu();
const bus = new Bus(input, ppu, cpu);
io.registerKeyPressHandler(handleKey);
//bus.loadRom("Fergulator/test_roms/blargg_cpu/rom_singles/09-branches.nes");
//bus.loadRom("smb.nes");
//bus.loadRom("pacman.nes");
bus.loadRom("rygar.nes");
//bus.loadRom("ice.nes");
//bus.loadRom("Fergulator/test_roms/nesstress.nes");
//bus.loadRom("Fergulator/test_roms/scanline_scanline.nes");
//bus.loadRom("Fergulator/test_roms/blargg_ppu/sprite_ram.nes");
//bus.loadRom("Fergulator/test_roms/sprite_hit_tests_2005.10.05/08.double_height.nes");
//bus.loadRom("Fergulator/test_roms/blargg_cpu/rom_singles/10-stack.nes");
//bus.loadRom("Fergulator/test_roms/cpu_timing_test6/cpu_timing_test.nes");
//bus.loadRom("Fergulator/test_roms/branch_timing_tests/1.Branch_Basics.nes");
//bus.loadRom("Fergulator/test_roms/ppu_vbl_nmi/rom_singles/05-nmi_timing.nes");
// clear log
fs.writeFileSync(LOG, "");
run();
