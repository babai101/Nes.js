/*global Tone pulse triangle*/
function apu(nes) {
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
    this.sampleCycleRate = 0;
    this.step = 0;
    this.doIrq = false;
    this.lengthCounterTbl = [10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30];
    this.volumeLkpTbl = [-40.00, -24.44, -19.17, -15.92, -13.15, -11.06, -9.37, -7.96, -6.74, -5.68, -4.73, -2.38, -1.72, -1.11, -0.54, 0.00];
    this.pulse1Buffer = []
    this.outputBuffer = new Array(this.bufferLength);
    this.bufferLength = 4096;
    this.bufferIndex = 0;
    var pulse1 = new pulse(nes);
    var pulse2 = new pulse(nes);
    var triangle1 = new triangle(nes);
    pulse1.channel = 1;
    pulse2.channel = 2;
    this.clock = true;
    var sampleCount = 0;

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
        var t1 = perfomance.now();
        this.scriptNode = this.audioCtx.createScriptProcessor(this.bufferLength, 0, 1);
        this.scriptNode.onaudioprocess = this.onaudioprocess;
        this.scriptNode.connect(this.audioCtx.destination);
        this.sampleCycleRate = Math.floor(this.nes.cpuFreq / this.audioCtx.sampleRate);
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
        // var size = channelData.length;
        // var samples = this.outputBuffer;
        // for (var i = 0; i < size; i++) {
        //     channelData[i] = samples[i];
        // }
        // this.outputBuffer = [];
        for (var i = 0, il = this.bufferLength; i < il; i++)
            channelData[i] = this.outputBuffer[i];

        // for (var i = this.bufferIndex, il = this.bufferLength; i < il; i++)
        //     channelData[i] = this.bufferIndex === 0 ? 0.0 : this.outputBuffer[this.bufferIndex - 1];

        this.bufferIndex = 0;
    };

    this.sample = function() {
        var pulse1Output = pulse1.output();
        var pulse2Output = pulse2.output();
        var output = 0;
        if (pulse1Output != 0 || pulse2Output != 0)
            output = 95.88 / ((8128 / (pulse1Output + pulse2Output)) + 100);
        this.pushToBuffer(output);
        // if (this.pulse1Buffer.length == this.bufferLength) {
        //     this.outputBuffer = this.pulse1Buffer.slice();
        //     this.pulse1Buffer = [];
        // }
        // this.pulse1Buffer.push(output);
        sampleCount++;
        t2 = perfomance.now();
        if(t2 - t1 >= 1000) {
            t1 = t2;
            console.log("sampling rate = " + sampleCount + " samples per second");
        }
    };

    this.pushToBuffer = function(data) {
        if (this.bufferIndex >= this.bufferLength)
            return;
        this.outputBuffer[this.bufferIndex++] = data;
    };

    //Main APU clock at 240Hz perform step functions at 240Hz (~7457 CPU cycles)
    this.run = function(cycles) {
        var clocks = Math.floor(cycles / 2);
        for (var i = 0; i < clocks; i++) {
            pulse1.clock();
            pulse2.clock();
        }
        //check for 240Hz cycles
        this.cycles += cycles;
        this.sampleCycles += cycles;
        if (this.sampleCycles >= this.sampleCycleRate) {
            this.sampleCycles -= this.sampleCycleRate;
            this.sample();
        }
        // if (this.cycles % this.sampleCycleRate == 0) {
        //     this.sample();
        // }
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
