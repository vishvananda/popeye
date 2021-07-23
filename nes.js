const glfw = require("glfw-raub");
const IO = require("./io");
const Cpu = require("./cpu");
const Bus = require("./bus");
const Input = require("./input");
const fs = require("fs");

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
  io.setPixel(0, 0, c, 0, 0);
  io.setPixel(1, 0, c, 0, 0);
  io.setPixel(2, 0, c, 0, 0);
  io.setPixel(127, 119, 0, c, 0);
  io.setPixel(128, 119, 0, c, 0);
  io.setPixel(129, 119, 0, c, 0);
  io.setPixel(253, 239, 0, 0, c);
  io.setPixel(254, 239, 0, 0, c);
  io.setPixel(255, 239, 0, 0, c);
  io.tick(run);
}

function toHex8(val) {
  return ("00" + val.toString(16).toUpperCase()).slice(-2);
}
function toHex16(val) {
  return ("0000" + val.toString(16).toUpperCase()).slice(-4);
}

function dump() {
  console.clear();
  console.log(
    "A: " +
      toHex8(cpu.A) +
      "\t" +
      "X: " +
      toHex8(cpu.X) +
      "\t" +
      "Y: " +
      toHex8(cpu.Y) +
      "\t" +
      "PC: " +
      toHex16(cpu.PC) +
      "\t" +
      "Stk: " +
      toHex8(cpu.Stack) +
      "\t" +
      "Sts: " +
      toHex8(cpu.Status) +
      "\t" +
      "Ins: " +
      toHex8(cpu.read(cpu.PC))
  );
  const buf = Buffer.from(bus.ram);
  const length = 3 * 16;
  var offset = 0x0000;
  console.log(hexdump(buf, offset, length));
  offset = 0x01d0;
  console.log(hexdump(buf, offset, length));
  offset = bus.cart.prg_offset(cpu.PC) & 0xfff0;
  const buf2 = Buffer.from(bus.cart.prg);
  console.log(hexdump(buf2, offset, length));
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

const io = new IO(w, h);
const input = new Input(io);
const bus = new Bus(input);
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

function _fillUp(value, count, fillWith) {
  var l = count - value.length;
  var ret = "";
  while (--l > -1) ret += fillWith;
  return ret + value;
}
function hexdump(buffer, offset, length) {
  offset = offset || 0;
  const total_length = offset + length || buffer.length;

  var out =
    _fillUp("Offset", 8, " ") +
    "  00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F\n";
  var row = "";
  for (var i = 0; i < length; i += 16) {
    row += _fillUp(offset.toString(16).toUpperCase(), 8, "0") + "  ";
    var n = Math.min(16, total_length - offset);
    var string = "";
    for (var j = 0; j < 16; ++j) {
      if (j < n) {
        var value = buffer.readUInt8(offset);
        string += value >= 32 ? String.fromCharCode(value) : ".";
        row += _fillUp(value.toString(16).toUpperCase(), 2, "0") + " ";
        offset++;
      } else {
        row += "   ";
        string += " ";
      }
    }
    row += " " + string + "\n";
  }
  out += row;
  return out;
}
