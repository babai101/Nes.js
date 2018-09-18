/*global $ cancelAnimationFrame NES*/
'use strict';
import iNES from './iNES';
import mapper from './mapper';
import ppu from './ppu';
import cpu from './cpu';
import mmu from './mmu';
import apu from './apu';
import display from './display';

export default function nes() {
    this.isRunning = false;
    this.requestId;
    this.cpuFreq = 1789773;
    this.frameCount;
    this.cyclesPerSecond;
    this.mainDisplay = new display(document.getElementById('nesCanvas'));
    this.ines = new iNES(this);
    this.Mapper = new mapper(this);
    this.PPU = new ppu(this);
    this.MMU = new mmu(this);
    this.CPU = new cpu(this);
    this.APU = new apu(this);
    this.initGame = function(romContent) {
        this.opcodes = new Uint8Array(romContent);
        this.APU.init();
        this.MMU.OAMInit();
        this.PPU.secOAMInit();
        this.PPU.initScreenBuffer();
        this.PPU.initSpriteOpUnits();
        this.ines.parseRom(this.opcodes);
        this.MMU.nameTableMirroring = this.ines.mirroring;
        this.PPU.nameTableMirroring = this.ines.mirroring;
        this.CPU.reset();
        this.mainDisplay.screenReset();
        this.frameCount = 0;
        this.cyclesPerSecond = 0;
        this.isRunning = true;
    };

    this.renderScreen = function() {
        this.mainDisplay.updateCanvas();
    };

    this.renderFrame = function() {
        // this.CPU.run();
        this.CPU.newRun();
        // this.mainDisplay.updateCanvas();
        // this.renderScreen();
        // requestAnimationFrame(this.renderFrame);
    };

    this.readOpcodeFile = function(e) {
        var file = e.target.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = this.initGame(this.result);
        reader.readAsArrayBuffer(file);
    };

    this.reset = function() {
        this.mainDisplay = null;
        this.PPU = null;
        this.MMU = null;
        this.CPU = null;
        this.APU = null;
    };
}

if (window !== undefined)
    window.NES = nes;
