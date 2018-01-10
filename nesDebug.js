$(document).ready(function() {
    var ines;
    var CPU;
    var PPU;
    var MMU;
    var APU;
    var Display;
    // var traceLimitOption;
    var isPaused = false;
    ines = new iNES();
    var isDebugging = true;
    var initGame = function(romContent) {
        this.opcodes = new Uint8Array(romContent);
        Display = new display(document.getElementById('nesCanvas'), document.getElementById('nameTableCanvas'));
        PPU = new ppu(Display);
        MMU = new mmu(PPU);
        CPU = new cpu(MMU, PPU);
        APU = new apu(MMU);
        MMU.OAMInit();
        PPU.initScreenBuffer();
        if (isDebugging) {
            PPU.initOAMScreenBuffer(document.getElementById('oamCanvas'));
        }
        ines.load(this.opcodes, MMU);
        MMU.nameTableMirroring = ines.mirroring;
        PPU.nameTableMirroring = ines.mirroring;
        CPU.reset();
        MMU.copyCHRToGrid();
        MMU.copyBGRCHRToGrid();
        Display.screenReset();

    };
    var viewNameTable = function() {
        var selectedTable = document.getElementById("ddlNameTable");
        var tempAddr = 0x2000;
        switch (selectedTable.value) {
            case '0':
                tempAddr = 0x2000;
                break;
            case '1':
                tempAddr = 0x2400;
                break;
            case '2':
                tempAddr = 0x2800;
                break;
            case '3':
                tempAddr = 0x2C00;
                break;
        }
        var nametable = [];
        var attrtable = [];
        for (var i = tempAddr; i < (tempAddr + 960); i++)
            nametable.push(MMU.ppuMem[i]);
        for (i = tempAddr + 960; i < (tempAddr + 960 + 64); i++)
            attrtable.push(MMU.ppuMem[i]);
        renderNameTable(nametable, attrtable);
    };

    var startdownFunction = function() {
        MMU.startBtnState = true;
    };
    var startupFunction = function() {
        MMU.startBtnState = false;
    };
    var renderNameTable = function(nameTable, attrtable) {
        Display.nameTableScreenReset();
        var paletteNum = 0;
        var pixelColor = 0;
        var screenPixel = 0; //for debugging

        //Fetch the background CHR tile lying on the current scanline
        var curTileX;
        var curTileY;
        // var curTileY = Math.floor(this.currentScanline / 8);
        for (curTileY = 0; curTileY < 30; curTileY++) {
            for (curTileX = 0; curTileX < 32; curTileX++) {
                var tileToDraw = nameTable[curTileX + curTileY * 32];
                tileToDraw = PPU.backgroundPatTblAddr[tileToDraw];
                var curAttrX = Math.floor(curTileX / 4);
                var curAttrY = Math.floor(curTileY / 4);

                var attrByte = attrtable[curAttrX + curAttrY * 8];
                // var attrByte = attrtable[curAttrX + curAttrY * 8];
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
                //Loop through the 8 pixels for the current tile
                for (var curY = 0; curY < 8; curY++) {
                    for (var curX = 0; curX < 8; curX++) {
                        //Pallete logic broken down
                        if (tileToDraw[curY][curX] == 0) { //backdrop color
                            pixelColor = PPU.paletteColors[PPU.palette[0]];
                            screenPixel = ((curTileX * 8) + curX) + ((curTileY * 8) + curY) * 256;
                            //this.screenBuffer[screenPixel] = pixelColor;
                            Display.updateNameTableBuffer(screenPixel, pixelColor);
                        }
                        else {
                            pixelColor = PPU.paletteColors[PPU.palette[paletteNum * 4 + tileToDraw[curY][curX]]];
                            screenPixel = ((curTileX * 8) + curX) + ((curTileY * 8) + curY) * 256;
                            //this.screenBuffer[screenPixel] = pixelColor;
                            Display.updateNameTableBuffer(screenPixel, pixelColor);
                        }
                    }
                }
            }
        }
        Display.updateNameTableCanvas();
    };

    var renderScreen = function() {
        // Display.oamScreenReset();
        Display.updateCanvas();
        Display.updateOamCanvas();
    };

    var drawOAM = function() {
        var tempOAM = [];
        for (var i = 0; i < 256; i += 4) {
            var temp = Math.floor(i / 4);
            //temp = Math.floor(temp / 8); //get the Y co-ordinate 
            tempOAM[i] = Math.floor(temp / 8); //Y attribute 
            tempOAM[i + 1] = MMU.OAM[i + 1]; //tile number
            tempOAM[i + 2] = MMU.OAM[i + 2]; //attribute 
            tempOAM[i + 3] = temp % 8; //set X attribute
            //spritesToDraw.push(i);
        }
        for (var curY = 0; curY < 64; curY++) {
            var tile, paletteNum = 0,
                pixelColor = 0,
                pixelColorIndex = 0,
                curX = 0;
            var spritesToDraw = [],
                spriteX = 0,
                spriteY = 0,
                tileNum, spriteAttr, tileRow = [];

            for (var i = 0; i < 256; i += 4) {
                if ((tempOAM[i] * 8) > (curY - 8) && (tempOAM[i] * 8) <= curY) {
                    //add to list of sprites to draw on current scanline
                    spritesToDraw.push(i);
                }
            }
            for (i = 0; i < spritesToDraw.length; i++) {
                spriteX = tempOAM[spritesToDraw[i] + 3];
                spriteY = tempOAM[spritesToDraw[i]];
                tileNum = tempOAM[spritesToDraw[i] + 1];
                spriteAttr = tempOAM[spritesToDraw[i] + 2];
                tile = PPU.spritePatTblAddr[tileNum];
                tileRow = tile[curY - spriteY * 8];
                paletteNum = spriteAttr & 0b00000011;
                for (var x = 0; x < 8; x++) {
                    pixelColorIndex = tileRow[x];
                    pixelColor = PPU.paletteColors[PPU.palette[16 + paletteNum * 4 + pixelColorIndex]];
                    Display.updateOamBuffer((spriteX * 8) + x + (curY * 64), pixelColor);
                }
            }
        }
    };

    var renderFrame = function() {
        if (!isPaused) {
            CPU.runFrame();
            CPU.totalCPUCyclesThisFrame;
            CPU.nmiLoopCounter = 0;
            drawOAM();
            renderScreen();
        }
        requestAnimationFrame(renderFrame);
    };

    var readOpcodeFile = function(e) {
        var file = e.target.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = initGame(this.result);
        reader.readAsArrayBuffer(file);
    };

    //Enable Bootstrap popovers 
    $(function() {
        $('#inpSearchRoms').popover({
            html: true,
            template: '<div class="popover" role="tooltip"><div class="arrow"></div><div class="popover-body"></div></div>'
        });
    });
    //disable search result popover by default
    $('#inpSearchRoms').popover('disable');

    //Click events
    $('#test').click(function() {
        requestAnimationFrame(renderFrame);
    });
    $('#pause').click(function() {
        isPaused = !isPaused;
    });
    $('#reset').click(function() {
        Display = null;
        PPU = null;
        MMU = null;
        CPU = null;
        APU = null;
    });
    $('#btnSearchRoms').click(function() {
        var url = "/api/getRomListByName/" + $('#inpSearchRoms').val();
        $('#inpSearchRoms').popover('enable');
        $('#inpSearchRoms').popover('show');
        $.ajax({
            type: 'GET',
            url: url,
            success: function(result) {
                $('.popover-body').append("<h5 id='loadedRomName'>" + result.rom + "</h5>" + "<button id='loadRom' type='button' class='btn btn-primary'>Load</button>");
            },
            error: function(e) {
                console.log(e);
            }
        });
    });

    $('body').on('click', '#loadRom', function() {
        //Now load the selected rom into browser memory
        var url = "/api/getRomByFileName/" + $('#loadedRomName').text();
        $.ajax({
            type: 'GET',
            url: url,
            success: function(result) {
                $('#inpSearchRoms').popover('dispose');
                initGame(result.romData.data);
                // console.log(result);
            },
            error: function(e) {
                console.log(e);
            }
        });

    });

    //Bootstrap events
    $('#inpSearchRoms').on('hidden.bs.popover', function() {
        // do something…
        $('#inpSearchRoms').popover('disable');
    });
});



// function init() {
//     // document.getElementById('file-input')
//     //     .addEventListener('change', readOpcodeFile, false);
//     // document.getElementById('viewNameTable')
//     //     .addEventListener('click', viewNameTable, false);
