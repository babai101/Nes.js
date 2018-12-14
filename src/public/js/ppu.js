'use strict';
export default function ppu(nes) {
    //TODO: Sprite hit left clipping
    this.nes = nes;
    //Render VARS
    var currentScanline = 261; //start from pre-render line
    var currentCycle = 0;
    var currentScanlineBufferIndex = 0;
    var skipFrame = false;
    var offScreenBuffer = new Uint32Array(256 * 240);
    this.nmi_occurred = false;
    this.CHRGrid = [];
    this.BGRCHRGrid = [];
    // this.render = this.renderPixelFast;
    var palette = new Uint8Array(64);
    var basePalette = 0;
    var paletteColorsRendered; // = new Uint32Array();
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

    var bitReversalLookUp = [
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

    var bgShifted = false;
    var bgUpdated = false;

    //PPUCTRL vars
    this.baseNameTblAddr = 0x2000;
    this.vRamAddrInc = 1;
    this.spritePatTblAddr = 0;
    this.backgroundPatTblAddr = 0;
    var spriteSize = 8;
    this.ppuMasterSlave = 'readBackdrop';
    this.nmi_output = false;
    var nmi_output_prev = false;

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
            this.spritePatTblAddr = 1;
        temp = (PPUCTRL >> 4) & 0x01;
        if (temp == 0)
            this.backgroundPatTblAddr = 0;
        else
            this.backgroundPatTblAddr = 1;
        temp = (PPUCTRL >> 5) & 0x01;
        if (temp == 0)
            spriteSize = 8;
        else
            spriteSize = 16;
        temp = (PPUCTRL >> 6) & 0x01;
        if (temp == 0)
            this.ppuMasterSlave = 'readBackdrop';
        else
            this.ppuMasterSlave = 'outputColor';
        temp = (PPUCTRL >> 7) & 0x01;
        if (temp == 0) {
            this.nmi_output = false;
            nmi_output_prev = false;
        }
        else {
            this.nmi_output = true;
            if ((this.ppuStatusBits & 0x80) == 0x80 && !nmi_output_prev) {
                this.nes.CPU.doNMI = true;
                this.nes.CPU.IRQToRun = 2;
            }
            nmi_output_prev = true;
        }


        /*New cycle accurate logic*/
        //Nametable select
        this.t &= ~(0x0C00);
        this.t |= (PPUCTRL & 0x03) << 10;
    };

    //Update PPUMASK status
    this.setPPUMASK = function(PPUMASK) {
        //DEbug 
        // var a = currentCycle;
        // var b = currentScanline;
        var temp;
        temp = PPUMASK & 0x01;
        if (temp == 0)
            this.renderGreyscale = false;
        else
            this.renderGreyscale = true;
        temp = (PPUMASK >> 1) & 0x01;
        if (temp == 0) {
            renderBGLeftMost = false;
            this.render = this.renderPixel;
        }
        else {
            renderBGLeftMost = true;
            this.render = this.renderPixelFast;
        }
        temp = (PPUMASK >> 2) & 0x01;
        if (temp == 0) {
            renderSpritesLeftMost = false;
            this.render = this.renderPixel;
        }
        else {
            renderSpritesLeftMost = true;
            this.render = this.renderPixelFast;
        }
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
            palette[0x00] = value;
            basePalette = value;
        }
        else if (index == 0x00) {
            palette[0x10] = value;
            basePalette = value;
        }
        palette[index] = value;
    };

    this.getPalette = function(index) {
        return palette[index];
    };

    this.initPalette = function() {
        paletteColorsRendered = new Uint32Array(this.paletteColors.length);
        for (var i = 0; i < paletteColorsRendered.length; i++) {
            paletteColorsRendered[i] = 0xFF000000;
        }
        for (var i = 0; i < this.paletteColors.length; i++) {
            paletteColorsRendered[i] = 0xFF000000 | this.paletteColors[i][2] << 16 | this.paletteColors[i][1] << 8 | this.paletteColors[i][0];
        }
    };

    this.getOffScreenBuffer = function() {
        return offScreenBuffer;
    };

    this.initScreenBuffer = function() {
        this.render = this.renderPixelFast;
        this.initPalette();
        for (var i = 0; i < 64; i++) {
            palette[i] = 0;
        }

        this.nes.mainDisplay.initScreenBuffer();
        for (var i = 0; i < 256; i++) {
            sprLkpTbl[i] = 0;
        }
        for (var i = 0; i < 256 * 240; i++) {
            offScreenBuffer[i] = 0xFF000000;
        }
    };
    var sprLkpTbl = new Uint8Array(256);

    this.secOAMInit = function() {
        (secOAM = []).length = 32;
        secOAM.fill(0x100);
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
        shiftAmt = 0,
        bgHShiftAmt = 0,
        bgLShiftAmt = 0;
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
    var ppuStatusReadCycle = -1;
    var suppressNMI = false;
    this.getPPUSTATUS = function() {
        var prevStatus = this.ppuStatusBits;
        //clear PPUSTATUS vblank indicators
        this.ppuStatusBits = this.ppuStatusBits & 0x7F;
        if (currentScanline == 241) {
            ppuStatusReadCycle = currentCycle;
            //simultaneous read to vbl as its set, so suppress NMI
            switch (currentCycle) {
                case 1: //0 
                    prevStatus &= 0x7F;
                    this.nes.CPU.IRQToRun = 0;
                    suppressNMI = true;
                    break;
                case 2: //2
                    this.nes.CPU.IRQToRun = 0;
                    suppressNMI = true;
                    break;
                case 3: //2:
                    this.nes.CPU.IRQToRun = 0;
                    suppressNMI = true;
                    break;
                default:
                    suppressNMI = false;
            }
        }
        else {
            ppuStatusReadCycle = -1;
            // this.w = 0;
        }
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
            if (renderBackground || renderSprite) {
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
            if (renderBackground || renderSprite) {
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
        if (location >= 0x0000 && location <= 0x3EFF) {
            this.PPUDATAReadBuffer = this.nes.MMU.getPpuMemVal(location);
        }
        else {
            returnValue = this.nes.MMU.getPpuMemVal(location);
        }
        return returnValue;
    };

    this.setPPUSCROLL = function(PPUSCROLL) {
        if (this.w == 0) {
            this.t &= ~(0x1F);
            this.t |= PPUSCROLL >> 3;
            this.x = PPUSCROLL & 0x07;
            shiftAmt = 0b1000000000000000 >> this.x;
            bgLShiftAmt = 15 - this.x;
            bgHShiftAmt = 14 - this.x;
            this.w = 1;
            bgShifted = true;
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

    var oddFrameCycleSkipped = 0;
    var sprite0Evaluated = false;
    var checkSprite0Hit = false;

    this.clock = function() {
        if (vIncremented)
            vIncremented = false;
        if (currentScanline < 240) {
            switch (currentCycle) {
                case 0:
                    if (oddFrameCycleSkipped) {
                        nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)]; //this.getNameTableByte();
                        oddFrameCycleSkipped = 0;
                    }
                    currentSpriteOpUnit = 0;
                    this.render();
                    break;
                case 1:
                    this.memoryFetch();
                    this.render();
                    allSpritesFound = false;
                    allSpritesEvaluated = false;
                    sprite0Evaluated = false;
                    secOAMIndex = 0;
                    n = 0, m = 0;
                    break;
                case 256:
                    //sprite 0 hit flag for pixel 254
                    if (sprite0Drawn && currentCycle == sprite0HitTargetCycle) {
                        this.ppuStatusBits = this.ppuStatusBits & 0b10111111;
                        this.ppuStatusBits = this.ppuStatusBits | 0b01000000;
                    }
                    this.memoryFetch();
                    this.updateYScroll(); //FIXME

                    if (renderBackground || renderSprite) {
                        this.evalSprites();
                    }
                    break;
                case 257:
                    // this.reloadShiftRegisters();
                    bgShiftL = bgL;
                    bgShiftH = bgH;
                    atShiftH = atH;
                    atShiftL = atL;
                    this.copyHScroll();
                    checkSprite0Hit = sprite0Evaluated;
                    this.fetchSprites();
                    if (renderBackground || renderSprite)
                        this.OAMADDR = 0;
                    break;
                case 338:
                case 340:
                    nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)]; //this.getNameTableByte();
                    oamReadBuffer = secOAM[0];
                    break;
                case 339:
                    oamReadBuffer = secOAM[0];
                    break;
                default:
                    if (currentCycle < 256) {
                        // this.memoryFetch();
                        switch (currentCycle & (8 - 1)) {
                            // switch (currentCycle % 8) {
                            case 0:
                                bgH <<= 8;
                                var T = (v & 0x7000) >> 12;
                                tileAddr += 8;
                                bgH = (bgH & 0xFF00) | (this.nes.Mapper.getCHRRom(tileAddr));
                                // this.reloadShiftRegisters();
                                bgShiftL = bgL;
                                bgShiftH = bgH;
                                atShiftH = atH;
                                atShiftL = atL;
                                this.updateXScroll();
                                break;
                            case 2:
                                nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)];
                                break;
                            case 4:
                                atH <<= 8;
                                atL <<= 8;
                                at_byte = this.nes.MMU.ppuMem[0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07)];
                                if (((v & 0x3E0) >> 5) & 2)
                                    at_byte >>= 4;
                                if ((v & 0x1F) & 2)
                                    at_byte >>= 2;
                                atH = (atH & 0xFF00);
                                atL = (atL & 0xFF00);
                                if ((at_byte & 0x02) >> 1) {
                                    atH |= 0xFF;
                                }
                                if (at_byte & 0x01) {
                                    atL |= 0xFF;
                                }
                                break;
                            case 6:
                                bgL <<= 8;
                                var T = (v & 0x7000) >> 12;
                                tileAddr = (nt_byte * 16) + 0x1000 * (this.backgroundPatTblAddr) + T;
                                bgL = (bgL & 0xFF00) | (this.nes.Mapper.getCHRRom(tileAddr));
                                break;
                        }
                        this.render();
                        if (currentCycle > 64) {
                            if (renderBackground || renderSprite) {
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
                                            oamReadBuffer = this.nes.MMU.OAM[this.OAMADDR + 4 * n];
                                            spriteInRange = (oamReadBuffer > (currentScanline - spriteSize)) && (oamReadBuffer <= currentScanline);
                                            if (spriteInRange) {
                                                if (n == 0) {
                                                    sprite0Evaluated = true;
                                                }
                                            }
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
                    }
                    else if (currentCycle <= 320) {
                        this.fetchSprites();
                        if (renderBackground || renderSprite)
                            this.OAMADDR = 0;
                    }
                    else if (currentCycle <= 336) {
                        this.memoryFetch();
                        oamReadBuffer = secOAM[0];
                    }
            }
        }
        else if (currentScanline == 241) {
            // this.processVBlankScanlines();
            if (currentCycle == 1) {
                //Set V-Blank
                this.ppuStatusBits = this.ppuStatusBits & 0x7F;
                // if (ppuStatusReadCycle !== 0)
                if (ppuStatusReadCycle !== 1)
                    this.ppuStatusBits = this.ppuStatusBits | 0x80;
                this.nmi_occurred = true;
                ppuStatusReadCycle = -1;
            }
            else if (currentCycle == 3) {
                if (this.nmi_output && !suppressNMI) {
                    this.nes.CPU.doNMI = true;
                    this.nes.CPU.IRQToRun = 1;
                }
                suppressNMI = false;
            }
        }
        else if (currentScanline == 261) {
            // this.processPrerenderScanlines();
            if (currentCycle == 0 && this.nes.CPU.skipFrame) {
                skipFrame = true;
                currentCycle++;
                return false;
            }
            // reload vertical scroll bits
            if (currentCycle >= 1 && currentCycle <= 256) {
                if (currentCycle == 1) {
                    //clear PPUSTATUS vblank indicator
                    this.ppuStatusBits = this.ppuStatusBits & 0x7F;
                    this.nmi_occurred = false;
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
            }
            else if (currentCycle <= 320) {
                if (currentCycle == 257) {
                    this.copyHScroll();
                }
                this.fetchSprites();
                if (renderBackground || renderSprite)
                    this.OAMADDR = 0;

                if (currentCycle >= 280 && currentCycle <= 304) {
                    this.copyVScroll();
                }
            }
            //2 tile data for next scanline
            else if (currentCycle <= 336) {
                this.memoryFetch();
            }
            else if (currentCycle == 339 && this.nes.CPU.oddFrame && renderBackground) {
                currentCycle = 0;
                this.nes.CPU.renderedScanline = currentScanline;
                currentScanline = 0;
                currentScanlineBufferIndex = 0;
                oddFrameCycleSkipped = 1;
                return true;
            }
            else if (currentCycle == 338 || currentCycle == 340)
                nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)]; //this.getNameTableByte(); // this.processPrerenderScanlines();
            if (currentCycle == 0 && this.nes.CPU.skipFrame) {
                skipFrame = true;
                currentCycle++;
                return false;
            }
            // reload vertical scroll bits
            if (currentCycle >= 1 && currentCycle <= 256) {
                if (currentCycle == 1) {
                    //clear PPUSTATUS vblank indicator
                    this.ppuStatusBits = this.ppuStatusBits & 0x7F;
                    this.nmi_occurred = false;
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
            }
            else if (currentCycle <= 320) {
                if (currentCycle == 257) {
                    this.copyHScroll();
                }
                this.fetchSprites();
                if (renderBackground || renderSprite)
                    this.OAMADDR = 0;

                if (currentCycle >= 280 && currentCycle <= 304) {
                    this.copyVScroll();
                }
            }
            //2 tile data for next scanline
            else if (currentCycle <= 336) {
                this.memoryFetch();
            }
            else if (currentCycle == 339 && this.nes.CPU.oddFrame && renderBackground) {
                currentCycle = 0;
                this.nes.CPU.renderedScanline = currentScanline;
                currentScanline = 0;
                currentScanlineBufferIndex = 0;
                oddFrameCycleSkipped = 1;
                return true;
            }
            else if (currentCycle == 338 || currentCycle == 340)
                nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)]; //this.getNameTableByte();
        }

        currentCycle++;
        if (currentCycle == 341) {
            currentCycle = 0;
            this.nes.CPU.renderedScanline = currentScanline;
            if (currentScanline == 260) {
                this.nes.mainDisplay.updateCanvas();
            }
            currentScanline++;
            if (currentScanline == 262) {
                currentScanline = 0;
                currentScanlineBufferIndex = 0;
            }
            return true;
        }
        return false;
    };

    this.processVisibleScanlines = function() {
        switch (currentCycle) {
            case 0:
                if (oddFrameCycleSkipped) {
                    nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)]; //this.getNameTableByte();
                    oddFrameCycleSkipped = 0;
                }
                currentSpriteOpUnit = 0;
                this.render();
                return;
            case 1:
                this.memoryFetch();
                this.render();
                allSpritesFound = false;
                allSpritesEvaluated = false;
                sprite0Evaluated = false;
                secOAMIndex = 0;
                n = 0, m = 0;
                return;
            case 256:
                //sprite 0 hit flag for pixel 254
                if (sprite0Drawn && currentCycle == sprite0HitTargetCycle) {
                    this.ppuStatusBits = this.ppuStatusBits & 0b10111111;
                    this.ppuStatusBits = this.ppuStatusBits | 0b01000000;
                }
                this.memoryFetch();
                this.updateYScroll(); //FIXME

                if (renderBackground || renderSprite) {
                    this.evalSprites();
                }
                return;
            case 257:
                // this.reloadShiftRegisters();
                bgShiftL = bgL;
                bgShiftH = bgH;
                atShiftH = atH;
                atShiftL = atL;
                this.copyHScroll();
                checkSprite0Hit = sprite0Evaluated;
                this.fetchSprites();
                if (renderBackground || renderSprite)
                    this.OAMADDR = 0;
                return;
            case 338:
            case 340:
                nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)]; //this.getNameTableByte();
                oamReadBuffer = secOAM[0];
                return;
            case 339:
                oamReadBuffer = secOAM[0];
                return;
        }

        if (currentCycle < 256) {
            this.memoryFetch();
            this.render();
            if (currentCycle > 64) {
                if (renderBackground || renderSprite) {
                    this.evalSprites();
                }
            }
        }
        else if (currentCycle <= 320) {
            this.fetchSprites();
            if (renderBackground || renderSprite)
                this.OAMADDR = 0;
        }
        else if (currentCycle <= 336) {
            this.memoryFetch();
            oamReadBuffer = secOAM[0];
        }
    };

    this.processVBlankScanlines = function() {
        if (currentCycle == 1) {
            //Set V-Blank
            this.ppuStatusBits = this.ppuStatusBits & 0x7F;
            // if (ppuStatusReadCycle !== 0)
            if (ppuStatusReadCycle !== 1)
                this.ppuStatusBits = this.ppuStatusBits | 0x80;
            this.nmi_occurred = true;
            ppuStatusReadCycle = -1;
        }
        else if (currentCycle == 3) {
            if (this.nmi_output && !suppressNMI) {
                this.nes.CPU.doNMI = true;
                this.nes.CPU.IRQToRun = 1;
            }
            suppressNMI = false;
        }
    };

    this.processPrerenderScanlines = function() {
        if (currentCycle >= 1 && currentCycle <= 256) {
            if (currentCycle == 1) {
                //clear PPUSTATUS vblank indicator
                this.ppuStatusBits = this.ppuStatusBits & 0x7F;
                this.nmi_occurred = false;
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
        }
        else if (currentCycle <= 320) {
            if (currentCycle == 257) {
                this.copyHScroll();
            }
            this.fetchSprites();
            if (renderBackground || renderSprite)
                this.OAMADDR = 0;

            if (currentCycle >= 280 && currentCycle <= 304) {
                this.copyVScroll();
            }
        }
        //2 tile data for next scanline
        else if (currentCycle <= 336) {
            this.memoryFetch();
        }
        else if (currentCycle == 339 && this.nes.CPU.oddFrame && renderBackground) {
            currentCycle = 0;
            this.nes.CPU.renderedScanline = currentScanline;
            currentScanline = 0;
            currentScanlineBufferIndex = 0;
            oddFrameCycleSkipped = 1;
            return true;
        }
        else if (currentCycle == 338 || currentCycle == 340)
            nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)]; //this.getNameTableByte();
    };

    this.evalSprites = function() {
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
                    oamReadBuffer = this.nes.MMU.OAM[this.OAMADDR + 4 * n];
                    spriteInRange = (oamReadBuffer > (currentScanline - spriteSize)) && (oamReadBuffer <= currentScanline);
                    if (spriteInRange) {
                        if (n == 0) {
                            sprite0Evaluated = true;
                        }
                    }
                }
                else {
                    if (spriteInRange) {
                        oamReadBuffer = this.nes.MMU.OAM[4 * n + m];
                    }
                }
            }
        }
    };

    this.clearSecondaryOAM = function() {
        if (currentCycle == 1) {
            this.nes.MMU.secOAMInit();
        }
        secOAMIndex = 0;
    };

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
                //perf
                secOAM[currentSpriteOpUnit * 4 + 2] = 0x100;
                break;
            case 4:
                //X pos
                oamReadBuffer = secOAM[currentSpriteOpUnit * 4 + 3];
                spriteOpUnits[currentSpriteOpUnit][0] = oamReadBuffer;
                if (oamReadBuffer < 256) {
                    for (var i = oamReadBuffer; i < oamReadBuffer + 8; i++) {
                        if (i == 256)
                            break;
                        sprLkpTbl[i] = 1;
                    }
                }
                //perf
                secOAM[currentSpriteOpUnit * 4 + 3] = 0x100;
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
    var tempSpritePatTblAddr = 0;
    var verticalFlipping = false;
    var horizontalFlipping = false;
    this.getSpriteTileBitmapLow = function() {
        tempSpriteOpUnitIndex = currentSpriteOpUnit * 4;

        verticalFlipping = (spriteOpUnits[currentSpriteOpUnit][4] & 0x80) == 0x80;
        horizontalFlipping = (spriteOpUnits[currentSpriteOpUnit][4] & 0x40) == 0x40;

        spriteEffectiveY = currentScanline - secOAM[tempSpriteOpUnitIndex];

        spriteTileNum = secOAM[tempSpriteOpUnitIndex + 1];
        tempSpritePatTblAddr = this.spritePatTblAddr;
        if (spriteSize === 16) {
            spriteTileNum = secOAM[tempSpriteOpUnitIndex + 1] & 0xFE;
            if (verticalFlipping) {
                if (spriteEffectiveY < 8) {
                    spriteTileNum++;
                }
                else {
                    spriteEffectiveY = spriteEffectiveY - 8;
                }
            }
            else {
                if (spriteEffectiveY > 7) {
                    spriteTileNum++;
                    spriteEffectiveY = spriteEffectiveY - 8;
                }
            }
            tempSpritePatTblAddr = secOAM[tempSpriteOpUnitIndex + 1] & 0x01;
        }

        //vertical flipping
        if (verticalFlipping) {
            spriteEffectiveY = Math.abs(spriteEffectiveY - 7);
        }

        spriteTileAddr = (spriteTileNum * 16) + spriteEffectiveY + 0x1000 * tempSpritePatTblAddr;
        spriteOpUnits[currentSpriteOpUnit][2] = this.nes.Mapper.getCHRRom(spriteTileAddr);
        //horizontal flipping
        if (horizontalFlipping) {
            spriteOpUnits[currentSpriteOpUnit][2] = bitReversalLookUp[spriteOpUnits[currentSpriteOpUnit][2]];
        }
        //perf
        secOAM[tempSpriteOpUnitIndex] = 0x100;
        secOAM[tempSpriteOpUnitIndex + 1] = 0x100;
    };


    this.getSpriteTileBitmapHigh = function() {
        spriteTileAddr += 8;
        spriteOpUnits[currentSpriteOpUnit][3] = this.nes.Mapper.getCHRRom(spriteTileAddr);
        if (horizontalFlipping) {
            spriteOpUnits[currentSpriteOpUnit][3] = bitReversalLookUp[spriteOpUnits[currentSpriteOpUnit][3]];
        }
    };

    var tileAddr = 0;
    this.memoryFetch = function() {
        switch (currentCycle % 8) {
            // switch ((currentCycle - 1) & 0x07) {
            case 0:
                bgH <<= 8;
                var T = (v & 0x7000) >> 12;
                tileAddr += 8;
                bgH = (bgH & 0xFF00) | (this.nes.Mapper.getCHRRom(tileAddr));
                // this.reloadShiftRegisters();
                bgShiftL = bgL;
                bgShiftH = bgH;
                atShiftH = atH;
                atShiftL = atL;
                this.updateXScroll();
                break;
            case 2:
                nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)];
                break;
            case 4:
                atH <<= 8;
                atL <<= 8;
                at_byte = this.nes.MMU.ppuMem[0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07)];
                if (((v & 0x3E0) >> 5) & 2)
                    at_byte >>= 4;
                if ((v & 0x1F) & 2)
                    at_byte >>= 2;
                atH = (atH & 0xFF00);
                atL = (atL & 0xFF00);
                if ((at_byte & 0x02) >> 1) {
                    atH |= 0xFF;
                }
                if (at_byte & 0x01) {
                    atL |= 0xFF;
                }
                break;
            case 6:
                bgL <<= 8;
                var T = (v & 0x7000) >> 12;
                tileAddr = (nt_byte * 16) + 0x1000 * (this.backgroundPatTblAddr) + T;
                bgL = (bgL & 0xFF00) | (this.nes.Mapper.getCHRRom(tileAddr));
                break;
        }
    };

    this.getNameTableByte = function() {
        nt_byte = this.nes.MMU.ppuMem[0x2000 | (v & 0x0FFF)];
    };

    this.getAttrTableByte = function() {
        at_byte = this.nes.MMU.ppuMem[0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07)];
        this.at_bits = this.calcPaletteFromAttr(v & 0x1F, (v & 0x3E0) >> 5, at_byte);
        atH = (atH & 0xFF00);
        atL = (atL & 0xFF00);
        if ((this.at_bits & 0x02) >> 1) {
            atH |= 0xFF;
        }
        if (this.at_bits & 0x01) {
            atL |= 0xFF;
        }
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
        bgL = (bgL & 0xFF00) | (this.nes.Mapper.getCHRRom(addr));
    };

    this.getTileBitmapHigh = function() {
        var T = (v & 0x7000) >> 12;
        var addr = (nt_byte * 16) + 8 + 0x1000 * (this.backgroundPatTblAddr) + T;
        bgH = (bgH & 0xFF00) | (this.nes.Mapper.getCHRRom(addr));
    };

    //Update Coarse X bits. Ref NesDev Wiki
    this.updateXScroll = function() {
        if (renderBackground || renderSprite) {
            if ((v & 0x001F) == 31) { // if coarse X == 31
                v &= ~(0x001F); // coarse X = 0
                v ^= 0x0400; // switch horizontal nametable
            }
            else {
                v += 1; // increment coarse X    
                vIncremented = true;
            }
        }
    };
    var vIncremented = false;
    //Update Coarse Y bits. Ref NesDev Wiki
    this.updateYScroll = function() {
        if (renderBackground || renderSprite) {
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
        }
    };

    this.copyVScroll = function() {
        if (renderBackground || renderSprite) {
            v &= ~(0x7BE0);
            v |= this.t & 0x7BE0;
            bgUpdated = true;
        }
    };

    this.copyHScroll = function() {
        if (renderBackground || renderSprite) {
            v &= ~(0x041F);
            v |= this.t & 0x041F;
        }
    };

    var tempSprAttr = 0;
    var tempSpritePixel = 0;
    var bgPixelColor = 0;
    var sprite0Drawn = false;
    var sprite0DrawnPrev = false;
    var sprite0HitTargetScanline = 0;
    var sprite0HitTargetCycle = 0;
    this.renderPixel = function() {
        bgPixel,
        bgPixelColor = 0;
        if (renderBackground) {
            if (currentCycle < 8) {
                bgPixel = 0;
            }
            else {
                tempBgHBit = (bgShiftH & shiftAmt) >> bgHShiftAmt;
                tempBgLBit = (bgShiftL & shiftAmt) >> bgLShiftAmt;

                bgPixel = tempBgHBit | tempBgLBit;

                tempAtHBit = (atShiftH & shiftAmt) >> bgHShiftAmt;
                tempAtLBit = (atShiftL & shiftAmt) >> bgLShiftAmt;

                // bgPixelColor = palette[(tempAtHBit | tempAtLBit) * 4 + bgPixel];
            }
            bgShiftH <<= 1;
            bgShiftL <<= 1;
            atShiftH <<= 1;
            atShiftL <<= 1;
        }

        spritePixel = 0;
        spritePixelColor = 0;

        if (renderSprite) {
            if (currentCycle < 8) {
                spritePixel = 0;
            }
            else {
                if (sprLkpTbl[currentCycle]) {
                    //loop for all sprite pixels on current cycle output
                    //TODO: sprite hit logic for large sprites
                    for (var i = 7; i >= 0; i--) {
                        if (spriteOpUnits[i][4] != 256) {
                            var y = currentCycle - spriteOpUnits[i][0];
                            if (y >= 0 && y < 8) {
                                tempSpriteH = (spriteOpUnits[i][3] >> (7 - y)) & 1;
                                tempSpriteL = (spriteOpUnits[i][2] >> (7 - y)) & 1;
                                tempSpritePixel = (tempSpriteH << 1) | tempSpriteL;
                                if (tempSpritePixel) {
                                    if ((!sprite0Drawn) && (i == 0) && checkSprite0Hit && (renderBackground == 1)) {
                                        if (currentCycle != 255) {
                                            if (bgPixel > 0) {
                                                sprite0Drawn = true;
                                                sprite0DrawnPrev = true;
                                                sprite0HitTargetCycle = currentCycle + 2;
                                            }
                                        }
                                    }
                                    spritePixel = tempSpritePixel;
                                    tempSprAttr = spriteOpUnits[i][4];
                                    tempSpritePriority = (tempSprAttr & 0x20) >> 5;
                                    spritePixelColor = palette[16 + (tempSprAttr & 0x03) * 4 + spritePixel];
                                }
                            }
                        }
                    }
                    sprLkpTbl[currentCycle] = 0;
                }
            }
        }
        //Priority based output
        if (spritePixel == 0) {
            if (bgPixel == 0) {
                outputPixel = basePalette; //this.palette[0];
            }
            else
                outputPixel = palette[(tempAtHBit | tempAtLBit) * 4 + bgPixel]; //bgPixelColor;
        }
        else if (spritePixel > 0 && bgPixel == 0) {
            outputPixel = spritePixelColor;
        }
        else if (spritePixel > 0 && bgPixel > 0) {
            if (!tempSpritePriority) {
                outputPixel = spritePixelColor;
            }
            else {
                outputPixel = palette[(tempAtHBit | tempAtLBit) * 4 + bgPixel]; //bgPixelColor;
            }
        }
        if (sprite0Drawn && currentCycle == sprite0HitTargetCycle) {
            sprite0HitTargetScanline = currentScanline;
            this.ppuStatusBits = this.ppuStatusBits & 0b10111111;
            this.ppuStatusBits = this.ppuStatusBits | 0b01000000;
        }
        if (this.renderGreyscale)
            outputPixel &= 0x30;
        if ((renderSprite & renderBackground) == 1) {
            //Render to offscreen buffer
            offScreenBuffer[currentScanlineBufferIndex] = paletteColorsRendered[outputPixel];
        }
        else if (renderSprite == 1) {
            offScreenBuffer[currentScanlineBufferIndex] = paletteColorsRendered[spritePixelColor];
        }
        else if (renderBackground == 1) {
            offScreenBuffer[currentScanlineBufferIndex] = paletteColorsRendered[outputPixel];
        }
        currentScanlineBufferIndex++;
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

    this.rendering = function() {
        if ((renderBackground == 1) || (renderSprite == 1))
            return true;
        else return false;
    };


    var bgChanged = false;

    this.renderPixelFast = function() {
        bgPixel,
        bgPixelColor = 0;
        if (renderBackground) {

            tempBgHBit = (bgShiftH & shiftAmt) >> bgHShiftAmt;
            tempBgLBit = (bgShiftL & shiftAmt) >> bgLShiftAmt;

            bgPixel = tempBgHBit | tempBgLBit;

            tempAtHBit = (atShiftH & shiftAmt) >> bgHShiftAmt;
            tempAtLBit = (atShiftL & shiftAmt) >> bgLShiftAmt;

            // bgPixelColor = palette[(tempAtHBit | tempAtLBit) * 4 + bgPixel];
            bgShiftH <<= 1;
            bgShiftL <<= 1;
            atShiftH <<= 1;
            atShiftL <<= 1;
        }

        spritePixel = 0;
        spritePixelColor = 0;

        if (renderSprite) {
            if (sprLkpTbl[currentCycle]) {
                //loop for all sprite pixels on current cycle output
                //TODO: sprite hit logic for large sprites
                for (var i = 7; i >= 0; i--) {
                    if (spriteOpUnits[i][4] != 256) {
                        var y = currentCycle - spriteOpUnits[i][0];
                        if (y >= 0 && y < 8) {
                            tempSpriteH = (spriteOpUnits[i][3] >> (7 - y)) & 1;
                            tempSpriteL = (spriteOpUnits[i][2] >> (7 - y)) & 1;
                            tempSpritePixel = (tempSpriteH << 1) | tempSpriteL;
                            if (tempSpritePixel) {
                                if ((!sprite0Drawn) && (i == 0) && checkSprite0Hit && (renderBackground == 1)) {
                                    if (currentCycle != 255) {
                                        if (bgPixel > 0) {
                                            sprite0Drawn = true;
                                            sprite0DrawnPrev = true;
                                            sprite0HitTargetCycle = currentCycle + 2;
                                        }
                                    }
                                }
                                spritePixel = tempSpritePixel;
                                tempSprAttr = spriteOpUnits[i][4];
                                tempSpritePriority = (tempSprAttr & 0x20) >> 5;
                                spritePixelColor = palette[16 + (tempSprAttr & 0x03) * 4 + spritePixel];
                            }
                        }
                    }
                }
                sprLkpTbl[currentCycle] = 0;
            }
        }
        //Priority based output
        if (spritePixel == 0) {
            if (bgPixel == 0) {
                outputPixel = basePalette; //this.palette[0];
            }
            else outputPixel = palette[(tempAtHBit | tempAtLBit) * 4 + bgPixel]; //bgPixelColor;
        }
        else if (spritePixel > 0 && bgPixel == 0) {
            outputPixel = spritePixelColor;
        }
        else if (spritePixel > 0 && bgPixel > 0) {
            if (!tempSpritePriority) {
                outputPixel = spritePixelColor;
            }
            else {
                outputPixel = palette[(tempAtHBit | tempAtLBit) * 4 + bgPixel]; //bgPixelColor;
            }
        }
        if (sprite0Drawn && currentCycle == sprite0HitTargetCycle) {
            sprite0HitTargetScanline = currentScanline;
            this.ppuStatusBits = this.ppuStatusBits & 0b10111111;
            this.ppuStatusBits = this.ppuStatusBits | 0b01000000;
        }
        if (this.renderGreyscale)
            outputPixel &= 0x30;
        if ((renderSprite & renderBackground) == 1) {
            //Render to offscreen buffer
            offScreenBuffer[currentScanlineBufferIndex] = paletteColorsRendered[outputPixel];
        }
        else if (renderSprite == 1) {
            offScreenBuffer[currentScanlineBufferIndex] = paletteColorsRendered[spritePixelColor];
        }
        else if (renderBackground == 1) {
            offScreenBuffer[currentScanlineBufferIndex] = paletteColorsRendered[outputPixel];
        }
        currentScanlineBufferIndex++;
    };
}
