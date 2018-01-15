//Memory Management Unit to synchronize memory access between CPU and PPU

function mmu(PPU) {
    this.cpuMem = new Uint8Array(65536);
    this.ppuMem = new Uint8Array(16384);
    this.nameTableMirroring = '';
    this.startAddress = 0xFFFC;
    this.ppuRegReadFlag = false;
    this.ppuRegWriteFlag = false;
    this.ppuRegObj = {
        PPUCTRL: 0x00,
        PPUMASK: 0x00,
        PPUSTATUS: 0x00,
        OAMADDR: 0x00,
        OAMDATA: 0x00,
        PPUSCROLL: 0x00,
        PPUADDR: 0x00,
        PPUDATA: 0x00,
        OAMDMA: 0x00
    };
    this.PPUDATAReadBuffer = 0;
    this.PPUCTRLwritten = false;
    this.PPUMASKwritten = false;
    this.OAMADDRwritten = false;
    this.OAMDATAwritten = false;
    this.OAMDMAwritten = false;
    this.PPUSCROLLwritten = false;
    this.PPUADDRwritten = false;
    this.PPUDATAwritten = false;
    this.PPUSTATUSread = false;
    this.PPUADDRFirstWrite = true;
    this.PPUSCROLLFirstWrite == true;
    this.enableNMIGen = false;
    this.controllerStrobed = false;
    this.controllerLatched = false;
    this.latchCounter = 0;
    this.lsbLastWritePPU = 0;
    this.PPUOAM = [];
    this.CHRGrid = [];
    this.BGRCHRGrid = [];
    this.spriteGrid = [];
    this.spriteTiles = [];
    this.OAM = [];
    this.usesCHRRam = false;
    
    //button states
    this.startBtnState = 0;
    this.selectBtnState = 0;
    this.upBtnState = 0;
    this.downBtnState = 0;
    this.aBtnState = 0;
    this.bBtnState = 0;
    this.leftBtnState = 0;
    this.rightBtnState = 0;
    
    this.OAMInit = function() {
        for (var i = 0; i < 64; i++) {
            this.OAM.push(0xFF);
            this.OAM.push(0x00);
            this.OAM.push(0x00);
            this.OAM.push(0xFF);
        }
    };

    this.getCpuMemVal = function(location) {
        location = location & 0xFFFF;
        var temp;
        if (location >= 0x800 && location <= 0x1FFF) {
            temp = location % 0x800;
            return this.cpuMem[temp];
        }
        else if (location >= 0x2000 && location <= 0x2007) {
            return this.getPPUReg(location);
        }
        else if (location >= 0x2008 && location <= 0x3FFF) {
            temp = location - 0x2000;
            temp = temp % 8;
            return this.getPPUReg(0x2000 + temp);
        }
        else if (location >= 0x4000 && location <= 0x4013) {
            return this.getAPUReg(location);
        }
        else if (location == 0x4016) {
            var btnStates = 0;
            if (this.controllerStrobed) {
                //While strobed Return button A status here 
                return 0;
            }
            else if (this.controllerLatched) {
                switch (this.latchCounter) {
                    //button A
                    case 0:
                        btnStates = this.aBtnState;
                        break;
                    //button B
                    case 1: 
                        btnStates = this.bBtnState;
                        break;
                    //button Select
                    case 2:
                        btnStates =  this.selectBtnState;
                        break;
                    //button Start
                    case 3:
                        btnStates = this.startBtnState;
                        break;
                    //button Up
                    case 4: 
                        btnStates = this.upBtnState;
                        break;
                    //button Down
                    case 5:
                        btnStates = this.downBtnState;
                        break;
                    //button Left
                    case 6:
                        btnStates = this.leftBtnState;
                        break;
                    //button Right
                    case 7: 
                        btnStates = this.rightBtnState;
                        break;
                }
                this.latchCounter++;
                if(this.latchCounter >= 8) {
                    this.latchCounter = 0;
                    this.controllerLatched = false;
                }
                return btnStates | 0x40;
            }
            else if(!this.controllerLatched) {
                return 0x40 | 1;
            }
        }
        else if (location == 0x4017) {
            return 0;
        }
        else {
            this.ppuRegWriteFlag = false;
            this.ppuRegReadFlag = false;
            return this.cpuMem[location];
        }

    };

    this.setCpuMemVal = function(location, value) {
        var temp;
        if (location >= 0x800 && location <= 0x1FFF) {
            temp = location % 0x800;
            var temp2 = this.cpuMem[temp];
            this.cpuMem[temp] = value;
            return temp2;
        }
        else if ((location >= 0x2000 && location <= 0x2007) || (location == 0x4014)) {
            return this.setPPUReg(location, value);
        }
        else if (location >= 0x2008 && location <= 0x3FFF) {
            temp = location - 0x2008;
            temp = temp % 8;
            return this.setPPUReg((0x2000 + temp), value);
        }
        // else if (location == 0x4014)
        //     return 0;
        else if (location >= 0x4000 && location <= 0x4015) {
            return this.setAPUReg(location, value);
        }
        else if (location == 0x4016) {
            if(value == 1) {
                this.controllerStrobed = true;
                this.controllerLatched = false;
            }
            else if ((value == 0) && this.controllerStrobed) {
                this.controllerStrobed = false;
                this.controllerLatched = true;
            }
            return 0;
        }
        else if (location == 0x4017) {
            return 0;
        }
        else {
            if (location >= 0x8000 && location <= 0xFFFF)
                return 0;
            temp = this.cpuMem[location];
            this.cpuMem[location] = value;
            this.ppuRegWriteFlag = false;
            this.ppuRegReadFlag = false;
            return temp;
        }
    };

    this.getPpuMemVal = function(location) {
        return this.ppuMem[location];
    };

    this.setPpuMemVal = function(location, value) {
        if (location >= 0x3000 && location <= 0x3EFF) {
            location = location - 0x1000;
        }
        if (location >= 0x3F00 && location <= 0x3F1F) {
            location = location - 0x3F00;
            this.setPPUPalette(location, value);
            return;
        }
        else if (location >= 0x3F20 && location <= 0x3FFF) {
            location = location - 0x3F1F;
            this.setPPUPalette(location, value);
            return;
        }
        else if (this.nameTableMirroring == 'vertical') { //Vertical mirroring 
            if (location >= 0x2000 && location < 0x2400) {
                this.ppuMem[location] = value;
                this.ppuMem[location + 0x800] = value;
            }
            else if (location >= 0x2400 && location < 0x2800) {
                this.ppuMem[location] = value;
                this.ppuMem[location + 0x800] = value;
            }
            else if (location >= 0x2800 && location < 0x2C00) {
                this.ppuMem[location] = value;
                this.ppuMem[location - 0x800] = value;
            }
            else if (location >= 0x2C00 && location < 0x3000) {
                this.ppuMem[location] = value;
                this.ppuMem[location - 0x800] = value;
            }
        }
        else if (this.nameTableMirroring == 'horizontal') { //horizontal mirroring
            if (location >= 0x2000 && location < 0x2400) {
                this.ppuMem[location] = value;
                this.ppuMem[location + 0x400] = value;
            }
            else if (location >= 0x2800 && location < 0x2C00) {
                this.ppuMem[location] = value;
                this.ppuMem[location + 0x400] = value;
            }
            else if (location >= 0x2400 && location < 0x2800) {
                this.ppuMem[location] = value;
                this.ppuMem[location - 0x400] = value;
            }
            else if (location >= 0x2C00 && location < 0x3000) {
                this.ppuMem[location] = value;
                this.ppuMem[location - 0x400] = value;
            }
        }
        else
            this.ppuMem[location] = value;
    };



    this.setPPUPalette = function(location, value) {
        PPU.setPalette(location, value);
    };

    this.getPPUReg = function(location) {
        this.ppuRegReadFlag = true;
        switch (location) {
            case 0x2000:
                return 0;
            case 0x2001:
                return 0;
                //PPUSTATUS
            case 0x2002:
                this.PPUSTATUSread = false;
                this.ppuRegObj.PPUADDR = 0x00;
                this.ppuRegObj.PPUSCROLL = 0x00;
                this.PPUADDRFirstWrite = true;
                this.PPUSCROLLFirstWrite = true;
                var temp = PPU.getPPUSTATUS() & 0xF0;
                temp = temp | (this.lsbLastWritePPU & 0x0F);
                return temp;
            case 0x2003:
                break;
                //OAMDATA
            case 0x2004:
                if (PPU.currentScanline == 261 || (PPU.currentScanline >= 0 && PPU.currentScanline < 240)) {
                    return;
                }
                else {
                    return this.OAM[this.ppuRegObj.OAMADDR];
                }
            case 0x2005:
                break;
            case 0x2006:
                break;
                //PPUDATA
            case 0x2007:
                var temp = this.getPPUDATA(this.ppuRegObj.PPUADDR);
                if (PPU.vRamAddrInc == 'across') {
                    this.ppuRegObj.PPUADDR += 1;
                }
                else if (PPU.vRamAddrInc == 'down') {
                    this.ppuRegObj.PPUADDR += 32;
                }
                return temp;
        }
    };

    this.setPPUReg = function(location, value) {
        this.ppuRegWriteFlag = true;
        this.lsbLastWritePPU = value;
        switch (location) {
            //PPUCTRL
            case 0x2000:
                this.ppuRegObj.PPUCTRL = value;
                PPU.setPPUCTRL(this.ppuRegObj.PPUCTRL);
                var temp = (this.ppuRegObj.PPUCTRL >> 7) & 0x01;
                if (temp == 0)
                    this.enableNMIGen = false;
                else
                    this.enableNMIGen = true;
                this.PPUCTRLwritten = true;
                return 0x2000;
                //PPUMASK    
            case 0x2001:
                this.ppuRegObj.PPUMASK = value;
                PPU.setPPUMASK(this.ppuRegObj.PPUMASK);
                this.PPUMASKwritten = true;
                return 0x2001;
            case 0x2002:
                break;
                //OAMADDR
            case 0x2003:
                this.setOAMADDR(value);
                this.OAMADDRwritten = true;
                return 0x2003;
                //OAMDATA
            case 0x2004:
                this.setOAMDATA(value);
                // if (PPU.currentScanline == 261 || (PPU.currentScanline >= 0 && PPU.currentScanline < 240)) {

                // }
                // else {
                //     this.setOAMDATA(value);
                //     this.setOAMADDR(this.ppuRegObj.OAMADDR + 1);
                //     this.OAMDATAwritten = true;
                // }
                return 0x2004;
                //PPUSCROLL
            case 0x2005:
                this.setPPUSCROLL(value);
                this.PPUSCROLLwritten = true;
                return 0x2005;
                //PPUADDR
            case 0x2006:
                this.setPPUADDR(value);
                this.PPUADDRwritten = true;
                return 0x2006;
                //PPUDATA
            case 0x2007:
                this.setPPUDATA(value);
                if (PPU.vRamAddrInc == 'across') {
                    this.ppuRegObj.PPUADDR += 1;
                }
                else if (PPU.vRamAddrInc == 'down') {
                    this.ppuRegObj.PPUADDR += 32;
                }
                this.PPUDATAwritten = true;
                return 0x2007;
            case 0x4014:
                this.ppuRegObj.OAMDMA = value;
                this.setOAMDMA(this.ppuRegObj.OAMDMA);
                this.OAMDMAwritten = true;
                return 0x4014;
        }
    };

    this.reRenderCHR = function() {
        if(this.usesCHRRam) {
            this.copyCHRToGrid();
            this.copyBGRCHRToGrid();
            PPU.CHRGrid = this.CHRGrid;
            PPU.BGRCHRGrid = this.BGRCHRGrid;
        }
    };

    this.getAPUReg = function(location) {
        //stub;
        return 0;
    };

    this.setAPUReg = function(location, value) {
        //stub;
        return 0;
    };

    this.getPPURegObj = function() {
        return this.ppuRegObj;
    };

    this.getOAM = function() {
        return this.OAM;
    };

    this.getNameTable = function() {
        return this.ppuMem;
    };

    this.getAttrTable = function() {
        return this.ppuMem;
    };

    this.setOAMDATA = function(value) {
        if (PPU.currentScanline == 261 || (PPU.currentScanline >= 0 && PPU.currentScanline < 240)) {

        }
        else {
            this.OAM[this.ppuRegObj.OAMADDR] = value;
            this.setOAMADDR(this.ppuRegObj.OAMADDR + 1);
        }
        this.OAMDATAwritten = true;
    };

    this.setOAMADDR = function(value) {
        this.ppuRegObj.OAMADDR = value;
        PPU.setOAMADDR(this.ppuRegObj.OAMADDR);
    };

    //OAM DMA copying
    this.startOAMDMACopy = function() {
        if ( /*PPU.vBlankStarted*/ true) {
            for (var i = 0; i < 256; i++) {
                // this.OAM[i] = this.getCpuMemVal((this.OAMDMA << 8) + i);
                // this.OAM[i] = this.getCpuMemVal((this.OAMDMA * 0x100) + i);
                // this.setOAMDATA(this.getCpuMemVal((this.OAMDMA * 0x100) + i));
                this.setOAMDATA(this.cpuMem[(this.OAMDMA * 0x100) + i]);
            }
        }
    };

    this.setOAMDMA = function(OAMDMA) {
        this.OAMDMA = OAMDMA;
        this.startOAMDMACopy();
    };

    this.setPPUADDR = function(value) {
        if (this.PPUADDRFirstWrite) {
            this.ppuRegObj.PPUADDR = value;
            this.ppuRegObj.PPUADDR = this.ppuRegObj.PPUADDR << 8;
            this.PPUADDRFirstWrite = false;
        }
        else {
            this.ppuRegObj.PPUADDR = this.ppuRegObj.PPUADDR | value;
            if (this.ppuRegObj.PPUADDR > 0x3FFF)
                this.ppuRegObj.PPUADDR = this.ppuRegObj.PPUADDR - 0x3FFF;
            this.PPUADDRFirstWrite = true;
        }
    };

    this.setPPUSCROLL = function(value) {
        this.ppuRegObj.PPUSCROLL = value;
        if (this.PPUADDRFirstWrite) {
        // if (this.PPUSCROLLFirstWrite) {
            PPU.xScroll = value;
            // this.PPUSCROLLFirstWrite = false;
            this.PPUADDRFirstWrite = false;
        }
        else {
            PPU.yScroll = value;
            // this.PPUSCROLLFirstWrite = true;
            this.PPUADDRFirstWrite = true;
        }
    };

    this.getPPUDATA = function(location) {
        var returnValue = this.PPUDATAReadBuffer;
        if (location >= 0x0000 && location < 0x3EFF) {
            this.PPUDATAReadBuffer = this.getPpuMemVal(location);
        }
        else {
            returnValue = this.getPpuMemVal(location);
        }
        return returnValue;
    };
    this.setPPUDATA = function(value) {
        this.setPpuMemVal(this.ppuRegObj.PPUADDR, value);
    };

    this.copyCHRToGrid = function() {
        this.CHRGrid = [];
        var tileLow, tileHigh, mask, lowVal, highVal, compoundVal, compoundTileRow, spriteTile;
        for (var i = 0; i < 4096; i += 16) {
            tileLow = [];
            tileHigh = [];
            for (var j = 0; j < 8; j++) {
                tileLow.push(this.getPpuMemVal(i + j));
            }
            for (var k = 8; k < 16; k++) {
                tileHigh.push(this.getPpuMemVal(i + k));
            }
            spriteTile = [];
            for (var l = 0; l < 8; l++) {
                compoundTileRow = [];
                for (var k = 0; k < 8; k++) {
                    mask = 0b00000001 << (7 - k);
                    lowVal = mask & tileLow[l];
                    highVal = mask & tileHigh[l];
                    lowVal = lowVal >> (7 - k);
                    highVal = highVal >> (7 - k);
                    compoundVal = (highVal << 1) | lowVal;
                    compoundTileRow.push(compoundVal);
                }
                spriteTile.push(compoundTileRow);
            }
            this.CHRGrid.push(spriteTile);
        }
        PPU.CHRGrid = this.CHRGrid;
    };

    this.copyBGRCHRToGrid = function() {
        this.BGRCHRGrid = [];
        var tileLow, tileHigh, mask, lowVal, highVal, compoundVal, compoundTileRow, bgrTile;
        for (var i = 4096; i < 8192; i += 16) {
            tileLow = [];
            tileHigh = [];
            for (var j = 0; j < 8; j++) {
                tileLow.push(this.getPpuMemVal(i + j));
            }
            for (var k = 8; k < 16; k++) {
                tileHigh.push(this.getPpuMemVal(i + k));
            }
            bgrTile = [];
            for (var l = 0; l < 8; l++) {
                compoundTileRow = [];
                for (var k = 0; k < 8; k++) {
                    mask = 0b00000001 << (7 - k);
                    lowVal = mask & tileLow[l];
                    highVal = mask & tileHigh[l];
                    lowVal = lowVal >> (7 - k);
                    highVal = highVal >> (7 - k);
                    compoundVal = (highVal << 1) | lowVal;
                    compoundTileRow.push(compoundVal);
                }
                bgrTile.push(compoundTileRow);
            }
            this.BGRCHRGrid.push(bgrTile);
        }
        PPU.BGRCHRGrid = this.BGRCHRGrid;
    };
}
