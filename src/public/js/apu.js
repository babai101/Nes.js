/*global performance*/
//cycles per second = 1786830
'use strict';
import pulse from './pulse';
import triangle from './triangle';
import noise from './noise';
import RingBuffer from 'ringbufferjs';

export default function apu(nes) {
    this.nes = nes;
    this.sqe1Enabled = false;
    this.sq2Enabled = false;
    this.triangleEnabled = false;
    this.noiseEnabled = false;
    this.dmcEnabled = false;
    this.inhibitInterrupt = true;
    this.seqMode = 0;
    this.step = 0;
    this.doIrq = false;
    this.lengthCounterTbl = [10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30];
    this.noisePeriodTbl = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
    var pulse1Buffer = [];
    var pulse2Buffer = [];
    this.triangleBuffer = [];
    this.noiseBuffer = [];
    this.bufferLength = 4096;
    this.outputBuffer = new RingBuffer(this.bufferLength * 10);
    this.pulse1 = new pulse();
    this.pulse2 = new pulse();
    this.triangle1 = new triangle();
    this.noise1 = new noise();
    this.pulse1.channel = 1;
    this.pulse2.channel = 2;
    var sampleCount = 0;
    var t1 = 0;
    var t3 = 0;
    var pulseOverSamplingCycles = 0;
    var triangleOverSamplingCycles = 0;
    var overSamplingCycleRate = 20;
    var sampleCycleRate = 41;
    var samplingCycles = 0;
    var clockCycles = 0;
    var frameCycles = 0;
    this.samplingClock = performance.now();
    this.sampleTimerMax = 1000.0 / 44100.0;
    this.cyclesPerFrame = 1786830;
    this.squareTable = new Array(31);
    this.frameIRQ = false;
    
    this.init = function() {
        if (!window.AudioContext) {
            if (!window.WebkitAudioContext) {
                console.log("Could not initialize audio!");
                return;
            }
            else {
                this.audioCtx = new window.WebkitAudioContext();
            }
        }
        else {
            this.audioCtx = new window.AudioContext();
        }
        t1 = performance.now();
        this.scriptNode = this.audioCtx.createScriptProcessor(this.bufferLength, 0, 1);
        this.scriptNode.onaudioprocess = this.onaudioprocess;
        this.scriptNode.connect(this.audioCtx.destination);
        this.initSqrTable();
    };

    this.initSqrTable = function() {
        this.squareTable[0] = 0;
        for (var i = 1; i < 31; i++) {
            this.squareTable[i] = 95.88 / ((8128 / i) + 100);
        }
    };

    // 0x4015
    this.setAPUFlags = function(value) {
        if (value & 0x01 == 1) {
            this.pulse1.enabled = true;
        }
        else {
            this.pulse1.enabled = false;
        }
        if (value & 0x02 == 0x02) {
            this.pulse2.enabled = true;
        }
        else {
            this.pulse2.enabled = false;
        }
        if (value & 0x04 == 0x04) {
            this.triangle1.enabled = true;
        }
        else {
            this.triangle1.enabled = false;
        }
        if (value & 0x08 == 0x08) {
            this.noise1.enabled = true;
        }
        else {
            this.noise1.enabled = false;
        }
        if (value & 0x10 == 0x10) {
            this.dmcEnabled = true;
        }
        else {
            this.dmcEnabled = false;
        }
    };

    //Square channel 1 methods
    //0x4000
    this.setSQ1_ENV = function(value) {
        // pulse1.dividerPeriod = (value & 0x0F) + 1; //Env period
        // pulse1.dividerOriginalPeriod = pulse1.dividerPeriod;
        if ((value & 0x10) == 0x10) {
            this.pulse1.sawEnvDisable = true; //use Volume for volume
        }
        else {
            this.pulse1.sawEnvDisable = false; //use internal counter for volume
        }
        this.pulse1.volume = value & 0x0F; //Set volume 
        if ((value & 0x20) == 0x20) {
            this.pulse1.lenCounterDisable = true; //disable Length Counter
        }
        else {
            this.pulse1.lenCounterDisable = false; //use Length Counter
        }
        this.pulse1.dutyCycle = value >> 6; //set duty cycle
    };

    //Set the low 8 bits of the period
    //0x4002
    this.setSQ1_LO = function(value) {
        this.pulse1.periodLowBits = value;
        this.pulse1.period = this.pulse1.period & 0x700;
        this.pulse1.period = this.pulse1.period | this.pulse1.periodLowBits;
    };

    //Set the high 3 bits of the period if lengh counter is enabled, get the
    //counter value from the look up table
    //convert the period in to frequency
    //0x4003
    this.setSQ1_HI = function(value) {
        this.pulse1.periodHighBits = value & 0x07;
        this.pulse1.period = this.pulse1.period & 0xFF;
        this.pulse1.period = this.pulse1.period | (this.pulse1.periodHighBits << 8);
        if (this.pulse1.enabled) {
            this.pulse1.lenCounter = this.lengthCounterTbl[value >> 3];
        }
        this.pulse1.dividerPeriod = this.pulse1.volume + 1; //Restart envelop
        this.pulse1.decayLvlCount = 15;
        // this.pulse1.setVol(this.pulse1.dividerOriginalPeriod - 1);
        this.pulse1.currentSequence = 0; //restart Phase
        this.pulse1.envStartFlag = true;
    };

    //0x4001
    this.setSQ1_SWEEP = function(value) {
        if ((value >> 7) == 1) {
            this.pulse1.sweepEnabled = true;
        }
        else {
            this.pulse1.sweepEnabled = false;
        }
        this.pulse1.sweepDividerPeriod = ((value & 0x70) >> 4) + 1;
        this.pulse1.sweepCount = this.pulse1.sweepDividerPeriod;
        this.pulse1.sweepNegate = (value & 0x08) >> 3;
        this.pulse1.sweepShiftCount = value & 0x07;
        this.pulse1.sweepReloadFlag = true;
    };

    //Square Channel 2 methods
    this.setSQ2_ENV = function(value) {
        // pulse2.dividerPeriod = (value & 0x0F) + 1; //Env period
        // pulse2.dividerOriginalPeriod = pulse2.dividerPeriod;
        this.pulse2.volume = value & 0x0F; //Set volume 
        if ((value & 0x10) == 0x10) {
            this.pulse2.sawEnvDisable = true; //use Volume for volume
        }
        else {
            this.pulse2.sawEnvDisable = false; //use internal counter for volume
        }
        if ((value & 0x20) == 0x20) {
            this.pulse2.lenCounterDisable = true; //disable Length Counter
        }
        else {
            this.pulse2.lenCounterDisable = false; //use Length Counter
        }
        this.pulse2.dutyCycle = value >> 6; //set duty cycle
    };

    this.setSQ2_LO = function(value) {
        this.pulse2.periodLowBits = value;
        this.pulse2.period = this.pulse2.period & 0x700;
        this.pulse2.period = this.pulse2.period | this.pulse2.periodLowBits;
    };

    this.setSQ2_HI = function(value) {
        this.pulse2.periodHighBits = value & 0x07;
        this.pulse2.period = this.pulse2.period & 0xFF;
        this.pulse2.period = this.pulse2.period | (this.pulse2.periodHighBits << 8);
        if (this.pulse2.enabled) {
            this.pulse2.lenCounter = this.lengthCounterTbl[value >> 3];
        }
        this.pulse2.dividerPeriod = this.pulse2.volume + 1; //Restart envelop
        this.pulse2.decayLvlCount = 15;
        this.pulse1.currentSequence = 0;
        this.pulse2.envStartFlag = true;
    };

    this.setSQ2_SWEEP = function(value) {
        if ((value >> 7) == 1) {
            this.pulse2.sweepEnabled = true;
        }
        else {
            this.pulse2.sweepEnabled = false;
        }
        this.pulse2.sweepDividerPeriod = ((value & 0x70) >> 4) + 1;
        this.pulse2.sweepCount = this.pulse2.sweepDividerPeriod;
        this.pulse2.sweepNegate = (value & 0x08) >> 3;
        this.pulse2.sweepShiftCount = value & 0x07;
        this.pulse2.sweepReloadFlag = true;
    };

    this.setTRIControl = function(value) {
        if ((value >> 7) == 1) {
            this.triangle1.controlFlag = true;
        }
        else {
            this.triangle1.controlFlag = false;
        }
        this.triangle1.counterReload = value & 0x7F;
    };

    this.setTRI_LO = function(value) {
        this.triangle1.periodLowBits = value & 0xFF;
        this.triangle1.period = this.triangle1.period & 0x700;
        this.triangle1.period = this.triangle1.period | this.triangle1.periodLowBits;
    };

    this.setTRI_HI = function(value) {
        this.triangle1.periodHighBits = value & 0x07;
        this.triangle1.period = this.triangle1.period & 0xFF;
        this.triangle1.period = this.triangle1.period | (this.triangle1.periodHighBits << 8);
        if (this.triangle1.enabled)
            this.triangle1.lenCounter = this.lengthCounterTbl[value >> 3];
        this.triangle1.linearCounterReloadFlag = true;
    };

    //0x400C
    this.setNoise_ENV = function(value) {
        this.noise1.volume = value & 0x0F; //Set volume 
        if ((value & 0x10) == 0x10) {
            this.noise1.sawEnvDisable = true; //use Volume for volume
        }
        else {
            this.noise1.sawEnvDisable = false; //use internal counter for volume
        }
        if ((value & 0x20) == 0x20) {
            this.noise1.lenCounterDisable = true; //disable Length Counter
        }
        else {
            this.noise1.lenCounterDisable = false; //use Length Counter
        }
    };

    //0x400E 
    this.setNoise_Period = function(value) {
        if (value & 0x80 == 0x80) {
            this.noise1.modeFlag = true;
        }
        else {
            this.noise1.modeFlag = false;
        }
        this.noise1.originalPeriod = this.noisePeriodTbl[value & 0x0F];
        this.noise1.period = this.noise1.originalPeriod;
    };

    //0x400F
    this.setNoise_LenEnv = function(value) {
        if (this.noise1.enabled)
            this.noise1.lenCounter = this.lengthCounterTbl[value >> 3];
        this.noise1.dividerPeriod = this.noise1.volume + 1; //Restart envelop
        this.noise1.decayLvlCount = 15;
    };

    this.setFrameCounter = function(value) {
        this.seqMode = value >> 7; //Sequencer mode
        if ((value & 0x40) == 0x40) {
            this.inhibitInterrupt = true;
        }
        else {
            this.inhibitInterrupt = false;
        }
    };

    this.onaudioprocess = (e) => {
        //Thansk Ben Firshman!!!
        // var channelData = e.outputBuffer.getChannelData(0);
        // var size = channelData.length;
        // if (this.outputBuffer.size() < size) {
        //     // console.log(
        //         // "Buffer underrun, running another frame to try and catch up"
        //     // );
        //     this.nes.CPU.run();

        //     if (this.outputBuffer.size() < size) {
        //         // console.log("Still buffer underrun, running a second frame");
        //         this.nes.CPU.run();
        //     }
        // }
        // try {
        //     var samples = this.outputBuffer.deqN(size);
        // }
        // catch (e) {
        //     // onBufferUnderrun failed to fill the buffer, so handle a real buffer
        //     // underrun
        //     // ignore empty buffers... assume audio has just stopped
        //     var bufferSize = this.outputBuffer.size();
        //     if (bufferSize > 0) {
        //         // console.log(`Buffer underrun (needed ${size}, got ${bufferSize})`);
        //     }
        //     for (var j = 0; j < bufferSize; j++) {
        //         channelData[j] = 0;
        //     }
        //     return;
        // }
        // for (var i = 0; i < size; i++) {
        //     channelData[i] = samples[i];
        // }
    };

    this.sample = function() {
        var pulse1Output = Math.floor(pulse1Buffer.reduce((a, b) => a + b, 0));
        if (pulse1Output != 0)
            pulse1Output = pulse1Output / pulse1Buffer.length;
        var pulse2Output = Math.floor(pulse2Buffer.reduce((a, b) => a + b, 0));
        if (pulse2Output != 0)
            pulse2Output = pulse2Output / pulse2Buffer.length;
        var triangleOutput = Math.floor(this.triangleBuffer.reduce((a, b) => a + b, 0));
        if (triangleOutput != 0)
            triangleOutput = triangleOutput / this.triangleBuffer.length;
        var noiseOutput = Math.floor(this.noiseBuffer.reduce((a, b) => a + b, 0));
        if (noiseOutput != 0)
            noiseOutput = noiseOutput / this.noiseBuffer.length;
        pulse1Buffer = [];
        pulse2Buffer = [];
        this.triangleBuffer = [];
        this.noiseBuffer = [];
        var pulseOutput = 0;
        if (triangleOutput != 0 || noiseOutput != 0)
            triangleOutput = 159.79 / (1 / ((triangleOutput / 8227) + (noiseOutput / 12241)) + 100);
        if (pulse1Output != 0 || pulse2Output != 0)
            pulseOutput = 95.88 / ((8128 / (pulse1Output + pulse2Output)) + 100);
        // output = this.squareTable[pulse1Output + pulse2Output];
        this.pushToBuffer(pulseOutput + triangleOutput);
        // this.pushToBuffer(triangleOutput);
    };

    this.pushToBuffer = function(data) {
        // if (this.outputBuffer.size() >= this.bufferLength)
        //     return;
        this.outputBuffer.enq(data);
    };

    this.run = function() {
        clockCycles++;
        // if (clockCycles % 2 == 0) {
        if ((clockCycles & 1) == 0) {
            this.pulse1.clock();
            this.pulse2.clock();
            clockCycles = 0;
        }
        this.triangle1.clock();
        this.noise1.clock();
        pulseOverSamplingCycles++;
        if (pulseOverSamplingCycles >= overSamplingCycleRate) {
            pulseOverSamplingCycles -= overSamplingCycleRate;
            pulse1Buffer.push(this.pulse1.output());
            pulse2Buffer.push(this.pulse2.output());
        }
        triangleOverSamplingCycles++;
        if (triangleOverSamplingCycles >= overSamplingCycleRate) {
            triangleOverSamplingCycles -= overSamplingCycleRate;
            this.triangleBuffer.push(this.triangle1.output());
            this.noiseBuffer.push(this.noise1.output());
        }
        samplingCycles++;
        if (samplingCycles >= sampleCycleRate) {
            samplingCycles -= sampleCycleRate;
            this.sample();
            if (sampleCycleRate == 40)
                sampleCycleRate = 41;
            else if (sampleCycleRate == 41)
                sampleCycleRate = 40;
        }
        frameCycles++;
        if (frameCycles >= 7457) {
            frameCycles -= 7457;
            if (this.seqMode == 0) {
                this.do4StepSeq();
            }
            else {
                this.do5StepSeq();
            }
        }
    };

    this.do4StepSeq = function() {
        this.pulse1.updateEnvelope();
        this.pulse2.updateEnvelope();
        this.triangle1.updateLinearCounter();
        this.noise1.updateEnvelope();
        if (this.step % 2 === 1) {
            this.pulse1.updSweepAndLengthCounter();
            this.pulse2.updSweepAndLengthCounter();
            this.triangle1.updateLenCounter();
            this.noise1.updateLenCounter();
        }
        this.step++;
        if (this.step === 4) {
            if (!this.inhibitInterrupt) {
                this.frameIRQ = true;
                // if ((this.nes.CPU.P >> 2) & 0x01 == 0x01) { //IRQ is enabled
                // if (!(this.nes.CPU.P & 0x04)) { //IRQ is enabled
                    this.nes.CPU.elapsedCycles = 0;
                    this.nes.CPU.serveISR('IRQ');
                    this.nes.CPU.cpuClockRemaining += this.nes.CPU.elapsedCycles;
                // }
            }
            this.step = 0;
        }
    };

    this.do5StepSeq = function() {
        if (this.step % 2 === 0) {
            this.pulse1.updSweepAndLengthCounter();
            this.pulse2.updSweepAndLengthCounter();
            this.triangle1.updateLenCounter();
            this.noise1.updateLenCounter();
        }
        this.step++;
        if (this.step === 5) {
            this.step = 0;
        }
        else {
            this.pulse1.updateEnvelope();
            this.pulse2.updateEnvelope();
            this.noise1.updateEnvelope();
            this.triangle1.updateLinearCounter();
        }
    };
}
