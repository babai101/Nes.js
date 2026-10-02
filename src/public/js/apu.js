/*global performance*/
//cycles per second = 1786830
'use strict';
import pulse from './pulse';
import triangle from './triangle';
import noise from './noise';
import RingBuffer from 'ringbufferjs';

// One AudioContext for the whole page, reused when a new game is loaded.
// Browsers limit how many contexts a page may open, and a context that is
// left running keeps calling its onaudioprocess handler.
var sharedAudioCtx = null;
var workletReady = null;   // Promise<boolean>: true once the worklet module has loaded
var WORKLET_URL = '/public/js/nes-audio-worklet.js';
var CHUNK_SIZE = 512;      // samples per message to the worklet (~12 ms)

function getAudioContext() {
    if (sharedAudioCtx)
        return sharedAudioCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
        console.log("Could not initialize audio!");
        return null;
    }
    // The APU produces about 44,100 samples per second (one every 40.5 CPU
    // cycles), so ask for that rate. Otherwise a 48 kHz device drains the
    // buffer faster than it is filled and the game speeds up to catch up.
    try {
        sharedAudioCtx = new AC({ sampleRate: 44100 });
    }
    catch (e) {
        sharedAudioCtx = new AC();   // older browsers don't accept options
    }
    // Browsers start audio "suspended" until the user interacts with the page.
    // Resume on the first key press or click.
    var resume = function() {
        if (sharedAudioCtx.state === 'suspended')
            sharedAudioCtx.resume();
    };
    window.addEventListener('keydown', resume);
    window.addEventListener('pointerdown', resume);
    resume();

    // AudioWorklet plays the sound on the browser's audio thread. It is only
    // available on secure pages (https:// or http://localhost); elsewhere we
    // fall back to the older ScriptProcessorNode.
    if (sharedAudioCtx.audioWorklet) {
        workletReady = sharedAudioCtx.audioWorklet.addModule(WORKLET_URL)
            .then(function() { return true; })
            .catch(function(e) {
                console.log('Could not load the audio worklet, using ScriptProcessorNode instead.', e);
                return false;
            });
    }
    else {
        workletReady = Promise.resolve(false);
    }
    return sharedAudioCtx;
}

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
    this.bufferLength = 1024;
    this.outputBuffer = new RingBuffer(this.bufferLength * 10);
    this.pulse1 = new pulse();
    this.pulse2 = new pulse();
    this.triangle1 = new triangle();
    this.noise1 = new noise();
    this.pulse1.channel = 1;
    this.pulse2.channel = 2;

    // --- Turning the 1.79 MHz mixer output into 44.2 kHz audio ---
    // Square waves have overtones far above what 44 kHz audio can hold; if
    // they are not removed before sampling, they fold back down as audible,
    // out-of-tune tones (aliasing). Two stages remove them:
    //  1. average the mixer output over every CPU cycle, in blocks of a
    //     quarter of an output sample (10.125 cycles, i.e. 176.8 kHz);
    //  2. low-pass those blocks with a 31-tap FIR filter (cutoff 19 kHz) and
    //     keep every 4th result: one output sample per 40.5 CPU cycles.
    var CYCLES_PER_SAMPLE = 40.5;
    var OVERSAMPLE = 4;
    var CYCLES_PER_BLOCK = CYCLES_PER_SAMPLE / OVERSAMPLE;
    var mixSum = 0;
    var mixCount = 0;
    var currentMix = 0;
    var blockPhase = 0;

    var FIR_TAPS = 31;
    var firCoefs = (function() {   // Blackman-windowed sinc, normalised to a gain of 1
        var c = new Float64Array(FIR_TAPS), fc = 19000 / (1789773 / CYCLES_PER_BLOCK), sum = 0;
        for (var i = 0; i < FIR_TAPS; i++) {
            var n = i - (FIR_TAPS - 1) / 2;
            var sinc = n === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * n) / (Math.PI * n);
            var w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (FIR_TAPS - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (FIR_TAPS - 1));
            c[i] = sinc * w;
            sum += c[i];
        }
        for (var j = 0; j < FIR_TAPS; j++) c[j] /= sum;
        return c;
    })();
    var firHistory = new Float64Array(FIR_TAPS * 2);   // doubled so the window is always contiguous
    var firPos = 0;
    var blocksUntilSample = OVERSAMPLE;

    var pushBlock = function(value) {
        firHistory[firPos] = value;
        firHistory[firPos + FIR_TAPS] = value;
        firPos = (firPos + 1) % FIR_TAPS;
        if (--blocksUntilSample > 0)
            return undefined;
        blocksUntilSample = OVERSAMPLE;
        var acc = 0;
        for (var i = 0; i < FIR_TAPS; i++)
            acc += firCoefs[i] * firHistory[firPos + i];
        return acc;
    };

    // The NES (and the TV it was plugged into) filtered its sound with two
    // high-pass filters (90 Hz, 440 Hz) and a low-pass filter (14 kHz).
    // These are one-pole versions of them, run at the output sample rate.
    var SAMPLE_RATE = 1789773 / CYCLES_PER_SAMPLE;
    var highPassCoef = function(cutoff) {
        var rc = 1 / (2 * Math.PI * cutoff), dt = 1 / SAMPLE_RATE;
        return rc / (rc + dt);
    };
    var lowPassCoef = function(cutoff) {
        var rc = 1 / (2 * Math.PI * cutoff), dt = 1 / SAMPLE_RATE;
        return dt / (rc + dt);
    };
    var hp90 = highPassCoef(90), hp440 = highPassCoef(440), lp14k = lowPassCoef(14000);
    var hp90In = 0, hp90Out = 0, hp440In = 0, hp440Out = 0, lp14kOut = 0;
    var clockCycles = 0;
    var frameCycles = 0;
    this.sampleCount = 0;
    this.sampleTimerMax = 1000.0 / 44100.0;
    this.cyclesPerFrame = 1786830;
    var squareTable = new Float64Array(31);     // pulse 1 + pulse 2 mix, from nesdev
    var triangleTable = new Float64Array(203);  // triangle + noise (+ DMC) mix, from nesdev
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

        this.audioCtx = getAudioContext();
        if (this.audioCtx) {
            var self = this;
            workletReady.then(function(ok) {
                if (self.stopped)
                    return;   // a new game was loaded before the worklet finished loading
                if (ok) {
                    self.workletNode = new AudioWorkletNode(self.audioCtx, 'nes-audio', {
                        numberOfInputs: 0,
                        numberOfOutputs: 1,
                        outputChannelCount: [1]
                    });
                    self.workletNode.connect(self.audioCtx.destination);
                }
                else {
                    self.scriptNode = self.audioCtx.createScriptProcessor(self.bufferLength, 0, 1);
                    self.scriptNode.onaudioprocess = self.onaudioprocess;
                    self.scriptNode.connect(self.audioCtx.destination);
                }
            });
        }
        initMixesLkpTables();
    };

    // Disconnect this APU's audio output, e.g. before loading another game.
    // Without this the old output keeps running, and on every buffer
    // underrun it runs extra CPU frames, which makes the game speed up.
    this.stop = function() {
        this.stopped = true;
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode.port.close();
            this.workletNode = null;
        }
        if (this.scriptNode) {
            this.scriptNode.onaudioprocess = null;
            this.scriptNode.disconnect();
            this.scriptNode = null;
        }
    };

    // 0x4015
    this.setAPUFlags = function(value) {
        if ((value & 0x01) != 0) {
            this.pulse1.enabled = true;
        }
        else {
            this.pulse1.enabled = false;
            this.pulse1.lenCounter = 0;
        }
        if ((value & 0x02) != 0) {
            this.pulse2.enabled = true;
        }
        else {
            this.pulse2.enabled = false;
            this.pulse2.lenCounter = 0;
        }
        if ((value & 0x04) != 0) {
            this.triangle1.enabled = true;
        }
        else {
            this.triangle1.enabled = false;
            this.triangle1.lenCounter = 0;
        }
        if ((value & 0x08) != 0) {
            this.noise1.enabled = true;
        }
        else {
            this.noise1.enabled = false;
            this.noise1.lenCounter = 0;
        }
        if ((value & 0x10) != 0) {
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
        this.pulse1.period = this.pulse1.period | (this.pulse1.periodHighBits << 8);   // timer period = 11-bit value; the +1 is already in the countdown
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
        this.pulse2.currentSequence = 0; //restart Phase (was resetting pulse 1 by mistake)
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
        this.triangle1.period = this.triangle1.period | (this.triangle1.periodHighBits << 8);   // timer period = 11-bit value; the +1 is already in the countdown
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
        if ((value & 0x80) != 0) {
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

    // x: one band-limited sample from the FIR stage
    this.sample = function(x) {
        // NES output filters. The high-pass filters also remove the constant
        // offset of the mixer output, so silence is 0.
        hp90Out = hp90 * (hp90Out + x - hp90In);
        hp90In = x;
        hp440Out = hp440 * (hp440Out + hp90Out - hp440In);
        hp440In = hp90Out;
        lp14kOut += lp14k * (hp440Out - lp14kOut);
        this.pushToBuffer(lp14kOut);
    };

    // Samples for the worklet are collected into chunks and posted together.
    var chunk = new Float32Array(CHUNK_SIZE);
    var chunkLength = 0;

    this.pushToBuffer = function(data) {
        if (this.workletNode) {
            chunk[chunkLength++] = data;
            if (chunkLength === CHUNK_SIZE) {
                // transfer the buffer instead of copying it, then start a new one
                this.workletNode.port.postMessage(chunk, [chunk.buffer]);
                chunk = new Float32Array(CHUNK_SIZE);
                chunkLength = 0;
            }
            return;
        }
        if (!this.scriptNode)
            return;   // audio not ready (or not available): drop the sample
        this.outputBuffer.enq(data);
    };

    this.run = function() {
        clockCycles++;
        this.triangle1.clock();
        this.noise1.clock();
        if ((clockCycles & 1) == 0) {
            this.pulse1.clock();
            this.pulse2.clock();
            clockCycles = 0;
            // Mix the channels as the NES does (non-linear, via lookup tables).
            // Done once per APU cycle (every 2 CPU cycles): the pulses only
            // change then, and a triangle/noise change showing up one CPU
            // cycle late makes no audible difference. Halves the mixing cost.
            currentMix = squareTable[this.pulse1.output() + this.pulse2.output()] +
                triangleTable[3 * this.triangle1.output() + 2 * this.noise1.output()];
        }
        mixSum += currentMix;
        mixCount++;
        blockPhase++;
        if (blockPhase >= CYCLES_PER_BLOCK) {
            blockPhase -= CYCLES_PER_BLOCK;
            var filtered = pushBlock(mixSum / mixCount);
            mixSum = 0;
            mixCount = 0;
            if (filtered !== undefined) {
                this.sample(filtered);
                this.sampleCount++;
            }
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
