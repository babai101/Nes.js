/*global $ mmu cpu apu ppu display iNES mapper*/
$(document).ready(function() {
    var isPaused = false;
    var initGame = function(romContent) {
        this.cpuFreq = 1789773; //NTSC CPU freq in Hz
        this.opcodes = new Uint8Array(romContent);
        this.mainDisplay = new display(document.getElementById('nesCanvas'));
        this.ines = new iNES(this);
        this.Mapper = new mapper(this);
        this.PPU = new ppu(this);
        this.MMU = new mmu(this);
        this.CPU = new cpu(this);
        this.APU = new apu(this);
        this.MMU.OAMInit();
        this.PPU.initScreenBuffer();
        this.ines.parseRom(this.opcodes);
        this.MMU.nameTableMirroring = this.ines.mirroring;
        this.PPU.nameTableMirroring = this.ines.mirroring;
        this.CPU.reset();
        this.mainDisplay.screenReset();
    };
    var renderScreen = function() {
        this.mainDisplay.updateCanvas();
    };

    var renderFrame = function() {
        // if (!isPaused) {
            this.CPU.runFrame();
            this.CPU.totalCPUCyclesThisFrame;
            this.CPU.nmiLoopCounter = 0;
            renderScreen();
        // }
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
        this.mainDisplay = null;
        this.PPU = null;
        this.MMU = null;
        this.CPU = null;
        this.APU = null;
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
                this.MMU.startBtnState = 1;
                break;
                //A
            case 90:
                this.MMU.aBtnState = 1;
                break;
                //B
            case 88:
                this.MMU.bBtnState = 1;
                break;
                //Up
            case 38:
                this.MMU.upBtnState = 1;
                break;
                //Down
            case 40:
                this.MMU.downBtnState = 1;
                break;
                //Left
            case 37:
                this.MMU.leftBtnState = 1;
                break;
                //Right
            case 39:
                this.MMU.rightBtnState = 1;
                break;
        }
    });


    $(window).keyup(function(e) {
        var key = e.which;
        //do stuff with "key" here...
        switch (key) {
            //Start
            case 17:
                this.MMU.startBtnState = 0;
                break;
                //A
            case 90:
                this.MMU.aBtnState = 0;
                break;
                //B
            case 88:
                this.MMU.bBtnState = 0;
                break;
                //Up
            case 38:
                this.MMU.upBtnState = 0;
                break;
                //Down
            case 40:
                this.MMU.downBtnState = 0;
                break;
                //Left
            case 37:
                this.MMU.leftBtnState = 0;
                break;
                //Right
            case 39:
                this.MMU.rightBtnState = 0;
                break;
        }
    });

    //Bootstrap events
    $('#inpSearchRoms').on('hidden.bs.popover', function() {
        // do something…
        $('#inpSearchRoms').popover('disable');
    });
});