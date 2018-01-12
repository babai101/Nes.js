function display(canvas) {
    this.ctx = canvas.getContext('2d');
    // this.oamCtx;
    // this.oamCanvasImageData;
    // this.oamData;
    // // this.nameTableCtx = nameTableCanvas.getContext('2d');
    // // this.nameTableCanvasImageData = this.nameTableCtx.getImageData(0, 0, nameTableCanvas.width, nameTableCanvas.height);
    // // this.nameTableData = this.nameTableCanvasImageData.data;
    this.canvasImageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.data = this.canvasImageData.data;
    
    //Update the data for the cavases
    this.updateBuffer = function(screenPixel, pixelColor) {
        this.data[screenPixel * 4] = 0xFF; //alpha
        this.data[screenPixel * 4] = (pixelColor >> 16) & 0xFF; //red
        this.data[screenPixel * 4 + 1] = (pixelColor >> 8) & 0xFF; //green
        this.data[screenPixel * 4 + 2] = pixelColor & 0xFF; //blue
    };

    // this.updateNameTableBuffer = function(screenPixel, pixelColor) {
    //     this.nameTableData[screenPixel * 4] = 0xFF; //alpha
    //     this.nameTableData[screenPixel * 4] = (pixelColor >> 16) & 0xFF; //red
    //     this.nameTableData[screenPixel * 4 + 1] = (pixelColor >> 8) & 0xFF; //green
    //     this.nameTableData[screenPixel * 4 + 2] = pixelColor & 0xFF; //blue
    // };
    
    // this.updateOamBuffer = function(screenPixel, pixelColor) {
    //     this.oamData[screenPixel * 4] = 0xFF; //alpha
    //     this.oamData[screenPixel * 4] = (pixelColor >> 16) & 0xFF; //red
    //     this.oamData[screenPixel * 4 + 1] = (pixelColor >> 8) & 0xFF; //green
    //     this.oamData[screenPixel * 4 + 2] = pixelColor & 0xFF; //blue
    // };

    
    //Update the cavases themselves
    this.updateCanvas = function() {
        this.ctx.putImageData(this.canvasImageData, 0, 0);
    };
    // this.updateNameTableCanvas = function() {
    //     this.nameTableCtx.putImageData(this.nameTableCanvasImageData, 0, 0);
    // };
    
    // this.updateOamCanvas = function() {
    //     this.oamCtx.putImageData(this.oamCanvasImageData, 0, 0);
    // };
    
    //Reset the cavases
    this.screenReset = function() {
        this.ctx.fillStyle = 'Black';
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    // this.nameTableScreenReset = function() {
    //     this.nameTableCtx.fillStyle = 'Black';
    //     this.nameTableCtx.fillRect(0, 0, 256, 240);
    // };
    
    // this.oamScreenReset = function() {
    //     this.oamCtx.fillStyle = 'black';
    //     this.oamCtx.fillRect(0, 0, 64, 64);
    // };
    
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
    // this.initNameTableScreenBuffer = function() {
    //     for (var i = 0; i < 256 * 240; i++) {
    //         var j = i * 4;
    //         this.nameTableData[j + 3] = 0xFF;
    //         this.nameTableData[j + 2] = 0x00;
    //         this.nameTableData[j + 1] = 0x00;
    //         this.nameTableData[j] = 0x00;
    //     }
    //     this.nameTableCtx.putImageData(this.nameTableCanvasImageData, 0, 0);
    // };
    // this.initOamScreenBuffer = function(oamCanvas) {
    //     this.oamCtx = oamCanvas.getContext('2d');
    //     this.oamCanvasImageData = this.oamCtx.getImageData(0, 0, oamCanvas.width, oamCanvas.height);
    //     this.oamData = this.oamCanvasImageData.data;
    //     for (var i = 0; i < 64 * 64; i++) {
    //         var j = i * 4;
    //         this.oamData[j + 3] = 0xFF;
    //         this.oamData[j + 2] = 0x00;
    //         this.oamData[j + 1] = 0x00;
    //         this.oamData[j] = 0x00;
    //     }
    //     this.oamCtx.putImageData(this.oamCanvasImageData, 0, 0);
    // };
}
