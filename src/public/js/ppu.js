'use strict';
export default function ppu(nes) {
    this.nes = nes;
    //Render VARS
    var currentScanline = 261; //start from pre-render line
    var currentCycle = 0;
    this.nameTableMirroring = '';
    this.NMIOccured = false;
    this.CHRGrid = [];
    this.BGRCHRGrid = [];
    this.screenBuffer = [
        []
    ];
    this.palette = [];
    this.paletteColorsRendered = [];
    // this.paletteColors = [0x7C7C7C,
    //     0x0000FC,
    //     0x0000BC,
    //     0x4428BC,
    //     0x940084,
    //     0xA80020,
    //     0xA81000,
    //     0x881400,
    //     0x503000,
    //     0x007800,
    //     0x006800,
    //     0x005800,
    //     0x004058,
    //     0x000000,
    //     0x000000,
    //     0x000000,
    //     0xBCBCBC,
    //     0x0078F8,
    //     0x0058F8,
    //     0x6844FC,
    //     0xD800CC,
    //     0xE40058,
    //     0xF83800,
    //     0xE45C10,
    //     0xAC7C00,
    //     0x00B800,
    //     0x00A800,
    //     0x00A844,
    //     0x008888,
    //     0x000000,
    //     0x000000,
    //     0x000000,
    //     0xF8F8F8,
    //     0x3CBCFC,
    //     0x6888FC,
    //     0x9878F8,
    //     0xF878F8,
    //     0xF85898,
    //     0xF87858,
    //     0xFCA044,
    //     0xF8B800,
    //     0xB8F818,
    //     0x58D854,
    //     0x58F898,
    //     0x00E8D8,
    //     0x787878,
    //     0x000000,
    //     0x000000,
    //     0xFCFCFC,
    //     0xA4E4FC,
    //     0xB8B8F8,
    //     0xD8B8F8,
    //     0xF8B8F8,
    //     0xF8A4C0,
    //     0xF0D0B0,
    //     0xFCE0A8,
    //     0xF8D878,
    //     0xD8F878,
    //     0xB8F8B8,
    //     0xB8F8D8,
    //     0x00FCFC,
    //     0xF8D8F8,
    //     0x000000,
    //     0x000000
    // ];
    this.paletteColors = [
        [0x7C, 0x7C, 0x7C],
        [0x00, 0x00, 0xFC],
        [0x00, 0x00, 0xBC],
        [0x44, 0x28, 0xBC],
        [0x94, 0x00, 0x84],
        [0xA8, 0x00, 0x20],
        [0xA8, 0x10, 0x00],
        [0x88, 0x14, 0x00],
        [0x50, 0x30, 0x00],
        [0x00, 0x78, 0x00],
        [0x00, 0x68, 0x00],
        [0x00, 0x58, 0x00],
        [0x00, 0x40, 0x58],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00],
        [0xBC, 0xBC, 0xBC],
        [0x00, 0x78, 0xF8],
        [0x00, 0x58, 0xF8],
        [0x68, 0x44, 0xFC],
        [0xD8, 0x00, 0xCC],
        [0xE4, 0x00, 0x58],
        [0xF8, 0x38, 0x00],
        [0xE4, 0x5C, 0x10],
        [0xAC, 0x7C, 0x00],
        [0x00, 0xB8, 0x00],
        [0x00, 0xA8, 0x00],
        [0x00, 0xA8, 0x44],
        [0x00, 0x88, 0x88],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00],
        [0xF8, 0xF8, 0xF8],
        [0x3C, 0xBC, 0xFC],
        [0x68, 0x88, 0xFC],
        [0x98, 0x78, 0xF8],
        [0xF8, 0x78, 0xF8],
        [0xF8, 0x58, 0x98],
        [0xF8, 0x78, 0x58],
        [0xFC, 0xA0, 0x44],
        [0xF8, 0xB8, 0x00],
        [0xB8, 0xF8, 0x18],
        [0x58, 0xD8, 0x54],
        [0x58, 0xF8, 0x98],
        [0x00, 0xE8, 0xD8],
        [0x78, 0x78, 0x78],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00],
        [0xFC, 0xFC, 0xFC],
        [0xA4, 0xE4, 0xFC],
        [0xB8, 0xB8, 0xF8],
        [0xD8, 0xB8, 0xF8],
        [0xF8, 0xB8, 0xF8],
        [0xF8, 0xA4, 0xC0],
        [0xF0, 0xD0, 0xB0],
        [0xFC, 0xE0, 0xA8],
        [0xF8, 0xD8, 0x78],
        [0xD8, 0xF8, 0x78],
        [0xB8, 0xF8, 0xB8],
        [0xB8, 0xF8, 0xD8],
        [0x00, 0xFC, 0xFC],
        [0xF8, 0xD8, 0xF8],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00]
    ];

    this.bitReversalLookUp = [
        0x00, 0x80, 0x40, 0xC0, 0x20, 0xA0, 0x60, 0xE0, 0x10, 0x90, 0x50, 0xD0, 0x30, 0xB0, 0x70, 0xF0,
        0x08, 0x88, 0x48, 0xC8, 0x28, 0xA8, 0x68, 0xE8, 0x18, 0x98, 0x58, 0xD8, 0x38, 0xB8, 0x78, 0xF8,
        0x04, 0x84, 0x44, 0xC4, 0x24, 0xA4, 0x64, 0xE4, 0x14, 0x94, 0x54, 0xD4, 0x34, 0xB4, 0x74, 0xF4,
        0x0C, 0x8C, 0x4C, 0xCC, 0x2C, 0xAC, 0x6C, 0xEC, 0x1C, 0x9C, 0x5C, 0xDC, 0x3C, 0xBC, 0x7C, 0xFC,
        0x02, 0x82, 0x42, 0xC2, 0x22, 0xA2, 0x62, 0xE2, 0x12, 0x92, 0x52, 0xD2, 0x32, 0xB2, 0x72, 0xF2,
        0x0A, 0x8A, 0x4A, 0xCA, 0x2A, 0xAA, 0x6A, 0xEA, 0x1A, 0x9A, 0x5A, 0xDA, 0x3A, 0xBA, 0x7A, 0xFA,
        0x06, 0x86, 0x46, 0xC6, 0x26, 0xA6, 0x66, 0xE6, 0x16, 0x96, 0x56, 0xD6, 0x36, 0xB6, 0x76, 0xF6,
        0x0E, 0x8E, 0x4E, 0xCE, 0x2E, 0xAE, 0x6E, 0xEE, 0x1E, 0x9E, 0x5E, 0xDE, 0x3E, 0xBE, 0x7E, 0xFE,
        0x01, 0x81, 0x41, 0xC1, 0x21, 0xA1, 0x61, 0xE1, 0x11, 0x91, 0x51, 0xD1, 0x31, 0xB1, 0x71, 0xF1,
        0x09, 0x89, 0x49, 0xC9, 0x29, 0xA9, 0x69, 0xE9, 0x19, 0x99, 0x59, 0xD9, 0x39, 0xB9, 0x79, 0xF9,
        0x05, 0x85, 0x45, 0xC5, 0x25, 0xA5, 0x65, 0xE5, 0x15, 0x95, 0x55, 0xD5, 0x35, 0xB5, 0x75, 0xF5,
        0x0D, 0x8D, 0x4D, 0xCD, 0x2D, 0xAD, 0x6D, 0xED, 0x1D, 0x9D, 0x5D, 0xDD, 0x3D, 0xBD, 0x7D, 0xFD,
        0x03, 0x83, 0x43, 0xC3, 0x23, 0xA3, 0x63, 0xE3, 0x13, 0x93, 0x53, 0xD3, 0x33, 0xB3, 0x73, 0xF3,
        0x0B, 0x8B, 0x4B, 0xCB, 0x2B, 0xAB, 0x6B, 0xEB, 0x1B, 0x9B, 0x5B, 0xDB, 0x3B, 0xBB, 0x7B, 0xFB,
        0x07, 0x87, 0x47, 0xC7, 0x27, 0xA7, 0x67, 0xE7, 0x17, 0x97, 0x57, 0xD7, 0x37, 0xB7, 0x77, 0xF7,
        0x0F, 0x8F, 0x4F, 0xCF, 0x2F, 0xAF, 0x6F, 0xEF, 0x1F, 0x9F, 0x5F, 0xDF, 0x3F, 0xBF, 0x7F, 0xFF
    ];

    //PPUCTRL vars
    this.baseNameTblAddr = 0x2000;
    this.vRamAddrInc = 1;
    // this.spritePatTblAddr = this.CHRGrid;
    // this.backgroundPatTblAddr = this.BGRCHRGrid;
    this.spritePatTblAddr = 0;
    this.backgroundPatTblAddr = 0;
    this.spriteSize = 8;
    this.ppuMasterSlave = 'readBackdrop';
    this.enableNMIGen = false;

    //PPUMASK vars
    this.renderGreyscale = false;
    var renderBGLeftMost = false;
    var renderSpritesLeftMost = false;
    var renderBackground = 0;
    var renderSprite = 0;
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
    this.coarseXScroll = 0;
    this.coarseYScroll = 0;
    this.fineXScroll = 0;
    this.fineYScroll = 0;
    this.OAM = [];

    //OAMADDR 
    this.OAMADDR = 0x00;

    //OAMDATA
    this.OAMDATA = 0x00;

    //OAMDMA
    this.OAMDMA = 0x00;

    this.spriteGrid = [];
    this.backGroundGrid = [];
    var secOAM = [];

    //Update PPUCTRL status
    this.setPPUCTRL = function(PPUCTRL) {
        var temp;
        temp = PPUCTRL & 0x03;
        this.baseNameTblAddr = temp;
        temp = (PPUCTRL >> 2) & 0x01;
        if (temp == 0)
            this.vRamAddrInc = 1;
        else
            this.vRamAddrInc = 32;
        temp = (PPUCTRL >> 3) & 0x01;
        if (temp == 0)
            this.spritePatTblAddr = 0;
        else
            this.spritePatTblAddr = 0;
        temp = (PPUCTRL >> 4) & 0x01;
        if (temp == 0)
            this.backgroundPatTblAddr = 0;
        else
            this.backgroundPatTblAddr = 1;
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

        /*New cycle accurate logic*/
        //Nametable select
        this.t &= ~(0x0C00);
        this.t |= (PPUCTRL & 0x03) << 10;
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
            renderBGLeftMost = false;
        else
            renderBGLeftMost = true;
        temp = (PPUMASK >> 2) & 0x01;
        if (temp == 0)
            renderSpritesLeftMost = false;
        else
            renderSpritesLeftMost = true;
        temp = (PPUMASK >> 3) & 0x01;
        if (temp == 0)
            renderBackground = 0;
        else
            renderBackground = 1;
        temp = (PPUMASK >> 4) & 0x01;
        if (temp == 0)
            renderSprite = 0;
        else
            renderSprite = 1;
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

    //Update PPUADDR
    this.setPPUADDR = function(PPUADDR) {
        this.PPUADDR = PPUADDR;
    };

    //Load PPU Palette values
    this.setPalette = function(index, value) {
        if (index == 0x10) {
            this.palette[0x00] = value;
        }
        else if (index == 0x00) {
            this.palette[0x10] = value;
        }
        this.palette[index] = value;
    };

    this.getPalette = function(index) {
        return this.palette[index];
    };

    this.initPalette = function() {
        for (var i = 0; i < this.paletteColors.length; i++) {
            this.paletteColorsRendered[i] = 0xFF000000 | this.paletteColors[i][2] << 16 | this.paletteColors[i][1] << 8 | this.paletteColors[i][0];
        }
    };

    this.initScreenBuffer = function() {
        for (var x = 0; x < 256 * 240; x++) {
            this.screenBuffer.push(0x000000);
        }
        this.initPalette();
        this.nes.mainDisplay.initScreenBuffer();
        (sprLkpTbl = []).length = 256;
        sprLkpTbl.fill(0);
        // (sprUnitLkpTbl = []).length = 8;
        // sprUnitLkpTbl.fill(0);
        // sprUnitLkpTbl = Array(256).fill(Array(8).fill(0));
        for (var i = 0; i < 256; i++) {
            // var arr;
            // (arr = []).length = 8;
            // arr.fill(0);
            // sprUnitLkpTbl.push(arr);
            sprUnitLkpTbl[i] = {};
        }
    };
    var sprLkpTbl = [];
    var sprUnitLkpTbl = [];
    this.secOAMInit = function() {
        (secOAM = []).length = 32;
        secOAM.fill(0x100);
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
                if ((oam[i] + 1) > (currentScanline - 8) && (oam[i] + 1) <= currentScanline) {
                    // if ((oam[i] + 1) > (currentScanline - this.spriteSize) && (oam[i] + 1) <= currentScanline) {
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
                tileRow = tile[currentScanline - spriteY];
                //Select the palette number from OAM for the tile
                paletteNum = spriteAttr & 0b00000011;

                //Check for flipping of sprite
                if (((spriteAttr & 0b01000000) == 0b01000000) && ((spriteAttr & 0b10000000) == 0b10000000)) {
                    var tempRow = [];
                    var tempRow2 = [];
                    for (var x = 0; x < 8; x++) {
                        tempRow.push(tile[Math.abs((currentScanline - spriteY) - 7)][x]);
                        // tempRow.push(tile[Math.abs((currentScanline - spriteY) - this.spriteSize - 1)][x]);
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
                        tempRow.push(tile[Math.abs((currentScanline - spriteY) - 7)][x]);
                        // tempRow.push(tile[Math.abs((currentScanline - spriteY) - this.spriteSize - 1)][x]);
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
                        var currentBackgroundPixelColor = this.screenBuffer[spriteX + x + (currentScanline * 256)];

                        //non-transparent sprite over transparent background
                        // if (currentBackgroundPixelColor == this.paletteColors[this.palette[0]]) {
                        if (currentBackgroundPixelColor == 0) {
                            pixelColor = this.paletteColors[this.palette[16 + paletteNum * 4 + pixelColorIndex]];
                            // this.screenBuffer[spriteX + x + (currentScanline * 256)] = pixelColor;
                            this.screenBuffer[spriteX + x + (currentScanline * 256)] = pixelColorIndex;
                            this.nes.mainDisplay.updateBuffer(spriteX + x + (currentScanline * 256), pixelColor);
                        }
                        else if (currentBackgroundPixelColor != 0) {
                            //non-transparent sprite having foreground priority over non-transparent background
                            // if (currentBackgroundPixelColor != this.paletteColors[this.palette[0]] && ((spriteAttr & 0b00100000) == 0)) {
                            if ((currentBackgroundPixelColor != 0) && ((spriteAttr & 0b00100000) == 0)) {
                                pixelColor = this.paletteColors[this.palette[16 + paletteNum * 4 + pixelColorIndex]];
                                this.screenBuffer[spriteX + x + (currentScanline * 256)] = pixelColorIndex;
                                // this.screenBuffer[spriteX + x + (currentScanline * 256)] = pixelColor;
                                this.nes.mainDisplay.updateBuffer(spriteX + x + (currentScanline * 256), pixelColor);
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
                if ((oam[i] + 1) > (currentScanline - 16) && (oam[i] + 1) <= currentScanline) {
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
                tileRowIndex = currentScanline - spriteY;
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
                        // tempRow.push(tile[Math.abs((currentScanline - spriteY) - this.spriteSize - 1)][x]);
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
                        var currentBackgroundPixelColor = this.screenBuffer[spriteX + x + (currentScanline * 256)];

                        //non-transparent sprite over transparent background
                        if (currentBackgroundPixelColor == 0) {
                            pixelColor = this.paletteColors[this.palette[16 + paletteNum * 4 + pixelColorIndex]];
                            this.screenBuffer[spriteX + x + (currentScanline * 256)] = pixelColorIndex;
                            this.nes.mainDisplay.updateBuffer(spriteX + x + (currentScanline * 256), pixelColor);
                        }
                        else if (currentBackgroundPixelColor != 0) {
                            //non-transparent sprite having foreground priority over non-transparent background
                            if ((currentBackgroundPixelColor != 0) && ((spriteAttr & 0b00100000) == 0)) {
                                pixelColor = this.paletteColors[this.palette[16 + paletteNum * 4 + pixelColorIndex]];
                                this.screenBuffer[spriteX + x + (currentScanline * 256)] = pixelColorIndex;
                                this.nes.mainDisplay.updateBuffer(spriteX + x + (currentScanline * 256), pixelColor);
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
        var curTileY = Math.floor(currentScanline / 8);
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
        // tileXOffset = Math.floor(this.xScroll / 8); //offset tile (see above)
        tileXOffset = this.coarseXScroll;
        tileYOffset = Math.floor((currentScanline + this.yScroll) / 8); //offset tile (see above)
        // tileYOffset = this.coarseYScroll;

        // pixelXOffset = this.xScroll % 8; //offset pixel
        pixelXOffset = this.fineXScroll;

        pixelYOffset = (currentScanline + this.yScroll) % 8; //offset pixel
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
                if (nametableOffset == 3) {
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

            var curY = (currentScanline + this.yScroll) % 8; //get the y co-ordinate of an 8x8 tile from where to start rendering
            // var curY = (currentScanline % 8) + this.fineYScroll;


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
        screenPixel = 0 + (curTileY * 8 + (currentScanline % 8)) * 256;

        //start merging our color pixel array into screen buffer from now on
        for (var x = screenPixel; x < (screenPixel + pixelColorArray.length); x++) {
            this.screenBuffer[x] = pixelColorIndexArray[x - screenPixel];
            this.nes.mainDisplay.updateBuffer(x, pixelColorArray[x - screenPixel]);
        }
    };

    this.RenderNextScanline = function(oam, nametable, attrtable) {
        //Pre render Scanline
        if (currentScanline == 261) {
            //clear PPUSTATUS vblank indicator
            this.ppuStatusBits = this.ppuStatusBits & 0x7F;
            //clear sprite hit
            this.ppuStatusBits = this.ppuStatusBits & 0xBF;
            this.sprite0Hit = false;
            //clear sprite overflow
            this.ppuStatusBits = this.ppuStatusBits & 0xDF;
            this.spriteOverflow = false;
            this.NMIOccured = false;

            currentScanline = 0;
            this.vBlankStarted = false;

            return 261;
        }
        //Visible Scanlines
        else if (currentScanline >= 0 && currentScanline < 240) {
            if (currentScanline == 0) {

            }
            // Calculate sprite 0 hit before rendering begins
            if (renderBackground && renderSprite)
                this.setSprite0Hit(oam);

            if (renderBackground)
                this.renderBackGrounds(nametable, attrtable);

            if (renderSprite)
                this.renderSprites(oam);
        }
        //Post render Scanline
        else if (currentScanline == 240) {

        }
        //Vertical blanking lines
        else if (currentScanline > 240 && currentScanline <= 260) {
            if (currentScanline == 241) {
                //Set vBlank
                this.ppuStatusBits = this.ppuStatusBits & 0x7F;
                this.ppuStatusBits = this.ppuStatusBits | 0x80;

                this.vBlankStarted = true;
                this.NMIOccured = true;
            }
        }
        currentScanline++;
        return currentScanline - 1;
    };

    this.setSprite0Hit = function(oam) {
        var drawSprite0 = false,
            spriteX, spriteY, tileNum, tile, tileRow, pixelColorIndex;
        if ((oam[0] + 1) > (currentScanline - 8) && (oam[0] + 1) <= currentScanline) {
            drawSprite0 = true;
        }
        if (drawSprite0) {
            spriteX = oam[3];
            spriteY = oam[0] + 1;
            tileNum = oam[1];
            //Select tile num from OAM byte 1 and index from CHRGrid already prepared
            tile = this.nes.Mapper.getCHRGrid(this.spritePatTblAddr, tileNum);
            tileRow = tile[currentScanline - spriteY];
            for (var x = 0; x < 8; x++) {
                pixelColorIndex = tileRow[x];
                if (pixelColorIndex != 0) {
                    if ((spriteX + x) != 255) {
                        if ((renderBGLeftMost || renderSpritesLeftMost) && ((spriteX + x) >= 0 && (spriteX + x) < 8)) {

                        }
                        else {
                            var currentBackgroundPixelColor = this.screenBuffer[spriteX + x + (currentScanline * 256)];
                            //Sprite hit logic: non-transparent Sprite over non-transparent BG REGARDLESS of priority
                            if (currentBackgroundPixelColor != 0) {
                                //If current sprite is sprite 0 and sprite hit not already set in PPUSTATUS
                                if (((this.ppuStatusBits & 0x40) == 0x00) && renderBackground) {
                                    //set sprite 0 hit bit TODO: Other sprite hit conditions
                                    this.ppuStatusBits = this.ppuStatusBits | 0x40;
                                    this.sprite0Hit = true;
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    /*
    t & v 
    yyy NN YYYYY XXXXX
    ||| || ||||| +++++-- coarse X scroll
    ||| || +++++-------- coarse Y scroll
    ||| ++-------------- nametable select
    +++----------------- fine Y scroll
    */
    //OAM registers
    var n = 0;
    var m = 0;
    var secOAMIndex = 0;
    var allSpritesFound = false; //if all 8 sprites have been found
    var allSpritesEvaluated = false; //if all 64 sprites in OAM have been evaluated
    this.oamEvalComplete = false;
    var spriteInRange = false;
    var oamReadBuffer = 0;
    //Scroll registers
    var v = 0;
    this.t = 0;
    this.x = 0;
    this.w = 0;
    var y = 0;
    var nt_byte = 0;
    var at_byte = 0;
    var bgL = 0x0000;
    var bgH = 0x0000;
    var bgShiftL = 0;
    var bgShiftH = 0;
    var atShiftL = 0;
    var atShiftH = 0;
    var atH = 0x0000;
    var atL = 0x0000;
    this.at_bits = 0;
    this.at_latch = 0;
    this.PPUDATAReadBuffer = 0;
    var bgPixel = 0;
    var tempBgHBit = 0,
        tempBgLBit = 0,
        tempAtHBit = 0,
        tempAtLBit = 0,
        shiftAmt = 0;
    var spritePixel = 0,
        spritePixelColor = 0,
        tempSpriteH = 0,
        tempSpriteL = 0,
        tempSpritePriority = 0;
    var outputPixel = 0;
    var spriteOpUnits = []; //Sprite output unit combined of two 8-bit shift registers
    //One attribute latch and 1 X-position counter
    this.initSpriteOpUnits = function() {
        for (var i = 0; i < 8; i++) {
            spriteOpUnits.push(new Array(0, 0, 0, 0, 0)); //X, ShiftCount, low bitmap, high bitmap, attr 
            // this.spriteOpUnits.push({ bitmapLow: 0, bitmapHigh: 0, attr: 0, X: 0xFF, isActive: false, shiftCount: 0 });
        }
    };

    var currentSpriteOpUnit = 0;

    this.getCurrentScanline = function() {
        return currentScanline;
    };

    this.getCurrentCycle = function() {
        return currentCycle;
    };
    this.getOAMReadBuffer = function() {
        return oamReadBuffer;
    };
    var ppuStatusReadOnNMI = false;
    this.getPPUSTATUS = function() {
        var prevStatus = this.ppuStatusBits;
        //clear PPUSTATUS vblank indicators
        this.ppuStatusBits = this.ppuStatusBits & 0x7F;
        ppuStatusReadOnNMI = currentScanline == 241 && currentCycle == 1;
        this.w = 0;
        return prevStatus;
    };

    this.getPPUDATA = function(location) {
        var returnValue = 0;
        if (currentScanline >= 240 && currentScanline <= 260) {
            returnValue = this.getReadBuffer(v);
            if (!vIncremented)
                v += this.vRamAddrInc;
        }
        else if (currentScanline == 261 | (currentScanline >= 0 && currentScanline < 240)) {
            returnValue = this.getReadBuffer(v);
            if (this.rendering()) {
                this.updateXScroll();
                this.updateYScroll();
            }
            else {
                if (!vIncremented)
                    v += this.vRamAddrInc;
            }
        }
        return returnValue;
    };

    this.setPPUDATA = function(value) {
        if (currentScanline >= 240 && currentScanline <= 260) {
            this.nes.MMU.setPpuMemVal(v, value);
            if (!vIncremented)
                v += this.vRamAddrInc;
        }
        else if (currentScanline == 261 | (currentScanline >= 0 && currentScanline < 240)) {
            this.nes.MMU.setPpuMemVal(v, value);
            if (this.rendering()) {
                this.updateXScroll();
                this.updateYScroll();
            }
            else {
                if (!vIncremented)
                    v += this.vRamAddrInc;
            }
        }
    };

    this.getReadBuffer = function(location) {
        var returnValue = this.PPUDATAReadBuffer;
        if (location >= 0x0000 && location < 0x3EFF) {
            this.PPUDATAReadBuffer = this.nes.MMU.getPpuMemVal(location);
        }
        else {
            this.PPUDATAReadBuffer = returnValue = this.nes.MMU.getPpuMemVal(location);
        }
        return returnValue;
    };

    this.setPPUSCROLL = function(PPUSCROLL) {
        if (this.w == 0) {
            this.t &= ~(0x1F);
            this.t |= PPUSCROLL >> 3;
            this.x = PPUSCROLL & 0x07;
            this.w = 1;
        }
        else if (this.w == 1) {
            this.t &= ~(0x73E0);
            this.t |= (PPUSCROLL & 0x07) << 12;
            this.t |= (PPUSCROLL & 0xF8) << 2;
            this.w = 0;
        }
    };

    this.setPPUADDR = function(PPUADDR) {
        if (this.w == 0) {
            this.t &= ~(0x7F00);
            this.t |= (PPUADDR & 0x3F) << 8;
            this.w = 1;
        }
        else if (this.w == 1) {
            this.t &= ~(0xFF);
            this.t |= PPUADDR;
            v = this.t;
            this.w = 0;
        }
    };

    var oddFrameCycleSkipped = false;
    var sprite0Evaluated = false;
    var testClock = 0;
    var clockTest = false;
    this.clock = function() {
        // if (clockTest)
        //     testClock++;
        if (vIncremented)
            vIncremented = false;
        //visible scanline
        if (currentScanline >= 0 && currentScanline < 240) {
            if (currentCycle == 0) {
                if (oddFrameCycleSkipped) {
                    // if (!this.nes.CPU.oddFrame && currentScanline == 0 && renderBackground) {
                    this.getNameTableByte();
                    oddFrameCycleSkipped = false;
                }
                currentSpriteOpUnit = 0;
                this.renderPixel();
            }
            else if (currentCycle < 256) {
                this.memoryFetch();
                this.renderPixel();
                if (currentCycle > 64) {
                    if (this.rendering()) {
                        // this.evalSprites();
                        //Even cycles
                        if ((currentCycle & 1) == 0) {
                            if (!allSpritesFound && !allSpritesEvaluated) {
                                secOAM[secOAMIndex] = oamReadBuffer;
                                if (spriteInRange) {
                                    if (n == 0) {
                                        sprite0Evaluated = true;
                                    }
                                    secOAMIndex++;
                                    if (secOAMIndex == 32) {
                                        allSpritesFound = true;
                                    }
                                    m++;
                                    if (m == 4) {
                                        m = 0;
                                        n++;
                                        if (n >= 64) {
                                            allSpritesEvaluated = true;
                                            n = 0;
                                        }
                                    }
                                }
                                else {
                                    n++;
                                    if (n >= 64) {
                                        allSpritesEvaluated = true;
                                        n = 0;
                                    }
                                }
                            }
                        }
                        //Odd cycles
                        else {
                            if (!allSpritesFound && !allSpritesEvaluated) {
                                if (m == 0) {
                                    oamReadBuffer = this.nes.MMU.OAM[4 * n];
                                    spriteInRange = (oamReadBuffer > (currentScanline - 8)) && (oamReadBuffer <= currentScanline);
                                }
                                else {
                                    if (spriteInRange) {
                                        oamReadBuffer = this.nes.MMU.OAM[4 * n + m];
                                    }
                                }
                            }
                        }
                    }
                }
                else if (currentCycle == 1) {
                    (secOAM = []).length = 32;
                    secOAM.fill(0x100);
                    allSpritesFound = false;
                    allSpritesEvaluated = false;
                    sprite0Evaluated = false;
                    secOAMIndex = 0;
                    n = 0, m = 0;
                }
            }
            else if (currentCycle == 256) {
                this.memoryFetch();
                this.updateYScroll(); //FIXME
                //Clear sprite lookup table
                (sprLkpTbl = []).length = 256;
                sprLkpTbl.fill(0);
                if (this.rendering()) {
                    // this.evalSprites();
                    //Even cycles
                    if (!allSpritesFound && !allSpritesEvaluated) {
                        secOAM[secOAMIndex] = oamReadBuffer;
                        if (spriteInRange) {
                            secOAMIndex++;
                            if (secOAMIndex == 32) {
                                allSpritesFound = true;
                            }
                            m++;
                            if (m == 4) {
                                m = 0;
                                n++;
                                if (n >= 64) {
                                    allSpritesEvaluated = true;
                                    n = 0;
                                }
                            }
                        }
                        else {
                            n++;
                            if (n >= 64) {
                                allSpritesEvaluated = true;
                                n = 0;
                            }
                        }
                    }
                }
            }
            //fetch sprite tile data for next scanline
            else if (currentCycle >= 257 && currentCycle <= 320) {
                if (currentCycle == 257) {
                    this.reloadShiftRegisters();
                    this.copyHScroll();
                    // allSpritesFound = false;
                    // allSpritesEvaluated = false;
                }
                this.fetchSprites();
                if (this.rendering())
                    this.OAMADDR = 0;
            }
            //2 tile data for next scanline
            else if (currentCycle >= 321 && currentCycle <= 336) {
                this.memoryFetch();
                oamReadBuffer = secOAM[0];
            }
            //2 usused nametable byte fetch
            else if (currentCycle == 338 || currentCycle == 340) {
                // this.getNameTableByte();
                oamReadBuffer = secOAM[0];
                nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)];
            }
            else if (currentCycle == 339)
                oamReadBuffer = secOAM[0];
        }
        //post-render scanline
        // else if (currentScanline == 240) {
        //     //PPU idles
        // }
        //VBlank Scanlines
        else if (currentScanline >= 241 && currentScanline < 261) {
            if (currentScanline == 241 && currentCycle == 1) {
                //Set V-Blank
                if (!ppuStatusReadOnNMI) {
                    this.ppuStatusBits = this.ppuStatusBits & 0x7F;
                    this.ppuStatusBits = this.ppuStatusBits | 0x80;
                    // clockTest = true;
                    if (this.nes.MMU.enableNMIGen) {
                        this.nes.CPU.elapsedCycles = 0;
                        this.nes.CPU.serveISR('NMI');
                        this.nes.CPU.cpuClockRemaining += this.nes.CPU.elapsedCycles;
                    }
                }
            }
        }
        //pre-render scanline
        else if (currentScanline == 261) {
            //reload vertical scroll bits
            if (currentCycle >= 1 && currentCycle <= 256) {
                if (currentCycle == 1) {
                    // if (clockTest) {
                    //     alert("interval between vbl set and clear = " + testClock + " clocks");
                    //     testClock = 0;
                    //     clockTest = false;
                    // }
                    //clear PPUSTATUS vblank indicator
                    this.ppuStatusBits = this.ppuStatusBits & 0x7F;
                    //clear sprite hit
                    this.ppuStatusBits = this.ppuStatusBits & 0xBF;
                    // this.sprite0Hit = false;
                    sprite0Drawn = false;
                    //clear sprite overflow
                    this.ppuStatusBits = this.ppuStatusBits & 0xDF;
                }
                this.memoryFetch();
                if (currentCycle == 256)
                    this.updateYScroll();
                // this.memoryFetch();
            }
            else if (currentCycle >= 257 && currentCycle <= 320) {
                if (currentCycle == 257) {
                    this.copyHScroll();
                }
                this.fetchSprites();
                if (this.rendering())
                    this.OAMADDR = 0;

                if (currentCycle >= 280 && currentCycle <= 304) {
                    this.copyVScroll();
                }
            }
            //2 tile data for next scanline
            else if (currentCycle >= 321 && currentCycle <= 336) {
                this.memoryFetch();
            }
            else if (currentCycle == 339 && this.nes.CPU.oddFrame && renderBackground) {
                currentCycle = 0;
                this.nes.CPU.renderedScanline = currentScanline;
                currentScanline = 0;
                oddFrameCycleSkipped = true;
                return true;
            }
            else if (currentCycle == 338 || currentCycle == 340)
                this.getNameTableByte();
        }
        currentCycle++;
        if (currentCycle == 341) {
            currentCycle = 0;
            this.nes.CPU.renderedScanline = currentScanline;
            currentScanline++;
            if (currentScanline == 262) {
                currentScanline = 0;
            }
            return true;
        }
        return false;
    };

    this.clearSecondaryOAM = function() {
        if (currentCycle == 1) {
            this.nes.MMU.secOAMInit();
        }
        secOAMIndex = 0;
    };

    //TODO: Sprite overflow logic
    // this.evalSprites = function() {
    //     //Even cycles
    //     if ((currentCycle & 1) == 0) {
    //         if (!allSpritesFound) {
    //             secOAM[secOAMIndex] = oamReadBuffer;
    //             if (spriteInRange) {
    //                 secOAMIndex++;
    //                 m++;
    //                 if (m == 4) {
    //                     m = 0;
    //                     n++;
    //                     if (n >= 64) {
    //                         allSpritesFound = true;
    //                         n = 0;
    //                     }
    //                 }
    //             }
    //             else {
    //                 n++;
    //                 if (n >= 64) {
    //                     allSpritesFound = true;
    //                     n = 0;
    //                 }
    //             }
    //         }
    //     }
    //     //Odd cycles
    //     else {
    //         if (!allSpritesFound) {
    //             if (m == 0) {
    //                 oamReadBuffer = this.nes.MMU.OAM[4 * n];
    //                 // spriteInRange = this.checkSpriteInRange();
    //                 spriteInRange = (oamReadBuffer > (currentScanline - 8)) && (oamReadBuffer <= currentScanline);
    //             }
    //             else {
    //                 if (spriteInRange) {
    //                     oamReadBuffer = this.nes.MMU.OAM[4 * n + m];
    //                 }
    //             }
    //         }
    //     }
    // };

    this.fetchSprites = function() {
        switch (currentCycle % 8) {
            //Two garbage NameTable bytes
            case 1:
                oamReadBuffer = secOAM[currentSpriteOpUnit * 4];
                break;
            case 2:
                oamReadBuffer = secOAM[currentSpriteOpUnit * 4 + 1];
                break;
            case 3:
                //Tile attribute
                oamReadBuffer = secOAM[currentSpriteOpUnit * 4 + 2];
                spriteOpUnits[currentSpriteOpUnit][4] = oamReadBuffer;
                break;
            case 4:
                //X pos
                oamReadBuffer = secOAM[currentSpriteOpUnit * 4 + 3];
                spriteOpUnits[currentSpriteOpUnit][0] = oamReadBuffer;
                if (oamReadBuffer != 256) {
                    for (var i = oamReadBuffer; i < oamReadBuffer + 8; i++) {
                        if (i == 256)
                            break;
                        sprLkpTbl[i] = 1;
                    }
                }
                break;
            case 5:
                break;
            case 6:
                this.getSpriteTileBitmapLow();
                break;
            case 7:
                break;
            case 0:
                this.getSpriteTileBitmapHigh();
                currentSpriteOpUnit++;
                if (currentSpriteOpUnit > 7)
                    currentSpriteOpUnit = 0;
                break;
        }
    };

    var spriteTileNum = 0;
    var spriteEffectiveY = 0;
    var spriteTileAddr = 0;
    var tempSpriteOpUnitIndex = 0;
    this.getSpriteTileBitmapLow = function() {
        tempSpriteOpUnitIndex = currentSpriteOpUnit * 4;
        // if ((secOAM[tempSpriteOpUnitIndex] + 1) >= 0xEF) {
        //     spriteOpUnits[currentSpriteOpUnit][1] = 0;
        //     return;
        // }
        spriteTileNum = secOAM[tempSpriteOpUnitIndex + 1];
        spriteEffectiveY = currentScanline - secOAM[tempSpriteOpUnitIndex];
        //vertical flipping
        if ((spriteOpUnits[currentSpriteOpUnit][4] & 0x80) == 0x80) {
            spriteEffectiveY = Math.abs(spriteEffectiveY - 7);
        }
        spriteTileAddr = (spriteTileNum * 16) + spriteEffectiveY + 0x1000 * (this.spritePatTblAddr);
        // spriteOpUnits[currentSpriteOpUnit][2] = this.nes.Mapper.getCHRRom(spriteTileAddr);
        spriteOpUnits[currentSpriteOpUnit][2] = this.nes.MMU.getPpuMemVal(spriteTileAddr);
        //horizontal flipping
        if ((spriteOpUnits[currentSpriteOpUnit][4] & 0x40) == 0x40) {
            spriteOpUnits[currentSpriteOpUnit][2] = this.bitReversalLookUp[spriteOpUnits[currentSpriteOpUnit][2]];
        }
    };

    this.getSpriteTileBitmapHigh = function() {
        // if ((secOAM[tempSpriteOpUnitIndex] + 1) >= 0xEF) {
        //     spriteOpUnits[currentSpriteOpUnit][2] = 0;
        //     return;
        // }
        spriteTileAddr += 8;
        // spriteOpUnits[currentSpriteOpUnit][3] = this.nes.Mapper.getCHRRom(spriteTileAddr);
        spriteOpUnits[currentSpriteOpUnit][3] = this.nes.MMU.getPpuMemVal(spriteTileAddr);
        if ((spriteOpUnits[currentSpriteOpUnit][4] & 0x40) == 0x40) {
            spriteOpUnits[currentSpriteOpUnit][3] = this.bitReversalLookUp[spriteOpUnits[currentSpriteOpUnit][3]];
        }
    };

    var tileAddr = 0;
    this.memoryFetch = function() {
        switch (currentCycle % 8) {
            case 0:
                this.reloadShiftRegisters();
                this.updateXScroll();
                break;
            case 1:
                // this.getNameTableByte();
                nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)];
                break;
            case 3:
                atH <<= 8;
                atL <<= 8;
                // this.getAttrTableByte();
                at_byte = this.nes.MMU.ppuMem[0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07)];
                // this.at_bits = this.calcPaletteFromAttr(v & 0x1F, (v & 0x3E0) >> 5, at_byte); //FIXME
                //exprmntl
                if (((v & 0x3E0) >> 5) & 2)
                    at_byte >>= 4;
                if ((v & 0x1F) & 2)
                    at_byte >>= 2;
                atH = (atH & 0xFF00);
                atL = (atL & 0xFF00);
                // if ((this.at_bits & 0x02) >> 1) {
                //     atH |= 0xFF;
                // }
                // if (this.at_bits & 0x01) {
                //     atL |= 0xFF;
                // }
                if ((at_byte & 0x02) >> 1) {
                    atH |= 0xFF;
                }
                if (at_byte & 0x01) {
                    atL |= 0xFF;
                }
                break;
            case 5:
                bgL <<= 8;
                // this.getTileBitmapLow();
                var T = (v & 0x7000) >> 12;
                tileAddr = (nt_byte * 16) + 0x1000 * (this.backgroundPatTblAddr) + T;
                // bgL = (bgL & 0xFF00) | (this.nes.Mapper.getCHRRom(tileAddr));
                bgL = (bgL & 0xFF00) | (this.nes.MMU.getPpuMemVal(tileAddr));
                break;
            case 7:
                bgH <<= 8;
                // this.getTileBitmapHigh();
                var T = (v & 0x7000) >> 12;
                tileAddr += 8;
                // bgH = (bgH & 0xFF00) | (this.nes.Mapper.getCHRRom(tileAddr));
                bgH = (bgH & 0xFF00) | (this.nes.MMU.getPpuMemVal(tileAddr));
                break;
        }
    };

    this.getNameTableByte = function() {
        nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)];
    };

    this.getAttrTableByte = function() {
        at_byte = this.nes.MMU.ppuMem[0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07)];
        // this.at_bits = this.calcPalette(v & 0x1F, (v & 0x3E0) >> 5, at_byte);
        this.at_bits = this.calcPaletteFromAttr(v & 0x1F, (v & 0x3E0) >> 5, at_byte);
        atH = (atH & 0xFF00);
        atL = (atL & 0xFF00);
        if ((this.at_bits & 0x02) >> 1) {
            atH |= 0xFF;
        }
        if (this.at_bits & 0x01) {
            atL |= 0xFF;
        }
        // atH = (atH & 0xFF00) | this.fillAtRegs((this.at_bits & 0x02) >> 1);
        // atL = (atL & 0xFF00) | this.fillAtRegs(this.at_bits & 0x01);
    };

    /* PPU addresses within Pattern tables
    DCBA98 76543210
    ---------------
    0HRRRR CCCCPTTT
    |||||| |||||+++- T: Fine Y offset, the row number within a tile
    |||||| ||||+---- P: Bit plane (0: "lower"; 1: "upper")
    |||||| ++++----- C: Tile column
    ||++++---------- R: Tile row
    |+-------------- H: Half of sprite table (0: "left"; 1: "right")
    +--------------- 0: Pattern table is at $0000-$1FFF
    */

    this.getTileBitmapLow = function() {
        var T = (v & 0x7000) >> 12;
        var addr = (nt_byte * 16) + 0x1000 * (this.backgroundPatTblAddr) + T;
        // bgL = (bgL & 0xFF00) | (this.nes.Mapper.getCHRRom(addr));
        bgL = (bgL & 0xFF00) | (this.nes.MMU.getPpuMemVal(addr));
    };

    this.getTileBitmapHigh = function() {
        var T = (v & 0x7000) >> 12;
        var addr = (nt_byte * 16) + 8 + 0x1000 * (this.backgroundPatTblAddr) + T;
        // bgH = (bgH & 0xFF00) | (this.nes.Mapper.getCHRRom(addr));
        bgH = (bgH & 0xFF00) | (this.nes.MMU.getPpuMemVal(addr));
    };

    //Update Coarse X bits. Ref NesDev Wiki
    this.updateXScroll = function() {
        if (!this.rendering())
            return;
        if ((v & 0x001F) == 31) { // if coarse X == 31
            v &= ~(0x001F); // coarse X = 0
            v ^= 0x0400; // switch horizontal nametable
        }
        else {
            v += 1; // increment coarse X    
            vIncremented = true;
        }
    };
    var vIncremented = false;
    //Update Coarse Y bits. Ref NesDev Wiki
    this.updateYScroll = function() {
        if (!this.rendering())
            return;
        if ((v & 0x7000) != 0x7000) { // if fine Y < 7
            v += 0x1000; // increment fine Y
        }
        else {
            v &= ~(0x7000); // fine Y = 0
            y = (v & 0x03E0) >> 5; // let y = coarse Y
            if (y == 29) {
                y = 0; // coarse Y = 0
                v ^= 0x0800; // switch vertical nametable
            }
            else if (y == 31) {
                y = 0; // coarse Y = 0, nametable not switched
            }
            else {
                y += 1; // increment coarse Y
            }
            v = (v & ~(0x03E0)) | (y << 5); // put coarse Y back into v
        }
    };

    this.copyVScroll = function() {
        if (!this.rendering())
            return;
        v &= ~(0x7BE0);
        v |= this.t & 0x7BE0;
    };

    this.copyHScroll = function() {
        if (!this.rendering())
            return;
        v &= ~(0x041F);
        v |= this.t & 0x041F;
    };

    var tempSprAttr = 0;
    var tempSpritePixel = 0;
    var bgPixelColor = 0;
    var sprite0Drawn = false;
    this.renderPixel = function() {
        bgPixel = 0;
        if (renderBackground == 1) {
            shiftAmt = 0b1000000000000000 >> this.x;
            if (bgShiftH & shiftAmt)
                tempBgHBit = 0b10;
            else tempBgHBit = 0;

            if (bgShiftL & shiftAmt)
                tempBgLBit = 1;
            else tempBgLBit = 0;

            if (!renderBGLeftMost && currentCycle < 8) {
                bgPixel = 0;
            }
            else
                bgPixel = tempBgHBit | tempBgLBit;

            if (atShiftH & shiftAmt)
                tempAtHBit = 0b10;
            else tempAtHBit = 0;

            if (atShiftL & shiftAmt)
                tempAtLBit = 1;
            else tempAtLBit = 0;

            bgShiftH <<= 1;
            bgShiftL <<= 1;
            atShiftH <<= 1;
            atShiftL <<= 1;
        }
        bgPixelColor = this.palette[(tempAtHBit | tempAtLBit) * 4 + bgPixel];
        spritePixel = 0;
        spritePixelColor = 0;

        if (renderSprite == 1) {
            // if (sprLkpTbl[currentCycle]) {
            //     tempSprOpUnit = sprLkpTbl[currentCycle] - 1;
            //     if (shiftCount == 0) {
            //         tempSprAttr = spriteOpUnits[tempSprOpUnit][3];
            //         tempSpritePriority = (tempSprAttr & 0x20); // >> 5;
            //     }
            //     tempSpriteH = (spriteOpUnits[tempSprOpUnit][2] & 0x80) >> 7;
            //     tempSpriteL = (spriteOpUnits[tempSprOpUnit][1] & 0x80) >> 7;
            //     spritePixel = (tempSpriteH << 1) | tempSpriteL;
            //     spritePixelColor = this.palette[16 + (tempSprAttr & 0x03) * 4 + spritePixel];
            //     if (shiftCount < 7) {
            //         spriteOpUnits[tempSprOpUnit][1] <<= 1;
            //         spriteOpUnits[tempSprOpUnit][2] <<= 1;
            //         sprLkpTbl[currentCycle + 1] = tempSprOpUnit + 1;
            //     }
            //     shiftCount++;
            //     if (shiftCount == 8)
            //         shiftCount = 0;
            // }



            //  Check if sprite exists on current pixel being drawn
            // if (sprLkpTbl[currentCycle]) {
            //     //loop for all sprite pixels on current cycle output
            //     //TODO: don't override background non-transparent sprites with foreground transparent sprites
            //     for (var i = 7; i >= 0; i--) {
            //         if (spriteOpUnits[i][4] != 256) {
            //             if ((spriteOpUnits[i][0] <= currentCycle) && (currentCycle < spriteOpUnits[i][0] + 8)) {
            //                 tempSprAttr = spriteOpUnits[i][4];
            //                 tempSpritePriority = (tempSprAttr & 0x20) >> 5;
            //                 var pixelShift = currentCycle - spriteOpUnits[i][0];
            //                 tempSpriteH = (spriteOpUnits[i][3] >> (7 - pixelShift)) & 1;
            //                 tempSpriteL = (spriteOpUnits[i][2] >> (7 - pixelShift)) & 1;
            //                 spritePixel = (tempSpriteH << 1) | tempSpriteL;
            //                 spritePixelColor = this.palette[16 + (tempSprAttr & 0x03) * 4 + spritePixel];
            //             }
            //         }
            //     }
            // }

            if (!renderSpritesLeftMost && currentCycle < 8) {
                spritePixel = 0;
            }
            else {
                if (sprLkpTbl[currentCycle]) {
                    // var t = currentScanline; //Debug
                    //loop for all sprite pixels on current cycle output
                    //TODO: don't override background non-transparent sprites with foreground transparent sprites
                    for (var i = 7; i >= 0; i--) {
                        if (spriteOpUnits[i][4] != 256) {
                            if ((spriteOpUnits[i][0] <= currentCycle) && (currentCycle < spriteOpUnits[i][0] + 8)) {
                                var pixelShift = currentCycle - spriteOpUnits[i][0];
                                tempSpriteH = (spriteOpUnits[i][3] >> (7 - pixelShift)) & 1;
                                tempSpriteL = (spriteOpUnits[i][2] >> (7 - pixelShift)) & 1;
                                tempSpritePixel = (tempSpriteH << 1) | tempSpriteL;
                                if (tempSpritePixel) {
                                    if (i == 0 && sprite0Evaluated && (!sprite0Drawn)) {
                                        sprite0Drawn = true;
                                    }
                                    // else sprite0Drawn = false;
                                    spritePixel = tempSpritePixel;
                                    tempSprAttr = spriteOpUnits[i][4];
                                    tempSpritePriority = (tempSprAttr & 0x20) >> 5;
                                    spritePixelColor = this.palette[16 + (tempSprAttr & 0x03) * 4 + spritePixel];
                                }
                            }
                        }
                    }
                }
            }
        }
        //Priority based output
        if (spritePixel == 0) {
            outputPixel = bgPixelColor;
            if (bgPixel == 0) {
                outputPixel = this.palette[0];
            }
        }
        else if (spritePixel > 0 && bgPixel == 0) {
            outputPixel = spritePixelColor;
        }
        else if (spritePixel > 0 && bgPixel > 0) {
            if (sprite0Drawn) {
                this.ppuStatusBits = this.ppuStatusBits & 0b10111111;
                this.ppuStatusBits = this.ppuStatusBits | 0b01000000;
            }
            if (!tempSpritePriority) {
                outputPixel = spritePixelColor;
            }
            else {
                outputPixel = bgPixelColor;
            }
        }
        if ((renderSprite & renderBackground) == 1) {
            //Render to offscreen buffer
            this.nes.mainDisplay.offscreenBuffer[currentScanline * 256 + currentCycle] = this.paletteColorsRendered[outputPixel];
        }
        else if (renderSprite == 1) {
            this.nes.mainDisplay.offscreenBuffer[currentScanline * 256 + currentCycle] = this.paletteColorsRendered[spritePixelColor];
        }
        else if (renderBackground == 1) {
            this.nes.mainDisplay.offscreenBuffer[currentScanline * 256 + currentCycle] = this.paletteColorsRendered[outputPixel];
        }
    };

    this.getPixelBit = function(word, shiftBit) {
        if (word & (0b1000000000000000 >> shiftBit)) {
            return 1;
        }
        else {
            return 0;
        }
    };

    this.getAtBit = function(byte, shiftBit) {
        byte <<= shiftBit;
        return (byte & 0x80) >> 7;
    };

    this.reloadShiftRegisters = function() {
        bgShiftL = bgL;
        bgShiftH = bgH;
        atShiftH = atH;
        atShiftL = atL;
    };

    this.calcPalette = function(x, y, at_byte) {
        var pal = at_byte >> ((x & 0x01) * 2);
        pal = pal >> ((y & 0x01) * 4);
        return pal & 0x03;
    };

    this.fillAtRegs = function(at_bit) {
        if (at_bit == 1)
            return 0xFF;
        else return 0;
    };

    this.rendering = function() {
        if ((renderBackground == 1) || (renderSprite == 1))
            return true;
        else return false;
    };
}
