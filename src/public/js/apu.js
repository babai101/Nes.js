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
    this.inhibitInterrupt = false;
    this.seqMode = 0;
    this.step = 0;
    this.doIrq = false;
    this.lengthCounterTbl = [10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30];
    this.noisePeriodTbl = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
    var pulse1Buffer = [];
    var pulse2Buffer = [];
    this.triangleBuffer = [];
    this.noiseBuffer = [];
    this.bufferLength = 1024;
    this.outputBuffer = new RingBuffer(this.bufferLength * 10);
    this.pulse1 = new pulse();
    this.pulse2 = new pulse();
    this.triangle1 = new triangle();
    this.noise1 = new noise();
    this.pulse1.channel = 1;
    this.pulse2.channel = 2;

    var overSamplingCycles = 0;
    // var triangleOverSamplingCycles = 0;
    var overSamplingCycleRate = 20;
    var sampleCycleRate = 41;
    var samplingCycles = 0;
    this.prevSampleL = 0;
    this.smpAccumL = 0;
    var clockCycles = 0;
    var frameCycles = 0;
    this.sampleCount = 0;
    this.sampleTimerMax = 1000.0 / 44100.0;
    this.cyclesPerFrame = 1786830;
    var squareTable = new Array(31);
    var triangleTable = new Array(203);
    this.frameIRQ = false;

    var initMixesLkpTables = function() {
        squareTable[0] = 0;
        for (var i = 1; i < 31; i++) {
            squareTable[i] = 95.52 / ((8128 / i) + 100);
        }
        triangleTable[0] = 0;
        for (var i = 1; i < 203; i++) {
            triangleTable[i] = 163.67 / ((24329.0 / i) + 100);
        }
    };

    this.init = function() {
        // const AudioContext = window.AudioContext || window.webkitAudioContext;

        // const audioContext = new AudioContext();

        // var AudioContext = window.AudioContext || window.webkitAudioContext;
        // this.audioCtx = new AudioContext();
        // if (!window.AudioContext) {
        //     if (!window.WebkitAudioContext) {
        //         console.log("Could not initialize audio!");
        //         return;
        //     }
        //     else {
        //         this.audioCtx = new window.WebkitAudioContext();
        //     }
        // }
        // else {
        //     this.audioCtx = new window.AudioContext();
        // }
        // this.scriptNode = this.audioCtx.createScriptProcessor(this.bufferLength, 0, 1);
        // this.scriptNode.onaudioprocess = this.onaudioprocess;
        // this.scriptNode.connect(this.audioCtx.destination);
        initMixesLkpTables();
    };

    // 0x4015
    this.setAPUFlags = function(value) {
        if (value & 0x01 == 1) {
            this.pulse1.enabled = true;
        }
        else {
            this.pulse1.enabled = false;
            this.pulse1.lenCounter = 0;
        }
        if (value & 0x02 == 0x02) {
            this.pulse2.enabled = true;
        }
        else {
            this.pulse2.enabled = false;
            this.pulse2.lenCounter = 0;
        }
        if (value & 0x04 == 0x04) {
            this.triangle1.enabled = true;
        }
        else {
            this.triangle1.enabled = false;
            this.triangle1.lenCounter = 0;
        }
        if (value & 0x08 == 0x08) {
            this.noise1.enabled = true;
        }
        else {
            this.noise1.enabled = false;
            this.noise1.lenCounter = 0;
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
        this.pulse1.timerPeriod = this.pulse1.period;
        this.pulse1.updateTargetPeriod();
    };

    //Set the high 3 bits of the period if lengh counter is enabled, get the
    //counter value from the look up table
    //convert the period in to frequency
    //0x4003
    this.setSQ1_HI = function(value) {
        this.pulse1.periodHighBits = value & 0x07;
        this.pulse1.period = this.pulse1.period & 0xFF;
        this.pulse1.period = this.pulse1.period | (this.pulse1.periodHighBits << 8) + 1;
        this.pulse1.timerPeriod = this.pulse1.period;
        if (this.pulse1.enabled) {
            this.pulse1.lenCounter = this.lengthCounterTbl[value >> 3];
        }
        this.pulse1.dividerPeriod = this.pulse1.volume + 1;
        this.pulse1.currentSequence = 0; //restart Phase
        this.pulse1.envStartFlag = true;
        this.pulse1.updateTargetPeriod();
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
        this.pulse1.sweepNegate = (value & 0x08) >> 3;
        this.pulse1.sweepShiftCount = value & 0x07;
        this.pulse1.sweepReloadFlag = true;
    };

    //Square Channel 2 methods
    this.setSQ2_ENV = function(value) {
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
        this.pulse2.timerPeriod = this.pulse2.period;
        this.pulse2.updateTargetPeriod();
    };

    this.setSQ2_HI = function(value) {
        this.pulse2.periodHighBits = value & 0x07;
        this.pulse2.period = this.pulse2.period & 0xFF;
        this.pulse2.period = this.pulse2.period | (this.pulse2.periodHighBits << 8);
        this.pulse2.timerPeriod = this.pulse2.period;
        if (this.pulse2.enabled) {
            this.pulse2.lenCounter = this.lengthCounterTbl[value >> 3];
        }
        this.pulse2.dividerPeriod = this.pulse2.volume + 1; //Restart envelop
        this.pulse1.currentSequence = 0;
        this.pulse2.envStartFlag = true;
        this.pulse2.updateTargetPeriod();
    };

    this.setSQ2_SWEEP = function(value) {
        if ((value >> 7) == 1) {
            this.pulse2.sweepEnabled = true;
        }
        else {
            this.pulse2.sweepEnabled = false;
        }
        this.pulse2.sweepDividerPeriod = ((value & 0x70) >> 4) + 1;
        // this.pulse2.sweepCount = this.pulse2.sweepDividerPeriod;
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
        this.triangle1.period = this.triangle1.period | (this.triangle1.periodHighBits << 8) + 1;
        // if (this.triangle1.enabled)
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
        // if (this.noise1.enabled)
        this.noise1.lenCounter = this.lengthCounterTbl[value >> 3];
        this.noise1.dividerPeriod = this.noise1.volume + 1; //Restart envelop
        // this.noise1.decayLvlCount = 15;
    };

    this.setFrameCounter = function(value) {
        this.seqMode = value >> 7; //Sequencer mode
        this.step = 0;
        frameCycles = 0;
        if ((value & 0x40) == 0x40) {
            this.inhibitInterrupt = true;
            this.frameIRQ = false;
        }
        else {
            this.inhibitInterrupt = false;
        }
        if ((value & 0x80) == 0x80) {
            this.updateEnvelopes();
            this.updateLenCounters();
            this.step = 0;
        }
        else {
            this.step = 0;
        }
    };

    this.onaudioprocess = (e) => {
        // //Thansk Ben Firshman!!!
        // run once and check for underrrun
        var channelData = e.outputBuffer.getChannelData(0);
        var size = channelData.length;
        if (this.outputBuffer.size() < size) {
            console.log("buffer underrun, running cpu to generate more samples.")
            // this.nes.CPU.runPPU = false;
            this.nes.CPU.frame();
            // this.nes.CPU.runPPU = true;
        }
        
        try {
            var samples = this.outputBuffer.deqN(size);
        }
        catch (e) {
            // onBufferUnderrun failed to fill the buffer, so handle a real buffer
            // underrun
            // ignore empty buffers... assume audio has just stopped
            var bufferSize = this.outputBuffer.size();
            // if (bufferSize > 0) {
            //     // console.log(`Buffer underrun (needed ${size}, got ${bufferSize})`);
            // }
            for (var j = 0; j < bufferSize; j++) {
                channelData[j] = 0;
            }
            return;
        }
        for (var i = 0; i < size; i++) {
            channelData[i] = samples[i];
        }
    };

    this.sample = function() {
        var pulse1Output = (pulse1Buffer.reduce((a, b) => a + b, 0));
        if (pulse1Output != 0)
            pulse1Output = Math.floor(pulse1Output / pulse1Buffer.length);
        var pulse2Output = (pulse2Buffer.reduce((a, b) => a + b, 0));
        if (pulse2Output != 0)
            pulse2Output = Math.floor(pulse2Output / pulse2Buffer.length);
        var triangleOutput = 0;
        triangleOutput = (this.triangleBuffer.reduce((a, b) => a + b, 0));
        if (triangleOutput != 0)
            triangleOutput = Math.floor(triangleOutput / this.triangleBuffer.length);
        var noiseOutput = (this.noiseBuffer.reduce((a, b) => a + b, 0));
        if (noiseOutput != 0)
            noiseOutput = Math.floor(noiseOutput / this.noiseBuffer.length);
        pulse1Buffer = [];
        pulse2Buffer = [];
        this.triangleBuffer = [];
        this.noiseBuffer = [];
        var pulseOutput = 0;
        if (triangleOutput != 0 || noiseOutput != 0) {
            triangleOutput = 159.79 / (1 / ((triangleOutput / 8227) + (noiseOutput / 12241)) + 100);
            // triangleOutput = triangleTable[3 * triangleOutput + 2 * noiseOutput + 0];
            // triangleOutput = 0.00851 * triangleOutput + 0.00494 * noiseOutput;
        }
        if (pulse1Output != 0 || pulse2Output != 0) {
            pulseOutput = 95.88 / ((8128 / (pulse1Output + pulse2Output)) + 100);
            // pulseOutput = squareTable[pulse1Output + pulse2Output];
        }
        var output = pulseOutput + triangleOutput - 0.762664795;

        var smpDiffL = output - this.prevSampleL;
        this.prevSampleL += smpDiffL;
        this.smpAccumL += smpDiffL - (this.smpAccumL >> 10);
        output = this.smpAccumL;
        this.pushToBuffer(output);
    };

    this.pushToBuffer = function(data) {
        this.outputBuffer.enq(data);
    };

    this.run = function() {
        clockCycles++;
        if ((clockCycles & 1) == 0) {
            this.pulse1.clock();
            this.pulse2.clock();
            clockCycles = 0;
        }
        this.triangle1.clock();
        this.noise1.clock();
        overSamplingCycles++;
        if (overSamplingCycles >= overSamplingCycleRate) {
            overSamplingCycles -= overSamplingCycleRate;
            pulse1Buffer.push(this.pulse1.output());
            pulse2Buffer.push(this.pulse2.output());
            this.triangleBuffer.push(this.triangle1.output());
            this.noiseBuffer.push(this.noise1.output());
        }
        samplingCycles++;
        if (samplingCycles >= sampleCycleRate) {
            samplingCycles -= sampleCycleRate;
            this.sample();
            this.sampleCount++;
            if (sampleCycleRate == 40)
                sampleCycleRate = 41;
            else if (sampleCycleRate == 41)
                sampleCycleRate = 40;
        }

        switch (frameCycles) {
            case 7457:
            case 14913:
            case 22371:
                this.doStep();
                break;
            case 29828:
                if (this.seqMode == 0) {
                    if (!this.inhibitInterrupt) {
                        this.setFrameIRQ();
                    }
                }
                break;
            case 29829:
                this.do4StepSeq();
                break;
            case 29830:
                if (this.seqMode == 0) {
                    frameCycles = 0;
                    if (!this.inhibitInterrupt) {
                        this.setFrameIRQ();
                    }
                    return;
                }
                break;
            case 37281:
                this.do5StepSeq();
                break;
            case 37282:
                if (this.seqMode == 1) {
                    frameCycles = 0;
                    return;
                }
                break;
        }
        frameCycles++;
    };

    this.doStep = function() {
        if (this.seqMode == 0) {
            this.do4StepSeq();
        }
        else {
            this.do5StepSeq();
        }
    };

    this.setFrameIRQ = function() {
        this.frameIRQ = true;
        // if ((this.nes.CPU.P >> 2) & 0x01 == 0x01) { //IRQ is enabled
        //     if (!(this.nes.CPU.P & 0x04)) { //IRQ is enabled
                this.nes.CPU.IRQToRun = 3;
            // }
        // }
    };

    this.updateEnvelopes = function() {
        this.pulse1.updateEnvelope();
        this.pulse2.updateEnvelope();
        this.triangle1.updateLinearCounter();
        this.noise1.updateEnvelope();
    };

    this.updateLenCounters = function() {
        this.pulse1.updSweepAndLengthCounter();
        this.pulse2.updSweepAndLengthCounter();
        this.triangle1.updateLenCounter();
        this.noise1.updateLenCounter();
    };

    this.do4StepSeq = function() {
        if (this.seqMode == 0) {
            this.updateEnvelopes();
            if (this.step % 2 === 1) {
                this.updateLenCounters();
            }
            this.step++;
            if (this.step === 4) {
                if (!this.inhibitInterrupt) {
                    this.setFrameIRQ();
                }
                this.step = 0;
            }
        }
    };

    this.do5StepSeq = function() {
        if (this.seqMode == 1) {
            this.updateEnvelopes();
            if (this.step % 2 === 0) {
                this.updateLenCounters();
            }
            this.step++;
            if (this.step === 4) {
                this.step = 0;
            }
        }
    };
}
