/*global performance*/
//cycles per second = 1786830
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
    this.step = 0;
    this.doIrq = false;
    this.lengthCounterTbl = [10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30];
    this.pulse1Buffer = [];
    this.pulse2Buffer = [];
    this.bufferLength = 4096;
    this.outputBuffer = new RingBuffer(this.bufferLength * 10);
    var pulse1 = new pulse(nes);
    var pulse2 = new pulse(nes);
    var triangle1 = new triangle(nes);
    pulse1.channel = 1;
    pulse2.channel = 2;
    var sampleCount = 0;
    var t1 = 0;
    var t3 = 0;
    this.overSamplingCycles = 0;
    var overSamplingCycleRate = 20;
    var sampleCycleRate = 41;
    this.samplingCycles = 0;
    this.clockCycles = 0;
    this.frameCycles = 0;
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
        //Thansk Ben Firshman!!!
        var channelData = e.outputBuffer.getChannelData(0);
        var size = channelData.length;
        if (this.outputBuffer.size() < size) {
            console.log(
                "Buffer underrun, running another frame to try and catch up"
            );
            this.nes.CPU.run();
            
            if (this.outputBuffer.size() < size) {
                console.log("Still buffer underrun, running a second frame");
                this.nes.CPU.run();
            }
        }
        try {
            var samples = this.outputBuffer.deqN(size);
        }
        catch (e) {
            // onBufferUnderrun failed to fill the buffer, so handle a real buffer
            // underrun
            // ignore empty buffers... assume audio has just stopped
            var bufferSize = this.outputBuffer.size();
            if (bufferSize > 0) {
                // console.log(`Buffer underrun (needed ${size}, got ${bufferSize})`);
            }
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
        // var pulse1Output = pulse1.output();
        // var pulse2Output = pulse2.output();
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
    this.run = function() {
        this.clockCycles++;
        if (this.clockCycles % 2 == 0) {
            pulse1.clock();
            pulse2.clock();
            this.clockCycles = 0;
        }
        this.overSamplingCycles++;
        if (this.overSamplingCycles >= overSamplingCycleRate) {
            this.overSamplingCycles -= overSamplingCycleRate;
            this.pulse1Buffer.push(pulse1.output());
            this.pulse2Buffer.push(pulse2.output());
        }
        this.samplingCycles++;
        if (this.samplingCycles >= sampleCycleRate) {
            this.samplingCycles -= sampleCycleRate;
            this.sample();
            if (sampleCycleRate == 40)
                sampleCycleRate = 41;
            else if (sampleCycleRate == 41)
                sampleCycleRate = 40;
        }
        this.frameCycles++;
        if (this.frameCycles >= 7457) {
            this.frameCycles -= 7457;
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
