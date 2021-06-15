const glfw = require("glfw-raub");
const IO = require("./io");
const Cpu = require("./cpu");
const Bus = require("./bus");

var c = 0;
function run() {
  if (io.shouldClose || io.getKey(glfw.KEY_ESCAPE)) {
    io.shutdown();
    process.exit(0);
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

function clock() {
  cpu.clock();
  dump();
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
  offset = 0x8000;
  console.log(hexdump(buf, offset, length));
}

const w = 256;
const h = 240;

function handleKey(key) {
  switch (key) {
    case "s":
      // single step processor
      clock();
      break;
    case "r":
      // run processor
      break;
    default:
      console.log(key + " was pressed.");
      break;
  }
  return true;
}

function loadProgram() {
  // Load Program (assembled at https://www.masswerk.at/6502/assembler.html)
  // *=$8000
  // LDX #10
  // STX $0000
  // LDX #3
  // STX $0001
  // LDY $0000
  // LDA #0
  // CLC
  // loop
  // ADC $0001
  // DEY
  // BNE loop
  // STA $0002
  // NOP
  // NOP
  // NOP

  // Convert hex string into bytes for RAM
  var code =
    "A2 0A 8E 00 00 A2 03 8E 01 00 AC 00 00 A9 00 18 6D 01 00 88 D0 FA 8D 02 00 EA EA EA";
  code = code.split(" ");
  var offset = 0x8000;
  code.forEach(function (val) {
    bus.ram[offset++] = parseInt(val, 16); // code converted to number from hex string
  });

  // Set Reset Vector
  bus.ram[0xfffc] = 0x00;
  bus.ram[0xfffd] = 0x80;

  // Reset
  cpu.reset();
  return true;
}

const io = new IO(w, h);
io.registerKeyPressHandler(handleKey);
const bus = new Bus();
const cpu = new Cpu(bus);
loadProgram();
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
