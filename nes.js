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
var graphics = true;
var linenum = 0;
var logs = null;
var cycles = 0;
const LOG = "nestest.log";
const CANONICAL_LOG = "canonical.nestest.log";

function tick() {
  cycles++;
  ppu.tick();
  if (cycles % 3 == 0) {
    let log = cpu.tick(debug);
    if (log !== undefined && debug) {
      let s = ("   " + ppu.scanline).slice(-3);
      let p = ("   " + ppu.cycle).slice(-3);
      log = log.replace("%ppu", s + "," + p);
      fs.appendFileSync(LOG, log + "\n");
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

  if (ppu.nmi) {
    ppu.nmi = false;
    cpu.nmi();
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
  // for (let i = 0; i < 256; i++) {
  //   let y = Math.floor(i / 16);
  //   let x = i % 16;
  //   ppu.showTile(x * 8, y * 8, 0, i);
  // }
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
        dump();
        ppu.frame = false;
      }
      break;
    case "g":
      graphics = !graphics;
      break;
    case "d":
      // enable or disable debug
      debug = !debug;
      break;
    case "r":
      // run
      running = !running;
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
const bus = new Bus(input, ppu);
const cpu = new Cpu(bus);
io.registerKeyPressHandler(handleKey);
//bus.loadRom("nestest.nes");
bus.loadRom("pacman.nes");
cpu.reset();
// clear log
fs.writeFileSync(LOG, "");
// load canonical log
logs = fs.readFileSync(CANONICAL_LOG, "utf8").split("\n");
// force automation mode
// cpu.PC = 0xc000;
dump();
run();
