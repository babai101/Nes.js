function mapper(nes) {
    this.nes = nes;
    this.chrGrids = [];
    this.prgRomBanks = [];
    this.chrRomBanks = [];
    this.currentPRGBank = 0;
    this.currentCHRBank = 0;

    this.loadRom = function(romBytes) {
        this.currentMapperNum = this.nes.ines.mapperNum;
        this.initMem();

        //Load PRG & CHR Rom banks
        this.loadPRGBanks(romBytes);
        this.loadCHRBanks(romBytes);
        //Render the CHR aata into grids
        this.renderCHRGrids();

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

    this.loadPRGBanks = function(romBytes) {
        var prgBank;
        this.prgRomBanks = [];
        for (var i = 0; i < this.nes.ines.prgRomUnits; i++) {
            prgBank = [];
            for (var j = 0; j < 16384; j++) {
                // this.nes.MMU.setCpuMemVal((0xC000 + i), romBytes[i + 16]);
                prgBank[j] = romBytes[i * 16384 + 16 + j];
                // this.nes.MMU.cpuMem[0xC000 + i] = romBytes[i + 16];
            }
            this.prgRomBanks[i] = prgBank;
        }
        //if prg rom is only 16k, copy to next bank also
        if (this.nes.ines.prgRomUnits == 1) {
            this.prgRomBanks[1] = prgBank;
        }
    };

    this.loadCHRBanks = function(romBytes) {
        var chrBank;
        this.chrRomBanks = [];
        for (var i = 0; i < this.nes.ines.chrRomUnits; i++) {
            chrBank = [];
            for (var j = 0; j < 8192; j++) {
                chrBank[j] = romBytes[i * 8192 + 16 + j + this.nes.ines.prgRomUnits * 16384];
            }
            this.chrRomBanks[i] = chrBank;
        }
        //TODO refactor CHR ram loading
        // else if (this.nes.ines.chrRomUnits == 0) {
        //     this.nes.MMU.usesCHRRam = true;
        // }
    };

    this.renderCHRGrids = function() {
        var leftCHRGrid, rightCHRGrid;
        for (var i = 0; i < this.chrRomBanks.length; i++) {
            //get the chr rendered
            leftCHRGrid = this.copyCHRToGrid(this.chrRomBanks[i], 0);
            rightCHRGrid = this.copyCHRToGrid(this.chrRomBanks[i], 4096);
            //assing the rendered grid as banks
            this.chrGrids[i] = [leftCHRGrid, rightCHRGrid];
        }
    };

    //return PRG rom data 
    this.getPRGRom = function(location) {
        switch (this.currentMapperNum) {
            //NROM
            case 0:
                if (location >= 0x8000 && location < 0xC000) {
                    return this.prgRomBanks[0][location - 0x8000];
                }
                else if (location >= 0xC000 && location <= 0xFFFF) {
                    return this.prgRomBanks[1][location - 0xC000];
                }
                break;
                //UnROM
            case 2:
                break;
        }
    };
    
    //return CHR rom data
    this.getCHRRom = function (location) {
        switch (this.currentMapperNum) {
            //NROM
            case 0:
                return this.chrRomBanks[0][location];
                //UnROM
            case 2:
                break;
        }
    };
    
    this.getCHRGrid = function(patternTblAddr, index) {
        switch(this.currentMapperNum) {
            //NROM
            case 0:
                if(patternTblAddr == 'left') {
                    return this.chrGrids[0][0][index];
                }
                else if (patternTblAddr == 'right') {
                    return this.chrGrids[0][1][index];
                }
                break;
        }
    };

    this.setBank = function(bank) {
        switch (this.currentMapperNum) {
            //UnROM
            case 2:
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

    this.copyCHRToGrid = function(chrRom, startAddress) {
        var chrGrid = [];
        var tileLow, tileHigh, mask, lowVal, highVal, compoundVal, compoundTileRow, tile;
        for (var i = startAddress; i < startAddress + 4096; i += 16) {
            tileLow = [];
            tileHigh = [];
            for (var j = 0; j < 8; j++) {
                tileLow.push(chrRom[i + j]);
            }
            for (var k = 8; k < 16; k++) {
                tileHigh.push(chrRom[i + k]);
            }
            tile = [];
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
                tile.push(compoundTileRow);
            }
            chrGrid.push(tile);
        }
        return chrGrid;
    };
}
