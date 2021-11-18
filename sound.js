const fs = require("fs");
const settings = require("./settings");
const Speaker = require("speaker");

const fd = fs.openSync("./testfifo", "r+");
let reader = fs.createReadStream(null, { fd });
reader.pipe(
  new Speaker({
    channels: settings.channels,
    bitDepth: settings.bitDepth,
    sampleRate: settings.rate,
  })
);
