'use strict';
export default function display(canvas) {
    this.ctx = canvas.getContext('2d');
    this.canvasImageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.data = this.canvasImageData.data;

    //Update the data for the cavases
    this.updateBuffer = function(screenPixel, pixelColor) {
        this.data[screenPixel * 4] = 0xFF; //alpha
        this.data[screenPixel * 4] = (pixelColor >> 16) & 0xFF; //red
        this.data[screenPixel * 4 + 1] = (pixelColor >> 8) & 0xFF; //green
        this.data[screenPixel * 4 + 2] = pixelColor & 0xFF; //blue
    };

    //Update the cavases themselves
    this.updateCanvas = function() {
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
            var j = i * 4;
            this.data[j + 3] = 0xFF;
            this.data[j + 2] = 0x00;
            this.data[j + 1] = 0x00;
            this.data[j] = 0x00;
        }
        this.ctx.putImageData(this.canvasImageData, 0, 0);
    };
}
