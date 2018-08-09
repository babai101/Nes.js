//Memory Management Unit to synchronize memory access between CPU and PPU
'use strict';
export default function mmu(nes) {
    this.nes = nes;
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
    this.PPUCTRLwritten = false;
    this.PPUMASKwritten = false;
    this.OAMDATAwritten = false;
    this.OAMDMAwritten = false;
    this.PPUSCROLLwritten = false;
    this.PPUADDRwritten = false;
    this.PPUDATAwritten = false;
    this.PPUSTATUSread = false;
    this.PPUADDRFirstWrite = true;
    this.PPUSCROLLFirstWrite == true;
    this.enableNMIGen = false;
    var controllerStrobed = false;
    this.controllerLatched = false;
    this.latchCounter = 0;
    this.lsbLastWritePPU = 0;
    this.PPUOAM = [];
    this.CHRGrid = [];
    this.BGRCHRGrid = [];
    this.spriteGrid = [];
    this.spriteTiles = [];
    this.OAM = [];
    this.secOAM = [];
    this.chrRamWritten = false;
    var ppuOpenBus = 0;
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

    this.secOAMInit = function() {
        (this.secOAM = []).length = 32;
        this.secOAM.fill(0x100);
    };

    this.getCpuMemVal = function(location) {
        location = location & 0xFFFF;
        var temp;
        //RAM
        if (location >= 0 && location < 0x800) {
            return this.cpuMem[location];
        }
        //RAM mirrors
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
        else if (location == 0x4015) {
            return this.getAPUReg(location);
        }
        else if (location == 0x4016) {
            var btnStates = 0;
            if (controllerStrobed) {
                //While strobed Return button A status here 
                return 0;
            }
            if (this.controllerLatched) {
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
                        btnStates = this.selectBtnState;
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
                if (this.latchCounter >= 8) {
                    this.latchCounter = 0;
                    this.controllerLatched = false;
                }
                return btnStates | 0x40;
            }
            else if (!this.controllerLatched) {
                return 0x40 | 1;
            }
        }
        else if (location == 0x4017) {
            return 0;
        }
        else if (location >= 0x8000 && location <= 0xFFFF) {
            return this.nes.Mapper.getPRGRom(location);
        }
        else {
            // alert('incorrect location to get from!');
            return this.cpuMem[location];
        }

    };

    this.setCpuMemVal = function(location, value) {
        var temp;
        //RAM 
        if (location >= 0 && location < 0x800) {
            temp = this.cpuMem[location];
            this.cpuMem[location] = value;
            return temp;
        }

        //RAM mirrors
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
        else if (location >= 0x4000 && location <= 0x4015) {
            return this.setAPUReg(location, value);
        }
        else if (location == 0x4016) {
            if (value == 1) {
                controllerStrobed = true;
                this.controllerLatched = false;
            }
            else if ((value == 0) && controllerStrobed) {
                controllerStrobed = false;
                this.controllerLatched = true;
            }
            return 0;
        }
        else if (location == 0x4017) {
            return this.setAPUReg(location, value);
        }
        else {
            if (location >= 0x8000 && location <= 0xFFFF) {
                this.nes.Mapper.setBank(value);
                return 0;
            }
            // alert("incorrect location to put data in!");
        }
    };

    this.getPpuMemVal = function(location) {
        if (location >= 0 && location < 0x2000) {
            return this.nes.Mapper.getCHRRom(location);
        }
        else if (location >= 0x3F00 && location <= 0x3F1F) {
            this.nes.PPU.PPUDATAReadBuffer = this.ppuMem[location - 0x3F00];
            location = location - 0x3F00;
            return this.getPPUPalette(location);
        }
        else if (location >= 0x3F20 && location <= 0x3FFF) {
            this.nes.PPU.PPUDATAReadBuffer = this.ppuMem[location - 0x3F20];
            location = location % 0x20;
            return this.getPPUPalette(location);
        }
        return this.ppuMem[location];
    };

    this.setPpuMemVal = function(location, value) {
        if (location >= 0 && location < 0x2000) {
            this.ppuMem[location] = value;
            this.nes.Mapper.setCHRRom(location, value);
            this.chrRamWritten = true;
            return;
        }
        if (location >= 0x3000 && location <= 0x3EFF) {
            location = location - 0x1000;
        }
        if (location >= 0x3F00 && location <= 0x3F1F) {
            location = location - 0x3F00;
            this.setPPUPalette(location, value);
            return;
        }
        else if (location >= 0x3F20 && location <= 0x3FFF) {
            location = location % 0x20;
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
        this.nes.PPU.setPalette(location, value);
    };

    this.getPPUPalette = function(location) {
        return this.nes.PPU.getPalette(location);
    };

    this.getPPUReg = function(location) {
        this.ppuRegReadFlag = true;
        switch (location) {
            case 0x2000:
                return ppuOpenBus;
            case 0x2001:
                return ppuOpenBus;
                //PPUSTATUS
            case 0x2002:
                this.PPUSTATUSread = false;
                this.ppuRegObj.PPUADDR = 0x00;
                this.ppuRegObj.PPUSCROLL = 0x00;
                this.PPUADDRFirstWrite = true;
                this.PPUSCROLLFirstWrite = true;
                var temp = this.nes.PPU.getPPUSTATUS() & 0xF0;
                temp = temp | (this.lsbLastWritePPU & 0x0F);
                ppuOpenBus = ppuOpenBus & 0x1F;
                ppuOpenBus = temp & 0xE0;
                return temp;
            case 0x2003:
                return ppuOpenBus;
                //OAMDATA
            case 0x2004:
                var currentCycle = this.nes.PPU.getCurrentCycle();
                var currentScanline = this.nes.PPU.getCurrentScanline();
                // if (currentScanline >= 240 && currentScanline < 261) {
                //     ppuOpenBus =  this.OAM[this.nes.PPU.OAMADDR];
                // }
                // else if (currentCycle <= 256) {
                //     // return this.nes.PPU.getOAMReadBuffer();
                //     ppuOpenBus = 0x00;
                // }
                if (this.nes.PPU.rendering()) {
                    if (currentScanline >= 0 && currentScanline <= 239) {
                        if (currentCycle >= 257 && currentCycle <= 320) {
                            ppuOpenBus = this.nes.PPU.getOAMReadBuffer();
                        }
                        else if (currentCycle >= 1 && currentCycle <= 64) {
                            ppuOpenBus = 0xFF;
                        }
                    }
                }
                else {
                    ppuOpenBus = this.OAM[this.nes.PPU.OAMADDR];
                }
                return ppuOpenBus;
            case 0x2005:
                return ppuOpenBus;
            case 0x2006:
                return ppuOpenBus;
                //PPUDATA
            case 0x2007:
                ppuOpenBus = this.nes.PPU.getPPUDATA(location);
                return ppuOpenBus;
        }
    };

    this.setPPUReg = function(location, value) {
        this.ppuRegWriteFlag = true;
        this.lsbLastWritePPU = value;
        ppuOpenBus = value;
        switch (location) {
            //PPUCTRL
            case 0x2000:
                this.ppuRegObj.PPUCTRL = value;
                this.nes.PPU.setPPUCTRL(this.ppuRegObj.PPUCTRL);
                var temp = (this.ppuRegObj.PPUCTRL >> 7) & 0x01;
                if (temp == 0)
                    this.enableNMIGen = false;
                else {
                    this.enableNMIGen = true;
                    if ((this.nes.PPU.ppuStatusBits & 0x80) == 0x80) {
                        this.nes.CPU.elapsedCycles = 0;
                        this.nes.CPU.serveISR('NMI');
                        this.nes.CPU.cpuClockRemaining += this.nes.CPU.elapsedCycles;
                    }
                }
                this.PPUCTRLwritten = true;
                return 0x2000;
                //PPUMASK    
            case 0x2001:
                this.ppuRegObj.PPUMASK = value;
                this.nes.PPU.setPPUMASK(this.ppuRegObj.PPUMASK);
                this.PPUMASKwritten = true;
                return 0x2001;
            case 0x2002:
                break;
                //OAMADDR
            case 0x2003:
                this.nes.PPU.OAMADDR = value;
                return 0x2003;
                //OAMDATA
            case 0x2004:
                var currentScanline = this.nes.PPU.getCurrentScanline();
                if ((currentScanline == 261 || (currentScanline >= 0 && currentScanline < 240)) && this.nes.PPU.rendering()) {
                    this.nes.PPU.OAMADDR++;
                }
                else {
                    this.OAM[this.nes.PPU.OAMADDR] = value;
                    this.nes.PPU.OAMADDR++;
                }
                return 0x2004;
                //PPUSCROLL
            case 0x2005:
                this.nes.PPU.setPPUSCROLL(value);
                return 0x2005;
                //PPUADDR
            case 0x2006:
                this.nes.PPU.setPPUADDR(value);
                return 0x2006;
                //PPUDATA
            case 0x2007:
                this.nes.PPU.setPPUDATA(value);
                return 0x2007;
            case 0x4014:
                this.ppuRegObj.OAMDMA = value;
                this.setOAMDMA(this.ppuRegObj.OAMDMA);
                return 0x4014;
        }
    };

    this.getAPUReg = function(location) {
        var temp = 0b00000000;
        switch (location) {
            case 0x4015:
                if (this.nes.APU.doIrq) {
                    this.nes.APU.doIrq = false;
                    temp = temp | 0b01000000;
                }
                if (this.nes.APU.pulse1.lenCounter > 0) {
                    temp = temp | 0b00000001;
                }
                if (this.nes.APU.pulse2.lenCounter > 0) {
                    temp = temp | 0b00000010;
                }
                if (this.nes.APU.triangle1.lenCounter > 0) {
                    temp = temp | 0b00000100;
                }
                if (this.nes.APU.noise1.lenCounter > 0) {
                    temp = temp | 0b00001000;
                }
        }
        return temp;
    };

    this.setAPUReg = function(location, value) {
        switch (location) {
            case 0x4000: //SQ1_ENV
                this.nes.APU.setSQ1_ENV(value);
                break;
            case 0x4001:
                this.nes.APU.setSQ1_SWEEP(value); //SQ1_SWEEP
                break;
            case 0x4002: //SQ1_LO
                this.nes.APU.setSQ1_LO(value);
                break;
            case 0x4003: //SQ1_HI
                this.nes.APU.setSQ1_HI(value);
                break;
            case 0x4004: //SQ2_ENV
                this.nes.APU.setSQ2_ENV(value);
                break;
            case 0x4005:
                this.nes.APU.setSQ2_SWEEP(value);
                break;
            case 0x4006:
                this.nes.APU.setSQ2_LO(value);
                break;
            case 0x4007:
                this.nes.APU.setSQ2_HI(value);
                break;
            case 0x4008:
                this.nes.APU.setTRIControl(value);
                break;
            case 0x400A:
                this.nes.APU.setTRI_LO(value);
                break;
            case 0x400B:
                this.nes.APU.setTRI_HI(value);
                break;
            case 0x400C:
                this.nes.APU.setNoise_ENV(value);
                break;
            case 0x400E:
                this.nes.APU.setNoise_Period(value);
                break;
            case 0x400F:
                this.nes.APU.setNoise_LenEnv(value);
                break;
            case 0x4015: //APUFLAGS
                this.nes.APU.setAPUFlags(value);
                break;
            case 0x4017:
                this.nes.APU.setFrameCounter(value);
                break;
        }
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

    };

    this.setOAMADDR = function(value) {
    };

    //OAM DMA copying
    this.startOAMDMACopy = function() {
        for (var i = 0; i < 256; i++) {
            this.OAM[this.nes.PPU.OAMADDR + i] = this.cpuMem[(this.OAMDMA * 0x100) + i];
        }
    };

    this.setOAMDMA = function(OAMDMA) {
        this.OAMDMA = OAMDMA;
        this.startOAMDMACopy();
    };
}
