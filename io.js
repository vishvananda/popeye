"use strict";

const webgl = require("webgl-raub");

const glfw = require("glfw-raub");
const { Document } = glfw;

const shaders = {
  vs: `
precision lowp float;

// xy = vertex position in normalized device coordinates ([-1,+1] range).
attribute vec2 vertexPosition;

varying vec2 vTexCoords;

const vec2 scale = vec2(0.5, 0.5);
const vec2 inv = vec2(1.0, -1.0);

void main()
{
    vTexCoords  = inv * vertexPosition * scale + scale; // scale vertex attribute to [0,1] range
    gl_Position = vec4(vertexPosition, 0.0, 1.0);
}
`,

  fs: `
#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D colorMap;
varying vec2 vTexCoords;

void main()
{
    gl_FragColor = texture2D(colorMap, vTexCoords);
}
`,
};

function getShader(gl, id) {
  const shader = gl.createShader(
    id === "vs" ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER
  );

  gl.shaderSource(shader, shaders[id]);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

class IO {
  constructor(width, height, scaling = 4) {
    Document.setWebgl(webgl);
    this.doc = new Document();

    this.canvas = this.doc.createElement("canvas");
    this.frame = this.doc.requestAnimationFrame;

    this.width = width;
    this.height = height;
    this.doc.title = "NES";
    this.doc.width = width * scaling;
    this.doc.height = height * scaling;
    this.doc.on("resize", (evt) => {
      this.gl.viewportWidth = evt.width;
      this.gl.viewportHeight = evt.height;
    });

    this.initGL(this.canvas);
    this.initShaders();
    this.initBuffers();
    this.initTexture();

    this.gl.clearColor(0, 0, 0, 1);
    this.gl.enable(this.gl.DEPTH_TEST);

    this.data = new Uint8ClampedArray(width * height * 3);
    this.doc.on("keydown", (e) => {
      this.keydown(e);
    });
    this.keyPressHandlers = [];
  }

  registerKeyPressHandler(handler) {
    this.keyPressHandlers.push(handler);
  }

  keydown(e) {
    this.keyPressHandlers.forEach(function (handler) {
      if (handler(e.key)) {
        return;
      }
    });
  }

  get shouldClose() {
    return this.doc.shouldClose;
  }

  getKey(key) {
    return this.doc.getKey(key);
  }

  buffer() {
    return this.data;
  }

  initGL(canvas) {
    try {
      this.gl = canvas.getContext("webgl");

      this.gl.viewportWidth = canvas.width;
      this.gl.viewportHeight = canvas.height;
    } catch (e) {
      console.error("Could not initialise WebGL, sorry :-(");
      process.exit(-1);
    }
  }

  initShaders() {
    const fragmentShader = getShader(this.gl, "fs");
    const vertexShader = getShader(this.gl, "vs");

    this.shaderProgram = this.gl.createProgram();
    this.gl.attachShader(this.shaderProgram, vertexShader);
    this.gl.attachShader(this.shaderProgram, fragmentShader);
    this.gl.linkProgram(this.shaderProgram);

    if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
      console.error(
        `Could not initialise shaders. Error: ${this.gl.getProgramInfoLog(
          this.shaderProgram
        )}`
      );
    }

    this.gl.useProgram(this.shaderProgram);
    this.vertexPosition = this.gl.getAttribLocation(
      this.shaderProgram,
      "vertexPosition"
    );
  }

  initBuffers() {
    const vertices = [
      // First trianthis.gle:
      1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
      // Second trianthis.gle:
      -1.0, -1.0, 1.0, -1.0, 1.0, 1.0,
    ];
    this.screenQuadVBO = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.screenQuadVBO);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(vertices),
      this.gl.STATIC_DRAW
    );

    this.textureLocation = this.gl.getUniformLocation(
      this.shaderProgram,
      "colorMap"
    );
  }

  initTexture() {
    // Create a texture.
    this.texture = this.gl.createTexture();

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGB,
      this.width,
      this.height,
      0,
      this.gl.RGB,
      this.gl.UNSIGNED_BYTE,
      this.data
    );

    // set the filtering so we don't need mips and it's not filtered
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.NEAREST
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.NEAREST
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  setPixel(x, y, r, g, b) {
    const loc = (y * this.width + x) * 3;
    this.data[loc + 0] = r;
    this.data[loc + 1] = g;
    this.data[loc + 2] = b;
  }

  shutdown() {
    this.doc.destroy();
    glfw.terminate();
  }

  tick(callback, graphics) {
    if (graphics) {
      this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.screenQuadVBO);
      this.gl.enableVertexAttribArray(this.vertexPosition);
      this.gl.vertexAttribPointer(
        this.vertexPosition,
        2,
        this.gl.FLOAT,
        false,
        0,
        0
      );

      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
      this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
      this.gl.texSubImage2D(
        this.gl.TEXTURE_2D,
        0,
        0,
        0,
        this.width,
        this.height,
        this.gl.RGB,
        this.gl.UNSIGNED_BYTE,
        this.data
      );

      this.gl.uniform1i(this.textureLocation, 0);
      // Draw 6 vertexes => 2 triangles:
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }
    this.frame(callback);
  }
}

module.exports = IO;
