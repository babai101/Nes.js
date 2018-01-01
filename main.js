 var iNES;
 var CPU;
 var PPU;
 var MMU;
 var APU;
 var canvas = document.getElementById('nesCanvas');
 var ctx = canvas.getContext('2d');
 // var chrCtx = document.getElementById('chrCanvas').getContext('2d');
 var canvasImageData;

 // function init() {
 iNES = new iNES();
 document.getElementById('file-input')
     .addEventListener('change', readOpcodeFile, false);
 document.getElementById('test')
     .addEventListener('click', testiNES, false);
 // document.getElementById('showHeaders')
 //     .addEventListener('click', showHeaders, false);
 document.getElementById('viewCHR')
     .addEventListener('click', viewCHR, false);
 document.getElementById('seekPC')
     .addEventListener('click', seekPC, false);
 document.getElementById('step')
     .addEventListener('click', debugEmu, false);
 // }

 function updateRegisters() {
     document.getElementById('accReg')
         .innerHTML = 'A:' + ("00" + CPU.accumulator.toString(16).toUpperCase()).slice(-2);
     document.getElementById('xReg')
         .innerHTML = 'X:' + ("00" + CPU.X.toString(16).toUpperCase()).slice(-2);
     document.getElementById('yReg')
         .innerHTML = 'Y:' + ("00" + CPU.Y.toString(16).toUpperCase()).slice(-2);
     document.getElementById('stackPointer')
         .innerHTML = 'SP:' + ("00" + CPU.sp.toString(16).toUpperCase()).slice(-2);
     document.getElementById('programCounter')
         .innerHTML = 'PC:' + ("0000" + CPU.pc.toString(16).toUpperCase()).slice(-4);
     document.getElementById('processorFlags')
         .innerHTML = 'P:' + ("00" + CPU.P.toString(16).toUpperCase()).slice(-2);
 }

 function updateFlags() {
     if ((CPU.P & 0x01) == 0x01)
         document.getElementById('carryFlag')
         .checked = true;
     else document.getElementById('carryFlag')
         .checked = false;

     if ((CPU.P & 0x02) == 0x02)
         document.getElementById('zeroFlag')
         .checked = true;
     else document.getElementById('zeroFlag')
         .checked = false;

     if ((CPU.P & 0x04) == 0x04)
         document.getElementById('interruptFlag')
         .checked = true;
     else document.getElementById('interruptFlag')
         .checked = false;

     if ((CPU.P & 0x08) == 0x08)
         document.getElementById('decimalFlag')
         .checked = true;
     else document.getElementById('decimalFlag')
         .checked = false;

     if ((CPU.P & 0x16) == 0x16)
         document.getElementById('breakFlag')
         .checked = true;
     else document.getElementById('breakFlag')
         .checked = false;

     if ((CPU.P & 0x32) == 0x32)
         document.getElementById('unusedFlag')
         .checked = true;
     else document.getElementById('unusedFlag')
         .checked = false;

     if ((CPU.P & 0x64) == 0x64)
         document.getElementById('overFlowFlag')
         .checked = true;
     else document.getElementById('overFlowFlag')
         .checked = false;

     if ((CPU.P & 0x128) == 0x128)
         document.getElementById('signFlag')
         .checked = true;
     else document.getElementById('signFlag')
         .checked = false;
 }

 function updateHeaders() {
     document.getElementById('prgRomUnits')
         .innerHTML = "prgRomUnits=" + iNES.prgRomUnits;

     document.getElementById('chrRomUnits')
         .innerHTML = "chrRomUnits=" + iNES.chrRomUnits;

     document.getElementById('mirroring')
         .innerHTML = "mirroring=" + iNES.mirroring;

     document.getElementById('mapper')
         .innerHTML = "mapperLowBits=" + iNES.mapperLowBits;
 }

 function updateInstructionLog() {
     var temp1 = (CPU.currentOpcodeLog + ' ' + CPU.ArgLog + '  ' + '  ' + '  ' + '  ' + '  ').slice(0, 9);
     if (CPU.opcodeType[0] != '*') {
         CPU.opcodeType = ' ' + CPU.opcodeType;
     }
     var temp2 = CPU.PCLog + '  ' + temp1 + CPU.opcodeType + ' ' + CPU.memLog;
     temp2 = (temp2 + '                             ').slice(0, 49);
     var temp3 = 'A:' + ("00" + this.accumulator.toString(16).toUpperCase()).slice(-2) + ' X:' + ("00" + this.X.toString(16).toUpperCase()).slice(-2) + ' Y:' + ("00" + this.Y.toString(16).toUpperCase()).slice(-2) + ' P:' + ("00" + this.P.toString(16).toUpperCase()).slice(-2) + ' SP:' + ("00" + this.sp.toString(16).toUpperCase()).slice(-2);
     var opWdw = document.getElementById('outputWindow');
     opWdw.innerHTML += (temp2 + '\n');
     opWdw.scrollTop = opWdw.scrollHeight;
 }

 function updateDebugInfo() {
     updateRegisters();
     updateFlags();
     updateHeaders();
     updateInstructionLog();
 }

 // var renderCHRTiles = function(CHRGrid) {
 //     // 236 180 176 [0] 228 196 144 [1] 204 210 120 [2] 180 222 120 [3]   Using this palette to view CHR tiles
 //     var pixel, x, y, scaleFactor, tileXShift, tileYShift;

 //     scaleFactor = 8;
 //     tileYShift = 0;
 //     for (var tile = 0; tile < 256; tile++) {
 //         if ((tile % 16 == 0) && tile != 0) {
 //             tileYShift++;
 //         }
 //         tileXShift = tile % 16;
 //         for (var row = 0; row < 8; row++) { //each row of 8x8 tile
 //             for (var col = 0; col < 8; col++) { //each col of 8x8 tile
 //                 pixel = CHRGrid[tile][row][col];
 //                 x = col * scaleFactor + tileXShift * (scaleFactor * scaleFactor); // + (tile) * scaleFactor;
 //                 y = row * scaleFactor + tileYShift * (scaleFactor * scaleFactor);
 //                 // if(tile % 16 == 0) {
 //                 // }
 //                 switch (pixel) {
 //                     case 3:
 //                         // chrCtx.fillStyle = 'rgb(180, 222, 120)';
 //                         chrCtx.fillStyle = 'red';
 //                         break;
 //                     case 2:
 //                         // chrCtx.fillStyle = 'rgb(208, 210, 120)';
 //                         chrCtx.fillStyle = 'green';
 //                         break;
 //                     case 1:
 //                         // chrCtx.fillStyle = 'rgb(228, 196, 188)';
 //                         chrCtx.fillStyle = 'blue';
 //                         break;
 //                     case 0:
 //                         // chrCtx.fillStyle = 'rgb(236, 180, 176)';
 //                         chrCtx.fillStyle = 'orange';
 //                         break;
 //                 }
 //                 chrCtx.fillRect(x, y, scaleFactor, scaleFactor);
 //             }
 //         }
 //     }
 // };

 var renderScreen = function() {
     // for(var x = 0; x < 256; x++) {
     //     for(var y = 0; y < 240; y++) {
     //         if(PPU.screenBuffer[x][y]) {
     //             ctx.fillStyle = PPU.screenBuffer[x][y];
     //             ctx.fillRect(x, y, 1, 1);
     //         }
     //     }
     // }    
     canvasImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
     var data = canvasImageData.data;
     var j = 0;
     for (var i = 0; i < 256 * 240; i++) {
         j = i * 4;
         data[j] = PPU.screenBuffer[i] & 0xFF;
         data[j + 1] = (PPU.screenBuffer[i] >> 8) & 0xFF;
         data[j + 2] = (PPU.screenBuffer[i] >> 16) & 0xFF;
     }
     // for(var y = 0; y < canvas.height; y++) {
     //     for(var x = 0; x < canvas.width; x++) {
     //         data[((canvas.width * y) + x) * 4] = PPU.screenBuffer[(canvas.width * y) + x] & 0xFF;
     //         data[((canvas.width * y) + x) * 4 + 1] = (PPU.screenBuffer[((canvas.width * y) + x)] >> 8) & 0xFF;
     //         data[((canvas.width * y) + x) * 4 + 2] = (PPU.screenBuffer[((canvas.width * y) + x)] >> 16) & 0xFF;
     //     }
     // }   
     ctx.putImageData(canvasImageData, 0, 0);
 };

 var renderFrame = function() {
     CPU.runCPU();
     renderScreen();
 };

 var screenReset = function() {
     ctx.fillStyle = 'Black';
     ctx.fillRect(0, 0, 256, 240);
 };

 var readOpcodeFile = function(e) {
     var file = e.target.files[0];
     if (!file) {
         return;
     }
     var reader = new FileReader();
     reader.onload = function() {
         this.opcodes = new Uint8Array(this.result);
         PPU = new ppu();
         MMU = new mmu(PPU);
         CPU = new cpu(MMU, PPU);
         APU = new apu(MMU);
         MMU.OAMInit();
         PPU.initScreenBuffer();
         iNES.load(this.opcodes, MMU);
         CPU.reset();
         MMU.copyCHRToGrid();
         screenReset();
     };
     reader.readAsArrayBuffer(file);
 };

 var testiNES = function() {
     // requestAnimationFrame(renderFrame);
     setInterval(renderFrame, 60.098814);
 };

 var seekPC = function() {
     var seekAddr = parseInt(document.getElementById('seekPCValue')
         .value, 16);
     while (true) {
         debugEmu();
         if (CPU.pc == seekAddr)
             break;
     }
 };

 var debugEmu = function() {
     CPU.debugCPU();
     updateDebugInfo();
 };

 var viewCHR = function() {
     MMU.copyCHRToGrid();
    //  renderCHRTiles(MMU.CHRGrid);
 };
 