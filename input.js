const glfw = require("glfw-raub");

const CONT1 = 0x4016;
const CONT2 = 0x4017;

const Cont1Map = [
  "z", // A
  "x", // B
  glfw.KEY_TAB, // SELECT
  glfw.KEY_ENTER, // START
  glfw.KEY_UP, // UP
  glfw.KEY_DOWN, // DOWN
  glfw.KEY_LEFT, // LEFT
  glfw.KEY_RIGHT, // RIGHT
];
const Cont2Map = [];

class Input {
  constructor(io) {
    this.io = io;
    this.c1index = 0;
    this.c2index = 0;
  }
  read(address) {
    let response = 0;
    if (address == CONT1) {
      if (this.c1index > 7) {
        return 1;
      }
      response = this.io.getKey(Cont1Map[this.c1index]) ? 1 : 0;
      this.c1index++;
    } else if (address == CONT2) {
      if (this.c2index > 7) {
        return 1;
      }
      response = this.io.getKey(Cont2Map[this.c2index]) ? 1 : 0;
      this.c2index++;
    }
    return response;
  }

  write(address, data) {
    if (address == CONT1) {
      if (data & (0x01 == 0x01)) {
        // theoretically this should read all buttons being
        // pressed at the time of 1 being sent in and should
        // immediately be followed with a 0 write, but we're
        // being lazy and just setting it up so it checks
        // each button during each subsequent read
        this.c1index == 0;
        this.c2index == 0;
      }
    }
  }
}

module.exports = Input;
