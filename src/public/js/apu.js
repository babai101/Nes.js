/*global performance*/
//cycles per second 1786830
import pulse from './pulse';
import triangle from './triangle';
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
    this.cycles = 0;
    this.sampleCycles = 0;
    this.overSamplingCycles = 0;
    this.sampleCycleRate = 39;
    this.step = 0;
    this.doIrq = false;
    this.lengthCounterTbl = [10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30];
    this.volumeLkpTbl = [-40.00, -24.44, -19.17, -15.92, -13.15, -11.06, -9.37, -7.96, -6.74, -5.68, -4.73, -2.38, -1.72, -1.11, -0.54, 0.00];
    this.pulse1Buffer = [];
    this.pulse2Buffer = [];
    // this.outputBuffer = new Array(this.bufferLength);
    this.bufferLength = 4096;
    this.outputBuffer = new RingBuffer(this.bufferLength * 50);
    this.bufferIndex = 0;
    var pulse1 = new pulse(nes);
    var pulse2 = new pulse(nes);
    var triangle1 = new triangle(nes);
    pulse1.channel = 1;
    pulse2.channel = 2;
    this.clock = true;
    var sampleCount = 0;
    var t1 = 0;
    var t3 = 0;
    var enqueCount = 0;
    var apuExtraClock = 0;
    this.samplingClock = performance.now();
    this.sampleTimerMax = 1000.0 / 44100.0;
    this.cyclesPerFrame = 1786830;
    this.squareTable = new Array(31);
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
        // Create the filter
        // var lowPassFilter = this.audioCtx.createBiquadFilter();
        // var highPassFilter1 = this.audioCtx.createBiquadFilter();
        // var highPassFilter2 = this.audioCtx.createBiquadFilter();
        // lowPassFilter.type = 'lowpass';
        // lowPassFilter.frequency.value = 14000; // Set cutoff to 440 HZ
        // highPassFilter1.type = 'highpass';
        // lowPassFilter.frequency.value = 90; // Set cutoff to 440 HZ
        // highPassFilter2.type = 'highpass';
        // highPassFilter2.frequency.value = 440; // Set cutoff to 440 HZ
        // this.scriptNode.connect(highPassFilter1);
        // highPassFilter1.connect(highPassFilter2);
        // highPassFilter2.connect(lowPassFilter);
        // lowPassFilter.connect(this.audioCtx.destination);
        this.initSqrTable();
    };
    
    this.initSqrTable = function() {
        this.squareTable[0] = 0;
        for(var i = 1; i < 31; i++) {
            this.squareTable[i] = 95.88 / ((8128 / i) + 100);
        }
    };

    // 0x4015
    this.setAPUFlags = function(value) {
        if (value & 0x01 == 1) {
            pulse1.enabled = true;
        }
        else {
            pulse1.enabled = false;
        }
        if (value & 0x02 == 0x02) {
            pulse2.enabled = true;
        }
        else {
            pulse2.enabled = false;
        }
        if (value & 0x04 == 0x04) {
            triangle1.enabled = true;
        }
        else {
            triangle1.enabled = false;
        }
        if (value & 0x08 == 0x08) {
            this.noiseEnabled = true;
        }
        else {
            this.noiseEnabled = false;
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
        pulse1.dividerPeriod = (value & 0x0F) + 1; //Env period
        pulse1.dividerOriginalPeriod = pulse1.dividerPeriod;
        if ((value & 0x10) == 0x10) {
            pulse1.sawEnvDisable = true; //use Volume for volume
        }
        else {
            pulse1.sawEnvDisable = false; //use internal counter for volume
        }
        pulse1.volume = value & 0x0F; //Set volume 
        if ((value & 0x20) == 0x20) {
            pulse1.lenCounterDisable = true; //disable Length Counter
        }
        else {
            pulse1.lenCounterDisable = false; //use Length Counter
        }
        pulse1.dutyCycle = value >> 6; //set duty cycle
    };

    //Set the low 8 bits of the period
    //0x4002
    this.setSQ1_LO = function(value) {
        pulse1.periodLowBits = value;
        pulse1.period = pulse1.period & 0x700;
        pulse1.period = pulse1.period | pulse1.periodLowBits;
    };

    //Set the high 3 bits of the period if lengh counter is enabled, get the
    //counter value from the look up table
    //convert the period in to frequency
    //0x4003
    this.setSQ1_HI = function(value) {
        pulse1.periodHighBits = value & 0x07;
        pulse1.period = pulse1.period & 0xFF;
        pulse1.period = pulse1.period | (pulse1.periodHighBits << 8);
        if (pulse1.enabled) {
            pulse1.lenCounter = this.lengthCounterTbl[value >> 3];
        }
        // pulse1.dividerPeriod = pulse1.dividerOriginalPeriod; //Restart envelop
        pulse1.decayLvlCount = 0x0F;
        // pulse1.setVol(pulse1.dividerOriginalPeriod - 1);
        pulse1.currentSequence = 0;
        pulse1.envStartFlag = true;
    };

    //0x4001
    this.setSQ1_SWEEP = function(value) {
        if ((value >> 7) == 1) {
            pulse1.sweepEnabled = true;
        }
        else {
            pulse1.sweepEnabled = false;
        }
        pulse1.sweepDividerPeriod = ((value & 0x70) >> 4) + 1;
        pulse1.sweepCount = pulse1.sweepDividerPeriod;
        pulse1.sweepNegate = (value & 0x08) >> 3;
        pulse1.sweepShiftCount = value & 0x07;
        pulse1.sweepReloadFlag = true;
    };

    //Square Channel 2 methods
    this.setSQ2_ENV = function(value) {
        pulse2.dividerPeriod = (value & 0x0F) + 1; //Env period
        pulse2.dividerOriginalPeriod = pulse2.dividerPeriod;
        pulse2.volume = value & 0x0F; //Set volume 
        if ((value & 0x10) == 0x10) {
            pulse2.sawEnvDisable = true; //use Volume for volume
        }
        else {
            pulse2.sawEnvDisable = false; //use internal counter for volume
        }
        if ((value & 0x20) == 0x20) {
            pulse2.lenCounterDisable = true; //disable Length Counter
        }
        else {
            pulse2.lenCounterDisable = false; //use Length Counter
        }
        pulse2.dutyCycle = value >> 6; //set duty cycle
    };

    this.setSQ2_LO = function(value) {
        pulse2.periodLowBits = value;
        pulse2.period = pulse2.period & 0x700;
        pulse2.period = pulse2.period | pulse2.periodLowBits;
    };

    this.setSQ2_HI = function(value) {
        pulse2.periodHighBits = value & 0x07;
        pulse2.period = pulse2.period & 0xFF;
        pulse2.period = pulse2.period | (pulse2.periodHighBits << 8);
        if (pulse2.enabled) {
            pulse2.lenCounter = this.lengthCounterTbl[value >> 3];
        }
        // pulse2.dividerPeriod = pulse2.dividerOriginalPeriod; //Restart envelop
        pulse2.decayLvlCount = 0x0F;
        // pulse2.setVol(pulse2.dividerOriginalPeriod - 1);
        pulse1.currentSequence = 0;
        pulse2.envStartFlag = true;
    };

    this.setSQ2_SWEEP = function(value) {
        if ((value >> 7) == 1) {
            pulse2.sweepEnabled = true;
        }
        else {
            pulse2.sweepEnabled = false;
        }
        pulse2.sweepDividerPeriod = ((value & 0x70) >> 4) + 1;
        pulse2.sweepCount = pulse2.sweepDividerPeriod;
        pulse2.sweepNegate = (value & 0x08) >> 3;
        pulse2.sweepShiftCount = value & 0x07;
        pulse2.sweepReloadFlag = true;
    };

    this.setTRIControl = function(value) {
        if ((value >> 7) == 1) {
            triangle1.controlFlag = true;
        }
        else {
            triangle1.controlFlag = false;
        }
        triangle1.counterReload = value & 0x7F;
    };

    this.setTRI_LO = function(value) {
        triangle1.timerLowBits = value & 0xFF;
    };

    this.setTRI_HI = function(value) {
        triangle1.timerHighBits = value & 0x07;
        triangle1.lenCounter = value >> 3;
        triangle1.lenCounterReloadFlag = true;
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
        var channelData = e.outputBuffer.getChannelData(0);
        var size = channelData.length;
        // var size = channelData.length;
        // var samples = this.outputBuffer;
        // for (var i = 0; i < size; i++) {
        //     channelData[i] = samples[i];
        // }
        // this.outputBuffer = [];
        // for (var i = 0, il = this.bufferLength; i < il; i++)
        //     channelData[i] = this.outputBuffer[i];

        // for (var i = this.bufferIndex, il = this.bufferLength; i < il; i++)
        //     channelData[i] = this.bufferIndex === 0 ? 0.0 : this.outputBuffer[this.bufferIndex - 1];
        try {
            var samples = this.outputBuffer.deqN(size);
        }
        catch (e) {
            // onBufferUnderrun failed to fill the buffer, so handle a real buffer
            // underrun
            // ignore empty buffers... assume audio has just stopped
            var bufferSize = this.outputBuffer.size();
            if (bufferSize > 0) {
                console.log(`Buffer underrun (needed ${size}, got ${bufferSize})`);
            }
            for (var j = 0; j < size; j++) {
                channelData[j] = 0;
            }
            return;
        }
        for (var i = 0; i < size; i++) {
            channelData[i] = samples[i];
        }
        // this.bufferIndex = 0;
    };

    this.sample = function() {
        sampleCount++;
        var t2 = performance.now();
        if (t2 - t1 >= 1000) {
            t1 = performance.now();
            console.log("sampling rate = " + sampleCount + " samples per second");
            sampleCount = 0;
        }
        // if (sampleCount >= 44100) {
        //     return;
        // }
        var pulse1Output = Math.floor(this.pulse1Buffer.reduce((a, b) => a + b, 0));
        if (pulse1Output != 0)
            pulse1Output = pulse1Output / this.pulse1Buffer.length;
        var pulse2Output = Math.floor(this.pulse2Buffer.reduce((a, b) => a + b, 0));
        if (pulse2Output != 0)
            pulse2Output = pulse2Output / this.pulse2Buffer.length;
        this.pulse1Buffer = [];
        this.pulse2Buffer = [];
        var output = 0;
        if (pulse1Output != 0 || pulse2Output != 0)
            output = 95.88 / ((8128 / (pulse1Output + pulse2Output)) + 100);
        // output = this.squareTable[pulse1Output + pulse2Output];
        this.pushToBuffer(output);

    };

    this.pushToBuffer = function(data) {
        // if (this.outputBuffer.size() >= this.bufferLength)
        //     return;
        this.outputBuffer.enq(data);
    };

    //Main APU clock at 240Hz perform step functions at 240Hz (~7457 CPU cycles)
    this.run = function(cycles) {
        var clocks = Math.floor(cycles / 2) + apuExtraClock;
        // var clocks = cycles;
        for (var i = 0; i < clocks; i++) {
            pulse1.clock();
            pulse2.clock();
        }
        apuExtraClock = cycles % 2;
        this.cycles += cycles;
        this.sampleCycles += cycles;
        this.overSamplingCycles += cycles;
        if (this.overSamplingCycles >= 2) {
            this.pulse1Buffer.push(pulse1.output());
            this.pulse2Buffer.push(pulse2.output());
            this.overSamplingCycles -= 2;
        }
        if (this.sampleCycles >= this.sampleCycleRate) {
            this.sampleCycles -= this.sampleCycleRate;
            this.sample();
            if (this.sampleCycleRate == 39)
                this.sampleCycleRate = 40;
            else if (this.sampleCycleRate == 40)
                this.sampleCycleRate = 39;
        }
        if (this.cycles >= 7457) {
            this.cycles -= 7457;
            if (this.seqMode == 0) {
                this.do4StepSeq();
            }
            else {
                this.do5StepSeq();
            }
        }
    };

    this.do4StepSeq = function() {
        pulse1.updateEnvelope();
        pulse2.updateEnvelope();
        // triangle1.updateLinearCounter();
        if (this.step % 2 === 1) {
            pulse1.updSweepAndLengthCounter();
            pulse2.updSweepAndLengthCounter();
        }
        this.step++;
        if (this.step === 4) {
            if (!this.inhibitInterrupt) {
                this.doIrq = true;
            }
            this.step = 0;
        }
    };

    this.do5StepSeq = function() {
        if (this.step % 2 === 0) {
            pulse1.updSweepAndLengthCounter();
            pulse2.updSweepAndLengthCounter();
        }
        this.step++;
        if (this.step === 5) {
            this.step = 0;
        }
        else {
            pulse1.updateEnvelope();
            pulse2.updateEnvelope();
            // triangle1.updateLinearCounter();
        }
    };
}
