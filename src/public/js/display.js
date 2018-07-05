'use strict';
export default function display(canvas) {
    this.ctx = canvas.getContext('2d');
    this.canvasImageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.data = this.canvasImageData.data;
    this.offscreenBuffer = [];
    this.buf = new ArrayBuffer(this.canvasImageData.data.length);
    this.buf8 = new Uint8ClampedArray(this.buf);
    this.bufData = new Uint32Array(this.buf);

    function createShader(gl, type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (success) {
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
        for (var i = 0; i < this.bufData.length; i++) {
            this.bufData[i] = 0xFF000000 | (this.offscreenBuffer[i][2] << 16) | (this.offscreenBuffer[i][1] << 8) | this.offscreenBuffer[i][0];
        }
        this.canvasImageData.data.set(this.buf8);
        this.ctx.putImageData(this.canvasImageData, 0, 0);
    };

    //Reset the cavases
    this.screenReset = function() {
        this.ctx.fillStyle = 'Black';
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    //Initilize the screen buffers for various canvases
    this.initScreenBuffer = function() {
        for (var i = 0; i < canvas.width * canvas.height; i++) {
            this.offscreenBuffer.push([0xFF, 0, 0, 0]);
        }
        for (var i = 0; i < canvas.width * canvas.height; i++) {
            var j = i * 4;
            this.data[j + 3] = 0xFF;
            this.data[j + 2] = 0x00;
            this.data[j + 1] = 0x00;
            this.data[j] = 0x00;
        }
        this.ctx.putImageData(this.canvasImageData, 0, 0);


        // //Web GL
        // var gl = canvas.getContext("webgl");
        // if (!gl) {
        //     console.log("No gl for you!");
        // }
        // else {
        //     console.log("We've got GL!");
        // }
        // var vertexShaderSource = "attribute vec4 a_position; attribute vec2 a_texCoord; varying vec2 v_texCoord; void main() { gl_Position = a_position; v_texCoord = a_texCoord; }";
        // var fragmentShaderSource = "precision mediump float; uniform vec4 u_color; uniform sampler2D u_image; varying vec2 v_texCoord; void main() { gl_FragColor = texture2D(u_image, v_texCoord); }";
        // var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        // var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        // var program = createProgram(gl, vertexShader, fragmentShader);

        // var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
        // var positionBuffer = gl.createBuffer();
        // gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // var positions = [-1, -1, -1, 1,
        //     1, -1, -1, 1,
        //     1, 1,
        //     1, -1
        // ];

        // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        // gl.viewport(0, 0, canvas.width, canvas.height);
        // gl.clearColor(0, 0, 0, 0);
        // gl.clear(gl.COLOR_BUFFER_BIT);
        // gl.useProgram(program);
        // gl.enableVertexAttribArray(positionAttributeLocation);

        // gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        // var size = 2;
        // var type = gl.FLOAT;
        // var normalize = false;
        // var stride = 0;
        // var offset = 0;
        // gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
        // var primitiveType = gl.TRIANGLES;
        // var count = 6;

        // var texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
        // var texCoordBuffer = gl.createBuffer();
        // gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);

        // var texPositions = [
        //     0.0, 0.0,
        //     0.0, 1.0,
        //     1.0, 0.0,
        //     0.0, 1.0,
        //     1.0, 1.0,
        //     1.0, 0.0
        // ];

        // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texPositions), gl.DYNAMIC_DRAW);
        // gl.enableVertexAttribArray(texCoordLocation);
        // gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // var texture = gl.createTexture();
        // gl.bindTexture(gl.TEXTURE_2D, texture);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // const level = 0;
        // const internalFormat = gl.RGBA;
        // const width = 1;
        // const height = 1;
        // const border = 0;
        // const format = gl.RGBA;
        // const imageType = gl.UNSIGNED_BYTE;
        // gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, format, imageType, new Uint8Array([0, 0, 0, 0]));
        // gl.drawArrays(primitiveType, offset, count);
    };
}
