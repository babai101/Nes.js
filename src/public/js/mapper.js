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

    var MMC3RegSelect = 0,
        MMC3Reg0 = 0,
        MMC3Reg1 = 0,
        MMC3Reg2 = 0,
        MMC3Reg3 = 0,
        MMC3Reg4 = 0,
        MMC3Reg5 = 0,
        MMC3Reg6 = 0,
        MMC3Reg7 = 0,
        MMC3PRGRomBankMode = 0,
        MMC3CHRRomBankMode = 0,
        MMC3PRGRAMEnabled = 0,
        MMC3PRGRAMWriteProtected = 0;
    this.MMC3IRQCntReloadVal = 0;
    this.MMC3IRQReload = false;
    this.MMC3IRQEnabled = false;
    this.MMC3IRQDisabled = false;


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
        var temp = new Uint8Array(262144);
        for (var i = 0; i < 262144; i++) {
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
        switch (this.currentMapperNum) {
            case 4: //MMC3
                for (var i = 0; i < this.nes.ines.prgRomUnits * 2; i++) {
                    prgBank = new Uint8Array(8192);
                    for (var j = 0; j < 8192; j++) {
                        prgBank[j] = romBytes[i * 8192 + 16 + j];
                    }
                    prgRomBanks[i] = prgBank;
                }
                break;
            default:
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
                break;
        }
    };

    this.loadCHRBanks = function(romBytes) {
        var chrBank;
        chrRomBanks = [];
        switch (this.currentMapperNum) {
            case 4: //MMC3
                for (var i = 0; i < this.nes.ines.chrRomUnits * 8; i++) {
                    chrBank = new Uint8Array(1024);
                    for (var j = 0; j < 1024; j++) {
                        chrBank[j] = romBytes[i * 1024 + 16 + j + this.nes.ines.prgRomUnits * 16384];
                    }
                    chrRomBanks[i] = chrBank;
                }
                break;
            default:
                for (var i = 0; i < this.nes.ines.chrRomUnits; i++) {
                    chrBank = new Uint8Array(8192);
                    for (var j = 0; j < 8192; j++) {
                        chrBank[j] = romBytes[i * 8192 + 16 + j + this.nes.ines.prgRomUnits * 16384];
                    }
                    chrRomBanks[i] = chrBank;
                }
                break;
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
                else {
                    return prgRomBanks[1][location - 0xC000];
                }
                // break;
            case 1: //MMC1
                if (MMC1PRGWindow == 2) {
                    if (location < 0xC000) {
                        return prgRomBanks[this.currentPRGBank][location - 0x8000];
                    }
                    else {
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
                    else {
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
                else {
                    return prgRomBanks[prgRomBanks.length - 1][location - 0xC000];
                }
            case 3: //CNROM
                if (location < 0xC000) {
                    return prgRomBanks[0][location - 0x8000];
                }
                else {
                    return prgRomBanks[1][location - 0xC000];
                }
            case 4: //MMC3
                return getMMC3PrgRom(location);
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
            case 4: //MMC3
                if (this.chrRam) {
                    return chrRomBanks[this.currentCHRBank][location];
                }
                return getMMC3ChrRom(location);
        }
    };

    this.getPRGRAM = function(location) {
        switch (this.currentMapperNum) {
            case 1: //MMC1
                if (MMC1PRGRAMEnabled) {
                    return this.PRGRam[location - 0x6000];
                }
                break;
            case 4: //MMC3
                if (MMC3PRGRAMEnabled)
                    return this.PRGRam[location - 0x6000];
        }
    };

    this.setCHRRom = function(location, value) {
        switch (this.currentMapperNum) {
            case 0: //NROM
            case 1: //MMC1
            case 2: //UnROM
            case 3: //CNROM
            case 4: //MMC3
                if (this.chrRam)
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
                            this.setPRGBank((MMC1LoadReg & 0x0E) % prgRomBanks.length);
                        }
                        else {
                            this.setPRGBank((MMC1LoadReg & 0x0F) % prgRomBanks.length);
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
            case 4: //MMC3
                if (location >= 0x8000 && location <= 0x9FFF) {
                    // if (location == 0x8000)
                    //     MMC3BankSelect(value, location);
                    // else if (location == 0x8001)
                    //     MMC3SetBankRegisters(value);
                    if ((location & 1) == 0) {
                        MMC3BankSelect(value, location);
                    }
                    else {
                        MMC3SetBankRegisters(value);
                    }
                }
                else if (location >= 0xA000 && location <= 0xBFFF) {
                    if ((location & 1) == 0) {
                        this.nes.MMU.nameTableMirroring = value & 0x01;
                        this.copyNameTables(value & 0x01);
                    }
                    else {
                        MMC3PRGRAMEnabled = value >> 7;
                        MMC3PRGRAMWriteProtected = (value & 0x40) >> 6;
                    }
                }
                else if (location >= 0xC000 && location <= 0xDFFF) {
                    if ((location & 1) == 0) {
                        this.MMC3IRQCntReloadVal = value;
                    }
                    else {
                        this.nes.PPU.MMC3IRQCounter = 0;
                        this.MMC3IRQReload = true;
                    }
                }
                else if (location >= 0xE000) {
                    if ((location & 1) == 0) {
                        this.MMC3IRQEnabled = false;
                        if (this.nes.CPU.IRQToRun == 3) {
                            this.nes.CPU.IRQToRun = 0;
                        }
                    }
                    else {
                        this.MMC3IRQEnabled = true;
                    }
                }
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
        switch (this.currentMapperNum) {
            case 1: //MMC1
                if (MMC1PRGRAMEnabled) {
                    this.PRGRam[location - 0x6000] = value;
                }
                break;
            case 4: //MMC3
                if (MMC3PRGRAMEnabled)
                    this.PRGRam[location - 0x6000] = value;
                break;
        }
    };

    this.MMC1UpdateMapperValues = function(value) {
        var temp = value & 0x03;
        switch (temp) { //TODO: 1 screen mirrorring
            case 0:
                this.nes.MMU.nameTableMirroring = 2;
                this.copyNameTables(2);
                break;
            case 1:
                this.nes.MMU.nameTableMirroring = 2;
                this.copyNameTables(2);
                break;
            case 2:
                this.nes.MMU.nameTableMirroring = 0;
                this.copyNameTables(0);
                break;
            case 3:
                this.nes.MMU.nameTableMirroring = 1;
                this.copyNameTables(1);
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

    function MMC3BankSelect(value, location) {
        //PRG Switching
        if ((value & 0x40) == 0x40)
            MMC3PRGRomBankMode = 1; // FixedBank = 0x8000;
        else if ((value & 0x40) == 0)
            MMC3PRGRomBankMode = 0; //0xC000;
        if ((value & 0x80) == 0x80)
            MMC3CHRRomBankMode = 1;
        else if ((value & 0x80) == 0)
            MMC3CHRRomBankMode = 0;
        MMC3RegSelect = value & 0x07;
    }

    function MMC3SetBankRegisters(value) {
        switch (MMC3RegSelect) {
            case 0:
                MMC3Reg0 = (value & 0xFE);
                break;
            case 1:
                MMC3Reg1 = (value & 0xFE);
                break;
            case 2:
                MMC3Reg2 = value;
                break;
            case 3:
                MMC3Reg3 = value;
                break;
            case 4:
                MMC3Reg4 = value;
                break;
            case 5:
                MMC3Reg5 = value;
                break;
            case 6:
                MMC3Reg6 = (value & 0x3F) % prgRomBanks.length;
                break;
            case 7:
                MMC3Reg7 = (value & 0x3F) % prgRomBanks.length;
                break;
        }
    }

    function getMMC3PrgRom(location) {
        if (location <= 0x9FFF) {
            if (MMC3PRGRomBankMode == 1) {
                return prgRomBanks[prgRomBanks.length - 2][location - 0x8000];
            }
            else {
                // var n = MMC3Reg6 % prgRomBanks.length;
                return prgRomBanks[MMC3Reg6][location - 0x8000];
            }
        }
        else if (location <= 0xBFFF) {
            // var n = MMC3Reg7 % prgRomBanks.length;
            return prgRomBanks[MMC3Reg7][location - 0xA000];
        }
        else if (location <= 0xDFFF) {
            if (MMC3PRGRomBankMode == 1) {
                // var n = MMC3Reg6 % prgRomBanks.length;
                return prgRomBanks[MMC3Reg6][location - 0xC000];
            }
            else return prgRomBanks[prgRomBanks.length - 2][location - 0xC000];
        }
        else {
            return prgRomBanks[prgRomBanks.length - 1][location - 0xE000];
        }
    }

    function getMMC3ChrRom(location) {
        if (location <= 0x3FF) {
            if (MMC3CHRRomBankMode == 1) {
                return chrRomBanks[MMC3Reg2][location];
            }
            else return chrRomBanks[MMC3Reg0][location];
        }
        else if (location <= 0x07FF) {
            if (MMC3CHRRomBankMode == 1) {
                return chrRomBanks[MMC3Reg3][location - 0x0400];
            }
            else return chrRomBanks[MMC3Reg0 + 1][location - 0x0400];
        }
        else if (location <= 0x0BFF) {
            if (MMC3CHRRomBankMode == 1) {
                return chrRomBanks[MMC3Reg4][location - 0x0800];
            }
            else return chrRomBanks[MMC3Reg1][location - 0x0800];
        }
        else if (location <= 0x0FFF) {
            if (MMC3CHRRomBankMode == 1) {
                return chrRomBanks[MMC3Reg5][location - 0x0C00];
            }
            else return chrRomBanks[MMC3Reg1 + 1][location - 0x0C00];
        }
        else if (location <= 0x13FF) {
            if (MMC3CHRRomBankMode == 1) {
                return chrRomBanks[MMC3Reg0][location - 0x1000];
            }
            else return chrRomBanks[MMC3Reg2][location - 0x1000];
        }
        else if (location <= 0x17FF) {
            if (MMC3CHRRomBankMode == 1) {
                return chrRomBanks[MMC3Reg0 + 1][location - 0x1400];
            }
            else return chrRomBanks[MMC3Reg3][location - 0x1400];
        }
        else if (location <= 0x1BFF) {
            if (MMC3CHRRomBankMode == 1) {
                return chrRomBanks[MMC3Reg1][location - 0x1800];
            }
            else return chrRomBanks[MMC3Reg4][location - 0x1800];
        }
        else { //if (location <= 0x1FFF)
            if (MMC3CHRRomBankMode == 1) {
                return chrRomBanks[MMC3Reg1 + 1][location - 0x1C00];
            }
            else return chrRomBanks[MMC3Reg5][location - 0x1C00];
        }
    }

    this.copyNameTables = function(newMirroringMode) {
        switch (newMirroringMode) {
            case 0:
                for (var i = 0x2000; i < 0x2400; i++) {
                    this.nes.MMU.ppuMem[i] = this.nes.MMU.nameTables[i - 0x2000];
                    this.nes.MMU.ppuMem[i + 0x800] = this.nes.MMU.nameTables[i - 0x2000];
                    this.nes.MMU.ppuMem[i + 0x400] = this.nes.MMU.nameTables[i - 0x2000 + 0x400];
                    this.nes.MMU.ppuMem[i + 0x800 + 0x400] = this.nes.MMU.nameTables[i - 0x2000 + 0x400];
                }
                // for (var i = 0x2400; i < 0x2800; i++) {
                //     this.nes.MMU.ppuMem[i + 0x800] = this.nes.MMU.ppuMem[i];
                //     // this.nes.MMU.ppuMem[i + 0x800 + 0x400] = this.nes.MMU.ppuMem[i + 0x400];
                // }
                break;
            case 1:
                for (var i = 0x2000; i < 0x2400; i++) {
                    this.nes.MMU.ppuMem[i] = this.nes.MMU.nameTables[i - 0x2000];
                    this.nes.MMU.ppuMem[i + 0x400] = this.nes.MMU.nameTables[i - 0x2000];
                    this.nes.MMU.ppuMem[i + 0x800 + 0x400] = this.nes.MMU.nameTables[i - 0x2000 + 0x400];
                    this.nes.MMU.ppuMem[i + 0x800] = this.nes.MMU.nameTables[i - 0x2000 + 0x400];
                }
                break;
            case 2:
                for (var i = 0x2000; i < 0x2400; i++) {
                    this.nes.MMU.ppuMem[i + 0x400] = this.nes.MMU.ppuMem[i];
                    this.nes.MMU.ppuMem[i + 0x800] = this.nes.MMU.ppuMem[i];
                    this.nes.MMU.ppuMem[i + 0xC00] = this.nes.MMU.ppuMem[i];
                }
                break;
            case 3:
                break;
        }
    };
}
