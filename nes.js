/*global $*/
$(document).ready(function() {
    var ines;
    var CPU;
    var PPU;
    var MMU;
    var APU;
    var mainDisplay;
    var isPaused = false;
    ines = new iNES();
    var isDebugging = true;
    var initGame = function(romContent) {
        this.opcodes = new Uint8Array(romContent);
        mainDisplay = new display(document.getElementById('nesCanvas'));
        PPU = new ppu(mainDisplay);
        MMU = new mmu(PPU);
        CPU = new cpu(MMU, PPU);
        APU = new apu(MMU);
        MMU.OAMInit();
        PPU.initScreenBuffer();
        ines.load(this.opcodes, MMU);
        MMU.nameTableMirroring = ines.mirroring;
        PPU.nameTableMirroring = ines.mirroring;
        CPU.reset();
        MMU.copyCHRToGrid();
        MMU.copyBGRCHRToGrid();
        mainDisplay.screenReset();
    };
    var renderScreen = function() {
        mainDisplay.updateCanvas();
    };

    var renderFrame = function() {
        if (!isPaused) {
            CPU.runFrame();
            CPU.totalCPUCyclesThisFrame;
            CPU.nmiLoopCounter = 0;
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
        mainDisplay = null;
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
                requestAnimationFrame(renderFrame);
                // console.log(result);
            },
            error: function(e) {
                console.log(e);
            }
        });

    });

    //KeyPress events

    $(window).keydown(function(e) {
        var key = e.which;
        //do stuff with "key" here...
        switch (key) {
            //Start
            case 17:
                MMU.startBtnState = 1;
                break;
                //A
            case 90:
                MMU.aBtnState = 1;
                break;
                //B
            case 88:
                MMU.bBtnState = 1;
                break;
                //Up
            case 38:
                MMU.upBtnState = 1;
                break;
                //Down
            case 40:
                MMU.downBtnState = 1;
                break;
                //Left
            case 37:
                MMU.leftBtnState = 1;
                break;
                //Right
            case 39:
                MMU.rightBtnState = 1;
                break;
        }
    });


    $(window).keyup(function(e) {
        var key = e.which;
        //do stuff with "key" here...
        switch (key) {
            //Start
            case 17:
                MMU.startBtnState = 0;
                break;
                //A
            case 90:
                MMU.aBtnState = 0;
                break;
                //B
            case 88:
                MMU.bBtnState = 0;
                break;
                //Up
            case 38:
                MMU.upBtnState = 0;
                break;
                //Down
            case 40:
                MMU.downBtnState = 0;
                break;
                //Left
            case 37:
                MMU.leftBtnState = 0;
                break;
                //Right
            case 39:
                MMU.rightBtnState = 0;
                break;
        }
    });

    //Bootstrap events
    $('#inpSearchRoms').on('hidden.bs.popover', function() {
        // do something…
        $('#inpSearchRoms').popover('disable');
    });
});