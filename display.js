function display(canvas, nameTableCanvas) {
    this.ctx = canvas.getContext('2d');
    this.nameTableCtx = nameTableCanvas.getContext('2d');
    this.nameTableCanvasImageData = this.nameTableCtx.getImageData(0, 0, nameTableCanvas.width, nameTableCanvas.height);
    this.nameTableData = this.nameTableCanvasImageData.data;
    this.canvasImageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.data = this.canvasImageData.data;
    this.updateBuffer = function(screenPixel, pixelColor) {
        this.data[screenPixel * 4] = 0xFF; //alpha
        this.data[screenPixel * 4] = (pixelColor >> 16) & 0xFF; //red
        this.data[screenPixel * 4 + 1] = (pixelColor >> 8) & 0xFF; //green
        this.data[screenPixel * 4 + 2] = pixelColor & 0xFF; //blue
    };
    
    this.updateNameTableBuffer = function(screenPixel, pixelColor) {
        this.nameTableData[screenPixel * 4] = 0xFF; //alpha
        this.nameTableData[screenPixel * 4] = (pixelColor >> 16) & 0xFF; //red
        this.nameTableData[screenPixel * 4 + 1] = (pixelColor >> 8) & 0xFF; //green
        this.nameTableData[screenPixel * 4 + 2] = pixelColor & 0xFF; //blue
    };

    this.updateCanvas = function() {
        this.ctx.putImageData(this.canvasImageData, 0, 0);
    };
    this.updateNameTableCanvas = function() {
        this.nameTableCtx.putImageData(this.nameTableCanvasImageData, 0, 0);   
    };
    this.screenReset = function() {
        this.ctx.fillStyle = 'Red';
        this.ctx.fillRect(0, 0, 256, 240);
    };
    this.nameTableScreenReset = function() {
        this.nameTableCtx.fillStyle = 'Black';
        this.nameTableCtx.fillRect(0, 0, 256, 240);
    };
    this.initScreenBuffer = function() {
        for (var i = 0; i < 256 * 240; i++) {
            var j = i * 4;
            this.data[j + 3] = 0xFF;
            this.data[j + 2] = 0x00;
            this.data[j + 1] = 0x00;
            this.data[j] = 0x00;
        }
        this.ctx.putImageData(this.canvasImageData, 0, 0);
    };
    this.initNameTableScreenBuffer = function() {
        for (var i = 0; i < 256 * 240; i++) {
            var j = i * 4;
            this.nameTableData[j + 3] = 0xFF;
            this.nameTableData[j + 2] = 0x00;
            this.nameTableData[j + 1] = 0x00;
            this.nameTableData[j] = 0x00;
        }
        this.nameTableCtx.putImageData(this.nameTableCanvasImageData, 0, 0);
    };
}
