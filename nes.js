const glfw = require("glfw-raub");
const IO = require("./io");
const PPU = require("./ppu");
const Cpu = require("./cpu");
const Bus = require("./bus");
const Input = require("./input");
const fs = require("fs");
const hex = require("./hex");

var running = false;
var linenum = 0;
var logs = null;
const LOG = "nestest.log";
const CANONICAL_LOG = "canonical.nestest.log";

var c = 0;
function run() {
  if (io.shouldClose || io.getKey(glfw.KEY_ESCAPE)) {
    io.shutdown();
    process.exit(0);
  }
  if (running) {
    let log = cpu.clock();
    fs.appendFileSync(LOG, log + "\n");
    // ignore SL for now
    let line = logs[linenum++].trim().replace(/PPU:.{7}/, "PPU:  0,  0");
    if (log != line) {
      console.log("ERROR ON LINE ", linenum);
      console.log(`OURS:   '${log}'`);
      console.log(`THEIRS: '${line}'`);
      process.exit(1);
    }
  }
  c++;
  if (c > 255) c = 0;
  // for (var x = 0; x < w; x++) {
  //   for (var y = 0; y < h; y++) {
  //     const loc = (y * w + x) * 3;
  //     buffer[loc + 0] = c;
  //     buffer[loc + 1] = c;
  //     buffer[loc + 2] = c;
  //   }
  // }
  // io.setPixel(0, 0, c, 0, 0);
  // io.setPixel(1, 0, c, 0, 0);
  // io.setPixel(2, 0, c, 0, 0);
  // io.setPixel(127, 119, 0, c, 0);
  // io.setPixel(128, 119, 0, c, 0);
  // io.setPixel(129, 119, 0, c, 0);
  // io.setPixel(253, 239, 0, 0, c);
  // io.setPixel(254, 239, 0, 0, c);
  // io.setPixel(255, 239, 0, 0, c);
  for (let i = 0; i < 256; i++) {
    let y = Math.floor(i / 16);
    let x = i % 16;
    ppu.showTile(x * 10, y * 10, 0, i);
  }
  io.tick(run);
}

const w = 256;
const h = 240;

function handleKey(key) {
  switch (key) {
    case "s":
      // single step processor
      {
        let log = cpu.clock();
        fs.appendFileSync(LOG, log + "\n");
        dump();
      }
      break;
    case "d":
      // debug run
      running = !running;
      break;
    default:
      console.log(key + " was pressed.");
      break;
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
bus.loadRom("nestest.nes");
cpu.reset();
// clear log
fs.writeFileSync(LOG, "");
// load canonical log
logs = fs.readFileSync(CANONICAL_LOG, "utf8").split("\n");
// force automation mode
cpu.PC = 0xc000;
dump();
run();
