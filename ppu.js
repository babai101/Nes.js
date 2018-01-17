function ppu(nes) {
    this.nes = nes;
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
    this.spriteSize = 8;
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
            this.spriteSize = 8;
        else
            this.spriteSize = 16;
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
        this.nes.mainDisplay.initScreenBuffer();
        // this.nes.mainDisplay.initNameTableScreenBuffer();
    };

    this.calcPaletteFromAttr = function(X, Y, attrByte) {
        var paletteNum = 0;
        // Top left of 2x2 tile
        if (((X % 4 == 0) || (X % 4 == 1)) && ((Y % 4 == 0) || (Y % 4 == 1))) {
            // paletteNum = attrByte >> 6;
            paletteNum = attrByte & 0x03;
        }
        //Top right
        else if (((X % 4 != 0) && (X % 4 != 1)) && ((Y % 4 == 0) || (Y % 4 == 1))) {
            // paletteNum = (attrByte >> 4) & 0x03;
            paletteNum = (attrByte >> 2) & 0x03;
        }
        //Bottom left
        else if (((X % 4 == 0) || (X % 4 == 1)) && ((Y % 4 != 0) && (Y % 4 != 1))) {
            // paletteNum = (attrByte >> 2) & 0x03;
            paletteNum = (attrByte >> 4) & 0x03;
        }
        //Bottom right
        else if (((X % 4 != 0) && (X % 4 != 1)) && ((Y % 4 != 0) && (Y % 4 != 1))) {
            // paletteNum = attrByte & 0x03;
            paletteNum = attrByte >> 6;
        }
        else {
            alert("palette not found!!");
        }
        return paletteNum;
    };
    //Evaluate sprites & Draw to screen buffer
    //TODO: 8x16 tile rendering
    this.renderSprites = function(oam) {
        var spritesToDraw = [],
            tile, paletteNum, spriteX, spriteY, pixelColor, pixelColorIndex, spriteAttr, tileNum, tileRow;
        if (this.spriteSize == 8) {
            //Beginning of Sprite Evaluation
            //Check which sprites in OAM lie in current scanline
            for (var i = this.OAMADDR; i < 256; i += 4) {
                if ((oam[i] + 1) > (this.currentScanline - 8) && (oam[i] + 1) <= this.currentScanline) {
                    // if ((oam[i] + 1) > (this.currentScanline - this.spriteSize) && (oam[i] + 1) <= this.currentScanline) {
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
                tile = this.nes.Mapper.getCHRGrid(this.spritePatTblAddr, tileNum);

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
                        // tempRow.push(tile[Math.abs((this.currentScanline - spriteY) - this.spriteSize - 1)][x]);
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
                        // tempRow.push(tile[Math.abs((this.currentScanline - spriteY) - this.spriteSize - 1)][x]);
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
                            this.nes.mainDisplay.updateBuffer(spriteX + x + (this.currentScanline * 256), pixelColor);
                        }

                        else if (currentBackgroundPixelColor != 0) {
                            //non-transparent sprite having foreground priority over non-transparent background
                            // if (currentBackgroundPixelColor != this.paletteColors[this.palette[0]] && ((spriteAttr & 0b00100000) == 0)) {
                            if ((currentBackgroundPixelColor != 0) && ((spriteAttr & 0b00100000) == 0)) {
                                pixelColor = this.paletteColors[this.palette[16 + paletteNum * 4 + pixelColorIndex]];
                                this.screenBuffer[spriteX + x + (this.currentScanline * 256)] = pixelColorIndex;
                                // this.screenBuffer[spriteX + x + (this.currentScanline * 256)] = pixelColor;
                                this.nes.mainDisplay.updateBuffer(spriteX + x + (this.currentScanline * 256), pixelColor);
                            }
                        }
                    }
                }
            }
        }
        else if (this.spriteSize == 16) {
            var drawingTopTile = true,
                tileUp, tileDown, tileRowIndex = 0;
            //Check which sprites in OAM lie in current scanline
            for (var i = this.OAMADDR; i < 256; i += 4) {
                if ((oam[i] + 1) > (this.currentScanline - 16) && (oam[i] + 1) <= this.currentScanline) {
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
                tileRowIndex = this.currentScanline - spriteY;
                if (tileRowIndex > 7) { //we are now at bottom portion of 8x16 tile
                    drawingTopTile = false;
                    tileRowIndex = tileRowIndex - 8;
                }
                else {
                    drawingTopTile = true;
                }
                tileNum = oam[spritesToDraw[i] + 1];
                spriteAttr = oam[spritesToDraw[i] + 2];
                //Select tile num from OAM byte 1 and index from CHRGrid already prepared
                if ((tileNum & 0x01) == 0) {
                    //for bottom of 8x16 tile, select the next tile from pattern table
                    tileNum = (tileNum & 0xFE);
                    // tileUp = this.CHRGrid[tileNum];
                    tileUp = this.nes.Mapper.getCHRGrid('left', tileNum);
                    tileDown = this.nes.Mapper.getCHRGrid('left', tileNum + 1);
                }
                else if ((tileNum & 0x01) == 1) {
                    tileNum = (tileNum & 0xFE);
                    tileUp = this.nes.Mapper.getCHRGrid('right', tileNum);
                    tileDown = this.nes.Mapper.getCHRGrid('right', tileNum + 1);
                }
                // tileRowIndex = tileRowIndex % 8; //we got the specifig tile in tile var already so normalizing
                if (drawingTopTile) {
                    tileRow = tileUp[tileRowIndex];
                }
                else {
                    tileRow = tileDown[tileRowIndex];
                }

                //Select the palette number from OAM for the tile
                paletteNum = spriteAttr & 0b00000011;

                //Check for flipping of sprite
                if (((spriteAttr & 0b01000000) == 0b01000000) && ((spriteAttr & 0b10000000) == 0b10000000)) {
                    var tempRow = [];
                    var tempRow2 = [];
                    if (drawingTopTile) {
                        tile = tileDown;
                    }
                    else {
                        tile = tileUp;
                    }
                    for (var x = 0; x < 8; x++) {
                        tempRow.push(tile[Math.abs((tileRowIndex) - 7)][x]);
                        // tempRow.push(tile[Math.abs((this.currentScanline - spriteY) - this.spriteSize - 1)][x]);
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
                    if (drawingTopTile) {
                        tile = tileDown;
                    }
                    else {
                        tile = tileUp;
                    }
                    for (var x = 0; x < 8; x++) {
                        tempRow.push(tile[Math.abs((tileRowIndex) - 7)][x]);
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
                        if (currentBackgroundPixelColor == 0) {
                            pixelColor = this.paletteColors[this.palette[16 + paletteNum * 4 + pixelColorIndex]];
                            this.screenBuffer[spriteX + x + (this.currentScanline * 256)] = pixelColorIndex;
                            this.nes.mainDisplay.updateBuffer(spriteX + x + (this.currentScanline * 256), pixelColor);
                        }

                        else if (currentBackgroundPixelColor != 0) {
                            //non-transparent sprite having foreground priority over non-transparent background
                            if ((currentBackgroundPixelColor != 0) && ((spriteAttr & 0b00100000) == 0)) {
                                pixelColor = this.paletteColors[this.palette[16 + paletteNum * 4 + pixelColorIndex]];
                                this.screenBuffer[spriteX + x + (this.currentScanline * 256)] = pixelColorIndex;
                                this.nes.mainDisplay.updateBuffer(spriteX + x + (this.currentScanline * 256), pixelColor);
                            }
                        }
                    }
                }
            }
        }
    };

    this.renderBackGrounds = function(nametable, attrtable) {
        var paletteNum = 0;
        var pixelColor = 0; //this will hold the final pixel with color calculated 
        var pixelColorArray = []; //array to hold one scanline worth of color pixels
        var pixelColorIndexArray = [];
        var screenPixel = 0; //this is the pixel index of 32x30 screen 
        var nametableOffset = this.baseNameTblAddr;
        var tileXOffset = 0,
            tileYOffset = 0;
        var pixelXOffset = 0,
            pixelYOffset = 0;
        var tileToDraw = 0;
        var bgRenderingDone = false;
        var attrByte = 0;
        var curTileX = 0;
        var curTileY = Math.floor(this.currentScanline / 8);
        var tileCounter = 0;
        var tilesThisScanline = 32;
        var curTileYOffsetted = 0;
        var vReg = 0;
        var X = 0,
            Y = 0;
        //Tile Draw logic: get the tile to start draw from. Check for horizontal offset
        //offset the tiles using horizontal offset, then calculate pixel offset
        //Also calculate how many tiles of next nametable need to be drawn
        //then calculate upto which pixel drawing is needed
        if (this.yScroll > 239) {
            this.yScroll = 0;
        }
        tileXOffset = Math.floor(this.xScroll / 8); //offset tile (see above)
        tileYOffset = Math.floor((this.currentScanline + this.yScroll) / 8); //offset tile (see above)
        pixelXOffset = this.xScroll % 8; //offset pixel
        pixelYOffset = (this.currentScanline + this.yScroll) % 8; //offset pixel
        curTileX = tileXOffset; //start rendering from the offsetted tile
        curTileYOffsetted = tileYOffset;

        //when there is fine pixel offset, we have to fetch and draw pixels from an extra tile
        if ((pixelXOffset > 0) && (this.nameTableMirroring == 'vertical')) {
            tilesThisScanline = 33;
        }
        //loop to draw all the tiles on the screen for current scanline
        while (!bgRenderingDone) {
            if (curTileYOffsetted >= 30) {
                if (this.baseNameTblAddr == 2) {
                    nametableOffset = 0;
                }
                else {
                    nametableOffset = this.baseNameTblAddr + 2;
                }
                Y = curTileYOffsetted - 30;
            }
            else {
                nametableOffset = this.baseNameTblAddr;
                Y = curTileYOffsetted;
            }

            if (curTileX >= 32) { //check if current tile lies on next nametable
                if (this.baseNameTblAddr == 3) {
                    nametableOffset = 0;
                }
                else {
                    nametableOffset = nametableOffset + 1;
                }
                X = curTileX - 32;
            }
            else {
                X = curTileX;
            }
            vReg = (nametableOffset << 10) | (Y << 5) | X;

            tileToDraw = nametable[0x2000 | vReg];

            //get the tile bits from pre-calculated grid
            tileToDraw = this.nes.Mapper.getCHRGrid(this.backgroundPatTblAddr, tileToDraw);

            //Determine color palette
            //Get the current byte entries in 8x8 (32x32 pixel) attribute byte array
            attrByte = nametable[0x23C0 | (vReg & 0x0C00) | ((vReg >> 4) & 0x38) | ((vReg >> 2) & 0x07)];

            paletteNum = this.calcPaletteFromAttr(X, Y, attrByte);

            //We have now determined the background tile(accross nametables) to be rendered
            //also calculated the color palette using proper attributes
            //Now start the actual rendering process

            var curY = (this.currentScanline + this.yScroll) % 8; //get the y co-ordinate of an 8x8 tile from where to start rendering
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
            this.nes.mainDisplay.updateBuffer(x, pixelColorArray[x - screenPixel]);
        }
    };

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

            }
            //Calculate sprite 0 hit before rendering begins
            this.setSprite0Hit(oam);

            if (this.renderBackground)
                this.renderBackGrounds(nametable, attrtable);

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

    this.setSprite0Hit = function(oam) {
        var drawSprite0 = false,
            spriteX, spriteY, tileNum, tile, tileRow, pixelColorIndex;
        if ((oam[0] + 1) > (this.currentScanline - 8) && (oam[0] + 1) <= this.currentScanline) {
            drawSprite0 = true;
        }
        if (drawSprite0) {
            spriteX = oam[3];
            spriteY = oam[0] + 1;
            tileNum = oam[1];
            //Select tile num from OAM byte 1 and index from CHRGrid already prepared
            tile = this.nes.Mapper.getCHRGrid(this.spritePatTblAddr, tileNum);
            tileRow = tile[this.currentScanline - spriteY];
            for (var x = 0; x < 8; x++) {
                pixelColorIndex = tileRow[x];
                if (pixelColorIndex != 0) {
                    var currentBackgroundPixelColor = this.screenBuffer[spriteX + x + (this.currentScanline * 256)];
                    //Sprite hit logic: non-transparent Sprite over non-transparent BG REGARDLESS of priority
                    if (currentBackgroundPixelColor != 0) {
                        //If current sprite is sprite 0 and sprite hit not already set in PPUSTATUS
                        if (((this.ppuStatusBits & 0x40) == 0x00) && this.renderBackground) {
                            //set sprite 0 hit bit TODO: Other sprite hit conditions
                            this.ppuStatusBits = this.ppuStatusBits | 0x40;
                            this.sprite0Hit = true;
                        }
                    }
                }
            }
        }
    };
}
