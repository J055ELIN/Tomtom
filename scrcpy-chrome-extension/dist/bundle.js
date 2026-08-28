(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/yuv-buffer/yuv-buffer.js
  var require_yuv_buffer = __commonJS({
    "node_modules/yuv-buffer/yuv-buffer.js"(exports, module) {
      var YUVBuffer = {
        /**
         * Validate a plane dimension
         * @param {number} dim - vertical or horizontal dimension
         * @throws exception on zero, negative, or non-integer value
         */
        validateDimension: function(dim) {
          if (dim <= 0 || dim !== (dim | 0)) {
            throw "YUV plane dimensions must be a positive integer";
          }
        },
        /**
         * Validate a plane offset
         * @param {number} dim - vertical or horizontal dimension
         * @throws exception on negative or non-integer value
         */
        validateOffset: function(dim) {
          if (dim < 0 || dim !== (dim | 0)) {
            throw "YUV plane offsets must be a non-negative integer";
          }
        },
        /**
         * Validate and fill out a YUVFormat object structure.
         *
         * At least width and height fields are required; other fields will be
         * derived if left missing or empty:
         * - chromaWidth and chromaHeight will be copied from width and height as for a 4:4:4 layout
         * - cropLeft and cropTop will be 0
         * - cropWidth and cropHeight will be set to whatever of the frame is visible after cropTop and cropLeft are applied
         * - displayWidth and displayHeight will be set to cropWidth and cropHeight.
         *
         * @param {YUVFormat} fields - input fields, must include width and height.
         * @returns {YUVFormat} - validated structure, with all derivable fields filled out.
         * @throws exception on invalid fields or missing width/height
         */
        format: function(fields) {
          var width = fields.width, height = fields.height, chromaWidth = fields.chromaWidth || width, chromaHeight = fields.chromaHeight || height, cropLeft = fields.cropLeft || 0, cropTop = fields.cropTop || 0, cropWidth = fields.cropWidth || width - cropLeft, cropHeight = fields.cropHeight || height - cropTop, displayWidth = fields.displayWidth || cropWidth, displayHeight = fields.displayHeight || cropHeight;
          this.validateDimension(width);
          this.validateDimension(height);
          this.validateDimension(chromaWidth);
          this.validateDimension(chromaHeight);
          this.validateOffset(cropLeft);
          this.validateOffset(cropTop);
          this.validateDimension(cropWidth);
          this.validateDimension(cropHeight);
          this.validateDimension(displayWidth);
          this.validateDimension(displayHeight);
          return {
            width,
            height,
            chromaWidth,
            chromaHeight,
            cropLeft,
            cropTop,
            cropWidth,
            cropHeight,
            displayWidth,
            displayHeight
          };
        },
        /**
         * Pick a suitable stride for a custom-allocated thingy
         * @param {number} width - width in bytes
         * @returns {number} - new width in bytes at least as large
         * @throws exception on invalid input width
         */
        suitableStride: function(width) {
          YUVBuffer.validateDimension(width);
          var alignment = 4, remainder = width % alignment;
          if (remainder == 0) {
            return width;
          } else {
            return width + (alignment - remainder);
          }
        },
        /**
         * Allocate or extract a YUVPlane object from given dimensions/source.
         * @param {number} width - width in pixels
         * @param {number} height - height in pixels
         * @param {Uint8Array} source - input byte array; optional (will create empty buffer if missing)
         * @param {number} stride - row length in bytes; optional (will create a default if missing)
         * @param {number} offset - offset into source array to extract; optional (will start at 0 if missing)
         * @returns {YUVPlane} - freshly allocated planar buffer
         */
        allocPlane: function(width, height, source, stride, offset) {
          var size, bytes;
          this.validateDimension(width);
          this.validateDimension(height);
          offset = offset || 0;
          stride = stride || this.suitableStride(width);
          this.validateDimension(stride);
          if (stride < width) {
            throw "Invalid input stride for YUV plane; must be larger than width";
          }
          size = stride * height;
          if (source) {
            if (source.length - offset < size) {
              throw "Invalid input buffer for YUV plane; must be large enough for stride times height";
            }
            bytes = source.slice(offset, offset + size);
          } else {
            bytes = new Uint8Array(size);
            stride = stride || this.suitableStride(width);
          }
          return {
            bytes,
            stride
          };
        },
        /**
         * Allocate a new YUVPlane object big enough for a luma plane in the given format
         * @param {YUVFormat} format - target frame format
         * @param {Uint8Array} source - input byte array; optional (will create empty buffer if missing)
         * @param {number} stride - row length in bytes; optional (will create a default if missing)
         * @param {number} offset - offset into source array to extract; optional (will start at 0 if missing)
         * @returns {YUVPlane} - freshly allocated planar buffer
         */
        lumaPlane: function(format, source, stride, offset) {
          return this.allocPlane(format.width, format.height, source, stride, offset);
        },
        /**
         * Allocate a new YUVPlane object big enough for a chroma plane in the given format,
         * optionally copying data from an existing buffer.
         *
         * @param {YUVFormat} format - target frame format
         * @param {Uint8Array} source - input byte array; optional (will create empty buffer if missing)
         * @param {number} stride - row length in bytes; optional (will create a default if missing)
         * @param {number} offset - offset into source array to extract; optional (will start at 0 if missing)
         * @returns {YUVPlane} - freshly allocated planar buffer
         */
        chromaPlane: function(format, source, stride, offset) {
          return this.allocPlane(format.chromaWidth, format.chromaHeight, source, stride, offset);
        },
        /**
         * Allocate a new YUVFrame object big enough for the given format
         * @param {YUVFormat} format - target frame format
         * @param {YUVPlane} y - optional Y plane; if missing, fresh one will be allocated
         * @param {YUVPlane} u - optional U plane; if missing, fresh one will be allocated
         * @param {YUVPlane} v - optional V plane; if missing, fresh one will be allocated
         * @returns {YUVFrame} - freshly allocated frame buffer
         */
        frame: function(format, y, u, v) {
          y = y || this.lumaPlane(format);
          u = u || this.chromaPlane(format);
          v = v || this.chromaPlane(format);
          return {
            format,
            y,
            u,
            v
          };
        },
        /**
         * Duplicate a plane using new buffer memory.
         * @param {YUVPlane} plane - input plane to copy
         * @returns {YUVPlane} - freshly allocated and filled planar buffer
         */
        copyPlane: function(plane) {
          return {
            bytes: plane.bytes.slice(),
            stride: plane.stride
          };
        },
        /**
         * Duplicate a frame using new buffer memory.
         * @param {YUVFrame} frame - input frame to copyFrame
         * @returns {YUVFrame} - freshly allocated and filled frame buffer
         */
        copyFrame: function(frame) {
          return {
            format: frame.format,
            y: this.copyPlane(frame.y),
            u: this.copyPlane(frame.u),
            v: this.copyPlane(frame.v)
          };
        },
        /**
         * List the backing buffers for the frame's planes for transfer between
         * threads via Worker.postMessage.
         * @param {YUVFrame} frame - input frame
         * @returns {Array} - list of transferable objects
         */
        transferables: function(frame) {
          return [frame.y.bytes.buffer, frame.u.bytes.buffer, frame.v.bytes.buffer];
        }
      };
      module.exports = YUVBuffer;
    }
  });

  // node_modules/yuv-canvas/src/FrameSink.js
  var require_FrameSink = __commonJS({
    "node_modules/yuv-canvas/src/FrameSink.js"(exports, module) {
      (function() {
        "use strict";
        function FrameSink(canvas2, options) {
          throw new Error("abstract");
        }
        FrameSink.prototype.drawFrame = function(buffer3) {
          throw new Error("abstract");
        };
        FrameSink.prototype.clear = function() {
          throw new Error("abstract");
        };
        module.exports = FrameSink;
      })();
    }
  });

  // node_modules/yuv-canvas/src/depower.js
  var require_depower = __commonJS({
    "node_modules/yuv-canvas/src/depower.js"(exports, module) {
      (function() {
        "use strict";
        function depower(ratio) {
          var shiftCount = 0, n = ratio >> 1;
          while (n != 0) {
            n = n >> 1;
            shiftCount++;
          }
          if (ratio !== 1 << shiftCount) {
            throw "chroma plane dimensions must be power of 2 ratio to luma plane dimensions; got " + ratio;
          }
          return shiftCount;
        }
        module.exports = depower;
      })();
    }
  });

  // node_modules/yuv-canvas/src/YCbCr.js
  var require_YCbCr = __commonJS({
    "node_modules/yuv-canvas/src/YCbCr.js"(exports, module) {
      (function() {
        "use strict";
        var depower = require_depower();
        function convertYCbCr(buffer3, output) {
          var width = buffer3.format.width | 0, height = buffer3.format.height | 0, hdec = depower(buffer3.format.width / buffer3.format.chromaWidth) | 0, vdec = depower(buffer3.format.height / buffer3.format.chromaHeight) | 0, bytesY = buffer3.y.bytes, bytesCb = buffer3.u.bytes, bytesCr = buffer3.v.bytes, strideY = buffer3.y.stride | 0, strideCb = buffer3.u.stride | 0, strideCr = buffer3.v.stride | 0, outStride = width << 2, YPtr = 0, Y0Ptr = 0, Y1Ptr = 0, CbPtr = 0, CrPtr = 0, outPtr = 0, outPtr0 = 0, outPtr1 = 0, colorCb = 0, colorCr = 0, multY = 0, multCrR = 0, multCbCrG = 0, multCbB = 0, x = 0, y = 0, xdec = 0, ydec = 0;
          if (hdec == 1 && vdec == 1) {
            outPtr0 = 0;
            outPtr1 = outStride;
            ydec = 0;
            for (y = 0; y < height; y += 2) {
              Y0Ptr = y * strideY | 0;
              Y1Ptr = Y0Ptr + strideY | 0;
              CbPtr = ydec * strideCb | 0;
              CrPtr = ydec * strideCr | 0;
              for (x = 0; x < width; x += 2) {
                colorCb = bytesCb[CbPtr++] | 0;
                colorCr = bytesCr[CrPtr++] | 0;
                multCrR = (409 * colorCr | 0) - 57088 | 0;
                multCbCrG = (100 * colorCb | 0) + (208 * colorCr | 0) - 34816 | 0;
                multCbB = (516 * colorCb | 0) - 70912 | 0;
                multY = 298 * bytesY[Y0Ptr++] | 0;
                output[outPtr0] = multY + multCrR >> 8;
                output[outPtr0 + 1] = multY - multCbCrG >> 8;
                output[outPtr0 + 2] = multY + multCbB >> 8;
                outPtr0 += 4;
                multY = 298 * bytesY[Y0Ptr++] | 0;
                output[outPtr0] = multY + multCrR >> 8;
                output[outPtr0 + 1] = multY - multCbCrG >> 8;
                output[outPtr0 + 2] = multY + multCbB >> 8;
                outPtr0 += 4;
                multY = 298 * bytesY[Y1Ptr++] | 0;
                output[outPtr1] = multY + multCrR >> 8;
                output[outPtr1 + 1] = multY - multCbCrG >> 8;
                output[outPtr1 + 2] = multY + multCbB >> 8;
                outPtr1 += 4;
                multY = 298 * bytesY[Y1Ptr++] | 0;
                output[outPtr1] = multY + multCrR >> 8;
                output[outPtr1 + 1] = multY - multCbCrG >> 8;
                output[outPtr1 + 2] = multY + multCbB >> 8;
                outPtr1 += 4;
              }
              outPtr0 += outStride;
              outPtr1 += outStride;
              ydec++;
            }
          } else {
            outPtr = 0;
            for (y = 0; y < height; y++) {
              xdec = 0;
              ydec = y >> vdec;
              YPtr = y * strideY | 0;
              CbPtr = ydec * strideCb | 0;
              CrPtr = ydec * strideCr | 0;
              for (x = 0; x < width; x++) {
                xdec = x >> hdec;
                colorCb = bytesCb[CbPtr + xdec] | 0;
                colorCr = bytesCr[CrPtr + xdec] | 0;
                multCrR = (409 * colorCr | 0) - 57088 | 0;
                multCbCrG = (100 * colorCb | 0) + (208 * colorCr | 0) - 34816 | 0;
                multCbB = (516 * colorCb | 0) - 70912 | 0;
                multY = 298 * bytesY[YPtr++] | 0;
                output[outPtr] = multY + multCrR >> 8;
                output[outPtr + 1] = multY - multCbCrG >> 8;
                output[outPtr + 2] = multY + multCbB >> 8;
                outPtr += 4;
              }
            }
          }
        }
        module.exports = {
          convertYCbCr
        };
      })();
    }
  });

  // node_modules/yuv-canvas/src/SoftwareFrameSink.js
  var require_SoftwareFrameSink = __commonJS({
    "node_modules/yuv-canvas/src/SoftwareFrameSink.js"(exports, module) {
      (function() {
        "use strict";
        var FrameSink = require_FrameSink(), YCbCr = require_YCbCr();
        function SoftwareFrameSink(canvas2) {
          var self = this, ctx = canvas2.getContext("2d"), imageData = null, resampleCanvas = null, resampleContext = null;
          function initImageData(width, height) {
            imageData = ctx.createImageData(width, height);
            var data = imageData.data, pixelCount = width * height * 4;
            for (var i = 0; i < pixelCount; i += 4) {
              data[i + 3] = 255;
            }
          }
          function initResampleCanvas(cropWidth, cropHeight) {
            resampleCanvas = document.createElement("canvas");
            resampleCanvas.width = cropWidth;
            resampleCanvas.height = cropHeight;
            resampleContext = resampleCanvas.getContext("2d");
          }
          self.drawFrame = function drawFrame(buffer3) {
            var format = buffer3.format;
            if (canvas2.width !== format.displayWidth || canvas2.height !== format.displayHeight) {
              canvas2.width = format.displayWidth;
              canvas2.height = format.displayHeight;
            }
            if (imageData === null || imageData.width != format.width || imageData.height != format.height) {
              initImageData(format.width, format.height);
            }
            YCbCr.convertYCbCr(buffer3, imageData.data);
            var resample = format.cropWidth != format.displayWidth || format.cropHeight != format.displayHeight;
            var drawContext;
            if (resample) {
              if (!resampleCanvas) {
                initResampleCanvas(format.cropWidth, format.cropHeight);
              }
              drawContext = resampleContext;
            } else {
              drawContext = ctx;
            }
            drawContext.putImageData(
              imageData,
              -format.cropLeft,
              -format.cropTop,
              // must offset the offset
              format.cropLeft,
              format.cropTop,
              format.cropWidth,
              format.cropHeight
            );
            if (resample) {
              ctx.drawImage(resampleCanvas, 0, 0, format.displayWidth, format.displayHeight);
            }
          };
          self.clear = function() {
            ctx.clearRect(0, 0, canvas2.width, canvas2.height);
          };
          return self;
        }
        SoftwareFrameSink.prototype = Object.create(FrameSink.prototype);
        module.exports = SoftwareFrameSink;
      })();
    }
  });

  // node_modules/yuv-canvas/build/shaders.js
  var require_shaders = __commonJS({
    "node_modules/yuv-canvas/build/shaders.js"(exports, module) {
      module.exports = {
        vertex: "precision mediump float;\n\nattribute vec2 aPosition;\nattribute vec2 aLumaPosition;\nattribute vec2 aChromaPosition;\nvarying vec2 vLumaPosition;\nvarying vec2 vChromaPosition;\nvoid main() {\n    gl_Position = vec4(aPosition, 0, 1);\n    vLumaPosition = aLumaPosition;\n    vChromaPosition = aChromaPosition;\n}\n",
        fragment: "// inspired by https://github.com/mbebenita/Broadway/blob/master/Player/canvas.js\n\nprecision mediump float;\n\nuniform sampler2D uTextureY;\nuniform sampler2D uTextureCb;\nuniform sampler2D uTextureCr;\nvarying vec2 vLumaPosition;\nvarying vec2 vChromaPosition;\nvoid main() {\n   // Y, Cb, and Cr planes are uploaded as ALPHA textures.\n   float fY = texture2D(uTextureY, vLumaPosition).w;\n   float fCb = texture2D(uTextureCb, vChromaPosition).w;\n   float fCr = texture2D(uTextureCr, vChromaPosition).w;\n\n   // Premultipy the Y...\n   float fYmul = fY * 1.1643828125;\n\n   // And convert that to RGB!\n   gl_FragColor = vec4(\n     fYmul + 1.59602734375 * fCr - 0.87078515625,\n     fYmul - 0.39176171875 * fCb - 0.81296875 * fCr + 0.52959375,\n     fYmul + 2.017234375   * fCb - 1.081390625,\n     1\n   );\n}\n",
        vertexStripe: "precision mediump float;\n\nattribute vec2 aPosition;\nattribute vec2 aTexturePosition;\nvarying vec2 vTexturePosition;\n\nvoid main() {\n    gl_Position = vec4(aPosition, 0, 1);\n    vTexturePosition = aTexturePosition;\n}\n",
        fragmentStripe: "// extra 'stripe' texture fiddling to work around IE 11's poor performance on gl.LUMINANCE and gl.ALPHA textures\n\nprecision mediump float;\n\nuniform sampler2D uStripe;\nuniform sampler2D uTexture;\nvarying vec2 vTexturePosition;\nvoid main() {\n   // Y, Cb, and Cr planes are mapped into a pseudo-RGBA texture\n   // so we can upload them without expanding the bytes on IE 11\n   // which doesn't allow LUMINANCE or ALPHA textures\n   // The stripe textures mark which channel to keep for each pixel.\n   // Each texture extraction will contain the relevant value in one\n   // channel only.\n\n   float fLuminance = dot(\n      texture2D(uStripe, vTexturePosition),\n      texture2D(uTexture, vTexturePosition)\n   );\n\n   gl_FragColor = vec4(0, 0, 0, fLuminance);\n}\n"
      };
    }
  });

  // node_modules/yuv-canvas/src/WebGLFrameSink.js
  var require_WebGLFrameSink = __commonJS({
    "node_modules/yuv-canvas/src/WebGLFrameSink.js"(exports, module) {
      (function() {
        "use strict";
        var FrameSink = require_FrameSink(), shaders = require_shaders();
        function WebGLFrameSink(canvas2) {
          var self = this, gl = WebGLFrameSink.contextForCanvas(canvas2), debug = false;
          if (gl === null) {
            throw new Error("WebGL unavailable");
          }
          function checkError() {
            if (debug) {
              err = gl.getError();
              if (err !== 0) {
                throw new Error("GL error " + err);
              }
            }
          }
          function compileShader(type, source) {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
              var err2 = gl.getShaderInfoLog(shader);
              gl.deleteShader(shader);
              throw new Error("GL shader compilation for " + type + " failed: " + err2);
            }
            return shader;
          }
          var program, unpackProgram, err;
          var rectangle = new Float32Array([
            // First triangle (top left, clockwise)
            -1,
            -1,
            1,
            -1,
            -1,
            1,
            // Second triangle (bottom right, clockwise)
            -1,
            1,
            1,
            -1,
            1,
            1
          ]);
          var textures = {};
          var framebuffers = {};
          var stripes = {};
          var buf, positionLocation, unpackPositionLocation;
          var unpackTexturePositionBuffer, unpackTexturePositionLocation;
          var stripeLocation, unpackTextureLocation;
          var lumaPositionBuffer, lumaPositionLocation;
          var chromaPositionBuffer, chromaPositionLocation;
          function createOrReuseTexture(name, formatUpdate) {
            if (!textures[name] || formatUpdate) {
              textures[name] = gl.createTexture();
            }
            return textures[name];
          }
          function uploadTexture(name, formatUpdate, width, height, data) {
            var create = !textures[name] || formatUpdate;
            var texture = createOrReuseTexture(name, formatUpdate);
            gl.activeTexture(gl.TEXTURE0);
            if (WebGLFrameSink.stripe) {
              var uploadTemp = !textures[name + "_temp"] || formatUpdate;
              var tempTexture = createOrReuseTexture(name + "_temp", formatUpdate);
              gl.bindTexture(gl.TEXTURE_2D, tempTexture);
              if (uploadTemp) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texImage2D(
                  gl.TEXTURE_2D,
                  0,
                  // mip level
                  gl.RGBA,
                  // internal format
                  width / 4,
                  height,
                  0,
                  // border
                  gl.RGBA,
                  // format
                  gl.UNSIGNED_BYTE,
                  // type
                  data
                  // data!
                );
              } else {
                gl.texSubImage2D(
                  gl.TEXTURE_2D,
                  0,
                  // mip level
                  0,
                  // x offset
                  0,
                  // y offset
                  width / 4,
                  height,
                  gl.RGBA,
                  // format
                  gl.UNSIGNED_BYTE,
                  // type
                  data
                  // data!
                );
              }
              var stripeTexture = textures[name + "_stripe"];
              var uploadStripe = !stripeTexture || formatUpdate;
              if (uploadStripe) {
                stripeTexture = createOrReuseTexture(name + "_stripe", formatUpdate);
              }
              gl.bindTexture(gl.TEXTURE_2D, stripeTexture);
              if (uploadStripe) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texImage2D(
                  gl.TEXTURE_2D,
                  0,
                  // mip level
                  gl.RGBA,
                  // internal format
                  width,
                  1,
                  0,
                  // border
                  gl.RGBA,
                  // format
                  gl.UNSIGNED_BYTE,
                  //type
                  buildStripe(width, 1)
                  // data!
                );
              }
            } else {
              gl.bindTexture(gl.TEXTURE_2D, texture);
              if (create) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texImage2D(
                  gl.TEXTURE_2D,
                  0,
                  // mip level
                  gl.ALPHA,
                  // internal format
                  width,
                  height,
                  0,
                  // border
                  gl.ALPHA,
                  // format
                  gl.UNSIGNED_BYTE,
                  //type
                  data
                  // data!
                );
              } else {
                gl.texSubImage2D(
                  gl.TEXTURE_2D,
                  0,
                  // mip level
                  0,
                  // x
                  0,
                  // y
                  width,
                  height,
                  gl.ALPHA,
                  // internal format
                  gl.UNSIGNED_BYTE,
                  //type
                  data
                  // data!
                );
              }
            }
          }
          function unpackTexture(name, formatUpdate, width, height) {
            var texture = textures[name];
            gl.useProgram(unpackProgram);
            var fb = framebuffers[name];
            if (!fb || formatUpdate) {
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, texture);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
              gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                // mip level
                gl.RGBA,
                // internal format
                width,
                height,
                0,
                // border
                gl.RGBA,
                // format
                gl.UNSIGNED_BYTE,
                //type
                null
                // data!
              );
              fb = framebuffers[name] = gl.createFramebuffer();
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            var tempTexture = textures[name + "_temp"];
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, tempTexture);
            gl.uniform1i(unpackTextureLocation, 1);
            var stripeTexture = textures[name + "_stripe"];
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, stripeTexture);
            gl.uniform1i(stripeLocation, 2);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, unpackTexturePositionBuffer);
            gl.enableVertexAttribArray(unpackTexturePositionLocation);
            gl.vertexAttribPointer(unpackTexturePositionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.viewport(0, 0, width, height);
            gl.drawArrays(gl.TRIANGLES, 0, rectangle.length / 2);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          }
          function attachTexture(name, register, index) {
            gl.activeTexture(register);
            gl.bindTexture(gl.TEXTURE_2D, textures[name]);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.uniform1i(gl.getUniformLocation(program, name), index);
          }
          function buildStripe(width) {
            if (stripes[width]) {
              return stripes[width];
            }
            var len = width, out = new Uint32Array(len);
            for (var i = 0; i < len; i += 4) {
              out[i] = 255;
              out[i + 1] = 65280;
              out[i + 2] = 16711680;
              out[i + 3] = 4278190080;
            }
            return stripes[width] = new Uint8Array(out.buffer);
          }
          function initProgram(vertexShaderSource, fragmentShaderSource) {
            var vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
            var fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
            var program2 = gl.createProgram();
            gl.attachShader(program2, vertexShader);
            gl.attachShader(program2, fragmentShader);
            gl.linkProgram(program2);
            if (!gl.getProgramParameter(program2, gl.LINK_STATUS)) {
              var err2 = gl.getProgramInfoLog(program2);
              gl.deleteProgram(program2);
              throw new Error("GL program linking failed: " + err2);
            }
            return program2;
          }
          function init() {
            if (WebGLFrameSink.stripe) {
              unpackProgram = initProgram(shaders.vertexStripe, shaders.fragmentStripe);
              unpackPositionLocation = gl.getAttribLocation(unpackProgram, "aPosition");
              unpackTexturePositionBuffer = gl.createBuffer();
              var textureRectangle = new Float32Array([
                0,
                0,
                1,
                0,
                0,
                1,
                0,
                1,
                1,
                0,
                1,
                1
              ]);
              gl.bindBuffer(gl.ARRAY_BUFFER, unpackTexturePositionBuffer);
              gl.bufferData(gl.ARRAY_BUFFER, textureRectangle, gl.STATIC_DRAW);
              unpackTexturePositionLocation = gl.getAttribLocation(unpackProgram, "aTexturePosition");
              stripeLocation = gl.getUniformLocation(unpackProgram, "uStripe");
              unpackTextureLocation = gl.getUniformLocation(unpackProgram, "uTexture");
            }
            program = initProgram(shaders.vertex, shaders.fragment);
            buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, rectangle, gl.STATIC_DRAW);
            positionLocation = gl.getAttribLocation(program, "aPosition");
            lumaPositionBuffer = gl.createBuffer();
            lumaPositionLocation = gl.getAttribLocation(program, "aLumaPosition");
            chromaPositionBuffer = gl.createBuffer();
            chromaPositionLocation = gl.getAttribLocation(program, "aChromaPosition");
          }
          self.drawFrame = function(buffer3) {
            var format = buffer3.format;
            var formatUpdate = !program || canvas2.width !== format.displayWidth || canvas2.height !== format.displayHeight;
            if (formatUpdate) {
              canvas2.width = format.displayWidth;
              canvas2.height = format.displayHeight;
              self.clear();
            }
            if (!program) {
              init();
            }
            if (formatUpdate) {
              var setupTexturePosition = function(buffer4, location, texWidth) {
                var textureX0 = format.cropLeft / texWidth;
                var textureX1 = (format.cropLeft + format.cropWidth) / texWidth;
                var textureY0 = (format.cropTop + format.cropHeight) / format.height;
                var textureY1 = format.cropTop / format.height;
                var textureRectangle = new Float32Array([
                  textureX0,
                  textureY0,
                  textureX1,
                  textureY0,
                  textureX0,
                  textureY1,
                  textureX0,
                  textureY1,
                  textureX1,
                  textureY0,
                  textureX1,
                  textureY1
                ]);
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer4);
                gl.bufferData(gl.ARRAY_BUFFER, textureRectangle, gl.STATIC_DRAW);
              };
              setupTexturePosition(
                lumaPositionBuffer,
                lumaPositionLocation,
                buffer3.y.stride
              );
              setupTexturePosition(
                chromaPositionBuffer,
                chromaPositionLocation,
                buffer3.u.stride * format.width / format.chromaWidth
              );
            }
            uploadTexture("uTextureY", formatUpdate, buffer3.y.stride, format.height, buffer3.y.bytes);
            uploadTexture("uTextureCb", formatUpdate, buffer3.u.stride, format.chromaHeight, buffer3.u.bytes);
            uploadTexture("uTextureCr", formatUpdate, buffer3.v.stride, format.chromaHeight, buffer3.v.bytes);
            if (WebGLFrameSink.stripe) {
              unpackTexture("uTextureY", formatUpdate, buffer3.y.stride, format.height);
              unpackTexture("uTextureCb", formatUpdate, buffer3.u.stride, format.chromaHeight);
              unpackTexture("uTextureCr", formatUpdate, buffer3.v.stride, format.chromaHeight);
            }
            gl.useProgram(program);
            gl.viewport(0, 0, canvas2.width, canvas2.height);
            attachTexture("uTextureY", gl.TEXTURE0, 0);
            attachTexture("uTextureCb", gl.TEXTURE1, 1);
            attachTexture("uTextureCr", gl.TEXTURE2, 2);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, lumaPositionBuffer);
            gl.enableVertexAttribArray(lumaPositionLocation);
            gl.vertexAttribPointer(lumaPositionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, chromaPositionBuffer);
            gl.enableVertexAttribArray(chromaPositionLocation);
            gl.vertexAttribPointer(chromaPositionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLES, 0, rectangle.length / 2);
          };
          self.clear = function() {
            gl.viewport(0, 0, canvas2.width, canvas2.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
          };
          self.clear();
          return self;
        }
        WebGLFrameSink.stripe = false;
        WebGLFrameSink.contextForCanvas = function(canvas2) {
          var options = {
            // Don't trigger discrete GPU in multi-GPU systems
            preferLowPowerToHighPerformance: true,
            powerPreference: "low-power",
            // Don't try to use software GL rendering!
            failIfMajorPerformanceCaveat: true,
            // In case we need to capture the resulting output.
            preserveDrawingBuffer: true
          };
          return canvas2.getContext("webgl", options) || canvas2.getContext("experimental-webgl", options);
        };
        WebGLFrameSink.isAvailable = function() {
          var canvas2 = document.createElement("canvas"), gl;
          canvas2.width = 1;
          canvas2.height = 1;
          try {
            gl = WebGLFrameSink.contextForCanvas(canvas2);
          } catch (e) {
            return false;
          }
          if (gl) {
            var register = gl.TEXTURE0, width = 4, height = 4, texture = gl.createTexture(), data = new Uint8Array(width * height), texWidth = WebGLFrameSink.stripe ? width / 4 : width, format = WebGLFrameSink.stripe ? gl.RGBA : gl.ALPHA, filter = WebGLFrameSink.stripe ? gl.NEAREST : gl.LINEAR;
            gl.activeTexture(register);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              // mip level
              format,
              // internal format
              texWidth,
              height,
              0,
              // border
              format,
              // format
              gl.UNSIGNED_BYTE,
              //type
              data
              // data!
            );
            var err = gl.getError();
            if (err) {
              return false;
            } else {
              return true;
            }
          } else {
            return false;
          }
        };
        WebGLFrameSink.prototype = Object.create(FrameSink.prototype);
        module.exports = WebGLFrameSink;
      })();
    }
  });

  // node_modules/yuv-canvas/src/yuv-canvas.js
  var require_yuv_canvas = __commonJS({
    "node_modules/yuv-canvas/src/yuv-canvas.js"(exports, module) {
      (function() {
        "use strict";
        var FrameSink = require_FrameSink(), SoftwareFrameSink = require_SoftwareFrameSink(), WebGLFrameSink = require_WebGLFrameSink();
        var YUVCanvas = {
          FrameSink,
          SoftwareFrameSink,
          WebGLFrameSink,
          /**
           * Attach a suitable FrameSink instance to an HTML5 canvas element.
           *
           * This will take over the drawing context of the canvas and may turn
           * it into a WebGL 3d canvas if possible. Do not attempt to use the
           * drawing context directly after this.
           *
           * @param {HTMLCanvasElement} canvas - HTML canvas element to attach to
           * @param {YUVCanvasOptions} options - map of options
           * @returns {FrameSink} - instance of suitable subclass.
           */
          attach: function(canvas2, options) {
            options = options || {};
            var webGL = "webGL" in options ? options.webGL : WebGLFrameSink.isAvailable();
            if (webGL) {
              return new WebGLFrameSink(canvas2, options);
            } else {
              return new SoftwareFrameSink(canvas2, options);
            }
          }
        };
        module.exports = YUVCanvas;
      })();
    }
  });

  // node_modules/@yume-chan/async/esm/promise-resolver.js
  var PromiseResolver = class {
    #promise;
    get promise() {
      return this.#promise;
    }
    #resolve;
    #reject;
    #state = "running";
    get state() {
      return this.#state;
    }
    constructor() {
      this.#promise = new Promise((resolve, reject) => {
        this.#resolve = resolve;
        this.#reject = reject;
      });
    }
    resolve = (value) => {
      this.#resolve(value);
      this.#state = "resolved";
    };
    reject = (reason) => {
      this.#reject(reason);
      this.#state = "rejected";
    };
  };

  // node_modules/@yume-chan/async/esm/async-operation-manager.js
  var AsyncOperationManager = class {
    nextId;
    pendingResolvers = /* @__PURE__ */ new Map();
    constructor(startId = 0) {
      this.nextId = startId;
    }
    add() {
      const id = this.nextId++;
      const resolver = new PromiseResolver();
      this.pendingResolvers.set(id, resolver);
      return [id, resolver.promise];
    }
    getResolver(id) {
      if (!this.pendingResolvers.has(id)) {
        return null;
      }
      const resolver = this.pendingResolvers.get(id);
      this.pendingResolvers.delete(id);
      return resolver;
    }
    resolve(id, result) {
      const resolver = this.getResolver(id);
      if (resolver !== null) {
        resolver.resolve(result);
        return true;
      }
      return false;
    }
    reject(id, reason) {
      const resolver = this.getResolver(id);
      if (resolver !== null) {
        resolver.reject(reason);
        return true;
      }
      return false;
    }
  };

  // node_modules/@yume-chan/async/esm/delay.js
  function delay(time) {
    return new Promise((resolve) => {
      globalThis.setTimeout(() => resolve(), time);
    });
  }

  // node_modules/@yume-chan/async/esm/maybe-promise.js
  function isPromiseLike(value) {
    return typeof value === "object" && value !== null && "then" in value;
  }

  // node_modules/@yume-chan/struct/esm/bipedal.js
  function advance(iterator, next) {
    while (true) {
      const { done, value } = iterator.next(next);
      if (done) {
        return value;
      }
      if (isPromiseLike(value)) {
        return value.then((value2) => advance(iterator, { resolved: value2 }), (error) => advance(iterator, { error }));
      }
      next = value;
    }
  }
  // @__NO_SIDE_EFFECTS__
  function bipedal(fn, bindThis) {
    function result(...args) {
      const iterator = fn.call(this, function* (value) {
        if (isPromiseLike(value)) {
          const result2 = yield value;
          if ("resolved" in result2) {
            return result2.resolved;
          } else {
            throw result2.error;
          }
        }
        return value;
      }, ...args);
      return advance(iterator, void 0);
    }
    if (bindThis) {
      return result.bind(bindThis);
    } else {
      return result;
    }
  }

  // node_modules/@yume-chan/struct/esm/field/serialize.js
  function defaultFieldSerializer(serializer) {
    return (source, context) => {
      if ("buffer" in context) {
        const buffer3 = serializer(source, context);
        context.buffer.set(buffer3, context.index);
        return buffer3.length;
      } else {
        return serializer(source, context);
      }
    };
  }
  function byobFieldSerializer(size, serializer) {
    return (source, context) => {
      if ("buffer" in context) {
        context.index ??= 0;
        serializer(source, context);
        return size;
      } else {
        const buffer3 = new Uint8Array(size);
        serializer(source, {
          buffer: buffer3,
          index: 0,
          littleEndian: context.littleEndian
        });
        return buffer3;
      }
    };
  }

  // node_modules/@yume-chan/struct/esm/field/factory.js
  // @__NO_SIDE_EFFECTS__
  function _field(size, type, serialize3, deserialize, options) {
    const field3 = {
      size,
      type,
      serialize: type === "default" ? defaultFieldSerializer(serialize3) : byobFieldSerializer(size, serialize3),
      deserialize: bipedal(deserialize),
      omitInit: options?.omitInit
    };
    if (options?.init) {
      field3.init = options.init;
    }
    return field3;
  }
  var field = _field;

  // node_modules/@yume-chan/struct/esm/buffer.js
  var EmptyUint8Array = new Uint8Array(0);
  function copyMaybeDifferentLength(dest, source, index, length) {
    if (source.length < length) {
      dest.set(source, index);
      dest.fill(0, index + source.length, index + length);
    } else if (source.length === length) {
      dest.set(source, index);
    } else {
      dest.set(source.subarray(0, length), index);
    }
  }
  // @__NO_SIDE_EFFECTS__
  function buffer(lengthOrField, converter) {
    if (typeof lengthOrField === "number") {
      let serialize3;
      let deserialize2;
      let init2;
      if (lengthOrField === 0) {
        serialize3 = () => {
        };
        if (converter) {
          deserialize2 = function* () {
            return converter.convert(EmptyUint8Array);
          };
        } else {
          deserialize2 = function* () {
            return EmptyUint8Array;
          };
        }
      } else {
        serialize3 = (value, { buffer: buffer3, index }) => copyMaybeDifferentLength(buffer3, value, index, lengthOrField);
        if (converter) {
          deserialize2 = function* (then, reader) {
            const array = reader.readExactly(lengthOrField);
            return converter.convert(yield* then(array));
          };
          init2 = (value) => converter.back(value);
        } else {
          deserialize2 = function* (_then, reader) {
            const array = reader.readExactly(lengthOrField);
            return array;
          };
        }
      }
      return field(lengthOrField, "byob", serialize3, deserialize2, { init: init2 });
    }
    if ((typeof lengthOrField === "object" || typeof lengthOrField === "function") && "serialize" in lengthOrField) {
      let deserialize2;
      let init2;
      if (converter) {
        deserialize2 = function* (then, reader, context) {
          const length = yield* then(lengthOrField.deserialize(reader, context));
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
          return converter.convert(yield* then(array));
        };
        init2 = (value) => converter.back(value);
      } else {
        deserialize2 = function* (then, reader, context) {
          const length = yield* then(lengthOrField.deserialize(reader, context));
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
          return array;
        };
      }
      return field(lengthOrField.size, "default", (value, { littleEndian }) => {
        if (lengthOrField.type === "default") {
          const lengthBuffer = lengthOrField.serialize(value.length, {
            littleEndian
          });
          if (value.length === 0) {
            return lengthBuffer;
          }
          const result = new Uint8Array(lengthBuffer.length + value.length);
          result.set(lengthBuffer, 0);
          result.set(value, lengthBuffer.length);
          return result;
        } else {
          const result = new Uint8Array(lengthOrField.size + value.length);
          lengthOrField.serialize(value.length, {
            buffer: result,
            index: 0,
            littleEndian
          });
          result.set(value, lengthOrField.size);
          return result;
        }
      }, deserialize2, { init: init2 });
    }
    if (typeof lengthOrField === "string") {
      let deserialize2;
      let init2;
      if (converter) {
        deserialize2 = function* (then, reader, { dependencies }) {
          const length = dependencies[lengthOrField];
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
          return converter.convert(yield* then(array));
        };
        init2 = (value, dependencies) => {
          const array = converter.back(value);
          dependencies[lengthOrField] = array.length;
          return array;
        };
      } else {
        deserialize2 = function* (_then, reader, { dependencies }) {
          const length = dependencies[lengthOrField];
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
          return array;
        };
        init2 = (value, dependencies) => {
          const array = value;
          dependencies[lengthOrField] = array.length;
          return array;
        };
      }
      return field(0, "default", (source) => source, deserialize2, { init: init2 });
    }
    let deserialize;
    let init;
    if (converter) {
      deserialize = function* (then, reader, { dependencies }) {
        const rawLength = dependencies[lengthOrField.field];
        const length = lengthOrField.convert(rawLength);
        const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
        return converter.convert(yield* then(array));
      };
      init = (value, dependencies) => {
        const array = converter.back(value);
        dependencies[lengthOrField.field] = lengthOrField.back(array.length);
        return array;
      };
    } else {
      deserialize = function* (_then, reader, { dependencies }) {
        const rawLength = dependencies[lengthOrField.field];
        const length = lengthOrField.convert(rawLength);
        const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
        return array;
      };
      init = (value, dependencies) => {
        const array = value;
        dependencies[lengthOrField.field] = lengthOrField.back(array.length);
        return array;
      };
    }
    return field(0, "default", (source) => source, deserialize, { init });
  }

  // node_modules/@yume-chan/struct/esm/readable.js
  var ExactReadableEndedError = class extends Error {
    constructor() {
      super("ExactReadable ended");
    }
  };
  var Uint8ArrayExactReadable = class {
    #data;
    #position;
    get position() {
      return this.#position;
    }
    constructor(data) {
      this.#data = data;
      this.#position = 0;
    }
    readExactly(length) {
      if (this.#position + length > this.#data.length) {
        throw new ExactReadableEndedError();
      }
      const result = this.#data.subarray(this.#position, this.#position + length);
      this.#position += length;
      return result;
    }
  };

  // node_modules/@yume-chan/struct/esm/struct.js
  var StructDeserializeError = class extends Error {
    constructor(message) {
      super(message);
    }
  };
  var StructNotEnoughDataError = class extends StructDeserializeError {
    constructor() {
      super("The underlying readable was ended before the struct was fully deserialized");
    }
  };
  var StructEmptyError = class extends StructDeserializeError {
    constructor() {
      super("The underlying readable doesn't contain any more struct");
    }
  };
  // @__NO_SIDE_EFFECTS__
  function struct(fields, options) {
    const fieldList = Object.entries(fields);
    let size = 0;
    let byob = true;
    for (const [, field3] of fieldList) {
      size += field3.size;
      if (byob && field3.type !== "byob") {
        byob = false;
      }
    }
    const littleEndian = options.littleEndian;
    const extra = options.extra ? Object.getOwnPropertyDescriptors(options.extra) : void 0;
    return {
      littleEndian,
      fields,
      extra: options.extra,
      type: byob ? "byob" : "default",
      size,
      serialize(source, bufferOrContext) {
        const temp = { ...source };
        for (const [key, field3] of fieldList) {
          if (key in temp && "init" in field3) {
            const result = field3.init?.(temp[key], temp);
            temp[key] = result;
          }
        }
        const sizes = new Array(fieldList.length);
        const buffers = new Array(fieldList.length);
        {
          const context2 = { littleEndian };
          for (const [index2, [key, field3]] of fieldList.entries()) {
            if (field3.type === "byob") {
              sizes[index2] = field3.size;
            } else {
              buffers[index2] = field3.serialize(temp[key], context2);
              sizes[index2] = buffers[index2].length;
            }
          }
        }
        const size2 = sizes.reduce((sum, size3) => sum + size3, 0);
        let externalBuffer;
        let buffer3;
        let index;
        if (bufferOrContext instanceof Uint8Array) {
          if (bufferOrContext.length < size2) {
            throw new Error("Buffer too small");
          }
          externalBuffer = true;
          buffer3 = bufferOrContext;
          index = 0;
        } else if (typeof bufferOrContext === "object" && "buffer" in bufferOrContext) {
          externalBuffer = true;
          buffer3 = bufferOrContext.buffer;
          index = bufferOrContext.index ?? 0;
          if (buffer3.length - index < size2) {
            throw new Error("Buffer too small");
          }
        } else {
          externalBuffer = false;
          buffer3 = new Uint8Array(size2);
          index = 0;
        }
        const context = {
          buffer: buffer3,
          index,
          littleEndian
        };
        for (const [index2, [key, field3]] of fieldList.entries()) {
          if (buffers[index2]) {
            buffer3.set(buffers[index2], context.index);
          } else {
            field3.serialize(temp[key], context);
          }
          context.index += sizes[index2];
        }
        if (externalBuffer) {
          return size2;
        } else {
          return buffer3;
        }
      },
      deserialize: bipedal(function* (then, reader) {
        const startPosition = reader.position;
        const result = {};
        const context = {
          dependencies: result,
          littleEndian
        };
        try {
          for (const [key, field3] of fieldList) {
            result[key] = yield* then(field3.deserialize(reader, context));
          }
        } catch (e) {
          if (!(e instanceof ExactReadableEndedError)) {
            throw e;
          }
          if (reader.position === startPosition) {
            throw new StructEmptyError();
          } else {
            throw new StructNotEnoughDataError();
          }
        }
        if (extra) {
          Object.defineProperties(result, extra);
        }
        if (options.postDeserialize) {
          return options.postDeserialize.call(result, result);
        } else {
          return result;
        }
      })
    };
  }

  // node_modules/@yume-chan/struct/esm/extend.js
  // @__NO_SIDE_EFFECTS__
  function extend(base, fields, options) {
    return struct(Object.assign({}, base.fields, fields), {
      littleEndian: options?.littleEndian ?? base.littleEndian,
      extra: base.extra,
      postDeserialize: options?.postDeserialize
    });
  }

  // node_modules/@yume-chan/no-data-view/esm/int32.js
  // @__NO_SIDE_EFFECTS__
  function getInt32(buffer3, offset, littleEndian) {
    return littleEndian ? buffer3[offset] | buffer3[offset + 1] << 8 | buffer3[offset + 2] << 16 | buffer3[offset + 3] << 24 : buffer3[offset] << 24 | buffer3[offset + 1] << 16 | buffer3[offset + 2] << 8 | buffer3[offset + 3];
  }
  function setInt32(buffer3, offset, value, littleEndian) {
    if (littleEndian) {
      buffer3[offset] = value;
      buffer3[offset + 1] = value >> 8;
      buffer3[offset + 2] = value >> 16;
      buffer3[offset + 3] = value >> 24;
    } else {
      buffer3[offset] = value >> 24;
      buffer3[offset + 1] = value >> 16;
      buffer3[offset + 2] = value >> 8;
      buffer3[offset + 3] = value;
    }
  }

  // node_modules/@yume-chan/no-data-view/esm/int64.js
  function setInt64LittleEndian(buffer3, offset, value) {
    buffer3[offset] = Number(value & 0xffn);
    buffer3[offset + 1] = Number(value >> 8n & 0xffn);
    buffer3[offset + 2] = Number(value >> 16n & 0xffn);
    buffer3[offset + 3] = Number(value >> 24n & 0xffn);
    buffer3[offset + 4] = Number(value >> 32n & 0xffn);
    buffer3[offset + 5] = Number(value >> 40n & 0xffn);
    buffer3[offset + 6] = Number(value >> 48n & 0xffn);
    buffer3[offset + 7] = Number(value >> 56n & 0xffn);
  }
  function setInt64BigEndian(buffer3, offset, value) {
    buffer3[offset] = Number(value >> 56n & 0xffn);
    buffer3[offset + 1] = Number(value >> 48n & 0xffn);
    buffer3[offset + 2] = Number(value >> 40n & 0xffn);
    buffer3[offset + 3] = Number(value >> 32n & 0xffn);
    buffer3[offset + 4] = Number(value >> 24n & 0xffn);
    buffer3[offset + 5] = Number(value >> 16n & 0xffn);
    buffer3[offset + 6] = Number(value >> 8n & 0xffn);
    buffer3[offset + 7] = Number(value & 0xffn);
  }

  // node_modules/@yume-chan/no-data-view/esm/uint32.js
  // @__NO_SIDE_EFFECTS__
  function getUint32LittleEndian(buffer3, offset) {
    return (buffer3[offset] | buffer3[offset + 1] << 8 | buffer3[offset + 2] << 16 | buffer3[offset + 3] << 24) >>> 0;
  }
  // @__NO_SIDE_EFFECTS__
  function getUint32(buffer3, offset, littleEndian) {
    return littleEndian ? (buffer3[offset] | buffer3[offset + 1] << 8 | buffer3[offset + 2] << 16 | buffer3[offset + 3] << 24) >>> 0 : (buffer3[offset] << 24 | buffer3[offset + 1] << 16 | buffer3[offset + 2] << 8 | buffer3[offset + 3]) >>> 0;
  }
  function setUint32LittleEndian(buffer3, offset, value) {
    buffer3[offset] = value;
    buffer3[offset + 1] = value >> 8;
    buffer3[offset + 2] = value >> 16;
    buffer3[offset + 3] = value >> 24;
  }
  function setUint32(buffer3, offset, value, littleEndian) {
    if (littleEndian) {
      buffer3[offset] = value;
      buffer3[offset + 1] = value >> 8;
      buffer3[offset + 2] = value >> 16;
      buffer3[offset + 3] = value >> 24;
    } else {
      buffer3[offset] = value >> 24;
      buffer3[offset + 1] = value >> 16;
      buffer3[offset + 2] = value >> 8;
      buffer3[offset + 3] = value;
    }
  }

  // node_modules/@yume-chan/no-data-view/esm/uint64.js
  function getUint64BigEndian(buffer3, offset) {
    return BigInt(buffer3[offset]) << 56n | BigInt(buffer3[offset + 1]) << 48n | BigInt(buffer3[offset + 2]) << 40n | BigInt(buffer3[offset + 3]) << 32n | BigInt(buffer3[offset + 4]) << 24n | BigInt(buffer3[offset + 5]) << 16n | BigInt(buffer3[offset + 6]) << 8n | BigInt(buffer3[offset + 7]);
  }
  function getUint64(buffer3, offset, littleEndian) {
    return littleEndian ? BigInt(buffer3[offset]) | BigInt(buffer3[offset + 1]) << 8n | BigInt(buffer3[offset + 2]) << 16n | BigInt(buffer3[offset + 3]) << 24n | BigInt(buffer3[offset + 4]) << 32n | BigInt(buffer3[offset + 5]) << 40n | BigInt(buffer3[offset + 6]) << 48n | BigInt(buffer3[offset + 7]) << 56n : BigInt(buffer3[offset]) << 56n | BigInt(buffer3[offset + 1]) << 48n | BigInt(buffer3[offset + 2]) << 40n | BigInt(buffer3[offset + 3]) << 32n | BigInt(buffer3[offset + 4]) << 24n | BigInt(buffer3[offset + 5]) << 16n | BigInt(buffer3[offset + 6]) << 8n | BigInt(buffer3[offset + 7]);
  }
  function setUint64(buffer3, offset, value, littleEndian) {
    if (littleEndian) {
      buffer3[offset] = Number(value & 0xffn);
      buffer3[offset + 1] = Number(value >> 8n & 0xffn);
      buffer3[offset + 2] = Number(value >> 16n & 0xffn);
      buffer3[offset + 3] = Number(value >> 24n & 0xffn);
      buffer3[offset + 4] = Number(value >> 32n & 0xffn);
      buffer3[offset + 5] = Number(value >> 40n & 0xffn);
      buffer3[offset + 6] = Number(value >> 48n & 0xffn);
      buffer3[offset + 7] = Number(value >> 56n & 0xffn);
    } else {
      buffer3[offset] = Number(value >> 56n & 0xffn);
      buffer3[offset + 1] = Number(value >> 48n & 0xffn);
      buffer3[offset + 2] = Number(value >> 40n & 0xffn);
      buffer3[offset + 3] = Number(value >> 32n & 0xffn);
      buffer3[offset + 4] = Number(value >> 24n & 0xffn);
      buffer3[offset + 5] = Number(value >> 16n & 0xffn);
      buffer3[offset + 6] = Number(value >> 8n & 0xffn);
      buffer3[offset + 7] = Number(value & 0xffn);
    }
  }

  // node_modules/@yume-chan/struct/esm/number.js
  // @__NO_SIDE_EFFECTS__
  function number(size, serialize3, deserialize) {
    const fn = (() => fn);
    Object.assign(fn, field(size, "byob", serialize3, deserialize));
    return fn;
  }
  var u8 = /* @__PURE__ */ number(1, (value, { buffer: buffer3, index }) => {
    buffer3[index] = value;
  }, function* (then, reader) {
    const data = yield* then(reader.readExactly(1));
    return data[0];
  });
  var u32 = /* @__PURE__ */ number(4, (value, { buffer: buffer3, index, littleEndian }) => {
    setUint32(buffer3, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(4));
    return getUint32(data, 0, littleEndian);
  });
  var s32 = /* @__PURE__ */ number(4, (value, { buffer: buffer3, index, littleEndian }) => {
    setInt32(buffer3, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(4));
    return getInt32(data, 0, littleEndian);
  });
  var u64 = /* @__PURE__ */ number(8, (value, { buffer: buffer3, index, littleEndian }) => {
    setUint64(buffer3, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(8));
    return getUint64(data, 0, littleEndian);
  });

  // node_modules/@yume-chan/struct/esm/utils.js
  var { TextEncoder, TextDecoder } = globalThis;
  var SharedEncoder = /* @__PURE__ */ new TextEncoder();
  var SharedDecoder = /* @__PURE__ */ new TextDecoder();
  // @__NO_SIDE_EFFECTS__
  function encodeUtf8(input) {
    return SharedEncoder.encode(input);
  }
  // @__NO_SIDE_EFFECTS__
  function decodeUtf8(buffer3) {
    return SharedDecoder.decode(buffer3);
  }

  // node_modules/@yume-chan/struct/esm/string.js
  var string = (/* @__NO_SIDE_EFFECTS__ */ (lengthOrField) => {
    const field3 = buffer(lengthOrField, {
      convert: decodeUtf8,
      back: encodeUtf8
    });
    field3.as = () => field3;
    return field3;
  });

  // node_modules/@yume-chan/stream-extra/esm/stream.js
  var { AbortController } = globalThis;
  var ReadableStream2 = /* @__PURE__ */ (() => {
    const { ReadableStream: ReadableStream5 } = globalThis;
    if (!ReadableStream5.from) {
      ReadableStream5.from = function(iterable) {
        const iterator = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
        return new ReadableStream5({
          async pull(controller) {
            const result = await iterator.next();
            if (result.done) {
              controller.close();
              return;
            }
            controller.enqueue(result.value);
          },
          async cancel(reason) {
            await iterator.return?.(reason);
          }
        });
      };
    }
    if (!ReadableStream5.prototype[Symbol.asyncIterator] || !ReadableStream5.prototype.values) {
      ReadableStream5.prototype.values = async function* (options) {
        const reader = this.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              return;
            }
            yield value;
          }
        } finally {
          if (!options?.preventCancel) {
            await reader.cancel();
          }
          reader.releaseLock();
        }
      };
      ReadableStream5.prototype[Symbol.asyncIterator] = // eslint-disable-next-line @typescript-eslint/unbound-method
      ReadableStream5.prototype.values;
    }
    return ReadableStream5;
  })();
  var { WritableStream, TransformStream: TransformStream2 } = globalThis;

  // node_modules/@yume-chan/stream-extra/esm/task-queue.js
  var TaskQueue = class {
    #ready;
    #disposed = false;
    enqueue(task, bail = false) {
      if (this.#disposed) {
        throw new Error("TaskQueue is disposed");
      }
      if (!this.#ready) {
        try {
          const result2 = task();
          if (isPromiseLike(result2)) {
            this.#ready = result2.then(() => {
            }, (e) => {
              if (bail) {
                throw e;
              }
            });
          }
          return result2;
        } catch (e) {
          if (bail) {
            const promise = Promise.reject(e);
            void promise.catch(() => {
            });
            this.#ready = promise;
          }
          throw e;
        }
      }
      const result = this.#ready.then(() => {
        if (this.#disposed) {
          throw new Error("TaskQueue is disposed");
        }
        return task();
      });
      this.#ready = result.then(() => {
      }, (e) => {
        if (bail || this.#disposed) {
          throw e;
        }
      });
      return result;
    }
    dispose() {
      this.#disposed = true;
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/push-readable.js
  var PushReadableStream = class extends ReadableStream2 {
    /**
     * Create a new `PushReadableStream` from a source.
     *
     * @param source If `source` returns a `Promise`, the stream will be closed
     * when the `Promise` is resolved, and be errored when the `Promise` is rejected.
     * @param strategy
     */
    constructor(source, strategy, logger) {
      let controller;
      const tasks = new TaskQueue();
      let zeroHighWaterMarkAllowEnqueue = false;
      let waterMarkLow;
      const abortController = new AbortController();
      let stopped = false;
      const enqueue = (chunk) => {
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "start"
        });
        if (abortController.signal.aborted) {
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "ignored"
          });
          return false;
        }
        if (controller.desiredSize === null) {
          controller.enqueue(chunk);
          throw new Error("unreachable");
        }
        if (zeroHighWaterMarkAllowEnqueue) {
          zeroHighWaterMarkAllowEnqueue = false;
          controller.enqueue(chunk);
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "complete"
          });
          return true;
        }
        if (controller.desiredSize <= 0) {
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "waiting"
          });
          waterMarkLow = new PromiseResolver();
          return waterMarkLow.promise.then(() => {
            controller.enqueue(chunk);
            logger?.({
              source: "producer",
              operation: "enqueue",
              value: chunk,
              phase: "complete"
            });
            return true;
          }, () => {
            logger?.({
              source: "producer",
              operation: "enqueue",
              value: chunk,
              phase: "ignored"
            });
            return false;
          });
        }
        controller.enqueue(chunk);
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "complete"
        });
        return true;
      };
      const close = (explicit) => {
        logger?.({
          source: "producer",
          operation: "close",
          explicit,
          phase: "start"
        });
        if (abortController.signal.aborted || stopped && !explicit) {
          logger?.({
            source: "producer",
            operation: "close",
            explicit,
            phase: "ignored"
          });
          return;
        }
        controller.close();
        stopped = true;
        waterMarkLow?.reject();
        logger?.({
          source: "producer",
          operation: "close",
          explicit,
          phase: "complete"
        });
      };
      const error = (error2, explicit) => {
        logger?.({
          source: "producer",
          operation: "error",
          explicit,
          phase: "start"
        });
        stopped = true;
        controller.error(error2);
        waterMarkLow?.reject();
        logger?.({
          source: "producer",
          operation: "error",
          explicit,
          phase: "complete"
        });
      };
      super({
        start: (controller_) => {
          controller = controller_;
          const result = source({
            abortSignal: abortController.signal,
            enqueue: async (chunk) => (
              // Run `enqueue`s in serial
              // Use `async/await` to always return a `Promise`
              await tasks.enqueue(() => enqueue(chunk))
            ),
            close() {
              close(true);
            },
            error(e) {
              error(e, true);
            }
          });
          if (!stopped && isPromiseLike(result)) {
            result.then(() => close(false), (e) => error(e, false));
          }
        },
        pull: () => {
          logger?.({
            source: "consumer",
            operation: "pull",
            phase: "start"
          });
          if (waterMarkLow) {
            waterMarkLow.resolve(void 0);
            waterMarkLow = void 0;
          } else if (strategy?.highWaterMark === 0) {
            zeroHighWaterMarkAllowEnqueue = true;
          }
          logger?.({
            source: "consumer",
            operation: "pull",
            phase: "complete"
          });
        },
        cancel: (reason) => {
          logger?.({
            source: "consumer",
            operation: "cancel",
            phase: "start"
          });
          stopped = true;
          abortController.abort(reason);
          waterMarkLow?.reject();
          logger?.({
            source: "consumer",
            operation: "cancel",
            phase: "complete"
          });
        }
      }, strategy);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/try-close.js
  function tryClose(value) {
    try {
      const result = value.close();
      if (isPromiseLike(result)) {
        return result.then(() => true, () => false);
      }
      return true;
    } catch {
      return false;
    }
  }
  async function tryCancel(stream) {
    try {
      await stream.cancel();
      return true;
    } catch {
      return false;
    }
  }

  // node_modules/@yume-chan/stream-extra/esm/buffered.js
  var BufferedReadableStream = class {
    #buffered;
    // PERF: `subarray` is slow
    // don't use it until absolutely necessary
    #bufferedOffset = 0;
    #bufferedLength = 0;
    #position = 0;
    get position() {
      return this.#position;
    }
    stream;
    reader;
    constructor(stream) {
      this.stream = stream;
      this.reader = stream.getReader();
    }
    #readBuffered(length) {
      if (!this.#buffered) {
        return void 0;
      }
      const value = this.#buffered.subarray(this.#bufferedOffset, this.#bufferedOffset + length);
      if (this.#bufferedLength > length) {
        this.#position += length;
        this.#bufferedOffset += length;
        this.#bufferedLength -= length;
        return value;
      }
      this.#position += this.#bufferedLength;
      this.#buffered = void 0;
      this.#bufferedOffset = 0;
      this.#bufferedLength = 0;
      return value;
    }
    async #readSource(length) {
      const { done, value } = await this.reader.read();
      if (done) {
        throw new ExactReadableEndedError();
      }
      if (value.length > length) {
        this.#buffered = value;
        this.#bufferedOffset = length;
        this.#bufferedLength = value.length - length;
        this.#position += length;
        return value.subarray(0, length);
      }
      this.#position += value.length;
      return value;
    }
    iterateExactly(length) {
      let state = this.#buffered ? 0 : 1;
      return {
        next: () => {
          switch (state) {
            case 0: {
              const value = this.#readBuffered(length);
              if (value.length === length) {
                state = 2;
              } else {
                length -= value.length;
                state = 1;
              }
              return { done: false, value };
            }
            case 1:
              state = 3;
              return {
                done: false,
                value: this.#readSource(length).then((value) => {
                  if (value.length === length) {
                    state = 2;
                  } else {
                    length -= value.length;
                    state = 1;
                  }
                  return value;
                })
              };
            case 2:
              return { done: true, value: void 0 };
            case 3:
              throw new Error("Can't call `next` before previous Promise resolves");
            default:
              throw new Error("unreachable");
          }
        }
      };
    }
    readExactly = bipedal(function* (then, length) {
      let result;
      let index = 0;
      const initial = this.#readBuffered(length);
      if (initial) {
        if (initial.length === length) {
          return initial;
        }
        result = new Uint8Array(length);
        result.set(initial, index);
        index += initial.length;
        length -= initial.length;
      } else {
        result = new Uint8Array(length);
      }
      while (length > 0) {
        const value = yield* then(this.#readSource(length));
        result.set(value, index);
        index += value.length;
        length -= value.length;
      }
      return result;
    });
    /**
     * Return a readable stream with unconsumed data (if any) and
     * all data from the wrapped stream.
     * @returns A `ReadableStream`
     */
    release() {
      if (this.#bufferedLength > 0) {
        return new PushReadableStream(async (controller) => {
          const buffered = this.#buffered.subarray(this.#bufferedOffset);
          await controller.enqueue(buffered);
          controller.abortSignal.addEventListener("abort", () => {
            void tryCancel(this.reader);
          });
          while (true) {
            const { done, value } = await this.reader.read();
            if (done) {
              return;
            }
            await controller.enqueue(value);
          }
        });
      } else {
        this.reader.releaseLock();
        return this.stream;
      }
    }
    async cancel(reason) {
      await this.reader.cancel(reason);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/buffered-transform.js
  var BufferedTransformStream = class {
    #readable;
    get readable() {
      return this.#readable;
    }
    #writable;
    get writable() {
      return this.#writable;
    }
    constructor(transform) {
      let bufferedStreamController;
      let writableStreamController;
      const buffered = new BufferedReadableStream(new PushReadableStream((controller) => {
        bufferedStreamController = controller;
      }));
      this.#readable = new ReadableStream2({
        async pull(controller) {
          try {
            const value = await transform(buffered);
            controller.enqueue(value);
          } catch (e) {
            if (e instanceof StructEmptyError) {
              controller.close();
              return;
            }
            throw e;
          }
        },
        cancel: (reason) => {
          return writableStreamController.error(reason);
        }
      });
      this.#writable = new WritableStream({
        start(controller) {
          writableStreamController = controller;
        },
        async write(chunk) {
          await bufferedStreamController.enqueue(chunk);
        },
        abort() {
          bufferedStreamController.close();
        },
        close() {
          bufferedStreamController.close();
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/concat.js
  var ConcatStringStream = class {
    // PERF: rope (concat strings) is faster than `[].join('')`
    #result = "";
    #resolver = new PromiseResolver();
    #writable = new WritableStream({
      write: (chunk) => {
        this.#result += chunk;
      },
      close: () => {
        this.#resolver.resolve(this.#result);
        this.#readableController.enqueue(this.#result);
        this.#readableController.close();
      },
      abort: (reason) => {
        this.#resolver.reject(reason);
        this.#readableController.error(reason);
      }
    });
    get writable() {
      return this.#writable;
    }
    #readableController;
    #readable = new ReadableStream2({
      start: (controller) => {
        this.#readableController = controller;
      }
    });
    get readable() {
      return this.#readable;
    }
    constructor() {
      void Object.defineProperties(this.#readable, {
        then: {
          get: () => this.#resolver.promise.then.bind(this.#resolver.promise)
        },
        catch: {
          get: () => this.#resolver.promise.catch.bind(this.#resolver.promise)
        },
        finally: {
          get: () => this.#resolver.promise.finally.bind(this.#resolver.promise)
        }
      });
    }
  };
  var ConcatBufferStream = class {
    #segments = [];
    #resolver = new PromiseResolver();
    #writable = new WritableStream({
      write: (chunk) => {
        this.#segments.push(chunk);
      },
      close: () => {
        let result;
        let offset = 0;
        switch (this.#segments.length) {
          case 0:
            result = EmptyUint8Array;
            break;
          case 1:
            result = this.#segments[0];
            break;
          default:
            result = new Uint8Array(this.#segments.reduce((prev, item) => prev + item.length, 0));
            for (const segment of this.#segments) {
              result.set(segment, offset);
              offset += segment.length;
            }
            break;
        }
        this.#resolver.resolve(result);
        this.#readableController.enqueue(result);
        this.#readableController.close();
      },
      abort: (reason) => {
        this.#resolver.reject(reason);
        this.#readableController.error(reason);
      }
    });
    get writable() {
      return this.#writable;
    }
    #readableController;
    #readable = new ReadableStream2({
      start: (controller) => {
        this.#readableController = controller;
      }
    });
    get readable() {
      return this.#readable;
    }
    constructor() {
      void Object.defineProperties(this.#readable, {
        then: {
          get: () => this.#resolver.promise.then.bind(this.#resolver.promise)
        },
        catch: {
          get: () => this.#resolver.promise.catch.bind(this.#resolver.promise)
        },
        finally: {
          get: () => this.#resolver.promise.finally.bind(this.#resolver.promise)
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/consumable/readable.js
  var ConsumableReadableStream = class _ConsumableReadableStream extends ReadableStream2 {
    static async enqueue(controller, chunk) {
      const output = new Consumable(chunk);
      controller.enqueue(output);
      await output.consumed;
    }
    constructor(source, strategy) {
      let wrappedController;
      let wrappedStrategy;
      if (strategy) {
        wrappedStrategy = {};
        if ("highWaterMark" in strategy) {
          wrappedStrategy.highWaterMark = strategy.highWaterMark;
        }
        if ("size" in strategy) {
          wrappedStrategy.size = (chunk) => {
            return strategy.size(chunk.value);
          };
        }
      }
      super({
        start(controller) {
          wrappedController = {
            enqueue(chunk) {
              return _ConsumableReadableStream.enqueue(controller, chunk);
            },
            close() {
              controller.close();
            },
            error(reason) {
              controller.error(reason);
            }
          };
          return source.start?.(wrappedController);
        },
        pull() {
          return source.pull?.(wrappedController);
        },
        cancel(reason) {
          return source.cancel?.(reason);
        }
      }, wrappedStrategy);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/consumable/wrap-byte-readable.js
  var ConsumableWrapByteReadableStream = class extends ReadableStream2 {
    constructor(stream, chunkSize, min) {
      const reader = stream.getReader({ mode: "byob" });
      let array = new Uint8Array(chunkSize);
      super({
        async pull(controller) {
          const { done, value } = await reader.read(array, { min });
          if (done) {
            controller.close();
            return;
          }
          await ConsumableReadableStream.enqueue(controller, value);
          array = new Uint8Array(value.buffer);
        },
        cancel(reason) {
          return reader.cancel(reason);
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/consumable/wrap-writable.js
  var ConsumableWrapWritableStream = class extends WritableStream {
    constructor(stream) {
      const writer = stream.getWriter();
      super({
        write(chunk) {
          return chunk.tryConsume((chunk2) => writer.write(chunk2));
        },
        abort(reason) {
          return writer.abort(reason);
        },
        close() {
          return writer.close();
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/consumable/writable.js
  var ConsumableWritableStream = class extends WritableStream {
    static async write(writer, value) {
      const consumable = new Consumable(value);
      await writer.write(consumable);
      await consumable.consumed;
    }
    constructor(sink, strategy) {
      let wrappedStrategy;
      if (strategy) {
        wrappedStrategy = {};
        if ("highWaterMark" in strategy) {
          wrappedStrategy.highWaterMark = strategy.highWaterMark;
        }
        if ("size" in strategy) {
          wrappedStrategy.size = (chunk) => {
            return strategy.size(chunk instanceof Consumable ? chunk.value : chunk);
          };
        }
      }
      super({
        start(controller) {
          return sink.start?.(controller);
        },
        write(chunk, controller) {
          return chunk.tryConsume((chunk2) => sink.write?.(chunk2, controller));
        },
        abort(reason) {
          return sink.abort?.(reason);
        },
        close() {
          return sink.close?.();
        }
      }, wrappedStrategy);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/task.js
  var { console: console2 } = globalThis;
  var createTask = /* @__PURE__ */ (() => console2?.createTask?.bind(console2) ?? (() => ({
    run(callback) {
      return callback();
    }
  })))();

  // node_modules/@yume-chan/stream-extra/esm/consumable.js
  var Consumable = class {
    static WritableStream = ConsumableWritableStream;
    static WrapWritableStream = ConsumableWrapWritableStream;
    static ReadableStream = ConsumableReadableStream;
    static WrapByteReadableStream = ConsumableWrapByteReadableStream;
    #task;
    #resolver;
    value;
    consumed;
    constructor(value) {
      this.#task = createTask("Consumable");
      this.value = value;
      this.#resolver = new PromiseResolver();
      this.consumed = this.#resolver.promise;
    }
    consume() {
      this.#resolver.resolve();
    }
    error(error) {
      this.#resolver.reject(error);
    }
    tryConsume(callback) {
      try {
        let result = this.#task.run(() => callback(this.value));
        if (isPromiseLike(result)) {
          result = result.then((value) => {
            this.#resolver.resolve();
            return value;
          }, (e) => {
            this.#resolver.reject(e);
            throw e;
          });
        } else {
          this.#resolver.resolve();
        }
        return result;
      } catch (e) {
        this.#resolver.reject(e);
        throw e;
      }
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/maybe-consumable/index.js
  var maybe_consumable_exports = {};
  __export(maybe_consumable_exports, {
    WrapWritableStream: () => MaybeConsumableWrapWritableStream,
    WritableStream: () => MaybeConsumableWritableStream,
    getValue: () => getValue,
    tryConsume: () => tryConsume
  });

  // node_modules/@yume-chan/stream-extra/esm/maybe-consumable/utils.js
  function getValue(value) {
    return value instanceof Consumable ? value.value : value;
  }
  function tryConsume(value, callback) {
    if (value instanceof Consumable) {
      return value.tryConsume(callback);
    } else {
      return callback(value);
    }
  }

  // node_modules/@yume-chan/stream-extra/esm/maybe-consumable/wrap-writable.js
  var MaybeConsumableWrapWritableStream = class extends WritableStream {
    constructor(stream) {
      const writer = stream.getWriter();
      super({
        write(chunk) {
          return tryConsume(chunk, (chunk2) => writer.write(chunk2));
        },
        abort(reason) {
          return writer.abort(reason);
        },
        close() {
          return writer.close();
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/maybe-consumable/writable.js
  var MaybeConsumableWritableStream = class extends WritableStream {
    constructor(sink, strategy) {
      let wrappedStrategy;
      if (strategy) {
        wrappedStrategy = {};
        if ("highWaterMark" in strategy) {
          wrappedStrategy.highWaterMark = strategy.highWaterMark;
        }
        if ("size" in strategy) {
          wrappedStrategy.size = (chunk) => {
            return strategy.size(chunk instanceof Consumable ? chunk.value : chunk);
          };
        }
      }
      super({
        start(controller) {
          return sink.start?.(controller);
        },
        write(chunk, controller) {
          return tryConsume(chunk, (chunk2) => sink.write?.(chunk2, controller));
        },
        abort(reason) {
          return sink.abort?.(reason);
        },
        close() {
          return sink.close?.();
        }
      }, wrappedStrategy);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/distribution.js
  var BufferCombiner = class {
    #capacity;
    #buffer;
    #offset;
    #available;
    constructor(size) {
      this.#capacity = size;
      this.#buffer = new Uint8Array(size);
      this.#offset = 0;
      this.#available = size;
    }
    /**
     * Pushes data to the combiner.
     * @param data The input data to be split or combined.
     * @returns
     * A generator that yields buffers of specified size.
     * It may yield the same buffer multiple times, consume the data before calling `next`.
     */
    *push(data) {
      let offset = 0;
      let available = data.length;
      if (this.#offset !== 0) {
        if (available >= this.#available) {
          this.#buffer.set(data.subarray(0, this.#available), this.#offset);
          offset += this.#available;
          available -= this.#available;
          yield this.#buffer;
          this.#offset = 0;
          this.#available = this.#capacity;
          if (available === 0) {
            return;
          }
        } else {
          this.#buffer.set(data, this.#offset);
          this.#offset += available;
          this.#available -= available;
          return;
        }
      }
      while (available >= this.#capacity) {
        const end = offset + this.#capacity;
        yield data.subarray(offset, end);
        offset = end;
        available -= this.#capacity;
      }
      if (available > 0) {
        this.#buffer.set(data.subarray(offset), this.#offset);
        this.#offset += available;
        this.#available -= available;
      }
    }
    flush() {
      if (this.#offset === 0) {
        return void 0;
      }
      const output = this.#buffer.subarray(0, this.#offset);
      this.#offset = 0;
      this.#available = this.#capacity;
      return output;
    }
  };
  var DistributionStream = class extends TransformStream2 {
    constructor(size, combine = false) {
      const combiner = combine ? new BufferCombiner(size) : void 0;
      super({
        async transform(chunk, controller) {
          await maybe_consumable_exports.tryConsume(chunk, async (chunk2) => {
            if (combiner) {
              for (const buffer3 of combiner.push(chunk2)) {
                await Consumable.ReadableStream.enqueue(controller, buffer3);
              }
            } else {
              let offset = 0;
              let available = chunk2.length;
              while (available > 0) {
                const end = offset + size;
                await Consumable.ReadableStream.enqueue(controller, chunk2.subarray(offset, end));
                offset = end;
                available -= size;
              }
            }
          });
        },
        flush(controller) {
          if (combiner) {
            const data = combiner.flush();
            if (data) {
              controller.enqueue(data);
            }
          }
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/wrap-readable.js
  function getWrappedReadableStream(wrapper, controller) {
    if ("start" in wrapper) {
      return wrapper.start(controller);
    } else if (typeof wrapper === "function") {
      return wrapper(controller);
    } else {
      return wrapper;
    }
  }
  var WrapReadableStream = class extends ReadableStream2 {
    readable;
    #reader;
    constructor(wrapper, strategy) {
      super({
        start: async (controller) => {
          const readable = await getWrappedReadableStream(wrapper, controller);
          this.readable = readable;
          this.#reader = this.readable.getReader();
        },
        pull: async (controller) => {
          const { done, value } = await this.#reader.read().catch((e) => {
            if ("error" in wrapper) {
              wrapper.error(e);
            }
            throw e;
          });
          if (done) {
            controller.close();
            if ("close" in wrapper) {
              await wrapper.close?.();
            }
          } else {
            controller.enqueue(value);
          }
        },
        cancel: async (reason) => {
          await this.#reader.cancel(reason);
          if ("cancel" in wrapper) {
            await wrapper.cancel?.(reason);
          }
        }
      }, strategy);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/duplex.js
  var NOOP = () => {
  };
  var DuplexStreamFactory = class {
    #readableControllers = [];
    #writers = [];
    #writableClosed = false;
    get writableClosed() {
      return this.#writableClosed;
    }
    #closed = new PromiseResolver();
    get closed() {
      return this.#closed.promise;
    }
    #options;
    constructor(options) {
      this.#options = options ?? {};
    }
    wrapReadable(readable, strategy) {
      return new WrapReadableStream({
        start: (controller) => {
          this.#readableControllers.push(controller);
          return readable;
        },
        cancel: async () => {
          await this.close();
        },
        close: async () => {
          await this.dispose();
        }
      }, strategy);
    }
    createWritable(stream) {
      const writer = stream.getWriter();
      this.#writers.push(writer);
      return new WritableStream({
        write: async (chunk) => {
          await writer.write(chunk);
        },
        abort: async (reason) => {
          await writer.abort(reason);
          await this.close();
        },
        close: async () => {
          await writer.close().catch(NOOP);
          await this.close();
        }
      });
    }
    async close() {
      if (this.#writableClosed) {
        return;
      }
      this.#writableClosed = true;
      if (await this.#options.close?.() !== false) {
        await this.dispose();
      }
      for (const writer of this.#writers) {
        writer.close().catch(NOOP);
      }
    }
    async dispose() {
      this.#writableClosed = true;
      this.#closed.resolve();
      for (const controller of this.#readableControllers) {
        tryClose(controller);
      }
      await this.#options.dispose?.();
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/encoding.js
  var Global = globalThis;
  var TextDecoderStream = Global.TextDecoderStream;
  var TextEncoderStream = Global.TextEncoderStream;

  // node_modules/@yume-chan/stream-extra/esm/pipe-from.js
  function pipeFrom(writable, pair) {
    const writer = pair.writable.getWriter();
    const pipe = pair.readable.pipeTo(writable);
    return new WritableStream({
      async write(chunk) {
        await writer.write(chunk);
      },
      async close() {
        await writer.close();
        await pipe;
      }
    });
  }

  // node_modules/@yume-chan/stream-extra/esm/struct-deserialize.js
  var StructDeserializeStream = class extends BufferedTransformStream {
    constructor(struct3) {
      super((stream) => {
        return struct3.deserialize(stream);
      });
    }
  };

  // node_modules/@yume-chan/event/esm/disposable.js
  var AutoDisposable = class {
    #disposables = [];
    constructor() {
      this.dispose = this.dispose.bind(this);
    }
    addDisposable(disposable) {
      this.#disposables.push(disposable);
      return disposable;
    }
    dispose() {
      for (const disposable of this.#disposables) {
        disposable.dispose();
      }
      this.#disposables = [];
    }
  };

  // node_modules/@yume-chan/event/esm/event-emitter.js
  var EventEmitter = class {
    listeners = [];
    constructor() {
      this.event = this.event.bind(this);
    }
    addEventListener(info) {
      this.listeners.push(info);
      const remove = () => {
        const index = this.listeners.indexOf(info);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      };
      remove.dispose = remove;
      return remove;
    }
    event = (listener, thisArg, ...args) => {
      const info = {
        listener,
        thisArg,
        args
      };
      return this.addEventListener(info);
    };
    fire(e) {
      for (const info of this.listeners.slice()) {
        info.listener.call(info.thisArg, e, ...info.args);
      }
    }
    dispose() {
      this.listeners.length = 0;
    }
  };

  // node_modules/@yume-chan/event/esm/sticky-event-emitter.js
  var Undefined = /* @__PURE__ */ Symbol("undefined");
  var StickyEventEmitter = class extends EventEmitter {
    #value = Undefined;
    addEventListener(info) {
      if (this.#value !== Undefined) {
        info.listener.call(info.thisArg, this.#value, ...info.args);
      }
      return super.addEventListener(info);
    }
    fire(e) {
      this.#value = e;
      super.fire(e);
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/base.js
  var AdbServiceBase = class extends AutoDisposable {
    #adb;
    get adb() {
      return this.#adb;
    }
    constructor(adb) {
      super();
      this.#adb = adb;
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/framebuffer.js
  var Version = struct({ version: u32 }, { littleEndian: true });
  var AdbFrameBufferV1 = struct({
    bpp: u32,
    size: u32,
    width: u32,
    height: u32,
    red_offset: u32,
    red_length: u32,
    blue_offset: u32,
    blue_length: u32,
    green_offset: u32,
    green_length: u32,
    alpha_offset: u32,
    alpha_length: u32,
    data: buffer("size")
  }, { littleEndian: true });
  var AdbFrameBufferV2 = struct({
    bpp: u32,
    colorSpace: u32,
    size: u32,
    width: u32,
    height: u32,
    red_offset: u32,
    red_length: u32,
    blue_offset: u32,
    blue_length: u32,
    green_offset: u32,
    green_length: u32,
    alpha_offset: u32,
    alpha_length: u32,
    data: buffer("size")
  }, { littleEndian: true });
  var AdbFrameBufferError = class extends Error {
    constructor(message, options) {
      super(message, options);
    }
  };
  var AdbFrameBufferUnsupportedVersionError = class extends AdbFrameBufferError {
    constructor(version) {
      super(`Unsupported FrameBuffer version ${version}`);
    }
  };
  var AdbFrameBufferForbiddenError = class extends AdbFrameBufferError {
    constructor() {
      super("FrameBuffer is disabled by current app");
    }
  };
  async function framebuffer(adb) {
    const socket = await adb.createSocket("framebuffer:");
    const stream = new BufferedReadableStream(socket.readable);
    let version;
    try {
      ({ version } = await Version.deserialize(stream));
    } catch (e) {
      if (e instanceof StructEmptyError) {
        throw new AdbFrameBufferForbiddenError();
      }
      throw e;
    }
    switch (version) {
      case 1:
        return await AdbFrameBufferV1.deserialize(stream);
      case 2:
        return await AdbFrameBufferV2.deserialize(stream);
      default:
        throw new AdbFrameBufferUnsupportedVersionError(version);
    }
  }

  // node_modules/@yume-chan/adb/esm/commands/power.js
  var AdbPower = class extends AdbServiceBase {
    reboot(mode = "") {
      return this.adb.createSocketAndWait(`reboot:${mode}`);
    }
    bootloader() {
      return this.reboot("bootloader");
    }
    fastboot() {
      return this.reboot("fastboot");
    }
    recovery() {
      return this.reboot("recovery");
    }
    sideload() {
      return this.reboot("sideload");
    }
    /**
     * Reboot to Qualcomm Emergency Download (EDL) Mode.
     *
     * Only works on some Qualcomm devices.
     */
    qualcommEdlMode() {
      return this.reboot("edl");
    }
    powerOff() {
      return this.adb.subprocess.noneProtocol.spawnWaitText(["reboot", "-p"]);
    }
    powerButton(longPress = false) {
      const args = ["input", "keyevent"];
      if (longPress) {
        args.push("--longpress");
      }
      args.push("POWER");
      return this.adb.subprocess.noneProtocol.spawnWaitText(args);
    }
    /**
     * Reboot to Samsung Odin download mode.
     *
     * Only works on Samsung devices.
     */
    samsungOdin() {
      return this.reboot("download");
    }
  };

  // node_modules/@yume-chan/adb/esm/utils/array-buffer.js
  function toLocalUint8Array(value) {
    if (value.buffer instanceof ArrayBuffer) {
      return value;
    }
    const copy = new Uint8Array(value.length);
    copy.set(value);
    return copy;
  }

  // node_modules/@yume-chan/adb/esm/utils/auto-reset-event.js
  var AutoResetEvent = class {
    #set;
    #queue = [];
    constructor(initialSet = false) {
      this.#set = initialSet;
    }
    wait() {
      if (!this.#set) {
        this.#set = true;
        if (this.#queue.length === 0) {
          return Promise.resolve();
        }
      }
      const resolver = new PromiseResolver();
      this.#queue.push(resolver);
      return resolver.promise;
    }
    notifyOne() {
      if (this.#queue.length !== 0) {
        this.#queue.pop().resolve();
      } else {
        this.#set = false;
      }
    }
    dispose() {
      for (const item of this.#queue) {
        item.reject(new Error("The AutoResetEvent has been disposed"));
      }
      this.#queue.length = 0;
    }
  };

  // node_modules/@yume-chan/adb/esm/utils/base64.js
  var [charToIndex, indexToChar, paddingChar] = /* @__PURE__ */ (() => {
    const charToIndex2 = [];
    const indexToChar2 = [];
    const paddingChar2 = "=".charCodeAt(0);
    function addRange(start, end) {
      const charCodeStart = start.charCodeAt(0);
      const charCodeEnd = end.charCodeAt(0);
      for (let charCode = charCodeStart; charCode <= charCodeEnd; charCode += 1) {
        charToIndex2[charCode] = indexToChar2.length;
        indexToChar2.push(charCode);
      }
    }
    addRange("A", "Z");
    addRange("a", "z");
    addRange("0", "9");
    addRange("+", "+");
    addRange("/", "/");
    return [charToIndex2, indexToChar2, paddingChar2];
  })();
  function calculateBase64EncodedLength(inputLength) {
    const remainder = inputLength % 3;
    const paddingLength = remainder !== 0 ? 3 - remainder : 0;
    return [(inputLength + paddingLength) / 3 * 4, paddingLength];
  }
  function encodeBase64(input, output) {
    const [outputLength, paddingLength] = calculateBase64EncodedLength(input.length);
    if (!output) {
      output = new Uint8Array(outputLength);
      encodeForward(input, output, paddingLength);
      return output;
    } else {
      if (output.length < outputLength) {
        throw new TypeError("output buffer is too small");
      }
      output = output.subarray(0, outputLength);
      if (input.buffer !== output.buffer) {
        encodeForward(input, output, paddingLength);
      } else if (output.byteOffset + output.length - (paddingLength + 1) <= input.byteOffset + input.length) {
        encodeForward(input, output, paddingLength);
      } else if (output.byteOffset >= input.byteOffset - 1) {
        encodeBackward(input, output, paddingLength);
      } else {
        throw new TypeError("input and output cannot overlap");
      }
      return outputLength;
    }
  }
  function encodeForward(input, output, paddingLength) {
    let inputIndex = 0;
    let outputIndex = 0;
    while (inputIndex < input.length - 2) {
      const x = input[inputIndex];
      inputIndex += 1;
      const y = input[inputIndex];
      inputIndex += 1;
      const z = input[inputIndex];
      inputIndex += 1;
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex += 1;
      output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
      outputIndex += 1;
      output[outputIndex] = indexToChar[(y & 15) << 2 | z >> 6];
      outputIndex += 1;
      output[outputIndex] = indexToChar[z & 63];
      outputIndex += 1;
    }
    if (paddingLength === 2) {
      const x = input[inputIndex];
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex += 1;
      output[outputIndex] = indexToChar[(x & 3) << 4];
      outputIndex += 1;
      output[outputIndex] = paddingChar;
      outputIndex += 1;
      output[outputIndex] = paddingChar;
    } else if (paddingLength === 1) {
      const x = input[inputIndex];
      inputIndex += 1;
      const y = input[inputIndex];
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex += 1;
      output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
      outputIndex += 1;
      output[outputIndex] = indexToChar[(y & 15) << 2];
      outputIndex += 1;
      output[outputIndex] = paddingChar;
    }
  }
  function encodeBackward(input, output, paddingLength) {
    let inputIndex = input.length - 1;
    let outputIndex = output.length - 1;
    if (paddingLength === 2) {
      const x = input[inputIndex];
      inputIndex -= 1;
      output[outputIndex] = paddingChar;
      outputIndex -= 1;
      output[outputIndex] = paddingChar;
      outputIndex -= 1;
      output[outputIndex] = indexToChar[(x & 3) << 4];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex -= 1;
    } else if (paddingLength === 1) {
      const y = input[inputIndex];
      inputIndex -= 1;
      const x = input[inputIndex];
      inputIndex -= 1;
      output[outputIndex] = paddingChar;
      outputIndex -= 1;
      output[outputIndex] = indexToChar[(y & 15) << 2];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex -= 1;
    }
    while (inputIndex >= 0) {
      const z = input[inputIndex];
      inputIndex -= 1;
      const y = input[inputIndex];
      inputIndex -= 1;
      const x = input[inputIndex];
      inputIndex -= 1;
      output[outputIndex] = indexToChar[z & 63];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[(y & 15) << 2 | z >> 6];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex -= 1;
    }
  }

  // node_modules/@yume-chan/adb/esm/utils/hex.js
  function hexCharToNumber(char) {
    if (char < 48) {
      throw new TypeError(`Invalid hex char ${char}`);
    }
    if (char < 58) {
      return char - 48;
    }
    if (char < 65) {
      throw new TypeError(`Invalid hex char ${char}`);
    }
    if (char < 71) {
      return char - 55;
    }
    if (char < 97) {
      throw new TypeError(`Invalid hex char ${char}`);
    }
    if (char < 103) {
      return char - 87;
    }
    throw new TypeError(`Invalid hex char ${char}`);
  }
  function hexToNumber(data) {
    let result = 0;
    for (let i = 0; i < data.length; i += 1) {
      result = result << 4 | hexCharToNumber(data[i]);
    }
    return result;
  }

  // node_modules/@yume-chan/adb/esm/utils/no-op.js
  var NOOP2 = /* @__NO_SIDE_EFFECTS__ */ () => {
  };
  function unreachable(...args) {
    throw new Error("Unreachable. Arguments:\n" + args.join("\n"));
  }

  // node_modules/@yume-chan/adb/esm/utils/sequence-equal.js
  function sequenceEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  // node_modules/@yume-chan/adb/esm/commands/reverse.js
  var AdbReverseStringResponse = struct({
    length: string(4),
    content: string({
      field: "length",
      convert(value) {
        return Number.parseInt(value, 16);
      },
      back(value) {
        return value.toString(16).padStart(4, "0");
      }
    })
  }, { littleEndian: true });
  var AdbReverseError = class extends Error {
    constructor(message) {
      super(message);
    }
  };
  var AdbReverseNotSupportedError = class extends AdbReverseError {
    constructor() {
      super("ADB reverse tunnel is not supported on this device when connected wirelessly.");
    }
  };
  var AdbReverseErrorResponse = extend(AdbReverseStringResponse, {}, {
    postDeserialize(value) {
      if (value.content === "more than one device/emulator") {
        throw new AdbReverseNotSupportedError();
      } else {
        throw new AdbReverseError(value.content);
      }
    }
  });
  function decimalToNumber(buffer3) {
    let value = 0;
    for (const byte of buffer3) {
      if (byte < 48 || byte > 57) {
        return value;
      }
      value = value * 10 + byte - 48;
    }
    return value;
  }
  var OKAY = encodeUtf8("OKAY");
  var AdbReverseService = class extends AdbServiceBase {
    #deviceAddressToLocalAddress = /* @__PURE__ */ new Map();
    async createBufferedStream(service) {
      const socket = await this.adb.createSocket(service);
      return new BufferedReadableStream(socket.readable);
    }
    async sendRequest(service) {
      const stream = await this.createBufferedStream(service);
      const response = await stream.readExactly(4);
      if (!sequenceEqual(response, OKAY)) {
        await AdbReverseErrorResponse.deserialize(stream);
      }
      return stream;
    }
    /**
     * Get a list of all reverse port forwarding on the device.
     */
    async list() {
      const stream = await this.createBufferedStream("reverse:list-forward");
      const response = await AdbReverseStringResponse.deserialize(stream);
      return response.content.split("\n").filter((line) => !!line).map((line) => {
        const [deviceSerial, localName, remoteName] = line.split(" ");
        return { deviceSerial, localName, remoteName };
      });
    }
    /**
     * Add a reverse port forwarding for a program that already listens on a port.
     */
    async addExternal(deviceAddress, localAddress) {
      const stream = await this.sendRequest(`reverse:forward:${deviceAddress};${localAddress}`);
      if (deviceAddress.startsWith("tcp:")) {
        const position = stream.position;
        try {
          const length = hexToNumber(await stream.readExactly(4));
          const port = decimalToNumber(await stream.readExactly(length));
          deviceAddress = `tcp:${port}`;
        } catch (e) {
          if (e instanceof ExactReadableEndedError && stream.position === position) {
          } else {
            throw e;
          }
        }
      }
      return deviceAddress;
    }
    /**
     * Add a reverse port forwarding.
     */
    async add(deviceAddress, handler, localAddress) {
      localAddress = await this.adb.transport.addReverseTunnel(handler, localAddress);
      try {
        deviceAddress = await this.addExternal(deviceAddress, localAddress);
        this.#deviceAddressToLocalAddress.set(deviceAddress, localAddress);
        return deviceAddress;
      } catch (e) {
        await this.adb.transport.removeReverseTunnel(localAddress);
        throw e;
      }
    }
    /**
     * Remove a reverse port forwarding.
     */
    async remove(deviceAddress) {
      const localAddress = this.#deviceAddressToLocalAddress.get(deviceAddress);
      if (localAddress) {
        await this.adb.transport.removeReverseTunnel(localAddress);
      }
      await this.sendRequest(`reverse:killforward:${deviceAddress}`);
    }
    /**
     * Remove all reverse port forwarding, including the ones added by other programs.
     */
    async removeAll() {
      await this.adb.transport.clearReverseTunnels();
      this.#deviceAddressToLocalAddress.clear();
      await this.sendRequest(`reverse:killforward-all`);
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/none/process.js
  var AdbNoneProtocolProcessImpl = class {
    #socket;
    get stdin() {
      return this.#socket.writable;
    }
    get output() {
      return this.#socket.readable;
    }
    #exited;
    get exited() {
      return this.#exited;
    }
    constructor(socket, signal) {
      this.#socket = socket;
      if (signal) {
        const exited = new PromiseResolver();
        this.#socket.closed.then(() => exited.resolve(void 0), (e) => exited.reject(e));
        signal.addEventListener("abort", () => {
          exited.reject(signal.reason);
          this.#socket.close();
        });
        this.#exited = exited.promise;
      } else {
        this.#exited = this.#socket.closed;
      }
    }
    kill() {
      return this.#socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/none/pty.js
  var AdbNoneProtocolPtyProcess = class {
    #socket;
    #writer;
    #input;
    get input() {
      return this.#input;
    }
    get output() {
      return this.#socket.readable;
    }
    get exited() {
      return this.#socket.closed;
    }
    constructor(socket) {
      this.#socket = socket;
      this.#writer = this.#socket.writable.getWriter();
      this.#input = new maybe_consumable_exports.WritableStream({
        write: (chunk) => this.#writer.write(chunk)
      });
    }
    sigint() {
      return this.#writer.write(new Uint8Array([3]));
    }
    kill() {
      return this.#socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/utils.js
  function escapeArg(s) {
    let result = "";
    result += `'`;
    let base = 0;
    while (true) {
      const found = s.indexOf(`'`, base);
      if (found === -1) {
        result += s.substring(base);
        break;
      }
      result += s.substring(base, found);
      result += String.raw`'\''`;
      base = found + 1;
    }
    result += `'`;
    return result;
  }
  function splitCommand(command) {
    const result = [];
    let quote;
    let isEscaped = false;
    let start = 0;
    for (let i = 0, len = command.length; i < len; i += 1) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      const char = command.charAt(i);
      switch (char) {
        case " ":
          if (!quote && i !== start) {
            result.push(command.substring(start, i));
            start = i + 1;
          }
          break;
        case "'":
        case '"':
          if (!quote) {
            quote = char;
          } else if (char === quote) {
            quote = void 0;
          }
          break;
        case "\\":
          isEscaped = true;
          break;
      }
    }
    if (start < command.length) {
      result.push(command.substring(start));
    }
    return result;
  }

  // node_modules/@yume-chan/adb/esm/commands/subprocess/none/spawner.js
  var AdbNoneProtocolSpawner = class {
    #spawn;
    constructor(spawn) {
      this.#spawn = spawn;
    }
    spawn(command, signal) {
      signal?.throwIfAborted();
      if (typeof command === "string") {
        command = splitCommand(command);
      }
      return this.#spawn(command, signal);
    }
    async spawnWait(command) {
      const process = await this.spawn(command);
      return await process.output.pipeThrough(new ConcatBufferStream());
    }
    async spawnWaitText(command) {
      const process = await this.spawn(command);
      return await process.output.pipeThrough(new TextDecoderStream()).pipeThrough(new ConcatStringStream());
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/none/service.js
  var AdbNoneProtocolSubprocessService = class extends AdbNoneProtocolSpawner {
    #adb;
    get adb() {
      return this.#adb;
    }
    constructor(adb) {
      super(async (command, signal) => {
        const socket = await this.#adb.createSocket(`exec:${command.join(" ")}`);
        if (signal?.aborted) {
          await socket.close();
          throw signal.reason;
        }
        return new AdbNoneProtocolProcessImpl(socket, signal);
      });
      this.#adb = adb;
    }
    async pty(command) {
      if (command === void 0) {
        command = "";
      } else if (Array.isArray(command)) {
        command = command.join(" ");
      }
      return new AdbNoneProtocolPtyProcess(
        // https://github.com/microsoft/typescript/issues/17002
        await this.#adb.createSocket(`shell:${command}`)
      );
    }
  };

  // node_modules/@yume-chan/adb/esm/features.js
  var AdbFeature = {
    ShellV2: "shell_v2",
    Cmd: "cmd",
    StatV2: "stat_v2",
    ListV2: "ls_v2",
    FixedPushMkdir: "fixed_push_mkdir",
    Abb: "abb",
    AbbExec: "abb_exec",
    SendReceiveV2: "sendrecv_v2",
    DelayedAck: "delayed_ack"
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/shell/shared.js
  var AdbShellProtocolId = {
    Stdin: 0,
    Stdout: 1,
    Stderr: 2,
    Exit: 3,
    CloseStdin: 4,
    WindowSizeChange: 5
  };
  var AdbShellProtocolPacket = struct({
    id: u8(),
    data: buffer(u32)
  }, { littleEndian: true });

  // node_modules/@yume-chan/adb/esm/commands/subprocess/shell/process.js
  var AdbShellProtocolProcessImpl = class {
    #socket;
    #writer;
    #stdin;
    get stdin() {
      return this.#stdin;
    }
    #stdout;
    get stdout() {
      return this.#stdout;
    }
    #stderr;
    get stderr() {
      return this.#stderr;
    }
    #exited;
    get exited() {
      return this.#exited;
    }
    constructor(socket, signal) {
      this.#socket = socket;
      let stdoutController;
      let stderrController;
      this.#stdout = new PushReadableStream((controller) => {
        stdoutController = controller;
      });
      this.#stderr = new PushReadableStream((controller) => {
        stderrController = controller;
      });
      const exited = new PromiseResolver();
      this.#exited = exited.promise;
      socket.readable.pipeThrough(new StructDeserializeStream(AdbShellProtocolPacket)).pipeTo(new WritableStream({
        write: async (chunk) => {
          switch (chunk.id) {
            case AdbShellProtocolId.Exit:
              exited.resolve(chunk.data[0]);
              break;
            case AdbShellProtocolId.Stdout:
              await stdoutController.enqueue(chunk.data);
              break;
            case AdbShellProtocolId.Stderr:
              await stderrController.enqueue(chunk.data);
              break;
            default:
              break;
          }
        }
      })).then(() => {
        stdoutController.close();
        stderrController.close();
        exited.reject(new Error("Socket ended without exit message"));
      }, (e) => {
        stdoutController.error(e);
        stderrController.error(e);
        exited.reject(e);
      });
      if (signal) {
        signal.addEventListener("abort", () => {
          exited.reject(signal.reason);
          this.#socket.close();
        });
      }
      this.#writer = this.#socket.writable.getWriter();
      this.#stdin = new maybe_consumable_exports.WritableStream({
        write: async (chunk) => {
          await this.#writer.write(AdbShellProtocolPacket.serialize({
            id: AdbShellProtocolId.Stdin,
            data: chunk
          }));
        },
        close: () => (
          // Only shell protocol + raw mode supports closing stdin
          this.#writer.write(AdbShellProtocolPacket.serialize({
            id: AdbShellProtocolId.CloseStdin,
            data: EmptyUint8Array
          }))
        )
      });
    }
    kill() {
      return this.#socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/shell/pty.js
  var AdbShellProtocolPtyProcess = class {
    #socket;
    #writer;
    #input;
    get input() {
      return this.#input;
    }
    #stdout;
    get output() {
      return this.#stdout;
    }
    #exited = new PromiseResolver();
    get exited() {
      return this.#exited.promise;
    }
    constructor(socket) {
      this.#socket = socket;
      let stdoutController;
      this.#stdout = new PushReadableStream((controller) => {
        stdoutController = controller;
      });
      socket.readable.pipeThrough(new StructDeserializeStream(AdbShellProtocolPacket)).pipeTo(new WritableStream({
        write: async (chunk) => {
          switch (chunk.id) {
            case AdbShellProtocolId.Exit:
              this.#exited.resolve(chunk.data[0]);
              break;
            case AdbShellProtocolId.Stdout:
              await stdoutController.enqueue(chunk.data);
              break;
          }
        }
      })).then(() => {
        stdoutController.close();
        this.#exited.reject(new Error("Socket ended without exit message"));
      }, (e) => {
        stdoutController.error(e);
        this.#exited.reject(e);
      });
      this.#writer = this.#socket.writable.getWriter();
      this.#input = new maybe_consumable_exports.WritableStream({
        write: (chunk) => this.#writeStdin(chunk)
      });
    }
    #writeStdin(chunk) {
      return this.#writer.write(AdbShellProtocolPacket.serialize({
        id: AdbShellProtocolId.Stdin,
        data: chunk
      }));
    }
    async resize(rows, cols) {
      await this.#writer.write(AdbShellProtocolPacket.serialize({
        id: AdbShellProtocolId.WindowSizeChange,
        // The "correct" format is `${rows}x${cols},${x_pixels}x${y_pixels}`
        // However, according to https://linux.die.net/man/4/tty_ioctl
        // `x_pixels` and `y_pixels` are unused, so always sending `0` should be fine.
        data: encodeUtf8(`${rows}x${cols},0x0\0`)
      }));
    }
    sigint() {
      return this.#writeStdin(new Uint8Array([3]));
    }
    kill() {
      return this.#socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/shell/spawner.js
  var AdbShellProtocolSpawner = class {
    #spawn;
    constructor(spawn) {
      this.#spawn = spawn;
    }
    spawn(command, signal) {
      signal?.throwIfAborted();
      if (typeof command === "string") {
        command = splitCommand(command);
      }
      return this.#spawn(command, signal);
    }
    async spawnWait(command) {
      const process = await this.spawn(command);
      const [stdout, stderr, exitCode] = await Promise.all([
        process.stdout.pipeThrough(new ConcatBufferStream()),
        process.stderr.pipeThrough(new ConcatBufferStream()),
        process.exited
      ]);
      return { stdout, stderr, exitCode };
    }
    async spawnWaitText(command) {
      const process = await this.spawn(command);
      const [stdout, stderr, exitCode] = await Promise.all([
        process.stdout.pipeThrough(new TextDecoderStream()).pipeThrough(new ConcatStringStream()),
        process.stderr.pipeThrough(new TextDecoderStream()).pipeThrough(new ConcatStringStream()),
        process.exited
      ]);
      return { stdout, stderr, exitCode };
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/shell/service.js
  var AdbShellProtocolSubprocessService = class extends AdbShellProtocolSpawner {
    #adb;
    get adb() {
      return this.#adb;
    }
    get isSupported() {
      return this.#adb.canUseFeature(AdbFeature.ShellV2);
    }
    constructor(adb) {
      super(async (command, signal) => {
        const socket = await this.#adb.createSocket(`shell,v2,raw:${command.join(" ")}`);
        if (signal?.aborted) {
          await socket.close();
          throw signal.reason;
        }
        return new AdbShellProtocolProcessImpl(socket, signal);
      });
      this.#adb = adb;
    }
    async pty(options) {
      let service = "shell,v2,pty";
      if (options?.terminalType) {
        service += `,TERM=` + options.terminalType;
      }
      service += ":";
      if (options) {
        if (typeof options.command === "string") {
          service += options.command;
        } else if (Array.isArray(options.command)) {
          service += options.command.join(" ");
        }
      }
      return new AdbShellProtocolPtyProcess(await this.#adb.createSocket(service));
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/service.js
  var AdbSubprocessService = class {
    #adb;
    get adb() {
      return this.#adb;
    }
    #noneProtocol;
    get noneProtocol() {
      return this.#noneProtocol;
    }
    #shellProtocol;
    get shellProtocol() {
      return this.#shellProtocol;
    }
    constructor(adb) {
      this.#adb = adb;
      this.#noneProtocol = new AdbNoneProtocolSubprocessService(adb);
      if (adb.canUseFeature(AdbFeature.ShellV2)) {
        this.#shellProtocol = new AdbShellProtocolSubprocessService(adb);
      }
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/sync/response.js
  function encodeAsciiUnchecked(value) {
    const result = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      result[i] = value.charCodeAt(i);
    }
    return result;
  }
  // @__NO_SIDE_EFFECTS__
  function adbSyncEncodeId(value) {
    const buffer3 = encodeAsciiUnchecked(value);
    return getUint32LittleEndian(buffer3, 0);
  }
  var AdbSyncResponseId = {
    Entry: /* @__PURE__ */ adbSyncEncodeId("DENT"),
    Entry2: /* @__PURE__ */ adbSyncEncodeId("DNT2"),
    Lstat: /* @__PURE__ */ adbSyncEncodeId("STAT"),
    Stat: /* @__PURE__ */ adbSyncEncodeId("STA2"),
    Lstat2: /* @__PURE__ */ adbSyncEncodeId("LST2"),
    Done: /* @__PURE__ */ adbSyncEncodeId("DONE"),
    Data: /* @__PURE__ */ adbSyncEncodeId("DATA"),
    Ok: /* @__PURE__ */ adbSyncEncodeId("OKAY"),
    Fail: /* @__PURE__ */ adbSyncEncodeId("FAIL")
  };
  var AdbSyncError = class extends Error {
  };
  var AdbSyncFailResponse = struct({ message: string(u32) }, {
    littleEndian: true,
    postDeserialize(value) {
      throw new AdbSyncError(value.message);
    }
  });
  async function adbSyncReadResponse(stream, id, type) {
    if (typeof id === "string") {
      id = /* @__PURE__ */ adbSyncEncodeId(id);
    }
    const buffer3 = await stream.readExactly(4);
    switch (getUint32LittleEndian(buffer3, 0)) {
      case AdbSyncResponseId.Fail:
        await AdbSyncFailResponse.deserialize(stream);
        throw new Error("Unreachable");
      case id:
        return await type.deserialize(stream);
      default:
        throw new Error(`Expected '${id}', but got '${decodeUtf8(buffer3)}'`);
    }
  }
  async function* adbSyncReadResponses(stream, id, type) {
    if (typeof id === "string") {
      id = /* @__PURE__ */ adbSyncEncodeId(id);
    }
    while (true) {
      const buffer3 = await stream.readExactly(4);
      switch (getUint32LittleEndian(buffer3, 0)) {
        case AdbSyncResponseId.Fail:
          await AdbSyncFailResponse.deserialize(stream);
          unreachable();
        case AdbSyncResponseId.Done:
          await stream.readExactly(type.size);
          return;
        case id:
          yield await type.deserialize(stream);
          break;
        default:
          throw new Error(`Expected '${id}' or '${AdbSyncResponseId.Done}', but got '${decodeUtf8(buffer3)}'`);
      }
    }
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/request.js
  var AdbSyncRequestId = {
    List: adbSyncEncodeId("LIST"),
    ListV2: adbSyncEncodeId("LIS2"),
    Send: adbSyncEncodeId("SEND"),
    SendV2: adbSyncEncodeId("SND2"),
    Lstat: adbSyncEncodeId("STAT"),
    Stat: adbSyncEncodeId("STA2"),
    LstatV2: adbSyncEncodeId("LST2"),
    Data: adbSyncEncodeId("DATA"),
    Done: adbSyncEncodeId("DONE"),
    Receive: adbSyncEncodeId("RECV")
  };
  var AdbSyncNumberRequest = struct({ id: u32, arg: u32 }, { littleEndian: true });
  async function adbSyncWriteRequest(writable, id, value) {
    if (typeof id === "string") {
      id = adbSyncEncodeId(id);
    }
    if (typeof value === "number") {
      await writable.write(AdbSyncNumberRequest.serialize({ id, arg: value }));
      return;
    }
    if (typeof value === "string") {
      value = encodeUtf8(value);
    }
    await writable.write(AdbSyncNumberRequest.serialize({ id, arg: value.length }));
    await writable.write(value);
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/stat.js
  var LinuxFileType = {
    Directory: 4,
    File: 8,
    Link: 10
  };
  var AdbSyncLstatResponse = struct({ mode: u32, size: u32, mtime: u32 }, {
    littleEndian: true,
    extra: {
      get type() {
        return this.mode >> 12;
      },
      get permission() {
        return this.mode & 4095;
      }
    },
    postDeserialize(value) {
      if (value.mode === 0 && value.size === 0 && value.mtime === 0) {
        throw new Error("lstat error");
      }
      return value;
    }
  });
  var AdbSyncStatErrorCode = {
    SUCCESS: 0,
    EACCES: 13,
    EEXIST: 17,
    EFAULT: 14,
    EFBIG: 27,
    EINTR: 4,
    EINVAL: 22,
    EIO: 5,
    EISDIR: 21,
    ELOOP: 40,
    EMFILE: 24,
    ENAMETOOLONG: 36,
    ENFILE: 23,
    ENOENT: 2,
    ENOMEM: 12,
    ENOSPC: 28,
    ENOTDIR: 20,
    EOVERFLOW: 75,
    EPERM: 1,
    EROFS: 30,
    ETXTBSY: 26
  };
  var AdbSyncStatErrorName = /* @__PURE__ */ (() => Object.fromEntries(Object.entries(AdbSyncStatErrorCode).map(([key, value]) => [
    value,
    key
  ])))();
  var AdbSyncStatResponse = struct({
    error: u32(),
    dev: u64,
    ino: u64,
    mode: u32,
    nlink: u32,
    uid: u32,
    gid: u32,
    size: u64,
    atime: u64,
    mtime: u64,
    ctime: u64
  }, {
    littleEndian: true,
    extra: {
      get type() {
        return this.mode >> 12;
      },
      get permission() {
        return this.mode & 4095;
      }
    },
    postDeserialize(value) {
      if (value.error) {
        throw new Error(AdbSyncStatErrorName[value.error]);
      }
      return value;
    }
  });
  async function adbSyncLstat(socket, path, v2) {
    const locked = await socket.lock();
    try {
      if (v2) {
        await adbSyncWriteRequest(locked, AdbSyncRequestId.LstatV2, path);
        return await adbSyncReadResponse(locked, AdbSyncResponseId.Lstat2, AdbSyncStatResponse);
      } else {
        await adbSyncWriteRequest(locked, AdbSyncRequestId.Lstat, path);
        const response = await adbSyncReadResponse(locked, AdbSyncResponseId.Lstat, AdbSyncLstatResponse);
        return {
          mode: response.mode,
          // Convert to `BigInt` to make it compatible with `AdbSyncStatResponse`
          size: BigInt(response.size),
          mtime: BigInt(response.mtime),
          get type() {
            return response.type;
          },
          get permission() {
            return response.permission;
          }
        };
      }
    } finally {
      locked.release();
    }
  }
  async function adbSyncStat(socket, path) {
    const locked = await socket.lock();
    try {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.Stat, path);
      return await adbSyncReadResponse(locked, AdbSyncResponseId.Stat, AdbSyncStatResponse);
    } finally {
      locked.release();
    }
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/list.js
  var AdbSyncEntryResponse = extend(AdbSyncLstatResponse, {
    name: string(u32)
  });
  var AdbSyncEntry2Response = extend(AdbSyncStatResponse, {
    name: string(u32)
  });
  async function* adbSyncOpenDirV2(socket, path) {
    const locked = await socket.lock();
    try {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.ListV2, path);
      for await (const item of adbSyncReadResponses(locked, AdbSyncResponseId.Entry2, AdbSyncEntry2Response)) {
        if (item.error !== AdbSyncStatErrorCode.SUCCESS) {
          continue;
        }
        yield item;
      }
    } finally {
      locked.release();
    }
  }
  async function* adbSyncOpenDirV1(socket, path) {
    const locked = await socket.lock();
    try {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.List, path);
      for await (const item of adbSyncReadResponses(locked, AdbSyncResponseId.Entry, AdbSyncEntryResponse)) {
        yield item;
      }
    } finally {
      locked.release();
    }
  }
  async function* adbSyncOpenDir(socket, path, v2) {
    if (v2) {
      yield* adbSyncOpenDirV2(socket, path);
    } else {
      for await (const item of adbSyncOpenDirV1(socket, path)) {
        yield {
          mode: item.mode,
          size: BigInt(item.size),
          mtime: BigInt(item.mtime),
          get type() {
            return item.type;
          },
          get permission() {
            return item.permission;
          },
          name: item.name
        };
      }
    }
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/pull.js
  var AdbSyncDataResponse = struct({ data: buffer(u32) }, { littleEndian: true });
  async function* adbSyncPullGenerator(socket, path) {
    const locked = await socket.lock();
    let done = false;
    try {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.Receive, path);
      for await (const packet of adbSyncReadResponses(locked, AdbSyncResponseId.Data, AdbSyncDataResponse)) {
        yield packet.data;
      }
      done = true;
    } catch (e) {
      done = true;
      throw e;
    } finally {
      if (!done) {
        for await (const packet of adbSyncReadResponses(locked, AdbSyncResponseId.Data, AdbSyncDataResponse)) {
          void packet;
        }
      }
      locked.release();
    }
  }
  function adbSyncPull(socket, path) {
    return ReadableStream2.from(adbSyncPullGenerator(socket, path));
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/push.js
  var ADB_SYNC_MAX_PACKET_SIZE = 64 * 1024;
  var AdbSyncOkResponse = struct({ unused: u32 }, { littleEndian: true });
  async function pipeFileData(locked, file, packetSize, mtime) {
    const abortController = new AbortController();
    file.pipeThrough(new DistributionStream(packetSize, true)).pipeTo(new maybe_consumable_exports.WritableStream({
      write(chunk) {
        return adbSyncWriteRequest(locked, AdbSyncRequestId.Data, chunk);
      }
    }), { signal: abortController.signal }).then(async () => {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.Done, mtime);
      await locked.flush();
    }, NOOP2);
    await adbSyncReadResponse(locked, AdbSyncResponseId.Ok, AdbSyncOkResponse).catch((e) => {
      abortController.abort();
      throw e;
    });
  }
  async function adbSyncPushV1({ socket, filename, file, type = LinuxFileType.File, permission = 438, mtime = Date.now() / 1e3 | 0, packetSize = ADB_SYNC_MAX_PACKET_SIZE }) {
    const locked = await socket.lock();
    try {
      const mode = type << 12 | permission;
      const pathAndMode = `${filename},${mode.toString()}`;
      await adbSyncWriteRequest(locked, AdbSyncRequestId.Send, pathAndMode);
      await pipeFileData(locked, file, packetSize, mtime);
    } finally {
      locked.release();
    }
  }
  var AdbSyncSendV2Flags = {
    None: 0,
    Brotli: 1,
    /**
     * 2
     */
    Lz4: 1 << 1,
    /**
     * 4
     */
    Zstd: 1 << 2,
    DryRun: 2147483648
  };
  var AdbSyncSendV2Request = struct({ id: u32, mode: u32, flags: u32() }, { littleEndian: true });
  async function adbSyncPushV2({ socket, filename, file, type = LinuxFileType.File, permission = 438, mtime = Date.now() / 1e3 | 0, packetSize = ADB_SYNC_MAX_PACKET_SIZE, dryRun = false }) {
    const locked = await socket.lock();
    try {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.SendV2, filename);
      const mode = type << 12 | permission;
      let flags = AdbSyncSendV2Flags.None;
      if (dryRun) {
        flags |= AdbSyncSendV2Flags.DryRun;
      }
      await locked.write(AdbSyncSendV2Request.serialize({
        id: AdbSyncRequestId.SendV2,
        mode,
        flags
      }));
      await pipeFileData(locked, file, packetSize, mtime);
    } finally {
      locked.release();
    }
  }
  function adbSyncPush(options) {
    if (options.v2) {
      return adbSyncPushV2(options);
    }
    if (options.dryRun) {
      throw new Error("dryRun is not supported in v1");
    }
    return adbSyncPushV1(options);
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/socket.js
  var AdbSyncSocketLocked = class {
    #writer;
    #readable;
    #socketLock;
    #writeLock = new AutoResetEvent();
    #combiner;
    get position() {
      return this.#readable.position;
    }
    constructor(writer, readable, bufferSize, lock) {
      this.#writer = writer;
      this.#readable = readable;
      this.#socketLock = lock;
      this.#combiner = new BufferCombiner(bufferSize);
    }
    #write(buffer3) {
      return Consumable.WritableStream.write(this.#writer, buffer3);
    }
    async flush() {
      try {
        await this.#writeLock.wait();
        const buffer3 = this.#combiner.flush();
        if (buffer3) {
          await this.#write(buffer3);
        }
      } finally {
        this.#writeLock.notifyOne();
      }
    }
    async write(data) {
      try {
        await this.#writeLock.wait();
        for (const buffer3 of this.#combiner.push(data)) {
          await this.#write(buffer3);
        }
      } finally {
        this.#writeLock.notifyOne();
      }
    }
    async readExactly(length) {
      await this.flush();
      return await this.#readable.readExactly(length);
    }
    release() {
      this.#combiner.flush();
      this.#socketLock.notifyOne();
    }
    async close() {
      await this.#readable.cancel();
    }
  };
  var AdbSyncSocket = class {
    #lock = new AutoResetEvent();
    #socket;
    #locked;
    constructor(socket, bufferSize) {
      this.#socket = socket;
      this.#locked = new AdbSyncSocketLocked(socket.writable.getWriter(), new BufferedReadableStream(socket.readable), bufferSize, this.#lock);
    }
    async lock() {
      await this.#lock.wait();
      return this.#locked;
    }
    async close() {
      await this.#locked.close();
      await this.#socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/sync/sync.js
  function dirname(path) {
    const end = path.lastIndexOf("/");
    if (end === -1) {
      throw new Error(`Invalid path`);
    }
    if (end === 0) {
      return "/";
    }
    return path.substring(0, end);
  }
  var AdbSync = class {
    _adb;
    _socket;
    #supportsStat;
    #supportsListV2;
    #fixedPushMkdir;
    #supportsSendReceiveV2;
    #needPushMkdirWorkaround;
    get supportsStat() {
      return this.#supportsStat;
    }
    get supportsListV2() {
      return this.#supportsListV2;
    }
    get fixedPushMkdir() {
      return this.#fixedPushMkdir;
    }
    get supportsSendReceiveV2() {
      return this.#supportsSendReceiveV2;
    }
    get needPushMkdirWorkaround() {
      return this.#needPushMkdirWorkaround;
    }
    constructor(adb, socket) {
      this._adb = adb;
      this._socket = new AdbSyncSocket(socket, adb.maxPayloadSize);
      this.#supportsStat = adb.canUseFeature(AdbFeature.StatV2);
      this.#supportsListV2 = adb.canUseFeature(AdbFeature.ListV2);
      this.#fixedPushMkdir = adb.canUseFeature(AdbFeature.FixedPushMkdir);
      this.#supportsSendReceiveV2 = adb.canUseFeature(AdbFeature.SendReceiveV2);
      this.#needPushMkdirWorkaround = this._adb.canUseFeature(AdbFeature.ShellV2) && !this.fixedPushMkdir;
    }
    /**
     * Gets information of a file or folder.
     *
     * If `path` points to a symbolic link, the returned information is about the link itself (with `type` being `LinuxFileType.Link`).
     */
    async lstat(path) {
      return await adbSyncLstat(this._socket, path, this.#supportsStat);
    }
    /**
     * Gets the information of a file or folder.
     *
     * If `path` points to a symbolic link, it will be resolved and the returned information is about the target (with `type` being `LinuxFileType.File` or `LinuxFileType.Directory`).
     */
    async stat(path) {
      if (!this.#supportsStat) {
        throw new Error("Not supported");
      }
      return await adbSyncStat(this._socket, path);
    }
    /**
     * Checks if `path` is a directory, or a symbolic link to a directory.
     *
     * This uses `lstat` internally, thus works on all Android versions.
     */
    async isDirectory(path) {
      try {
        await this.lstat(path + "/");
        return true;
      } catch {
        return false;
      }
    }
    opendir(path) {
      return adbSyncOpenDir(this._socket, path, this.supportsListV2);
    }
    async readdir(path) {
      const results = [];
      for await (const entry of this.opendir(path)) {
        results.push(entry);
      }
      return results;
    }
    /**
     * Reads the content of a file on device.
     *
     * @param filename The full path of the file on device to read.
     * @returns A `ReadableStream` that contains the file content.
     */
    read(filename) {
      return adbSyncPull(this._socket, filename);
    }
    /**
     * Writes a file on device. If the file name already exists, it will be overwritten.
     *
     * @param options The content and options of the file to write.
     */
    async write(options) {
      if (this.needPushMkdirWorkaround) {
        await this._adb.subprocess.noneProtocol.spawnWait([
          "mkdir",
          "-p",
          escapeArg(dirname(options.filename))
        ]);
      }
      await adbSyncPush({
        v2: this.supportsSendReceiveV2,
        socket: this._socket,
        ...options
      });
    }
    lockSocket() {
      return this._socket.lock();
    }
    dispose() {
      return this._socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/tcpip.js
  function parsePort(value) {
    if (!value || value === "0") {
      return void 0;
    }
    return Number.parseInt(value, 10);
  }
  var AdbTcpIpService = class extends AdbServiceBase {
    async getListenAddresses() {
      const serviceListenAddresses = await this.adb.getProp("service.adb.listen_addrs");
      const servicePort = await this.adb.getProp("service.adb.tcp.port");
      const persistPort = await this.adb.getProp("persist.adb.tcp.port");
      return {
        serviceListenAddresses: serviceListenAddresses != "" ? serviceListenAddresses.split(",") : [],
        servicePort: parsePort(servicePort),
        persistPort: parsePort(persistPort)
      };
    }
    async setPort(port) {
      if (port <= 0) {
        throw new TypeError(`Invalid port ${port}`);
      }
      const output = await this.adb.createSocketAndWait(`tcpip:${port}`);
      if (output !== `restarting in TCP mode port: ${port}
`) {
        throw new Error(output);
      }
      return output;
    }
    async disable() {
      const output = await this.adb.createSocketAndWait("usb:");
      if (output !== "restarting in USB mode\n") {
        throw new Error(output);
      }
      return output;
    }
  };

  // node_modules/@yume-chan/adb/esm/adb.js
  var Adb = class {
    #transport;
    get transport() {
      return this.#transport;
    }
    get serial() {
      return this.#transport.serial;
    }
    get maxPayloadSize() {
      return this.#transport.maxPayloadSize;
    }
    get banner() {
      return this.#transport.banner;
    }
    get disconnected() {
      return this.#transport.disconnected;
    }
    get clientFeatures() {
      return this.#transport.clientFeatures;
    }
    get deviceFeatures() {
      return this.banner.features;
    }
    subprocess;
    power;
    reverse;
    tcpip;
    constructor(transport) {
      this.#transport = transport;
      this.subprocess = new AdbSubprocessService(this);
      this.power = new AdbPower(this);
      this.reverse = new AdbReverseService(this);
      this.tcpip = new AdbTcpIpService(this);
    }
    canUseFeature(feature) {
      return this.clientFeatures.includes(feature) && this.deviceFeatures.includes(feature);
    }
    /**
     * Creates a new ADB Socket to the specified service or socket address.
     */
    async createSocket(service) {
      return this.#transport.connect(service);
    }
    async createSocketAndWait(service) {
      const socket = await this.createSocket(service);
      return await socket.readable.pipeThrough(new TextDecoderStream()).pipeThrough(new ConcatStringStream());
    }
    getProp(key) {
      return this.subprocess.noneProtocol.spawnWaitText(["getprop", key]).then((output) => output.trim());
    }
    rm(filenames, options) {
      const args = ["rm"];
      if (options?.recursive) {
        args.push("-r");
      }
      if (options?.force) {
        args.push("-f");
      }
      if (Array.isArray(filenames)) {
        for (const filename of filenames) {
          args.push(escapeArg(filename));
        }
      } else {
        args.push(escapeArg(filenames));
      }
      args.push("</dev/null");
      return this.subprocess.noneProtocol.spawnWaitText(args);
    }
    async sync() {
      const socket = await this.createSocket("sync:");
      return new AdbSync(this, socket);
    }
    async framebuffer() {
      return framebuffer(this);
    }
    async close() {
      await this.#transport.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/banner.js
  var AdbBannerKey = {
    Product: "ro.product.name",
    Model: "ro.product.model",
    Device: "ro.product.device",
    Features: "features"
  };
  var AdbBanner = class _AdbBanner {
    static parse(banner) {
      let state;
      let product;
      let model;
      let device;
      let features = [];
      const pieces = banner.split("::");
      if (pieces.length > 1) {
        state = pieces[0].trim() || void 0;
        const props = pieces[1];
        for (const prop of props.split(";")) {
          if (!prop) {
            continue;
          }
          const keyValue = prop.split("=");
          if (keyValue.length !== 2) {
            continue;
          }
          const [key, value] = keyValue;
          switch (key) {
            case AdbBannerKey.Product:
              product = value;
              break;
            case AdbBannerKey.Model:
              model = value;
              break;
            case AdbBannerKey.Device:
              device = value;
              break;
            case AdbBannerKey.Features:
              features = value.split(",");
              break;
          }
        }
      }
      return new _AdbBanner(state, product, model, device, features);
    }
    #state;
    get state() {
      return this.#state;
    }
    #product;
    get product() {
      return this.#product;
    }
    #model;
    get model() {
      return this.#model;
    }
    #device;
    get device() {
      return this.#device;
    }
    #features = [];
    get features() {
      return this.#features;
    }
    // eslint-disable-next-line @typescript-eslint/max-params
    constructor(state, product, model, device, features) {
      this.#state = state;
      this.#product = product;
      this.#model = model;
      this.#device = device;
      this.#features = features;
    }
  };

  // node_modules/@yume-chan/adb/esm/daemon/crypto.js
  function getBigUint(array, byteOffset, length) {
    let result = 0n;
    for (let i = byteOffset; i < byteOffset + length; i += 8) {
      result <<= 64n;
      const value = getUint64BigEndian(array, i);
      result |= value;
    }
    return result;
  }
  function setBigUint(array, byteOffset, length, value, littleEndian) {
    if (littleEndian) {
      while (value > 0n) {
        setInt64LittleEndian(array, byteOffset, value);
        byteOffset += 8;
        value >>= 64n;
      }
    } else {
      let position = byteOffset + length - 8;
      while (value > 0n) {
        setInt64BigEndian(array, position, value);
        position -= 8;
        value >>= 64n;
      }
    }
  }
  var RsaPrivateKeyNOffset = 38;
  var RsaPrivateKeyNLength = 2048 / 8;
  var RsaPrivateKeyDOffset = 303;
  var RsaPrivateKeyDLength = 2048 / 8;
  function rsaParsePrivateKey(key) {
    const n = getBigUint(key, RsaPrivateKeyNOffset, RsaPrivateKeyNLength);
    const d = getBigUint(key, RsaPrivateKeyDOffset, RsaPrivateKeyDLength);
    return [n, d];
  }
  function nonNegativeMod(m, d) {
    const r = m % d;
    if (r > 0) {
      return r;
    }
    return r + (d > 0 ? d : -d);
  }
  function modInverse(a, m) {
    a = nonNegativeMod(a, m);
    if (!a || m < 2) {
      return NaN;
    }
    const s = [];
    let b = m;
    while (b) {
      [a, b] = [b, a % b];
      s.push({ a, b });
    }
    if (a !== 1) {
      return NaN;
    }
    let x = 1;
    let y = 0;
    for (let i = s.length - 2; i >= 0; i -= 1) {
      [x, y] = [y, x - y * Math.floor(s[i].a / s[i].b)];
    }
    return nonNegativeMod(y, m);
  }
  var ModulusLengthInBytes = 2048 / 8;
  var ModulusLengthInWords = ModulusLengthInBytes / 4;
  function adbGetPublicKeySize() {
    return 4 + 4 + ModulusLengthInBytes + ModulusLengthInBytes + 4;
  }
  function adbGeneratePublicKey(privateKey, output) {
    let outputType;
    const outputLength = adbGetPublicKeySize();
    if (!output) {
      output = new Uint8Array(outputLength);
      outputType = "Uint8Array";
    } else {
      if (output.length < outputLength) {
        throw new TypeError("output buffer is too small");
      }
      outputType = "number";
    }
    const outputView = new DataView(output.buffer, output.byteOffset, output.length);
    let outputOffset = 0;
    outputView.setUint32(outputOffset, ModulusLengthInWords, true);
    outputOffset += 4;
    const [n] = rsaParsePrivateKey(privateKey);
    const n0inv = -modInverse(Number(n % 2n ** 32n), 2 ** 32);
    outputView.setInt32(outputOffset, n0inv, true);
    outputOffset += 4;
    setBigUint(output, outputOffset, ModulusLengthInBytes, n, true);
    outputOffset += ModulusLengthInBytes;
    const rr = 2n ** 4096n % n;
    setBigUint(output, outputOffset, ModulusLengthInBytes, rr, true);
    outputOffset += ModulusLengthInBytes;
    outputView.setUint32(outputOffset, 65537, true);
    if (outputType === "Uint8Array") {
      return output;
    } else {
      return outputLength;
    }
  }
  function powMod(base, exponent, modulus) {
    if (modulus === 1n) {
      return 0n;
    }
    let r = 1n;
    base = base % modulus;
    while (exponent > 0n) {
      if (BigInt.asUintN(1, exponent) === 1n) {
        r = r * base % modulus;
      }
      base = base * base % modulus;
      exponent >>= 1n;
    }
    return r;
  }
  var SHA1_DIGEST_LENGTH = 20;
  var ASN1_SEQUENCE = 48;
  var ASN1_OCTET_STRING = 4;
  var ASN1_NULL = 5;
  var ASN1_OID = 6;
  var SHA1_DIGEST_INFO = new Uint8Array([
    ASN1_SEQUENCE,
    13 + SHA1_DIGEST_LENGTH,
    ASN1_SEQUENCE,
    9,
    // SHA-1 (1 3 14 3 2 26)
    ASN1_OID,
    5,
    1 * 40 + 3,
    14,
    3,
    2,
    26,
    ASN1_NULL,
    0,
    ASN1_OCTET_STRING,
    SHA1_DIGEST_LENGTH
  ]);
  function rsaSign(privateKey, data) {
    const [n, d] = rsaParsePrivateKey(privateKey);
    const padded = new Uint8Array(256);
    let index = 0;
    padded[index] = 0;
    index += 1;
    padded[index] = 1;
    index += 1;
    const fillLength = padded.length - SHA1_DIGEST_INFO.length - data.length - 1;
    while (index < fillLength) {
      padded[index] = 255;
      index += 1;
    }
    padded[index] = 0;
    index += 1;
    padded.set(SHA1_DIGEST_INFO, index);
    index += SHA1_DIGEST_INFO.length;
    padded.set(data, index);
    const signature = powMod(getBigUint(padded, 0, padded.length), d, n);
    setBigUint(padded, 0, padded.length, signature, false);
    return padded;
  }

  // node_modules/@yume-chan/adb/esm/daemon/packet.js
  var AdbCommand = {
    Auth: 1213486401,
    // 'AUTH'
    Close: 1163086915,
    // 'CLSE'
    Connect: 1314410051,
    // 'CNXN'
    Okay: 1497451343,
    // 'OKAY'
    Open: 1313165391,
    // 'OPEN'
    Write: 1163154007
    // 'WRTE'
  };
  var AdbPacketHeader = struct({
    command: u32,
    arg0: u32,
    arg1: u32,
    payloadLength: u32,
    checksum: u32,
    magic: s32
  }, { littleEndian: true });
  var AdbPacket = extend(AdbPacketHeader, {
    payload: buffer("payloadLength")
  });
  function calculateChecksum(payload) {
    return payload.reduce((result, item) => result + item, 0);
  }
  var AdbPacketSerializeStream = class extends TransformStream2 {
    constructor() {
      const headerBuffer = new Uint8Array(AdbPacketHeader.size);
      super({
        transform: async (chunk, controller) => {
          await chunk.tryConsume(async (chunk2) => {
            const init = chunk2;
            init.payloadLength = init.payload.length;
            AdbPacketHeader.serialize(init, headerBuffer);
            await Consumable.ReadableStream.enqueue(controller, headerBuffer);
            if (init.payloadLength) {
              await Consumable.ReadableStream.enqueue(controller, init.payload);
            }
          });
        }
      });
    }
  };

  // node_modules/@yume-chan/adb/esm/daemon/auth.js
  var AdbAuthType = {
    Token: 1,
    Signature: 2,
    PublicKey: 3
  };
  var AdbSignatureAuthenticator = async function* (credentialStore, getNextRequest) {
    for await (const key of credentialStore.iterateKeys()) {
      const packet = await getNextRequest();
      if (packet.arg0 !== AdbAuthType.Token) {
        return;
      }
      const signature = rsaSign(key.buffer, packet.payload);
      yield {
        command: AdbCommand.Auth,
        arg0: AdbAuthType.Signature,
        arg1: 0,
        payload: signature
      };
    }
  };
  var AdbPublicKeyAuthenticator = async function* (credentialStore, getNextRequest) {
    const packet = await getNextRequest();
    if (packet.arg0 !== AdbAuthType.Token) {
      return;
    }
    let privateKey;
    for await (const key of credentialStore.iterateKeys()) {
      privateKey = key;
      break;
    }
    if (!privateKey) {
      privateKey = await credentialStore.generateKey();
    }
    const publicKeyLength = adbGetPublicKeySize();
    const [publicKeyBase64Length] = calculateBase64EncodedLength(publicKeyLength);
    const nameBuffer = privateKey.name?.length ? encodeUtf8(privateKey.name) : EmptyUint8Array;
    const publicKeyBuffer = new Uint8Array(publicKeyBase64Length + (nameBuffer.length ? nameBuffer.length + 1 : 0) + // Space character + name
    1);
    adbGeneratePublicKey(privateKey.buffer, publicKeyBuffer);
    encodeBase64(publicKeyBuffer.subarray(0, publicKeyLength), publicKeyBuffer);
    if (nameBuffer.length) {
      publicKeyBuffer[publicKeyBase64Length] = 32;
      publicKeyBuffer.set(nameBuffer, publicKeyBase64Length + 1);
    }
    yield {
      command: AdbCommand.Auth,
      arg0: AdbAuthType.PublicKey,
      arg1: 0,
      payload: publicKeyBuffer
    };
  };
  var ADB_DEFAULT_AUTHENTICATORS = [
    AdbSignatureAuthenticator,
    AdbPublicKeyAuthenticator
  ];
  var AdbAuthenticationProcessor = class {
    authenticators;
    #credentialStore;
    #pendingRequest = new PromiseResolver();
    #iterator;
    constructor(authenticators, credentialStore) {
      this.authenticators = authenticators;
      this.#credentialStore = credentialStore;
    }
    #getNextRequest = () => {
      return this.#pendingRequest.promise;
    };
    async *#invokeAuthenticator() {
      for (const authenticator of this.authenticators) {
        for await (const packet of authenticator(this.#credentialStore, this.#getNextRequest)) {
          this.#pendingRequest = new PromiseResolver();
          yield packet;
        }
      }
    }
    async process(packet) {
      if (!this.#iterator) {
        this.#iterator = this.#invokeAuthenticator();
      }
      this.#pendingRequest.resolve(packet);
      const result = await this.#iterator.next();
      if (result.done) {
        throw new Error("No authenticator can handle the request");
      }
      return result.value;
    }
    dispose() {
      void this.#iterator?.return?.();
    }
  };

  // node_modules/@yume-chan/adb/esm/daemon/socket.js
  var AdbDaemonSocketController = class {
    #dispatcher;
    localId;
    remoteId;
    localCreated;
    service;
    #readable;
    #readableController;
    get readable() {
      return this.#readable;
    }
    #writableController;
    writable;
    #closed = false;
    #closedPromise = new PromiseResolver();
    get closed() {
      return this.#closedPromise.promise;
    }
    #socket;
    get socket() {
      return this.#socket;
    }
    #availableWriteBytesChanged;
    /**
     * When delayed ack is disabled, returns `Infinity` if the socket is ready to write
     * (exactly one packet can be written no matter how large it is), or `-1` if the socket
     * is waiting for ack message.
     *
     * When delayed ack is enabled, returns a non-negative finite number indicates the number of
     * bytes that can be written to the socket before waiting for ack message.
     */
    #availableWriteBytes = 0;
    constructor(options) {
      this.#dispatcher = options.dispatcher;
      this.localId = options.localId;
      this.remoteId = options.remoteId;
      this.localCreated = options.localCreated;
      this.service = options.service;
      this.#readable = new PushReadableStream((controller) => {
        this.#readableController = controller;
      });
      this.writable = new maybe_consumable_exports.WritableStream({
        start: (controller) => {
          this.#writableController = controller;
          controller.signal.addEventListener("abort", () => {
            this.#availableWriteBytesChanged?.reject(controller.signal.reason);
          });
        },
        write: async (data) => {
          const size = data.length;
          const chunkSize = this.#dispatcher.options.maxPayloadSize;
          for (let start = 0, end = chunkSize; start < size; start = end, end += chunkSize) {
            const chunk = data.subarray(start, end);
            await this.#writeChunk(chunk);
          }
        }
      });
      this.#socket = new AdbDaemonSocket(this);
      this.#availableWriteBytes = options.availableWriteBytes;
    }
    async #writeChunk(data) {
      const length = data.length;
      while (this.#availableWriteBytes < length) {
        const resolver = new PromiseResolver();
        this.#availableWriteBytesChanged = resolver;
        await resolver.promise;
      }
      if (this.#availableWriteBytes === Infinity) {
        this.#availableWriteBytes = -1;
      } else {
        this.#availableWriteBytes -= length;
      }
      await this.#dispatcher.sendPacket(AdbCommand.Write, this.localId, this.remoteId, data);
    }
    async enqueue(data) {
      await this.#readableController.enqueue(data);
    }
    ack(bytes) {
      this.#availableWriteBytes += bytes;
      this.#availableWriteBytesChanged?.resolve();
    }
    async close() {
      if (this.#closed) {
        return;
      }
      this.#closed = true;
      this.#availableWriteBytesChanged?.reject(new Error("Socket closed"));
      try {
        this.#writableController.error(new Error("Socket closed"));
      } catch {
      }
      await this.#dispatcher.sendPacket(AdbCommand.Close, this.localId, this.remoteId, EmptyUint8Array);
    }
    dispose() {
      this.#readableController.close();
      this.#closedPromise.resolve(void 0);
    }
  };
  var AdbDaemonSocket = class {
    #controller;
    get localId() {
      return this.#controller.localId;
    }
    get remoteId() {
      return this.#controller.remoteId;
    }
    get localCreated() {
      return this.#controller.localCreated;
    }
    get service() {
      return this.#controller.service;
    }
    get readable() {
      return this.#controller.readable;
    }
    get writable() {
      return this.#controller.writable;
    }
    get closed() {
      return this.#controller.closed;
    }
    constructor(controller) {
      this.#controller = controller;
    }
    close() {
      return this.#controller.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/daemon/dispatcher.js
  var AdbPacketDispatcher = class {
    // ADB socket id starts from 1
    // (0 means open failed)
    #initializers = new AsyncOperationManager(1);
    /**
     * Socket local ID to the socket controller.
     */
    #sockets = /* @__PURE__ */ new Map();
    #writer;
    options;
    #closed = false;
    #disconnected = new PromiseResolver();
    get disconnected() {
      return this.#disconnected.promise;
    }
    #incomingSocketHandlers = /* @__PURE__ */ new Map();
    #readAbortController = new AbortController();
    constructor(connection, options) {
      this.options = options;
      if (this.options.initialDelayedAckBytes < 0) {
        this.options.initialDelayedAckBytes = 0;
      }
      connection.readable.pipeTo(new WritableStream({
        write: async (packet, controller) => {
          switch (packet.command) {
            case AdbCommand.Close:
              await this.#handleClose(packet);
              break;
            case AdbCommand.Okay:
              this.#handleOkay(packet);
              break;
            case AdbCommand.Open:
              await this.#handleOpen(packet);
              break;
            case AdbCommand.Write:
              this.#handleWrite(packet).catch((e) => {
                controller.error(e);
              });
              break;
            default:
              throw new Error(`Unknown command: ${packet.command.toString(16)}`);
          }
        }
      }), {
        preventCancel: options.preserveConnection ?? false,
        signal: this.#readAbortController.signal
      }).then(() => {
        this.#dispose();
      }, (e) => {
        if (!this.#closed) {
          this.#disconnected.reject(e);
        }
        this.#dispose();
      });
      this.#writer = connection.writable.getWriter();
    }
    async #handleClose(packet) {
      if (packet.arg0 === 0 && this.#initializers.reject(packet.arg1, new Error("Socket open failed"))) {
        return;
      }
      const socket = this.#sockets.get(packet.arg1);
      if (socket) {
        await socket.close();
        socket.dispose();
        this.#sockets.delete(packet.arg1);
        return;
      }
    }
    #handleOkay(packet) {
      let ackBytes;
      if (this.options.initialDelayedAckBytes !== 0) {
        if (packet.payload.length !== 4) {
          throw new Error("Invalid OKAY packet. Payload size should be 4");
        }
        ackBytes = getUint32LittleEndian(packet.payload, 0);
      } else {
        if (packet.payload.length !== 0) {
          throw new Error("Invalid OKAY packet. Payload size should be 0");
        }
        ackBytes = Infinity;
      }
      if (this.#initializers.resolve(packet.arg1, {
        remoteId: packet.arg0,
        availableWriteBytes: ackBytes
      })) {
        return;
      }
      const socket = this.#sockets.get(packet.arg1);
      if (socket) {
        socket.ack(ackBytes);
        return;
      }
      void this.sendPacket(AdbCommand.Close, packet.arg1, packet.arg0, EmptyUint8Array);
    }
    #sendOkay(localId, remoteId, ackBytes) {
      let payload;
      if (this.options.initialDelayedAckBytes !== 0) {
        payload = new Uint8Array(4);
        setUint32LittleEndian(payload, 0, ackBytes);
      } else {
        payload = EmptyUint8Array;
      }
      return this.sendPacket(AdbCommand.Okay, localId, remoteId, payload);
    }
    async #handleOpen(packet) {
      const [localId] = this.#initializers.add();
      this.#initializers.resolve(localId, void 0);
      const remoteId = packet.arg0;
      let availableWriteBytes = packet.arg1;
      let service = decodeUtf8(packet.payload);
      if (service.endsWith("\0")) {
        service = service.substring(0, service.length - 1);
      }
      if (this.options.initialDelayedAckBytes === 0) {
        if (availableWriteBytes !== 0) {
          throw new Error("Invalid OPEN packet. arg1 should be 0");
        }
        availableWriteBytes = Infinity;
      } else {
        if (availableWriteBytes === 0) {
          throw new Error("Invalid OPEN packet. arg1 should be greater than 0");
        }
      }
      const handler = this.#incomingSocketHandlers.get(service);
      if (!handler) {
        await this.sendPacket(AdbCommand.Close, 0, remoteId, EmptyUint8Array);
        return;
      }
      const controller = new AdbDaemonSocketController({
        dispatcher: this,
        localId,
        remoteId,
        localCreated: false,
        service,
        availableWriteBytes
      });
      try {
        await handler(controller.socket);
        this.#sockets.set(localId, controller);
        await this.#sendOkay(localId, remoteId, this.options.initialDelayedAckBytes);
      } catch {
        await this.sendPacket(AdbCommand.Close, 0, remoteId, EmptyUint8Array);
      }
    }
    async #handleWrite(packet) {
      const socket = this.#sockets.get(packet.arg1);
      if (!socket) {
        throw new Error(`Unknown local socket id: ${packet.arg1}`);
      }
      let handled = false;
      const promises = [
        (async () => {
          await socket.enqueue(packet.payload);
          await this.#sendOkay(packet.arg1, packet.arg0, packet.payload.length);
          handled = true;
        })()
      ];
      if (this.options.readTimeLimit) {
        promises.push((async () => {
          await delay(this.options.readTimeLimit);
          if (!handled) {
            throw new Error(`readable of \`${socket.service}\` has stalled for ${this.options.readTimeLimit} milliseconds`);
          }
        })());
      }
      await Promise.race(promises);
    }
    async createSocket(service) {
      if (this.options.appendNullToServiceString) {
        service += "\0";
      }
      const [localId, initializer] = this.#initializers.add();
      await this.sendPacket(AdbCommand.Open, localId, this.options.initialDelayedAckBytes, service);
      const { remoteId, availableWriteBytes } = await initializer;
      const controller = new AdbDaemonSocketController({
        dispatcher: this,
        localId,
        remoteId,
        localCreated: true,
        service,
        availableWriteBytes
      });
      this.#sockets.set(localId, controller);
      return controller.socket;
    }
    addReverseTunnel(service, handler) {
      this.#incomingSocketHandlers.set(service, handler);
    }
    removeReverseTunnel(address) {
      this.#incomingSocketHandlers.delete(address);
    }
    clearReverseTunnels() {
      this.#incomingSocketHandlers.clear();
    }
    async sendPacket(command, arg0, arg1, payload) {
      if (typeof payload === "string") {
        payload = encodeUtf8(payload);
      }
      if (payload.length > this.options.maxPayloadSize) {
        throw new TypeError("payload too large");
      }
      await Consumable.WritableStream.write(this.#writer, {
        command,
        arg0,
        arg1,
        payload,
        checksum: this.options.calculateChecksum ? calculateChecksum(payload) : 0,
        magic: command ^ 4294967295
      });
    }
    async close() {
      await Promise.all(Array.from(this.#sockets.values(), (socket) => socket.close()));
      this.#closed = true;
      this.#readAbortController.abort();
      if (this.options.preserveConnection) {
        this.#writer.releaseLock();
      } else {
        await this.#writer.close();
      }
    }
    #dispose() {
      for (const socket of this.#sockets.values()) {
        socket.dispose();
      }
      this.#disconnected.resolve();
    }
  };

  // node_modules/@yume-chan/adb/esm/daemon/transport.js
  var ADB_DAEMON_VERSION_OMIT_CHECKSUM = 16777217;
  var ADB_DAEMON_DEFAULT_FEATURES = /* @__PURE__ */ (() => [
    AdbFeature.ShellV2,
    AdbFeature.Cmd,
    AdbFeature.StatV2,
    AdbFeature.ListV2,
    AdbFeature.FixedPushMkdir,
    "apex",
    AdbFeature.Abb,
    // only tells the client the symlink timestamp issue in `adb push --sync` has been fixed.
    // No special handling required.
    "fixed_push_symlink_timestamp",
    AdbFeature.AbbExec,
    "remount_shell",
    "track_app",
    AdbFeature.SendReceiveV2,
    "sendrecv_v2_brotli",
    "sendrecv_v2_lz4",
    "sendrecv_v2_zstd",
    "sendrecv_v2_dry_run_send",
    AdbFeature.DelayedAck
  ])();
  var ADB_DAEMON_DEFAULT_INITIAL_PAYLOAD_SIZE = 32 * 1024 * 1024;
  var AdbDaemonTransport = class _AdbDaemonTransport {
    /**
     * Authenticate with the ADB Daemon and create a new transport.
     */
    static async authenticate({ serial, connection, credentialStore, authenticators = ADB_DEFAULT_AUTHENTICATORS, features = ADB_DAEMON_DEFAULT_FEATURES, initialDelayedAckBytes = ADB_DAEMON_DEFAULT_INITIAL_PAYLOAD_SIZE, ...options }) {
      let version = 16777217;
      let maxPayloadSize = 1024 * 1024;
      const resolver = new PromiseResolver();
      const authProcessor = new AdbAuthenticationProcessor(authenticators, credentialStore);
      const abortController = new AbortController();
      const pipe = connection.readable.pipeTo(new WritableStream({
        async write(packet) {
          switch (packet.command) {
            case AdbCommand.Connect:
              version = Math.min(version, packet.arg0);
              maxPayloadSize = Math.min(maxPayloadSize, packet.arg1);
              resolver.resolve(decodeUtf8(packet.payload));
              break;
            case AdbCommand.Auth: {
              const response = await authProcessor.process(packet);
              await sendPacket(response);
              break;
            }
            default:
              break;
          }
        }
      }), {
        // Don't cancel the source ReadableStream on AbortSignal abort.
        preventCancel: true,
        signal: abortController.signal
      }).then(() => {
        resolver.reject(new Error("Connection closed unexpectedly"));
      }, (e) => {
        resolver.reject(e);
      });
      const writer = connection.writable.getWriter();
      async function sendPacket(init) {
        init.checksum = calculateChecksum(init.payload);
        init.magic = init.command ^ 4294967295;
        await Consumable.WritableStream.write(writer, init);
      }
      const actualFeatures = features.slice();
      if (initialDelayedAckBytes <= 0) {
        const index = features.indexOf(AdbFeature.DelayedAck);
        if (index !== -1) {
          actualFeatures.splice(index, 1);
        }
      }
      let banner;
      try {
        await sendPacket({
          command: AdbCommand.Connect,
          arg0: version,
          arg1: maxPayloadSize,
          // The terminating `;` is required in formal definition
          // But ADB daemon (all versions) can still work without it
          payload: encodeUtf8(`host::features=${actualFeatures.join(",")}`)
        });
        banner = await resolver.promise;
      } finally {
        abortController.abort();
        writer.releaseLock();
        await pipe;
      }
      return new _AdbDaemonTransport({
        serial,
        connection,
        version,
        maxPayloadSize,
        banner,
        features: actualFeatures,
        initialDelayedAckBytes,
        ...options
      });
    }
    #connection;
    get connection() {
      return this.#connection;
    }
    #dispatcher;
    #serial;
    get serial() {
      return this.#serial;
    }
    #protocolVersion;
    get protocolVersion() {
      return this.#protocolVersion;
    }
    get maxPayloadSize() {
      return this.#dispatcher.options.maxPayloadSize;
    }
    #banner;
    get banner() {
      return this.#banner;
    }
    get disconnected() {
      return this.#dispatcher.disconnected;
    }
    #clientFeatures;
    get clientFeatures() {
      return this.#clientFeatures;
    }
    constructor({ serial, connection, version, banner, features = ADB_DAEMON_DEFAULT_FEATURES, initialDelayedAckBytes, ...options }) {
      this.#serial = serial;
      this.#connection = connection;
      this.#banner = AdbBanner.parse(banner);
      this.#clientFeatures = features;
      if (features.includes(AdbFeature.DelayedAck)) {
        if (initialDelayedAckBytes <= 0) {
          throw new TypeError("`initialDelayedAckBytes` must be greater than 0 when DelayedAck feature is enabled.");
        }
        if (!this.#banner.features.includes(AdbFeature.DelayedAck)) {
          initialDelayedAckBytes = 0;
        }
      } else {
        initialDelayedAckBytes = 0;
      }
      let calculateChecksum2;
      let appendNullToServiceString;
      if (version >= ADB_DAEMON_VERSION_OMIT_CHECKSUM) {
        calculateChecksum2 = false;
        appendNullToServiceString = false;
      } else {
        calculateChecksum2 = true;
        appendNullToServiceString = true;
      }
      this.#dispatcher = new AdbPacketDispatcher(connection, {
        calculateChecksum: calculateChecksum2,
        appendNullToServiceString,
        initialDelayedAckBytes,
        ...options
      });
      this.#protocolVersion = version;
    }
    connect(service) {
      return this.#dispatcher.createSocket(service);
    }
    addReverseTunnel(handler, address) {
      if (!address) {
        const id = Math.random().toString().substring(2);
        address = `localabstract:reverse_${id}`;
      }
      this.#dispatcher.addReverseTunnel(address, handler);
      return address;
    }
    removeReverseTunnel(address) {
      this.#dispatcher.removeReverseTunnel(address);
    }
    clearReverseTunnels() {
      this.#dispatcher.clearReverseTunnels();
    }
    close() {
      return this.#dispatcher.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/server/observer.js
  function unorderedRemove(array, index) {
    if (index < 0 || index >= array.length) {
      return;
    }
    array[index] = array[array.length - 1];
    array.length -= 1;
  }

  // node_modules/@yume-chan/adb-daemon-webusb/esm/error.js
  var DeviceBusyError = class extends Error {
    constructor(cause) {
      super("The device is already in used by another program", {
        cause
      });
    }
  };

  // node_modules/@yume-chan/adb-daemon-webusb/esm/utils.js
  function isErrorName(e, name) {
    return typeof e === "object" && e !== null && "name" in e && e.name === name;
  }
  function isUsbInterfaceFilter(filter) {
    return filter.classCode !== void 0 && filter.subclassCode !== void 0 && filter.protocolCode !== void 0;
  }
  function matchUsbInterfaceFilter(alternate, filter) {
    return alternate.interfaceClass === filter.classCode && alternate.interfaceSubclass === filter.subclassCode && alternate.interfaceProtocol === filter.protocolCode;
  }
  function findUsbInterface(device, filter) {
    for (const configuration of device.configurations) {
      for (const interface_ of configuration.interfaces) {
        for (const alternate of interface_.alternates) {
          if (matchUsbInterfaceFilter(alternate, filter)) {
            return { configuration, interface_, alternate };
          }
        }
      }
    }
    return void 0;
  }
  function padNumber(value) {
    return value.toString(16).padStart(4, "0");
  }
  function getSerialNumber(device) {
    if (device.serialNumber) {
      return device.serialNumber;
    }
    return padNumber(device.vendorId) + "x" + padNumber(device.productId);
  }
  function findUsbEndpoints(endpoints) {
    if (endpoints.length === 0) {
      throw new TypeError("No endpoints given");
    }
    let inEndpoint;
    let outEndpoint;
    for (const endpoint of endpoints) {
      switch (endpoint.direction) {
        case "in":
          inEndpoint = endpoint;
          if (outEndpoint) {
            return { inEndpoint, outEndpoint };
          }
          break;
        case "out":
          outEndpoint = endpoint;
          if (inEndpoint) {
            return { inEndpoint, outEndpoint };
          }
          break;
      }
    }
    if (!inEndpoint) {
      throw new TypeError("No input endpoint found.");
    }
    if (!outEndpoint) {
      throw new TypeError("No output endpoint found.");
    }
    throw new Error("unreachable");
  }
  function matchFilter(device, filter) {
    if (filter.vendorId !== void 0 && device.vendorId !== filter.vendorId) {
      return false;
    }
    if (filter.productId !== void 0 && device.productId !== filter.productId) {
      return false;
    }
    if (filter.serialNumber !== void 0 && getSerialNumber(device) !== filter.serialNumber) {
      return false;
    }
    if (isUsbInterfaceFilter(filter)) {
      return findUsbInterface(device, filter) || false;
    }
    return true;
  }
  function matchFilters(device, filters, exclusionFilters) {
    if (exclusionFilters && exclusionFilters.length > 0) {
      if (matchFilters(device, exclusionFilters)) {
        return false;
      }
    }
    for (const filter of filters) {
      const result = matchFilter(device, filter);
      if (result) {
        return result;
      }
    }
    return false;
  }

  // node_modules/@yume-chan/adb-daemon-webusb/esm/device.js
  var AdbDefaultInterfaceFilter = {
    classCode: 255,
    subclassCode: 66,
    protocolCode: 1
  };
  function mergeDefaultAdbInterfaceFilter(filters) {
    if (!filters || filters.length === 0) {
      return [AdbDefaultInterfaceFilter];
    } else {
      return filters.map((filter) => ({
        ...filter,
        classCode: filter.classCode ?? AdbDefaultInterfaceFilter.classCode,
        subclassCode: filter.subclassCode ?? AdbDefaultInterfaceFilter.subclassCode,
        protocolCode: filter.protocolCode ?? AdbDefaultInterfaceFilter.protocolCode
      }));
    }
  }
  var AdbDaemonWebUsbConnection = class {
    #device;
    get device() {
      return this.#device;
    }
    #inEndpoint;
    get inEndpoint() {
      return this.#inEndpoint;
    }
    #outEndpoint;
    get outEndpoint() {
      return this.#outEndpoint;
    }
    #readable;
    get readable() {
      return this.#readable;
    }
    #writable;
    get writable() {
      return this.#writable;
    }
    constructor(device, inEndpoint, outEndpoint, usbManager) {
      this.#device = device;
      this.#inEndpoint = inEndpoint;
      this.#outEndpoint = outEndpoint;
      let closed2 = false;
      const duplex = new DuplexStreamFactory({
        close: async () => {
          try {
            closed2 = true;
            await device.raw.close();
          } catch {
          }
        },
        dispose: () => {
          closed2 = true;
          usbManager.removeEventListener("disconnect", handleUsbDisconnect);
        }
      });
      function handleUsbDisconnect(e) {
        if (e.device === device.raw) {
          duplex.dispose().catch(unreachable);
        }
      }
      usbManager.addEventListener("disconnect", handleUsbDisconnect);
      this.#readable = duplex.wrapReadable(new ReadableStream2({
        pull: async (controller) => {
          const packet = await this.#transferIn();
          if (packet) {
            controller.enqueue(packet);
          } else {
            controller.close();
          }
        }
      }, { highWaterMark: 0 }));
      const zeroMask = outEndpoint.packetSize - 1;
      this.#writable = pipeFrom(duplex.createWritable(new maybe_consumable_exports.WritableStream({
        write: async (chunk) => {
          try {
            await device.raw.transferOut(outEndpoint.endpointNumber, toLocalUint8Array(chunk));
            if (zeroMask && (chunk.length & zeroMask) === 0) {
              await device.raw.transferOut(outEndpoint.endpointNumber, EmptyUint8Array);
            }
          } catch (e) {
            if (closed2) {
              return;
            }
            throw e;
          }
        }
      })), new AdbPacketSerializeStream());
    }
    async #transferIn() {
      try {
        while (true) {
          const result = await this.#device.raw.transferIn(this.#inEndpoint.endpointNumber, this.#inEndpoint.packetSize);
          if (result.data.byteLength !== 24) {
            continue;
          }
          const buffer3 = new Uint8Array(result.data.buffer);
          const stream = new Uint8ArrayExactReadable(buffer3);
          const packet = AdbPacketHeader.deserialize(stream);
          if (packet.magic !== (packet.command ^ 4294967295)) {
            continue;
          }
          if (packet.payloadLength !== 0) {
            const result2 = await this.#device.raw.transferIn(this.#inEndpoint.endpointNumber, packet.payloadLength);
            packet.payload = new Uint8Array(result2.data.buffer);
          } else {
            packet.payload = EmptyUint8Array;
          }
          return packet;
        }
      } catch (e) {
        if (isErrorName(e, "NetworkError")) {
          await new Promise((resolve) => {
            setTimeout(() => {
              resolve();
            }, 100);
          });
          if (closed) {
            return void 0;
          }
        }
        throw e;
      }
    }
  };
  var AdbDaemonWebUsbDevice = class _AdbDaemonWebUsbDevice {
    static DeviceBusyError = DeviceBusyError;
    #interface;
    #usbManager;
    #raw;
    get raw() {
      return this.#raw;
    }
    #serial;
    get serial() {
      return this.#serial;
    }
    get name() {
      return this.#raw.productName;
    }
    /**
     * Create a new instance of `AdbDaemonWebUsbConnection` using a specified `USBDevice` instance
     *
     * @param device The `USBDevice` instance obtained elsewhere.
     * @param filters The filters to use when searching for ADB interface. Defaults to {@link ADB_DEFAULT_DEVICE_FILTER}.
     */
    constructor(device, interface_, usbManager) {
      this.#raw = device;
      this.#serial = getSerialNumber(device);
      this.#interface = interface_;
      this.#usbManager = usbManager;
    }
    async #claimInterface() {
      if (!this.#raw.opened) {
        await this.#raw.open();
      }
      const { configuration, interface_, alternate } = this.#interface;
      if (this.#raw.configuration?.configurationValue !== configuration.configurationValue) {
        await this.#raw.selectConfiguration(configuration.configurationValue);
      }
      if (!interface_.claimed) {
        try {
          await this.#raw.claimInterface(interface_.interfaceNumber);
        } catch (e) {
          if (isErrorName(e, "NetworkError")) {
            throw new _AdbDaemonWebUsbDevice.DeviceBusyError(e);
          }
          throw e;
        }
      }
      if (interface_.alternate.alternateSetting !== alternate.alternateSetting) {
        await this.#raw.selectAlternateInterface(interface_.interfaceNumber, alternate.alternateSetting);
      }
      return findUsbEndpoints(alternate.endpoints);
    }
    /**
     * Open the device and create a new connection to the ADB Daemon.
     */
    async connect() {
      const { inEndpoint, outEndpoint } = await this.#claimInterface();
      return new AdbDaemonWebUsbConnection(this, inEndpoint, outEndpoint, this.#usbManager);
    }
  };

  // node_modules/@yume-chan/adb-daemon-webusb/esm/observer.js
  var AdbDaemonWebUsbDeviceObserver = class _AdbDaemonWebUsbDeviceObserver {
    static async create(usb, options = {}) {
      const devices = await usb.getDevices();
      return new _AdbDaemonWebUsbDeviceObserver(usb, devices, options);
    }
    #filters;
    #exclusionFilters;
    #usbManager;
    #onDeviceAdd = new EventEmitter();
    onDeviceAdd = this.#onDeviceAdd.event;
    #onDeviceRemove = new EventEmitter();
    onDeviceRemove = this.#onDeviceRemove.event;
    #onListChange = new StickyEventEmitter();
    onListChange = this.#onListChange.event;
    current = [];
    constructor(usb, initial, options = {}) {
      this.#filters = mergeDefaultAdbInterfaceFilter(options.filters);
      this.#exclusionFilters = options.exclusionFilters;
      this.#usbManager = usb;
      this.current = initial.map((device) => this.#convertDevice(device)).filter((device) => !!device);
      this.#onListChange.fire(this.current);
      this.#usbManager.addEventListener("connect", this.#handleConnect);
      this.#usbManager.addEventListener("disconnect", this.#handleDisconnect);
    }
    #convertDevice(device) {
      const interface_ = matchFilters(device, this.#filters, this.#exclusionFilters);
      if (!interface_) {
        return void 0;
      }
      return new AdbDaemonWebUsbDevice(device, interface_, this.#usbManager);
    }
    #handleConnect = (e) => {
      const device = this.#convertDevice(e.device);
      if (!device) {
        return;
      }
      if (this.current.some((item) => item.raw === device.raw)) {
        return;
      }
      const next = this.current.slice();
      next.push(device);
      this.current = next;
      this.#onDeviceAdd.fire([device]);
      this.#onListChange.fire(this.current);
    };
    #handleDisconnect = (e) => {
      const index = this.current.findIndex((device) => device.raw === e.device);
      if (index !== -1) {
        const device = this.current[index];
        const next = this.current.slice();
        unorderedRemove(next, index);
        this.current = next;
        this.#onDeviceRemove.fire([device]);
        this.#onListChange.fire(this.current);
      }
    };
    stop() {
      this.#usbManager.removeEventListener("connect", this.#handleConnect);
      this.#usbManager.removeEventListener("disconnect", this.#handleDisconnect);
      this.#onDeviceAdd.dispose();
      this.#onDeviceRemove.dispose();
      this.#onListChange.dispose();
    }
  };

  // node_modules/@yume-chan/adb-daemon-webusb/esm/manager.js
  var AdbDaemonWebUsbDeviceManager = class _AdbDaemonWebUsbDeviceManager {
    /**
     * Gets the instance of {@link AdbDaemonWebUsbDeviceManager} using browser WebUSB implementation.
     *
     * May be `undefined` if current runtime does not support WebUSB.
     */
    static BROWSER = /* @__PURE__ */ (() => typeof globalThis.navigator !== "undefined" && globalThis.navigator.usb ? new _AdbDaemonWebUsbDeviceManager(globalThis.navigator.usb) : void 0)();
    #usbManager;
    /**
     * Create a new instance of {@link AdbDaemonWebUsbDeviceManager} using the specified WebUSB implementation.
     * @param usbManager A WebUSB compatible interface.
     */
    constructor(usbManager) {
      this.#usbManager = usbManager;
    }
    /**
     * Call `USB#requestDevice()` to prompt the user to select a device.
     */
    async requestDevice(options = {}) {
      const filters = mergeDefaultAdbInterfaceFilter(options.filters);
      try {
        const device = await this.#usbManager.requestDevice({
          filters,
          exclusionFilters: options.exclusionFilters
        });
        const interface_ = matchFilters(device, filters, options.exclusionFilters);
        if (!interface_) {
          return void 0;
        }
        this.#usbManager.dispatchEvent(new USBConnectionEvent("connect", { device }));
        return new AdbDaemonWebUsbDevice(device, interface_, this.#usbManager);
      } catch (e) {
        if (isErrorName(e, "NotFoundError")) {
          return void 0;
        }
        throw e;
      }
    }
    /**
     * Get all connected and requested devices that match the specified filters.
     */
    async getDevices(options = {}) {
      const filters = mergeDefaultAdbInterfaceFilter(options.filters);
      const devices = await this.#usbManager.getDevices();
      const result = [];
      for (const device of devices) {
        const interface_ = matchFilters(device, filters, options.exclusionFilters);
        if (interface_) {
          result.push(new AdbDaemonWebUsbDevice(device, interface_, this.#usbManager));
        }
      }
      return result;
    }
    trackDevices(options = {}) {
      return AdbDaemonWebUsbDeviceObserver.create(this.#usbManager, options);
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/base/audio.js
  var ScrcpyAudioCodec = class _ScrcpyAudioCodec {
    static Opus = /* @__PURE__ */ new _ScrcpyAudioCodec("opus", 1869641075, "audio/opus", "opus");
    static Aac = /* @__PURE__ */ new _ScrcpyAudioCodec("aac", 6381923, "audio/aac", "mp4a.66");
    static Flac = /* @__PURE__ */ new _ScrcpyAudioCodec("flac", 1718378851, "audio/flac", "flac");
    static Raw = /* @__PURE__ */ new _ScrcpyAudioCodec("raw", 7496055, "audio/raw", "");
    optionValue;
    metadataValue;
    mimeType;
    webCodecId;
    constructor(optionValue, metadataValue, mimeType, webCodecId) {
      this.optionValue = optionValue;
      this.metadataValue = metadataValue;
      this.mimeType = mimeType;
      this.webCodecId = webCodecId;
    }
    toOptionValue() {
      return this.optionValue;
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/base/control-message-type-value.js
  var control_message_type_value_exports = {};
  __export(control_message_type_value_exports, {
    BackOrScreenOn: () => BackOrScreenOn,
    CameraSetTorch: () => CameraSetTorch,
    CameraZoomIn: () => CameraZoomIn,
    CameraZoomOut: () => CameraZoomOut,
    CollapseNotificationPanel: () => CollapseNotificationPanel,
    ExpandNotificationPanel: () => ExpandNotificationPanel,
    ExpandSettingPanel: () => ExpandSettingPanel,
    GetClipboard: () => GetClipboard,
    InjectKeyCode: () => InjectKeyCode,
    InjectScroll: () => InjectScroll,
    InjectText: () => InjectText,
    InjectTouch: () => InjectTouch,
    OpenHardKeyboardSettings: () => OpenHardKeyboardSettings,
    ResetVideo: () => ResetVideo,
    ResizeDisplay: () => ResizeDisplay,
    RotateDevice: () => RotateDevice,
    ScanFile: () => ScanFile,
    SetClipboard: () => SetClipboard,
    SetDisplayPower: () => SetDisplayPower,
    StartApp: () => StartApp,
    UHidCreate: () => UHidCreate,
    UHidDestroy: () => UHidDestroy,
    UHidInput: () => UHidInput
  });
  var InjectKeyCode = 0;
  var InjectText = 1;
  var InjectTouch = 2;
  var InjectScroll = 3;
  var BackOrScreenOn = 4;
  var ExpandNotificationPanel = 5;
  var ExpandSettingPanel = 6;
  var CollapseNotificationPanel = 7;
  var GetClipboard = 8;
  var SetClipboard = 9;
  var SetDisplayPower = 10;
  var RotateDevice = 11;
  var UHidCreate = 12;
  var UHidInput = 13;
  var UHidDestroy = 14;
  var OpenHardKeyboardSettings = 15;
  var StartApp = 16;
  var ResetVideo = 17;
  var CameraSetTorch = 18;
  var CameraZoomIn = 19;
  var CameraZoomOut = 20;
  var ResizeDisplay = 21;
  var ScanFile = 22;

  // node_modules/@yume-chan/scrcpy/esm/base/device-message.js
  var ScrcpyDeviceMessageParsers = class {
    #parsers = [];
    get parsers() {
      return this.#parsers;
    }
    #add(id, parser) {
      if (this.#parsers[id]) {
        throw new Error(`Duplicate parser for id ${id}`);
      }
      this.#parsers[id] = parser;
    }
    add(parser) {
      if (Array.isArray(parser.id)) {
        for (const id of parser.id) {
          this.#add(id, parser);
        }
      } else {
        this.#add(parser.id, parser);
      }
      return parser;
    }
    async parse(id, stream) {
      const parser = this.#parsers[id];
      if (!parser) {
        console.warn(`Unknown device message id ${id}, ignoring`);
        return;
      }
      return parser.parse(id, stream);
    }
    close() {
      for (const parser of this.#parsers) {
        parser.close();
      }
    }
    error(e) {
      for (const parser of this.#parsers) {
        parser.error(e);
      }
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/base/option-value.js
  function isScrcpyOptionValue(value) {
    return typeof value === "object" && value !== null && "toOptionValue" in value && typeof value.toOptionValue === "function";
  }
  function toScrcpyOptionValue(value, empty) {
    if (isScrcpyOptionValue(value)) {
      value = value.toOptionValue();
    }
    if (value === void 0) {
      return empty;
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new TypeError(`Invalid option value: ${JSON.stringify(value)}`);
    }
    return value.toString();
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/index.js
  var impl_exports = {};
  __export(impl_exports, {
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes,
    Crop: () => Crop,
    Defaults: () => Defaults,
    InjectScrollControlMessage: () => InjectScrollControlMessage,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    ScrollController: () => ScrollController,
    SerializeOrder: () => SerializeOrder,
    SetClipboardControlMessage: () => SetClipboardControlMessage,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation,
    computeOptionValues: () => computeOptionValues,
    createMediaStreamTransformer: () => createMediaStreamTransformer,
    createScrollController: () => createScrollController,
    parseDisplay: () => parseDisplay,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    setListDisplays: () => setListDisplays
  });

  // node_modules/@yume-chan/scrcpy/esm/android/key-event.js
  var AndroidKeyEventAction = {
    Down: 0,
    Up: 1
  };

  // node_modules/@yume-chan/scrcpy/esm/android/screen-power-mode.js
  var AndroidScreenPowerMode = {
    Off: 0,
    Normal: 2
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/struct/esm/bipedal.js
  function advance2(iterator, next) {
    while (true) {
      const { done, value } = iterator.next(next);
      if (done) {
        return value;
      }
      if (isPromiseLike(value)) {
        return value.then((value2) => advance2(iterator, { resolved: value2 }), (error) => advance2(iterator, { error }));
      }
      next = value;
    }
  }
  // @__NO_SIDE_EFFECTS__
  function bipedal2(fn, bindThis) {
    function result(...args) {
      const iterator = fn.call(this, function* (value) {
        if (isPromiseLike(value)) {
          const result2 = yield value;
          if ("resolved" in result2) {
            return result2.resolved;
          } else {
            throw result2.error;
          }
        }
        return value;
      }, ...args);
      return advance2(iterator, void 0);
    }
    if (bindThis) {
      return result.bind(bindThis);
    } else {
      return result;
    }
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/struct/esm/field/serialize.js
  function defaultFieldSerializer2(serializer) {
    return (source, context) => {
      if ("buffer" in context) {
        const buffer3 = serializer(source, context);
        context.buffer.set(buffer3, context.index);
        return buffer3.length;
      } else {
        return serializer(source, context);
      }
    };
  }
  function byobFieldSerializer2(size, serializer) {
    return (source, context) => {
      if ("buffer" in context) {
        context.index ??= 0;
        serializer(source, context);
        return size;
      } else {
        const buffer3 = new Uint8Array(size);
        serializer(source, {
          buffer: buffer3,
          index: 0,
          littleEndian: context.littleEndian
        });
        return buffer3;
      }
    };
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/struct/esm/field/factory.js
  // @__NO_SIDE_EFFECTS__
  function _field2(size, type, serialize3, deserialize, options) {
    const field3 = {
      size,
      type,
      serialize: type === "default" ? defaultFieldSerializer2(serialize3) : byobFieldSerializer2(size, serialize3),
      deserialize: bipedal2(deserialize),
      omitInit: options?.omitInit
    };
    if (options?.init) {
      field3.init = options.init;
    }
    return field3;
  }
  var field2 = _field2;

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/struct/esm/buffer.js
  var EmptyUint8Array2 = new Uint8Array(0);
  function copyMaybeDifferentLength2(dest, source, index, length) {
    if (source.length < length) {
      dest.set(source, index);
      dest.fill(0, index + source.length, index + length);
    } else if (source.length === length) {
      dest.set(source, index);
    } else {
      dest.set(source.subarray(0, length), index);
    }
  }
  // @__NO_SIDE_EFFECTS__
  function buffer2(lengthOrField, converter) {
    if (typeof lengthOrField === "number") {
      let serialize3;
      let deserialize2;
      let init2;
      if (lengthOrField === 0) {
        serialize3 = () => {
        };
        if (converter) {
          deserialize2 = function* () {
            return converter.convert(EmptyUint8Array2);
          };
        } else {
          deserialize2 = function* () {
            return EmptyUint8Array2;
          };
        }
      } else {
        serialize3 = (value, { buffer: buffer3, index }) => copyMaybeDifferentLength2(buffer3, value, index, lengthOrField);
        if (converter) {
          deserialize2 = function* (then, reader) {
            const array = reader.readExactly(lengthOrField);
            return converter.convert(yield* then(array));
          };
          init2 = (value) => converter.back(value);
        } else {
          deserialize2 = function* (_then, reader) {
            const array = reader.readExactly(lengthOrField);
            return array;
          };
        }
      }
      return field2(lengthOrField, "byob", serialize3, deserialize2, { init: init2 });
    }
    if ((typeof lengthOrField === "object" || typeof lengthOrField === "function") && "serialize" in lengthOrField) {
      let deserialize2;
      let init2;
      if (converter) {
        deserialize2 = function* (then, reader, context) {
          const length = yield* then(lengthOrField.deserialize(reader, context));
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array2;
          return converter.convert(yield* then(array));
        };
        init2 = (value) => converter.back(value);
      } else {
        deserialize2 = function* (then, reader, context) {
          const length = yield* then(lengthOrField.deserialize(reader, context));
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array2;
          return array;
        };
      }
      return field2(lengthOrField.size, "default", (value, { littleEndian }) => {
        if (lengthOrField.type === "default") {
          const lengthBuffer = lengthOrField.serialize(value.length, {
            littleEndian
          });
          if (value.length === 0) {
            return lengthBuffer;
          }
          const result = new Uint8Array(lengthBuffer.length + value.length);
          result.set(lengthBuffer, 0);
          result.set(value, lengthBuffer.length);
          return result;
        } else {
          const result = new Uint8Array(lengthOrField.size + value.length);
          lengthOrField.serialize(value.length, {
            buffer: result,
            index: 0,
            littleEndian
          });
          result.set(value, lengthOrField.size);
          return result;
        }
      }, deserialize2, { init: init2 });
    }
    if (typeof lengthOrField === "string") {
      let deserialize2;
      let init2;
      if (converter) {
        deserialize2 = function* (then, reader, { dependencies }) {
          const length = dependencies[lengthOrField];
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array2;
          return converter.convert(yield* then(array));
        };
        init2 = (value, dependencies) => {
          const array = converter.back(value);
          dependencies[lengthOrField] = array.length;
          return array;
        };
      } else {
        deserialize2 = function* (_then, reader, { dependencies }) {
          const length = dependencies[lengthOrField];
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array2;
          return array;
        };
        init2 = (value, dependencies) => {
          const array = value;
          dependencies[lengthOrField] = array.length;
          return array;
        };
      }
      return field2(0, "default", (source) => source, deserialize2, { init: init2 });
    }
    let deserialize;
    let init;
    if (converter) {
      deserialize = function* (then, reader, { dependencies }) {
        const rawLength = dependencies[lengthOrField.field];
        const length = lengthOrField.convert(rawLength);
        const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array2;
        return converter.convert(yield* then(array));
      };
      init = (value, dependencies) => {
        const array = converter.back(value);
        dependencies[lengthOrField.field] = lengthOrField.back(array.length);
        return array;
      };
    } else {
      deserialize = function* (_then, reader, { dependencies }) {
        const rawLength = dependencies[lengthOrField.field];
        const length = lengthOrField.convert(rawLength);
        const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array2;
        return array;
      };
      init = (value, dependencies) => {
        const array = value;
        dependencies[lengthOrField.field] = lengthOrField.back(array.length);
        return array;
      };
    }
    return field2(0, "default", (source) => source, deserialize, { init });
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/struct/esm/readable.js
  var ExactReadableEndedErrorBrand = /* @__PURE__ */ Symbol.for("ExactReadableEndedError.brand");
  var ExactReadableEndedError2 = class extends Error {
    [ExactReadableEndedErrorBrand] = true;
    static [Symbol.hasInstance](value) {
      return !!value?.[ExactReadableEndedErrorBrand];
    }
    constructor() {
      super("ExactReadable ended");
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/struct/esm/struct.js
  var StructDeserializeError2 = class extends Error {
    constructor(message) {
      super(message);
    }
  };
  var StructNotEnoughDataError2 = class extends StructDeserializeError2 {
    constructor() {
      super("The underlying readable was ended before the struct was fully deserialized");
    }
  };
  var StructEmptyErrorBrand = /* @__PURE__ */ Symbol.for("StructEmptyError.brand");
  var StructEmptyError2 = class extends StructDeserializeError2 {
    [StructEmptyErrorBrand] = true;
    static [Symbol.hasInstance](value) {
      return !!value?.[StructEmptyErrorBrand];
    }
    constructor() {
      super("The underlying readable doesn't contain any more struct");
    }
  };
  // @__NO_SIDE_EFFECTS__
  function struct2(fields, options) {
    const fieldList = Object.entries(fields);
    let size = 0;
    let byob = true;
    for (const [, field3] of fieldList) {
      size += field3.size;
      if (byob && field3.type !== "byob") {
        byob = false;
      }
    }
    const littleEndian = options.littleEndian;
    const extra = options.extra ? Object.getOwnPropertyDescriptors(options.extra) : void 0;
    return {
      littleEndian,
      fields,
      extra: options.extra,
      type: byob ? "byob" : "default",
      size,
      serialize(source, bufferOrContext) {
        const temp = { ...source };
        for (const [key, field3] of fieldList) {
          if (key in temp && "init" in field3) {
            const result = field3.init?.(temp[key], temp);
            temp[key] = result;
          }
        }
        const sizes = new Array(fieldList.length);
        const buffers = new Array(fieldList.length);
        {
          const context2 = { littleEndian };
          for (const [index2, [key, field3]] of fieldList.entries()) {
            if (field3.type === "byob") {
              sizes[index2] = field3.size;
            } else {
              buffers[index2] = field3.serialize(temp[key], context2);
              sizes[index2] = buffers[index2].length;
            }
          }
        }
        const size2 = sizes.reduce((sum, size3) => sum + size3, 0);
        let externalBuffer;
        let buffer3;
        let index;
        if (bufferOrContext instanceof Uint8Array) {
          if (bufferOrContext.length < size2) {
            throw new Error("Buffer too small");
          }
          externalBuffer = true;
          buffer3 = bufferOrContext;
          index = 0;
        } else if (typeof bufferOrContext === "object" && "buffer" in bufferOrContext) {
          externalBuffer = true;
          buffer3 = bufferOrContext.buffer;
          index = bufferOrContext.index ?? 0;
          if (buffer3.length - index < size2) {
            throw new Error("Buffer too small");
          }
        } else {
          externalBuffer = false;
          buffer3 = new Uint8Array(size2);
          index = 0;
        }
        const context = {
          buffer: buffer3,
          index,
          littleEndian
        };
        for (const [index2, [key, field3]] of fieldList.entries()) {
          if (buffers[index2]) {
            buffer3.set(buffers[index2], context.index);
          } else {
            field3.serialize(temp[key], context);
          }
          context.index += sizes[index2];
        }
        if (externalBuffer) {
          return size2;
        } else {
          return buffer3;
        }
      },
      deserialize: bipedal2(function* (then, reader) {
        const startPosition = reader.position;
        const result = {};
        const context = {
          dependencies: result,
          littleEndian
        };
        try {
          for (const [key, field3] of fieldList) {
            result[key] = yield* then(field3.deserialize(reader, context));
          }
        } catch (e) {
          if (!(e instanceof ExactReadableEndedError2)) {
            throw e;
          }
          if (reader.position === startPosition) {
            throw new StructEmptyError2();
          } else {
            throw new StructNotEnoughDataError2();
          }
        }
        if (extra) {
          Object.defineProperties(result, extra);
        }
        if (options.postDeserialize) {
          return options.postDeserialize.call(result, result);
        } else {
          return result;
        }
      })
    };
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/struct/esm/extend.js
  // @__NO_SIDE_EFFECTS__
  function extend2(base, fields, options) {
    return struct2(Object.assign({}, base.fields, fields), {
      littleEndian: options?.littleEndian ?? base.littleEndian,
      extra: base.extra,
      postDeserialize: options?.postDeserialize
    });
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/no-data-view/esm/int16.js
  // @__NO_SIDE_EFFECTS__
  function getInt162(buffer3, offset, littleEndian) {
    return littleEndian ? (buffer3[offset] | buffer3[offset + 1] << 8) << 16 >> 16 : (buffer3[offset] << 8 | buffer3[offset + 1]) << 16 >> 16;
  }
  function setInt162(buffer3, offset, value, littleEndian) {
    if (littleEndian) {
      buffer3[offset] = value;
      buffer3[offset + 1] = value >> 8;
    } else {
      buffer3[offset] = value >> 8;
      buffer3[offset + 1] = value;
    }
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/no-data-view/esm/int32.js
  // @__NO_SIDE_EFFECTS__
  function getInt322(buffer3, offset, littleEndian) {
    return littleEndian ? buffer3[offset] | buffer3[offset + 1] << 8 | buffer3[offset + 2] << 16 | buffer3[offset + 3] << 24 : buffer3[offset] << 24 | buffer3[offset + 1] << 16 | buffer3[offset + 2] << 8 | buffer3[offset + 3];
  }
  function setInt322(buffer3, offset, value, littleEndian) {
    if (littleEndian) {
      buffer3[offset] = value;
      buffer3[offset + 1] = value >> 8;
      buffer3[offset + 2] = value >> 16;
      buffer3[offset + 3] = value >> 24;
    } else {
      buffer3[offset] = value >> 24;
      buffer3[offset + 1] = value >> 16;
      buffer3[offset + 2] = value >> 8;
      buffer3[offset + 3] = value;
    }
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/no-data-view/esm/uint16.js
  // @__NO_SIDE_EFFECTS__
  function getUint16BigEndian(buffer3, offset) {
    return buffer3[offset] << 8 | buffer3[offset + 1];
  }
  // @__NO_SIDE_EFFECTS__
  function getUint162(buffer3, offset, littleEndian) {
    return littleEndian ? buffer3[offset] | buffer3[offset + 1] << 8 : buffer3[offset + 1] | buffer3[offset] << 8;
  }
  function setUint162(buffer3, offset, value, littleEndian) {
    if (littleEndian) {
      buffer3[offset] = value;
      buffer3[offset + 1] = value >> 8;
    } else {
      buffer3[offset] = value >> 8;
      buffer3[offset + 1] = value;
    }
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/no-data-view/esm/uint32.js
  // @__NO_SIDE_EFFECTS__
  function getUint32BigEndian(buffer3, offset) {
    return (buffer3[offset] << 24 | buffer3[offset + 1] << 16 | buffer3[offset + 2] << 8 | buffer3[offset + 3]) >>> 0;
  }
  // @__NO_SIDE_EFFECTS__
  function getUint322(buffer3, offset, littleEndian) {
    return littleEndian ? (buffer3[offset] | buffer3[offset + 1] << 8 | buffer3[offset + 2] << 16 | buffer3[offset + 3] << 24) >>> 0 : (buffer3[offset] << 24 | buffer3[offset + 1] << 16 | buffer3[offset + 2] << 8 | buffer3[offset + 3]) >>> 0;
  }
  function setUint322(buffer3, offset, value, littleEndian) {
    if (littleEndian) {
      buffer3[offset] = value;
      buffer3[offset + 1] = value >> 8;
      buffer3[offset + 2] = value >> 16;
      buffer3[offset + 3] = value >> 24;
    } else {
      buffer3[offset] = value >> 24;
      buffer3[offset + 1] = value >> 16;
      buffer3[offset + 2] = value >> 8;
      buffer3[offset + 3] = value;
    }
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/no-data-view/esm/uint64.js
  function getUint64BigEndian2(buffer3, offset) {
    return BigInt(buffer3[offset]) << 56n | BigInt(buffer3[offset + 1]) << 48n | BigInt(buffer3[offset + 2]) << 40n | BigInt(buffer3[offset + 3]) << 32n | BigInt(buffer3[offset + 4]) << 24n | BigInt(buffer3[offset + 5]) << 16n | BigInt(buffer3[offset + 6]) << 8n | BigInt(buffer3[offset + 7]);
  }
  function getUint642(buffer3, offset, littleEndian) {
    return littleEndian ? BigInt(buffer3[offset]) | BigInt(buffer3[offset + 1]) << 8n | BigInt(buffer3[offset + 2]) << 16n | BigInt(buffer3[offset + 3]) << 24n | BigInt(buffer3[offset + 4]) << 32n | BigInt(buffer3[offset + 5]) << 40n | BigInt(buffer3[offset + 6]) << 48n | BigInt(buffer3[offset + 7]) << 56n : BigInt(buffer3[offset]) << 56n | BigInt(buffer3[offset + 1]) << 48n | BigInt(buffer3[offset + 2]) << 40n | BigInt(buffer3[offset + 3]) << 32n | BigInt(buffer3[offset + 4]) << 24n | BigInt(buffer3[offset + 5]) << 16n | BigInt(buffer3[offset + 6]) << 8n | BigInt(buffer3[offset + 7]);
  }
  function setUint642(buffer3, offset, value, littleEndian) {
    if (littleEndian) {
      buffer3[offset] = Number(value & 0xffn);
      buffer3[offset + 1] = Number(value >> 8n & 0xffn);
      buffer3[offset + 2] = Number(value >> 16n & 0xffn);
      buffer3[offset + 3] = Number(value >> 24n & 0xffn);
      buffer3[offset + 4] = Number(value >> 32n & 0xffn);
      buffer3[offset + 5] = Number(value >> 40n & 0xffn);
      buffer3[offset + 6] = Number(value >> 48n & 0xffn);
      buffer3[offset + 7] = Number(value >> 56n & 0xffn);
    } else {
      buffer3[offset] = Number(value >> 56n & 0xffn);
      buffer3[offset + 1] = Number(value >> 48n & 0xffn);
      buffer3[offset + 2] = Number(value >> 40n & 0xffn);
      buffer3[offset + 3] = Number(value >> 32n & 0xffn);
      buffer3[offset + 4] = Number(value >> 24n & 0xffn);
      buffer3[offset + 5] = Number(value >> 16n & 0xffn);
      buffer3[offset + 6] = Number(value >> 8n & 0xffn);
      buffer3[offset + 7] = Number(value & 0xffn);
    }
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/struct/esm/number.js
  // @__NO_SIDE_EFFECTS__
  function number2(size, serialize3, deserialize) {
    const fn = (() => fn);
    Object.assign(fn, field2(size, "byob", serialize3, deserialize));
    return fn;
  }
  var u82 = /* @__PURE__ */ number2(1, (value, { buffer: buffer3, index }) => {
    buffer3[index] = value;
  }, function* (then, reader) {
    const data = yield* then(reader.readExactly(1));
    return data[0];
  });
  var u16 = /* @__PURE__ */ number2(2, (value, { buffer: buffer3, index, littleEndian }) => {
    setUint162(buffer3, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(2));
    return getUint162(data, 0, littleEndian);
  });
  var u322 = /* @__PURE__ */ number2(4, (value, { buffer: buffer3, index, littleEndian }) => {
    setUint322(buffer3, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(4));
    return getUint322(data, 0, littleEndian);
  });
  var s322 = /* @__PURE__ */ number2(4, (value, { buffer: buffer3, index, littleEndian }) => {
    setInt322(buffer3, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(4));
    return getInt322(data, 0, littleEndian);
  });
  var u642 = /* @__PURE__ */ number2(8, (value, { buffer: buffer3, index, littleEndian }) => {
    setUint642(buffer3, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(8));
    return getUint642(data, 0, littleEndian);
  });

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/struct/esm/utils.js
  var { TextEncoder: TextEncoder2, TextDecoder: TextDecoder2 } = globalThis;
  var SharedEncoder2 = /* @__PURE__ */ new TextEncoder2();
  var SharedDecoder2 = /* @__PURE__ */ new TextDecoder2();
  // @__NO_SIDE_EFFECTS__
  function encodeUtf82(input) {
    return SharedEncoder2.encode(input);
  }
  // @__NO_SIDE_EFFECTS__
  function decodeUtf82(buffer3) {
    return SharedDecoder2.decode(buffer3);
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/struct/esm/string.js
  var string2 = (/* @__NO_SIDE_EFFECTS__ */ (lengthOrField) => {
    const field3 = buffer2(lengthOrField, {
      convert: decodeUtf82,
      back: encodeUtf82
    });
    field3.as = () => field3;
    return field3;
  });

  // node_modules/@yume-chan/scrcpy/esm/control/boolean.js
  var BooleanControlMessage = struct2({ type: u82, value: u82() }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/empty.js
  var EmptyControlMessage = struct2({ type: u82 }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/inject-key-code.js
  var ScrcpyInjectKeyCodeControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    action: u82(),
    keyCode: u322(),
    repeat: u322,
    metaState: u322()
  }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/inject-text.js
  var ScrcpyInjectTextControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    text: string2(u322)
  }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/resize-display.js
  var ScrcpyResizeDisplayControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    width: u16,
    height: u16
  }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/start-app.js
  var ScrcpyStartAppControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    name: string2(u82)
  }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/uhid.js
  var ScrcpyUHidInputControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    id: u16,
    data: buffer2(u16)
  }, { littleEndian: false });
  var ScrcpyUHidDestroyControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    id: u16
  }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/serializer.js
  var ScrcpyControlMessageSerializer = class {
    #options;
    #scrollController;
    constructor(options) {
      this.#options = options;
      this.#scrollController = options.createScrollController();
    }
    getType(type) {
      const value = this.#options.controlMessageTypes[type];
      if (value === void 0) {
        throw new TypeError(`Invalid control message type: ${type}`);
      }
      return value;
    }
    #addType(message, type) {
      message.type = this.getType(type);
      return message;
    }
    injectKeyCode(message) {
      return ScrcpyInjectKeyCodeControlMessage.serialize(this.#addType(message, control_message_type_value_exports.InjectKeyCode));
    }
    injectText(text) {
      return ScrcpyInjectTextControlMessage.serialize({
        text,
        type: this.getType(control_message_type_value_exports.InjectText)
      });
    }
    /**
     * `pressure` is a float value between 0 and 1.
     */
    injectTouch(message) {
      return this.#options.serializeInjectTouchControlMessage(this.#addType(message, control_message_type_value_exports.InjectTouch));
    }
    /**
     * `scrollX` and `scrollY` are float values between 0 and 1.
     */
    injectScroll(message) {
      return this.#scrollController.serializeScrollMessage(this.#addType(message, control_message_type_value_exports.InjectScroll));
    }
    backOrScreenOn(action) {
      return this.#options.serializeBackOrScreenOnControlMessage({
        action,
        type: this.getType(control_message_type_value_exports.BackOrScreenOn)
      });
    }
    setDisplayPower(on) {
      return this.#options.serializeSetDisplayPowerControlMessage({
        on,
        type: this.getType(control_message_type_value_exports.SetDisplayPower)
      });
    }
    expandNotificationPanel() {
      return EmptyControlMessage.serialize({
        type: this.getType(control_message_type_value_exports.ExpandNotificationPanel)
      });
    }
    expandSettingPanel() {
      return EmptyControlMessage.serialize({
        type: this.getType(control_message_type_value_exports.ExpandSettingPanel)
      });
    }
    collapseNotificationPanel() {
      return EmptyControlMessage.serialize({
        type: this.getType(control_message_type_value_exports.CollapseNotificationPanel)
      });
    }
    rotateDevice() {
      return EmptyControlMessage.serialize({
        type: this.getType(control_message_type_value_exports.RotateDevice)
      });
    }
    setClipboard(message) {
      return this.#options.serializeSetClipboardControlMessage({
        ...message,
        type: this.getType(control_message_type_value_exports.SetClipboard)
      });
    }
    uHidCreate(message) {
      if (!this.#options.serializeUHidCreateControlMessage) {
        throw new Error("UHid not supported");
      }
      return this.#options.serializeUHidCreateControlMessage(this.#addType(message, control_message_type_value_exports.UHidCreate));
    }
    uHidInput(message) {
      return ScrcpyUHidInputControlMessage.serialize(this.#addType(message, control_message_type_value_exports.UHidInput));
    }
    uHidDestroy(id) {
      return ScrcpyUHidDestroyControlMessage.serialize({
        type: this.getType(control_message_type_value_exports.UHidDestroy),
        id
      });
    }
    startApp(name, options) {
      if (options?.searchByName) {
        name = "?" + name;
      }
      if (options?.forceStop) {
        name = "+" + name;
      }
      return ScrcpyStartAppControlMessage.serialize({
        type: this.getType(control_message_type_value_exports.StartApp),
        name
      });
    }
    resetVideo() {
      return EmptyControlMessage.serialize({
        type: this.getType(control_message_type_value_exports.ResetVideo)
      });
    }
    cameraSetTorch(enabled) {
      return BooleanControlMessage.serialize({
        type: this.getType(control_message_type_value_exports.CameraSetTorch),
        value: enabled
      });
    }
    cameraZoomIn() {
      return EmptyControlMessage.serialize({
        type: this.getType(control_message_type_value_exports.CameraZoomIn)
      });
    }
    cameraZoomOut() {
      return EmptyControlMessage.serialize({
        type: this.getType(control_message_type_value_exports.CameraZoomOut)
      });
    }
    resizeDisplay(message) {
      return ScrcpyResizeDisplayControlMessage.serialize(this.#addType(message, control_message_type_value_exports.ResizeDisplay));
    }
    scanFile(path) {
      return ScrcpyInjectTextControlMessage.serialize({
        text: path,
        type: this.getType(control_message_type_value_exports.ScanFile)
      });
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/global/utils.js
  // @__NO_SIDE_EFFECTS__
  function getGlobalValue(key) {
    return globalThis[key];
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/global/abort-signal.js
  var AbortSignal = getGlobalValue("AbortSignal");
  var AbortController2 = getGlobalValue("AbortController");

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/try-close.js
  async function tryCancel2(stream) {
    try {
      await stream.cancel();
      return true;
    } catch {
      return false;
    }
  }

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/global/streams.js
  var ByteLengthQueuingStrategy = getGlobalValue("ByteLengthQueuingStrategy");
  var CountQueuingStrategy = getGlobalValue("CountQueuingStrategy");
  var ReadableStream3 = /* @__PURE__ */ (() => {
    const ReadableStream5 = getGlobalValue("ReadableStream");
    if (!ReadableStream5.from) {
      ReadableStream5.from = function(iterable) {
        const iterator = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
        return new ReadableStream5({
          async pull(controller) {
            const result = await iterator.next();
            if (result.done) {
              controller.close();
              return;
            }
            controller.enqueue(result.value);
          },
          async cancel(reason) {
            await iterator.return?.(reason);
          }
        });
      };
    }
    if (!ReadableStream5.prototype[Symbol.asyncIterator] || !ReadableStream5.prototype.values) {
      ReadableStream5.prototype.values = async function* (options) {
        const reader = this.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              return;
            }
            yield value;
          }
        } finally {
          if (!options?.preventCancel) {
            await tryCancel2(reader);
          }
          reader.releaseLock();
        }
      };
      ReadableStream5.prototype[Symbol.asyncIterator] = // eslint-disable-next-line @typescript-eslint/unbound-method
      ReadableStream5.prototype.values;
    }
    return ReadableStream5;
  })();
  var ReadableStreamBYOBReader = getGlobalValue("ReadableStreamBYOBReader");
  var ReadableStreamDefaultReader = getGlobalValue("ReadableStreamDefaultReader");
  var TransformStream3 = getGlobalValue("TransformStream");
  var WritableStream2 = getGlobalValue("WritableStream");
  var WritableStreamDefaultWriter = getGlobalValue("WritableStreamDefaultWriter");

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/task-queue.js
  var TaskQueue2 = class {
    #ready;
    #disposed = false;
    enqueue(task, bail = false) {
      if (this.#disposed) {
        throw new Error("TaskQueue is disposed");
      }
      if (!this.#ready) {
        try {
          const result2 = task();
          if (isPromiseLike(result2)) {
            this.#ready = result2.then(() => {
            }, (e) => {
              if (bail) {
                throw e;
              }
            });
          }
          return result2;
        } catch (e) {
          if (bail) {
            const promise = Promise.reject(e);
            void promise.catch(() => {
            });
            this.#ready = promise;
          }
          throw e;
        }
      }
      const result = this.#ready.then(() => {
        if (this.#disposed) {
          throw new Error("TaskQueue is disposed");
        }
        return task();
      });
      this.#ready = result.then(() => {
      }, (e) => {
        if (bail || this.#disposed) {
          throw e;
        }
      });
      return result;
    }
    dispose() {
      this.#disposed = true;
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/push-readable.js
  var PushReadableStream2 = class extends ReadableStream3 {
    /**
     * Create a new `PushReadableStream` from a source.
     *
     * @param source If `source` returns a `Promise`, the stream will be closed
     * when the `Promise` is resolved, and be errored when the `Promise` is rejected.
     * @param strategy
     */
    constructor(source, strategy, logger) {
      let controller;
      const tasks = new TaskQueue2();
      let zeroHighWaterMarkAllowEnqueue = false;
      let waterMarkLow;
      const abortController = new AbortController2();
      let stopped = false;
      const enqueue = (chunk) => {
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "start"
        });
        if (abortController.signal.aborted) {
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "ignored"
          });
          return false;
        }
        if (controller.desiredSize === null) {
          controller.enqueue(chunk);
          throw new Error("unreachable");
        }
        if (zeroHighWaterMarkAllowEnqueue) {
          zeroHighWaterMarkAllowEnqueue = false;
          controller.enqueue(chunk);
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "complete"
          });
          return true;
        }
        if (controller.desiredSize <= 0) {
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "waiting"
          });
          waterMarkLow = new PromiseResolver();
          return waterMarkLow.promise.then(() => {
            controller.enqueue(chunk);
            logger?.({
              source: "producer",
              operation: "enqueue",
              value: chunk,
              phase: "complete"
            });
            return true;
          }, () => {
            logger?.({
              source: "producer",
              operation: "enqueue",
              value: chunk,
              phase: "ignored"
            });
            return false;
          });
        }
        controller.enqueue(chunk);
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "complete"
        });
        return true;
      };
      const close = (explicit) => {
        logger?.({
          source: "producer",
          operation: "close",
          explicit,
          phase: "start"
        });
        if (abortController.signal.aborted || stopped && !explicit) {
          logger?.({
            source: "producer",
            operation: "close",
            explicit,
            phase: "ignored"
          });
          return;
        }
        controller.close();
        stopped = true;
        waterMarkLow?.reject();
        logger?.({
          source: "producer",
          operation: "close",
          explicit,
          phase: "complete"
        });
      };
      const error = (error2, explicit) => {
        logger?.({
          source: "producer",
          operation: "error",
          explicit,
          phase: "start"
        });
        stopped = true;
        controller.error(error2);
        waterMarkLow?.reject();
        logger?.({
          source: "producer",
          operation: "error",
          explicit,
          phase: "complete"
        });
      };
      super({
        start: (controller_) => {
          controller = controller_;
          const result = source({
            abortSignal: abortController.signal,
            enqueue: async (chunk) => (
              // Run `enqueue`s in serial
              // Use `async/await` to always return a `Promise`
              await tasks.enqueue(() => enqueue(chunk))
            ),
            close() {
              close(true);
            },
            error(e) {
              error(e, true);
            }
          });
          if (!stopped && isPromiseLike(result)) {
            result.then(() => close(false), (e) => error(e, false));
          }
        },
        pull: () => {
          logger?.({
            source: "consumer",
            operation: "pull",
            phase: "start"
          });
          if (waterMarkLow) {
            waterMarkLow.resolve(void 0);
            waterMarkLow = void 0;
          } else if (strategy?.highWaterMark === 0) {
            zeroHighWaterMarkAllowEnqueue = true;
          }
          logger?.({
            source: "consumer",
            operation: "pull",
            phase: "complete"
          });
        },
        cancel: (reason) => {
          logger?.({
            source: "consumer",
            operation: "cancel",
            phase: "start"
          });
          stopped = true;
          abortController.abort(reason);
          waterMarkLow?.reject();
          logger?.({
            source: "consumer",
            operation: "cancel",
            phase: "complete"
          });
        }
      }, strategy);
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/buffered.js
  var BufferedReadableStream2 = class {
    #buffered;
    // PERF: `subarray` is slow
    // don't use it until absolutely necessary
    #bufferedOffset = 0;
    #bufferedLength = 0;
    #position = 0;
    get position() {
      return this.#position;
    }
    stream;
    reader;
    constructor(stream) {
      this.stream = stream;
      this.reader = stream.getReader();
    }
    #readBuffered(length) {
      if (!this.#buffered) {
        return void 0;
      }
      const value = this.#buffered.subarray(this.#bufferedOffset, this.#bufferedOffset + length);
      if (this.#bufferedLength > length) {
        this.#position += length;
        this.#bufferedOffset += length;
        this.#bufferedLength -= length;
        return value;
      }
      this.#position += this.#bufferedLength;
      this.#buffered = void 0;
      this.#bufferedOffset = 0;
      this.#bufferedLength = 0;
      return value;
    }
    async #readSource(length) {
      const { done, value } = await this.reader.read();
      if (done) {
        throw new ExactReadableEndedError2();
      }
      if (value.length > length) {
        this.#buffered = value;
        this.#bufferedOffset = length;
        this.#bufferedLength = value.length - length;
        this.#position += length;
        return value.subarray(0, length);
      }
      this.#position += value.length;
      return value;
    }
    iterateExactly(length) {
      let state = this.#buffered ? 0 : 1;
      return {
        next: () => {
          switch (state) {
            case 0: {
              const value = this.#readBuffered(length);
              if (value.length === length) {
                state = 2;
              } else {
                length -= value.length;
                state = 1;
              }
              return { done: false, value };
            }
            case 1:
              state = 3;
              return {
                done: false,
                value: this.#readSource(length).then((value) => {
                  if (value.length === length) {
                    state = 2;
                  } else {
                    length -= value.length;
                    state = 1;
                  }
                  return value;
                })
              };
            case 2:
              return { done: true, value: void 0 };
            case 3:
              throw new Error("Can't call `next` before previous Promise resolves");
            default:
              throw new Error("unreachable");
          }
        }
      };
    }
    readExactly = bipedal2(function* (then, length) {
      let result;
      let index = 0;
      const initial = this.#readBuffered(length);
      if (initial) {
        if (initial.length === length) {
          return initial;
        }
        result = new Uint8Array(length);
        result.set(initial, index);
        index += initial.length;
        length -= initial.length;
      } else {
        result = new Uint8Array(length);
      }
      while (length > 0) {
        const value = yield* then(this.#readSource(length));
        result.set(value, index);
        index += value.length;
        length -= value.length;
      }
      return result;
    });
    /**
     * Return a readable stream with unconsumed data (if any) and
     * all data from the wrapped stream.
     * @returns A `ReadableStream`
     */
    release() {
      if (this.#bufferedLength > 0) {
        return new PushReadableStream2(async (controller) => {
          const buffered = this.#buffered.subarray(this.#bufferedOffset);
          await controller.enqueue(buffered);
          controller.abortSignal.addEventListener("abort", () => {
            void tryCancel2(this.reader);
          });
          while (true) {
            const { done, value } = await this.reader.read();
            if (done) {
              return;
            }
            await controller.enqueue(value);
          }
        });
      } else {
        this.reader.releaseLock();
        return this.stream;
      }
    }
    async cancel(reason) {
      await this.reader.cancel(reason);
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/buffered-transform.js
  var BufferedTransformStream2 = class {
    #readable;
    get readable() {
      return this.#readable;
    }
    #writable;
    get writable() {
      return this.#writable;
    }
    constructor(transform) {
      let bufferedStreamController;
      const buffered = new BufferedReadableStream2(new PushReadableStream2((controller) => {
        bufferedStreamController = controller;
      }));
      let writableStreamController;
      this.#writable = new WritableStream2({
        start(controller) {
          writableStreamController = controller;
        },
        async write(chunk) {
          await bufferedStreamController.enqueue(chunk);
        },
        abort() {
          bufferedStreamController.close();
        },
        close() {
          bufferedStreamController.close();
        }
      });
      this.#readable = new ReadableStream3({
        async pull(controller) {
          try {
            const value = await transform(buffered);
            controller.enqueue(value);
          } catch (e) {
            if (e instanceof StructEmptyError2) {
              controller.close();
              return;
            }
            throw e;
          }
        },
        cancel: (reason) => {
          return writableStreamController.error(reason);
        }
      });
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/consumable/readable.js
  var ConsumableReadableStream2 = class _ConsumableReadableStream extends ReadableStream3 {
    static async enqueue(controller, chunk) {
      const output = new Consumable2(chunk);
      controller.enqueue(output);
      await output.consumed;
    }
    constructor(source, strategy) {
      let wrappedController;
      let wrappedStrategy;
      if (strategy) {
        wrappedStrategy = {};
        if ("highWaterMark" in strategy) {
          wrappedStrategy.highWaterMark = strategy.highWaterMark;
        }
        if ("size" in strategy) {
          wrappedStrategy.size = (chunk) => {
            return strategy.size(chunk.value);
          };
        }
      }
      super({
        start(controller) {
          wrappedController = {
            enqueue(chunk) {
              return _ConsumableReadableStream.enqueue(controller, chunk);
            },
            close() {
              controller.close();
            },
            error(reason) {
              controller.error(reason);
            }
          };
          return source.start?.(wrappedController);
        },
        pull() {
          return source.pull?.(wrappedController);
        },
        cancel(reason) {
          return source.cancel?.(reason);
        }
      }, wrappedStrategy);
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/consumable/wrap-byte-readable.js
  var ConsumableWrapByteReadableStream2 = class extends ReadableStream3 {
    constructor(stream, chunkSize, options) {
      const reader = stream.getReader({ mode: "byob" });
      let buffer3 = new ArrayBuffer(chunkSize);
      super({
        async pull(controller) {
          const { done, value } = await reader.read(new Uint8Array(buffer3), {
            min: options?.min
          });
          if (value) {
            await ConsumableReadableStream2.enqueue(controller, value);
            options?.onRead?.(value.byteLength);
          }
          if (done) {
            controller.close();
            return;
          }
          buffer3 = value.buffer;
        },
        cancel(reason) {
          return reader.cancel(reason);
        }
      });
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/consumable/wrap-writable.js
  var ConsumableWrapWritableStream2 = class extends WritableStream2 {
    constructor(stream, hooks) {
      const writer = stream.getWriter();
      super({
        write(chunk) {
          return chunk.tryConsume(async (chunk2) => {
            if (hooks?.write) {
              await hooks.write(chunk2);
            }
            await writer.write(chunk2);
          });
        },
        async abort(reason) {
          if (hooks?.abort) {
            await hooks.abort(reason);
          }
          await writer.abort(reason);
        },
        async close() {
          if (hooks?.close) {
            await hooks.close();
          }
          await writer.close();
        }
      });
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/consumable/writable.js
  var ConsumableWritableStream2 = class extends WritableStream2 {
    static async write(writer, value) {
      const consumable = new Consumable2(value);
      await writer.write(consumable);
      await consumable.consumed;
    }
    constructor(sink, strategy) {
      let wrappedStrategy;
      if (strategy) {
        wrappedStrategy = {};
        if ("highWaterMark" in strategy) {
          wrappedStrategy.highWaterMark = strategy.highWaterMark;
        }
        if ("size" in strategy) {
          wrappedStrategy.size = (chunk) => {
            return strategy.size(chunk instanceof Consumable2 ? chunk.value : chunk);
          };
        }
      }
      super({
        start(controller) {
          return sink.start?.(controller);
        },
        write(chunk, controller) {
          return chunk.tryConsume((chunk2) => sink.write?.(chunk2, controller));
        },
        abort(reason) {
          return sink.abort?.(reason);
        },
        close() {
          return sink.close?.();
        }
      }, wrappedStrategy);
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/task.js
  var { console: console3 } = globalThis;
  var createTask2 = /* @__PURE__ */ (() => console3?.createTask?.bind(console3) ?? (() => ({
    run(callback) {
      return callback();
    }
  })))();

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/consumable.js
  var Brand = /* @__PURE__ */ Symbol.for("Consumable.brand");
  var Consumable2 = class {
    static WritableStream = ConsumableWritableStream2;
    static WrapWritableStream = ConsumableWrapWritableStream2;
    static ReadableStream = ConsumableReadableStream2;
    static WrapByteReadableStream = ConsumableWrapByteReadableStream2;
    [Brand] = true;
    static [Symbol.hasInstance](value) {
      return !!value?.[Brand];
    }
    #task;
    #resolver;
    value;
    consumed;
    constructor(value) {
      this.#task = createTask2("Consumable");
      this.value = value;
      this.#resolver = new PromiseResolver();
      this.consumed = this.#resolver.promise;
    }
    consume() {
      this.#resolver.resolve();
    }
    error(error) {
      this.#resolver.reject(error);
    }
    tryConsume(callback) {
      try {
        let result = this.#task.run(() => callback(this.value));
        if (isPromiseLike(result)) {
          result = result.then((value) => {
            this.#resolver.resolve();
            return value;
          }, (e) => {
            this.#resolver.reject(e);
            throw e;
          });
        } else {
          this.#resolver.resolve();
        }
        return result;
      } catch (e) {
        this.#resolver.reject(e);
        throw e;
      }
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/stream-extra/esm/struct-deserialize.js
  var StructDeserializeStream2 = class extends BufferedTransformStream2 {
    constructor(struct3) {
      super((stream) => {
        return struct3.deserialize(stream);
      });
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/control/writer.js
  var ScrcpyControlMessageWriter = class {
    #writer;
    #serializer;
    constructor(writer, options) {
      this.#writer = writer;
      this.#serializer = new ScrcpyControlMessageSerializer(options);
    }
    write(message) {
      return Consumable2.WritableStream.write(this.#writer, message);
    }
    injectKeyCode(message) {
      return this.write(this.#serializer.injectKeyCode(message));
    }
    injectText(text) {
      return this.write(this.#serializer.injectText(text));
    }
    /**
     * `pressure` is a float value between 0 and 1.
     */
    injectTouch(message) {
      return this.write(this.#serializer.injectTouch(message));
    }
    /**
     * `scrollX` and `scrollY` are float values between 0 and 1.
     */
    async injectScroll(message) {
      const data = this.#serializer.injectScroll(message);
      if (data) {
        await this.write(data);
      }
    }
    async backOrScreenOn(action) {
      const data = this.#serializer.backOrScreenOn(action);
      if (data) {
        await this.write(data);
      }
    }
    setDisplayPower(on) {
      return this.write(this.#serializer.setDisplayPower(on));
    }
    expandNotificationPanel() {
      return this.write(this.#serializer.expandNotificationPanel());
    }
    expandSettingPanel() {
      return this.write(this.#serializer.expandSettingPanel());
    }
    collapseNotificationPanel() {
      return this.write(this.#serializer.collapseNotificationPanel());
    }
    rotateDevice() {
      return this.write(this.#serializer.rotateDevice());
    }
    async setClipboard(message) {
      const result = this.#serializer.setClipboard(message);
      if (result instanceof Uint8Array) {
        await this.write(result);
      } else {
        await this.write(result[0]);
        await result[1];
      }
    }
    uHidCreate(message) {
      return this.write(this.#serializer.uHidCreate(message));
    }
    uHidInput(message) {
      return this.write(this.#serializer.uHidInput(message));
    }
    uHidDestroy(id) {
      return this.write(this.#serializer.uHidDestroy(id));
    }
    startApp(name, options) {
      return this.write(this.#serializer.startApp(name, options));
    }
    resetVideo() {
      return this.write(this.#serializer.resetVideo());
    }
    cameraSetTorch(enabled) {
      return this.write(this.#serializer.cameraSetTorch(enabled));
    }
    cameraZoomIn() {
      return this.write(this.#serializer.cameraZoomIn());
    }
    cameraZoomOut() {
      return this.write(this.#serializer.cameraZoomOut());
    }
    resizeDisplay(message) {
      return this.write(this.#serializer.resizeDisplay(message));
    }
    scanFile(path) {
      return this.write(this.#serializer.scanFile(path));
    }
    releaseLock() {
      this.#writer.releaseLock();
    }
    async close() {
      await this.#writer.close();
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/back-or-screen-on.js
  var BackOrScreenOnControlMessage = EmptyControlMessage;
  function serializeBackOrScreenOnControlMessage(message) {
    if (message.action === AndroidKeyEventAction.Down) {
      return BackOrScreenOnControlMessage.serialize(message);
    }
    return void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/clipboard-stream.js
  var ClipboardDeviceMessage = struct2({ content: string2(u322) }, { littleEndian: false });
  var ClipboardStream = class extends PushReadableStream2 {
    #controller;
    id = 0;
    constructor() {
      let controller;
      super((controller_) => {
        controller = controller_;
      });
      this.#controller = controller;
    }
    async parse(_id, stream) {
      const message = await ClipboardDeviceMessage.deserialize(stream);
      await this.#controller.enqueue(message.content);
    }
    close() {
      this.#controller.close();
    }
    error(e) {
      this.#controller.error(e);
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/codec-options.js
  var CodecOptions = class _CodecOptions {
    static Empty = /* @__PURE__ */ new _CodecOptions();
    #values = /* @__PURE__ */ new Map();
    get values() {
      return this.#values;
    }
    setInt(key, value) {
      if (value < -2147483648 || value > 2147483647) {
        throw new Error(`Value ${value} is out of range for int type`);
      }
      this.#values.set(key, { type: "int", value: value | 0 });
      return this;
    }
    setFloat(key, value) {
      this.#values.set(key, { type: "float", value });
      return this;
    }
    setLong(key, value) {
      this.#values.set(key, {
        type: "long",
        // Can't use `value | 0` here because the value may be out of int32 range,
        // use `Math.floor` instead
        value: typeof value === "bigint" ? value : Math.floor(value)
      });
      return this;
    }
    setString(key, value) {
      this.#values.set(key, { type: "string", value });
      return this;
    }
    delete(key) {
      return this.#values.delete(key);
    }
    clear() {
      this.#values.clear();
    }
    /**
     * A key describing the desired codec priority.
     *
     * The associated value is an integer. Higher value means lower priority.
     *
     * Currently, only two levels are supported:
     *
     * - 0: realtime priority - meaning that the codec shall support the given performance
     *  configuration (e.g. framerate) at realtime. This should only be used by media playback,
     *  capture, and possibly by realtime communication scenarios if best effort performance
     *  is not suitable.
     * - 1: non-realtime priority (best effort).
     *
     * This is a hint used at codec configuration and resource planning -
     * to understand the realtime requirements of the application;
     * however, due to the nature of media components, performance is not guaranteed.
     */
    setPriority(priority) {
      if (priority === void 0) {
        this.delete("priority");
        return this;
      }
      return this.setInt("priority", priority);
    }
    toOptionValue() {
      if (this.#values.size === 0) {
        return void 0;
      }
      return Array.from(this.#values.entries(), ([key, value]) => {
        let result = key;
        if (value.type !== "int") {
          result += ":" + value.type;
        }
        result += "=";
        if (value.type === "string") {
          result += value.value.replaceAll(",", "\\,");
        } else {
          result += value.value;
        }
        return result;
      }).join(",");
    }
  };
  var VideoCodecOptions = class extends CodecOptions {
    /**
     * A key for applications to opt out of allowing a Surface to
     * discard undisplayed/unconsumed frames as means to catch up after falling behind.
     * This value is an integer.
     * The value 0 indicates the surface is not allowed to drop frames.
     * The value 1 indicates the surface is allowed to drop frames.
     * [`MediaCodec`](https://developer.android.com/reference/android/media/MediaCodec)
     * describes the semantics.
     */
    setAllowFrameDrop(value) {
      if (value === void 0) {
        this.delete("allow-frame-drop");
        return this;
      }
      return this.setInt("allow-frame-drop", value ? 1 : 0);
    }
    /**
     * An optional key describing the period of intra refresh in frames.
     * This is an optional parameter that applies only to video encoders.
     * If encoder supports it (MediaCodecInfo.CodecCapabilities.FEATURE_IntraRefresh),
     * the whole frame is completely refreshed after the specified period.
     * Also for each frame, a fix subset of macroblocks must be intra coded
     * which leads to more constant bitrate than inserting a key frame.
     * This key is recommended for video streaming applications as it provides
     * low-delay and good error-resilience.
     * This key is ignored if the video encoder does not support the intra refresh feature.
     * The associated value is an integer.
     */
    setIntraRefreshPeriod(value) {
      if (value === void 0) {
        this.delete("intra-refresh-period");
        return this;
      }
      return this.setInt("intra-refresh-period", value);
    }
    setIFrameInterval(value, type = "int") {
      if (value === void 0) {
        this.delete("i-frame-interval");
        return this;
      }
      return type === "int" ? this.setInt("i-frame-interval", value) : this.setFloat("i-frame-interval", value);
    }
    /**
     *
     * An optional key describing the desired encoder latency in frames.
     * This is an optional parameter that applies only to video encoders.
     * If encoder supports it, it should output at least one output frame
     * after being queued the specified number of frames.
     * This key is ignored if the video encoder does not support the latency feature.
     * Use the output format to verify that this feature was enabled
     * and the actual value used by the encoder.
     *
     * If the key is not specified, the default latency will be implementation specific.
     * The associated value is an integer.
     */
    setLatency(value) {
      if (value === void 0) {
        this.delete("latency");
        return this;
      }
      return this.setInt("latency", value);
    }
    /**
     * A key describing the desired profile to be used by an encoder.
     *
     * The associated value is an integer. Constants are declared in
     * [`MediaCodecInfo.CodecProfileLevel`](https://developer.android.com/reference/android/media/MediaCodecInfo.CodecProfileLevel).
     * This key is used as a further hint when specifying a desired profile,
     * and is only supported for codecs that specify a level.
     *
     * This key is ignored if the {@link setProfile | `profile`} is not specified.
     * Otherwise, the value should be a level compatible with the configured encoding parameters.
     */
    setLevel(value) {
      if (value === void 0) {
        this.delete("level");
        return this;
      }
      return this.setInt("level", value);
    }
    /**
     * A key describing the maximum number of B frames between I or P frames,
     * to be used by a video encoder.
     * The associated value is an integer.
     * The default value is 0, which means that no B frames are allowed.
     * Note that non-zero value does not guarantee B frames; it's up to the encoder to decide.
     */
    setMaxBFrames(value) {
      if (value === void 0) {
        this.delete("max-bframes");
        return this;
      }
      return this.setInt("max-bframes", value);
    }
    /**
     * Instruct the video encoder in "surface-input" mode to drop excessive frames from the source,
     * so that the input frame rate to the encoder does not exceed the specified fps.
     * The associated value is a float, representing the max frame rate to feed the encoder at.
     */
    setMaxFpsToEncoder(value) {
      if (value === void 0) {
        this.delete("max-fps-to-encoder");
        return this;
      }
      return this.setFloat("max-fps-to-encoder", value);
    }
    /**
     * A key describing the desired profile to be used by an encoder.
     *
     * The associated value is an integer.
     * Constants are declared in
     * [MediaCodecInfo.CodecProfileLevel](https://developer.android.com/reference/android/media/MediaCodecInfo.CodecProfileLevel).
     * This key is used as a hint, and is only supported for codecs that specify a profile.
     * When configuring profile,
     * encoder configuration may fail if other parameters are not compatible with
     * the desired profile or if the desired profile is not supported,
     * but it may also fail silently
     * (where the encoder ends up using a different, compatible profile.)
     *
     * It is recommended that the profile is set for all encoders.
     * For more information, see the *Encoder Profiles* section of the
     * [`MediaCodec`](https://developer.android.com/reference/android/media/MediaCodec)
     * API reference.
     */
    setProfile(value) {
      if (value === void 0) {
        this.delete("profile");
        return this;
      }
      return this.setInt("profile", value);
    }
    /**
     * Applies only when configuring a video encoder in "surface-input" mode.
     * The associated value is a long and gives the time in microseconds
     * after which the frame previously submitted to the encoder will be repeated (once)
     * if no new frame became available since.
     */
    setRepeatPreviousFrameAfter(value) {
      if (value === void 0) {
        this.delete("repeat-previous-frame-after");
        return this;
      }
      return this.setLong("repeat-previous-frame-after", value);
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/compute-option-values.js
  function computeOptionValues(options, defaults) {
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => {
      if (key in options) {
        const optionValue = options[key];
        if (optionValue !== void 0) {
          return [key, optionValue];
        }
      }
      return [key, value];
    }));
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/control-message-types.js
  var ControlMessageTypes = {
    [control_message_type_value_exports.InjectKeyCode]: 0,
    [control_message_type_value_exports.InjectText]: 1,
    [control_message_type_value_exports.InjectTouch]: 2,
    [control_message_type_value_exports.InjectScroll]: 3,
    [control_message_type_value_exports.BackOrScreenOn]: 4,
    [control_message_type_value_exports.ExpandNotificationPanel]: 5,
    [control_message_type_value_exports.CollapseNotificationPanel]: 6,
    [control_message_type_value_exports.GetClipboard]: 7,
    [control_message_type_value_exports.SetClipboard]: 8,
    [control_message_type_value_exports.SetDisplayPower]: 9,
    [control_message_type_value_exports.RotateDevice]: 10
  };

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/init.js
  var VideoOrientation = {
    Unlocked: -1,
    Portrait: 0,
    Landscape: 1,
    PortraitFlipped: 2,
    LandscapeFlipped: 3
  };
  var Crop = class {
    width;
    height;
    x;
    y;
    constructor(width, height, x, y) {
      this.width = width;
      this.height = height;
      this.x = x;
      this.y = y;
    }
    toOptionValue() {
      return `${this.width}:${this.height}:${this.x}:${this.y}`;
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/defaults.js
  var Defaults = {
    logLevel: "debug",
    maxSize: 0,
    bitRate: 8e6,
    maxFps: 0,
    lockVideoOrientation: VideoOrientation.Unlocked,
    tunnelForward: false,
    crop: void 0,
    sendFrameMeta: true,
    control: true,
    displayId: 0,
    showTouches: false,
    stayAwake: false,
    codecOptions: void 0
  };

  // node_modules/@yume-chan/scrcpy/esm/utils/clamp.js
  function clamp(value, min, max) {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  // node_modules/@yume-chan/scrcpy/esm/utils/constants.js
  var DefaultServerPath = "/data/local/tmp/scrcpy-server.jar";

  // node_modules/@yume-chan/scrcpy/esm/utils/omit.js
  // @__NO_SIDE_EFFECTS__
  function omit(value, ...keys) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/inject-touch.js
  var UnsignedFloat = field2(2, "byob", (source, { buffer: buffer3, index, littleEndian }) => {
    source = clamp(source, -1, 1);
    source = source === 1 ? 65535 : source * 65536;
    setUint162(buffer3, index, source, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(2));
    const value = getUint162(data, 0, littleEndian);
    return value === 65535 ? 1 : value / 65536;
  });
  var PointerId = {
    Mouse: -1n,
    Finger: -2n,
    VirtualMouse: -3n,
    VirtualFinger: -4n
  };
  var InjectTouchControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    action: u82(),
    pointerId: u642,
    pointerX: u322,
    pointerY: u322,
    videoWidth: u16,
    videoHeight: u16,
    pressure: UnsignedFloat,
    buttons: u322
  }, { littleEndian: false });
  function serializeInjectTouchControlMessage(message) {
    return InjectTouchControlMessage.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/media-stream-transformer.js
  var MediaStreamRawPacket = struct2({ pts: u642, data: buffer2(u322) }, { littleEndian: false });
  var PtsConfig = 1n << 63n;
  function createMediaStreamTransformer(options) {
    if (!options.sendFrameMeta) {
      return new TransformStream3({
        transform(chunk, controller) {
          controller.enqueue({
            type: "data",
            data: chunk
          });
        }
      });
    }
    const deserializeStream = new StructDeserializeStream2(MediaStreamRawPacket);
    return {
      writable: deserializeStream.writable,
      readable: deserializeStream.readable.pipeThrough(new TransformStream3({
        transform(packet, controller) {
          if (packet.pts === PtsConfig) {
            controller.enqueue({
              type: "configuration",
              data: packet.data
            });
            return;
          }
          controller.enqueue({
            type: "data",
            pts: packet.pts,
            data: packet.data
          });
        }
      }))
    };
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/parse-display.js
  function parseDisplay(line) {
    const match = line.match(/^\s+scrcpy --display (\d+)$/);
    if (match) {
      return {
        id: Number.parseInt(match[1], 10)
      };
    }
    return void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/video/codec-id.js
  var codec_id_exports = {};
  __export(codec_id_exports, {
    Av1: () => Av1,
    H264: () => H264,
    H265: () => H265,
    Vp8: () => Vp8,
    Vp9: () => Vp9
  });
  var H264 = 1748121140;
  var H265 = 1748121141;
  var Av1 = 6387249;
  var Vp8 = 7761976;
  var Vp9 = 7761977;

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/event/esm/event-emitter.js
  var EventEmitter2 = class {
    listeners = [];
    constructor() {
      this.event = this.event.bind(this);
    }
    addEventListener(info) {
      this.listeners.push(info);
      const remove = () => {
        const index = this.listeners.indexOf(info);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      };
      remove.dispose = remove;
      return remove;
    }
    event = (listener, thisArg, ...args) => {
      const info = {
        listener,
        thisArg,
        args
      };
      return this.addEventListener(info);
    };
    fire(e) {
      for (const info of this.listeners.slice()) {
        info.listener.call(info.thisArg, e, ...info.args);
      }
    }
    dispose() {
      this.listeners.length = 0;
    }
  };

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/event/esm/absence.js
  var Absence = /* @__PURE__ */ Symbol("absence");

  // node_modules/@yume-chan/scrcpy/node_modules/@yume-chan/event/esm/sticky-event-emitter.js
  var StickyEventEmitter2 = class extends EventEmitter2 {
    #value;
    /**
     * Gets whether there is a value. If `true`, `value` can be accessed without error.
     */
    get hasValue() {
      return this.#value !== Absence;
    }
    /**
     * Gets the current value. If there is no value, throws an error.
     */
    get value() {
      if (this.#value === Absence) {
        throw new Error("No value");
      }
      return this.#value;
    }
    #equal;
    constructor(options = {}) {
      super();
      if ("initialValue" in options) {
        this.#value = options.initialValue;
      } else {
        this.#value = Absence;
      }
      if (options.equals) {
        this.#equal = options.equals;
      } else {
        this.#equal = () => false;
      }
    }
    addEventListener(info) {
      if (this.#value !== Absence) {
        info.listener.call(info.thisArg, this.#value, ...info.args);
      }
      return super.addEventListener(info);
    }
    fire(e) {
      if (this.#value !== Absence && this.#equal(this.#value, e)) {
        return;
      }
      this.#value = e;
      super.fire(e);
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/video/size.js
  var ScrcpyVideoSizeImpl = class {
    #width = 0;
    get width() {
      return this.#width;
    }
    #height = 0;
    get height() {
      return this.#height;
    }
    #sizeChanged = new StickyEventEmitter2();
    get sizeChanged() {
      return this.#sizeChanged.event;
    }
    setSize(width, height, isClientResize) {
      if (this.#width === width && this.#height === height) {
        return;
      }
      this.#width = width;
      this.#height = height;
      this.#sizeChanged.fire({ width, height, isClientResize });
    }
    dispose() {
      this.#sizeChanged.dispose();
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/parse-video-stream-metadata.js
  async function readString(stream, maxLength) {
    const buffer3 = await stream.readExactly(maxLength);
    return decodeUtf82(buffer3.subarray(0, buffer3.indexOf(0)));
  }
  async function readU16(stream) {
    const buffer3 = await stream.readExactly(2);
    return getUint16BigEndian(buffer3, 0);
  }
  async function readU32(stream) {
    const buffer3 = await stream.readExactly(4);
    return getUint32BigEndian(buffer3, 0);
  }
  async function parseVideoStreamMetadata(stream) {
    const buffered = new BufferedReadableStream2(stream);
    const metadata = {
      deviceName: await readString(buffered, 64),
      width: await readU16(buffered),
      height: await readU16(buffered),
      codec: codec_id_exports.H264
    };
    return { stream: buffered.release(), metadata };
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/scroll-controller.js
  var InjectScrollControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    pointerX: u322,
    pointerY: u322,
    videoWidth: u16,
    videoHeight: u16,
    scrollX: s322,
    scrollY: s322
  }, { littleEndian: false });
  var ScrollController = class {
    #accumulatedX = 0;
    #accumulatedY = 0;
    processMessage(message) {
      if (message.scrollX) {
        if (Math.sign(message.scrollX) !== Math.sign(this.#accumulatedX)) {
          this.#accumulatedX = message.scrollX;
        } else {
          this.#accumulatedX += message.scrollX;
        }
      }
      if (message.scrollY) {
        if (Math.sign(message.scrollY) !== Math.sign(this.#accumulatedY)) {
          this.#accumulatedY = message.scrollY;
        } else {
          this.#accumulatedY += message.scrollY;
        }
      }
      const integerX = this.#accumulatedX | 0;
      this.#accumulatedX -= integerX;
      const integerY = this.#accumulatedY | 0;
      this.#accumulatedY -= integerY;
      if (integerX === 0 && integerY === 0) {
        return void 0;
      }
      message.scrollX = integerX;
      message.scrollY = integerY;
      return message;
    }
    serializeScrollMessage(message) {
      const processed = this.processMessage(message);
      if (!processed) {
        return void 0;
      }
      return InjectScrollControlMessage.serialize(processed);
    }
  };
  function createScrollController() {
    return new ScrollController();
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/serialize-order.js
  var SerializeOrder = [
    "logLevel",
    "maxSize",
    "bitRate",
    "maxFps",
    "lockVideoOrientation",
    "tunnelForward",
    "crop",
    "sendFrameMeta",
    "control",
    "displayId",
    "showTouches",
    "stayAwake",
    "codecOptions"
  ];

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/serialize.js
  function serialize(options, order) {
    return order.map((key) => toScrcpyOptionValue(options[key], "-"));
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/set-clipboard.js
  var SetClipboardControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    content: string2(u322)
  }, { littleEndian: false });
  function serializeSetClipboardControlMessage(message) {
    return SetClipboardControlMessage.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/set-display-power.js
  var SetDisplayPowerControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    mode: u82()
  }, { littleEndian: false });
  function serializeSetDisplayPowerControlMessage(message) {
    return SetDisplayPowerControlMessage.serialize({
      type: message.type,
      mode: message.on ? AndroidScreenPowerMode.Normal : AndroidScreenPowerMode.Off
    });
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/set-list-display.js
  function setListDisplays(options) {
    options.displayId = -1;
  }

  // node_modules/@yume-chan/scrcpy/esm/1_17/impl/index.js
  var impl_exports2 = {};
  __export(impl_exports2, {
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes,
    Crop: () => Crop,
    Defaults: () => Defaults2,
    EncoderRegex: () => EncoderRegex,
    InjectScrollControlMessage: () => InjectScrollControlMessage,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    ScrollController: () => ScrollController,
    SerializeOrder: () => SerializeOrder2,
    SetClipboardControlMessage: () => SetClipboardControlMessage,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation,
    computeOptionValues: () => computeOptionValues,
    createMediaStreamTransformer: () => createMediaStreamTransformer,
    createScrollController: () => createScrollController,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_17/impl/defaults.js
  var Defaults2 = {
    ...impl_exports.Defaults,
    encoderName: void 0
  };

  // node_modules/@yume-chan/scrcpy/esm/1_17/impl/parse-encoder.js
  function parseEncoder(line, encoderNameRegex) {
    const match = line.match(encoderNameRegex);
    if (match) {
      return { type: "video", name: match[1] };
    }
    return void 0;
  }
  var EncoderRegex = /^\s+scrcpy --encoder-name '([^']+)'$/;

  // node_modules/@yume-chan/scrcpy/esm/1_17/impl/serialize-order.js
  var SerializeOrder2 = /* @__PURE__ */ (() => [
    ...impl_exports.SerializeOrder,
    "encoderName"
  ])();

  // node_modules/@yume-chan/scrcpy/esm/1_17/impl/set-list-encoder.js
  function setListEncoders(options) {
    options.encoderName = "_";
  }

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/index.js
  var impl_exports3 = {};
  __export(impl_exports3, {
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults3,
    EncoderRegex: () => EncoderRegex2,
    InjectScrollControlMessage: () => InjectScrollControlMessage,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    ScrollController: () => ScrollController,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues,
    createMediaStreamTransformer: () => createMediaStreamTransformer,
    createScrollController: () => createScrollController,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/back-or-screen-on.js
  var BackOrScreenOnControlMessage2 = extend2(impl_exports2.BackOrScreenOnControlMessage, { action: u82() });
  function serializeBackOrScreenOnControlMessage2(message) {
    return BackOrScreenOnControlMessage2.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/control-message-types.js
  var ControlMessageTypes2 = {
    [control_message_type_value_exports.InjectKeyCode]: 0,
    [control_message_type_value_exports.InjectText]: 1,
    [control_message_type_value_exports.InjectTouch]: 2,
    [control_message_type_value_exports.InjectScroll]: 3,
    [control_message_type_value_exports.BackOrScreenOn]: 4,
    [control_message_type_value_exports.ExpandNotificationPanel]: 5,
    [control_message_type_value_exports.ExpandSettingPanel]: 6,
    [control_message_type_value_exports.CollapseNotificationPanel]: 7,
    [control_message_type_value_exports.GetClipboard]: 8,
    [control_message_type_value_exports.SetClipboard]: 9,
    [control_message_type_value_exports.SetDisplayPower]: 10,
    [control_message_type_value_exports.RotateDevice]: 11
  };

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/init.js
  var VideoOrientation2 = {
    Initial: -2,
    Unlocked: -1,
    Portrait: 0,
    Landscape: 1,
    PortraitFlipped: 2,
    LandscapeFlipped: 3
  };

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/defaults.js
  var Defaults3 = {
    ...impl_exports2.Defaults,
    logLevel: "debug",
    lockVideoOrientation: VideoOrientation2.Unlocked,
    powerOffOnClose: false
  };

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/parse-encoder.js
  var EncoderRegex2 = /^\s+scrcpy --encoder '([^']+)'$/;

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/serialize-order.js
  var SerializeOrder3 = /* @__PURE__ */ (() => [
    ...impl_exports2.SerializeOrder,
    "powerOffOnClose"
  ])();

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/index.js
  var impl_exports4 = {};
  __export(impl_exports4, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults4,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    ScrollController: () => ScrollController,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues2,
    createMediaStreamTransformer: () => createMediaStreamTransformer,
    createScrollController: () => createScrollController,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/compute-option-values.js
  function overrideClipboardAutosync(value) {
    if (!value.control) {
      value.clipboardAutosync = false;
    }
  }
  function computeOptionValues2(options, defaults) {
    const value = impl_exports3.computeOptionValues(options, defaults);
    overrideClipboardAutosync(value);
    return value;
  }

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/defaults.js
  var Defaults4 = {
    ...impl_exports3.Defaults,
    clipboardAutosync: true
  };

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/parse-encoder.js
  var EncoderRegex3 = /^\s+scrcpy --encoder-name '([^']+)'$/;

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/serialize.js
  function toSnakeCase(input) {
    return input.replace(/([A-Z])/g, "_$1").toLowerCase();
  }
  function serialize2(options, defaults) {
    const result = [];
    for (const [key, value] of Object.entries(options)) {
      const serializedValue = toScrcpyOptionValue(value, void 0);
      if (serializedValue === void 0) {
        continue;
      }
      const defaultValue = toScrcpyOptionValue(defaults[key], void 0);
      if (serializedValue === defaultValue) {
        continue;
      }
      result.push(`${toSnakeCase(key)}=${serializedValue}`);
    }
    return result;
  }

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/set-clipboard.js
  var AckClipboardDeviceMessage = struct2({ sequence: u642 }, { littleEndian: false });
  var SetClipboardControlMessage2 = struct2({
    // value of `type` can change between versions
    type: u82,
    sequence: u642,
    paste: u82(),
    content: string2(u322)
  }, { littleEndian: false });
  var AckClipboardHandler = class {
    #resolvers = /* @__PURE__ */ new Map();
    #closed = false;
    id = 1;
    async parse(_id, stream) {
      const message = await AckClipboardDeviceMessage.deserialize(stream);
      const resolver = this.#resolvers.get(message.sequence);
      if (resolver) {
        resolver.resolve();
        this.#resolvers.delete(message.sequence);
      }
    }
    close() {
      for (const resolver of this.#resolvers.values()) {
        resolver.reject();
      }
      this.#resolvers.clear();
      this.#closed = true;
    }
    error(e) {
      for (const resolver of this.#resolvers.values()) {
        resolver.reject(e);
      }
      this.#resolvers.clear();
      this.#closed = true;
    }
    serializeSetClipboardControlMessage(message) {
      if (message.sequence === 0n) {
        return SetClipboardControlMessage2.serialize(message);
      }
      if (this.#closed) {
        throw new Error();
      }
      const resolver = new PromiseResolver();
      this.#resolvers.set(message.sequence, resolver);
      return [
        SetClipboardControlMessage2.serialize(message),
        resolver.promise
      ];
    }
  };
  function serializeSetClipboardControlMessage2(message, ackHandler) {
    if (!ackHandler) {
      throw new Error("`serializeSetClipboardControlMessage` requires `control: true` option");
    }
    return ackHandler.serializeSetClipboardControlMessage(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/1_22/impl/index.js
  var impl_exports5 = {};
  __export(impl_exports5, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults5,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage2,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    ScrollController: () => ScrollController2,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues2,
    createMediaStreamTransformer: () => createMediaStreamTransformer,
    createScrollController: () => createScrollController2,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata2,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_22/impl/defaults.js
  var Defaults5 = {
    ...impl_exports4.Defaults,
    downsizeOnError: true,
    sendDeviceMeta: true,
    sendDummyByte: true
  };

  // node_modules/@yume-chan/scrcpy/esm/1_22/impl/parse-video-stream-metadata.js
  async function parseVideoStreamMetadata2(stream, sendDeviceMeta) {
    if (!sendDeviceMeta) {
      return { stream, metadata: { codec: codec_id_exports.H264 } };
    } else {
      return impl_exports4.parseVideoStreamMetadata(stream);
    }
  }

  // node_modules/@yume-chan/scrcpy/esm/1_22/impl/scroll-controller.js
  var InjectScrollControlMessage2 = extend2(impl_exports4.InjectScrollControlMessage, { buttons: s322 });
  var ScrollController2 = class extends impl_exports4.ScrollController {
    serializeScrollMessage(message) {
      const processed = this.processMessage(message);
      if (!processed) {
        return void 0;
      }
      return InjectScrollControlMessage2.serialize(processed);
    }
  };
  function createScrollController2() {
    return new ScrollController2();
  }

  // node_modules/@yume-chan/scrcpy/esm/1_23/impl/index.js
  var impl_exports6 = {};
  __export(impl_exports6, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults6,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage2,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController2,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController2,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata2,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_23/impl/defaults.js
  var Defaults6 = {
    ...impl_exports5.Defaults,
    cleanup: true
  };

  // node_modules/@yume-chan/scrcpy/esm/1_23/impl/media-stream-transformer.js
  var PtsKeyframe = 1n << 62n;
  function createMediaStreamTransformer2(options) {
    if (!options.sendFrameMeta) {
      return new TransformStream3({
        transform(chunk, controller) {
          controller.enqueue({
            type: "data",
            data: chunk
          });
        }
      });
    }
    const deserializeStream = new StructDeserializeStream2(impl_exports5.MediaStreamRawPacket);
    return {
      writable: deserializeStream.writable,
      readable: deserializeStream.readable.pipeThrough(new TransformStream3({
        transform(packet, controller) {
          if (packet.pts === impl_exports5.PtsConfig) {
            controller.enqueue({
              type: "configuration",
              data: packet.data
            });
            return;
          }
          if (packet.pts & PtsKeyframe) {
            controller.enqueue({
              type: "data",
              keyframe: true,
              pts: packet.pts & ~PtsKeyframe,
              data: packet.data
            });
            return;
          }
          controller.enqueue({
            type: "data",
            keyframe: false,
            pts: packet.pts,
            data: packet.data
          });
        }
      }))
    };
  }

  // node_modules/@yume-chan/scrcpy/esm/1_24/impl/defaults.js
  var Defaults7 = {
    ...impl_exports6.Defaults,
    powerOn: true
  };

  // node_modules/@yume-chan/scrcpy/esm/1_25/impl/index.js
  var impl_exports7 = {};
  __export(impl_exports7, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults7,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    SignedFloat: () => SignedFloat,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata2,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_25/impl/scroll-controller.js
  var SignedFloat = field2(2, "byob", (value, { buffer: buffer3, index, littleEndian }) => {
    value = clamp(value, -1, 1);
    value = value === 1 ? 32767 : value * 32768;
    setInt162(buffer3, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(2));
    const value = getInt162(data, 0, littleEndian);
    return value === 32767 ? 1 : value / 32768;
  });
  var InjectScrollControlMessage3 = struct2({
    // value of `type` can change between versions
    type: u82,
    pointerX: u322,
    pointerY: u322,
    videoWidth: u16,
    videoHeight: u16,
    scrollX: SignedFloat,
    scrollY: SignedFloat,
    buttons: u322
  }, { littleEndian: false });
  var ScrollController3 = class {
    serializeScrollMessage(message) {
      return InjectScrollControlMessage3.serialize(message);
    }
  };
  function createScrollController3() {
    return new ScrollController3();
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/index.js
  var impl_exports8 = {};
  __export(impl_exports8, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults8,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    SignedFloat: () => SignedFloat,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseAudioCodecOption: () => parseAudioCodecOption,
    parseAudioMetadataCodec: () => parseAudioMetadataCodec,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay2,
    parseEncoder: () => parseEncoder2,
    parseVideoCodecOption: () => parseVideoCodecOption,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    parseVideoStreamMetadataAsync: () => parseVideoStreamMetadataAsync,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/defaults.js
  var Defaults8 = /* @__PURE__ */ (() => ({
    ...omit(impl_exports7.Defaults, "bitRate", "codecOptions", "encoderName"),
    scid: void 0,
    videoCodec: "h264",
    videoBitRate: 8e6,
    videoCodecOptions: void 0,
    videoEncoder: void 0,
    audio: true,
    audioCodec: "opus",
    audioBitRate: 128e3,
    audioCodecOptions: void 0,
    audioEncoder: void 0,
    listEncoders: false,
    listDisplays: false,
    sendCodecMeta: true
  }))();

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/init.js
  var InstanceId = class _InstanceId {
    static NONE = /* @__PURE__ */ new _InstanceId(-1);
    static random() {
      return new _InstanceId(Math.random() * 2147483648 | 0);
    }
    value;
    constructor(value) {
      this.value = value;
    }
    toOptionValue() {
      if (this.value < 0) {
        return void 0;
      }
      return this.value.toString(16);
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/inject-touch.js
  var InjectTouchControlMessage2 = struct2({
    // value of `type` can change between versions
    type: u82,
    action: u82(),
    pointerId: u642,
    pointerX: u322,
    pointerY: u322,
    videoWidth: u16,
    videoHeight: u16,
    pressure: impl_exports7.UnsignedFloat,
    actionButton: u322,
    buttons: u322
  }, { littleEndian: false });
  function serializeInjectTouchControlMessage2(message) {
    return InjectTouchControlMessage2.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/parse-audio-stream-metadata.js
  function parseAudioMetadataCodec(codec) {
    switch (codec) {
      case ScrcpyAudioCodec.Raw.metadataValue:
        return ScrcpyAudioCodec.Raw;
      case ScrcpyAudioCodec.Opus.metadataValue:
        return ScrcpyAudioCodec.Opus;
      case ScrcpyAudioCodec.Aac.metadataValue:
        return ScrcpyAudioCodec.Aac;
      default:
        throw new Error(`Unknown audio codec metadata value: ${codec}`);
    }
  }
  function parseAudioCodecOption(audioCodec) {
    switch (audioCodec) {
      case "raw":
        return ScrcpyAudioCodec.Raw;
      case "opus":
        return ScrcpyAudioCodec.Opus;
      case "aac":
        return ScrcpyAudioCodec.Aac;
      default:
        throw new Error(`Unknown audio codec: ${audioCodec}`);
    }
  }
  async function parseAudioStreamMetadata(stream, sendCodecMeta, parseMetadataCodec, fallbackCodec) {
    const buffered = new BufferedReadableStream2(stream);
    const buffer3 = await buffered.readExactly(4);
    const codecMetadataValue = getUint32BigEndian(buffer3, 0);
    switch (codecMetadataValue) {
      case 0:
        return {
          type: "disabled"
        };
      case 1:
        return {
          type: "errored"
        };
    }
    if (sendCodecMeta) {
      return {
        type: "success",
        codec: parseMetadataCodec(codecMetadataValue),
        stream: buffered.release()
      };
    }
    return {
      type: "success",
      codec: fallbackCodec,
      stream: new PushReadableStream2(async (controller) => {
        await controller.enqueue(buffer3);
        const stream2 = buffered.release();
        for await (const chunk of stream2) {
          await controller.enqueue(chunk);
        }
      })
    };
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/parse-display.js
  function parseDisplay2(line) {
    const match = line.match(/^\s+--display=(\d+)\s+\(([^)]+)\)$/);
    if (match) {
      const display = {
        id: Number.parseInt(match[1], 10)
      };
      if (match[2] !== "size unknown") {
        display.resolution = match[2];
      }
      return display;
    }
    return void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/parse-encoder.js
  var EncoderRegex4 = /^\s+--(video|audio)-codec=(\S+)\s+--\1-encoder='([^']+)'$/;
  function parseEncoder2(line) {
    const match = line.match(EncoderRegex4);
    return match ? {
      type: match[1],
      name: match[3],
      codec: match[2]
    } : void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/parse-video-stream-metadata.js
  function parseVideoCodecOption(codec) {
    switch (codec) {
      case "h264":
        return codec_id_exports.H264;
      case "h265":
        return codec_id_exports.H265;
      case "av1":
        return codec_id_exports.Av1;
      default:
        throw new Error(`Unknown video codec: ${codec}`);
    }
  }
  async function parseVideoStreamMetadataAsync(stream, sendDeviceMeta, sendCodecMeta, fallbackCodec) {
    const buffered = new BufferedReadableStream2(stream);
    let deviceName;
    if (sendDeviceMeta) {
      deviceName = await impl_exports7.readString(buffered, 64);
    }
    let codec;
    let width;
    let height;
    if (sendCodecMeta) {
      codec = await impl_exports7.readU32(buffered);
      width = await impl_exports7.readU32(buffered);
      height = await impl_exports7.readU32(buffered);
    } else {
      codec = fallbackCodec;
    }
    return {
      stream: buffered.release(),
      metadata: { deviceName, codec, width, height }
    };
  }
  function parseVideoStreamMetadata3(stream, sendDeviceMeta, sendCodecMeta, fallbackCodec, parseAsync) {
    if (!sendDeviceMeta && !sendCodecMeta) {
      return {
        stream,
        metadata: { codec: fallbackCodec }
      };
    }
    return parseAsync(stream, sendDeviceMeta, sendCodecMeta, fallbackCodec);
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/set-list-display.js
  function setListDisplays2(options) {
    options.listDisplays = true;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/set-list-encoder.js
  function setListEncoders2(options) {
    options.listEncoders = true;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_1/impl/index.js
  var impl_exports9 = {};
  __export(impl_exports9, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults9,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    SignedFloat: () => SignedFloat,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseAudioCodecOption: () => parseAudioCodecOption,
    parseAudioMetadataCodec: () => parseAudioMetadataCodec,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay2,
    parseEncoder: () => parseEncoder2,
    parseVideoCodecOption: () => parseVideoCodecOption,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    parseVideoStreamMetadataAsync: () => parseVideoStreamMetadataAsync,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/2_1/impl/defaults.js
  var Defaults9 = {
    ...impl_exports8.Defaults,
    video: true,
    audioSource: "output"
  };

  // node_modules/@yume-chan/scrcpy/esm/2_2/impl/compute-option-values.js
  function computeOptionValues3(options, defaults) {
    const value = computeOptionValues(options, defaults);
    if (value.videoSource !== "display") {
      value.control = false;
    }
    impl_exports9.overrideClipboardAutosync(value);
    return value;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_2/impl/defaults.js
  var Defaults10 = {
    ...impl_exports9.Defaults,
    videoSource: "display",
    displayId: 0,
    cameraId: void 0,
    cameraSize: void 0,
    cameraFacing: void 0,
    cameraAr: void 0,
    cameraFps: void 0,
    cameraHighSpeed: false,
    listCameras: false,
    listCameraSizes: false
  };

  // node_modules/@yume-chan/scrcpy/esm/2_2/impl/parse-display.js
  function parseDisplay3(line) {
    const match = line.match(/^\s+--display-id=(\d+)\s+\(([^)]+)\)$/);
    if (match) {
      const display = {
        id: Number.parseInt(match[1], 10)
      };
      if (match[2] !== "size unknown") {
        display.resolution = match[2];
      }
      return display;
    }
    return void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_3/impl/parse-audio-stream-metadata.js
  function parseAudioMetadataCodec2(codec) {
    switch (codec) {
      case ScrcpyAudioCodec.Raw.metadataValue:
        return ScrcpyAudioCodec.Raw;
      case ScrcpyAudioCodec.Opus.metadataValue:
        return ScrcpyAudioCodec.Opus;
      case ScrcpyAudioCodec.Aac.metadataValue:
        return ScrcpyAudioCodec.Aac;
      case ScrcpyAudioCodec.Flac.metadataValue:
        return ScrcpyAudioCodec.Flac;
      default:
        throw new Error(`Unknown audio codec metadata value: ${codec}`);
    }
  }
  function parseAudioCodecOption2(audioCodec) {
    switch (audioCodec) {
      case "raw":
        return ScrcpyAudioCodec.Raw;
      case "opus":
        return ScrcpyAudioCodec.Opus;
      case "aac":
        return ScrcpyAudioCodec.Aac;
      case "flac":
        return ScrcpyAudioCodec.Flac;
      default:
        throw new Error(`Unknown audio codec: ${audioCodec}`);
    }
  }

  // node_modules/@yume-chan/scrcpy/esm/2_4/impl/index.js
  var impl_exports10 = {};
  __export(impl_exports10, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes3,
    Crop: () => Crop,
    Defaults: () => Defaults10,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues3,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseAudioCodecOption: () => parseAudioCodecOption2,
    parseAudioMetadataCodec: () => parseAudioMetadataCodec2,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder2,
    parseVideoCodecOption: () => parseVideoCodecOption,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    parseVideoStreamMetadataAsync: () => parseVideoStreamMetadataAsync,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/2_4/impl/control-message-types.js
  var ControlMessageTypes3 = {
    [control_message_type_value_exports.InjectKeyCode]: 0,
    [control_message_type_value_exports.InjectText]: 1,
    [control_message_type_value_exports.InjectTouch]: 2,
    [control_message_type_value_exports.InjectScroll]: 3,
    [control_message_type_value_exports.BackOrScreenOn]: 4,
    [control_message_type_value_exports.ExpandNotificationPanel]: 5,
    [control_message_type_value_exports.ExpandSettingPanel]: 6,
    [control_message_type_value_exports.CollapseNotificationPanel]: 7,
    [control_message_type_value_exports.GetClipboard]: 8,
    [control_message_type_value_exports.SetClipboard]: 9,
    [control_message_type_value_exports.SetDisplayPower]: 10,
    [control_message_type_value_exports.RotateDevice]: 11,
    [control_message_type_value_exports.UHidCreate]: 12,
    [control_message_type_value_exports.UHidInput]: 13,
    [control_message_type_value_exports.OpenHardKeyboardSettings]: 14
  };

  // node_modules/@yume-chan/scrcpy/esm/2_4/impl/serialize-uhid-create.js
  var UHidCreateControlMessage = struct2({
    // value of `type` can change between versions
    type: u82,
    id: u16,
    data: buffer2(u16)
  }, { littleEndian: false });
  function serializeUHidCreateControlMessage(message) {
    return UHidCreateControlMessage.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/2_4/impl/uhid-output-stream.js
  var UHidOutputDeviceMessage = struct2({
    id: u16,
    data: buffer2(u16)
  }, { littleEndian: false });
  var UHidOutputStream = class extends PushReadableStream2 {
    #controller;
    id = 2;
    constructor() {
      let controller;
      super((controller_) => {
        controller = controller_;
      });
      this.#controller = controller;
    }
    async parse(_id, stream) {
      const message = await UHidOutputDeviceMessage.deserialize(stream);
      await this.#controller.enqueue(message);
    }
    close() {
      this.#controller.close();
    }
    error(e) {
      this.#controller.error(e);
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/2_6/impl/compute-option-values.js
  function overrideAudioSource(value) {
    if (value.audioDup) {
      value.audioSource = "playback";
    }
  }
  function computeOptionValues4(options, defaults) {
    const value = impl_exports10.computeOptionValues(options, defaults);
    overrideAudioSource(value);
    return value;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_6/impl/defaults.js
  var Defaults11 = {
    ...impl_exports10.Defaults,
    audioDup: false
  };

  // node_modules/@yume-chan/scrcpy/esm/2_7/impl/index.js
  var impl_exports11 = {};
  __export(impl_exports11, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes4,
    Crop: () => Crop,
    Defaults: () => Defaults11,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage2,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues4,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    overrideAudioSource: () => overrideAudioSource,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseAudioCodecOption: () => parseAudioCodecOption2,
    parseAudioMetadataCodec: () => parseAudioMetadataCodec2,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder2,
    parseVideoCodecOption: () => parseVideoCodecOption,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    parseVideoStreamMetadataAsync: () => parseVideoStreamMetadataAsync,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage2,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/2_7/impl/control-message-types.js
  var ControlMessageTypes4 = {
    [control_message_type_value_exports.InjectKeyCode]: 0,
    [control_message_type_value_exports.InjectText]: 1,
    [control_message_type_value_exports.InjectTouch]: 2,
    [control_message_type_value_exports.InjectScroll]: 3,
    [control_message_type_value_exports.BackOrScreenOn]: 4,
    [control_message_type_value_exports.ExpandNotificationPanel]: 5,
    [control_message_type_value_exports.ExpandSettingPanel]: 6,
    [control_message_type_value_exports.CollapseNotificationPanel]: 7,
    [control_message_type_value_exports.GetClipboard]: 8,
    [control_message_type_value_exports.SetClipboard]: 9,
    [control_message_type_value_exports.SetDisplayPower]: 10,
    [control_message_type_value_exports.RotateDevice]: 11,
    [control_message_type_value_exports.UHidCreate]: 12,
    [control_message_type_value_exports.UHidInput]: 13,
    [control_message_type_value_exports.UHidDestroy]: 14,
    [control_message_type_value_exports.OpenHardKeyboardSettings]: 15
  };

  // node_modules/@yume-chan/scrcpy/esm/2_7/impl/serialize-uhid-create.js
  var UHidCreateControlMessage2 = struct2({
    // value of `type` can change between versions
    type: u82,
    id: u16,
    name: string2(u82),
    data: buffer2(u16)
  }, { littleEndian: false });
  function serializeUHidCreateControlMessage2(message) {
    return UHidCreateControlMessage2.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/index.js
  var impl_exports12 = {};
  __export(impl_exports12, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    CaptureOrientation: () => CaptureOrientation,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes5,
    Crop: () => Crop,
    Defaults: () => Defaults12,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    LockOrientation: () => LockOrientation,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    NewDisplay: () => NewDisplay,
    Orientation: () => Orientation,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage2,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues4,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    overrideAudioSource: () => overrideAudioSource,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseAudioCodecOption: () => parseAudioCodecOption2,
    parseAudioMetadataCodec: () => parseAudioMetadataCodec2,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder3,
    parseVideoCodecOption: () => parseVideoCodecOption,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    parseVideoStreamMetadataAsync: () => parseVideoStreamMetadataAsync,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage2,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage2,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/control-message-types.js
  var ControlMessageTypes5 = {
    [control_message_type_value_exports.InjectKeyCode]: 0,
    [control_message_type_value_exports.InjectText]: 1,
    [control_message_type_value_exports.InjectTouch]: 2,
    [control_message_type_value_exports.InjectScroll]: 3,
    [control_message_type_value_exports.BackOrScreenOn]: 4,
    [control_message_type_value_exports.ExpandNotificationPanel]: 5,
    [control_message_type_value_exports.ExpandSettingPanel]: 6,
    [control_message_type_value_exports.CollapseNotificationPanel]: 7,
    [control_message_type_value_exports.GetClipboard]: 8,
    [control_message_type_value_exports.SetClipboard]: 9,
    [control_message_type_value_exports.SetDisplayPower]: 10,
    [control_message_type_value_exports.RotateDevice]: 11,
    [control_message_type_value_exports.UHidCreate]: 12,
    [control_message_type_value_exports.UHidInput]: 13,
    [control_message_type_value_exports.UHidDestroy]: 14,
    [control_message_type_value_exports.OpenHardKeyboardSettings]: 15,
    [control_message_type_value_exports.StartApp]: 16,
    [control_message_type_value_exports.ResetVideo]: 17
  };

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/defaults.js
  var Defaults12 = /* @__PURE__ */ (() => ({
    ...omit(impl_exports11.Defaults, "lockVideoOrientation"),
    captureOrientation: void 0,
    angle: 0,
    screenOffTimeout: void 0,
    listApps: false,
    newDisplay: void 0,
    vdSystemDecorations: true
  }))();

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/init.js
  var LockOrientation = {
    Unlocked: 0,
    LockedInitial: 1,
    LockedValue: 2
  };
  var Orientation = {
    Orient0: 0,
    Orient90: 90,
    Orient180: 180,
    Orient270: 270
  };
  var CaptureOrientation = class _CaptureOrientation {
    static Unlocked = /* @__PURE__ */ (() => new _CaptureOrientation(LockOrientation.Unlocked, Orientation.Orient0, false))();
    lock;
    orientation;
    flip;
    constructor(lock, orientation, flip = false) {
      this.lock = lock;
      this.orientation = orientation;
      this.flip = flip;
    }
    toOptionValue() {
      if (this.lock === LockOrientation.Unlocked && this.orientation === Orientation.Orient0 && !this.flip) {
        return void 0;
      }
      if (this.lock === LockOrientation.LockedInitial) {
        return "@";
      }
      return (this.lock === LockOrientation.LockedValue ? "@" : "") + (this.flip ? "flip" : "") + this.orientation;
    }
  };
  var NewDisplay = class _NewDisplay {
    static Default = /* @__PURE__ */ new _NewDisplay();
    width;
    height;
    dpi;
    constructor(a, b, c) {
      if (a === void 0) {
        return;
      }
      if (b === void 0) {
        this.dpi = a;
        return;
      }
      this.width = a;
      this.height = b;
      this.dpi = c;
    }
    toOptionValue() {
      if (this.width === void 0 && this.height === void 0 && this.dpi === void 0) {
        return "";
      }
      if (this.width === void 0) {
        return `/${this.dpi}`;
      }
      if (this.dpi === void 0) {
        return `${this.width}x${this.height}`;
      }
      return `${this.width}x${this.height}/${this.dpi}`;
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/parse-encoder.js
  var EncoderRegex5 = /^\s+--(video|audio)-codec=(\S+)\s+--\1-encoder=(\S+)(?:\s*\((sw|hw|hybrid)\))?(?:\s*\[vendor\])?(?:\s*\(alias for (\S+)\))?$/;
  function toHardwareType(value) {
    switch (value) {
      case "sw":
        return "software";
      case "hw":
        return "hardware";
      case "hybrid":
        return "hybrid";
      default:
        throw new Error(`Unknown hardware type: ${value}`);
    }
  }
  function parseEncoder3(line) {
    const match = line.match(EncoderRegex5);
    return match ? {
      type: match[1],
      name: match[3],
      codec: match[2],
      hardwareType: match[4] ? toHardwareType(match[4]) : void 0,
      vendor: !!match[5],
      aliasFor: match[6]
    } : void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/set-display-power.js
  var SetDisplayPowerControlMessage2 = struct2({
    // value of `type` can change between versions
    type: u82,
    on: u82()
  }, { littleEndian: false });
  function serializeSetDisplayPowerControlMessage2(message) {
    return SetDisplayPowerControlMessage2.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/3_1/impl/index.js
  var impl_exports13 = {};
  __export(impl_exports13, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    CaptureOrientation: () => CaptureOrientation,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes5,
    Crop: () => Crop,
    Defaults: () => Defaults13,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    LockOrientation: () => LockOrientation,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    NewDisplay: () => NewDisplay,
    Orientation: () => Orientation,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage3,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues4,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    overrideAudioSource: () => overrideAudioSource,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseAudioCodecOption: () => parseAudioCodecOption2,
    parseAudioMetadataCodec: () => parseAudioMetadataCodec2,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder3,
    parseVideoCodecOption: () => parseVideoCodecOption,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    parseVideoStreamMetadataAsync: () => parseVideoStreamMetadataAsync,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage2,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage3,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/3_1/impl/defaults.js
  var Defaults13 = {
    ...impl_exports12.Defaults,
    vdDestroyContent: false
  };

  // node_modules/@yume-chan/scrcpy/esm/3_1/impl/serialize-uhid-create.js
  var UHidCreateControlMessage3 = struct2({
    // value of `type` can change between versions
    type: u82,
    id: u16,
    vendorId: u16,
    productId: u16,
    name: string2(u82),
    data: buffer2(u16)
  }, { littleEndian: false });
  function serializeUHidCreateControlMessage3(message) {
    return UHidCreateControlMessage3.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/3_2/impl/index.js
  var impl_exports14 = {};
  __export(impl_exports14, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    CaptureOrientation: () => CaptureOrientation,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes5,
    Crop: () => Crop,
    Defaults: () => Defaults14,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    LockOrientation: () => LockOrientation,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    NewDisplay: () => NewDisplay,
    Orientation: () => Orientation,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage3,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues4,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    overrideAudioSource: () => overrideAudioSource,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseAudioCodecOption: () => parseAudioCodecOption2,
    parseAudioMetadataCodec: () => parseAudioMetadataCodec2,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder3,
    parseVideoCodecOption: () => parseVideoCodecOption,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    parseVideoStreamMetadataAsync: () => parseVideoStreamMetadataAsync,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage2,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage3,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/3_2/impl/defaults.js
  var Defaults14 = {
    ...impl_exports13.Defaults,
    displayImePolicy: void 0
  };

  // node_modules/@yume-chan/scrcpy/esm/3_3_1/impl/index.js
  var impl_exports15 = {};
  __export(impl_exports15, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    CaptureOrientation: () => CaptureOrientation,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes5,
    Crop: () => Crop,
    Defaults: () => Defaults14,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    LockOrientation: () => LockOrientation,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    NewDisplay: () => NewDisplay,
    Orientation: () => Orientation,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController4,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage3,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues4,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController4,
    overrideAudioSource: () => overrideAudioSource,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseAudioCodecOption: () => parseAudioCodecOption2,
    parseAudioMetadataCodec: () => parseAudioMetadataCodec2,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder3,
    parseVideoCodecOption: () => parseVideoCodecOption,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    parseVideoStreamMetadataAsync: () => parseVideoStreamMetadataAsync,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage2,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage3,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/3_3_1/impl/scroll-controller.js
  var ScrollController4 = class {
    serializeScrollMessage(message) {
      message = {
        ...message,
        scrollX: message.scrollX / 16,
        scrollY: message.scrollY / 16
      };
      return impl_exports14.InjectScrollControlMessage.serialize(message);
    }
  };
  function createScrollController4() {
    return new ScrollController4();
  }

  // node_modules/@yume-chan/scrcpy/esm/4_0/impl/index.js
  var impl_exports16 = {};
  __export(impl_exports16, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    CaptureOrientation: () => CaptureOrientation,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes6,
    Crop: () => Crop,
    Defaults: () => Defaults15,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    LockOrientation: () => LockOrientation,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    NewDisplay: () => NewDisplay,
    Orientation: () => Orientation,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SetDisplayPowerControlMessage: () => SetDisplayPowerControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage3,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoCodecOptions: () => VideoCodecOptions,
    VideoOrientation: () => VideoOrientation2,
    computeOptionValues: () => computeOptionValues5,
    createMediaStreamTransformer: () => createMediaStreamTransformer3,
    createScrollController: () => createScrollController3,
    overrideAudioSource: () => overrideAudioSource,
    overrideClipboardAutosync: () => overrideClipboardAutosync,
    parseAudioCodecOption: () => parseAudioCodecOption2,
    parseAudioMetadataCodec: () => parseAudioMetadataCodec2,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder3,
    parseVideoCodecOption: () => parseVideoCodecOption,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    parseVideoStreamMetadataAsync: () => parseVideoStreamMetadataAsync2,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage2,
    serializeSetDisplayPowerControlMessage: () => serializeSetDisplayPowerControlMessage2,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage3,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/4_0/impl/compute-option-values.js
  function computeOptionValues5(options, defaults) {
    const value = computeOptionValues(options, defaults);
    impl_exports15.overrideClipboardAutosync(value);
    impl_exports15.overrideAudioSource(value);
    return value;
  }

  // node_modules/@yume-chan/scrcpy/esm/4_0/impl/control-message-types.js
  var ControlMessageTypes6 = {
    [control_message_type_value_exports.InjectKeyCode]: 0,
    [control_message_type_value_exports.InjectText]: 1,
    [control_message_type_value_exports.InjectTouch]: 2,
    [control_message_type_value_exports.InjectScroll]: 3,
    [control_message_type_value_exports.BackOrScreenOn]: 4,
    [control_message_type_value_exports.ExpandNotificationPanel]: 5,
    [control_message_type_value_exports.ExpandSettingPanel]: 6,
    [control_message_type_value_exports.CollapseNotificationPanel]: 7,
    [control_message_type_value_exports.GetClipboard]: 8,
    [control_message_type_value_exports.SetClipboard]: 9,
    [control_message_type_value_exports.SetDisplayPower]: 10,
    [control_message_type_value_exports.RotateDevice]: 11,
    [control_message_type_value_exports.UHidCreate]: 12,
    [control_message_type_value_exports.UHidInput]: 13,
    [control_message_type_value_exports.UHidDestroy]: 14,
    [control_message_type_value_exports.OpenHardKeyboardSettings]: 15,
    [control_message_type_value_exports.StartApp]: 16,
    [control_message_type_value_exports.ResetVideo]: 17,
    [control_message_type_value_exports.CameraSetTorch]: 18,
    [control_message_type_value_exports.CameraZoomIn]: 19,
    [control_message_type_value_exports.CameraZoomOut]: 20,
    [control_message_type_value_exports.ResizeDisplay]: 21
  };

  // node_modules/@yume-chan/scrcpy/esm/4_0/impl/defaults.js
  var Defaults15 = /* @__PURE__ */ (() => ({
    ...omit(impl_exports15.Defaults, "sendCodecMeta"),
    minSizeAlignment: 1,
    cameraZoom: 1,
    cameraTorch: false,
    flexDisplay: false,
    keepActive: false,
    sendStreamMeta: true
  }))();

  // node_modules/@yume-chan/scrcpy/esm/4_0/impl/media-stream-transformer.js
  function createMediaStreamTransformer3(options) {
    if (!options.sendFrameMeta) {
      return new TransformStream3({
        transform(chunk, controller) {
          controller.enqueue({
            type: "data",
            data: chunk
          });
        }
      });
    }
    return new BufferedTransformStream2(async (buffered) => {
      const header = await buffered.readExactly(12);
      if (header[0] & 128) {
        return {
          type: "session",
          isClientResize: !!(header[0] & 1),
          width: getUint32BigEndian(header, 4),
          height: getUint32BigEndian(header, 8)
        };
      }
      if (header[0] & 64) {
        return {
          type: "configuration",
          data: await buffered.readExactly(getUint32BigEndian(header, 8))
        };
      }
      return {
        type: "data",
        keyframe: !!(header[0] & 32),
        pts: getUint64BigEndian2(header, 0) & 0x1fffffffffffffffn,
        data: await buffered.readExactly(getUint32BigEndian(header, 8))
      };
    });
  }

  // node_modules/@yume-chan/scrcpy/esm/4_0/impl/parse-video-stream-metadata.js
  async function parseVideoStreamMetadataAsync2(stream, sendDeviceMeta, sendStreamMeta, fallbackCodec) {
    const buffered = new BufferedReadableStream2(stream);
    let deviceName;
    if (sendDeviceMeta) {
      deviceName = await impl_exports15.readString(buffered, 64);
    }
    let codec;
    if (sendStreamMeta) {
      codec = await impl_exports15.readU32(buffered);
    } else {
      codec = fallbackCodec;
    }
    return {
      stream: buffered.release(),
      metadata: { deviceName, codec }
    };
  }

  // node_modules/@yume-chan/scrcpy/esm/4_1/impl/control-message-types.js
  var ControlMessageTypes7 = {
    [control_message_type_value_exports.InjectKeyCode]: 0,
    [control_message_type_value_exports.InjectText]: 1,
    [control_message_type_value_exports.InjectTouch]: 2,
    [control_message_type_value_exports.InjectScroll]: 3,
    [control_message_type_value_exports.BackOrScreenOn]: 4,
    [control_message_type_value_exports.ExpandNotificationPanel]: 5,
    [control_message_type_value_exports.ExpandSettingPanel]: 6,
    [control_message_type_value_exports.CollapseNotificationPanel]: 7,
    [control_message_type_value_exports.GetClipboard]: 8,
    [control_message_type_value_exports.SetClipboard]: 9,
    [control_message_type_value_exports.SetDisplayPower]: 10,
    [control_message_type_value_exports.RotateDevice]: 11,
    [control_message_type_value_exports.UHidCreate]: 12,
    [control_message_type_value_exports.UHidInput]: 13,
    [control_message_type_value_exports.UHidDestroy]: 14,
    [control_message_type_value_exports.OpenHardKeyboardSettings]: 15,
    [control_message_type_value_exports.StartApp]: 16,
    [control_message_type_value_exports.ResetVideo]: 17,
    [control_message_type_value_exports.CameraSetTorch]: 18,
    [control_message_type_value_exports.CameraZoomIn]: 19,
    [control_message_type_value_exports.CameraZoomOut]: 20,
    [control_message_type_value_exports.ResizeDisplay]: 21,
    [control_message_type_value_exports.ScanFile]: 22
  };

  // node_modules/@yume-chan/scrcpy/esm/4_1/impl/defaults.js
  var Defaults16 = {
    ...impl_exports16.Defaults,
    ignoreVideoEncoderConstraints: false
  };

  // node_modules/@yume-chan/scrcpy/esm/4_1/impl/parse-video-stream-metadata.js
  function parseVideoCodecOption2(codec) {
    switch (codec) {
      case "h264":
        return codec_id_exports.H264;
      case "h265":
        return codec_id_exports.H265;
      case "av1":
        return codec_id_exports.Av1;
      case "vp8":
        return codec_id_exports.Vp8;
      case "vp9":
        return codec_id_exports.Vp9;
      default:
        throw new Error(`Unknown video codec: ${codec}`);
    }
  }

  // node_modules/@yume-chan/scrcpy/esm/4_1/index.js
  var ScrcpyOptions4_1 = class {
    static Defaults = Defaults16;
    value;
    get controlMessageTypes() {
      return ControlMessageTypes7;
    }
    #clipboard;
    get clipboard() {
      return this.#clipboard;
    }
    #ackClipboardHandler;
    #uHidOutput;
    get uHidOutput() {
      return this.#uHidOutput;
    }
    #deviceMessageParsers = new ScrcpyDeviceMessageParsers();
    get deviceMessageParsers() {
      return this.#deviceMessageParsers;
    }
    constructor(init) {
      this.value = computeOptionValues5(init, Defaults16);
      if (this.value.control) {
        if (this.value.clipboardAutosync) {
          this.#clipboard = this.#deviceMessageParsers.add(new ClipboardStream());
        }
        this.#ackClipboardHandler = this.#deviceMessageParsers.add(new AckClipboardHandler());
        this.#uHidOutput = this.#deviceMessageParsers.add(new UHidOutputStream());
      }
    }
    serialize() {
      return serialize2(this.value, Defaults16);
    }
    setListDisplays() {
      setListDisplays2(this.value);
    }
    parseDisplay(line) {
      return parseDisplay3(line);
    }
    setListEncoders() {
      setListEncoders2(this.value);
    }
    parseEncoder(line) {
      return parseEncoder3(line);
    }
    parseVideoStreamMetadata(stream) {
      return parseVideoStreamMetadata3(stream, this.value.sendDeviceMeta, this.value.sendStreamMeta, parseVideoCodecOption2(this.value.videoCodec), parseVideoStreamMetadataAsync2);
    }
    parseAudioStreamMetadata(stream) {
      return parseAudioStreamMetadata(stream, this.value.sendStreamMeta, parseAudioMetadataCodec2, parseAudioCodecOption2(this.value.audioCodec));
    }
    createMediaStreamTransformer() {
      return createMediaStreamTransformer3(this.value);
    }
    serializeInjectTouchControlMessage(message) {
      if (!this.value.control) {
        throw new Error("control is disabled");
      }
      return serializeInjectTouchControlMessage2(message);
    }
    serializeBackOrScreenOnControlMessage(message) {
      if (!this.value.control) {
        throw new Error("control is disabled");
      }
      return serializeBackOrScreenOnControlMessage2(message);
    }
    serializeSetClipboardControlMessage(message) {
      if (!this.value.control) {
        throw new Error("control is disabled");
      }
      return serializeSetClipboardControlMessage2(message, this.#ackClipboardHandler);
    }
    serializeSetDisplayPowerControlMessage(message) {
      if (!this.value.control) {
        throw new Error("control is disabled");
      }
      return serializeSetDisplayPowerControlMessage2(message);
    }
    createScrollController() {
      if (!this.value.control) {
        throw new Error("control is disabled");
      }
      return createScrollController3();
    }
    serializeUHidCreateControlMessage(message) {
      if (!this.value.control) {
        throw new Error("control is disabled");
      }
      return serializeUHidCreateControlMessage3(message);
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/struct/esm/bipedal.js
  function advance3(iterator, next) {
    while (true) {
      const { done, value } = iterator.next(next);
      if (done) {
        return value;
      }
      if (isPromiseLike(value)) {
        return value.then((value2) => advance3(iterator, { resolved: value2 }), (error) => advance3(iterator, { error }));
      }
      next = value;
    }
  }
  // @__NO_SIDE_EFFECTS__
  function bipedal3(fn, bindThis) {
    function result(...args) {
      const iterator = fn.call(this, function* (value) {
        if (isPromiseLike(value)) {
          const result2 = yield value;
          if ("resolved" in result2) {
            return result2.resolved;
          } else {
            throw result2.error;
          }
        }
        return value;
      }, ...args);
      return advance3(iterator, void 0);
    }
    if (bindThis) {
      return result.bind(bindThis);
    } else {
      return result;
    }
  }

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/struct/esm/readable.js
  var ExactReadableEndedErrorBrand2 = /* @__PURE__ */ Symbol.for("ExactReadableEndedError.brand");
  var ExactReadableEndedError3 = class extends Error {
    [ExactReadableEndedErrorBrand2] = true;
    static [Symbol.hasInstance](value) {
      return !!value?.[ExactReadableEndedErrorBrand2];
    }
    constructor() {
      super("ExactReadable ended");
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/stream-extra/esm/global/utils.js
  // @__NO_SIDE_EFFECTS__
  function getGlobalValue2(key) {
    return globalThis[key];
  }

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/stream-extra/esm/global/abort-signal.js
  var AbortSignal2 = getGlobalValue2("AbortSignal");
  var AbortController3 = getGlobalValue2("AbortController");

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/stream-extra/esm/global/encoding.js
  var TextDecoderStream2 = getGlobalValue2("TextDecoderStream");
  var TextEncoderStream2 = getGlobalValue2("TextEncoderStream");

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/stream-extra/esm/try-close.js
  async function tryCancel3(stream) {
    try {
      await stream.cancel();
      return true;
    } catch {
      return false;
    }
  }

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/stream-extra/esm/global/streams.js
  var ByteLengthQueuingStrategy2 = getGlobalValue2("ByteLengthQueuingStrategy");
  var CountQueuingStrategy2 = getGlobalValue2("CountQueuingStrategy");
  var ReadableStream4 = /* @__PURE__ */ (() => {
    const ReadableStream5 = getGlobalValue2("ReadableStream");
    if (!ReadableStream5.from) {
      ReadableStream5.from = function(iterable) {
        const iterator = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
        return new ReadableStream5({
          async pull(controller) {
            const result = await iterator.next();
            if (result.done) {
              controller.close();
              return;
            }
            controller.enqueue(result.value);
          },
          async cancel(reason) {
            await iterator.return?.(reason);
          }
        });
      };
    }
    if (!ReadableStream5.prototype[Symbol.asyncIterator] || !ReadableStream5.prototype.values) {
      ReadableStream5.prototype.values = async function* (options) {
        const reader = this.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              return;
            }
            yield value;
          }
        } finally {
          if (!options?.preventCancel) {
            await tryCancel3(reader);
          }
          reader.releaseLock();
        }
      };
      ReadableStream5.prototype[Symbol.asyncIterator] = // eslint-disable-next-line @typescript-eslint/unbound-method
      ReadableStream5.prototype.values;
    }
    return ReadableStream5;
  })();
  var ReadableStreamBYOBReader2 = getGlobalValue2("ReadableStreamBYOBReader");
  var ReadableStreamDefaultReader2 = getGlobalValue2("ReadableStreamDefaultReader");
  var TransformStream4 = getGlobalValue2("TransformStream");
  var WritableStream3 = getGlobalValue2("WritableStream");
  var WritableStreamDefaultWriter2 = getGlobalValue2("WritableStreamDefaultWriter");

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/stream-extra/esm/task-queue.js
  var TaskQueue3 = class {
    #ready;
    #disposed = false;
    enqueue(task, bail = false) {
      if (this.#disposed) {
        throw new Error("TaskQueue is disposed");
      }
      if (!this.#ready) {
        try {
          const result2 = task();
          if (isPromiseLike(result2)) {
            this.#ready = result2.then(() => {
            }, (e) => {
              if (bail) {
                throw e;
              }
            });
          }
          return result2;
        } catch (e) {
          if (bail) {
            const promise = Promise.reject(e);
            void promise.catch(() => {
            });
            this.#ready = promise;
          }
          throw e;
        }
      }
      const result = this.#ready.then(() => {
        if (this.#disposed) {
          throw new Error("TaskQueue is disposed");
        }
        return task();
      });
      this.#ready = result.then(() => {
      }, (e) => {
        if (bail || this.#disposed) {
          throw e;
        }
      });
      return result;
    }
    dispose() {
      this.#disposed = true;
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/stream-extra/esm/push-readable.js
  var PushReadableStream3 = class extends ReadableStream4 {
    /**
     * Create a new `PushReadableStream` from a source.
     *
     * @param source If `source` returns a `Promise`, the stream will be closed
     * when the `Promise` is resolved, and be errored when the `Promise` is rejected.
     * @param strategy
     */
    constructor(source, strategy, logger) {
      let controller;
      const tasks = new TaskQueue3();
      let zeroHighWaterMarkAllowEnqueue = false;
      let waterMarkLow;
      const abortController = new AbortController3();
      let stopped = false;
      const enqueue = (chunk) => {
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "start"
        });
        if (abortController.signal.aborted) {
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "ignored"
          });
          return false;
        }
        if (controller.desiredSize === null) {
          controller.enqueue(chunk);
          throw new Error("unreachable");
        }
        if (zeroHighWaterMarkAllowEnqueue) {
          zeroHighWaterMarkAllowEnqueue = false;
          controller.enqueue(chunk);
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "complete"
          });
          return true;
        }
        if (controller.desiredSize <= 0) {
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "waiting"
          });
          waterMarkLow = new PromiseResolver();
          return waterMarkLow.promise.then(() => {
            controller.enqueue(chunk);
            logger?.({
              source: "producer",
              operation: "enqueue",
              value: chunk,
              phase: "complete"
            });
            return true;
          }, () => {
            logger?.({
              source: "producer",
              operation: "enqueue",
              value: chunk,
              phase: "ignored"
            });
            return false;
          });
        }
        controller.enqueue(chunk);
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "complete"
        });
        return true;
      };
      const close = (explicit) => {
        logger?.({
          source: "producer",
          operation: "close",
          explicit,
          phase: "start"
        });
        if (abortController.signal.aborted || stopped && !explicit) {
          logger?.({
            source: "producer",
            operation: "close",
            explicit,
            phase: "ignored"
          });
          return;
        }
        controller.close();
        stopped = true;
        waterMarkLow?.reject();
        logger?.({
          source: "producer",
          operation: "close",
          explicit,
          phase: "complete"
        });
      };
      const error = (error2, explicit) => {
        logger?.({
          source: "producer",
          operation: "error",
          explicit,
          phase: "start"
        });
        stopped = true;
        controller.error(error2);
        waterMarkLow?.reject();
        logger?.({
          source: "producer",
          operation: "error",
          explicit,
          phase: "complete"
        });
      };
      super({
        start: (controller_) => {
          controller = controller_;
          const result = source({
            abortSignal: abortController.signal,
            enqueue: async (chunk) => (
              // Run `enqueue`s in serial
              // Use `async/await` to always return a `Promise`
              await tasks.enqueue(() => enqueue(chunk))
            ),
            close() {
              close(true);
            },
            error(e) {
              error(e, true);
            }
          });
          if (!stopped && isPromiseLike(result)) {
            result.then(() => close(false), (e) => error(e, false));
          }
        },
        pull: () => {
          logger?.({
            source: "consumer",
            operation: "pull",
            phase: "start"
          });
          if (waterMarkLow) {
            waterMarkLow.resolve(void 0);
            waterMarkLow = void 0;
          } else if (strategy?.highWaterMark === 0) {
            zeroHighWaterMarkAllowEnqueue = true;
          }
          logger?.({
            source: "consumer",
            operation: "pull",
            phase: "complete"
          });
        },
        cancel: (reason) => {
          logger?.({
            source: "consumer",
            operation: "cancel",
            phase: "start"
          });
          stopped = true;
          abortController.abort(reason);
          waterMarkLow?.reject();
          logger?.({
            source: "consumer",
            operation: "cancel",
            phase: "complete"
          });
        }
      }, strategy);
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/stream-extra/esm/buffered.js
  var BufferedReadableStream3 = class {
    #buffered;
    // PERF: `subarray` is slow
    // don't use it until absolutely necessary
    #bufferedOffset = 0;
    #bufferedLength = 0;
    #position = 0;
    get position() {
      return this.#position;
    }
    stream;
    reader;
    constructor(stream) {
      this.stream = stream;
      this.reader = stream.getReader();
    }
    #readBuffered(length) {
      if (!this.#buffered) {
        return void 0;
      }
      const value = this.#buffered.subarray(this.#bufferedOffset, this.#bufferedOffset + length);
      if (this.#bufferedLength > length) {
        this.#position += length;
        this.#bufferedOffset += length;
        this.#bufferedLength -= length;
        return value;
      }
      this.#position += this.#bufferedLength;
      this.#buffered = void 0;
      this.#bufferedOffset = 0;
      this.#bufferedLength = 0;
      return value;
    }
    async #readSource(length) {
      const { done, value } = await this.reader.read();
      if (done) {
        throw new ExactReadableEndedError3();
      }
      if (value.length > length) {
        this.#buffered = value;
        this.#bufferedOffset = length;
        this.#bufferedLength = value.length - length;
        this.#position += length;
        return value.subarray(0, length);
      }
      this.#position += value.length;
      return value;
    }
    iterateExactly(length) {
      let state = this.#buffered ? 0 : 1;
      return {
        next: () => {
          switch (state) {
            case 0: {
              const value = this.#readBuffered(length);
              if (value.length === length) {
                state = 2;
              } else {
                length -= value.length;
                state = 1;
              }
              return { done: false, value };
            }
            case 1:
              state = 3;
              return {
                done: false,
                value: this.#readSource(length).then((value) => {
                  if (value.length === length) {
                    state = 2;
                  } else {
                    length -= value.length;
                    state = 1;
                  }
                  return value;
                })
              };
            case 2:
              return { done: true, value: void 0 };
            case 3:
              throw new Error("Can't call `next` before previous Promise resolves");
            default:
              throw new Error("unreachable");
          }
        }
      };
    }
    readExactly = bipedal3(function* (then, length) {
      let result;
      let index = 0;
      const initial = this.#readBuffered(length);
      if (initial) {
        if (initial.length === length) {
          return initial;
        }
        result = new Uint8Array(length);
        result.set(initial, index);
        index += initial.length;
        length -= initial.length;
      } else {
        result = new Uint8Array(length);
      }
      while (length > 0) {
        const value = yield* then(this.#readSource(length));
        result.set(value, index);
        index += value.length;
        length -= value.length;
      }
      return result;
    });
    /**
     * Return a readable stream with unconsumed data (if any) and
     * all data from the wrapped stream.
     * @returns A `ReadableStream`
     */
    release() {
      if (this.#bufferedLength > 0) {
        return new PushReadableStream3(async (controller) => {
          const buffered = this.#buffered.subarray(this.#bufferedOffset);
          await controller.enqueue(buffered);
          controller.abortSignal.addEventListener("abort", () => {
            void tryCancel3(this.reader);
          });
          while (true) {
            const { done, value } = await this.reader.read();
            if (done) {
              return;
            }
            await controller.enqueue(value);
          }
        });
      } else {
        this.reader.releaseLock();
        return this.stream;
      }
    }
    async cancel(reason) {
      await this.reader.cancel(reason);
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/stream-extra/esm/inspect.js
  var InspectStream = class extends TransformStream4 {
    constructor(write, extras) {
      super({
        async transform(chunk, controller) {
          await write(chunk);
          controller.enqueue(chunk);
        },
        flush() {
          extras?.close?.();
        },
        cancel() {
          extras?.cancel?.();
        }
      });
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/stream-extra/esm/split-string.js
  var SplitStringStream = class extends TransformStream4 {
    constructor(separator, options) {
      let remaining = void 0;
      const separatorLength = separator.length;
      if (separatorLength === 0) {
        throw new Error("separator must not be empty");
      }
      const trim = !!options?.trim;
      const trimEnd = !!options?.trimEnd;
      const skipEmpty = !!options?.skipEmpty;
      const enqueue = (controller, value) => {
        if (trim) {
          value = value.trim();
        } else if (trimEnd) {
          value = value.trimEnd();
        }
        if (value || !skipEmpty) {
          controller.enqueue(value);
        }
      };
      super({
        transform(chunk, controller) {
          if (remaining !== void 0) {
            chunk = remaining + chunk;
            remaining = void 0;
          }
          let start = 0;
          while (start < chunk.length) {
            const index = chunk.indexOf(separator, start);
            if (index === -1) {
              remaining = chunk.substring(start);
              break;
            }
            const value = chunk.substring(start, index);
            enqueue(controller, value);
            start = index + separatorLength;
          }
        },
        flush(controller) {
          if (remaining !== void 0) {
            enqueue(controller, remaining);
          }
        }
      });
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/adb/esm/service/reverse/error.js
  var AdbReverseErrorBrand = /* @__PURE__ */ Symbol.for("AdbReverseError.brand");
  var AdbReverseError2 = class extends Error {
    [AdbReverseErrorBrand] = true;
    static [Symbol.hasInstance](value) {
      return !!value?.[AdbReverseErrorBrand];
    }
    constructor(message) {
      super(message);
    }
  };
  var AdbReverseNotSupportedErrorBrand = /* @__PURE__ */ Symbol.for("AdbReverseNotSupportedError.brand");
  var AdbReverseNotSupportedError2 = class extends AdbReverseError2 {
    [AdbReverseNotSupportedErrorBrand] = true;
    static [Symbol.hasInstance](value) {
      return !!value?.[AdbReverseNotSupportedErrorBrand];
    }
    constructor() {
      super("ADB reverse tunnel is not supported on this device when connected wirelessly.");
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/node_modules/@yume-chan/adb/esm/utils/no-op.js
  var NOOP3 = /* @__NO_SIDE_EFFECTS__ */ () => {
  };

  // node_modules/@yume-chan/adb-scrcpy/esm/connection.js
  var SCRCPY_SOCKET_NAME_PREFIX = "scrcpy";
  var AdbScrcpyConnection = class {
    adb;
    options;
    socketName;
    constructor(adb, options) {
      this.adb = adb;
      this.options = options;
      this.socketName = this.getSocketName();
    }
    initialize() {
    }
    getSocketName() {
      let socketName = "localabstract:" + SCRCPY_SOCKET_NAME_PREFIX;
      if (this.options.scid !== void 0) {
        socketName += "_" + this.options.scid.padStart(8, "0");
      }
      return socketName;
    }
    dispose() {
    }
  };
  var AdbScrcpyForwardConnection = class extends AdbScrcpyConnection {
    #disposed = false;
    #connect() {
      return this.adb.createSocket(this.socketName);
    }
    async #connectAndRetry(sendDummyByte) {
      for (let i = 0; !this.#disposed && i < 100; i += 1) {
        try {
          const stream = await this.#connect();
          if (sendDummyByte) {
            const buffered = new BufferedReadableStream3(stream.readable);
            await buffered.readExactly(1);
            return {
              readable: buffered.release(),
              writable: stream.writable
            };
          }
          return stream;
        } catch {
          await delay(100);
        }
      }
      throw new Error(`Can't connect to server after 100 retries`);
    }
    async getStreams() {
      let { sendDummyByte } = this.options;
      const streams = {};
      if (this.options.video) {
        const stream = await this.#connectAndRetry(sendDummyByte);
        streams.video = stream.readable;
        sendDummyByte = false;
      }
      if (this.options.audio) {
        const stream = await this.#connectAndRetry(sendDummyByte);
        streams.audio = stream.readable;
        sendDummyByte = false;
      }
      if (this.options.control) {
        const stream = await this.#connectAndRetry(sendDummyByte);
        streams.control = stream;
      }
      return streams;
    }
    dispose() {
      this.#disposed = true;
    }
  };
  var AdbScrcpyReverseConnection = class extends AdbScrcpyConnection {
    #streams;
    #address;
    async initialize() {
      await this.adb.reverse.remove(this.socketName).catch((e) => {
        if (e instanceof AdbReverseNotSupportedError2) {
          throw e;
        }
      });
      let queueController;
      const queue = new PushReadableStream3((controller) => {
        queueController = controller;
      });
      this.#streams = queue.getReader();
      this.#address = await this.adb.reverse.add(this.socketName, async (socket) => {
        await queueController.enqueue(socket);
      });
    }
    async #accept() {
      return (await this.#streams.read()).value;
    }
    async getStreams() {
      const streams = {};
      if (this.options.video) {
        const stream = await this.#accept();
        streams.video = stream.readable;
      }
      if (this.options.audio) {
        const stream = await this.#accept();
        streams.audio = stream.readable;
      }
      if (this.options.control) {
        const stream = await this.#accept();
        streams.control = stream;
      }
      return streams;
    }
    dispose() {
      this.adb.reverse.remove(this.#address).catch(NOOP3);
    }
  };

  // node_modules/@yume-chan/media-codec/esm/format.js
  function hexDigits(value) {
    if (value % 1 !== 0) {
      throw new Error("Value must be an integer");
    }
    if (value < 0) {
      throw new Error("Value must be positive");
    }
    return value.toString(16).toUpperCase();
  }
  function hexTwoDigits(value) {
    if (value % 1 !== 0) {
      throw new Error("Value must be an integer");
    }
    if (value < 0) {
      throw new Error("Value must be positive");
    }
    if (value >= 256) {
      throw new Error("Value must be less than 256");
    }
    if (value < 16) {
      return "0" + value.toString(16).toUpperCase();
    }
    return value.toString(16).toUpperCase();
  }
  function decimalTwoDigits(value) {
    if (value % 1 !== 0) {
      throw new Error("Value must be an integer");
    }
    if (value < 0) {
      throw new Error("Value must be positive");
    }
    if (value >= 100) {
      throw new Error("Value must be less than 256");
    }
    if (value < 10) {
      return "0" + value.toString(10);
    }
    return value.toString(10);
  }

  // node_modules/@yume-chan/media-codec/esm/av1.js
  var AndroidAv1Profile = {
    Main8: 1 << 0,
    Main10: 1 << 1,
    Main10Hdr10: 1 << 12,
    Main10Hdr10Plus: 1 << 13
  };
  var AndroidAv1Level = {
    Level2: 1 << 0,
    Level21: 1 << 1,
    Level22: 1 << 2,
    Level23: 1 << 3,
    Level3: 1 << 4,
    Level31: 1 << 5,
    Level32: 1 << 6,
    Level33: 1 << 7,
    Level4: 1 << 8,
    Level41: 1 << 9,
    Level42: 1 << 10,
    Level43: 1 << 11,
    Level5: 1 << 12,
    Level51: 1 << 13,
    Level52: 1 << 14,
    Level53: 1 << 15,
    Level6: 1 << 16,
    Level61: 1 << 17,
    Level62: 1 << 18,
    Level63: 1 << 19,
    Level7: 1 << 20,
    Level71: 1 << 21,
    Level72: 1 << 22,
    Level73: 1 << 23
  };
  var BitReader = class {
    #data;
    #byte;
    #bytePosition = 0;
    #bitPosition = 7;
    get byteAligned() {
      return this.#bitPosition === 7;
    }
    get ended() {
      return this.#bytePosition >= this.#data.length;
    }
    constructor(data) {
      this.#data = data;
      this.#byte = data[0];
    }
    f1() {
      const value = this.#byte >> this.#bitPosition;
      this.#bitPosition -= 1;
      if (this.#bitPosition < 0) {
        this.#bytePosition += 1;
        this.#bitPosition = 7;
        this.#byte = this.#data[this.#bytePosition];
      }
      return value & 1;
    }
    f(n) {
      let value = 0;
      for (; n > 0; n -= 1) {
        value <<= 1;
        value |= this.f1();
      }
      return value;
    }
    skip(n) {
      if (n <= this.#bitPosition + 1) {
        this.#bytePosition += 1;
        this.#bitPosition = 7;
        this.#byte = this.#data[this.#bytePosition];
        return;
      }
      n -= this.#bitPosition + 1;
      this.#bytePosition += 1;
      const bytes = n / 8 | 0;
      if (bytes > 0) {
        this.#bytePosition += bytes;
        n -= bytes * 8;
      }
      this.#bitPosition = 7 - n;
      this.#byte = this.#data[this.#bytePosition];
    }
    readBytes(n) {
      if (!this.byteAligned) {
        throw new Error("Bytes must be byte-aligned");
      }
      const value = this.#data.subarray(this.#bytePosition, this.#bytePosition + n);
      this.#bytePosition += n;
      this.#byte = this.#data[this.#bytePosition];
      return value;
    }
    getPosition() {
      return [this.#bytePosition, this.#bitPosition];
    }
    setPosition([bytePosition, bitPosition]) {
      this.#bytePosition = bytePosition;
      this.#bitPosition = bitPosition;
      this.#byte = this.#data[bytePosition];
    }
  };
  var ObuType = {
    SequenceHeader: 1,
    TemporalDelimiter: 2,
    FrameHeader: 3,
    TileGroup: 4,
    Metadata: 5,
    Frame: 6,
    RedundantFrameHeader: 7,
    TileList: 8,
    Padding: 15
  };
  var ColorPrimaries = {
    Bt709: 1,
    Unspecified: 2,
    Bt470M: 4,
    Bt470BG: 5,
    Bt601: 6,
    Smpte240: 7,
    GenericFilm: 8,
    Bt2020: 9,
    Xyz: 10,
    Smpte431: 11,
    Smpte432: 12,
    Ebu3213: 22
  };
  var TransferCharacteristics = {
    Bt709: 1,
    Unspecified: 2,
    Bt470M: 4,
    Bt470BG: 5,
    Bt601: 6,
    Smpte240: 7,
    Linear: 8,
    Log100: 9,
    Log100Sqrt10: 10,
    Iec61966: 11,
    Bt1361: 12,
    Srgb: 13,
    Bt2020Ten: 14,
    Bt2020Twelve: 15,
    Smpte2084: 16,
    Smpte428: 17,
    Hlg: 18
  };
  var MatrixCoefficients = {
    Identity: 0,
    Bt709: 1,
    Unspecified: 2,
    Fcc: 4,
    Bt470BG: 5,
    Bt601: 6,
    Smpte240: 7,
    YCgCo: 8,
    Bt2020Ncl: 9,
    Bt2020Cl: 10,
    Smpte2085: 11,
    ChromatNcl: 12,
    ChromatCl: 13,
    ICtCp: 14
  };
  var Av12 = class _Av1 extends BitReader {
    static ObuType = ObuType;
    static ColorPrimaries = ColorPrimaries;
    static TransferCharacteristics = TransferCharacteristics;
    static MatrixCoefficients = MatrixCoefficients;
    /**
     * Generate a codec string from an AV1 sequence header
     * per Section 5 of AV1 Codec ISO Media File Format Binding
     * https://aomediacodec.github.io/av1-isobmff/#codecsparam
     * @param sequenceHeader The parsed AV1 sequence header
     * @returns A codec string
     */
    static toCodecString(sequenceHeader) {
      const { seq_profile: seqProfile, seq_level_idx: [seqLevelIdx = 0], color_config: { BitDepth, mono_chrome: monoChrome, subsampling_x: subsamplingX, subsampling_y: subsamplingY, chroma_sample_position: chromaSamplePosition, color_description_present_flag } } = sequenceHeader;
      let colorPrimaries;
      let transferCharacteristics;
      let matrixCoefficients;
      let colorRange;
      if (color_description_present_flag) {
        ({
          color_primaries: colorPrimaries,
          transfer_characteristics: transferCharacteristics,
          matrix_coefficients: matrixCoefficients,
          color_range: colorRange
        } = sequenceHeader.color_config);
      } else {
        colorPrimaries = _Av1.ColorPrimaries.Bt709;
        transferCharacteristics = _Av1.TransferCharacteristics.Bt709;
        matrixCoefficients = _Av1.MatrixCoefficients.Bt709;
        colorRange = false;
      }
      return [
        "av01",
        seqProfile.toString(16),
        decimalTwoDigits(seqLevelIdx) + (sequenceHeader.seq_tier[0] ? "H" : "M"),
        decimalTwoDigits(BitDepth),
        monoChrome ? "1" : "0",
        (subsamplingX ? "1" : "0") + (subsamplingY ? "1" : "0") + chromaSamplePosition.toString(),
        decimalTwoDigits(colorPrimaries),
        decimalTwoDigits(transferCharacteristics),
        decimalTwoDigits(matrixCoefficients),
        colorRange ? "1" : "0"
      ].join(".");
    }
    #Leb128Bytes = 0;
    uvlc() {
      let leadingZeros = 0;
      while (!this.f1()) {
        leadingZeros += 1;
      }
      if (leadingZeros >= 32) {
        return 2 ** 32 - 1;
      }
      const value = this.f(leadingZeros);
      return value + (1 << leadingZeros >>> 0) - 1;
    }
    leb128() {
      if (!this.byteAligned) {
        throw new Error("LEB128 must be byte-aligned");
      }
      let value = 0n;
      this.#Leb128Bytes = 0;
      for (let i = 0n; i < 8n; i += 1n) {
        const leb128_byte = this.f(8);
        value |= BigInt(leb128_byte & 127) << 7n * i;
        this.#Leb128Bytes += 1;
        if ((leb128_byte & 128) == 0) {
          break;
        }
      }
      return value;
    }
    *annexBBitstream() {
      while (!this.ended) {
        const temporal_unit_size = this.leb128();
        yield* this.temporalUnit(temporal_unit_size);
      }
    }
    *temporalUnit(sz) {
      while (sz > 0) {
        const frame_unit_size = this.leb128();
        sz -= BigInt(this.#Leb128Bytes);
        yield* this.frameUnit(frame_unit_size);
        sz -= frame_unit_size;
      }
    }
    *frameUnit(sz) {
      while (sz > 0) {
        const obu_length = this.leb128();
        sz -= BigInt(this.#Leb128Bytes);
        const obu = this.openBitstreamUnit(obu_length);
        if (obu) {
          yield obu;
        }
        sz -= obu_length;
      }
    }
    #OperatingPointIdc = 0;
    openBitstreamUnit(sz) {
      const obu_header = this.obuHeader();
      let obu_size;
      if (obu_header.obu_has_size_field) {
        obu_size = this.leb128();
      } else if (sz !== void 0) {
        obu_size = sz - 1n - (obu_header.obu_extension_flag ? 1n : 0n);
      } else {
        throw new Error("obu_has_size_field must be true");
      }
      const startPosition = this.getPosition();
      if (obu_header.obu_type !== _Av1.ObuType.SequenceHeader && obu_header.obu_type !== _Av1.ObuType.TemporalDelimiter && this.#OperatingPointIdc !== 0 && obu_header.obu_extension_header) {
        const inTemporalLayer = !!(this.#OperatingPointIdc & 1 << obu_header.obu_extension_header.temporal_id);
        const inSpatialLayer = !!(this.#OperatingPointIdc & 1 << obu_header.obu_extension_header.spatial_id + 8);
        if (!inTemporalLayer || !inSpatialLayer) {
          this.skip(Number(obu_size));
          return;
        }
      }
      let sequence_header_obu;
      switch (obu_header.obu_type) {
        case _Av1.ObuType.SequenceHeader:
          sequence_header_obu = this.sequenceHeaderObu();
          break;
      }
      const currentPosition = this.getPosition();
      const payloadBits = (currentPosition[0] - startPosition[0]) * 8 + (startPosition[1] - currentPosition[1]);
      if (obu_size > 0) {
        this.skip(Number(obu_size) * 8 - payloadBits);
      }
      return {
        obu_header,
        obu_size,
        sequence_header_obu
      };
    }
    obuHeader() {
      const obu_forbidden_bit = !!this.f1();
      if (obu_forbidden_bit) {
        throw new Error("Invalid data");
      }
      const obu_type = this.f(4);
      const obu_extension_flag = !!this.f1();
      const obu_has_size_field = !!this.f1();
      this.f1();
      let obu_extension_header;
      if (obu_extension_flag) {
        obu_extension_header = this.obuExtensionHeader();
      }
      return {
        obu_type,
        obu_extension_flag,
        obu_has_size_field,
        obu_extension_header
      };
    }
    obuExtensionHeader() {
      const temporal_id = this.f(3);
      const spatial_id = this.f(2);
      this.skip(3);
      return { temporal_id, spatial_id };
    }
    static SelectScreenContentTools = 2;
    static SelectIntegerMv = 2;
    sequenceHeaderObu() {
      const seq_profile = this.f(3);
      const still_picture = !!this.f1();
      const reduced_still_picture_header = !!this.f1();
      let timing_info_present_flag = false;
      let timing_info;
      let decoder_model_info_present_flag = false;
      let decoder_model_info;
      let initial_display_delay_present_flag = false;
      let operating_points_cnt_minus_1 = 0;
      const operating_point_idc = [];
      const seq_level_idx = [];
      const seq_tier = [];
      const decoder_model_present_for_this_op = [];
      const initial_display_delay_present_for_this_op = [];
      let operating_parameters_info;
      let initial_display_delay_minus_1;
      if (reduced_still_picture_header) {
        operating_point_idc[0] = 0;
        seq_level_idx[0] = this.f(5);
        seq_tier[0] = 0;
        decoder_model_present_for_this_op[0] = false;
        initial_display_delay_present_for_this_op[0] = false;
      } else {
        timing_info_present_flag = !!this.f1();
        if (timing_info_present_flag) {
          timing_info = this.timingInfo();
          decoder_model_info_present_flag = !!this.f1();
          if (decoder_model_info_present_flag) {
            decoder_model_info = this.decoderModelInfo();
            operating_parameters_info = [];
          }
        }
        initial_display_delay_present_flag = !!this.f1();
        if (initial_display_delay_present_flag) {
          initial_display_delay_minus_1 = [];
        }
        operating_points_cnt_minus_1 = this.f(5);
        for (let i = 0; i <= operating_points_cnt_minus_1; i += 1) {
          operating_point_idc[i] = this.f(12);
          seq_level_idx[i] = this.f(5);
          if (seq_level_idx[i] > 7) {
            seq_tier[i] = this.f1();
          } else {
            seq_tier[i] = 0;
          }
          if (decoder_model_info_present_flag) {
            decoder_model_present_for_this_op[i] = !!this.f1();
            if (decoder_model_present_for_this_op[i]) {
              operating_parameters_info[i] = this.operatingParametersInfo(decoder_model_info);
            }
          } else {
            decoder_model_present_for_this_op[i] = false;
          }
          if (initial_display_delay_present_flag) {
            initial_display_delay_present_for_this_op[i] = !!this.f1();
            if (initial_display_delay_present_for_this_op[i]) {
              initial_display_delay_minus_1[i] = this.f(4);
            }
          }
        }
      }
      const operatingPoint = this.chooseOperatingPoint();
      this.#OperatingPointIdc = operating_point_idc[operatingPoint];
      const frame_width_bits_minus_1 = this.f(4);
      const frame_height_bits_minus_1 = this.f(4);
      const max_frame_width_minus_1 = this.f(frame_width_bits_minus_1 + 1);
      const max_frame_height_minus_1 = this.f(frame_height_bits_minus_1 + 1);
      let frame_id_numbers_present_flag = false;
      let delta_frame_id_length_minus_2;
      let additional_frame_id_length_minus_1;
      if (!reduced_still_picture_header) {
        frame_id_numbers_present_flag = !!this.f1();
        if (frame_id_numbers_present_flag) {
          delta_frame_id_length_minus_2 = this.f(4);
          additional_frame_id_length_minus_1 = this.f(3);
        }
      }
      const use_128x128_superblock = !!this.f1();
      const enable_filter_intra = !!this.f1();
      const enable_intra_edge_filter = !!this.f1();
      let enable_interintra_compound = false;
      let enable_masked_compound = false;
      let enable_warped_motion = false;
      let enable_dual_filter = false;
      let enable_order_hint = false;
      let enable_jnt_comp = false;
      let enable_ref_frame_mvs = false;
      let seq_choose_screen_content_tools = false;
      let seq_force_screen_content_tools = _Av1.SelectScreenContentTools;
      let seq_choose_integer_mv = false;
      let seq_force_integer_mv = _Av1.SelectIntegerMv;
      let order_hint_bits_minus_1;
      if (!reduced_still_picture_header) {
        enable_interintra_compound = !!this.f1();
        enable_masked_compound = !!this.f1();
        enable_warped_motion = !!this.f1();
        enable_dual_filter = !!this.f1();
        enable_order_hint = !!this.f1();
        if (enable_order_hint) {
          enable_jnt_comp = !!this.f1();
          enable_ref_frame_mvs = !!this.f1();
        }
        seq_choose_screen_content_tools = !!this.f1();
        if (!seq_choose_screen_content_tools) {
          seq_force_screen_content_tools = this.f1();
        }
        if (seq_force_screen_content_tools > 0) {
          seq_choose_integer_mv = !!this.f1();
          if (!seq_choose_integer_mv) {
            seq_force_integer_mv = this.f1();
          }
        }
        if (enable_order_hint) {
          order_hint_bits_minus_1 = this.f(3);
        }
      }
      const enable_superres = !!this.f1();
      const enable_cdef = !!this.f1();
      const enable_restoration = !!this.f1();
      const color_config = this.colorConfig(seq_profile);
      const film_grain_params_present = !!this.f1();
      return {
        seq_profile,
        still_picture,
        reduced_still_picture_header,
        timing_info_present_flag,
        timing_info,
        decoder_model_info_present_flag,
        decoder_model_info,
        initial_display_delay_present_flag,
        initial_display_delay_minus_1,
        operating_points_cnt_minus_1,
        operating_point_idc,
        seq_level_idx,
        seq_tier,
        decoder_model_present_for_this_op,
        operating_parameters_info,
        initial_display_delay_present_for_this_op,
        frame_width_bits_minus_1,
        frame_height_bits_minus_1,
        max_frame_width_minus_1,
        max_frame_height_minus_1,
        frame_id_numbers_present_flag,
        delta_frame_id_length_minus_2,
        additional_frame_id_length_minus_1,
        use_128x128_superblock,
        enable_filter_intra,
        enable_intra_edge_filter,
        enable_interintra_compound,
        enable_masked_compound,
        enable_warped_motion,
        enable_dual_filter,
        enable_order_hint,
        enable_jnt_comp,
        enable_ref_frame_mvs,
        seq_choose_screen_content_tools,
        seq_force_screen_content_tools,
        seq_choose_integer_mv,
        seq_force_integer_mv,
        order_hint_bits_minus_1,
        enable_superres,
        enable_cdef,
        enable_restoration,
        color_config,
        film_grain_params_present
      };
    }
    searchSequenceHeaderObu() {
      while (!this.ended) {
        const obu = this.openBitstreamUnit();
        if (!obu) {
          continue;
        }
        if (obu.sequence_header_obu) {
          return obu.sequence_header_obu;
        }
      }
      return void 0;
    }
    timingInfo() {
      const num_units_in_display_tick = this.f(32);
      const time_scale = this.f(32);
      const equal_picture_interval = !!this.f1();
      let num_ticks_per_picture_minus_1;
      if (equal_picture_interval) {
        num_ticks_per_picture_minus_1 = this.uvlc();
      }
      return {
        num_units_in_display_tick,
        time_scale,
        equal_picture_interval,
        num_ticks_per_picture_minus_1
      };
    }
    decoderModelInfo() {
      const buffer_delay_length_minus_1 = this.f(5);
      const num_units_in_decoding_tick = this.f(32);
      const buffer_removal_time_length_minus_1 = this.f(5);
      const frame_presentation_time_length_minus_1 = this.f(5);
      return {
        buffer_delay_length_minus_1,
        num_units_in_decoding_tick,
        buffer_removal_time_length_minus_1,
        frame_presentation_time_length_minus_1
      };
    }
    operatingParametersInfo(decoderModelInfo) {
      const n = decoderModelInfo.buffer_delay_length_minus_1 + 1;
      const decoder_buffer_delay = this.f(n);
      const encoder_buffer_delay = this.f(n);
      const low_delay_mode_flag = !!this.f1();
      return {
        decoder_buffer_delay,
        encoder_buffer_delay,
        low_delay_mode_flag
      };
    }
    chooseOperatingPoint() {
      return 0;
    }
    colorConfig(seq_profile) {
      const high_bitdepth = !!this.f1();
      let twelve_bit = false;
      let BitDepth = 8;
      if (seq_profile === 2 && high_bitdepth) {
        twelve_bit = !!this.f1();
        BitDepth = twelve_bit ? 12 : 10;
      } else if (seq_profile <= 2) {
        BitDepth = high_bitdepth ? 10 : 8;
      }
      let mono_chrome = false;
      if (seq_profile === 1) {
        mono_chrome = !!this.f1();
      }
      const color_description_present_flag = !!this.f1();
      let color_primaries = _Av1.ColorPrimaries.Unspecified;
      let transfer_characteristics = _Av1.TransferCharacteristics.Unspecified;
      let matrix_coefficients = _Av1.MatrixCoefficients.Unspecified;
      if (color_description_present_flag) {
        color_primaries = this.f(8);
        transfer_characteristics = this.f(8);
        matrix_coefficients = this.f(8);
      }
      let color_range;
      let subsampling_x;
      let subsampling_y;
      let chroma_sample_position = 0;
      let separate_uv_delta_q = false;
      if (mono_chrome) {
        color_range = !!this.f1();
        subsampling_x = true;
        subsampling_y = true;
      } else {
        if (color_primaries === _Av1.ColorPrimaries.Bt709 && transfer_characteristics === _Av1.TransferCharacteristics.Srgb && matrix_coefficients === _Av1.MatrixCoefficients.Identity) {
          color_range = true;
          subsampling_x = false;
          subsampling_y = false;
        } else {
          color_range = !!this.f1();
          switch (seq_profile) {
            case 0:
              subsampling_x = true;
              subsampling_y = true;
              break;
            case 1:
              subsampling_x = false;
              subsampling_y = false;
              break;
            default:
              if (BitDepth == 12) {
                subsampling_x = !!this.f1();
                if (subsampling_x) {
                  subsampling_y = !!this.f1();
                } else {
                  subsampling_y = false;
                }
              } else {
                subsampling_x = true;
                subsampling_y = false;
              }
              break;
          }
          if (subsampling_x && subsampling_y) {
            chroma_sample_position = this.f(2);
          }
        }
        separate_uv_delta_q = !!this.f1();
      }
      return {
        high_bitdepth,
        twelve_bit,
        BitDepth,
        mono_chrome,
        color_description_present_flag,
        color_primaries,
        transfer_characteristics,
        matrix_coefficients,
        color_range,
        subsampling_x,
        subsampling_y,
        chroma_sample_position,
        separate_uv_delta_q
      };
    }
  };

  // node_modules/@yume-chan/media-codec/esm/h264.js
  var h264_exports = {};
  __export(h264_exports, {
    containsKeyFrame: () => containsKeyFrame,
    parseConfiguration: () => parseConfiguration,
    parseSequenceParameterSet: () => parseSequenceParameterSet,
    searchConfiguration: () => searchConfiguration,
    toCodecString: () => toCodecString
  });

  // node_modules/@yume-chan/media-codec/esm/nalu.js
  function* annexBSplitNalu(buffer3) {
    let start = -1;
    let zeroCount = 0;
    let inEmulation = false;
    for (let i = 0; i < buffer3.length; i += 1) {
      const byte = buffer3[i];
      if (inEmulation) {
        if (byte > 3) {
          throw new Error("Invalid data");
        }
        inEmulation = false;
        continue;
      }
      if (byte === 0) {
        zeroCount += 1;
        continue;
      }
      const prevZeroCount = zeroCount;
      zeroCount = 0;
      if (start === -1) {
        if (prevZeroCount >= 2 && byte === 1) {
          start = i + 1;
          continue;
        }
        throw new Error("Invalid data");
      }
      if (prevZeroCount < 2) {
        continue;
      }
      if (byte === 1) {
        yield buffer3.subarray(start, i - prevZeroCount);
        start = i + 1;
        continue;
      }
      if (prevZeroCount > 2) {
        throw new Error("Invalid data");
      }
      switch (byte) {
        case 2:
          throw new Error("Invalid data");
        case 3:
          inEmulation = true;
          break;
        default:
          break;
      }
    }
    if (inEmulation) {
      throw new Error("Invalid data");
    }
    yield buffer3.subarray(start, buffer3.length);
  }
  var NaluSodbBitReader = class {
    #nalu;
    // logical length is `#byteLength * 8 + (7 - #stopBitIndex)`
    #byteLength;
    #stopBitIndex;
    #zeroCount = 0;
    // logical position is `#bytePosition * 8 + (7 - #bitPosition)`
    #bytePosition = 0;
    #bitPosition = 7;
    #byte = 0;
    get byteLength() {
      return this.#byteLength;
    }
    get stopBitIndex() {
      return this.#stopBitIndex;
    }
    get bytePosition() {
      return this.#bytePosition;
    }
    get bitPosition() {
      return this.#bitPosition;
    }
    get ended() {
      return this.#bytePosition >= this.#byteLength && this.#bitPosition <= this.#stopBitIndex;
    }
    constructor(nalu) {
      this.#nalu = nalu;
      for (let i = nalu.length - 1; i >= 0; i -= 1) {
        if (this.#nalu[i] === 0) {
          continue;
        }
        const byte = nalu[i];
        for (let j = 0; j < 8; j += 1) {
          if ((byte >> j & 1) === 1) {
            this.#byteLength = i;
            this.#stopBitIndex = j;
            this.#loadByte();
            return;
          }
        }
      }
      throw new Error("Stop bit not found");
    }
    #loadByte() {
      this.#byte = this.#nalu[this.#bytePosition];
      if (this.#zeroCount === 2 && this.#byte === 3) {
        this.#zeroCount = 0;
        this.#bytePosition += 1;
        this.#loadByte();
        return;
      }
      if (this.#byte === 0) {
        this.#zeroCount += 1;
      } else {
        this.#zeroCount = 0;
      }
    }
    next() {
      if (this.ended) {
        throw new Error("Bit index out of bounds");
      }
      const value = this.#byte >> this.#bitPosition & 1;
      this.#bitPosition -= 1;
      if (this.#bitPosition < 0) {
        this.#bytePosition += 1;
        this.#bitPosition = 7;
        this.#loadByte();
      }
      return value;
    }
    read(length) {
      if (length > 32) {
        throw new Error("Read length too large");
      }
      let result = 0;
      for (let i = 0; i < length; i += 1) {
        result = result << 1 | this.next();
      }
      return result;
    }
    /**
     * Throws an error if the current position is invalid for `skip`.
     *
     * Usually it will throw if `ended` is `true`,
     * except when the bit position is at the stop bit,
     * in which case `ended` will be `true`, but it won't throw.
     * `skip` can skip all remaining bits, and stop at the end position.
     * The next `next` call will throw since there is no more bits to read.
     */
    #checkSkipPosition() {
      if (this.#bytePosition >= this.#byteLength && this.#bitPosition < this.#stopBitIndex) {
        throw new Error("Bit index out of bounds");
      }
    }
    skip(length) {
      if (length <= this.#bitPosition + 1) {
        this.#bitPosition -= length;
        this.#checkSkipPosition();
        return;
      }
      length -= this.#bitPosition + 1;
      this.#bytePosition += 1;
      this.#bitPosition = 7;
      this.#loadByte();
      this.#checkSkipPosition();
      for (; length >= 8; length -= 8) {
        this.#bytePosition += 1;
        this.#loadByte();
        this.#checkSkipPosition();
      }
      this.#bitPosition = 7 - length;
      this.#checkSkipPosition();
    }
    decodeExponentialGolombNumber() {
      let length = 0;
      while (this.next() === 0) {
        length += 1;
      }
      if (length === 0) {
        return 0;
      }
      return (1 << length | this.read(length)) - 1;
    }
    #save() {
      return {
        zeroCount: this.#zeroCount,
        bytePosition: this.#bytePosition,
        bitPosition: this.#bitPosition,
        byte: this.#byte
      };
    }
    #restore(state) {
      this.#zeroCount = state.zeroCount;
      this.#bytePosition = state.bytePosition;
      this.#bitPosition = state.bitPosition;
      this.#byte = state.byte;
    }
    peek(length) {
      const state = this.#save();
      const result = this.read(length);
      this.#restore(state);
      return result;
    }
    readBytes(length) {
      const result = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) {
        result[i] = this.read(8);
      }
      return result;
    }
    peekBytes(length) {
      const state = this.#save();
      const result = this.readBytes(length);
      this.#restore(state);
      return result;
    }
  };

  // node_modules/@yume-chan/media-codec/esm/h264.js
  function parseSequenceParameterSet(nalu) {
    const reader = new NaluSodbBitReader(nalu);
    if (reader.next() !== 0) {
      throw new Error("Invalid data");
    }
    const nal_ref_idc = reader.read(2);
    const nal_unit_type = reader.read(5);
    if (nal_unit_type !== 7) {
      throw new Error("Invalid data");
    }
    if (nal_ref_idc === 0) {
      throw new Error("Invalid data");
    }
    const profile_idc = reader.read(8);
    const constraint_set = reader.peek(8);
    const constraint_set0_flag = !!reader.next();
    const constraint_set1_flag = !!reader.next();
    const constraint_set2_flag = !!reader.next();
    const constraint_set3_flag = !!reader.next();
    const constraint_set4_flag = !!reader.next();
    const constraint_set5_flag = !!reader.next();
    if (reader.read(2) !== 0) {
      throw new Error("Invalid data");
    }
    const level_idc = reader.read(8);
    const seq_parameter_set_id = reader.decodeExponentialGolombNumber();
    if (profile_idc === 100 || profile_idc === 110 || profile_idc === 122 || profile_idc === 244 || profile_idc === 44 || profile_idc === 83 || profile_idc === 86 || profile_idc === 118 || profile_idc === 128 || profile_idc === 138 || profile_idc === 139 || profile_idc === 134) {
      const chroma_format_idc = reader.decodeExponentialGolombNumber();
      if (chroma_format_idc === 3) {
        reader.next();
      }
      reader.decodeExponentialGolombNumber();
      reader.decodeExponentialGolombNumber();
      reader.next();
      const seq_scaling_matrix_present_flag = !!reader.next();
      if (seq_scaling_matrix_present_flag) {
        const seq_scaling_list_present_flag = [];
        for (let i = 0; i < (chroma_format_idc !== 3 ? 8 : 12); i += 1) {
          seq_scaling_list_present_flag[i] = !!reader.next();
          if (seq_scaling_list_present_flag[i])
            if (i < 6) {
            } else {
            }
        }
      }
    }
    reader.decodeExponentialGolombNumber();
    const pic_order_cnt_type = reader.decodeExponentialGolombNumber();
    if (pic_order_cnt_type === 0) {
      reader.decodeExponentialGolombNumber();
    } else if (pic_order_cnt_type === 1) {
      reader.next();
      reader.decodeExponentialGolombNumber();
      reader.decodeExponentialGolombNumber();
      const num_ref_frames_in_pic_order_cnt_cycle = reader.decodeExponentialGolombNumber();
      const offset_for_ref_frame = [];
      for (let i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i += 1) {
        offset_for_ref_frame[i] = reader.decodeExponentialGolombNumber();
      }
    }
    reader.decodeExponentialGolombNumber();
    reader.next();
    const pic_width_in_mbs_minus1 = reader.decodeExponentialGolombNumber();
    const pic_height_in_map_units_minus1 = reader.decodeExponentialGolombNumber();
    const frame_mbs_only_flag = reader.next();
    if (!frame_mbs_only_flag) {
      reader.next();
    }
    reader.next();
    const frame_cropping_flag = !!reader.next();
    let frame_crop_left_offset;
    let frame_crop_right_offset;
    let frame_crop_top_offset;
    let frame_crop_bottom_offset;
    if (frame_cropping_flag) {
      frame_crop_left_offset = reader.decodeExponentialGolombNumber();
      frame_crop_right_offset = reader.decodeExponentialGolombNumber();
      frame_crop_top_offset = reader.decodeExponentialGolombNumber();
      frame_crop_bottom_offset = reader.decodeExponentialGolombNumber();
    } else {
      frame_crop_left_offset = 0;
      frame_crop_right_offset = 0;
      frame_crop_top_offset = 0;
      frame_crop_bottom_offset = 0;
    }
    const vui_parameters_present_flag = !!reader.next();
    if (vui_parameters_present_flag) {
    }
    return {
      profile_idc,
      constraint_set,
      constraint_set0_flag,
      constraint_set1_flag,
      constraint_set2_flag,
      constraint_set3_flag,
      constraint_set4_flag,
      constraint_set5_flag,
      level_idc,
      seq_parameter_set_id,
      pic_width_in_mbs_minus1,
      pic_height_in_map_units_minus1,
      frame_mbs_only_flag,
      frame_cropping_flag,
      frame_crop_left_offset,
      frame_crop_right_offset,
      frame_crop_top_offset,
      frame_crop_bottom_offset
    };
  }
  function searchConfiguration(buffer3) {
    let sequenceParameterSet;
    let pictureParameterSet;
    for (const nalu of annexBSplitNalu(buffer3)) {
      const naluType = nalu[0] & 31;
      switch (naluType) {
        case 7:
          sequenceParameterSet = nalu;
          if (pictureParameterSet) {
            return {
              sequenceParameterSet,
              pictureParameterSet
            };
          }
          break;
        case 8:
          pictureParameterSet = nalu;
          if (sequenceParameterSet) {
            return {
              sequenceParameterSet,
              pictureParameterSet
            };
          }
          break;
        default:
          break;
      }
    }
    throw new Error("Invalid data");
  }
  function containsKeyFrame(buffer3) {
    for (const nalu of annexBSplitNalu(buffer3)) {
      const naluType = nalu[0] & 31;
      if (naluType === 5) {
        return true;
      }
    }
    return false;
  }
  function parseConfiguration(data) {
    const { sequenceParameterSet, pictureParameterSet } = searchConfiguration(data);
    const { profile_idc: profileIndex, constraint_set: constraintSet, level_idc: levelIndex, pic_width_in_mbs_minus1, pic_height_in_map_units_minus1, frame_mbs_only_flag, frame_crop_left_offset, frame_crop_right_offset, frame_crop_top_offset, frame_crop_bottom_offset } = parseSequenceParameterSet(sequenceParameterSet);
    const encodedWidth = (pic_width_in_mbs_minus1 + 1) * 16;
    const encodedHeight = (pic_height_in_map_units_minus1 + 1) * (2 - frame_mbs_only_flag) * 16;
    const cropLeft = frame_crop_left_offset * 2;
    const cropRight = frame_crop_right_offset * 2;
    const cropTop = frame_crop_top_offset * 2;
    const cropBottom = frame_crop_bottom_offset * 2;
    const croppedWidth = encodedWidth - cropLeft - cropRight;
    const croppedHeight = encodedHeight - cropTop - cropBottom;
    return {
      pictureParameterSet,
      sequenceParameterSet,
      profileIndex,
      constraintSet,
      levelIndex,
      encodedWidth,
      encodedHeight,
      cropLeft,
      cropRight,
      cropTop,
      cropBottom,
      croppedWidth,
      croppedHeight
    };
  }
  function toCodecString(configuration) {
    const { profileIndex, constraintSet, levelIndex } = configuration;
    return "avc1." + hexTwoDigits(profileIndex) + hexTwoDigits(constraintSet) + hexTwoDigits(levelIndex);
  }

  // node_modules/@yume-chan/media-codec/esm/h265.js
  var h265_exports = {};
  __export(h265_exports, {
    AspectRatioIndicator: () => AspectRatioIndicator,
    getSubHeightC: () => getSubHeightC,
    getSubWidthC: () => getSubWidthC,
    parseConfiguration: () => parseConfiguration2,
    parseHrdParameters: () => parseHrdParameters,
    parseNaluHeader: () => parseNaluHeader,
    parseScalingListData: () => parseScalingListData,
    parseSequenceParameterSet: () => parseSequenceParameterSet2,
    parseShortTermReferencePictureSet: () => parseShortTermReferencePictureSet,
    parseSps3dExtension: () => parseSps3dExtension,
    parseSpsMultilayerExtension: () => parseSpsMultilayerExtension,
    parseSubLayerHrdParameters: () => parseSubLayerHrdParameters,
    parseVideoParameterSet: () => parseVideoParameterSet,
    parseVuiParameters: () => parseVuiParameters,
    searchConfiguration: () => searchConfiguration2,
    toCodecString: () => toCodecString2
  });

  // node_modules/@yume-chan/media-codec/node_modules/@yume-chan/no-data-view/esm/uint32.js
  // @__NO_SIDE_EFFECTS__
  function getUint32LittleEndian2(buffer3, offset) {
    return (buffer3[offset] | buffer3[offset + 1] << 8 | buffer3[offset + 2] << 16 | buffer3[offset + 3] << 24) >>> 0;
  }

  // node_modules/@yume-chan/media-codec/esm/h265.js
  function getSubWidthC(chroma_format_idc) {
    switch (chroma_format_idc) {
      case 0:
      case 3:
        return 1;
      case 1:
      case 2:
        return 2;
      default:
        throw new Error("Invalid chroma_format_idc");
    }
  }
  function getSubHeightC(chroma_format_idc) {
    switch (chroma_format_idc) {
      case 0:
      case 2:
      case 3:
        return 1;
      case 1:
        return 2;
      default:
        throw new Error("Invalid chroma_format_idc");
    }
  }
  function parseNaluHeader(nalu) {
    const reader = new NaluSodbBitReader(nalu);
    if (reader.next() !== 0) {
      throw new Error("Invalid NALU header");
    }
    const nal_unit_type = reader.read(6);
    const nuh_layer_id = reader.read(6);
    const nuh_temporal_id_plus1 = reader.read(3);
    return {
      nal_unit_type,
      nuh_layer_id,
      nuh_temporal_id_plus1
    };
  }
  function parseVideoParameterSet(nalu) {
    const reader = new NaluSodbBitReader(nalu);
    const vps_video_parameter_set_id = reader.read(4);
    const vps_base_layer_internal_flag = !!reader.next();
    const vps_base_layer_available_flag = !!reader.next();
    const vps_max_layers_minus1 = reader.read(6);
    const vps_max_sub_layers_minus1 = reader.read(3);
    const vps_temporal_id_nesting_flag = !!reader.next();
    reader.skip(16);
    const profileTierLevel = parseProfileTierLevel(reader, true, vps_max_sub_layers_minus1);
    const vps_sub_layer_ordering_info_present_flag = !!reader.next();
    const vps_max_dec_pic_buffering_minus1 = [];
    const vps_max_num_reorder_pics = [];
    const vps_max_latency_increase_plus1 = [];
    for (let i = vps_sub_layer_ordering_info_present_flag ? 0 : vps_max_sub_layers_minus1; i <= vps_max_sub_layers_minus1; i += 1) {
      vps_max_dec_pic_buffering_minus1[i] = reader.decodeExponentialGolombNumber();
      vps_max_num_reorder_pics[i] = reader.decodeExponentialGolombNumber();
      vps_max_latency_increase_plus1[i] = reader.decodeExponentialGolombNumber();
    }
    const vps_max_layer_id = reader.read(6);
    const vps_num_layer_sets_minus1 = reader.decodeExponentialGolombNumber();
    const layer_id_included_flag = [];
    for (let i = 1; i <= vps_num_layer_sets_minus1; i += 1) {
      layer_id_included_flag[i] = [];
      for (let j = 0; j <= vps_max_layer_id; j += 1) {
        layer_id_included_flag[i][j] = !!reader.next();
      }
    }
    const vps_timing_info_present_flag = !!reader.next();
    let vps_num_units_in_tick;
    let vps_time_scale;
    let vps_poc_proportional_to_timing_flag;
    let vps_num_ticks_poc_diff_one_minus1;
    let vps_num_hrd_parameters;
    let hrd_layer_set_idx;
    let cprms_present_flag;
    let hrdParameters;
    if (vps_timing_info_present_flag) {
      vps_num_units_in_tick = reader.read(32);
      vps_time_scale = reader.read(32);
      vps_poc_proportional_to_timing_flag = !!reader.next();
      if (vps_poc_proportional_to_timing_flag) {
        vps_num_ticks_poc_diff_one_minus1 = reader.decodeExponentialGolombNumber();
      }
      vps_num_hrd_parameters = reader.decodeExponentialGolombNumber();
      hrd_layer_set_idx = [];
      cprms_present_flag = [true];
      hrdParameters = [];
      for (let i = 0; i < vps_num_hrd_parameters; i += 1) {
        hrd_layer_set_idx[i] = reader.decodeExponentialGolombNumber();
        if (i > 0) {
          cprms_present_flag[i] = !!reader.next();
        }
        hrdParameters[i] = parseHrdParameters(reader, cprms_present_flag[i], vps_max_sub_layers_minus1);
      }
    }
    const vps_extension_flag = !!reader.next();
    return {
      vps_video_parameter_set_id,
      vps_base_layer_internal_flag,
      vps_base_layer_available_flag,
      vps_max_layers_minus1,
      vps_max_sub_layers_minus1,
      vps_temporal_id_nesting_flag,
      profileTierLevel,
      vps_sub_layer_ordering_info_present_flag,
      vps_max_dec_pic_buffering_minus1,
      vps_max_num_reorder_pics,
      vps_max_latency_increase_plus1,
      vps_max_layer_id,
      vps_num_layer_sets_minus1,
      layer_id_included_flag,
      vps_timing_info_present_flag,
      vps_num_units_in_tick,
      vps_time_scale,
      vps_poc_proportional_to_timing_flag,
      vps_num_ticks_poc_diff_one_minus1,
      vps_num_hrd_parameters,
      hrd_layer_set_idx,
      cprms_present_flag,
      hrdParameters,
      vps_extension_flag
    };
  }
  function parseSequenceParameterSet2(nalu) {
    const reader = new NaluSodbBitReader(nalu);
    const sps_video_parameter_set_id = reader.read(4);
    const sps_max_sub_layers_minus1 = reader.read(3);
    const sps_temporal_id_nesting_flag = !!reader.next();
    const profileTierLevel = parseProfileTierLevel(reader, true, sps_max_sub_layers_minus1);
    const sps_seq_parameter_set_id = reader.decodeExponentialGolombNumber();
    const chroma_format_idc = reader.decodeExponentialGolombNumber();
    let separate_colour_plane_flag;
    if (chroma_format_idc === 3) {
      separate_colour_plane_flag = !!reader.next();
    }
    const pic_width_in_luma_samples = reader.decodeExponentialGolombNumber();
    const pic_height_in_luma_samples = reader.decodeExponentialGolombNumber();
    const conformance_window_flag = !!reader.next();
    let conf_win_left_offset;
    let conf_win_right_offset;
    let conf_win_top_offset;
    let conf_win_bottom_offset;
    if (conformance_window_flag) {
      conf_win_left_offset = reader.decodeExponentialGolombNumber();
      conf_win_right_offset = reader.decodeExponentialGolombNumber();
      conf_win_top_offset = reader.decodeExponentialGolombNumber();
      conf_win_bottom_offset = reader.decodeExponentialGolombNumber();
    }
    const bit_depth_luma_minus8 = reader.decodeExponentialGolombNumber();
    const bit_depth_chroma_minus8 = reader.decodeExponentialGolombNumber();
    const log2_max_pic_order_cnt_lsb_minus4 = reader.decodeExponentialGolombNumber();
    const sps_max_dec_pic_buffering_minus1 = [];
    const sps_max_num_reorder_pics = [];
    const sps_max_latency_increase_plus1 = [];
    const sps_sub_layer_ordering_info_present_flag = !!reader.next();
    for (let i = sps_sub_layer_ordering_info_present_flag ? 0 : sps_max_sub_layers_minus1; i <= sps_max_sub_layers_minus1; i += 1) {
      sps_max_dec_pic_buffering_minus1[i] = reader.decodeExponentialGolombNumber();
      sps_max_num_reorder_pics[i] = reader.decodeExponentialGolombNumber();
      sps_max_latency_increase_plus1[i] = reader.decodeExponentialGolombNumber();
    }
    const log2_min_luma_coding_block_size_minus3 = reader.decodeExponentialGolombNumber();
    const log2_diff_max_min_luma_coding_block_size = reader.decodeExponentialGolombNumber();
    const log2_min_luma_transform_block_size_minus2 = reader.decodeExponentialGolombNumber();
    const log2_diff_max_min_luma_transform_block_size = reader.decodeExponentialGolombNumber();
    const max_transform_hierarchy_depth_inter = reader.decodeExponentialGolombNumber();
    const max_transform_hierarchy_depth_intra = reader.decodeExponentialGolombNumber();
    const scaling_list_enabled_flag = !!reader.next();
    let sps_scaling_list_data_present_flag;
    let scalingListData;
    if (scaling_list_enabled_flag) {
      sps_scaling_list_data_present_flag = !!reader.next();
      if (sps_scaling_list_data_present_flag) {
        scalingListData = parseScalingListData(reader);
      }
    }
    const amp_enabled_flag = !!reader.next();
    const sample_adaptive_offset_enabled_flag = !!reader.next();
    const pcm_enabled_flag = !!reader.next();
    let pcm_sample_bit_depth_luma_minus1;
    let pcm_sample_bit_depth_chroma_minus1;
    let log2_min_pcm_luma_coding_block_size_minus3;
    let log2_diff_max_min_pcm_luma_coding_block_size;
    let pcm_loop_filter_disabled_flag;
    if (pcm_enabled_flag) {
      pcm_sample_bit_depth_luma_minus1 = reader.read(4);
      pcm_sample_bit_depth_chroma_minus1 = reader.read(4);
      log2_min_pcm_luma_coding_block_size_minus3 = reader.decodeExponentialGolombNumber();
      log2_diff_max_min_pcm_luma_coding_block_size = reader.decodeExponentialGolombNumber();
      pcm_loop_filter_disabled_flag = !!reader.next();
    }
    const num_short_term_ref_pic_sets = reader.decodeExponentialGolombNumber();
    const shortTermRefPicSets = [];
    for (let i = 0; i < num_short_term_ref_pic_sets; i += 1) {
      shortTermRefPicSets[i] = parseShortTermReferencePictureSet(reader, i, num_short_term_ref_pic_sets, shortTermRefPicSets);
    }
    const long_term_ref_pics_present_flag = !!reader.next();
    let num_long_term_ref_pics_sps;
    let lt_ref_pic_poc_lsb_sps;
    let used_by_curr_pic_lt_sps_flag;
    if (long_term_ref_pics_present_flag) {
      num_long_term_ref_pics_sps = reader.decodeExponentialGolombNumber();
      lt_ref_pic_poc_lsb_sps = [];
      used_by_curr_pic_lt_sps_flag = [];
      for (let i = 0; i < num_long_term_ref_pics_sps; i += 1) {
        lt_ref_pic_poc_lsb_sps[i] = reader.read(log2_max_pic_order_cnt_lsb_minus4 + 4);
        used_by_curr_pic_lt_sps_flag[i] = !!reader.next();
      }
    }
    const sps_temporal_mvp_enabled_flag = !!reader.next();
    const strong_intra_smoothing_enabled_flag = !!reader.next();
    const vui_parameters_present_flag = !!reader.next();
    let vuiParameters;
    if (vui_parameters_present_flag) {
      vuiParameters = parseVuiParameters(reader, sps_max_sub_layers_minus1);
    }
    const sps_extension_present_flag = !!reader.next();
    let sps_range_extension_flag;
    let sps_multilayer_extension_flag;
    let sps_3d_extension_flag;
    let sps_scc_extension_flag;
    let sps_extension_4bits;
    if (sps_extension_present_flag) {
      sps_range_extension_flag = !!reader.next();
      sps_multilayer_extension_flag = !!reader.next();
      sps_3d_extension_flag = !!reader.next();
      sps_scc_extension_flag = !!reader.next();
      sps_extension_4bits = reader.read(4);
    }
    if (sps_range_extension_flag) {
      throw new Error("Not implemented");
    }
    let spsMultilayerExtension;
    if (sps_multilayer_extension_flag) {
      spsMultilayerExtension = parseSpsMultilayerExtension(reader);
    }
    let sps3dExtension;
    if (sps_3d_extension_flag) {
      sps3dExtension = parseSps3dExtension(reader);
    }
    if (sps_scc_extension_flag) {
      throw new Error("Not implemented");
    }
    let sps_extension_data_flag;
    if (sps_extension_4bits) {
      sps_extension_data_flag = [];
      let i = 0;
      while (!reader.ended) {
        sps_extension_data_flag[i] = !!reader.next();
        i += 1;
      }
    }
    return {
      sps_video_parameter_set_id,
      sps_max_sub_layers_minus1,
      sps_temporal_id_nesting_flag,
      profileTierLevel,
      sps_seq_parameter_set_id,
      chroma_format_idc,
      separate_colour_plane_flag,
      pic_width_in_luma_samples,
      pic_height_in_luma_samples,
      conformance_window_flag,
      conf_win_left_offset,
      conf_win_right_offset,
      conf_win_top_offset,
      conf_win_bottom_offset,
      bit_depth_luma_minus8,
      bit_depth_chroma_minus8,
      log2_max_pic_order_cnt_lsb_minus4,
      sps_sub_layer_ordering_info_present_flag,
      sps_max_dec_pic_buffering_minus1,
      sps_max_num_reorder_pics,
      sps_max_latency_increase_plus1,
      log2_min_luma_coding_block_size_minus3,
      log2_diff_max_min_luma_coding_block_size,
      log2_min_luma_transform_block_size_minus2,
      log2_diff_max_min_luma_transform_block_size,
      max_transform_hierarchy_depth_inter,
      max_transform_hierarchy_depth_intra,
      scaling_list_enabled_flag,
      sps_scaling_list_data_present_flag,
      scalingListData,
      amp_enabled_flag,
      sample_adaptive_offset_enabled_flag,
      pcm_enabled_flag,
      pcm_sample_bit_depth_luma_minus1,
      pcm_sample_bit_depth_chroma_minus1,
      log2_min_pcm_luma_coding_block_size_minus3,
      log2_diff_max_min_pcm_luma_coding_block_size,
      pcm_loop_filter_disabled_flag,
      num_short_term_ref_pic_sets,
      shortTermRefPicSets,
      long_term_ref_pics_present_flag,
      num_long_term_ref_pics_sps,
      lt_ref_pic_poc_lsb_sps,
      used_by_curr_pic_lt_sps_flag,
      sps_temporal_mvp_enabled_flag,
      strong_intra_smoothing_enabled_flag,
      vui_parameters_present_flag,
      vuiParameters,
      sps_extension_present_flag,
      sps_range_extension_flag,
      sps_multilayer_extension_flag,
      sps_3d_extension_flag,
      sps_scc_extension_flag,
      sps_extension_4bits,
      spsMultilayerExtension,
      sps3dExtension,
      sps_extension_data_flag
    };
  }
  function parseProfileTier(reader) {
    const profile_space = reader.read(2);
    const tier_flag = !!reader.next();
    const profile_idc = reader.read(5);
    const profileCompatibilitySet = reader.peekBytes(4);
    const profile_compatibility_flag = [];
    for (let j = 0; j < 32; j += 1) {
      profile_compatibility_flag[j] = !!reader.next();
    }
    const constraintSet = reader.peekBytes(6);
    const progressive_source_flag = !!reader.next();
    const interlaced_source_flag = !!reader.next();
    const non_packed_constraint_flag = !!reader.next();
    const frame_only_constraint_flag = !!reader.next();
    let max_12bit_constraint_flag;
    let max_10bit_constraint_flag;
    let max_8bit_constraint_flag;
    let max_422chroma_constraint_flag;
    let max_420chroma_constraint_flag;
    let max_monochrome_constraint_flag;
    let intra_constraint_flag;
    let one_picture_only_constraint_flag;
    let lower_bit_rate_constraint_flag;
    let max_14bit_constraint_flag;
    if (profile_idc === 4 || profile_compatibility_flag[4] || profile_idc === 5 || profile_compatibility_flag[5] || profile_idc === 6 || profile_compatibility_flag[6] || profile_idc === 7 || profile_compatibility_flag[7] || profile_idc === 8 || profile_compatibility_flag[8] || profile_idc === 9 || profile_compatibility_flag[9] || profile_idc === 10 || profile_compatibility_flag[10] || profile_idc === 11 || profile_compatibility_flag[11]) {
      max_12bit_constraint_flag = !!reader.next();
      max_10bit_constraint_flag = !!reader.next();
      max_8bit_constraint_flag = !!reader.next();
      max_422chroma_constraint_flag = !!reader.next();
      max_420chroma_constraint_flag = !!reader.next();
      max_monochrome_constraint_flag = !!reader.next();
      intra_constraint_flag = !!reader.next();
      one_picture_only_constraint_flag = !!reader.next();
      lower_bit_rate_constraint_flag = !!reader.next();
      if (profile_idc === 5 || profile_compatibility_flag[5] || profile_idc === 9 || profile_compatibility_flag[9] || profile_idc === 10 || profile_compatibility_flag[10] || profile_idc === 11 || profile_compatibility_flag[11]) {
        max_14bit_constraint_flag = !!reader.next();
        reader.skip(33);
      } else {
        reader.skip(34);
      }
    } else if (profile_idc === 2 || profile_compatibility_flag[2]) {
      reader.skip(7);
      one_picture_only_constraint_flag = !!reader.next();
      reader.skip(35);
    } else {
      reader.skip(43);
    }
    let inbld_flag;
    if (profile_idc === 1 || profile_compatibility_flag[1] || profile_idc === 2 || profile_compatibility_flag[2] || profile_idc === 3 || profile_compatibility_flag[3] || profile_idc === 4 || profile_compatibility_flag[4] || profile_idc === 5 || profile_compatibility_flag[5] || profile_idc === 9 || profile_compatibility_flag[9] || profile_idc === 11 || profile_compatibility_flag[11]) {
      inbld_flag = !!reader.next();
    } else {
      reader.skip(1);
    }
    return {
      profile_space,
      tier_flag,
      profile_idc,
      profileCompatibilitySet,
      profile_compatibility_flag,
      constraintSet,
      progressive_source_flag,
      interlaced_source_flag,
      non_packed_constraint_flag,
      frame_only_constraint_flag,
      max_12bit_constraint_flag,
      max_10bit_constraint_flag,
      max_8bit_constraint_flag,
      max_422chroma_constraint_flag,
      max_420chroma_constraint_flag,
      max_monochrome_constraint_flag,
      intra_constraint_flag,
      one_picture_only_constraint_flag,
      lower_bit_rate_constraint_flag,
      max_14bit_constraint_flag,
      inbld_flag
    };
  }
  function parseProfileTierLevel(reader, profilePresentFlag, maxNumSubLayersMinus1) {
    let generalProfileTier;
    if (profilePresentFlag) {
      generalProfileTier = parseProfileTier(reader);
    }
    const general_level_idc = reader.read(8);
    const sub_layer_profile_present_flag = [];
    const sub_layer_level_present_flag = [];
    for (let i = 0; i < maxNumSubLayersMinus1; i += 1) {
      sub_layer_profile_present_flag[i] = !!reader.next();
      sub_layer_level_present_flag[i] = !!reader.next();
    }
    if (maxNumSubLayersMinus1 > 0) {
      for (let i = maxNumSubLayersMinus1; i < 8; i += 1) {
        reader.read(2);
      }
    }
    const subLayerProfileTier = [];
    const sub_layer_level_idc = [];
    for (let i = 0; i < maxNumSubLayersMinus1; i += 1) {
      if (sub_layer_profile_present_flag[i]) {
        subLayerProfileTier[i] = parseProfileTier(reader);
      }
      if (sub_layer_level_present_flag[i]) {
        sub_layer_level_idc[i] = reader.read(8);
      }
    }
    return {
      generalProfileTier,
      general_level_idc,
      sub_layer_profile_present_flag,
      sub_layer_level_present_flag,
      subLayerProfileTier,
      sub_layer_level_idc
    };
  }
  function parseScalingListData(reader) {
    const scaling_list = [];
    for (let sizeId = 0; sizeId < 4; sizeId += 1) {
      scaling_list[sizeId] = [];
      for (let matrixId = 0; matrixId < 6; matrixId += sizeId === 3 ? 3 : 1) {
        const scaling_list_pred_mode_flag = !!reader.next();
        if (!scaling_list_pred_mode_flag) {
          reader.decodeExponentialGolombNumber();
        } else {
          let nextCoef = 8;
          const coefNum = Math.min(64, 1 << 4 + (sizeId << 1));
          if (sizeId > 1) {
            const scaling_list_dc_coef_minus8 = reader.decodeExponentialGolombNumber();
            nextCoef = scaling_list_dc_coef_minus8 + 8;
          }
          scaling_list[sizeId][matrixId] = [];
          for (let i = 0; i < coefNum; i += 1) {
            const scaling_list_delta_coef = reader.decodeExponentialGolombNumber();
            nextCoef = (nextCoef + scaling_list_delta_coef + 256) % 256;
            scaling_list[sizeId][matrixId][i] = nextCoef;
          }
        }
      }
    }
    return scaling_list;
  }
  function parseShortTermReferencePictureSet(reader, stRpsIdx, num_short_term_ref_pic_sets, sets) {
    let inter_ref_pic_set_prediction_flag = false;
    if (stRpsIdx !== 0) {
      inter_ref_pic_set_prediction_flag = !!reader.next();
    }
    let delta_idx_minus1 = 0;
    let delta_rps_sign = false;
    let abs_delta_rps_minus1 = 0;
    const used_by_curr_pic_flag = [];
    const use_delta_flag = [];
    let num_negative_pics;
    let num_positive_pics;
    const delta_poc_s0_minus1 = [];
    const used_by_curr_pic_s0_flag = [];
    const delta_poc_s1_minus1 = [];
    const used_by_curr_pic_s1_flag = [];
    if (inter_ref_pic_set_prediction_flag) {
      if (stRpsIdx === num_short_term_ref_pic_sets) {
        delta_idx_minus1 = reader.decodeExponentialGolombNumber();
      }
      delta_rps_sign = !!reader.next();
      abs_delta_rps_minus1 = reader.decodeExponentialGolombNumber();
      const RefRpsIdx = stRpsIdx - (delta_idx_minus1 + 1);
      const RefRps = sets[RefRpsIdx];
      const NumDeltaPocs_RefRpsIdx = RefRps.num_negative_pics + RefRps.num_positive_pics;
      for (let j = 0; j <= NumDeltaPocs_RefRpsIdx; j += 1) {
        used_by_curr_pic_flag[j] = !!reader.next();
        if (!used_by_curr_pic_flag[j]) {
          use_delta_flag[j] = !!reader.next();
        } else {
          use_delta_flag[j] = true;
        }
      }
      const DeltaRps = (1 - 2 * Number(delta_rps_sign)) * (abs_delta_rps_minus1 + 1);
      const RefPocS0 = [];
      const RefPocS1 = [];
      const pocS0 = [];
      const pocS1 = [];
      let dPoc = 0;
      for (let i2 = 0; i2 < RefRps.num_negative_pics; i2 += 1) {
        dPoc -= RefRps.delta_poc_s0_minus1[i2] + 1;
        RefPocS0[i2] = dPoc;
      }
      dPoc = 0;
      for (let i2 = 0; i2 < RefRps.num_positive_pics; i2 += 1) {
        dPoc += RefRps.delta_poc_s1_minus1[i2] + 1;
        RefPocS1[i2] = dPoc;
      }
      let i = 0;
      if (RefRps.num_positive_pics > 0) {
        for (let j = RefRps.num_positive_pics - 1; j >= 0; j -= 1) {
          dPoc = RefPocS1[j] + DeltaRps;
          if (dPoc < 0 && use_delta_flag[RefRps.num_negative_pics + j]) {
            pocS0[i] = dPoc;
            used_by_curr_pic_s0_flag[i] = used_by_curr_pic_flag[RefRps.num_negative_pics + j];
            i += 1;
          }
        }
      }
      if (DeltaRps < 0 && use_delta_flag[NumDeltaPocs_RefRpsIdx]) {
        pocS0[i] = DeltaRps;
        used_by_curr_pic_s0_flag[i] = used_by_curr_pic_flag[NumDeltaPocs_RefRpsIdx];
        i += 1;
      }
      for (let j = 0; j < RefRps.num_negative_pics; j += 1) {
        dPoc = RefPocS0[j] + DeltaRps;
        if (dPoc < 0 && use_delta_flag[j]) {
          pocS0[i] = dPoc;
          used_by_curr_pic_s0_flag[i] = used_by_curr_pic_flag[j];
          i += 1;
        }
      }
      num_negative_pics = i;
      let prev = 0;
      for (i = 0; i < num_negative_pics; i += 1) {
        const current = pocS0[i];
        delta_poc_s0_minus1[i] = -(current - prev - 1);
        prev = current;
      }
      i = 0;
      if (RefRps.num_negative_pics > 0) {
        for (let j = RefRps.num_negative_pics - 1; j >= 0; j -= 1) {
          dPoc = RefPocS0[j] + DeltaRps;
          if (dPoc > 0 && use_delta_flag[j]) {
            pocS1[i] = dPoc;
            used_by_curr_pic_s1_flag[i] = used_by_curr_pic_flag[j];
            i += 1;
          }
        }
      }
      if (DeltaRps > 0 && use_delta_flag[NumDeltaPocs_RefRpsIdx]) {
        pocS1[i] = DeltaRps;
        used_by_curr_pic_s1_flag[i] = used_by_curr_pic_flag[NumDeltaPocs_RefRpsIdx];
        i += 1;
      }
      for (let j = 0; j < RefRps.num_positive_pics; j += 1) {
        dPoc = RefPocS1[j] + DeltaRps;
        if (dPoc > 0 && use_delta_flag[RefRps.num_negative_pics + j]) {
          pocS1[i] = dPoc;
          used_by_curr_pic_s1_flag[i] = used_by_curr_pic_flag[RefRps.num_negative_pics + j];
          i += 1;
        }
      }
      num_positive_pics = i;
      prev = 0;
      for (i = 0; i < num_positive_pics; i += 1) {
        const current = pocS1[i];
        delta_poc_s1_minus1[i] = current - prev - 1;
        prev = current;
      }
    } else {
      num_negative_pics = reader.decodeExponentialGolombNumber();
      num_positive_pics = reader.decodeExponentialGolombNumber();
      for (let i = 0; i < num_negative_pics; i += 1) {
        delta_poc_s0_minus1[i] = reader.decodeExponentialGolombNumber();
        used_by_curr_pic_s0_flag[i] = !!reader.next();
      }
      for (let i = 0; i < num_positive_pics; i += 1) {
        delta_poc_s1_minus1[i] = reader.decodeExponentialGolombNumber();
        used_by_curr_pic_s1_flag[i] = !!reader.next();
      }
    }
    return {
      stRpsIdx,
      num_short_term_ref_pic_sets,
      inter_ref_pic_set_prediction_flag,
      delta_idx_minus1,
      delta_rps_sign,
      abs_delta_rps_minus1,
      used_by_curr_pic_flag,
      use_delta_flag,
      num_negative_pics,
      num_positive_pics,
      delta_poc_s0_minus1,
      used_by_curr_pic_s0_flag,
      delta_poc_s1_minus1,
      used_by_curr_pic_s1_flag
    };
  }
  var AspectRatioIndicator = {
    Unspecified: 0,
    Square: 1,
    ["12:11"]: 2,
    ["10:11"]: 3,
    ["16:11"]: 4,
    ["40:33"]: 5,
    ["24:11"]: 6,
    ["20:11"]: 7,
    ["32:11"]: 8,
    ["80:33"]: 9,
    ["18:11"]: 10,
    ["15:11"]: 11,
    ["64:33"]: 12,
    ["160:99"]: 13,
    ["4:3"]: 15,
    ["3:2"]: 16,
    ["2:1"]: 17,
    Extended: 255
  };
  function parseVuiParameters(reader, sps_max_sub_layers_minus1) {
    const aspect_ratio_info_present_flag = !!reader.next();
    let aspect_ratio_idc;
    let sar_width;
    let sar_height;
    if (aspect_ratio_info_present_flag) {
      aspect_ratio_idc = reader.read(8);
      if (aspect_ratio_idc === AspectRatioIndicator.Extended) {
        sar_width = reader.read(16);
        sar_height = reader.read(16);
      }
    }
    const overscan_info_present_flag = !!reader.next();
    let overscan_appropriate_flag;
    if (overscan_info_present_flag) {
      overscan_appropriate_flag = !!reader.next();
    }
    const video_signal_type_present_flag = !!reader.next();
    let video_format;
    let video_full_range_flag;
    let colour_description_present_flag;
    let colour_primaries;
    let transfer_characteristics;
    let matrix_coeffs;
    if (video_signal_type_present_flag) {
      video_format = reader.read(3);
      video_full_range_flag = !!reader.next();
      colour_description_present_flag = !!reader.next();
      if (colour_description_present_flag) {
        colour_primaries = reader.read(8);
        transfer_characteristics = reader.read(8);
        matrix_coeffs = reader.read(8);
      }
    }
    const chroma_loc_info_present_flag = !!reader.next();
    let chroma_sample_loc_type_top_field;
    let chroma_sample_loc_type_bottom_field;
    if (chroma_loc_info_present_flag) {
      chroma_sample_loc_type_top_field = reader.decodeExponentialGolombNumber();
      chroma_sample_loc_type_bottom_field = reader.decodeExponentialGolombNumber();
    }
    const neutral_chroma_indication_flag = !!reader.next();
    const field_seq_flag = !!reader.next();
    const frame_field_info_present_flag = !!reader.next();
    const default_display_window_flag = !!reader.next();
    let def_disp_win_left_offset;
    let def_disp_win_right_offset;
    let def_disp_win_top_offset;
    let def_disp_win_bottom_offset;
    if (default_display_window_flag) {
      def_disp_win_left_offset = reader.decodeExponentialGolombNumber();
      def_disp_win_right_offset = reader.decodeExponentialGolombNumber();
      def_disp_win_top_offset = reader.decodeExponentialGolombNumber();
      def_disp_win_bottom_offset = reader.decodeExponentialGolombNumber();
    }
    const vui_timing_info_present_flag = !!reader.next();
    let vui_num_units_in_tick;
    let vui_time_scale;
    let vui_poc_proportional_to_timing_flag;
    let vui_num_ticks_poc_diff_one_minus1;
    let vui_hrd_parameters_present_flag;
    let vui_hrd_parameters;
    if (vui_timing_info_present_flag) {
      vui_num_units_in_tick = reader.read(32);
      vui_time_scale = reader.read(32);
      vui_poc_proportional_to_timing_flag = !!reader.next();
      if (vui_poc_proportional_to_timing_flag) {
        vui_num_ticks_poc_diff_one_minus1 = reader.decodeExponentialGolombNumber();
      }
      vui_hrd_parameters_present_flag = !!reader.next();
      if (vui_hrd_parameters_present_flag) {
        vui_hrd_parameters = parseHrdParameters(reader, true, sps_max_sub_layers_minus1);
      }
    }
    const bitstream_restriction_flag = !!reader.next();
    let tiles_fixed_structure_flag;
    let motion_vectors_over_pic_boundaries_flag;
    let restricted_ref_pic_lists_flag;
    let min_spatial_segmentation_idc;
    let max_bytes_per_pic_denom;
    let max_bits_per_min_cu_denom;
    let log2_max_mv_length_horizontal;
    let log2_max_mv_length_vertical;
    if (bitstream_restriction_flag) {
      tiles_fixed_structure_flag = !!reader.next();
      motion_vectors_over_pic_boundaries_flag = !!reader.next();
      restricted_ref_pic_lists_flag = !!reader.next();
      min_spatial_segmentation_idc = reader.decodeExponentialGolombNumber();
      max_bytes_per_pic_denom = reader.decodeExponentialGolombNumber();
      max_bits_per_min_cu_denom = reader.decodeExponentialGolombNumber();
      log2_max_mv_length_horizontal = reader.decodeExponentialGolombNumber();
      log2_max_mv_length_vertical = reader.decodeExponentialGolombNumber();
    }
    return {
      aspect_ratio_info_present_flag,
      aspect_ratio_idc,
      sar_width,
      sar_height,
      overscan_info_present_flag,
      overscan_appropriate_flag,
      video_signal_type_present_flag,
      video_format,
      video_full_range_flag,
      colour_description_present_flag,
      colour_primaries,
      transfer_characteristics,
      matrix_coeffs,
      chroma_loc_info_present_flag,
      chroma_sample_loc_type_top_field,
      chroma_sample_loc_type_bottom_field,
      neutral_chroma_indication_flag,
      field_seq_flag,
      frame_field_info_present_flag,
      default_display_window_flag,
      def_disp_win_left_offset,
      def_disp_win_right_offset,
      def_disp_win_top_offset,
      def_disp_win_bottom_offset,
      vui_timing_info_present_flag,
      vui_num_units_in_tick,
      vui_time_scale,
      vui_poc_proportional_to_timing_flag,
      vui_num_ticks_poc_diff_one_minus1,
      vui_hrd_parameters_present_flag,
      vui_hrd_parameters,
      bitstream_restriction_flag,
      tiles_fixed_structure_flag,
      motion_vectors_over_pic_boundaries_flag,
      restricted_ref_pic_lists_flag,
      min_spatial_segmentation_idc,
      max_bytes_per_pic_denom,
      max_bits_per_min_cu_denom,
      log2_max_mv_length_horizontal,
      log2_max_mv_length_vertical
    };
  }
  function parseHrdParameters(reader, commonInfPresentFlag, maxNumSubLayersMinus1) {
    let nal_hrd_parameters_present_flag;
    let vcl_hrd_parameters_present_flag;
    let sub_pic_hrd_params_present_flag;
    let tick_divisor_minus2;
    let du_cpb_removal_delay_increment_length_minus1;
    let sub_pic_cpb_params_in_pic_timing_sei_flag;
    let dpb_output_delay_du_length_minus1;
    let bit_rate_scale;
    let cpb_size_scale;
    let cpb_size_du_scale;
    let initial_cpb_removal_delay_length_minus1;
    let au_cpb_removal_delay_length_minus1;
    let dpb_output_delay_length_minus1;
    if (commonInfPresentFlag) {
      nal_hrd_parameters_present_flag = !!reader.next();
      vcl_hrd_parameters_present_flag = !!reader.next();
      if (nal_hrd_parameters_present_flag || vcl_hrd_parameters_present_flag) {
        sub_pic_hrd_params_present_flag = !!reader.next();
        if (sub_pic_hrd_params_present_flag) {
          tick_divisor_minus2 = reader.read(8);
          du_cpb_removal_delay_increment_length_minus1 = reader.read(5);
          sub_pic_cpb_params_in_pic_timing_sei_flag = !!reader.next();
          dpb_output_delay_du_length_minus1 = reader.read(5);
        }
        bit_rate_scale = reader.read(4);
        cpb_size_scale = reader.read(4);
        if (sub_pic_hrd_params_present_flag) {
          cpb_size_du_scale = reader.read(4);
        }
        initial_cpb_removal_delay_length_minus1 = reader.read(5);
        au_cpb_removal_delay_length_minus1 = reader.read(5);
        dpb_output_delay_length_minus1 = reader.read(5);
      }
    }
    const fixed_pic_rate_general_flag = [];
    const fixed_pic_rate_within_cvs_flag = [];
    const elemental_duration_in_tc_minus1 = [];
    const low_delay_hrd_flag = [];
    const cpb_cnt_minus1 = [];
    const nalHrdParameters = [];
    const vclHrdParameters = [];
    for (let i = 0; i <= maxNumSubLayersMinus1; i += 1) {
      fixed_pic_rate_general_flag[i] = !!reader.next();
      if (!fixed_pic_rate_general_flag[i]) {
        fixed_pic_rate_within_cvs_flag[i] = !!reader.next();
      }
      if (fixed_pic_rate_within_cvs_flag[i]) {
        elemental_duration_in_tc_minus1[i] = reader.decodeExponentialGolombNumber();
      } else {
        low_delay_hrd_flag[i] = !!reader.next();
      }
      if (!low_delay_hrd_flag[i]) {
        cpb_cnt_minus1[i] = reader.decodeExponentialGolombNumber();
      }
      if (nal_hrd_parameters_present_flag) {
        nalHrdParameters[i] = parseSubLayerHrdParameters(reader, i, getCpbCnt(cpb_cnt_minus1[i]));
      }
      if (vcl_hrd_parameters_present_flag) {
        vclHrdParameters[i] = parseSubLayerHrdParameters(reader, i, getCpbCnt(cpb_cnt_minus1[i]));
      }
    }
    return {
      nal_hrd_parameters_present_flag,
      vcl_hrd_parameters_present_flag,
      sub_pic_hrd_params_present_flag,
      tick_divisor_minus2,
      du_cpb_removal_delay_increment_length_minus1,
      sub_pic_cpb_params_in_pic_timing_sei_flag,
      dpb_output_delay_du_length_minus1,
      bit_rate_scale,
      cpb_size_scale,
      cpb_size_du_scale,
      initial_cpb_removal_delay_length_minus1,
      au_cpb_removal_delay_length_minus1,
      dpb_output_delay_length_minus1,
      fixed_pic_rate_general_flag,
      fixed_pic_rate_within_cvs_flag,
      elemental_duration_in_tc_minus1,
      low_delay_hrd_flag,
      cpb_cnt_minus1,
      nalHrdParameters,
      vclHrdParameters
    };
  }
  function parseSubLayerHrdParameters(reader, subLayerId, CpbCnt) {
    const bit_rate_value_minus1 = [];
    const cpb_size_value_minus1 = [];
    const cpb_size_du_value_minus1 = [];
    const bit_rate_du_value_minus1 = [];
    const cbr_flag = [];
    for (let i = 0; i < CpbCnt; i += 1) {
      bit_rate_value_minus1[i] = reader.decodeExponentialGolombNumber();
      cpb_size_value_minus1[i] = reader.decodeExponentialGolombNumber();
      if (subLayerId > 0) {
        cbr_flag[i] = !!reader.next();
      }
    }
    return {
      bit_rate_value_minus1,
      cpb_size_value_minus1,
      cpb_size_du_value_minus1,
      bit_rate_du_value_minus1,
      cbr_flag
    };
  }
  function getCpbCnt(cpb_cnt_minus_1) {
    return cpb_cnt_minus_1 + 1;
  }
  function searchConfiguration2(buffer3) {
    let videoParameterSet;
    let sequenceParameterSet;
    let pictureParameterSet;
    let count = 0;
    for (const nalu of annexBSplitNalu(buffer3)) {
      const header = parseNaluHeader(nalu);
      const raw = {
        ...header,
        data: nalu,
        rbsp: nalu.subarray(2)
      };
      switch (header.nal_unit_type) {
        case 32:
          videoParameterSet = raw;
          break;
        case 33:
          sequenceParameterSet = raw;
          break;
        case 34:
          pictureParameterSet = raw;
          break;
        default:
          continue;
      }
      count += 1;
      if (count === 3) {
        return {
          videoParameterSet,
          sequenceParameterSet,
          pictureParameterSet
        };
      }
    }
    throw new Error("Invalid data");
  }
  function parseSpsMultilayerExtension(reader) {
    const inter_view_mv_vert_constraint_flag = !!reader.next();
    return {
      inter_view_mv_vert_constraint_flag
    };
  }
  function parseSps3dExtension(reader) {
    const iv_di_mc_enabled_flag = [];
    const iv_mv_scal_enabled_flag = [];
    iv_di_mc_enabled_flag[0] = !!reader.next();
    iv_mv_scal_enabled_flag[0] = !!reader.next();
    const log2_ivmc_sub_pb_size_minus3 = reader.decodeExponentialGolombNumber();
    const iv_res_pred_enabled_flag = !!reader.next();
    const depth_ref_enabled_flag = !!reader.next();
    const vsp_mc_enabled_flag = !!reader.next();
    const dbbp_enabled_flag = !!reader.next();
    iv_di_mc_enabled_flag[1] = !!reader.next();
    iv_mv_scal_enabled_flag[1] = !!reader.next();
    const tex_mc_enabled_flag = !!reader.next();
    const log2_texmc_sub_pb_size_minus3 = reader.decodeExponentialGolombNumber();
    const intra_contour_enabled_flag = !!reader.next();
    const intra_dc_only_wedge_enabled_flag = !!reader.next();
    const cqt_cu_part_pred_enabled_flag = !!reader.next();
    const inter_dc_only_enabled_flag = !!reader.next();
    const skip_intra_enabled_flag = !!reader.next();
    return {
      iv_di_mc_enabled_flag,
      iv_mv_scal_enabled_flag,
      log2_ivmc_sub_pb_size_minus3,
      iv_res_pred_enabled_flag,
      depth_ref_enabled_flag,
      vsp_mc_enabled_flag,
      dbbp_enabled_flag,
      tex_mc_enabled_flag,
      log2_texmc_sub_pb_size_minus3,
      intra_contour_enabled_flag,
      intra_dc_only_wedge_enabled_flag,
      cqt_cu_part_pred_enabled_flag,
      inter_dc_only_enabled_flag,
      skip_intra_enabled_flag
    };
  }
  function parseConfiguration2(data) {
    const { videoParameterSet, sequenceParameterSet, pictureParameterSet } = searchConfiguration2(data);
    const { profileTierLevel: { generalProfileTier: { profile_space: generalProfileSpace, tier_flag: generalTierFlag, profile_idc: generalProfileIndex, profileCompatibilitySet: generalProfileCompatibilitySet, constraintSet: generalConstraintSet }, general_level_idc: generalLevelIndex } } = parseVideoParameterSet(videoParameterSet.rbsp);
    const { chroma_format_idc, pic_width_in_luma_samples: encodedWidth, pic_height_in_luma_samples: encodedHeight, conf_win_left_offset: cropLeft = 0, conf_win_right_offset: cropRight = 0, conf_win_top_offset: cropTop = 0, conf_win_bottom_offset: cropBottom = 0 } = parseSequenceParameterSet2(sequenceParameterSet.rbsp);
    const SubWidthC = getSubWidthC(chroma_format_idc);
    const SubHeightC = getSubHeightC(chroma_format_idc);
    const croppedWidth = encodedWidth - SubWidthC * (cropLeft + cropRight);
    const croppedHeight = encodedHeight - SubHeightC * (cropTop + cropBottom);
    return {
      videoParameterSet,
      sequenceParameterSet,
      pictureParameterSet,
      generalProfileSpace,
      generalProfileIndex,
      generalProfileCompatibilitySet,
      generalTierFlag,
      generalLevelIndex,
      generalConstraintSet,
      encodedWidth,
      encodedHeight,
      cropLeft,
      cropRight,
      cropTop,
      cropBottom,
      croppedWidth,
      croppedHeight
    };
  }
  function toCodecString2(configuration) {
    const { generalProfileSpace, generalProfileIndex, generalProfileCompatibilitySet, generalTierFlag, generalLevelIndex, generalConstraintSet } = configuration;
    return [
      "hev1",
      ["", "A", "B", "C"][generalProfileSpace] + generalProfileIndex.toString(),
      hexDigits(getUint32LittleEndian2(generalProfileCompatibilitySet, 0)),
      (generalTierFlag ? "H" : "L") + generalLevelIndex.toString(),
      ...Array.from(generalConstraintSet, hexDigits)
    ].join(".");
  }

  // node_modules/@yume-chan/media-codec/esm/vp8.js
  var vp8_exports = {};
  __export(vp8_exports, {
    parseFrameTag: () => parseFrameTag
  });
  function parseFrameTag(data) {
    const frame_tag = data[0] | data[1] << 8 | data[2] << 16;
    const key_frame = (frame_tag & 1) === 0;
    const version = frame_tag >> 1 & 7;
    const show_frame = (frame_tag >> 4 & 1) === 1;
    const first_part_size = frame_tag >> 5;
    if (key_frame) {
      if (data[3] !== 157 || data[4] !== 1 || data[5] !== 42) {
        throw new Error("Invalid VP8 frame");
      }
      const width = data[6] | (data[7] & 63) << 8;
      const horizontal_scale = (data[7] & 192) >> 6;
      const height = data[8] | (data[9] & 63) << 8;
      const vertical_scale = (data[9] & 192) >> 6;
      return {
        key_frame,
        version,
        show_frame,
        first_part_size,
        width,
        horizontal_scale,
        height,
        vertical_scale
      };
    }
    return {
      key_frame,
      version,
      show_frame,
      first_part_size
    };
  }

  // node_modules/@yume-chan/media-codec/esm/vp9.js
  var vp9_exports = {};
  __export(vp9_exports, {
    FrameTypeKeyFrame: () => FrameTypeKeyFrame,
    FrameTypeNonKeyFrame: () => FrameTypeNonKeyFrame,
    parseFrameHeader: () => parseFrameHeader
  });
  var BitReader2 = class {
    #data;
    #byteOffset = 0;
    // Trigger load on first read
    #bitOffset = 8;
    #cache;
    constructor(data) {
      this.#data = data;
    }
    #load() {
      if (this.#bitOffset !== 8) {
        return;
      }
      if (this.#byteOffset >= this.#data.length) {
        throw new Error("Out of data");
      }
      this.#cache = this.#data[this.#byteOffset];
      this.#byteOffset += 1;
      this.#bitOffset = 0;
    }
    readBit() {
      this.#load();
      const value = this.#cache >> 7 - this.#bitOffset & 1;
      this.#bitOffset += 1;
      return value;
    }
    read(n) {
      if (n <= 0 || n > 32) {
        throw new Error("Invalid length");
      }
      let value = 0;
      for (let i = 0; i < n; i += 1) {
        value = value << 1 | this.readBit();
      }
      return value;
    }
  };
  var FrameTypeKeyFrame = 0;
  var FrameTypeNonKeyFrame = 1;
  function parseFrameHeader(data) {
    const reader = new BitReader2(data);
    const frame_marker = reader.read(2);
    if (frame_marker !== 2) {
      throw new Error("Invalid VP9 frame");
    }
    const profile_low_bit = reader.readBit();
    const profile_high_bit = reader.readBit();
    const Profile = profile_high_bit << 1 | profile_low_bit;
    if (Profile === 3) {
      reader.readBit();
    }
    const show_existing_frame = !!reader.readBit();
    if (show_existing_frame) {
      const frame_to_show_map_idx = reader.read(3);
      return {
        Profile,
        show_existing_frame,
        frame_to_show_map_idx
      };
    }
    const frame_type = reader.readBit();
    const show_frame = !!reader.readBit();
    const error_resilient_mode = reader.readBit();
    if (frame_type === FrameTypeKeyFrame) {
      parseFrameSyncCode(reader);
      const color_config = parseColorConfig(reader, Profile);
      const frame_size = parseFrameSize(reader);
      const render_size = parseRenderSize(reader, frame_size.FrameWidth, frame_size.FrameHeight);
      return {
        Profile,
        show_existing_frame,
        frame_type,
        show_frame,
        error_resilient_mode,
        color_config,
        frame_size,
        render_size
      };
    } else {
      let intra_only;
      if (!show_frame) {
        intra_only = !!reader.readBit();
      } else {
        intra_only = false;
      }
      let reset_frame_context;
      if (!error_resilient_mode) {
        reset_frame_context = reader.read(2);
      } else {
        reset_frame_context = 0;
      }
      if (intra_only) {
        parseFrameSyncCode(reader);
        let color_config;
        if (Profile > 0) {
          color_config = parseColorConfig(reader, Profile);
        } else {
          color_config = {
            BitDepth: 8,
            color_space: ColorSpaceCsBt601,
            subsampling_x: 1,
            subsampling_y: 1,
            color_range: 0
            // ????
          };
        }
        const refresh_frame_flags = reader.read(8);
        const frame_size = parseFrameSize(reader);
        const render_size = parseRenderSize(reader, frame_size.FrameWidth, frame_size.FrameHeight);
        return {
          Profile,
          show_existing_frame,
          frame_type,
          show_frame,
          error_resilient_mode,
          intra_only,
          reset_frame_context,
          color_config,
          refresh_frame_flags,
          frame_size,
          render_size
        };
      } else {
        return {
          Profile,
          show_existing_frame,
          frame_type,
          show_frame,
          error_resilient_mode,
          intra_only,
          reset_frame_context
        };
      }
    }
  }
  var ColorSpaceCsBt601 = 1;
  var ColorSpaceCsRgb = 7;
  function parseFrameSyncCode(reader) {
    if (reader.read(8) !== 73 || reader.read(8) !== 131 || reader.read(8) !== 66) {
      throw new Error("Invalid VP9 frame");
    }
  }
  function parseColorConfig(reader, Profile) {
    let BitDepth;
    if (Profile >= 2) {
      const ten_or_twelve_bit = reader.readBit();
      BitDepth = ten_or_twelve_bit ? 12 : 10;
    } else {
      BitDepth = 8;
    }
    const color_space = reader.read(3);
    let color_range;
    let subsampling_x;
    let subsampling_y;
    if (color_space !== ColorSpaceCsRgb) {
      color_range = reader.readBit();
      if (Profile === 1 || Profile === 3) {
        subsampling_x = reader.readBit();
        subsampling_y = reader.readBit();
        reader.readBit();
      } else {
        subsampling_x = 1;
        subsampling_y = 1;
      }
    } else {
      color_range = 1;
      if (Profile === 1 || Profile === 3) {
        subsampling_x = 0;
        subsampling_y = 0;
        reader.readBit();
      }
    }
    return {
      BitDepth,
      color_space,
      color_range,
      subsampling_x,
      subsampling_y
    };
  }
  function parseFrameSize(reader) {
    const frame_width_minus_1 = reader.read(16);
    const frame_height_minus_1 = reader.read(16);
    const FrameWidth = frame_width_minus_1 + 1;
    const FrameHeight = frame_height_minus_1 + 1;
    return {
      FrameWidth,
      FrameHeight
    };
  }
  function parseRenderSize(reader, FrameWidth, FrameHeight) {
    const render_and_frame_size_different = !!reader.readBit();
    if (render_and_frame_size_different) {
      const render_width_minus_1 = reader.read(16);
      const render_height_minus_1 = reader.read(16);
      const RenderWidth = render_width_minus_1 + 1;
      const RenderHeight = render_height_minus_1 + 1;
      return {
        render_and_frame_size_different,
        RenderWidth,
        RenderHeight
      };
    } else {
      return {
        render_and_frame_size_different,
        RenderWidth: FrameWidth,
        RenderHeight: FrameHeight
      };
    }
  }

  // node_modules/@yume-chan/adb-scrcpy/esm/video.js
  var AdbScrcpyVideoStream = class {
    #options;
    #metadata;
    get metadata() {
      return this.#metadata;
    }
    #stream;
    get stream() {
      return this.#stream;
    }
    #size = new ScrcpyVideoSizeImpl();
    get width() {
      return this.#size.width;
    }
    get height() {
      return this.#size.height;
    }
    get sizeChanged() {
      return this.#size.sizeChanged;
    }
    constructor(options, metadata, stream) {
      this.#options = options;
      this.#metadata = metadata;
      this.#stream = stream.pipeThrough(this.#options.createMediaStreamTransformer()).pipeThrough(new InspectStream(this.#handlePacket, {
        close: () => this.#size.dispose(),
        cancel: () => this.#size.dispose()
      }));
    }
    #supportSessionPackets = false;
    #handlePacket = (packet) => {
      switch (packet.type) {
        case "session":
          this.#supportSessionPackets = true;
          this.#size.setSize(packet.width, packet.height, packet.isClientResize);
          break;
        case "configuration":
          if (this.#supportSessionPackets) {
            break;
          }
          switch (this.#metadata.codec) {
            case codec_id_exports.H264:
              this.#configureH264(packet.data);
              break;
            case codec_id_exports.H265:
              this.#configureH265(packet.data);
              break;
          }
          break;
        case "data":
          if (this.#supportSessionPackets) {
            break;
          }
          switch (this.#metadata.codec) {
            case codec_id_exports.Av1:
              if (packet.keyframe !== false) {
                this.#configureAv1(packet.data);
              }
              break;
            case codec_id_exports.Vp8:
              if (packet.keyframe !== false) {
                this.#configureVp8(packet.data);
              }
              break;
            case codec_id_exports.Vp9:
              this.#configureVp9(packet.data);
              break;
          }
          break;
      }
    };
    #configureH264(data) {
      const { croppedWidth, croppedHeight } = h264_exports.parseConfiguration(data);
      this.#size.setSize(croppedWidth, croppedHeight);
    }
    #configureH265(data) {
      const { croppedWidth, croppedHeight } = h265_exports.parseConfiguration(data);
      this.#size.setSize(croppedWidth, croppedHeight);
    }
    #configureAv1(data) {
      const parser = new Av12(data);
      const sequenceHeader = parser.searchSequenceHeaderObu();
      if (!sequenceHeader) {
        return;
      }
      const { max_frame_width_minus_1, max_frame_height_minus_1 } = sequenceHeader;
      const width = max_frame_width_minus_1 + 1;
      const height = max_frame_height_minus_1 + 1;
      this.#size.setSize(width, height);
    }
    #configureVp8(data) {
      const { key_frame, width, height } = vp8_exports.parseFrameTag(data);
      if (key_frame) {
        this.#size.setSize(width, height);
      }
    }
    #configureVp9(data) {
      const { render_size } = vp9_exports.parseFrameHeader(data);
      if (render_size) {
        this.#size.setSize(render_size.RenderWidth, render_size.RenderHeight);
      }
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/esm/client.js
  function arrayToStream(array) {
    return new PushReadableStream3(async (controller) => {
      for (const item of array) {
        await controller.enqueue(item);
      }
    });
  }
  function concatStreams(...streams) {
    return new PushReadableStream3(async (controller) => {
      for (const stream of streams) {
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          await controller.enqueue(value);
        }
      }
    });
  }
  var AdbScrcpyExitedErrorBrand = /* @__PURE__ */ Symbol.for("AdbScrcpyExitedError.brand");
  var AdbScrcpyExitedError = class extends Error {
    [AdbScrcpyExitedErrorBrand] = true;
    static [Symbol.hasInstance](value) {
      return !!value?.[AdbScrcpyExitedErrorBrand];
    }
    output;
    constructor(output) {
      super("scrcpy server exited prematurely");
      this.output = output;
    }
  };
  var AdbScrcpyClient = class _AdbScrcpyClient {
    static async pushServer(adb, file, path = DefaultServerPath) {
      await adb.sync.write({
        path,
        readable: file
      });
    }
    static async start(adb, path, options) {
      let connection;
      let process;
      try {
        try {
          connection = options.createConnection(adb);
          await connection.initialize();
        } catch (e) {
          if (e instanceof AdbReverseNotSupportedError2) {
            options.value.tunnelForward = true;
            connection = options.createConnection(adb);
            await connection.initialize();
          } else {
            connection = void 0;
            throw e;
          }
        }
        const args = [
          // Use `CLASSPATH=` as `-cp` argument requires Android 8.0
          `CLASSPATH=${path}`,
          "app_process",
          /* unused */
          "/",
          "com.genymobile.scrcpy.Server",
          options.version,
          ...options.serialize()
        ];
        if (options.spawner) {
          process = await options.spawner(args);
        } else {
          process = await adb.subprocess.noneProtocol.spawn(args);
        }
        const output = process.output.pipeThrough(new TextDecoderStream2()).pipeThrough(new SplitStringStream("\n", { trimEnd: true }));
        const lines = [];
        const abortController = new AbortController3();
        const pipe = output.pipeTo(new WritableStream3({
          write(chunk) {
            lines.push(chunk);
          }
        }), {
          signal: abortController.signal,
          preventCancel: true
        }).catch((e) => {
          if (abortController.signal.aborted) {
            return;
          }
          throw e;
        });
        const streams = await Promise.race([
          process.exited.then(() => {
            throw new AdbScrcpyExitedError(lines);
          }),
          connection.getStreams()
        ]);
        abortController.abort();
        await pipe;
        return new _AdbScrcpyClient({
          options,
          process,
          output: concatStreams(arrayToStream(lines), output),
          videoStream: streams.video,
          audioStream: streams.audio,
          controlStream: streams.control
        });
      } catch (e) {
        await process?.kill();
        throw e;
      } finally {
        connection?.dispose();
      }
    }
    /**
     * This method will modify the given `options`,
     * so don't reuse it elsewhere.
     */
    static getEncoders(adb, path, options) {
      options.setListEncoders();
      return options.getEncoders(adb, path);
    }
    /**
     * This method will modify the given `options`,
     * so don't reuse it elsewhere.
     */
    static getDisplays(adb, path, options) {
      options.setListDisplays();
      return options.getDisplays(adb, path);
    }
    #options;
    get options() {
      return this.#options;
    }
    #process;
    #output;
    get output() {
      return this.#output;
    }
    get exited() {
      return this.#process.exited;
    }
    #videoStream;
    /**
     * Gets a `Promise` that resolves to the parsed video stream.
     *
     * On server version 2.1 and above, it will be `undefined` if
     * video is disabled by `options.video: false`.
     *
     * Note: if it's not `undefined`, it must be consumed to prevent
     * the connection from being blocked.
     */
    get videoStream() {
      return this.#videoStream;
    }
    #audioStream;
    /**
     * Gets a `Promise` that resolves to the parsed audio stream.
     *
     * On server versions before 2.0, it will always be `undefined`.
     * On server version 2.0 and above, it will be `undefined` if
     * audio is disabled by `options.audio: false`.
     *
     * Note: if it's not `undefined`, it must be consumed to prevent
     * the connection from being blocked.
     */
    get audioStream() {
      return this.#audioStream;
    }
    #controller;
    /**
     * Gets the control message writer.
     *
     * On server version 1.22 and above, it will be `undefined` if
     * control is disabled by `options.control: false`.
     */
    get controller() {
      return this.#controller;
    }
    get clipboard() {
      return this.#options.clipboard;
    }
    constructor({ options, process, output, videoStream, audioStream, controlStream }) {
      this.#options = options;
      this.#process = process;
      this.#output = output;
      this.#videoStream = videoStream ? this.#createVideoStream(videoStream) : void 0;
      this.#audioStream = audioStream ? this.#createAudioStream(audioStream) : void 0;
      if (controlStream) {
        this.#controller = new ScrcpyControlMessageWriter(controlStream.writable.getWriter(), options);
        this.#parseDeviceMessages(controlStream.readable).catch(() => {
        });
      }
    }
    async #parseDeviceMessages(controlStream) {
      const buffered = new BufferedReadableStream3(controlStream);
      try {
        while (true) {
          let id;
          try {
            const result = await buffered.readExactly(1);
            id = result[0];
          } catch (e) {
            if (e instanceof ExactReadableEndedError3) {
              this.#options.deviceMessageParsers.close();
              break;
            }
            throw e;
          }
          await this.#options.deviceMessageParsers.parse(id, buffered);
        }
      } catch (e) {
        this.#options.deviceMessageParsers.error(e);
        await tryCancel3(buffered);
      }
    }
    async #createVideoStream(initialStream) {
      const { metadata, stream } = await this.#options.parseVideoStreamMetadata(initialStream);
      return new AdbScrcpyVideoStream(this.#options, metadata, stream);
    }
    async #createAudioStream(initialStream) {
      if (!this.#options.parseAudioStreamMetadata) {
        throw new Error("parsing audio stream is not supported in this version");
      }
      const metadata = await this.#options.parseAudioStreamMetadata(initialStream);
      switch (metadata.type) {
        case "disabled":
        case "errored":
          return metadata;
        case "success":
          return {
            ...metadata,
            stream: metadata.stream.pipeThrough(this.#options.createMediaStreamTransformer())
          };
        default:
          throw new Error(`Unexpected audio metadata type ${metadata["type"]}`);
      }
    }
    async close() {
      await this.#process.kill();
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/esm/1_15/impl/get-displays.js
  async function getDisplays(adb, path, options) {
    try {
      const client = await AdbScrcpyClient.start(adb, path, options);
      await client.close();
      throw new Error("Unexpected server output");
    } catch (e) {
      if (e instanceof AdbScrcpyExitedError) {
        if (e.output[0]?.startsWith("[server] ERROR:")) {
          throw e;
        }
        const displays = [];
        for (const line of e.output) {
          const display = options.parseDisplay(line);
          if (display) {
            displays.push(display);
          }
        }
        return displays;
      }
      throw e;
    }
  }

  // node_modules/@yume-chan/adb-scrcpy/esm/2_0/impl/get-encoders.js
  async function getEncoders(adb, path, options) {
    try {
      const client = await AdbScrcpyClient.start(adb, path, options);
      await client.close();
      throw new Error("Unexpected server output");
    } catch (e) {
      if (e instanceof AdbScrcpyExitedError) {
        if (e.output[0]?.startsWith("[server] ERROR:")) {
          throw e;
        }
        const encoders = [];
        for (const line of e.output) {
          const encoder = options.parseEncoder(line);
          if (encoder) {
            encoders.push(encoder);
          }
        }
        return encoders;
      }
      throw e;
    }
  }

  // node_modules/@yume-chan/adb-scrcpy/esm/2_1/impl/create-connection.js
  function createConnection(adb, options) {
    const connectionOptions = {
      scid: toScrcpyOptionValue(options.scid, void 0),
      video: options.video,
      audio: options.audio,
      control: options.control,
      sendDummyByte: options.sendDummyByte
    };
    if (options.tunnelForward) {
      return new AdbScrcpyForwardConnection(adb, connectionOptions);
    } else {
      return new AdbScrcpyReverseConnection(adb, connectionOptions);
    }
  }

  // node_modules/@yume-chan/adb-scrcpy/esm/4_1.js
  var AdbScrcpyOptions4_1 = class extends ScrcpyOptions4_1 {
    version;
    spawner;
    constructor(init, clientOptions) {
      super(init);
      this.version = clientOptions?.version ?? "4.1";
      this.spawner = clientOptions?.spawner;
    }
    getEncoders(adb, path) {
      return getEncoders(adb, path, this);
    }
    getDisplays(adb, path) {
      return getDisplays(adb, path, this);
    }
    createConnection(adb) {
      return createConnection(adb, this.value);
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/node_modules/@yume-chan/scrcpy/esm/base/video.js
  var ScrcpyVideoCodecId = {
    H264: 1748121140,
    H265: 1748121141,
    AV1: 6387249
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/node_modules/@yume-chan/scrcpy/esm/codec/av1.js
  var AndroidAv1Profile2 = {
    Main8: 1 << 0,
    Main10: 1 << 1,
    Main10Hdr10: 1 << 12,
    Main10Hdr10Plus: 1 << 13
  };
  var AndroidAv1Level2 = {
    Level2: 1 << 0,
    Level21: 1 << 1,
    Level22: 1 << 2,
    Level23: 1 << 3,
    Level3: 1 << 4,
    Level31: 1 << 5,
    Level32: 1 << 6,
    Level33: 1 << 7,
    Level4: 1 << 8,
    Level41: 1 << 9,
    Level42: 1 << 10,
    Level43: 1 << 11,
    Level5: 1 << 12,
    Level51: 1 << 13,
    Level52: 1 << 14,
    Level53: 1 << 15,
    Level6: 1 << 16,
    Level61: 1 << 17,
    Level62: 1 << 18,
    Level63: 1 << 19,
    Level7: 1 << 20,
    Level71: 1 << 21,
    Level72: 1 << 22,
    Level73: 1 << 23
  };
  var BitReader3 = class {
    #data;
    #byte;
    #bytePosition = 0;
    #bitPosition = 7;
    get byteAligned() {
      return this.#bitPosition === 7;
    }
    get ended() {
      return this.#bytePosition >= this.#data.length;
    }
    constructor(data) {
      this.#data = data;
      this.#byte = data[0];
    }
    f1() {
      const value = this.#byte >> this.#bitPosition;
      this.#bitPosition -= 1;
      if (this.#bitPosition < 0) {
        this.#bytePosition += 1;
        this.#bitPosition = 7;
        this.#byte = this.#data[this.#bytePosition];
      }
      return value & 1;
    }
    f(n) {
      let value = 0;
      for (; n > 0; n -= 1) {
        value <<= 1;
        value |= this.f1();
      }
      return value;
    }
    skip(n) {
      if (n <= this.#bitPosition + 1) {
        this.#bytePosition += 1;
        this.#bitPosition = 7;
        this.#byte = this.#data[this.#bytePosition];
        return;
      }
      n -= this.#bitPosition + 1;
      this.#bytePosition += 1;
      const bytes = n / 8 | 0;
      if (bytes > 0) {
        this.#bytePosition += bytes;
        n -= bytes * 8;
      }
      this.#bitPosition = 7 - n;
      this.#byte = this.#data[this.#bytePosition];
    }
    readBytes(n) {
      if (!this.byteAligned) {
        throw new Error("Bytes must be byte-aligned");
      }
      const value = this.#data.subarray(this.#bytePosition, this.#bytePosition + n);
      this.#bytePosition += n;
      this.#byte = this.#data[this.#bytePosition];
      return value;
    }
    getPosition() {
      return [this.#bytePosition, this.#bitPosition];
    }
    setPosition([bytePosition, bitPosition]) {
      this.#bytePosition = bytePosition;
      this.#bitPosition = bitPosition;
      this.#byte = this.#data[bytePosition];
    }
  };
  var ObuType2 = {
    SequenceHeader: 1,
    TemporalDelimiter: 2,
    FrameHeader: 3,
    TileGroup: 4,
    Metadata: 5,
    Frame: 6,
    RedundantFrameHeader: 7,
    TileList: 8,
    Padding: 15
  };
  var ColorPrimaries2 = {
    Bt709: 1,
    Unspecified: 2,
    Bt470M: 4,
    Bt470BG: 5,
    Bt601: 6,
    Smpte240: 7,
    GenericFilm: 8,
    Bt2020: 9,
    Xyz: 10,
    Smpte431: 11,
    Smpte432: 12,
    Ebu3213: 22
  };
  var TransferCharacteristics2 = {
    Bt709: 1,
    Unspecified: 2,
    Bt470M: 4,
    Bt470BG: 5,
    Bt601: 6,
    Smpte240: 7,
    Linear: 8,
    Log100: 9,
    Log100Sqrt10: 10,
    Iec61966: 11,
    Bt1361: 12,
    Srgb: 13,
    Bt2020Ten: 14,
    Bt2020Twelve: 15,
    Smpte2084: 16,
    Smpte428: 17,
    Hlg: 18
  };
  var MatrixCoefficients2 = {
    Identity: 0,
    Bt709: 1,
    Unspecified: 2,
    Fcc: 4,
    Bt470BG: 5,
    Bt601: 6,
    Smpte240: 7,
    YCgCo: 8,
    Bt2020Ncl: 9,
    Bt2020Cl: 10,
    Smpte2085: 11,
    ChromatNcl: 12,
    ChromatCl: 13,
    ICtCp: 14
  };
  var Av13 = class _Av1 extends BitReader3 {
    static ObuType = ObuType2;
    static ColorPrimaries = ColorPrimaries2;
    static TransferCharacteristics = TransferCharacteristics2;
    static MatrixCoefficients = MatrixCoefficients2;
    #Leb128Bytes = 0;
    uvlc() {
      let leadingZeros = 0;
      while (!this.f1()) {
        leadingZeros += 1;
      }
      if (leadingZeros >= 32) {
        return 2 ** 32 - 1;
      }
      const value = this.f(leadingZeros);
      return value + (1 << leadingZeros >>> 0) - 1;
    }
    leb128() {
      if (!this.byteAligned) {
        throw new Error("LEB128 must be byte-aligned");
      }
      let value = 0n;
      this.#Leb128Bytes = 0;
      for (let i = 0n; i < 8n; i += 1n) {
        const leb128_byte = this.f(8);
        value |= BigInt(leb128_byte & 127) << 7n * i;
        this.#Leb128Bytes += 1;
        if ((leb128_byte & 128) == 0) {
          break;
        }
      }
      return value;
    }
    *annexBBitstream() {
      while (!this.ended) {
        const temporal_unit_size = this.leb128();
        yield* this.temporalUnit(temporal_unit_size);
      }
    }
    *temporalUnit(sz) {
      while (sz > 0) {
        const frame_unit_size = this.leb128();
        sz -= BigInt(this.#Leb128Bytes);
        yield* this.frameUnit(frame_unit_size);
        sz -= frame_unit_size;
      }
    }
    *frameUnit(sz) {
      while (sz > 0) {
        const obu_length = this.leb128();
        sz -= BigInt(this.#Leb128Bytes);
        const obu = this.openBitstreamUnit(obu_length);
        if (obu) {
          yield obu;
        }
        sz -= obu_length;
      }
    }
    #OperatingPointIdc = 0;
    openBitstreamUnit(sz) {
      const obu_header = this.obuHeader();
      let obu_size;
      if (obu_header.obu_has_size_field) {
        obu_size = this.leb128();
      } else if (sz !== void 0) {
        obu_size = sz - 1n - (obu_header.obu_extension_flag ? 1n : 0n);
      } else {
        throw new Error("obu_has_size_field must be true");
      }
      const startPosition = this.getPosition();
      if (obu_header.obu_type !== _Av1.ObuType.SequenceHeader && obu_header.obu_type !== _Av1.ObuType.TemporalDelimiter && this.#OperatingPointIdc !== 0 && obu_header.obu_extension_header) {
        const inTemporalLayer = !!(this.#OperatingPointIdc & 1 << obu_header.obu_extension_header.temporal_id);
        const inSpatialLayer = !!(this.#OperatingPointIdc & 1 << obu_header.obu_extension_header.spatial_id + 8);
        if (!inTemporalLayer || !inSpatialLayer) {
          this.skip(Number(obu_size));
          return;
        }
      }
      let sequence_header_obu;
      switch (obu_header.obu_type) {
        case _Av1.ObuType.SequenceHeader:
          sequence_header_obu = this.sequenceHeaderObu();
          break;
      }
      const currentPosition = this.getPosition();
      const payloadBits = (currentPosition[0] - startPosition[0]) * 8 + (startPosition[1] - currentPosition[1]);
      if (obu_size > 0) {
        this.skip(Number(obu_size) * 8 - payloadBits);
      }
      return {
        obu_header,
        obu_size,
        sequence_header_obu
      };
    }
    obuHeader() {
      const obu_forbidden_bit = !!this.f1();
      if (obu_forbidden_bit) {
        throw new Error("Invalid data");
      }
      const obu_type = this.f(4);
      const obu_extension_flag = !!this.f1();
      const obu_has_size_field = !!this.f1();
      this.f1();
      let obu_extension_header;
      if (obu_extension_flag) {
        obu_extension_header = this.obuExtensionHeader();
      }
      return {
        obu_type,
        obu_extension_flag,
        obu_has_size_field,
        obu_extension_header
      };
    }
    obuExtensionHeader() {
      const temporal_id = this.f(3);
      const spatial_id = this.f(2);
      this.skip(3);
      return { temporal_id, spatial_id };
    }
    static SelectScreenContentTools = 2;
    static SelectIntegerMv = 2;
    sequenceHeaderObu() {
      const seq_profile = this.f(3);
      const still_picture = !!this.f1();
      const reduced_still_picture_header = !!this.f1();
      let timing_info_present_flag = false;
      let timing_info;
      let decoder_model_info_present_flag = false;
      let decoder_model_info;
      let initial_display_delay_present_flag = false;
      let operating_points_cnt_minus_1 = 0;
      const operating_point_idc = [];
      const seq_level_idx = [];
      const seq_tier = [];
      const decoder_model_present_for_this_op = [];
      const initial_display_delay_present_for_this_op = [];
      let operating_parameters_info;
      let initial_display_delay_minus_1;
      if (reduced_still_picture_header) {
        operating_point_idc[0] = 0;
        seq_level_idx[0] = this.f(5);
        seq_tier[0] = 0;
        decoder_model_present_for_this_op[0] = false;
        initial_display_delay_present_for_this_op[0] = false;
      } else {
        timing_info_present_flag = !!this.f1();
        if (timing_info_present_flag) {
          timing_info = this.timingInfo();
          decoder_model_info_present_flag = !!this.f1();
          if (decoder_model_info_present_flag) {
            decoder_model_info = this.decoderModelInfo();
            operating_parameters_info = [];
          }
        }
        initial_display_delay_present_flag = !!this.f1();
        if (initial_display_delay_present_flag) {
          initial_display_delay_minus_1 = [];
        }
        operating_points_cnt_minus_1 = this.f(5);
        for (let i = 0; i <= operating_points_cnt_minus_1; i += 1) {
          operating_point_idc[i] = this.f(12);
          seq_level_idx[i] = this.f(5);
          if (seq_level_idx[i] > 7) {
            seq_tier[i] = this.f1();
          } else {
            seq_tier[i] = 0;
          }
          if (decoder_model_info_present_flag) {
            decoder_model_present_for_this_op[i] = !!this.f1();
            if (decoder_model_present_for_this_op[i]) {
              operating_parameters_info[i] = this.operatingParametersInfo(decoder_model_info);
            }
          } else {
            decoder_model_present_for_this_op[i] = false;
          }
          if (initial_display_delay_present_flag) {
            initial_display_delay_present_for_this_op[i] = !!this.f1();
            if (initial_display_delay_present_for_this_op[i]) {
              initial_display_delay_minus_1[i] = this.f(4);
            }
          }
        }
      }
      const operatingPoint = this.chooseOperatingPoint();
      this.#OperatingPointIdc = operating_point_idc[operatingPoint];
      const frame_width_bits_minus_1 = this.f(4);
      const frame_height_bits_minus_1 = this.f(4);
      const max_frame_width_minus_1 = this.f(frame_width_bits_minus_1 + 1);
      const max_frame_height_minus_1 = this.f(frame_height_bits_minus_1 + 1);
      let frame_id_numbers_present_flag = false;
      let delta_frame_id_length_minus_2;
      let additional_frame_id_length_minus_1;
      if (!reduced_still_picture_header) {
        frame_id_numbers_present_flag = !!this.f1();
        if (frame_id_numbers_present_flag) {
          delta_frame_id_length_minus_2 = this.f(4);
          additional_frame_id_length_minus_1 = this.f(3);
        }
      }
      const use_128x128_superblock = !!this.f1();
      const enable_filter_intra = !!this.f1();
      const enable_intra_edge_filter = !!this.f1();
      let enable_interintra_compound = false;
      let enable_masked_compound = false;
      let enable_warped_motion = false;
      let enable_dual_filter = false;
      let enable_order_hint = false;
      let enable_jnt_comp = false;
      let enable_ref_frame_mvs = false;
      let seq_choose_screen_content_tools = false;
      let seq_force_screen_content_tools = _Av1.SelectScreenContentTools;
      let seq_choose_integer_mv = false;
      let seq_force_integer_mv = _Av1.SelectIntegerMv;
      let order_hint_bits_minus_1;
      if (!reduced_still_picture_header) {
        enable_interintra_compound = !!this.f1();
        enable_masked_compound = !!this.f1();
        enable_warped_motion = !!this.f1();
        enable_dual_filter = !!this.f1();
        enable_order_hint = !!this.f1();
        if (enable_order_hint) {
          enable_jnt_comp = !!this.f1();
          enable_ref_frame_mvs = !!this.f1();
        }
        seq_choose_screen_content_tools = !!this.f1();
        if (!seq_choose_screen_content_tools) {
          seq_force_screen_content_tools = this.f1();
        }
        if (seq_force_screen_content_tools > 0) {
          seq_choose_integer_mv = !!this.f1();
          if (!seq_choose_integer_mv) {
            seq_force_integer_mv = this.f1();
          }
        }
        if (enable_order_hint) {
          order_hint_bits_minus_1 = this.f(3);
        }
      }
      const enable_superres = !!this.f1();
      const enable_cdef = !!this.f1();
      const enable_restoration = !!this.f1();
      const color_config = this.colorConfig(seq_profile);
      const film_grain_params_present = !!this.f1();
      return {
        seq_profile,
        still_picture,
        reduced_still_picture_header,
        timing_info_present_flag,
        timing_info,
        decoder_model_info_present_flag,
        decoder_model_info,
        initial_display_delay_present_flag,
        initial_display_delay_minus_1,
        operating_points_cnt_minus_1,
        operating_point_idc,
        seq_level_idx,
        seq_tier,
        decoder_model_present_for_this_op,
        operating_parameters_info,
        initial_display_delay_present_for_this_op,
        frame_width_bits_minus_1,
        frame_height_bits_minus_1,
        max_frame_width_minus_1,
        max_frame_height_minus_1,
        frame_id_numbers_present_flag,
        delta_frame_id_length_minus_2,
        additional_frame_id_length_minus_1,
        use_128x128_superblock,
        enable_filter_intra,
        enable_intra_edge_filter,
        enable_interintra_compound,
        enable_masked_compound,
        enable_warped_motion,
        enable_dual_filter,
        enable_order_hint,
        enable_jnt_comp,
        enable_ref_frame_mvs,
        seq_choose_screen_content_tools,
        seq_force_screen_content_tools,
        seq_choose_integer_mv,
        seq_force_integer_mv,
        order_hint_bits_minus_1,
        enable_superres,
        enable_cdef,
        enable_restoration,
        color_config,
        film_grain_params_present
      };
    }
    searchSequenceHeaderObu() {
      while (!this.ended) {
        const obu = this.openBitstreamUnit();
        if (!obu) {
          continue;
        }
        if (obu.sequence_header_obu) {
          return obu.sequence_header_obu;
        }
      }
      return void 0;
    }
    timingInfo() {
      const num_units_in_display_tick = this.f(32);
      const time_scale = this.f(32);
      const equal_picture_interval = !!this.f1();
      let num_ticks_per_picture_minus_1;
      if (equal_picture_interval) {
        num_ticks_per_picture_minus_1 = this.uvlc();
      }
      return {
        num_units_in_display_tick,
        time_scale,
        equal_picture_interval,
        num_ticks_per_picture_minus_1
      };
    }
    decoderModelInfo() {
      const buffer_delay_length_minus_1 = this.f(5);
      const num_units_in_decoding_tick = this.f(32);
      const buffer_removal_time_length_minus_1 = this.f(5);
      const frame_presentation_time_length_minus_1 = this.f(5);
      return {
        buffer_delay_length_minus_1,
        num_units_in_decoding_tick,
        buffer_removal_time_length_minus_1,
        frame_presentation_time_length_minus_1
      };
    }
    operatingParametersInfo(decoderModelInfo) {
      const n = decoderModelInfo.buffer_delay_length_minus_1 + 1;
      const decoder_buffer_delay = this.f(n);
      const encoder_buffer_delay = this.f(n);
      const low_delay_mode_flag = !!this.f1();
      return {
        decoder_buffer_delay,
        encoder_buffer_delay,
        low_delay_mode_flag
      };
    }
    chooseOperatingPoint() {
      return 0;
    }
    colorConfig(seq_profile) {
      const high_bitdepth = !!this.f1();
      let twelve_bit = false;
      let BitDepth = 8;
      if (seq_profile === 2 && high_bitdepth) {
        twelve_bit = !!this.f1();
        BitDepth = twelve_bit ? 12 : 10;
      } else if (seq_profile <= 2) {
        BitDepth = high_bitdepth ? 10 : 8;
      }
      let mono_chrome = false;
      if (seq_profile === 1) {
        mono_chrome = !!this.f1();
      }
      const color_description_present_flag = !!this.f1();
      let color_primaries = _Av1.ColorPrimaries.Unspecified;
      let transfer_characteristics = _Av1.TransferCharacteristics.Unspecified;
      let matrix_coefficients = _Av1.MatrixCoefficients.Unspecified;
      if (color_description_present_flag) {
        color_primaries = this.f(8);
        transfer_characteristics = this.f(8);
        matrix_coefficients = this.f(8);
      }
      let color_range = false;
      let subsampling_x;
      let subsampling_y;
      let chroma_sample_position = 0;
      let separate_uv_delta_q = false;
      if (mono_chrome) {
        color_range = !!this.f1();
        subsampling_x = true;
        subsampling_y = true;
      } else {
        if (color_primaries === _Av1.ColorPrimaries.Bt709 && transfer_characteristics === _Av1.TransferCharacteristics.Srgb && matrix_coefficients === _Av1.MatrixCoefficients.Identity) {
          color_range = true;
          subsampling_x = false;
          subsampling_y = false;
        } else {
          color_range = !!this.f1();
          switch (seq_profile) {
            case 0:
              subsampling_x = true;
              subsampling_y = true;
              break;
            case 1:
              subsampling_x = false;
              subsampling_y = false;
              break;
            default:
              if (BitDepth == 12) {
                subsampling_x = !!this.f1();
                if (subsampling_x) {
                  subsampling_y = !!this.f1();
                } else {
                  subsampling_y = false;
                }
              } else {
                subsampling_x = true;
                subsampling_y = false;
              }
              break;
          }
          if (subsampling_x && subsampling_y) {
            chroma_sample_position = this.f(2);
          }
        }
        separate_uv_delta_q = !!this.f1();
      }
      return {
        high_bitdepth,
        twelve_bit,
        BitDepth,
        mono_chrome,
        color_description_present_flag,
        color_primaries,
        transfer_characteristics,
        matrix_coefficients,
        color_range,
        subsampling_x,
        subsampling_y,
        chroma_sample_position,
        separate_uv_delta_q
      };
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/node_modules/@yume-chan/scrcpy/esm/codec/nalu.js
  function* annexBSplitNalu2(buffer3) {
    let start = -1;
    let zeroCount = 0;
    let inEmulation = false;
    for (let i = 0; i < buffer3.length; i += 1) {
      const byte = buffer3[i];
      if (inEmulation) {
        if (byte > 3) {
          throw new Error("Invalid data");
        }
        inEmulation = false;
        continue;
      }
      if (byte === 0) {
        zeroCount += 1;
        continue;
      }
      const prevZeroCount = zeroCount;
      zeroCount = 0;
      if (start === -1) {
        if (prevZeroCount >= 2 && byte === 1) {
          start = i + 1;
          continue;
        }
        throw new Error("Invalid data");
      }
      if (prevZeroCount < 2) {
        continue;
      }
      if (byte === 1) {
        yield buffer3.subarray(start, i - prevZeroCount);
        start = i + 1;
        continue;
      }
      if (prevZeroCount > 2) {
        throw new Error("Invalid data");
      }
      switch (byte) {
        case 2:
          throw new Error("Invalid data");
        case 3:
          inEmulation = true;
          break;
        default:
          break;
      }
    }
    if (inEmulation) {
      throw new Error("Invalid data");
    }
    yield buffer3.subarray(start, buffer3.length);
  }
  var NaluSodbBitReader2 = class {
    #nalu;
    // logical length is `#byteLength * 8 + (7 - #stopBitIndex)`
    #byteLength;
    #stopBitIndex;
    #zeroCount = 0;
    // logical position is `#bytePosition * 8 + (7 - #bitPosition)`
    #bytePosition = 0;
    #bitPosition = 7;
    #byte = 0;
    get byteLength() {
      return this.#byteLength;
    }
    get stopBitIndex() {
      return this.#stopBitIndex;
    }
    get bytePosition() {
      return this.#bytePosition;
    }
    get bitPosition() {
      return this.#bitPosition;
    }
    get ended() {
      return this.#bytePosition >= this.#byteLength && this.#bitPosition <= this.#stopBitIndex;
    }
    constructor(nalu) {
      this.#nalu = nalu;
      for (let i = nalu.length - 1; i >= 0; i -= 1) {
        if (this.#nalu[i] === 0) {
          continue;
        }
        const byte = nalu[i];
        for (let j = 0; j < 8; j += 1) {
          if ((byte >> j & 1) === 1) {
            this.#byteLength = i;
            this.#stopBitIndex = j;
            this.#loadByte();
            return;
          }
        }
      }
      throw new Error("Stop bit not found");
    }
    #loadByte() {
      this.#byte = this.#nalu[this.#bytePosition];
      if (this.#zeroCount === 2 && this.#byte === 3) {
        this.#zeroCount = 0;
        this.#bytePosition += 1;
        this.#loadByte();
        return;
      }
      if (this.#byte === 0) {
        this.#zeroCount += 1;
      } else {
        this.#zeroCount = 0;
      }
    }
    next() {
      if (this.ended) {
        throw new Error("Bit index out of bounds");
      }
      const value = this.#byte >> this.#bitPosition & 1;
      this.#bitPosition -= 1;
      if (this.#bitPosition < 0) {
        this.#bytePosition += 1;
        this.#bitPosition = 7;
        this.#loadByte();
      }
      return value;
    }
    read(length) {
      if (length > 32) {
        throw new Error("Read length too large");
      }
      let result = 0;
      for (let i = 0; i < length; i += 1) {
        result = result << 1 | this.next();
      }
      return result;
    }
    /**
     * Throws an error if the current position is invalid for `skip`.
     *
     * Usually it will throw if `ended` is `true`,
     * except when the bit position is at the stop bit,
     * in which case `ended` will be `true`, but it won't throw.
     * `skip` can skip all remaining bits, and stop at the end position.
     * The next `next` call will throw since there is no more bits to read.
     */
    #checkSkipPosition() {
      if (this.#bytePosition >= this.#byteLength && this.#bitPosition < this.#stopBitIndex) {
        throw new Error("Bit index out of bounds");
      }
    }
    skip(length) {
      if (length <= this.#bitPosition + 1) {
        this.#bitPosition -= length;
        this.#checkSkipPosition();
        return;
      }
      length -= this.#bitPosition + 1;
      this.#bytePosition += 1;
      this.#bitPosition = 7;
      this.#loadByte();
      this.#checkSkipPosition();
      for (; length >= 8; length -= 8) {
        this.#bytePosition += 1;
        this.#loadByte();
        this.#checkSkipPosition();
      }
      this.#bitPosition = 7 - length;
      this.#checkSkipPosition();
    }
    decodeExponentialGolombNumber() {
      let length = 0;
      while (this.next() === 0) {
        length += 1;
      }
      if (length === 0) {
        return 0;
      }
      return (1 << length | this.read(length)) - 1;
    }
    #save() {
      return {
        zeroCount: this.#zeroCount,
        bytePosition: this.#bytePosition,
        bitPosition: this.#bitPosition,
        byte: this.#byte
      };
    }
    #restore(state) {
      this.#zeroCount = state.zeroCount;
      this.#bytePosition = state.bytePosition;
      this.#bitPosition = state.bitPosition;
      this.#byte = state.byte;
    }
    peek(length) {
      const state = this.#save();
      const result = this.read(length);
      this.#restore(state);
      return result;
    }
    readBytes(length) {
      const result = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) {
        result[i] = this.read(8);
      }
      return result;
    }
    peekBytes(length) {
      const state = this.#save();
      const result = this.readBytes(length);
      this.#restore(state);
      return result;
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/node_modules/@yume-chan/scrcpy/esm/codec/h264.js
  var AndroidAvcProfile = {
    Baseline: 1 << 0,
    Main: 1 << 1,
    Extended: 1 << 2,
    High: 1 << 3,
    High10: 1 << 4,
    High422: 1 << 5,
    High444: 1 << 6,
    ConstrainedBaseline: 1 << 16,
    ConstrainedHigh: 1 << 19
  };
  var AndroidAvcLevel = {
    Level1: 1 << 0,
    Level1b: 1 << 1,
    Level11: 1 << 2,
    Level12: 1 << 3,
    Level13: 1 << 4,
    Level2: 1 << 5,
    Level21: 1 << 6,
    Level22: 1 << 7,
    Level3: 1 << 8,
    Level31: 1 << 9,
    Level32: 1 << 10,
    Level4: 1 << 11,
    Level41: 1 << 12,
    Level42: 1 << 13,
    Level5: 1 << 14,
    Level51: 1 << 15,
    Level52: 1 << 16,
    Level6: 1 << 17,
    Level61: 1 << 18,
    Level62: 1 << 19
  };
  function h264ParseSequenceParameterSet(nalu) {
    const reader = new NaluSodbBitReader2(nalu);
    if (reader.next() !== 0) {
      throw new Error("Invalid data");
    }
    const nal_ref_idc = reader.read(2);
    const nal_unit_type = reader.read(5);
    if (nal_unit_type !== 7) {
      throw new Error("Invalid data");
    }
    if (nal_ref_idc === 0) {
      throw new Error("Invalid data");
    }
    const profile_idc = reader.read(8);
    const constraint_set = reader.peek(8);
    const constraint_set0_flag = !!reader.next();
    const constraint_set1_flag = !!reader.next();
    const constraint_set2_flag = !!reader.next();
    const constraint_set3_flag = !!reader.next();
    const constraint_set4_flag = !!reader.next();
    const constraint_set5_flag = !!reader.next();
    if (reader.read(2) !== 0) {
      throw new Error("Invalid data");
    }
    const level_idc = reader.read(8);
    const seq_parameter_set_id = reader.decodeExponentialGolombNumber();
    if (profile_idc === 100 || profile_idc === 110 || profile_idc === 122 || profile_idc === 244 || profile_idc === 44 || profile_idc === 83 || profile_idc === 86 || profile_idc === 118 || profile_idc === 128 || profile_idc === 138 || profile_idc === 139 || profile_idc === 134) {
      const chroma_format_idc = reader.decodeExponentialGolombNumber();
      if (chroma_format_idc === 3) {
        reader.next();
      }
      reader.decodeExponentialGolombNumber();
      reader.decodeExponentialGolombNumber();
      reader.next();
      const seq_scaling_matrix_present_flag = !!reader.next();
      if (seq_scaling_matrix_present_flag) {
        const seq_scaling_list_present_flag = [];
        for (let i = 0; i < (chroma_format_idc !== 3 ? 8 : 12); i += 1) {
          seq_scaling_list_present_flag[i] = !!reader.next();
          if (seq_scaling_list_present_flag[i])
            if (i < 6) {
            } else {
            }
        }
      }
    }
    reader.decodeExponentialGolombNumber();
    const pic_order_cnt_type = reader.decodeExponentialGolombNumber();
    if (pic_order_cnt_type === 0) {
      reader.decodeExponentialGolombNumber();
    } else if (pic_order_cnt_type === 1) {
      reader.next();
      reader.decodeExponentialGolombNumber();
      reader.decodeExponentialGolombNumber();
      const num_ref_frames_in_pic_order_cnt_cycle = reader.decodeExponentialGolombNumber();
      const offset_for_ref_frame = [];
      for (let i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i += 1) {
        offset_for_ref_frame[i] = reader.decodeExponentialGolombNumber();
      }
    }
    reader.decodeExponentialGolombNumber();
    reader.next();
    const pic_width_in_mbs_minus1 = reader.decodeExponentialGolombNumber();
    const pic_height_in_map_units_minus1 = reader.decodeExponentialGolombNumber();
    const frame_mbs_only_flag = reader.next();
    if (!frame_mbs_only_flag) {
      reader.next();
    }
    reader.next();
    const frame_cropping_flag = !!reader.next();
    let frame_crop_left_offset;
    let frame_crop_right_offset;
    let frame_crop_top_offset;
    let frame_crop_bottom_offset;
    if (frame_cropping_flag) {
      frame_crop_left_offset = reader.decodeExponentialGolombNumber();
      frame_crop_right_offset = reader.decodeExponentialGolombNumber();
      frame_crop_top_offset = reader.decodeExponentialGolombNumber();
      frame_crop_bottom_offset = reader.decodeExponentialGolombNumber();
    } else {
      frame_crop_left_offset = 0;
      frame_crop_right_offset = 0;
      frame_crop_top_offset = 0;
      frame_crop_bottom_offset = 0;
    }
    const vui_parameters_present_flag = !!reader.next();
    if (vui_parameters_present_flag) {
    }
    return {
      profile_idc,
      constraint_set,
      constraint_set0_flag,
      constraint_set1_flag,
      constraint_set2_flag,
      constraint_set3_flag,
      constraint_set4_flag,
      constraint_set5_flag,
      level_idc,
      seq_parameter_set_id,
      pic_width_in_mbs_minus1,
      pic_height_in_map_units_minus1,
      frame_mbs_only_flag,
      frame_cropping_flag,
      frame_crop_left_offset,
      frame_crop_right_offset,
      frame_crop_top_offset,
      frame_crop_bottom_offset
    };
  }
  function h264SearchConfiguration(buffer3) {
    let sequenceParameterSet;
    let pictureParameterSet;
    for (const nalu of annexBSplitNalu2(buffer3)) {
      const naluType = nalu[0] & 31;
      switch (naluType) {
        case 7:
          sequenceParameterSet = nalu;
          if (pictureParameterSet) {
            return {
              sequenceParameterSet,
              pictureParameterSet
            };
          }
          break;
        case 8:
          pictureParameterSet = nalu;
          if (sequenceParameterSet) {
            return {
              sequenceParameterSet,
              pictureParameterSet
            };
          }
          break;
        default:
          break;
      }
    }
    throw new Error("Invalid data");
  }
  function h264ParseConfiguration(data) {
    const { sequenceParameterSet, pictureParameterSet } = h264SearchConfiguration(data);
    const { profile_idc: profileIndex, constraint_set: constraintSet, level_idc: levelIndex, pic_width_in_mbs_minus1, pic_height_in_map_units_minus1, frame_mbs_only_flag, frame_crop_left_offset, frame_crop_right_offset, frame_crop_top_offset, frame_crop_bottom_offset } = h264ParseSequenceParameterSet(sequenceParameterSet);
    const encodedWidth = (pic_width_in_mbs_minus1 + 1) * 16;
    const encodedHeight = (pic_height_in_map_units_minus1 + 1) * (2 - frame_mbs_only_flag) * 16;
    const cropLeft = frame_crop_left_offset * 2;
    const cropRight = frame_crop_right_offset * 2;
    const cropTop = frame_crop_top_offset * 2;
    const cropBottom = frame_crop_bottom_offset * 2;
    const croppedWidth = encodedWidth - cropLeft - cropRight;
    const croppedHeight = encodedHeight - cropTop - cropBottom;
    return {
      pictureParameterSet,
      sequenceParameterSet,
      profileIndex,
      constraintSet,
      levelIndex,
      encodedWidth,
      encodedHeight,
      cropLeft,
      cropRight,
      cropTop,
      cropBottom,
      croppedWidth,
      croppedHeight
    };
  }

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/node_modules/@yume-chan/scrcpy/esm/codec/h265.js
  var AndroidHevcProfile = {
    Main: 1 << 0,
    Main10: 1 << 1,
    MainStill: 1 << 2,
    Main10Hdr10: 1 << 12,
    Main10Hdr10Plus: 1 << 13
  };
  var AndroidHevcLevel = {
    MainTierLevel1: 1 << 0,
    HighTierLevel1: 1 << 1,
    MainTierLevel2: 1 << 2,
    HighTierLevel2: 1 << 3,
    MainTierLevel21: 1 << 4,
    HighTierLevel21: 1 << 5,
    MainTierLevel3: 1 << 6,
    HighTierLevel3: 1 << 7,
    MainTierLevel31: 1 << 8,
    HighTierLevel31: 1 << 9,
    MainTierLevel4: 1 << 10,
    HighTierLevel4: 1 << 11,
    MainTierLevel41: 1 << 12,
    HighTierLevel41: 1 << 13,
    MainTierLevel5: 1 << 14,
    HighTierLevel5: 1 << 15,
    MainTierLevel51: 1 << 16,
    HighTierLevel51: 1 << 17,
    MainTierLevel52: 1 << 18,
    HighTierLevel52: 1 << 19,
    MainTierLevel6: 1 << 20,
    HighTierLevel6: 1 << 21,
    MainTierLevel61: 1 << 22,
    HighTierLevel61: 1 << 23,
    MainTierLevel62: 1 << 24,
    HighTierLevel62: 1 << 25
  };
  function getSubWidthC2(chroma_format_idc) {
    switch (chroma_format_idc) {
      case 0:
      case 3:
        return 1;
      case 1:
      case 2:
        return 2;
      default:
        throw new Error("Invalid chroma_format_idc");
    }
  }
  function getSubHeightC2(chroma_format_idc) {
    switch (chroma_format_idc) {
      case 0:
      case 2:
      case 3:
        return 1;
      case 1:
        return 2;
      default:
        throw new Error("Invalid chroma_format_idc");
    }
  }
  function h265ParseNaluHeader(nalu) {
    const reader = new NaluSodbBitReader2(nalu);
    if (reader.next() !== 0) {
      throw new Error("Invalid NALU header");
    }
    const nal_unit_type = reader.read(6);
    const nuh_layer_id = reader.read(6);
    const nuh_temporal_id_plus1 = reader.read(3);
    return {
      nal_unit_type,
      nuh_layer_id,
      nuh_temporal_id_plus1
    };
  }
  function h265ParseVideoParameterSet(nalu) {
    const reader = new NaluSodbBitReader2(nalu);
    const vps_video_parameter_set_id = reader.read(4);
    const vps_base_layer_internal_flag = !!reader.next();
    const vps_base_layer_available_flag = !!reader.next();
    const vps_max_layers_minus1 = reader.read(6);
    const vps_max_sub_layers_minus1 = reader.read(3);
    const vps_temporal_id_nesting_flag = !!reader.next();
    reader.skip(16);
    const profileTierLevel = h265ParseProfileTierLevel(reader, true, vps_max_sub_layers_minus1);
    const vps_sub_layer_ordering_info_present_flag = !!reader.next();
    const vps_max_dec_pic_buffering_minus1 = [];
    const vps_max_num_reorder_pics = [];
    const vps_max_latency_increase_plus1 = [];
    for (let i = vps_sub_layer_ordering_info_present_flag ? 0 : vps_max_sub_layers_minus1; i <= vps_max_sub_layers_minus1; i += 1) {
      vps_max_dec_pic_buffering_minus1[i] = reader.decodeExponentialGolombNumber();
      vps_max_num_reorder_pics[i] = reader.decodeExponentialGolombNumber();
      vps_max_latency_increase_plus1[i] = reader.decodeExponentialGolombNumber();
    }
    const vps_max_layer_id = reader.read(6);
    const vps_num_layer_sets_minus1 = reader.decodeExponentialGolombNumber();
    const layer_id_included_flag = [];
    for (let i = 1; i <= vps_num_layer_sets_minus1; i += 1) {
      layer_id_included_flag[i] = [];
      for (let j = 0; j <= vps_max_layer_id; j += 1) {
        layer_id_included_flag[i][j] = !!reader.next();
      }
    }
    const vps_timing_info_present_flag = !!reader.next();
    let vps_num_units_in_tick;
    let vps_time_scale;
    let vps_poc_proportional_to_timing_flag;
    let vps_num_ticks_poc_diff_one_minus1;
    let vps_num_hrd_parameters;
    let hrd_layer_set_idx;
    let cprms_present_flag;
    let hrdParameters;
    if (vps_timing_info_present_flag) {
      vps_num_units_in_tick = reader.read(32);
      vps_time_scale = reader.read(32);
      vps_poc_proportional_to_timing_flag = !!reader.next();
      if (vps_poc_proportional_to_timing_flag) {
        vps_num_ticks_poc_diff_one_minus1 = reader.decodeExponentialGolombNumber();
      }
      vps_num_hrd_parameters = reader.decodeExponentialGolombNumber();
      hrd_layer_set_idx = [];
      cprms_present_flag = [true];
      hrdParameters = [];
      for (let i = 0; i < vps_num_hrd_parameters; i += 1) {
        hrd_layer_set_idx[i] = reader.decodeExponentialGolombNumber();
        if (i > 0) {
          cprms_present_flag[i] = !!reader.next();
        }
        hrdParameters[i] = h265ParseHrdParameters(reader, cprms_present_flag[i], vps_max_sub_layers_minus1);
      }
    }
    const vps_extension_flag = !!reader.next();
    return {
      vps_video_parameter_set_id,
      vps_base_layer_internal_flag,
      vps_base_layer_available_flag,
      vps_max_layers_minus1,
      vps_max_sub_layers_minus1,
      vps_temporal_id_nesting_flag,
      profileTierLevel,
      vps_sub_layer_ordering_info_present_flag,
      vps_max_dec_pic_buffering_minus1,
      vps_max_num_reorder_pics,
      vps_max_latency_increase_plus1,
      vps_max_layer_id,
      vps_num_layer_sets_minus1,
      layer_id_included_flag,
      vps_timing_info_present_flag,
      vps_num_units_in_tick,
      vps_time_scale,
      vps_poc_proportional_to_timing_flag,
      vps_num_ticks_poc_diff_one_minus1,
      vps_num_hrd_parameters,
      hrd_layer_set_idx,
      cprms_present_flag,
      hrdParameters,
      vps_extension_flag
    };
  }
  function h265ParseSequenceParameterSet(nalu) {
    const reader = new NaluSodbBitReader2(nalu);
    const sps_video_parameter_set_id = reader.read(4);
    const sps_max_sub_layers_minus1 = reader.read(3);
    const sps_temporal_id_nesting_flag = !!reader.next();
    const profileTierLevel = h265ParseProfileTierLevel(reader, true, sps_max_sub_layers_minus1);
    const sps_seq_parameter_set_id = reader.decodeExponentialGolombNumber();
    const chroma_format_idc = reader.decodeExponentialGolombNumber();
    let separate_colour_plane_flag;
    if (chroma_format_idc === 3) {
      separate_colour_plane_flag = !!reader.next();
    }
    const pic_width_in_luma_samples = reader.decodeExponentialGolombNumber();
    const pic_height_in_luma_samples = reader.decodeExponentialGolombNumber();
    const conformance_window_flag = !!reader.next();
    let conf_win_left_offset;
    let conf_win_right_offset;
    let conf_win_top_offset;
    let conf_win_bottom_offset;
    if (conformance_window_flag) {
      conf_win_left_offset = reader.decodeExponentialGolombNumber();
      conf_win_right_offset = reader.decodeExponentialGolombNumber();
      conf_win_top_offset = reader.decodeExponentialGolombNumber();
      conf_win_bottom_offset = reader.decodeExponentialGolombNumber();
    }
    const bit_depth_luma_minus8 = reader.decodeExponentialGolombNumber();
    const bit_depth_chroma_minus8 = reader.decodeExponentialGolombNumber();
    const log2_max_pic_order_cnt_lsb_minus4 = reader.decodeExponentialGolombNumber();
    const sps_max_dec_pic_buffering_minus1 = [];
    const sps_max_num_reorder_pics = [];
    const sps_max_latency_increase_plus1 = [];
    const sps_sub_layer_ordering_info_present_flag = !!reader.next();
    for (let i = sps_sub_layer_ordering_info_present_flag ? 0 : sps_max_sub_layers_minus1; i <= sps_max_sub_layers_minus1; i += 1) {
      sps_max_dec_pic_buffering_minus1[i] = reader.decodeExponentialGolombNumber();
      sps_max_num_reorder_pics[i] = reader.decodeExponentialGolombNumber();
      sps_max_latency_increase_plus1[i] = reader.decodeExponentialGolombNumber();
    }
    const log2_min_luma_coding_block_size_minus3 = reader.decodeExponentialGolombNumber();
    const log2_diff_max_min_luma_coding_block_size = reader.decodeExponentialGolombNumber();
    const log2_min_luma_transform_block_size_minus2 = reader.decodeExponentialGolombNumber();
    const log2_diff_max_min_luma_transform_block_size = reader.decodeExponentialGolombNumber();
    const max_transform_hierarchy_depth_inter = reader.decodeExponentialGolombNumber();
    const max_transform_hierarchy_depth_intra = reader.decodeExponentialGolombNumber();
    const scaling_list_enabled_flag = !!reader.next();
    let sps_scaling_list_data_present_flag;
    let scalingListData;
    if (scaling_list_enabled_flag) {
      sps_scaling_list_data_present_flag = !!reader.next();
      if (sps_scaling_list_data_present_flag) {
        scalingListData = h265ParseScalingListData(reader);
      }
    }
    const amp_enabled_flag = !!reader.next();
    const sample_adaptive_offset_enabled_flag = !!reader.next();
    const pcm_enabled_flag = !!reader.next();
    let pcm_sample_bit_depth_luma_minus1;
    let pcm_sample_bit_depth_chroma_minus1;
    let log2_min_pcm_luma_coding_block_size_minus3;
    let log2_diff_max_min_pcm_luma_coding_block_size;
    let pcm_loop_filter_disabled_flag;
    if (pcm_enabled_flag) {
      pcm_sample_bit_depth_luma_minus1 = reader.read(4);
      pcm_sample_bit_depth_chroma_minus1 = reader.read(4);
      log2_min_pcm_luma_coding_block_size_minus3 = reader.decodeExponentialGolombNumber();
      log2_diff_max_min_pcm_luma_coding_block_size = reader.decodeExponentialGolombNumber();
      pcm_loop_filter_disabled_flag = !!reader.next();
    }
    const num_short_term_ref_pic_sets = reader.decodeExponentialGolombNumber();
    const shortTermRefPicSets = [];
    for (let i = 0; i < num_short_term_ref_pic_sets; i += 1) {
      shortTermRefPicSets[i] = h265ParseShortTermReferencePictureSet(reader, i, num_short_term_ref_pic_sets, shortTermRefPicSets);
    }
    const long_term_ref_pics_present_flag = !!reader.next();
    let num_long_term_ref_pics_sps;
    let lt_ref_pic_poc_lsb_sps;
    let used_by_curr_pic_lt_sps_flag;
    if (long_term_ref_pics_present_flag) {
      num_long_term_ref_pics_sps = reader.decodeExponentialGolombNumber();
      lt_ref_pic_poc_lsb_sps = [];
      used_by_curr_pic_lt_sps_flag = [];
      for (let i = 0; i < num_long_term_ref_pics_sps; i += 1) {
        lt_ref_pic_poc_lsb_sps[i] = reader.read(log2_max_pic_order_cnt_lsb_minus4 + 4);
        used_by_curr_pic_lt_sps_flag[i] = !!reader.next();
      }
    }
    const sps_temporal_mvp_enabled_flag = !!reader.next();
    const strong_intra_smoothing_enabled_flag = !!reader.next();
    const vui_parameters_present_flag = !!reader.next();
    let vuiParameters;
    if (vui_parameters_present_flag) {
      vuiParameters = h265ParseVuiParameters(reader, sps_max_sub_layers_minus1);
    }
    const sps_extension_present_flag = !!reader.next();
    let sps_range_extension_flag;
    let sps_multilayer_extension_flag;
    let sps_3d_extension_flag;
    let sps_scc_extension_flag;
    let sps_extension_4bits;
    if (sps_extension_present_flag) {
      sps_range_extension_flag = !!reader.next();
      sps_multilayer_extension_flag = !!reader.next();
      sps_3d_extension_flag = !!reader.next();
      sps_scc_extension_flag = !!reader.next();
      sps_extension_4bits = reader.read(4);
    }
    if (sps_range_extension_flag) {
      throw new Error("Not implemented");
    }
    let spsMultilayerExtension;
    if (sps_multilayer_extension_flag) {
      spsMultilayerExtension = h265ParseSpsMultilayerExtension(reader);
    }
    let sps3dExtension;
    if (sps_3d_extension_flag) {
      sps3dExtension = h265ParseSps3dExtension(reader);
    }
    if (sps_scc_extension_flag) {
      throw new Error("Not implemented");
    }
    let sps_extension_data_flag;
    if (sps_extension_4bits) {
      sps_extension_data_flag = [];
      let i = 0;
      while (!reader.ended) {
        sps_extension_data_flag[i] = !!reader.next();
        i += 1;
      }
    }
    return {
      sps_video_parameter_set_id,
      sps_max_sub_layers_minus1,
      sps_temporal_id_nesting_flag,
      profileTierLevel,
      sps_seq_parameter_set_id,
      chroma_format_idc,
      separate_colour_plane_flag,
      pic_width_in_luma_samples,
      pic_height_in_luma_samples,
      conformance_window_flag,
      conf_win_left_offset,
      conf_win_right_offset,
      conf_win_top_offset,
      conf_win_bottom_offset,
      bit_depth_luma_minus8,
      bit_depth_chroma_minus8,
      log2_max_pic_order_cnt_lsb_minus4,
      sps_sub_layer_ordering_info_present_flag,
      sps_max_dec_pic_buffering_minus1,
      sps_max_num_reorder_pics,
      sps_max_latency_increase_plus1,
      log2_min_luma_coding_block_size_minus3,
      log2_diff_max_min_luma_coding_block_size,
      log2_min_luma_transform_block_size_minus2,
      log2_diff_max_min_luma_transform_block_size,
      max_transform_hierarchy_depth_inter,
      max_transform_hierarchy_depth_intra,
      scaling_list_enabled_flag,
      sps_scaling_list_data_present_flag,
      scalingListData,
      amp_enabled_flag,
      sample_adaptive_offset_enabled_flag,
      pcm_enabled_flag,
      pcm_sample_bit_depth_luma_minus1,
      pcm_sample_bit_depth_chroma_minus1,
      log2_min_pcm_luma_coding_block_size_minus3,
      log2_diff_max_min_pcm_luma_coding_block_size,
      pcm_loop_filter_disabled_flag,
      num_short_term_ref_pic_sets,
      shortTermRefPicSets,
      long_term_ref_pics_present_flag,
      num_long_term_ref_pics_sps,
      lt_ref_pic_poc_lsb_sps,
      used_by_curr_pic_lt_sps_flag,
      sps_temporal_mvp_enabled_flag,
      strong_intra_smoothing_enabled_flag,
      vui_parameters_present_flag,
      vuiParameters,
      sps_extension_present_flag,
      sps_range_extension_flag,
      sps_multilayer_extension_flag,
      sps_3d_extension_flag,
      sps_scc_extension_flag,
      sps_extension_4bits,
      spsMultilayerExtension,
      sps3dExtension,
      sps_extension_data_flag
    };
  }
  function h265ParseProfileTier(reader) {
    const profile_space = reader.read(2);
    const tier_flag = !!reader.next();
    const profile_idc = reader.read(5);
    const profileCompatibilitySet = reader.peekBytes(4);
    const profile_compatibility_flag = [];
    for (let j = 0; j < 32; j += 1) {
      profile_compatibility_flag[j] = !!reader.next();
    }
    const constraintSet = reader.peekBytes(6);
    const progressive_source_flag = !!reader.next();
    const interlaced_source_flag = !!reader.next();
    const non_packed_constraint_flag = !!reader.next();
    const frame_only_constraint_flag = !!reader.next();
    let max_12bit_constraint_flag;
    let max_10bit_constraint_flag;
    let max_8bit_constraint_flag;
    let max_422chroma_constraint_flag;
    let max_420chroma_constraint_flag;
    let max_monochrome_constraint_flag;
    let intra_constraint_flag;
    let one_picture_only_constraint_flag;
    let lower_bit_rate_constraint_flag;
    let max_14bit_constraint_flag;
    if (profile_idc === 4 || profile_compatibility_flag[4] || profile_idc === 5 || profile_compatibility_flag[5] || profile_idc === 6 || profile_compatibility_flag[6] || profile_idc === 7 || profile_compatibility_flag[7] || profile_idc === 8 || profile_compatibility_flag[8] || profile_idc === 9 || profile_compatibility_flag[9] || profile_idc === 10 || profile_compatibility_flag[10] || profile_idc === 11 || profile_compatibility_flag[11]) {
      max_12bit_constraint_flag = !!reader.next();
      max_10bit_constraint_flag = !!reader.next();
      max_8bit_constraint_flag = !!reader.next();
      max_422chroma_constraint_flag = !!reader.next();
      max_420chroma_constraint_flag = !!reader.next();
      max_monochrome_constraint_flag = !!reader.next();
      intra_constraint_flag = !!reader.next();
      one_picture_only_constraint_flag = !!reader.next();
      lower_bit_rate_constraint_flag = !!reader.next();
      if (profile_idc === 5 || profile_compatibility_flag[5] || profile_idc === 9 || profile_compatibility_flag[9] || profile_idc === 10 || profile_compatibility_flag[10] || profile_idc === 11 || profile_compatibility_flag[11]) {
        max_14bit_constraint_flag = !!reader.next();
        reader.skip(33);
      } else {
        reader.skip(34);
      }
    } else if (profile_idc === 2 || profile_compatibility_flag[2]) {
      reader.skip(7);
      one_picture_only_constraint_flag = !!reader.next();
      reader.skip(35);
    } else {
      reader.skip(43);
    }
    let inbld_flag;
    if (profile_idc === 1 || profile_compatibility_flag[1] || profile_idc === 2 || profile_compatibility_flag[2] || profile_idc === 3 || profile_compatibility_flag[3] || profile_idc === 4 || profile_compatibility_flag[4] || profile_idc === 5 || profile_compatibility_flag[5] || profile_idc === 9 || profile_compatibility_flag[9] || profile_idc === 11 || profile_compatibility_flag[11]) {
      inbld_flag = !!reader.next();
    } else {
      reader.skip(1);
    }
    return {
      profile_space,
      tier_flag,
      profile_idc,
      profileCompatibilitySet,
      profile_compatibility_flag,
      constraintSet,
      progressive_source_flag,
      interlaced_source_flag,
      non_packed_constraint_flag,
      frame_only_constraint_flag,
      max_12bit_constraint_flag,
      max_10bit_constraint_flag,
      max_8bit_constraint_flag,
      max_422chroma_constraint_flag,
      max_420chroma_constraint_flag,
      max_monochrome_constraint_flag,
      intra_constraint_flag,
      one_picture_only_constraint_flag,
      lower_bit_rate_constraint_flag,
      max_14bit_constraint_flag,
      inbld_flag
    };
  }
  function h265ParseProfileTierLevel(reader, profilePresentFlag, maxNumSubLayersMinus1) {
    let generalProfileTier;
    if (profilePresentFlag) {
      generalProfileTier = h265ParseProfileTier(reader);
    }
    const general_level_idc = reader.read(8);
    const sub_layer_profile_present_flag = [];
    const sub_layer_level_present_flag = [];
    for (let i = 0; i < maxNumSubLayersMinus1; i += 1) {
      sub_layer_profile_present_flag[i] = !!reader.next();
      sub_layer_level_present_flag[i] = !!reader.next();
    }
    if (maxNumSubLayersMinus1 > 0) {
      for (let i = maxNumSubLayersMinus1; i < 8; i += 1) {
        reader.read(2);
      }
    }
    const subLayerProfileTier = [];
    const sub_layer_level_idc = [];
    for (let i = 0; i < maxNumSubLayersMinus1; i += 1) {
      if (sub_layer_profile_present_flag[i]) {
        subLayerProfileTier[i] = h265ParseProfileTier(reader);
      }
      if (sub_layer_level_present_flag[i]) {
        sub_layer_level_idc[i] = reader.read(8);
      }
    }
    return {
      generalProfileTier,
      general_level_idc,
      sub_layer_profile_present_flag,
      sub_layer_level_present_flag,
      subLayerProfileTier,
      sub_layer_level_idc
    };
  }
  function h265ParseScalingListData(reader) {
    const scaling_list = [];
    for (let sizeId = 0; sizeId < 4; sizeId += 1) {
      scaling_list[sizeId] = [];
      for (let matrixId = 0; matrixId < 6; matrixId += sizeId === 3 ? 3 : 1) {
        const scaling_list_pred_mode_flag = !!reader.next();
        if (!scaling_list_pred_mode_flag) {
          reader.decodeExponentialGolombNumber();
        } else {
          let nextCoef = 8;
          const coefNum = Math.min(64, 1 << 4 + (sizeId << 1));
          if (sizeId > 1) {
            const scaling_list_dc_coef_minus8 = reader.decodeExponentialGolombNumber();
            nextCoef = scaling_list_dc_coef_minus8 + 8;
          }
          scaling_list[sizeId][matrixId] = [];
          for (let i = 0; i < coefNum; i += 1) {
            const scaling_list_delta_coef = reader.decodeExponentialGolombNumber();
            nextCoef = (nextCoef + scaling_list_delta_coef + 256) % 256;
            scaling_list[sizeId][matrixId][i] = nextCoef;
          }
        }
      }
    }
    return scaling_list;
  }
  function h265ParseShortTermReferencePictureSet(reader, stRpsIdx, num_short_term_ref_pic_sets, sets) {
    let inter_ref_pic_set_prediction_flag = false;
    if (stRpsIdx !== 0) {
      inter_ref_pic_set_prediction_flag = !!reader.next();
    }
    let delta_idx_minus1 = 0;
    let delta_rps_sign = false;
    let abs_delta_rps_minus1 = 0;
    const used_by_curr_pic_flag = [];
    const use_delta_flag = [];
    let num_negative_pics = 0;
    let num_positive_pics = 0;
    const delta_poc_s0_minus1 = [];
    const used_by_curr_pic_s0_flag = [];
    const delta_poc_s1_minus1 = [];
    const used_by_curr_pic_s1_flag = [];
    if (inter_ref_pic_set_prediction_flag) {
      if (stRpsIdx === num_short_term_ref_pic_sets) {
        delta_idx_minus1 = reader.decodeExponentialGolombNumber();
      }
      delta_rps_sign = !!reader.next();
      abs_delta_rps_minus1 = reader.decodeExponentialGolombNumber();
      const RefRpsIdx = stRpsIdx - (delta_idx_minus1 + 1);
      const RefRps = sets[RefRpsIdx];
      const NumDeltaPocs_RefRpsIdx = RefRps.num_negative_pics + RefRps.num_positive_pics;
      for (let j = 0; j <= NumDeltaPocs_RefRpsIdx; j += 1) {
        used_by_curr_pic_flag[j] = !!reader.next();
        if (!used_by_curr_pic_flag[j]) {
          use_delta_flag[j] = !!reader.next();
        } else {
          use_delta_flag[j] = true;
        }
      }
      const DeltaRps = (1 - 2 * Number(delta_rps_sign)) * (abs_delta_rps_minus1 + 1);
      const RefPocS0 = [];
      const RefPocS1 = [];
      const pocS0 = [];
      const pocS1 = [];
      let dPoc = 0;
      for (let i2 = 0; i2 < RefRps.num_negative_pics; i2 += 1) {
        dPoc -= RefRps.delta_poc_s0_minus1[i2] + 1;
        RefPocS0[i2] = dPoc;
      }
      dPoc = 0;
      for (let i2 = 0; i2 < RefRps.num_positive_pics; i2 += 1) {
        dPoc += RefRps.delta_poc_s1_minus1[i2] + 1;
        RefPocS1[i2] = dPoc;
      }
      let i = 0;
      if (RefRps.num_positive_pics > 0) {
        for (let j = RefRps.num_positive_pics - 1; j >= 0; j -= 1) {
          dPoc = RefPocS1[j] + DeltaRps;
          if (dPoc < 0 && use_delta_flag[RefRps.num_negative_pics + j]) {
            pocS0[i] = dPoc;
            used_by_curr_pic_s0_flag[i] = used_by_curr_pic_flag[RefRps.num_negative_pics + j];
            i += 1;
          }
        }
      }
      if (DeltaRps < 0 && use_delta_flag[NumDeltaPocs_RefRpsIdx]) {
        pocS0[i] = DeltaRps;
        used_by_curr_pic_s0_flag[i] = used_by_curr_pic_flag[NumDeltaPocs_RefRpsIdx];
        i += 1;
      }
      for (let j = 0; j < RefRps.num_negative_pics; j += 1) {
        dPoc = RefPocS0[j] + DeltaRps;
        if (dPoc < 0 && use_delta_flag[j]) {
          pocS0[i] = dPoc;
          used_by_curr_pic_s0_flag[i] = used_by_curr_pic_flag[j];
          i += 1;
        }
      }
      num_negative_pics = i;
      let prev = 0;
      for (i = 0; i < num_negative_pics; i += 1) {
        const current = pocS0[i];
        delta_poc_s0_minus1[i] = -(current - prev - 1);
        prev = current;
      }
      i = 0;
      if (RefRps.num_negative_pics > 0) {
        for (let j = RefRps.num_negative_pics - 1; j >= 0; j -= 1) {
          dPoc = RefPocS0[j] + DeltaRps;
          if (dPoc > 0 && use_delta_flag[j]) {
            pocS1[i] = dPoc;
            used_by_curr_pic_s1_flag[i] = used_by_curr_pic_flag[j];
            i += 1;
          }
        }
      }
      if (DeltaRps > 0 && use_delta_flag[NumDeltaPocs_RefRpsIdx]) {
        pocS1[i] = DeltaRps;
        used_by_curr_pic_s1_flag[i] = used_by_curr_pic_flag[NumDeltaPocs_RefRpsIdx];
        i += 1;
      }
      for (let j = 0; j < RefRps.num_positive_pics; j += 1) {
        dPoc = RefPocS1[j] + DeltaRps;
        if (dPoc > 0 && use_delta_flag[RefRps.num_negative_pics + j]) {
          pocS1[i] = dPoc;
          used_by_curr_pic_s1_flag[i] = used_by_curr_pic_flag[RefRps.num_negative_pics + j];
          i += 1;
        }
      }
      num_positive_pics = i;
      prev = 0;
      for (i = 0; i < num_positive_pics; i += 1) {
        const current = pocS1[i];
        delta_poc_s1_minus1[i] = current - prev - 1;
        prev = current;
      }
    } else {
      num_negative_pics = reader.decodeExponentialGolombNumber();
      num_positive_pics = reader.decodeExponentialGolombNumber();
      for (let i = 0; i < num_negative_pics; i += 1) {
        delta_poc_s0_minus1[i] = reader.decodeExponentialGolombNumber();
        used_by_curr_pic_s0_flag[i] = !!reader.next();
      }
      for (let i = 0; i < num_positive_pics; i += 1) {
        delta_poc_s1_minus1[i] = reader.decodeExponentialGolombNumber();
        used_by_curr_pic_s1_flag[i] = !!reader.next();
      }
    }
    return {
      stRpsIdx,
      num_short_term_ref_pic_sets,
      inter_ref_pic_set_prediction_flag,
      delta_idx_minus1,
      delta_rps_sign,
      abs_delta_rps_minus1,
      used_by_curr_pic_flag,
      use_delta_flag,
      num_negative_pics,
      num_positive_pics,
      delta_poc_s0_minus1,
      used_by_curr_pic_s0_flag,
      delta_poc_s1_minus1,
      used_by_curr_pic_s1_flag
    };
  }
  var H265AspectRatioIndicator = {
    Unspecified: 0,
    Square: 1,
    _12_11: 2,
    _10_11: 3,
    _16_11: 4,
    _40_33: 5,
    _24_11: 6,
    _20_11: 7,
    _32_11: 8,
    _80_33: 9,
    _18_11: 10,
    _15_11: 11,
    _64_33: 12,
    _160_99: 13,
    _4_3: 15,
    _3_2: 16,
    _2_1: 17,
    Extended: 255
  };
  function h265ParseVuiParameters(reader, sps_max_sub_layers_minus1) {
    const aspect_ratio_info_present_flag = !!reader.next();
    let aspect_ratio_idc;
    let sar_width;
    let sar_height;
    if (aspect_ratio_info_present_flag) {
      aspect_ratio_idc = reader.read(8);
      if (aspect_ratio_idc === H265AspectRatioIndicator.Extended) {
        sar_width = reader.read(16);
        sar_height = reader.read(16);
      }
    }
    const overscan_info_present_flag = !!reader.next();
    let overscan_appropriate_flag;
    if (overscan_info_present_flag) {
      overscan_appropriate_flag = !!reader.next();
    }
    const video_signal_type_present_flag = !!reader.next();
    let video_format;
    let video_full_range_flag;
    let colour_description_present_flag;
    let colour_primaries;
    let transfer_characteristics;
    let matrix_coeffs;
    if (video_signal_type_present_flag) {
      video_format = reader.read(3);
      video_full_range_flag = !!reader.next();
      colour_description_present_flag = !!reader.next();
      if (colour_description_present_flag) {
        colour_primaries = reader.read(8);
        transfer_characteristics = reader.read(8);
        matrix_coeffs = reader.read(8);
      }
    }
    const chroma_loc_info_present_flag = !!reader.next();
    let chroma_sample_loc_type_top_field;
    let chroma_sample_loc_type_bottom_field;
    if (chroma_loc_info_present_flag) {
      chroma_sample_loc_type_top_field = reader.decodeExponentialGolombNumber();
      chroma_sample_loc_type_bottom_field = reader.decodeExponentialGolombNumber();
    }
    const neutral_chroma_indication_flag = !!reader.next();
    const field_seq_flag = !!reader.next();
    const frame_field_info_present_flag = !!reader.next();
    const default_display_window_flag = !!reader.next();
    let def_disp_win_left_offset;
    let def_disp_win_right_offset;
    let def_disp_win_top_offset;
    let def_disp_win_bottom_offset;
    if (default_display_window_flag) {
      def_disp_win_left_offset = reader.decodeExponentialGolombNumber();
      def_disp_win_right_offset = reader.decodeExponentialGolombNumber();
      def_disp_win_top_offset = reader.decodeExponentialGolombNumber();
      def_disp_win_bottom_offset = reader.decodeExponentialGolombNumber();
    }
    const vui_timing_info_present_flag = !!reader.next();
    let vui_num_units_in_tick;
    let vui_time_scale;
    let vui_poc_proportional_to_timing_flag;
    let vui_num_ticks_poc_diff_one_minus1;
    let vui_hrd_parameters_present_flag;
    let vui_hrd_parameters;
    if (vui_timing_info_present_flag) {
      vui_num_units_in_tick = reader.read(32);
      vui_time_scale = reader.read(32);
      vui_poc_proportional_to_timing_flag = !!reader.next();
      if (vui_poc_proportional_to_timing_flag) {
        vui_num_ticks_poc_diff_one_minus1 = reader.decodeExponentialGolombNumber();
      }
      vui_hrd_parameters_present_flag = !!reader.next();
      if (vui_hrd_parameters_present_flag) {
        vui_hrd_parameters = h265ParseHrdParameters(reader, true, sps_max_sub_layers_minus1);
      }
    }
    const bitstream_restriction_flag = !!reader.next();
    let tiles_fixed_structure_flag;
    let motion_vectors_over_pic_boundaries_flag;
    let restricted_ref_pic_lists_flag;
    let min_spatial_segmentation_idc;
    let max_bytes_per_pic_denom;
    let max_bits_per_min_cu_denom;
    let log2_max_mv_length_horizontal;
    let log2_max_mv_length_vertical;
    if (bitstream_restriction_flag) {
      tiles_fixed_structure_flag = !!reader.next();
      motion_vectors_over_pic_boundaries_flag = !!reader.next();
      restricted_ref_pic_lists_flag = !!reader.next();
      min_spatial_segmentation_idc = reader.decodeExponentialGolombNumber();
      max_bytes_per_pic_denom = reader.decodeExponentialGolombNumber();
      max_bits_per_min_cu_denom = reader.decodeExponentialGolombNumber();
      log2_max_mv_length_horizontal = reader.decodeExponentialGolombNumber();
      log2_max_mv_length_vertical = reader.decodeExponentialGolombNumber();
    }
    return {
      aspect_ratio_info_present_flag,
      aspect_ratio_idc,
      sar_width,
      sar_height,
      overscan_info_present_flag,
      overscan_appropriate_flag,
      video_signal_type_present_flag,
      video_format,
      video_full_range_flag,
      colour_description_present_flag,
      colour_primaries,
      transfer_characteristics,
      matrix_coeffs,
      chroma_loc_info_present_flag,
      chroma_sample_loc_type_top_field,
      chroma_sample_loc_type_bottom_field,
      neutral_chroma_indication_flag,
      field_seq_flag,
      frame_field_info_present_flag,
      default_display_window_flag,
      def_disp_win_left_offset,
      def_disp_win_right_offset,
      def_disp_win_top_offset,
      def_disp_win_bottom_offset,
      vui_timing_info_present_flag,
      vui_num_units_in_tick,
      vui_time_scale,
      vui_poc_proportional_to_timing_flag,
      vui_num_ticks_poc_diff_one_minus1,
      vui_hrd_parameters_present_flag,
      vui_hrd_parameters,
      bitstream_restriction_flag,
      tiles_fixed_structure_flag,
      motion_vectors_over_pic_boundaries_flag,
      restricted_ref_pic_lists_flag,
      min_spatial_segmentation_idc,
      max_bytes_per_pic_denom,
      max_bits_per_min_cu_denom,
      log2_max_mv_length_horizontal,
      log2_max_mv_length_vertical
    };
  }
  function h265ParseHrdParameters(reader, commonInfPresentFlag, maxNumSubLayersMinus1) {
    let nal_hrd_parameters_present_flag;
    let vcl_hrd_parameters_present_flag;
    let sub_pic_hrd_params_present_flag;
    let tick_divisor_minus2;
    let du_cpb_removal_delay_increment_length_minus1;
    let sub_pic_cpb_params_in_pic_timing_sei_flag;
    let dpb_output_delay_du_length_minus1;
    let bit_rate_scale;
    let cpb_size_scale;
    let cpb_size_du_scale;
    let initial_cpb_removal_delay_length_minus1;
    let au_cpb_removal_delay_length_minus1;
    let dpb_output_delay_length_minus1;
    if (commonInfPresentFlag) {
      nal_hrd_parameters_present_flag = !!reader.next();
      vcl_hrd_parameters_present_flag = !!reader.next();
      if (nal_hrd_parameters_present_flag || vcl_hrd_parameters_present_flag) {
        sub_pic_hrd_params_present_flag = !!reader.next();
        if (sub_pic_hrd_params_present_flag) {
          tick_divisor_minus2 = reader.read(8);
          du_cpb_removal_delay_increment_length_minus1 = reader.read(5);
          sub_pic_cpb_params_in_pic_timing_sei_flag = !!reader.next();
          dpb_output_delay_du_length_minus1 = reader.read(5);
        }
        bit_rate_scale = reader.read(4);
        cpb_size_scale = reader.read(4);
        if (sub_pic_hrd_params_present_flag) {
          cpb_size_du_scale = reader.read(4);
        }
        initial_cpb_removal_delay_length_minus1 = reader.read(5);
        au_cpb_removal_delay_length_minus1 = reader.read(5);
        dpb_output_delay_length_minus1 = reader.read(5);
      }
    }
    const fixed_pic_rate_general_flag = [];
    const fixed_pic_rate_within_cvs_flag = [];
    const elemental_duration_in_tc_minus1 = [];
    const low_delay_hrd_flag = [];
    const cpb_cnt_minus1 = [];
    const nalHrdParameters = [];
    const vclHrdParameters = [];
    for (let i = 0; i <= maxNumSubLayersMinus1; i += 1) {
      fixed_pic_rate_general_flag[i] = !!reader.next();
      if (!fixed_pic_rate_general_flag[i]) {
        fixed_pic_rate_within_cvs_flag[i] = !!reader.next();
      }
      if (fixed_pic_rate_within_cvs_flag[i]) {
        elemental_duration_in_tc_minus1[i] = reader.decodeExponentialGolombNumber();
      } else {
        low_delay_hrd_flag[i] = !!reader.next();
      }
      if (!low_delay_hrd_flag[i]) {
        cpb_cnt_minus1[i] = reader.decodeExponentialGolombNumber();
      }
      if (nal_hrd_parameters_present_flag) {
        nalHrdParameters[i] = h265ParseSubLayerHrdParameters(reader, i, getCpbCnt2(cpb_cnt_minus1[i]));
      }
      if (vcl_hrd_parameters_present_flag) {
        vclHrdParameters[i] = h265ParseSubLayerHrdParameters(reader, i, getCpbCnt2(cpb_cnt_minus1[i]));
      }
    }
    return {
      nal_hrd_parameters_present_flag,
      vcl_hrd_parameters_present_flag,
      sub_pic_hrd_params_present_flag,
      tick_divisor_minus2,
      du_cpb_removal_delay_increment_length_minus1,
      sub_pic_cpb_params_in_pic_timing_sei_flag,
      dpb_output_delay_du_length_minus1,
      bit_rate_scale,
      cpb_size_scale,
      cpb_size_du_scale,
      initial_cpb_removal_delay_length_minus1,
      au_cpb_removal_delay_length_minus1,
      dpb_output_delay_length_minus1,
      fixed_pic_rate_general_flag,
      fixed_pic_rate_within_cvs_flag,
      elemental_duration_in_tc_minus1,
      low_delay_hrd_flag,
      cpb_cnt_minus1,
      nalHrdParameters,
      vclHrdParameters
    };
  }
  function h265ParseSubLayerHrdParameters(reader, subLayerId, CpbCnt) {
    const bit_rate_value_minus1 = [];
    const cpb_size_value_minus1 = [];
    const cpb_size_du_value_minus1 = [];
    const bit_rate_du_value_minus1 = [];
    const cbr_flag = [];
    for (let i = 0; i < CpbCnt; i += 1) {
      bit_rate_value_minus1[i] = reader.decodeExponentialGolombNumber();
      cpb_size_value_minus1[i] = reader.decodeExponentialGolombNumber();
      if (subLayerId > 0) {
        cbr_flag[i] = !!reader.next();
      }
    }
    return {
      bit_rate_value_minus1,
      cpb_size_value_minus1,
      cpb_size_du_value_minus1,
      bit_rate_du_value_minus1,
      cbr_flag
    };
  }
  function getCpbCnt2(cpb_cnt_minus_1) {
    return cpb_cnt_minus_1 + 1;
  }
  function h265SearchConfiguration(buffer3) {
    let videoParameterSet;
    let sequenceParameterSet;
    let pictureParameterSet;
    let count = 0;
    for (const nalu of annexBSplitNalu2(buffer3)) {
      const header = h265ParseNaluHeader(nalu);
      const raw = {
        ...header,
        data: nalu,
        rbsp: nalu.subarray(2)
      };
      switch (header.nal_unit_type) {
        case 32:
          videoParameterSet = raw;
          break;
        case 33:
          sequenceParameterSet = raw;
          break;
        case 34:
          pictureParameterSet = raw;
          break;
        default:
          continue;
      }
      count += 1;
      if (count === 3) {
        return {
          videoParameterSet,
          sequenceParameterSet,
          pictureParameterSet
        };
      }
    }
    throw new Error("Invalid data");
  }
  function h265ParseSpsMultilayerExtension(reader) {
    const inter_view_mv_vert_constraint_flag = !!reader.next();
    return {
      inter_view_mv_vert_constraint_flag
    };
  }
  function h265ParseSps3dExtension(reader) {
    const iv_di_mc_enabled_flag = [];
    const iv_mv_scal_enabled_flag = [];
    iv_di_mc_enabled_flag[0] = !!reader.next();
    iv_mv_scal_enabled_flag[0] = !!reader.next();
    const log2_ivmc_sub_pb_size_minus3 = reader.decodeExponentialGolombNumber();
    const iv_res_pred_enabled_flag = !!reader.next();
    const depth_ref_enabled_flag = !!reader.next();
    const vsp_mc_enabled_flag = !!reader.next();
    const dbbp_enabled_flag = !!reader.next();
    iv_di_mc_enabled_flag[1] = !!reader.next();
    iv_mv_scal_enabled_flag[1] = !!reader.next();
    const tex_mc_enabled_flag = !!reader.next();
    const log2_texmc_sub_pb_size_minus3 = reader.decodeExponentialGolombNumber();
    const intra_contour_enabled_flag = !!reader.next();
    const intra_dc_only_wedge_enabled_flag = !!reader.next();
    const cqt_cu_part_pred_enabled_flag = !!reader.next();
    const inter_dc_only_enabled_flag = !!reader.next();
    const skip_intra_enabled_flag = !!reader.next();
    return {
      iv_di_mc_enabled_flag,
      iv_mv_scal_enabled_flag,
      log2_ivmc_sub_pb_size_minus3,
      iv_res_pred_enabled_flag,
      depth_ref_enabled_flag,
      vsp_mc_enabled_flag,
      dbbp_enabled_flag,
      tex_mc_enabled_flag,
      log2_texmc_sub_pb_size_minus3,
      intra_contour_enabled_flag,
      intra_dc_only_wedge_enabled_flag,
      cqt_cu_part_pred_enabled_flag,
      inter_dc_only_enabled_flag,
      skip_intra_enabled_flag
    };
  }
  function h265ParseConfiguration(data) {
    const { videoParameterSet, sequenceParameterSet, pictureParameterSet } = h265SearchConfiguration(data);
    const { profileTierLevel: { generalProfileTier: { profile_space: generalProfileSpace, tier_flag: generalTierFlag, profile_idc: generalProfileIndex, profileCompatibilitySet: generalProfileCompatibilitySet, constraintSet: generalConstraintSet }, general_level_idc: generalLevelIndex } } = h265ParseVideoParameterSet(videoParameterSet.rbsp);
    const { chroma_format_idc, pic_width_in_luma_samples: encodedWidth, pic_height_in_luma_samples: encodedHeight, conf_win_left_offset: cropLeft = 0, conf_win_right_offset: cropRight = 0, conf_win_top_offset: cropTop = 0, conf_win_bottom_offset: cropBottom = 0 } = h265ParseSequenceParameterSet(sequenceParameterSet.rbsp);
    const SubWidthC = getSubWidthC2(chroma_format_idc);
    const SubHeightC = getSubHeightC2(chroma_format_idc);
    const croppedWidth = encodedWidth - SubWidthC * (cropLeft + cropRight);
    const croppedHeight = encodedHeight - SubHeightC * (cropTop + cropBottom);
    return {
      videoParameterSet,
      sequenceParameterSet,
      pictureParameterSet,
      generalProfileSpace,
      generalProfileIndex,
      generalProfileCompatibilitySet,
      generalTierFlag,
      generalLevelIndex,
      generalConstraintSet,
      encodedWidth,
      encodedHeight,
      cropLeft,
      cropRight,
      cropTop,
      cropBottom,
      croppedWidth,
      croppedHeight
    };
  }

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/codec/utils.js
  function hexDigits2(value) {
    return value.toString(16).toUpperCase();
  }
  function hexTwoDigits2(value) {
    return value.toString(16).toUpperCase().padStart(2, "0");
  }
  function decimalTwoDigits2(value) {
    return value.toString(10).padStart(2, "0");
  }

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/codec/av1.js
  var Av1Codec = class {
    #decoder;
    #updateSize;
    #options;
    #config;
    #configured = false;
    constructor(decoder, updateSize, options) {
      this.#decoder = decoder;
      this.#updateSize = updateSize;
      this.#options = options;
    }
    #parseConfig(data) {
      const parser = new Av13(data);
      const sequenceHeader = parser.searchSequenceHeaderObu();
      if (!sequenceHeader) {
        return;
      }
      const { seq_profile: seqProfile, seq_level_idx: [seqLevelIdx = 0], max_frame_width_minus_1, max_frame_height_minus_1, color_config: { BitDepth, mono_chrome: monoChrome, subsampling_x: subsamplingX, subsampling_y: subsamplingY, chroma_sample_position: chromaSamplePosition, color_description_present_flag } } = sequenceHeader;
      let colorPrimaries;
      let transferCharacteristics;
      let matrixCoefficients;
      let colorRange;
      if (color_description_present_flag) {
        ({
          color_primaries: colorPrimaries,
          transfer_characteristics: transferCharacteristics,
          matrix_coefficients: matrixCoefficients,
          color_range: colorRange
        } = sequenceHeader.color_config);
      } else {
        colorPrimaries = Av13.ColorPrimaries.Bt709;
        transferCharacteristics = Av13.TransferCharacteristics.Bt709;
        matrixCoefficients = Av13.MatrixCoefficients.Bt709;
        colorRange = false;
      }
      const width = max_frame_width_minus_1 + 1;
      const height = max_frame_height_minus_1 + 1;
      this.#updateSize(width, height);
      const codec = [
        "av01",
        seqProfile.toString(16),
        decimalTwoDigits2(seqLevelIdx) + (sequenceHeader.seq_tier[0] ? "H" : "M"),
        decimalTwoDigits2(BitDepth),
        monoChrome ? "1" : "0",
        (subsamplingX ? "1" : "0") + (subsamplingY ? "1" : "0") + chromaSamplePosition.toString(),
        decimalTwoDigits2(colorPrimaries),
        decimalTwoDigits2(transferCharacteristics),
        decimalTwoDigits2(matrixCoefficients),
        colorRange ? "1" : "0"
      ].join(".");
      this.#config = {
        codec,
        hardwareAcceleration: this.#options?.hardwareAcceleration ?? "no-preference",
        optimizeForLatency: true
      };
      this.#configured = false;
    }
    decode(packet) {
      if (packet.type === "configuration") {
        return;
      }
      this.#parseConfig(packet.data);
      if (!this.#config) {
        throw new Error("Decoder not configured");
      }
      if (packet.keyframe) {
        if (this.#decoder.decodeQueueSize) {
          this.#decoder.reset();
          this.#decoder.configure(this.#config);
          this.#configured = true;
        } else if (!this.#configured) {
          this.#decoder.configure(this.#config);
          this.#configured = true;
        }
      }
      this.#decoder.decode(new EncodedVideoChunk({
        // AV1 requires Scrcpy 2.0 where `keyframe` flag must be set
        type: packet.keyframe ? "key" : "delta",
        timestamp: 0,
        data: packet.data
      }));
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/codec/h26x.js
  var H26xDecoder = class {
    #decoder;
    #config;
    #configured = false;
    constructor(decoder) {
      this.#decoder = decoder;
    }
    #configureAndDecodeFirstKeyframe(config, packet) {
      this.#decoder.configure(config);
      this.#configured = true;
      const { raw } = config;
      const data = new Uint8Array(raw.length + packet.data.length);
      data.set(raw, 0);
      data.set(packet.data, raw.length);
      this.#decoder.decode(new EncodedVideoChunk({
        type: "key",
        timestamp: 0,
        data
      }));
    }
    decode(packet) {
      if (packet.type === "configuration") {
        this.#config = {
          ...this.configure(packet.data),
          raw: packet.data
        };
        this.#configured = false;
        return;
      }
      if (!this.#config) {
        throw new Error("Decoder not configured");
      }
      if (packet.keyframe) {
        if (this.#decoder.decodeQueueSize) {
          this.#decoder.reset();
          this.#configureAndDecodeFirstKeyframe(this.#config, packet);
          return;
        }
        if (!this.#configured) {
          this.#configureAndDecodeFirstKeyframe(this.#config, packet);
          return;
        }
      }
      if (!this.#configured) {
        if (packet.keyframe === void 0) {
          this.#configureAndDecodeFirstKeyframe(this.#config, packet);
          return;
        }
        throw new Error("Expect a keyframe but got a delta frame");
      }
      this.#decoder.decode(new EncodedVideoChunk({
        // Treat `undefined` as `key`, otherwise won't decode.
        type: packet.keyframe === false ? "delta" : "key",
        timestamp: 0,
        data: packet.data
      }));
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/codec/h264.js
  var H264Decoder = class extends H26xDecoder {
    #updateSize;
    #options;
    constructor(decoder, updateSize, options) {
      super(decoder);
      this.#updateSize = updateSize;
      this.#options = options;
    }
    configure(data) {
      const { profileIndex, constraintSet, levelIndex, croppedWidth, croppedHeight } = h264ParseConfiguration(data);
      this.#updateSize(croppedWidth, croppedHeight);
      const codec = "avc1." + hexTwoDigits2(profileIndex) + hexTwoDigits2(constraintSet) + hexTwoDigits2(levelIndex);
      return {
        codec,
        hardwareAcceleration: this.#options?.hardwareAcceleration ?? "no-preference",
        optimizeForLatency: true
      };
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/codec/h265.js
  var H265Decoder = class extends H26xDecoder {
    #updateSize;
    #options;
    constructor(decoder, updateSize, options) {
      super(decoder);
      this.#updateSize = updateSize;
      this.#options = options;
    }
    configure(data) {
      const { generalProfileSpace, generalProfileIndex, generalProfileCompatibilitySet, generalTierFlag, generalLevelIndex, generalConstraintSet, croppedWidth, croppedHeight } = h265ParseConfiguration(data);
      this.#updateSize(croppedWidth, croppedHeight);
      const codec = [
        "hev1",
        ["", "A", "B", "C"][generalProfileSpace] + generalProfileIndex.toString(),
        hexDigits2(getUint32LittleEndian(generalProfileCompatibilitySet, 0)),
        (generalTierFlag ? "H" : "L") + generalLevelIndex.toString(),
        ...Array.from(generalConstraintSet, hexDigits2)
      ].join(".");
      return {
        codec,
        // Microsoft Edge requires explicit size to work
        codedWidth: croppedWidth,
        codedHeight: croppedHeight,
        hardwareAcceleration: this.#options?.hardwareAcceleration ?? "no-preference",
        optimizeForLatency: true
      };
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/pool.js
  var Pool = class {
    #controller;
    #readable = new ReadableStream({
      start: (controller) => {
        this.#controller = controller;
      },
      pull: (controller) => {
        controller.enqueue(this.#initializer());
      }
    }, { highWaterMark: 0 });
    #reader = this.#readable.getReader();
    #initializer;
    #size = 0;
    #capacity;
    constructor(initializer, capacity) {
      this.#initializer = initializer;
      this.#capacity = capacity;
    }
    async borrow() {
      const result = await this.#reader.read();
      return result.value;
    }
    return(value) {
      if (this.#size < this.#capacity) {
        this.#controller.enqueue(value);
        this.#size += 1;
      }
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/snapshot.js
  var VideoFrameCapturer = class {
    #canvas;
    #context;
    constructor() {
      if (typeof OffscreenCanvas !== "undefined") {
        this.#canvas = new OffscreenCanvas(1, 1);
      } else {
        this.#canvas = document.createElement("canvas");
        this.#canvas.width = 1;
        this.#canvas.height = 1;
      }
      this.#context = this.#canvas.getContext("bitmaprenderer", {
        alpha: false
      });
    }
    async capture(frame) {
      this.#canvas.width = frame.displayWidth;
      this.#canvas.height = frame.displayHeight;
      const bitmap = await createImageBitmap(frame);
      this.#context.transferFromImageBitmap(bitmap);
      if (this.#canvas instanceof OffscreenCanvas) {
        return await this.#canvas.convertToBlob({
          type: "image/png"
        });
      } else {
        return new Promise((resolve, reject) => {
          this.#canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Failed to convert canvas to blob"));
            } else {
              resolve(blob);
            }
          }, "image/png");
        });
      }
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/decoder.js
  var VideoFrameCapturerPool = /* @__PURE__ */ new Pool(() => new VideoFrameCapturer(), 4);
  var WebCodecsVideoDecoder = class {
    static get isSupported() {
      return typeof globalThis.VideoDecoder !== "undefined";
    }
    static capabilities = {
      h264: {},
      h265: {},
      av1: {}
    };
    #codec;
    get codec() {
      return this.#codec;
    }
    #renderer;
    get renderer() {
      return this.#renderer;
    }
    #options;
    #codecDecoder;
    #writable;
    get writable() {
      return this.#writable;
    }
    #error;
    #controller;
    #framesDraw = 0;
    #framesPresented = 0;
    get framesRendered() {
      return this.#framesPresented;
    }
    #framesSkipped = 0;
    get framesSkipped() {
      return this.#framesSkipped;
    }
    #sizeChanged = new StickyEventEmitter();
    get sizeChanged() {
      return this.#sizeChanged.event;
    }
    #width = 0;
    get width() {
      return this.#width;
    }
    #height = 0;
    get height() {
      return this.#height;
    }
    #decoder;
    #drawing = false;
    #nextFrame;
    #captureFrame;
    #animationFrameId = 0;
    /**
     * Create a new WebCodecs video decoder.
     */
    constructor({ codec, renderer, ...options }) {
      this.#codec = codec;
      this.#renderer = renderer;
      this.#options = options;
      this.#decoder = new VideoDecoder({
        output: (frame) => {
          this.#captureFrame?.close();
          this.#captureFrame = frame.clone();
          if (this.#drawing) {
            if (this.#nextFrame) {
              this.#nextFrame.close();
              this.#framesSkipped += 1;
            }
            this.#nextFrame = frame;
            return;
          }
          void this.#draw(frame);
        },
        error: (error) => {
          this.#setError(error);
        }
      });
      switch (this.#codec) {
        case ScrcpyVideoCodecId.H264:
          this.#codecDecoder = new H264Decoder(this.#decoder, this.#updateSize, this.#options);
          break;
        case ScrcpyVideoCodecId.H265:
          this.#codecDecoder = new H265Decoder(this.#decoder, this.#updateSize, this.#options);
          break;
        case ScrcpyVideoCodecId.AV1:
          this.#codecDecoder = new Av1Codec(this.#decoder, this.#updateSize, this.#options);
          break;
        default:
          throw new Error(`Unsupported codec: ${this.#codec}`);
      }
      this.#writable = new WritableStream({
        start: (controller) => {
          if (this.#error) {
            controller.error(this.#error);
          } else {
            this.#controller = controller;
          }
        },
        write: (packet) => {
          this.#codecDecoder.decode(packet);
        }
      });
      this.#handleAnimationFrame();
    }
    #setError(error) {
      if (this.#controller) {
        try {
          this.#controller.error(error);
        } catch {
        }
      } else {
        this.#error = error;
      }
    }
    async #draw(frame) {
      try {
        this.#drawing = true;
        this.#updateSize(frame.displayWidth, frame.displayHeight);
        await this.#renderer.draw(frame);
        this.#framesDraw += 1;
        frame.close();
        if (this.#nextFrame) {
          const frame2 = this.#nextFrame;
          this.#nextFrame = void 0;
          await this.#draw(frame2);
        }
        this.#drawing = false;
      } catch (error) {
        this.#setError(error);
      }
    }
    #updateSize = (width, height) => {
      this.#renderer.setSize(width, height);
      this.#width = width;
      this.#height = height;
      this.#sizeChanged.fire({ width, height });
    };
    #handleAnimationFrame = () => {
      if (this.#framesDraw > 0) {
        this.#framesPresented += 1;
        this.#framesSkipped += this.#framesDraw - 1;
        this.#framesDraw = 0;
      }
      this.#animationFrameId = requestAnimationFrame(this.#handleAnimationFrame);
    };
    async snapshot() {
      const frame = this.#captureFrame;
      if (!frame) {
        return void 0;
      }
      const capturer = await VideoFrameCapturerPool.borrow();
      const result = await capturer.capture(frame);
      VideoFrameCapturerPool.return(capturer);
      return result;
    }
    dispose() {
      cancelAnimationFrame(this.#animationFrameId);
      if (this.#decoder.state !== "closed") {
        this.#decoder.close();
      }
      this.#nextFrame?.close();
      this.#captureFrame?.close();
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-tinyh264/node_modules/@yume-chan/scrcpy/esm/codec/nalu.js
  function* annexBSplitNalu3(buffer3) {
    let start = -1;
    let zeroCount = 0;
    let inEmulation = false;
    for (let i = 0; i < buffer3.length; i += 1) {
      const byte = buffer3[i];
      if (inEmulation) {
        if (byte > 3) {
          throw new Error("Invalid data");
        }
        inEmulation = false;
        continue;
      }
      if (byte === 0) {
        zeroCount += 1;
        continue;
      }
      const prevZeroCount = zeroCount;
      zeroCount = 0;
      if (start === -1) {
        if (prevZeroCount >= 2 && byte === 1) {
          start = i + 1;
          continue;
        }
        throw new Error("Invalid data");
      }
      if (prevZeroCount < 2) {
        continue;
      }
      if (byte === 1) {
        yield buffer3.subarray(start, i - prevZeroCount);
        start = i + 1;
        continue;
      }
      if (prevZeroCount > 2) {
        throw new Error("Invalid data");
      }
      switch (byte) {
        case 2:
          throw new Error("Invalid data");
        case 3:
          inEmulation = true;
          break;
        default:
          break;
      }
    }
    if (inEmulation) {
      throw new Error("Invalid data");
    }
    yield buffer3.subarray(start, buffer3.length);
  }
  var NaluSodbBitReader3 = class {
    #nalu;
    // logical length is `#byteLength * 8 + (7 - #stopBitIndex)`
    #byteLength;
    #stopBitIndex;
    #zeroCount = 0;
    // logical position is `#bytePosition * 8 + (7 - #bitPosition)`
    #bytePosition = 0;
    #bitPosition = 7;
    #byte = 0;
    get byteLength() {
      return this.#byteLength;
    }
    get stopBitIndex() {
      return this.#stopBitIndex;
    }
    get bytePosition() {
      return this.#bytePosition;
    }
    get bitPosition() {
      return this.#bitPosition;
    }
    get ended() {
      return this.#bytePosition >= this.#byteLength && this.#bitPosition <= this.#stopBitIndex;
    }
    constructor(nalu) {
      this.#nalu = nalu;
      for (let i = nalu.length - 1; i >= 0; i -= 1) {
        if (this.#nalu[i] === 0) {
          continue;
        }
        const byte = nalu[i];
        for (let j = 0; j < 8; j += 1) {
          if ((byte >> j & 1) === 1) {
            this.#byteLength = i;
            this.#stopBitIndex = j;
            this.#loadByte();
            return;
          }
        }
      }
      throw new Error("Stop bit not found");
    }
    #loadByte() {
      this.#byte = this.#nalu[this.#bytePosition];
      if (this.#zeroCount === 2 && this.#byte === 3) {
        this.#zeroCount = 0;
        this.#bytePosition += 1;
        this.#loadByte();
        return;
      }
      if (this.#byte === 0) {
        this.#zeroCount += 1;
      } else {
        this.#zeroCount = 0;
      }
    }
    next() {
      if (this.ended) {
        throw new Error("Bit index out of bounds");
      }
      const value = this.#byte >> this.#bitPosition & 1;
      this.#bitPosition -= 1;
      if (this.#bitPosition < 0) {
        this.#bytePosition += 1;
        this.#bitPosition = 7;
        this.#loadByte();
      }
      return value;
    }
    read(length) {
      if (length > 32) {
        throw new Error("Read length too large");
      }
      let result = 0;
      for (let i = 0; i < length; i += 1) {
        result = result << 1 | this.next();
      }
      return result;
    }
    /**
     * Throws an error if the current position is invalid for `skip`.
     *
     * Usually it will throw if `ended` is `true`,
     * except when the bit position is at the stop bit,
     * in which case `ended` will be `true`, but it won't throw.
     * `skip` can skip all remaining bits, and stop at the end position.
     * The next `next` call will throw since there is no more bits to read.
     */
    #checkSkipPosition() {
      if (this.#bytePosition >= this.#byteLength && this.#bitPosition < this.#stopBitIndex) {
        throw new Error("Bit index out of bounds");
      }
    }
    skip(length) {
      if (length <= this.#bitPosition + 1) {
        this.#bitPosition -= length;
        this.#checkSkipPosition();
        return;
      }
      length -= this.#bitPosition + 1;
      this.#bytePosition += 1;
      this.#bitPosition = 7;
      this.#loadByte();
      this.#checkSkipPosition();
      for (; length >= 8; length -= 8) {
        this.#bytePosition += 1;
        this.#loadByte();
        this.#checkSkipPosition();
      }
      this.#bitPosition = 7 - length;
      this.#checkSkipPosition();
    }
    decodeExponentialGolombNumber() {
      let length = 0;
      while (this.next() === 0) {
        length += 1;
      }
      if (length === 0) {
        return 0;
      }
      return (1 << length | this.read(length)) - 1;
    }
    #save() {
      return {
        zeroCount: this.#zeroCount,
        bytePosition: this.#bytePosition,
        bitPosition: this.#bitPosition,
        byte: this.#byte
      };
    }
    #restore(state) {
      this.#zeroCount = state.zeroCount;
      this.#bytePosition = state.bytePosition;
      this.#bitPosition = state.bitPosition;
      this.#byte = state.byte;
    }
    peek(length) {
      const state = this.#save();
      const result = this.read(length);
      this.#restore(state);
      return result;
    }
    readBytes(length) {
      const result = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) {
        result[i] = this.read(8);
      }
      return result;
    }
    peekBytes(length) {
      const state = this.#save();
      const result = this.readBytes(length);
      this.#restore(state);
      return result;
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-tinyh264/node_modules/@yume-chan/scrcpy/esm/codec/h264.js
  var AndroidAvcProfile2 = {
    Baseline: 1 << 0,
    Main: 1 << 1,
    Extended: 1 << 2,
    High: 1 << 3,
    High10: 1 << 4,
    High422: 1 << 5,
    High444: 1 << 6,
    ConstrainedBaseline: 1 << 16,
    ConstrainedHigh: 1 << 19
  };
  var AndroidAvcLevel2 = {
    Level1: 1 << 0,
    Level1b: 1 << 1,
    Level11: 1 << 2,
    Level12: 1 << 3,
    Level13: 1 << 4,
    Level2: 1 << 5,
    Level21: 1 << 6,
    Level22: 1 << 7,
    Level3: 1 << 8,
    Level31: 1 << 9,
    Level32: 1 << 10,
    Level4: 1 << 11,
    Level41: 1 << 12,
    Level42: 1 << 13,
    Level5: 1 << 14,
    Level51: 1 << 15,
    Level52: 1 << 16,
    Level6: 1 << 17,
    Level61: 1 << 18,
    Level62: 1 << 19
  };
  function h264ParseSequenceParameterSet2(nalu) {
    const reader = new NaluSodbBitReader3(nalu);
    if (reader.next() !== 0) {
      throw new Error("Invalid data");
    }
    const nal_ref_idc = reader.read(2);
    const nal_unit_type = reader.read(5);
    if (nal_unit_type !== 7) {
      throw new Error("Invalid data");
    }
    if (nal_ref_idc === 0) {
      throw new Error("Invalid data");
    }
    const profile_idc = reader.read(8);
    const constraint_set = reader.peek(8);
    const constraint_set0_flag = !!reader.next();
    const constraint_set1_flag = !!reader.next();
    const constraint_set2_flag = !!reader.next();
    const constraint_set3_flag = !!reader.next();
    const constraint_set4_flag = !!reader.next();
    const constraint_set5_flag = !!reader.next();
    if (reader.read(2) !== 0) {
      throw new Error("Invalid data");
    }
    const level_idc = reader.read(8);
    const seq_parameter_set_id = reader.decodeExponentialGolombNumber();
    if (profile_idc === 100 || profile_idc === 110 || profile_idc === 122 || profile_idc === 244 || profile_idc === 44 || profile_idc === 83 || profile_idc === 86 || profile_idc === 118 || profile_idc === 128 || profile_idc === 138 || profile_idc === 139 || profile_idc === 134) {
      const chroma_format_idc = reader.decodeExponentialGolombNumber();
      if (chroma_format_idc === 3) {
        reader.next();
      }
      reader.decodeExponentialGolombNumber();
      reader.decodeExponentialGolombNumber();
      reader.next();
      const seq_scaling_matrix_present_flag = !!reader.next();
      if (seq_scaling_matrix_present_flag) {
        const seq_scaling_list_present_flag = [];
        for (let i = 0; i < (chroma_format_idc !== 3 ? 8 : 12); i += 1) {
          seq_scaling_list_present_flag[i] = !!reader.next();
          if (seq_scaling_list_present_flag[i])
            if (i < 6) {
            } else {
            }
        }
      }
    }
    reader.decodeExponentialGolombNumber();
    const pic_order_cnt_type = reader.decodeExponentialGolombNumber();
    if (pic_order_cnt_type === 0) {
      reader.decodeExponentialGolombNumber();
    } else if (pic_order_cnt_type === 1) {
      reader.next();
      reader.decodeExponentialGolombNumber();
      reader.decodeExponentialGolombNumber();
      const num_ref_frames_in_pic_order_cnt_cycle = reader.decodeExponentialGolombNumber();
      const offset_for_ref_frame = [];
      for (let i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i += 1) {
        offset_for_ref_frame[i] = reader.decodeExponentialGolombNumber();
      }
    }
    reader.decodeExponentialGolombNumber();
    reader.next();
    const pic_width_in_mbs_minus1 = reader.decodeExponentialGolombNumber();
    const pic_height_in_map_units_minus1 = reader.decodeExponentialGolombNumber();
    const frame_mbs_only_flag = reader.next();
    if (!frame_mbs_only_flag) {
      reader.next();
    }
    reader.next();
    const frame_cropping_flag = !!reader.next();
    let frame_crop_left_offset;
    let frame_crop_right_offset;
    let frame_crop_top_offset;
    let frame_crop_bottom_offset;
    if (frame_cropping_flag) {
      frame_crop_left_offset = reader.decodeExponentialGolombNumber();
      frame_crop_right_offset = reader.decodeExponentialGolombNumber();
      frame_crop_top_offset = reader.decodeExponentialGolombNumber();
      frame_crop_bottom_offset = reader.decodeExponentialGolombNumber();
    } else {
      frame_crop_left_offset = 0;
      frame_crop_right_offset = 0;
      frame_crop_top_offset = 0;
      frame_crop_bottom_offset = 0;
    }
    const vui_parameters_present_flag = !!reader.next();
    if (vui_parameters_present_flag) {
    }
    return {
      profile_idc,
      constraint_set,
      constraint_set0_flag,
      constraint_set1_flag,
      constraint_set2_flag,
      constraint_set3_flag,
      constraint_set4_flag,
      constraint_set5_flag,
      level_idc,
      seq_parameter_set_id,
      pic_width_in_mbs_minus1,
      pic_height_in_map_units_minus1,
      frame_mbs_only_flag,
      frame_cropping_flag,
      frame_crop_left_offset,
      frame_crop_right_offset,
      frame_crop_top_offset,
      frame_crop_bottom_offset
    };
  }
  function h264SearchConfiguration2(buffer3) {
    let sequenceParameterSet;
    let pictureParameterSet;
    for (const nalu of annexBSplitNalu3(buffer3)) {
      const naluType = nalu[0] & 31;
      switch (naluType) {
        case 7:
          sequenceParameterSet = nalu;
          if (pictureParameterSet) {
            return {
              sequenceParameterSet,
              pictureParameterSet
            };
          }
          break;
        case 8:
          pictureParameterSet = nalu;
          if (sequenceParameterSet) {
            return {
              sequenceParameterSet,
              pictureParameterSet
            };
          }
          break;
        default:
          break;
      }
    }
    throw new Error("Invalid data");
  }
  function h264ParseConfiguration2(data) {
    const { sequenceParameterSet, pictureParameterSet } = h264SearchConfiguration2(data);
    const { profile_idc: profileIndex, constraint_set: constraintSet, level_idc: levelIndex, pic_width_in_mbs_minus1, pic_height_in_map_units_minus1, frame_mbs_only_flag, frame_crop_left_offset, frame_crop_right_offset, frame_crop_top_offset, frame_crop_bottom_offset } = h264ParseSequenceParameterSet2(sequenceParameterSet);
    const encodedWidth = (pic_width_in_mbs_minus1 + 1) * 16;
    const encodedHeight = (pic_height_in_map_units_minus1 + 1) * (2 - frame_mbs_only_flag) * 16;
    const cropLeft = frame_crop_left_offset * 2;
    const cropRight = frame_crop_right_offset * 2;
    const cropTop = frame_crop_top_offset * 2;
    const cropBottom = frame_crop_bottom_offset * 2;
    const croppedWidth = encodedWidth - cropLeft - cropRight;
    const croppedHeight = encodedHeight - cropTop - cropBottom;
    return {
      pictureParameterSet,
      sequenceParameterSet,
      profileIndex,
      constraintSet,
      levelIndex,
      encodedWidth,
      encodedHeight,
      cropLeft,
      cropRight,
      cropTop,
      cropBottom,
      croppedWidth,
      croppedHeight
    };
  }

  // node_modules/@yume-chan/scrcpy-decoder-tinyh264/esm/decoder.js
  var import_yuv_buffer = __toESM(require_yuv_buffer(), 1);
  var import_yuv_canvas = __toESM(require_yuv_canvas(), 1);

  // node_modules/@yume-chan/scrcpy-decoder-tinyh264/esm/wrapper.js
  var worker;
  var workerReady = false;
  var pendingResolvers = [];
  var streamId = 0;
  var PICTURE_READY_SUBSCRIPTIONS = /* @__PURE__ */ new Map();
  function subscribePictureReady(streamId2, handler) {
    PICTURE_READY_SUBSCRIPTIONS.set(streamId2, handler);
    return {
      dispose() {
        PICTURE_READY_SUBSCRIPTIONS.delete(streamId2);
      }
    };
  }
  var TinyH264Wrapper = class extends AutoDisposable {
    streamId;
    #pictureReadyEvent = new EventEmitter();
    get onPictureReady() {
      return this.#pictureReadyEvent.event;
    }
    constructor(streamId2) {
      super();
      this.streamId = streamId2;
      this.addDisposable(subscribePictureReady(streamId2, this.#handlePictureReady));
    }
    #handlePictureReady = (e) => {
      this.#pictureReadyEvent.fire(e);
    };
    feed(data) {
      worker.postMessage({
        type: "decode",
        data,
        offset: 0,
        length: data.byteLength,
        renderStateId: this.streamId
      }, [data]);
    }
    dispose() {
      super.dispose();
      worker.postMessage({
        type: "release",
        renderStateId: this.streamId
      });
    }
  };
  function createTinyH264Wrapper() {
    if (!worker) {
      worker = new Worker("dist/worker.js", {
        type: "module"
      });
      worker.addEventListener("message", ({ data }) => {
        switch (data.type) {
          case "decoderReady":
            workerReady = true;
            for (const resolver of pendingResolvers) {
              resolver.resolve(new TinyH264Wrapper(streamId));
              streamId += 1;
            }
            pendingResolvers.length = 0;
            break;
          case "pictureReady":
            PICTURE_READY_SUBSCRIPTIONS.get(data.renderStateId)?.(data);
            break;
        }
      });
    }
    if (!workerReady) {
      const resolver = new PromiseResolver();
      pendingResolvers.push(resolver);
      return resolver.promise;
    }
    const decoder = new TinyH264Wrapper(streamId);
    streamId += 1;
    return Promise.resolve(decoder);
  }

  // node_modules/@yume-chan/scrcpy-decoder-tinyh264/esm/decoder.js
  var noop = () => {
  };
  function createCanvas() {
    if (typeof document !== "undefined") {
      return document.createElement("canvas");
    }
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(1, 1);
    }
    throw new Error("no canvas input found nor any canvas can be created");
  }
  var TinyH264Decoder = class {
    static capabilities = {
      h264: {
        maxProfile: AndroidAvcProfile2.Baseline,
        maxLevel: AndroidAvcLevel2.Level4
      }
    };
    #renderer;
    get renderer() {
      return this.#renderer;
    }
    #sizeChanged = new StickyEventEmitter();
    get sizeChanged() {
      return this.#sizeChanged.event;
    }
    #width = 0;
    get width() {
      return this.#width;
    }
    #height = 0;
    get height() {
      return this.#height;
    }
    #frameRendered = 0;
    get framesRendered() {
      return this.#frameRendered;
    }
    #frameSkipped = 0;
    get framesSkipped() {
      return this.#frameSkipped;
    }
    #writable;
    get writable() {
      return this.#writable;
    }
    #yuvCanvas;
    #initializer;
    constructor({ canvas: canvas2 } = {}) {
      if (canvas2) {
        this.#renderer = canvas2;
      } else {
        this.#renderer = createCanvas();
      }
      this.#writable = new WritableStream({
        write: async (packet) => {
          switch (packet.type) {
            case "configuration":
              await this.#configure(packet.data);
              break;
            case "data": {
              if (!this.#initializer) {
                throw new Error("Decoder not configured");
              }
              const wrapper = await this.#initializer.promise;
              wrapper.feed(packet.data.slice().buffer);
              break;
            }
          }
        }
      });
    }
    async #configure(data) {
      this.dispose();
      this.#initializer = new PromiseResolver();
      if (!this.#yuvCanvas) {
        const canvas2 = createCanvas();
        const attributes = {
          // Disallow software rendering.
          // Other rendering methods are faster than software-based WebGL.
          failIfMajorPerformanceCaveat: true
        };
        const gl = canvas2.getContext("webgl2", attributes) || canvas2.getContext("webgl", attributes);
        this.#yuvCanvas = import_yuv_canvas.default.attach(this.#renderer, {
          webGL: !!gl
        });
      }
      const { encodedWidth, encodedHeight, croppedWidth, croppedHeight, cropLeft, cropTop } = h264ParseConfiguration2(data);
      this.#width = croppedWidth;
      this.#height = croppedHeight;
      this.#sizeChanged.fire({
        width: croppedWidth,
        height: croppedHeight
      });
      const chromaWidth = encodedWidth / 2;
      const chromaHeight = encodedHeight / 2;
      const format = import_yuv_buffer.default.format({
        width: encodedWidth,
        height: encodedHeight,
        chromaWidth,
        chromaHeight,
        cropLeft,
        cropTop,
        cropWidth: croppedWidth,
        cropHeight: croppedHeight,
        displayWidth: croppedWidth,
        displayHeight: croppedHeight
      });
      const wrapper = await createTinyH264Wrapper();
      this.#initializer.resolve(wrapper);
      const uPlaneOffset = encodedWidth * encodedHeight;
      const vPlaneOffset = uPlaneOffset + chromaWidth * chromaHeight;
      wrapper.onPictureReady(({ data: data2 }) => {
        this.#frameRendered += 1;
        const array = new Uint8Array(data2);
        const frame = import_yuv_buffer.default.frame(format, import_yuv_buffer.default.lumaPlane(format, array, encodedWidth, 0), import_yuv_buffer.default.chromaPlane(format, array, chromaWidth, uPlaneOffset), import_yuv_buffer.default.chromaPlane(format, array, chromaWidth, vPlaneOffset));
        this.#yuvCanvas.drawFrame(frame);
      });
      wrapper.feed(data.slice().buffer);
    }
    dispose() {
      this.#initializer?.promise.then((wrapper) => wrapper.dispose()).catch(noop);
      this.#initializer = void 0;
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/render/canvas.js
  var CanvasVideoFrameRenderer = class {
    #canvas;
    get canvas() {
      return this.#canvas;
    }
    constructor(canvas2) {
      if (canvas2) {
        this.#canvas = canvas2;
      } else {
        this.#canvas = createCanvas();
      }
    }
    setSize(width, height) {
      if (this.#canvas.width !== width || this.#canvas.height !== height) {
        this.#canvas.width = width;
        this.#canvas.height = height;
      }
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/render/webgl.js
  var Resolved = Promise.resolve();
  function createContext(canvas2, enableCapture) {
    const attributes = {
      // Low-power GPU should be enough for video rendering.
      powerPreference: "low-power",
      alpha: false,
      // Disallow software rendering.
      // Other rendering methods are faster than software-based WebGL.
      failIfMajorPerformanceCaveat: true,
      preserveDrawingBuffer: !!enableCapture
    };
    return canvas2.getContext("webgl2", attributes) || canvas2.getContext("webgl", attributes);
  }
  var WebGLVideoFrameRenderer = class _WebGLVideoFrameRenderer extends CanvasVideoFrameRenderer {
    static vertexShaderSource = `
        attribute vec2 xy;

        varying highp vec2 uv;

        void main(void) {
            gl_Position = vec4(xy, 0.0, 1.0);
            // Map vertex coordinates (-1 to +1) to UV coordinates (0 to 1).
            // UV coordinates are Y-flipped relative to vertex coordinates.
            uv = vec2((1.0 + xy.x) / 2.0, (1.0 - xy.y) / 2.0);
        }
`;
    static fragmentShaderSource = `
        varying highp vec2 uv;

        uniform sampler2D texture;

        void main(void) {
            gl_FragColor = texture2D(texture, uv);
        }
`;
    static get isSupported() {
      const canvas2 = createCanvas();
      return !!createContext(canvas2);
    }
    #context;
    /**
     * Create a new WebGL frame renderer.
     * @param canvas The canvas to render frames to.
     * @param enableCapture
     * Whether to allow capturing the canvas content using APIs like `readPixels` and `toDataURL`.
     * Enable this option may reduce performance.
     */
    constructor(canvas2, enableCapture) {
      super(canvas2);
      const gl = createContext(this.canvas, enableCapture);
      if (!gl) {
        throw new Error("WebGL not supported");
      }
      this.#context = gl;
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, _WebGLVideoFrameRenderer.vertexShaderSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(vertexShader));
      }
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, _WebGLVideoFrameRenderer.fragmentShaderSource);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(fragmentShader));
      }
      const shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);
      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(shaderProgram));
      }
      gl.useProgram(shaderProgram);
      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      const xyLocation = gl.getAttribLocation(shaderProgram, "xy");
      gl.vertexAttribPointer(xyLocation, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(xyLocation);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    draw(frame) {
      const gl = this.#context;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      return Resolved;
    }
  };

  // node_modules/@yume-chan/adb-credential-web/esm/index.js
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("Tango", 1);
      request.onerror = () => {
        reject(request.error);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("Authentication", { autoIncrement: true });
      };
      request.onsuccess = () => {
        const db = request.result;
        resolve(db);
      };
    });
  }
  async function saveKey(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("Authentication", "readwrite");
      const store = transaction.objectStore("Authentication");
      const putRequest = store.add(key);
      putRequest.onerror = () => {
        reject(putRequest.error);
      };
      putRequest.onsuccess = () => {
        resolve();
      };
      transaction.onerror = () => {
        reject(transaction.error);
      };
      transaction.oncomplete = () => {
        db.close();
      };
    });
  }
  async function getAllKeys() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("Authentication", "readonly");
      const store = transaction.objectStore("Authentication");
      const getRequest = store.getAll();
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
      getRequest.onsuccess = () => {
        resolve(getRequest.result);
      };
      transaction.onerror = () => {
        reject(transaction.error);
      };
      transaction.oncomplete = () => {
        db.close();
      };
    });
  }
  var AdbWebCredentialStore = class {
    #appName;
    constructor(appName = "Tango") {
      this.#appName = appName;
    }
    /**
     * Generates a RSA private key and store it into LocalStorage.
     *
     * Calling this method multiple times will overwrite the previous key.
     *
     * @returns The private key in PKCS #8 format.
     */
    async generateKey() {
      const { privateKey: cryptoKey } = await crypto.subtle.generateKey({
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        // 65537
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-1"
      }, true, ["sign", "verify"]);
      const privateKey = new Uint8Array(await crypto.subtle.exportKey("pkcs8", cryptoKey));
      await saveKey(privateKey);
      return {
        buffer: privateKey,
        name: `${this.#appName}@${globalThis.location.hostname}`
      };
    }
    /**
     * Yields the stored RSA private key.
     *
     * This method returns a generator, so `for await...of...` loop should be used to read the key.
     */
    async *iterateKeys() {
      for (const key of await getAllKeys()) {
        yield {
          buffer: key,
          name: `${this.#appName}@${globalThis.location.hostname}`
        };
      }
    }
  };

  // src/index.js
  var connectBtn = document.getElementById("connectBtn");
  var startBtn = document.getElementById("startBtn");
  var stopBtn = document.getElementById("stopBtn");
  var disconnectBtn = document.getElementById("disconnectBtn");
  var statusText = document.getElementById("status");
  var canvas = document.getElementById("videoCanvas");
  var globalDevice = null;
  var globalAdb = null;
  var globalClient = null;
  var globalDecoder = null;
  var globalSession = null;
  var Manager = AdbDaemonWebUsbDeviceManager.BROWSER;
  var CredentialStore = new AdbWebCredentialStore("Chrome ADB Scrcpy");
  function updateUI() {
    const inputs = document.querySelectorAll(".opt-input");
    if (globalClient) {
      connectBtn.disabled = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      disconnectBtn.disabled = false;
      inputs.forEach((i) => i.disabled = true);
    } else if (globalAdb) {
      connectBtn.disabled = true;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      disconnectBtn.disabled = false;
      inputs.forEach((i) => i.disabled = false);
    } else {
      connectBtn.disabled = false;
      startBtn.disabled = true;
      stopBtn.disabled = true;
      disconnectBtn.disabled = true;
      inputs.forEach((i) => i.disabled = false);
    }
  }
  connectBtn.addEventListener("click", async () => {
    try {
      const device = await Manager.requestDevice();
      if (!device) return;
      let connection;
      try {
        connection = await device.connect();
      } catch (connErr) {
        console.warn("Connection error (Device in use)", connErr);
        throw new Error("Device is already in use. Please close Android Studio and run 'adb kill-server' in your terminal, then reconnect.");
      }
      const authenticate = AdbDaemonTransport.authenticate || AdbDaemonTransport.default && AdbDaemonTransport.default.authenticate;
      if (!authenticate) {
        throw new Error("Critical internal error: AdbDaemonTransport.authenticate is missing! Dump: " + typeof AdbDaemonTransport);
      }
      const transport = await authenticate.call(AdbDaemonTransport, {
        serial: device.serial,
        connection,
        credentialStore: CredentialStore
      });
      globalDevice = device;
      globalAdb = new Adb(transport);
      statusText.innerText = `Connected: ${device.serial}`;
      updateUI();
    } catch (e) {
      console.error(e);
      if (e.output) {
        console.error("Scrcpy Server Error Output:", e.output.join("\n"));
        statusText.innerText = "Error (Server exited): " + e.output[0];
      } else {
        statusText.innerText = "Error: " + e.message;
      }
      alert(e.message + (e.output ? "\nCheck console for server logs." : ""));
    }
  });
  startBtn.addEventListener("click", async () => {
    if (!globalAdb) return;
    try {
      statusText.innerText = "Starting Scrcpy...";
      startBtn.disabled = true;
      document.querySelectorAll(".opt-input").forEach((i) => i.disabled = true);
      const response = await fetch("scrcpy-server.jar");
      const serverBuffer = await response.arrayBuffer();
      const serverStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(serverBuffer));
          controller.close();
        }
      });
      const sync = await globalAdb.sync();
      try {
        await sync.write({
          filename: "/data/local/tmp/scrcpy-server.jar",
          file: serverStream
        });
      } finally {
        await sync.dispose();
      }
      const maxSize = parseInt(document.getElementById("optMaxSize").value, 10);
      const bitRate = parseInt(document.getElementById("optBitRate").value, 10);
      const maxFps = parseInt(document.getElementById("optMaxFps").value, 10);
      const turnScreenOff = document.getElementById("optTurnScreenOff").checked;
      const stayAwake = document.getElementById("optStayAwake").checked;
      const altDeskStr = document.getElementById("optAltDesk").value;
      const videoCodec = document.getElementById("optVideoCodec").value;
      const videoEnabled = document.getElementById("optVideoEnabled").value === "true";
      const optionsInit = {
        logLevel: "verbose",
        video: videoEnabled,
        videoBitRate: bitRate,
        maxSize,
        maxFps,
        turnScreenOff,
        stayAwake,
        clipboardAutosync: false,
        // Prevents ID 80 crash
        videoCodec: videoCodec === "tinyh264" ? "h264" : videoCodec,
        videoCodecOptions: videoCodec === "tinyh264" ? "profile=1" : void 0,
        audio: false,
        control: true,
        sendFrameMeta: true
      };
      if (altDeskStr) {
        const parts = altDeskStr.split("/");
        if (parts.length === 2) {
          const dims = parts[0].split("x");
          optionsInit.displayId = 0;
          optionsInit.newDisplay = new NewDisplay(
            parseInt(dims[0], 10),
            parseInt(dims[1], 10),
            parseInt(parts[1], 10)
          );
        }
      }
      const options = new AdbScrcpyOptions4_1(optionsInit);
      globalClient = await AdbScrcpyClient.start(
        globalAdb,
        "/data/local/tmp/scrcpy-server.jar",
        options
      );
      updateUI();
      if (options.clipboard) {
        options.clipboard.pipeTo(new WritableStream({
          write(msg) {
          }
        })).catch((e) => console.warn("Clipboard stream err:", e));
      }
      if (options.uHidOutput) {
        options.uHidOutput.pipeTo(new WritableStream({
          write(msg) {
          }
        })).catch((e) => console.warn("uHidOutput stream err:", e));
      }
      globalClient.output.pipeTo(new WritableStream({
        write(line) {
          console.log("[Scrcpy Server]", line);
        }
      })).catch(() => {
      });
      const videoStream = await globalClient.videoStream;
      if (!videoEnabled) {
        if (altDeskStr) {
          const parts = altDeskStr.split("/");
          const dims = parts[0].split("x");
          globalSession = { width: parseInt(dims[0], 10), height: parseInt(dims[1], 10) };
        } else {
          globalSession = { width: 1080, height: 2424 };
        }
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (gl) {
          gl.clearColor(0.2, 0.2, 0.2, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        statusText.innerText = "Control Only Mode Active";
        return;
      }
      if (!videoStream) {
        statusText.innerText = "No video stream";
        return;
      }
      const { metadata, stream } = videoStream;
      if (videoCodec === "tinyh264") {
        globalDecoder = new TinyH264Decoder({
          canvas
        });
      } else {
        globalDecoder = new WebCodecsVideoDecoder({
          codec: metadata.codec,
          renderer: new WebGLVideoFrameRenderer(canvas)
        });
      }
      stream.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          if (chunk.type === "session") {
            console.log("Video session:", JSON.stringify(chunk));
            globalSession = chunk;
            return;
          }
          controller.enqueue(chunk);
        }
      })).pipeTo(globalDecoder.writable).catch((e) => {
        console.error(e);
        stopMirroring();
      });
      statusText.innerText = "Streaming";
    } catch (e) {
      console.error(e);
      globalClient = null;
      updateUI();
      if (e.output) {
        console.error("Scrcpy Server Error Output:", e.output.join("\n"));
        statusText.innerText = "Error (Server exited): " + e.output[0];
      } else {
        statusText.innerText = "Error: " + e.message;
      }
      alert(e.message + (e.output ? "\nCheck console for server logs." : ""));
    }
  });
  async function stopMirroring() {
    if (globalClient) {
      try {
        await globalClient.close();
      } catch (e) {
        console.error("Error stopping scrcpy client:", e);
      }
      globalClient = null;
    }
    if (globalDecoder) {
      try {
        globalDecoder.dispose();
      } catch (e) {
        console.error("Error disposing decoder:", e);
      }
      globalDecoder = null;
    }
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (gl) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    canvas.width = canvas.width;
    statusText.innerText = globalAdb ? "Stopped. Ready." : "Disconnected";
    updateUI();
  }
  stopBtn.addEventListener("click", stopMirroring);
  disconnectBtn.addEventListener("click", async () => {
    await stopMirroring();
    if (globalAdb) {
      try {
        await globalAdb.close();
      } catch (e) {
        console.error("Error closing ADB:", e);
      }
      globalAdb = null;
    }
    globalDevice = null;
    statusText.innerText = "Disconnected";
    updateUI();
  });
  var isDragging = false;
  function getMouseCoordinates(e) {
    if (!globalSession) return null;
    const rect = canvas.getBoundingClientRect();
    const videoRatio = globalSession.width / globalSession.height;
    const canvasRatio = rect.width / rect.height;
    let drawWidth, drawHeight, drawX, drawY;
    if (videoRatio > canvasRatio) {
      drawWidth = rect.width;
      drawHeight = rect.width / videoRatio;
      drawX = 0;
      drawY = (rect.height - drawHeight) / 2;
    } else {
      drawWidth = rect.height * videoRatio;
      drawHeight = rect.height;
      drawX = (rect.width - drawWidth) / 2;
      drawY = 0;
    }
    const x = e.clientX - rect.left - drawX;
    const y = e.clientY - rect.top - drawY;
    if (x < 0 || x > drawWidth || y < 0 || y > drawHeight) {
      return null;
    }
    return {
      x: Math.max(0, Math.min(globalSession.width, x / drawWidth * globalSession.width)),
      y: Math.max(0, Math.min(globalSession.height, y / drawHeight * globalSession.height))
    };
  }
  function handleMouseEvent(e) {
    if (!globalClient || !globalClient.controller) return;
    const coords = getMouseCoordinates(e);
    if (!coords && e.type !== "mouseup" && e.type !== "mouseleave") return;
    let action;
    if (e.type === "mousedown") {
      canvas.focus();
      action = 0;
      isDragging = true;
    } else if (e.type === "mouseup" || e.type === "mouseleave") {
      if (!isDragging) return;
      action = 1;
      isDragging = false;
    } else if (e.type === "mousemove") {
      if (!isDragging) return;
      action = 2;
    } else {
      return;
    }
    const sendX = coords ? coords.x : canvas._lastX || 0;
    const sendY = coords ? coords.y : canvas._lastY || 0;
    if (coords) {
      canvas._lastX = coords.x;
      canvas._lastY = coords.y;
    }
    const actionButton = 0;
    const buttons = action === 1 ? 0 : 1;
    globalClient.controller.injectTouch({
      action,
      pointerId: 1n,
      // Generic finger 1
      pointerX: Math.round(sendX),
      pointerY: Math.round(sendY),
      videoWidth: globalSession.width,
      videoHeight: globalSession.height,
      pressure: action === 1 ? 0 : 1,
      actionButton,
      buttons
    }).catch((err) => console.warn("Failed to inject touch", err));
  }
  canvas.addEventListener("mousedown", handleMouseEvent);
  canvas.addEventListener("mouseup", handleMouseEvent);
  canvas.addEventListener("mousemove", handleMouseEvent);
  canvas.addEventListener("mouseleave", handleMouseEvent);
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (globalClient?.controller) {
      globalClient.controller.backOrScreenOn(0).catch(() => {
      });
      setTimeout(() => globalClient.controller.backOrScreenOn(1).catch(() => {
      }), 50);
    }
  });
  var KEYCODE_MAP = {
    "Backspace": 67,
    "Enter": 66,
    "Escape": 4,
    // Back button
    "ArrowUp": 19,
    "ArrowDown": 20,
    "ArrowLeft": 21,
    "ArrowRight": 22,
    "Home": 3,
    // Home button
    "Tab": 61
  };
  function handleKeyEvent(e) {
    if (!globalClient || !globalClient.controller) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.key.startsWith("F")) return;
    const action = e.type === "keydown" ? 0 : 1;
    if (e.key.length === 1) {
      if (action === 0) {
        globalClient.controller.injectText(e.key).catch(() => {
        });
      }
      return;
    }
    const keyCode = KEYCODE_MAP[e.key];
    if (keyCode) {
      e.preventDefault();
      globalClient.controller.injectKeyCode({
        action,
        keyCode,
        repeat: 0,
        metaState: 0
      }).catch(() => {
      });
    }
  }
  window.addEventListener("keydown", handleKeyEvent);
  window.addEventListener("keyup", handleKeyEvent);
})();
/*! Bundled license information:

yuv-canvas/src/depower.js:
  (**
   * Convert a ratio into a bit-shift count; for instance a ratio of 2
   * becomes a bit-shift of 1, while a ratio of 1 is a bit-shift of 0.
   *
   * @author Brooke Vibber <bvibber@pobox.com>
   * @copyright 2016-2024
   * @license MIT-style
   *
   * @param {number} ratio - the integer ratio to convert.
   * @returns {number} - number of bits to shift to multiply/divide by the ratio.
   * @throws exception if given a non-power-of-two
   *)

yuv-canvas/src/YCbCr.js:
  (**
   * Basic YCbCr->RGB conversion
   *
   * @author Brooke Vibber <bvibber@pobox.com>
   * @copyright 2014-2024
   * @license MIT-style
   *
   * @param {YUVFrame} buffer - input frame buffer
   * @param {Uint8ClampedArray} output - array to draw RGBA into
   * Assumes that the output array already has alpha channel set to opaque.
   *)
*/
