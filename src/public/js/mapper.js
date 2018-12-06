'use strict';
export default function mapper(nes) {
    this.nes = nes;
    this.chrGrids = [];
    var prgRomBanks = [];
    var chrRomBanks = [];
    this.PRGRam = new Uint8Array(8192);
    this.currentPRGBank = 0;
    this.currentCHRBank = 0;
    this.chrRam = false;
    // this.chrWindowSize = 8192;
    var MMC1WriteCount = 0,
        MMC1LoadReg = 0x0C,
        MMC1ControlReg = 0,
        MMC14KBBank0 = 0,
        MMC14KBBank1 = 0,
        MMC1PRGWindow = 1,
        MMC1PRGFixedBank = 0xC000,
        MMC1CHRWindow = 8,
        MMC1PRGRAMEnabled = false,
        tempMMC14KBBank0 = 0,
        tempMMC14KBBank1 = 0;
        

    this.loadRom = function(romBytes) {
        this.currentMapperNum = this.nes.ines.mapperNum;
        this.initMem();

        //Load PRG & CHR Rom banks
        this.loadPRGBanks(romBytes);
        this.loadCHRBanks(romBytes);

        switch (this.currentMapperNum) {
            //NROM
            case 0:
                //assign banks to cpu & ppu
                break;
                //UNROM
            case 2:
                break;
        }
    };

    //Initialize memory
    this.initMem = function() {
        // 2kb Internal RAM
        for (var i = 0; i < 0x2000; i++) {
            this.nes.MMU.cpuMem[i] = 0xFF;
        }

        // All others set to 0.
        for (var i = 0x2000; i < 0x8000; i++) {
            this.nes.MMU.cpuMem[i] = 0;
        }
    };

    this.initCHRRam = function() {
        var temp = new Uint8Array(8192);
        for (var i = 0; i < 8192; i++) {
            temp[i] = 0;
        }
        chrRomBanks.push(temp);
    };

    this.initPRGRam = function() {
        for (var i = 0; i < 8192; i++) {
            this.PRGRam[i] = 0;
        }
    };

    this.loadPRGBanks = function(romBytes) {
        var prgBank;
        prgRomBanks = [];
        for (var i = 0; i < this.nes.ines.prgRomUnits; i++) {
            prgBank = new Uint8Array(16384);
            for (var j = 0; j < 16384; j++) {
                prgBank[j] = romBytes[i * 16384 + 16 + j];
            }
            prgRomBanks[i] = prgBank;
        }
        //if prg rom is only 16k, copy to next bank also
        if (this.nes.ines.prgRomUnits == 1) {
            prgRomBanks[1] = prgBank;
        }
    };

    this.loadCHRBanks = function(romBytes) {
        var chrBank;
        chrRomBanks = [];
        for (var i = 0; i < this.nes.ines.chrRomUnits; i++) {
            chrBank = new Uint8Array(8192);
            for (var j = 0; j < 8192; j++) {
                chrBank[j] = romBytes[i * 8192 + 16 + j + this.nes.ines.prgRomUnits * 16384];
            }
            chrRomBanks[i] = chrBank;
        }
        //TODO refactor CHR ram loading
        if (this.nes.ines.chrRomUnits == 0) {
            this.initCHRRam();
            this.chrRam = true;
        }
        this.initPRGRam();
    };

    //return PRG rom data 
    this.getPRGRom = function(location) {
        switch (this.currentMapperNum) {
            case 0: //NROM
                if (location < 0xC000) {
                    return prgRomBanks[0][location - 0x8000];
                }
                else { //if (location >= 0xC000 && location <= 0xFFFF) {
                    return prgRomBanks[1][location - 0xC000];
                }
                // break;
            case 1: //MMC1
                if (MMC1PRGWindow == 2) {
                    if (location < 0xC000) {
                        return prgRomBanks[this.currentPRGBank][location - 0x8000];
                    }
                    else { //if (location >= 0xC000 && location <= 0xFFFF) {
                        return prgRomBanks[this.currentPRGBank + 1][location - 0xC000];
                    }
                }
                else {
                    if (location < 0xC000) {
                        if (MMC1PRGFixedBank == 0x8000) {
                            return prgRomBanks[0][location - 0x8000];
                        }
                        else {
                            return prgRomBanks[this.currentPRGBank][location - 0x8000];
                        }
                    }
                    else { //if (location >= 0xC000 && location <= 0xFFFF) {
                        if (MMC1PRGFixedBank == 0xC000) {
                            return prgRomBanks[prgRomBanks.length - 1][location - 0xC000];
                        }
                        else {
                            return prgRomBanks[this.currentPRGBank][location - 0xC000];
                        }
                    }
                }
            case 2: //UnROM
                if (location < 0xC000) {
                    return prgRomBanks[this.currentPRGBank][location - 0x8000];
                }
                else { //if (location >= 0xC000 && location <= 0xFFFF) {
                    return prgRomBanks[prgRomBanks.length - 1][location - 0xC000];
                }
                // break;
            case 3: //CNROM
                if (location < 0xC000) {
                    return prgRomBanks[0][location - 0x8000];
                }
                else { //if (location >= 0xC000 && location <= 0xFFFF) {
                    return prgRomBanks[1][location - 0xC000];
                }
                // break;
        }
    };

    //return CHR rom data
    this.getCHRRom = function(location) {
        switch (this.currentMapperNum) {
            case 1: //MMC1
                if (this.chrRam) {
                    return chrRomBanks[this.currentCHRBank][location];
                }
                if (MMC1CHRWindow == 8) {
                    return chrRomBanks[this.currentCHRBank][location];
                }
                else if (MMC1CHRWindow == 4) {
                    if (location < 0x1000) {
                        if ((MMC14KBBank0 & 1) == 0) {
                            return chrRomBanks[tempMMC14KBBank0][location];
                        }
                        else {
                            return chrRomBanks[tempMMC14KBBank0][location + 0x1000];
                        }
                    }
                    else {
                        if ((MMC14KBBank1 & 1) == 0) {
                            return chrRomBanks[tempMMC14KBBank1][location - 0x1000];
                        }
                        else {
                            return chrRomBanks[tempMMC14KBBank1][location];
                        }
                    }
                }
                break;
            case 0: //NROM
            case 2: //UnROM
            case 3: //CNROM
                return chrRomBanks[this.currentCHRBank][location];
        }
    };

    this.getPRGRAM = function(location) {
        if (MMC1PRGRAMEnabled) {
            return this.PRGRam[location - 0x6000];
        }
    };

    this.setCHRRom = function(location, value) {
        switch (this.currentMapperNum) {
            case 0: //NROM
            case 1: //MMC1
            case 2: //UnROM
            case 3: //CNROM
                chrRomBanks[this.currentCHRBank][location] = value;
                break;
        }
    };

    this.setBank = function(value, location) {
        switch (this.currentMapperNum) {
            case 1: //MMC1
                if (value >= 0x80 && value <= 0xFF) {
                    MMC1LoadReg = 0;
                    MMC1WriteCount = 0;
                }
                else {
                    MMC1WriteCount++;
                    MMC1LoadReg >>= 1;
                    value &= 1;
                    value <<= 4;
                    MMC1LoadReg |= value;
                }
                if (MMC1WriteCount == 5) {
                    if (location >= 0x8000 && location <= 0x9FFF) {
                        MMC1ControlReg = MMC1LoadReg;
                        this.MMC1UpdateMapperValues(MMC1ControlReg);
                    }
                    else if (location >= 0xA000 && location <= 0xBFFF) {
                        if (MMC1CHRWindow == 8) {
                            this.setCHRBank((MMC1LoadReg & 0x1E) / 2);
                        }
                        else {
                            MMC14KBBank0 = MMC1LoadReg & 0x1F;
                            tempMMC14KBBank0 = Math.floor(MMC14KBBank0 / 2);
                        }
                    }
                    else if (location >= 0xC000 && location <= 0xDFFF) {
                        if (MMC1CHRWindow == 4) {
                            MMC14KBBank1 = MMC1LoadReg & 0x1F;
                            tempMMC14KBBank1 = Math.floor(MMC14KBBank1 / 2);
                        }
                    }
                    else if (location >= 0xE000 && location <= 0xFFFF) {
                        if (MMC1PRGWindow == 2) {
                            this.setPRGBank(MMC1LoadReg & 0x0E);
                        }
                        else {
                            this.setPRGBank(MMC1LoadReg & 0x0F);
                        }
                        if (MMC1LoadReg >> 4) {
                            MMC1PRGRAMEnabled = false;
                        }
                        else {
                            MMC1PRGRAMEnabled = true;
                        }
                    }
                    MMC1WriteCount = 0;
                    MMC1LoadReg = 0;
                }
                break;
            case 2: //UnROM
                this.setPRGBank(value);
                break;
            case 3: //CNROM
                this.setCHRBank(value & 0x03);
                break;
        }
    };

    //set the bank selected by rom
    this.setPRGBank = function(bank) {
        this.currentPRGBank = bank;
    };

    //set the bank selected by rom
    this.setCHRBank = function(bank) {
        this.currentCHRBank = bank;
    };

    this.setPRGRAM = function(location, value) {
        if (MMC1PRGRAMEnabled) {
            this.PRGRam[location - 0x6000] = value;
        }
    };

    this.MMC1UpdateMapperValues = function(value) {
        var temp = value & 0x03;
        switch (temp) { //TODO: 1 screen mirrorring
            case 0:
                this.nes.MMU.nameTableMirroring = 2;
                break;
            case 1:
                this.nes.MMU.nameTableMirroring = 2;
                break;
            case 2:
                this.nes.MMU.nameTableMirroring = 0;
                break;
            case 3:
                this.nes.MMU.nameTableMirroring = 1;
                break;
        }
        temp = (value & 0x0C) >> 2;
        switch (temp) {
            case 0:
            case 1:
                MMC1PRGWindow = 2;
                break;
            case 2:
                MMC1PRGWindow = 1;
                MMC1PRGFixedBank = 0x8000;
                break;
            case 3:
                MMC1PRGWindow = 1;
                MMC1PRGFixedBank = 0xC000;
                break;
        }
        temp = value >> 4;
        if (temp == 0) {
            MMC1CHRWindow = 8;
        }
        else {
            MMC1CHRWindow = 4;
        }
    };
}
