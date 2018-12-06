'use strict';
export default function display(canvas, nes) {
    this.nes = nes;
    this.offscreenBuffer = [];
    var renderTarget = 0; //'1 for WebGL or 0 for Canvas'
    if (renderTarget == 0) {
        this.ctx = canvas.getContext('2d');
        this.canvasImageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.data = this.canvasImageData.data;
        this.buf = new ArrayBuffer(this.canvasImageData.data.length);
        this.buf8 = new Uint8ClampedArray(this.buf);
        this.bufData = new Uint32Array(this.buf);
    }

    //WebGL vars
    if (renderTarget == 1) {
        this.gl = canvas.getContext("webgl");
        if (!this.gl) {
            console.log("No gl for you!");
        }
        else {
            console.log("We've got GL!");
        }
        var level = 0;
        var internalFormat = this.gl.RGBA;
        var width = 256;
        var height = 240;
        var border = 0;
        var format = this.gl.RGBA;
        var imageType = this.gl.UNSIGNED_BYTE;
        var count = 6;
        var size = 2;
        var type = this.gl.FLOAT;
        var normalize = false;
        var stride = 0;
        var offset = 0;
    }


    function createShader(gl, type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (success) {
            console.log("Successfully compiled shader");
            return shader;
        }
        console.log(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }

    function createProgram(gl, vertexShader, fragmentShader) {
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        var success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (success) {
            console.log("Successfully created program");
            return program;
        }
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }

    //Update the data for the cavases
    this.updateBuffer = function(screenPixel, pixelColor) {
        this.offscreenBuffer[screenPixel] = pixelColor;
    };

    //Update the cavases themselves
    this.updateCanvas = function() {
        if (renderTarget == 0) {
            // for (var i = 0; i < this.bufData.length; i++) {
            //     this.bufData[i] = 0xFF000000 | (this.offscreenBuffer[i][2] << 16) | (this.offscreenBuffer[i][1] << 8) | this.offscreenBuffer[i][0];
            // }
            // var offScreenBuffer = this.nes.PPU.getOffScreenBuffer();
            for (var i = 0; i < this.bufData.length; i++) {
                // this.bufData[i] = this.offscreenBuffer[i];
                this.bufData[i] = this.nes.PPU.getOffScreenBuffer()[i];
            }
            this.canvasImageData.data.set(this.buf8);
            this.ctx.putImageData(this.canvasImageData, 0, 0);
        }
        else if (renderTarget == 1) {
            for (var i = 240 - 1, k = 0; i >= 0, k < 240; i--, k++) {
                for (var j = 0; j < 256; j++) {
                    var m = (i * 256 + j) * 4;
                    var n = k * 256 + j;
                    this.pixelBuffer[m] = this.offscreenBuffer[n][0];
                    this.pixelBuffer[m + 1] = this.offscreenBuffer[n][1];
                    this.pixelBuffer[m + 2] = this.offscreenBuffer[n][2];
                    this.pixelBuffer[m + 3] = 0xFF;
                }
            }
            this.gl.texSubImage2D(this.gl.TEXTURE_2D, level, 0, 0, width, height, format, imageType, this.pixelBuffer);
            var primitiveType = this.gl.TRIANGLES;
            this.gl.drawArrays(primitiveType, offset, count);
        }
    };

    //Reset the cavases
    this.screenReset = function() {
        if (renderTarget == 0) {
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    };

    //Initilize the screen buffers for various canvases
    this.initScreenBuffer = function() {
        for (var i = 0; i < canvas.width * canvas.height; i++) {
            // this.offscreenBuffer.push([0, 0, 0, 0xFF]);
            this.offscreenBuffer.push([0xFF000000]);
        }
        if (renderTarget == 0) {
            for (var i = 0; i < canvas.width * canvas.height; i++) {
                var j = i * 4;
                this.data[j + 3] = 0xFF;
                this.data[j + 2] = 0x00;
                this.data[j + 1] = 0x00;
                this.data[j] = 0x00;
            }
            this.ctx.putImageData(this.canvasImageData, 0, 0);
        }
        else if (renderTarget == 1) {
            this.pixelBuffer = new Uint8Array(256 * 240 * 4);
            var vertexShaderSource = "attribute vec4 a_position; attribute vec2 a_texCoord; varying vec2 v_texCoord; void main() { gl_Position = a_position; v_texCoord = a_texCoord; }";
            var fragmentShaderSource = "precision mediump float; uniform vec4 u_color; uniform sampler2D u_image; varying vec2 v_texCoord; void main() { gl_FragColor = texture2D(u_image, v_texCoord); }";
            var vertexShader = createShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource);
            var fragmentShader = createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShaderSource);
            var program = createProgram(this.gl, vertexShader, fragmentShader);

            var positionAttributeLocation = this.gl.getAttribLocation(program, "a_position");
            var positionBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);

            var positions = [-1, -1, -1, 1,
                1, -1, -1, 1,
                1, 1,
                1, -1
            ];

            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
            this.gl.viewport(0, 0, canvas.width, canvas.height);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.useProgram(program);
            this.gl.enableVertexAttribArray(positionAttributeLocation);

            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
            this.gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
            var primitiveType = this.gl.TRIANGLES;
            var texCoordLocation = this.gl.getAttribLocation(program, "a_texCoord");
            var texCoordBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);

            var texPositions = [
                0.0, 0.0,
                0.0, 1.0,
                1.0, 0.0,
                0.0, 1.0,
                1.0, 1.0,
                1.0, 0.0
            ];

            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texPositions), this.gl.DYNAMIC_DRAW);
            this.gl.enableVertexAttribArray(texCoordLocation);
            this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

            var texture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

            for (var i = 0; i < 256 * 240; i++) {
                var j = i * 4;
                this.pixelBuffer[j] = this.offscreenBuffer[i][0];
                this.pixelBuffer[j + 1] = this.offscreenBuffer[i][1];
                this.pixelBuffer[j + 2] = this.offscreenBuffer[i][2];
                this.pixelBuffer[j + 3] = 0xFF;
            }
            this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat, width, height, border, format, imageType, this.pixelBuffer);
            this.gl.drawArrays(primitiveType, offset, count);
        }
    };
}
