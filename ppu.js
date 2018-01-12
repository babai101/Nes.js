function ppu(Display) {
    //Render VARS
    this.currentScanline = 0;
    this.nameTableMirroring = '';
    this.NMIOccured = false;
    this.CHRGrid = [];
    this.BGRCHRGrid = [];
    this.screenBuffer = [
        []
    ];
    this.palette = [];

    this.paletteColors = [0x7C7C7C,
        0x0000FC,
        0x0000BC,
        0x4428BC,
        0x940084,
        0xA80020,
        0xA81000,
        0x881400,
        0x503000,
        0x007800,
        0x006800,
        0x005800,
        0x004058,
        0x000000,
        0x000000,
        0x000000,
        0xBCBCBC,
        0x0078F8,
        0x0058F8,
        0x6844FC,
        0xD800CC,
        0xE40058,
        0xF83800,
        0xE45C10,
        0xAC7C00,
        0x00B800,
        0x00A800,
        0x00A844,
        0x008888,
        0x000000,
        0x000000,
        0x000000,
        0xF8F8F8,
        0x3CBCFC,
        0x6888FC,
        0x9878F8,
        0xF878F8,
        0xF85898,
        0xF87858,
        0xFCA044,
        0xF8B800,
        0xB8F818,
        0x58D854,
        0x58F898,
        0x00E8D8,
        0x787878,
        0x000000,
        0x000000,
        0xFCFCFC,
        0xA4E4FC,
        0xB8B8F8,
        0xD8B8F8,
        0xF8B8F8,
        0xF8A4C0,
        0xF0D0B0,
        0xFCE0A8,
        0xF8D878,
        0xD8F878,
        0xB8F8B8,
        0xB8F8D8,
        0x00FCFC,
        0xF8D8F8,
        0x000000,
        0x000000
    ];


    // this.cyclesToEmulate = 0;
    // this.curretRenderCycle = 0;
    //PPUCTRL vars
    this.baseNameTblAddr = 0x2000;
    this.vRamAddrInc = 'across';
    // this.spritePatTblAddr = this.CHRGrid;
    // this.backgroundPatTblAddr = this.BGRCHRGrid;
    this.spritePatTblAddr = 'left';
    this.backgroundPatTblAddr = 'right';
    this.spriteSize = '8x8';
    this.ppuMasterSlave = 'readBackdrop';
    this.enableNMIGen = false;

    //PPUMASK vars
    this.renderGreyscale = false;
    this.renderBGLeftMost = false;
    this.renderSpritesLeftMost = false;
    this.renderBackground = false;
    this.renderSprite = false;
    this.renderEmphRed = false;
    this.renderEmphGreen = false;
    this.renderEmphBlue = false;

    //PPUSTATUS vars
    this.ppuStatusBits = 0b00000000;
    this.spriteOverflow = false;
    //this.spriteHit = false;
    this.vBlankStarted = false;
    this.sprite0Hit = false;

    //PPUSCROLL vars
    this.xScroll = 0;
    this.yScroll = 0;

    this.OAM = [];

    //OAMADDR 
    this.OAMADDR = 0x00;

    //OAMDATA
    this.OAMDATA = 0x00;

    //OAMDMA
    this.OAMDMA = 0x00;

    this.PPUSCROLL;

    //PPUADDR
    this.PPUADDR;

    //PPUDATA 
    this.PPUDATA;
    this.spriteGrid = [];
    this.backGroundGrid = [];


    //Update PPUCTRL status
    this.setPPUCTRL = function(PPUCTRL) {
        var temp;
        temp = PPUCTRL & 0x03;
        this.baseNameTblAddr = temp;
        temp = (PPUCTRL >> 2) & 0x01;
        if (temp == 0)
            this.vRamAddrInc = 'across';
        else
            this.vRamAddrInc = 'down';
        temp = (PPUCTRL >> 3) & 0x01;
        if (temp == 0)
            this.spritePatTblAddr = 'left';
        else
            this.spritePatTblAddr = 'right';
        temp = (PPUCTRL >> 4) & 0x01;
        if (temp == 0)
            this.backgroundPatTblAddr = 'left';
        else
            this.backgroundPatTblAddr = 'right'; 
        temp = (PPUCTRL >> 5) & 0x01;
        if (temp == 0)
            this.spriteSize = '8x8';
        else
            this.spriteSize = '8x16';
        temp = (PPUCTRL >> 6) & 0x01;
        if (temp == 0)
            this.ppuMasterSlave = 'readBackdrop';
        else
            this.ppuMasterSlave = 'outputColor';
        temp = (PPUCTRL >> 7) & 0x01;
        if (temp == 0)
            this.enableNMIGen = false;
        else
            this.enableNMIGen = true;
    };

    //Update PPUMASK status
    this.setPPUMASK = function(PPUMASK) {
        var temp;
        temp = PPUMASK & 0x01;
        if (temp == 0)
            this.renderGreyscale = false;
        else
            this.renderGreyscale = true;
        temp = (PPUMASK >> 1) & 0x01;
        if (temp == 0)
            this.renderBGLeftMost = false;
        else
            this.renderBGLeftMost = true;
        temp = (PPUMASK >> 2) & 0x01;
        if (temp == 0)
            this.renderSpritesLeftMost = false;
        else
            this.renderSpritesLeftMost = true;
        temp = (PPUMASK >> 3) & 0x01;
        if (temp == 0)
            this.renderBackground = false;
        else
            this.renderBackground = true;
        temp = (PPUMASK >> 4) & 0x01;
        if (temp == 0)
            this.renderSprite = false;
        else
            this.renderSprite = true;
        temp = (PPUMASK >> 5) & 0x01;
        if (temp == 0)
            this.renderEmphRed = false;
        else
            this.renderEmphRed = true;
        temp = (PPUMASK >> 6) & 0x01;
        if (temp == 0)
            this.renderEmphGreen = false;
        else
            this.renderEmphGreen = true;
        temp = (PPUMASK >> 7) & 0x01;
        if (temp == 0)
            this.renderEmphBlue = false;
        else
            this.renderEmphBlue = true;
    };


    //Update OAMADDR
    this.setOAMADDR = function(OAMADDR) {
        this.OAMADDR = OAMADDR;
    };

    //Update OAMDATA
    // this.setOAMDATA = function(OAMDATA) {
    //     this.OAMDATA = OAMDATA;
    // };

    //Update PPUADDR
    this.setPPUADDR = function(PPUADDR) {
        this.PPUADDR = PPUADDR;
    };

    //Update PPU status resigster values into MMU object
    this.getPPUSTATUS = function() {
        var prevStatus = this.ppuStatusBits;
        if (this.NMIOccured) {
            prevStatus = prevStatus & 0x7F;
            prevStatus = prevStatus | 0x80;
        }
        //clear PPUSTATUS vblank indicators
        this.ppuStatusBits = this.ppuStatusBits & 0x7F;
        return prevStatus;
    };

    // this.getOAMDATA = function() {
    //     return this.OAMDATA;
    // };

    //Load PPU Palette values
    //TODO: mirror palette values
    this.setPalette = function(index, value) {
        this.palette[index] = value;
    };

    this.initScreenBuffer = function() {
        for (var x = 0; x < 256 * 240; x++) {
            this.screenBuffer.push(0x000000);
        }
        Display.initScreenBuffer();
        // Display.initNameTableScreenBuffer();
    };
    
    //Evaluate sprites & Draw to screen buffer
    //TODO: 8x16 tile rendering
    this.renderSprites = function(oam) {
        var spritesToDraw = [],
            tile, paletteNum, spriteX, spriteY, pixelColor, pixelColorIndex, spriteAttr, tileNum, tileRow;
        //Beginning of Sprite Evaluation
        //Check which sprites in OAM lie in current scanline
        for (var i = this.OAMADDR; i < 256; i += 4) {
            if ((oam[i] + 1) > (this.currentScanline - 8) && (oam[i] + 1) <= this.currentScanline) {
                //add to list of sprites to draw on current scanline
                spritesToDraw.push(i);
            }
        }
        //if more than 8 sprites lie in current scanline set sprite overflow to true
        if (spritesToDraw.length > 8) {
            this.spriteOverflow = true;
            this.ppuStatusBits = this.ppuStatusBits & 0xDF;
            this.ppuStatusBits = this.ppuStatusBits | 0x20;
        }
        else this.spriteOverflow = false;

        //Render the portion of the sprite that falls on the current scanline to offscreen buffer 
        for (i = spritesToDraw.length - 1; i >= 0; i--) { //Reversed looping to maintain sprite priority
            spriteX = oam[spritesToDraw[i] + 3];
            spriteY = oam[spritesToDraw[i]] + 1;
            tileNum = oam[spritesToDraw[i] + 1];
            spriteAttr = oam[spritesToDraw[i] + 2];
            //Select tile num from OAM byte 1 and index from CHRGrid already prepared
            if(this.spritePatTblAddr == 'left') {
                tile = this.CHRGrid[tileNum];
            }
            else if (this.spritePatTblAddr == 'right') {
                tile = this.BGRCHRGrid[tileNum];
            }
            // tile = this.spritePatTblAddr[tileNum];
            tileRow = tile[this.currentScanline - spriteY];
            //Select the palette number from OAM for the tile
            paletteNum = spriteAttr & 0b00000011;

            //Check for flipping of sprite
            if (((spriteAttr & 0b01000000) == 0b01000000) && ((spriteAttr & 0b10000000) == 0b10000000)) {
                var tempRow = [];
                var tempRow2 = [];
                for (var x = 0; x < 8; x++) {
                    tempRow.push(tile[Math.abs((this.currentScanline - spriteY) - 7)][x]);
                }
                for (var x = 7; x >= 0; x--) {
                    tempRow2.push(tempRow[x]);
                }
                tileRow = tempRow2;
            }
            else if ((spriteAttr & 0b01000000) == 0b01000000) { //horizontally flip sprite
                var tempRow = [];
                for (var x = 7; x >= 0; x--) {
                    tempRow.push(tileRow[x]);
                }
                tileRow = tempRow;
            }
            else if ((spriteAttr & 0b10000000) == 0b10000000) { //vertically flip sprite
                var tempRow = [];
                for (var x = 0; x < 8; x++) {
                    tempRow.push(tile[Math.abs((this.currentScanline - spriteY) - 7)][x]);
                }
                tileRow = tempRow;
            }

            //Draw pixels of the tile that lie on current scanline 
            for (var x = 0; x < 8; x++) {
                //X coordinate is fetched from OAM, Y is calculated current scanline - OAM Y coordinate + 1
                //Color palette is shifted by 16 to ignore the background palettes 
                //palette number multiplied by 4 to offset the actual tile palette colors 
                //The actual tile data is added to get the pixel color, tile(x, y) contails value 0-3 
                //x is the loop counter, y remains constant as offset from tile Y and current scanline

                pixelColorIndex = tileRow[x];

                //for transparent sprite bit show background so don't draw sprite to buffer
                if (pixelColorIndex != 0) {
                    var currentBackgroundPixelColor = this.screenBuffer[spriteX + x + (this.currentScanline * 256)];

                    //non-transparent sprite over transparent background
                    // if (currentBackgroundPixelColor == this.paletteColors[this.palette[0]]) {
                    if (currentBackgroundPixelColor == 0) {    
                        pixelColor = this.paletteColors[this.palette[16 + paletteNum * 4 + pixelColorIndex]];
                        // this.screenBuffer[spriteX + x + (this.currentScanline * 256)] = pixelColor;
                        this.screenBuffer[spriteX + x + (this.currentScanline * 256)] = pixelColorIndex;
                        Display.updateBuffer(spriteX + x + (this.currentScanline * 256), pixelColor);
                    }

                    //Sprite hit logic: non-transparent Sprite over non-transparent BG REGARDLESS of priority
                    // else if (currentBackgroundPixelColor != this.paletteColors[this.palette[0]]) {
                    else if (currentBackgroundPixelColor != 0) {    

                        //If current sprite is sprite 0 and sprite hit not already set in PPUSTATUS
                        // if ((i == 0) && ((this.ppuStatusBits & 0x40) == 0x00) && this.renderBackground) {
                        if ((spritesToDraw[i] == this.OAMADDR) && ((this.ppuStatusBits & 0x40) == 0x00) && this.renderBackground) {
                            //set sprite 0 hit bit TODO: Other sprite hit conditions
                            this.ppuStatusBits = this.ppuStatusBits | 0x40;
                            this.sprite0Hit = true;
                        }

                        //non-transparent sprite having foreground priority over non-transparent background
                        // if (currentBackgroundPixelColor != this.paletteColors[this.palette[0]] && ((spriteAttr & 0b00100000) == 0)) {
                        if ((currentBackgroundPixelColor != 0) && ((spriteAttr & 0b00100000) == 0)) {    
                            pixelColor = this.paletteColors[this.palette[16 + paletteNum * 4 + pixelColorIndex]];
                            this.screenBuffer[spriteX + x + (this.currentScanline * 256)] = pixelColorIndex;
                            // this.screenBuffer[spriteX + x + (this.currentScanline * 256)] = pixelColor;
                            Display.updateBuffer(spriteX + x + (this.currentScanline * 256), pixelColor);
                        }
                    }
                }
            }
        }
    };

    this.renderBackGroundsScroll = function(nametable, attrtable) {
        var paletteNum = 0;
        var pixelColor = 0; //this will hold the final pixel with color calculated 
        var pixelColorArray = []; //array to hold one scanline worth of color pixels
        var pixelColorIndexArray = [];
        // var pixelColorIndex = 0;
        var screenPixel = 0; //this is the pixel index of 32x30 screen 
        var nametableOffset = 0x2000 + this.baseNameTblAddr * 1024;
        var tileXOffset = 0;
        var pixelXOffset = 0;
        var tileToDraw = 0;
        var nameTableCrossed = false;
        var bgRenderingDone = false;
        var attrByte = 0;
        var curTileX = 0;
        var curTileY = Math.floor(this.currentScanline / 8);
        var tileCounter = 0;
        var tilesThisScanline = 32;


        //Tile Draw logic: get the tile to start draw from. Check for horizontal offset
        //offset the tiles using horizontal offset, then calculate pixel offset
        //Also calculate how many tiles of next nametable need to be drawn
        //then calculate upto which pixel drawing is needed

        tileXOffset = Math.floor(this.xScroll / 8); //offset tile (see above)
        pixelXOffset = this.xScroll % 8; //offset pixel
        curTileX = tileXOffset; //start rendering from the offsetted tile

        //when there is fine pixel offset, we have to fetch and draw pixels from an extra tile
        if (pixelXOffset > 0) {
            tilesThisScanline = 33;
        }
        //loop to draw all the tiles on the screen for current scanline
        while (!bgRenderingDone) {
            if (curTileX >= 32) { //check if current tile lies on next nametable
                nameTableCrossed = true;
            }
            else {
                nameTableCrossed = false;
            }

            if (nameTableCrossed) {
                //fetch the tile from the next nametable by adding 1KB of memory offset to nametable base address
                //normalizing tile X co-ordinate by subtracting 32 to get tile x in next nametable
                tileToDraw = nametable[nametableOffset + 1024 + ((curTileX - 32) + curTileY * 32)];
            }
            else {
                //offsetted tile falls in current nametable so do a regular fetch
                tileToDraw = nametable[nametableOffset + curTileX + curTileY * 32];
            }

            //get the tile bits from pre-calculated grid
            if(this.backgroundPatTblAddr == 'left') {
                tileToDraw = this.CHRGrid[tileToDraw];
            }
            else if (this.backgroundPatTblAddr == 'right') {
                tileToDraw = this.BGRCHRGrid[tileToDraw];
            }
            // tileToDraw = this.backgroundPatTblAddr[tileToDraw];

            //Determine color palette
            //Get the current byte entries in 8x8 (32x32 pixel) attribute byte array
            var curAttrX;
            var curAttrY;
            if (nameTableCrossed) {
                curAttrX = Math.floor((curTileX - 32) / 4);
            }
            else {
                curAttrX = Math.floor(curTileX / 4);
            }
            curAttrY = Math.floor(curTileY / 4);

            if (nameTableCrossed) {
                attrByte = attrtable[(0x23C0 + (this.baseNameTblAddr + 1) * 1024) + curAttrX + curAttrY * 8];
            }
            else {
                attrByte = attrtable[(0x23C0 + this.baseNameTblAddr * 1024) + curAttrX + curAttrY * 8];
            }
            //Top left of 2x2 tile
            if (((curTileX % 4 == 0) || (curTileX % 4 == 1)) && ((curTileY % 4 == 0) || (curTileY % 4 == 1))) {
                // paletteNum = attrByte >> 6;
                paletteNum = attrByte & 0x03;
            }
            //Top right
            else if (((curTileX % 4 != 0) && (curTileX % 4 != 1)) && ((curTileY % 4 == 0) || (curTileY % 4 == 1))) {
                // paletteNum = (attrByte >> 4) & 0x03;
                paletteNum = (attrByte >> 2) & 0x03;
            }
            //Bottom left
            else if (((curTileX % 4 == 0) || (curTileX % 4 == 1)) && ((curTileY % 4 != 0) && (curTileY % 4 != 1))) {
                // paletteNum = (attrByte >> 2) & 0x03;
                paletteNum = (attrByte >> 4) & 0x03;
            }
            //Bottom right
            else if (((curTileX % 4 != 0) && (curTileX % 4 != 1)) && ((curTileY % 4 != 0) && (curTileY % 4 != 1))) {
                // paletteNum = attrByte & 0x03;
                paletteNum = attrByte >> 6;
            }
            else {
                alert("palette not found!!");
            }

            //We have now determined the background tile(accross nametables) to be rendered
            //also calculated the color palette using proper attributes
            //Now start the actual rendering process

            var curY = (this.currentScanline % 8); //get the y co-ordinate of an 8x8 tile from where to start rendering
            var curX = 0;
            var pixelXlimit = 8;
            if (tileCounter == 0) { //now drawing the left most tile so check for pixel offset
                if (pixelXOffset > 0) { //we have offset so start rendering by offseting the tile bits by that amount
                    curX = pixelXOffset;
                }
            }
            if (tileCounter == tilesThisScanline - 1) { //now drawing the final tile, so only draw until the offset is normalized
                if (pixelXOffset > 0) { //we have offset so start rendering by offseting the tile bits by that amount
                    pixelXlimit = pixelXOffset;
                }
            }

            //Loop through the pixels for the current tile and store in an array
            for (curX; curX < pixelXlimit; curX++) {
                if (tileToDraw[curY][curX] == 0) { //backdrop color
                    pixelColor = this.paletteColors[this.palette[0]];
                    pixelColorIndexArray.push(tileToDraw[curY][curX]);
                    pixelColorArray.push(pixelColor);
                }
                else {
                    pixelColor = this.paletteColors[this.palette[paletteNum * 4 + tileToDraw[curY][curX]]];
                    pixelColorIndexArray.push(tileToDraw[curY][curX]);
                    pixelColorArray.push(pixelColor);
                }
            }

            tileCounter++;
            curTileX++;
            if (tileCounter >= tilesThisScanline) {
                bgRenderingDone = true;
            }
        }

        //Now that we have the color pixel array, update them in the screen buffer
        //Start from left most pixel (x = 0) from current scanline
        screenPixel = 0 + (curTileY * 8 + (this.currentScanline % 8)) * 256;

        //start merging our color pixel array into screen buffer from now on
        for (var x = screenPixel; x < (screenPixel + pixelColorArray.length); x++) {
            this.screenBuffer[x] = pixelColorIndexArray[x - screenPixel];
            Display.updateBuffer(x, pixelColorArray[x - screenPixel]);
        }
    };

    // this.renderBackGroundsXYScroll = function(nametable, attrtable) {
    //     var paletteNum = 0;
    //     var pixelColor = 0; //this will hold the final pixel with color calculated 
    //     var pixelColorArray = []; //array to hold one scanline worth of color pixels
    //     var screenPixel = 0; //this is the pixel index of 32x30 screen 
    //     var nametableOffset = 0x2000 + this.baseNameTblAddr * 1024;
    //     var tileXOffset = 0,
    //         tileYOffset = 0;
    //     var pixelXOffset = 0,
    //         pixelYOffset = 0;
    //     var tileToDraw = 0;
    //     var nameTableCrossed = false;
    //     var bgRenderingDone = false;
    //     var attrByte = 0;
    //     var curTileX = 0;
    //     var curTileY = Math.floor(this.currentScanline / 8);
    //     var tileCounter = 0;
    //     var tilesThisScanline = 32;
    //     var curTileYOffsetted = 0;

    //     //Tile Draw logic: get the tile to start draw from. Check for horizontal offset
    //     //offset the tiles using horizontal offset, then calculate pixel offset
    //     //Also calculate how many tiles of next nametable need to be drawn
    //     //then calculate upto which pixel drawing is needed

    //     tileXOffset = Math.floor(this.xScroll / 8); //offset tile (see above)
    //     tileYOffset = Math.floor(this.yScroll / 8); //offset tile (see above)
    //     pixelXOffset = this.xScroll % 8; //offset pixel
    //     pixelYOffset = this.yScroll % 8; //offset pixel
    //     curTileX = tileXOffset; //start rendering from the offsetted tile
    //     curTileYOffsetted = tileYOffset + curTileY;
    //     //when there is fine pixel offset, we have to fetch and draw pixels from an extra tile
    //     if (pixelXOffset > 0) {
    //         tilesThisScanline = 33;
    //     }
    //     //loop to draw all the tiles on the screen for current scanline
    //     while (!bgRenderingDone) {

    //         if (this.nameTableMirroring == 'vertical') {
    //             var curAttrX;
    //             var curAttrY;
    //             //Get the current byte entries in 8x8 (32x32 pixel) attribute byte array
    //             curAttrY = Math.floor(curTileY / 4);

    //             if (curTileX >= 32) { //check if current tile lies on next nametable
    //                 nameTableCrossed = true;
    //                 //fetch the tile from the next nametable by adding 1KB of memory offset to nametable base address
    //                 //normalizing tile X co-ordinate by subtracting 32 to get tile x in next nametable
    //                 tileToDraw = nametable[nametableOffset + 1024 + ((curTileX - 32) + curTileY * 32)];
    //                 curAttrX = Math.floor((curTileX - 32) / 4);
    //                 attrByte = attrtable[(0x23C0 + (this.baseNameTblAddr + 1) * 1024) + curAttrX + curAttrY * 8];
    //             }
    //             else {
    //                 nameTableCrossed = false;
    //                 //offsetted tile falls in current nametable so do a regular fetch
    //                 tileToDraw = nametable[nametableOffset + curTileX + curTileY * 32];
    //                 curAttrX = Math.floor(curTileX / 4);
    //                 attrByte = attrtable[(0x23C0 + this.baseNameTblAddr * 1024) + curAttrX + curAttrY * 8];
    //             }

    //             //get the tile bits from pre-calculated grid
    //             tileToDraw = this.backgroundPatTblAddr[tileToDraw];

    //             //Determine color palette
    //             //Top left of 2x2 tile
    //             if (((curTileX % 4 == 0) || (curTileX % 4 == 1)) && ((curTileY % 4 == 0) || (curTileY % 4 == 1))) {
    //                 // paletteNum = attrByte >> 6;
    //                 paletteNum = attrByte & 0x03;
    //             }
    //             //Top right
    //             else if (((curTileX % 4 != 0) && (curTileX % 4 != 1)) && ((curTileY % 4 == 0) || (curTileY % 4 == 1))) {
    //                 // paletteNum = (attrByte >> 4) & 0x03;
    //                 paletteNum = (attrByte >> 2) & 0x03;
    //             }
    //             //Bottom left
    //             else if (((curTileX % 4 == 0) || (curTileX % 4 == 1)) && ((curTileY % 4 != 0) && (curTileY % 4 != 1))) {
    //                 // paletteNum = (attrByte >> 2) & 0x03;
    //                 paletteNum = (attrByte >> 4) & 0x03;
    //             }
    //             //Bottom right
    //             else if (((curTileX % 4 != 0) && (curTileX % 4 != 1)) && ((curTileY % 4 != 0) && (curTileY % 4 != 1))) {
    //                 // paletteNum = attrByte & 0x03;
    //                 paletteNum = attrByte >> 6;
    //             }
    //             else {
    //                 alert("palette not found!!");
    //             }

    //             //We have now determined the background tile(accross nametables) to be rendered
    //             //also calculated the color palette using proper attributes
    //             //Now start the actual rendering process

    //             var curY = (this.currentScanline % 8); //get the y co-ordinate of an 8x8 tile from where to start rendering
    //             var curX = 0;
    //             var pixelXlimit = 8;
    //             if (tileCounter == 0) { //now drawing the left most tile so check for pixel offset
    //                 if (pixelXOffset > 0) { //we have offset so start rendering by offseting the tile bits by that amount
    //                     curX = pixelXOffset;
    //                 }
    //             }
    //             if (tileCounter == tilesThisScanline - 1) { //now drawing the final tile, so only draw until the offset is normalized
    //                 if (pixelXOffset > 0) { //we have offset so start rendering by offseting the tile bits by that amount
    //                     pixelXlimit = pixelXOffset;
    //                 }
    //             }

    //             //Loop through the pixels for the current tile and store in an array
    //             for (curX; curX < pixelXlimit; curX++) {
    //                 if (tileToDraw[curY][curX] == 0) { //backdrop color
    //                     pixelColor = this.paletteColors[this.palette[0]];
    //                     pixelColorArray.push(pixelColor);
    //                 }
    //                 else {
    //                     pixelColor = this.paletteColors[this.palette[paletteNum * 4 + tileToDraw[curY][curX]]];
    //                     pixelColorArray.push(pixelColor);
    //                 }
    //             }

    //             tileCounter++;
    //             curTileX++;
    //             if (tileCounter >= tilesThisScanline) {
    //                 bgRenderingDone = true;
    //             }

    //         }
    //         else if (this.nameTableMirroring == 'horizontal') {
    //             var curAttrX;
    //             var curAttrY;
    //             //Get the current byte entries in 8x8 (32x32 pixel) attribute byte array
    //             curAttrX = Math.floor(curTileX / 4);

    //             if (curTileYOffsetted >= 30) { //check if current tile lies on next nametable
    //                 nameTableCrossed = true;
    //                 //fetch the tile from the next nametable by adding 1KB of memory offset to nametable base address
    //                 //normalizing tile X co-ordinate by subtracting 32 to get tile x in next nametable
    //                 tileToDraw = nametable[nametableOffset + 2048 + (curTileX + (curTileYOffsetted - 30) * 32)];
    //                 curAttrY = Math.floor((curTileYOffsetted - 30) / 4);
    //                 attrByte = attrtable[(0x23C0 + (this.baseNameTblAddr + 2) * 1024) + curAttrX + curAttrY * 8];
    //             }
    //             else {
    //                 nameTableCrossed = false;
    //                 //offsetted tile falls in current nametable so do a regular fetch
    //                 tileToDraw = nametable[nametableOffset + curTileX + curTileY * 32];
    //                 curAttrY = Math.floor(curTileYOffsetted / 4);
    //                 attrByte = attrtable[(0x23C0 + this.baseNameTblAddr * 1024) + curAttrX + curAttrY * 8];
    //             }

    //             //get the tile bits from pre-calculated grid
    //             tileToDraw = this.backgroundPatTblAddr[tileToDraw];

    //             //Determine color palette
    //             //Top left of 2x2 tile
    //             if (((curTileX % 4 == 0) || (curTileX % 4 == 1)) && ((curTileYOffsetted % 4 == 0) || (curTileYOffsetted % 4 == 1))) {
    //                 // paletteNum = attrByte >> 6;
    //                 paletteNum = attrByte & 0x03;
    //             }
    //             //Top right
    //             else if (((curTileX % 4 != 0) && (curTileX % 4 != 1)) && ((curTileYOffsetted % 4 == 0) || (curTileYOffsetted % 4 == 1))) {
    //                 // paletteNum = (attrByte >> 4) & 0x03;
    //                 paletteNum = (attrByte >> 2) & 0x03;
    //             }
    //             //Bottom left
    //             else if (((curTileX % 4 == 0) || (curTileX % 4 == 1)) && ((curTileY % 4 != 0) && (curTileY % 4 != 1))) {
    //                 // paletteNum = (attrByte >> 2) & 0x03;
    //                 paletteNum = (attrByte >> 4) & 0x03;
    //             }
    //             //Bottom right
    //             else if (((curTileX % 4 != 0) && (curTileX % 4 != 1)) && ((curTileY % 4 != 0) && (curTileY % 4 != 1))) {
    //                 // paletteNum = attrByte & 0x03;
    //                 paletteNum = attrByte >> 6;
    //             }
    //             else {
    //                 alert("palette not found!!");
    //             }

    //             //We have now determined the background tile(accross nametables) to be rendered
    //             //also calculated the color palette using proper attributes
    //             //Now start the actual rendering process

    //             var curY = (this.currentScanline % 8); //get the y co-ordinate of an 8x8 tile from where to start rendering
    //             var curX = 0;
    //             var pixelXlimit = 8;
    //             if (tileCounter == 0) { //now drawing the left most tile so check for pixel offset
    //                 if (pixelXOffset > 0) { //we have offset so start rendering by offseting the tile bits by that amount
    //                     curX = pixelXOffset;
    //                 }
    //             }
    //             if (tileCounter == tilesThisScanline - 1) { //now drawing the final tile, so only draw until the offset is normalized
    //                 if (pixelXOffset > 0) { //we have offset so start rendering by offseting the tile bits by that amount
    //                     pixelXlimit = pixelXOffset;
    //                 }
    //             }

    //             //Loop through the pixels for the current tile and store in an array
    //             for (curX; curX < pixelXlimit; curX++) {
    //                 if (tileToDraw[curY][curX] == 0) { //backdrop color
    //                     pixelColor = this.paletteColors[this.palette[0]];
    //                     pixelColorArray.push(pixelColor);
    //                 }
    //                 else {
    //                     pixelColor = this.paletteColors[this.palette[paletteNum * 4 + tileToDraw[curY][curX]]];
    //                     pixelColorArray.push(pixelColor);
    //                 }
    //             }

    //             tileCounter++;
    //             curTileX++;
    //             if (tileCounter >= tilesThisScanline) {
    //                 bgRenderingDone = true;
    //             }
    //         }
    //     }

    //     //Now that we have the color pixel array, update them in the screen buffer
    //     //Start from left most pixel (x = 0) from current scanline
    //     screenPixel = 0 + (curTileY * 8 + (this.currentScanline % 8)) * 256;

    //     //start merging our color pixel array into screen buffer from now on
    //     for (var x = screenPixel; x < (screenPixel + pixelColorArray.length); x++) {
    //         this.screenBuffer[x] = pixelColorArray[x - screenPixel];
    //         Display.updateBuffer(x, pixelColorArray[x - screenPixel]);
    //     }
    // };

    // this.renderBackGrounds = function(nametable, attrtable) {
    //     var paletteNum = 0;
    //     var pixelColor = 0;
    //     var screenPixel = 0;
    //     var nametableOffset = 0x2000 + this.baseNameTblAddr * 1024;
    //     var tileXOffset = 0;
    //     var tileYOffset = 0;
    //     //Fetch the background CHR tile lying on the current scanline
    //     var curTileX;
    //     var curTileY = Math.floor(this.currentScanline / 8);
    //     for (curTileX = 0; curTileX < 32; curTileX++) {
    //         tileXOffset = nametableOffset + curTileX;
    //         tileYOffset = curTileY;
    //         var tileToDraw = nametable[tileXOffset + tileYOffset * 32];
    //         tileToDraw = this.backgroundPatTblAddr[tileToDraw];

    //         //Get the current byte entries in 8x8 (32x32 pixel) attribute byte array            
    //         var curAttrX = Math.floor(curTileX / 4);
    //         var curAttrY = Math.floor(curTileY / 4);
    //         var attrByte = attrtable[(0x23C0 + this.baseNameTblAddr * 1024) + curAttrX + curAttrY * 8];

    //         //Top left of 2x2 tile
    //         if (((curTileX % 4 == 0) || (curTileX % 4 == 1)) && ((curTileY % 4 == 0) || (curTileY % 4 == 1))) {
    //             // paletteNum = attrByte >> 6;
    //             paletteNum = attrByte & 0x03;
    //         }
    //         //Top right
    //         else if (((curTileX % 4 != 0) && (curTileX % 4 != 1)) && ((curTileY % 4 == 0) || (curTileY % 4 == 1))) {
    //             // paletteNum = (attrByte >> 4) & 0x03;
    //             paletteNum = (attrByte >> 2) & 0x03;
    //         }
    //         //Bottom left
    //         else if (((curTileX % 4 == 0) || (curTileX % 4 == 1)) && ((curTileY % 4 != 0) && (curTileY % 4 != 1))) {
    //             // paletteNum = (attrByte >> 2) & 0x03;
    //             paletteNum = (attrByte >> 4) & 0x03;
    //         }
    //         //Bottom right
    //         else if (((curTileX % 4 != 0) && (curTileX % 4 != 1)) && ((curTileY % 4 != 0) && (curTileY % 4 != 1))) {
    //             // paletteNum = attrByte & 0x03;
    //             paletteNum = attrByte >> 6;
    //         }
    //         else {
    //             alert("palette not found!!");
    //         }

    //         //Loop through the 8 pixels for the current tile
    //         var curY = (this.currentScanline % 8);
    //         for (var curX = 0; curX < 8; curX++) {
    //             //Pallete logic broken down
    //             if (tileToDraw[curY][curX] == 0) { //backdrop color
    //                 pixelColor = this.paletteColors[this.palette[0]];
    //                 screenPixel = ((curTileX * 8) + curX) + ((curTileY * 8) + curY) * 256;
    //                 this.screenBuffer[screenPixel] = pixelColor;
    //                 Display.updateBuffer(screenPixel, pixelColor);
    //             }
    //             else {
    //                 pixelColor = this.paletteColors[this.palette[paletteNum * 4 + tileToDraw[curY][curX]]];
    //                 screenPixel = ((curTileX * 8) + curX) + ((curTileY * 8) + curY) * 256;
    //                 this.screenBuffer[screenPixel] = pixelColor;
    //                 Display.updateBuffer(screenPixel, pixelColor);
    //             }
    //         }
    //     }
    // };

    this.RenderNextScanline = function(oam, nametable, attrtable) {
        //Pre render Scanline
        if (this.currentScanline == 261) {
            //clear PPUSTATUS vblank indicator
            this.ppuStatusBits = this.ppuStatusBits & 0x7F;
            //clear sprite hit
            this.ppuStatusBits = this.ppuStatusBits & 0xBF;
            this.sprite0Hit = false;
            //clear sprite overflow
            this.ppuStatusBits = this.ppuStatusBits & 0xDF;
            this.spriteOverflow = false;
            this.NMIOccured = false;

            this.currentScanline = 0;
            this.vBlankStarted = false;

            return 261;
        }
        //Visible Scanlines
        else if (this.currentScanline >= 0 && this.currentScanline < 240) {
            if (this.currentScanline == 0) {
                // this.screenBuffer = [
                //     []
                // ];
            }
            if (this.renderBackground)
                this.renderBackGroundsScroll(nametable, attrtable);
            // this.renderBackGrounds(nametable, attrtable);
            if (this.renderSprite)
                this.renderSprites(oam);
        }
        //Post render Scanline
        else if (this.currentScanline == 240) {

        }
        //Vertical blanking lines
        else if (this.currentScanline > 240 && this.currentScanline <= 260) {
            if (this.currentScanline == 241) {
                //Set vBlank
                this.ppuStatusBits = this.ppuStatusBits & 0x7F;
                this.ppuStatusBits = this.ppuStatusBits | 0x80;

                this.vBlankStarted = true;
                this.NMIOccured = true;
            }
        }
        this.currentScanline++;
        return this.currentScanline - 1;
    };
}
