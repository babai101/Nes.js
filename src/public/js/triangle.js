/*global Tone*/
export default function triangle(nes) {
    this.nes = nes;
    this.Enabled = false;
    this.lengthCounterTbl = [10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30];
    this.volumeLkpTbl = [-40, -37, -34, -31, -28, -25, -22, -19, -16, -13, -10, -7, -4, -1, 2, 4];
    this.doIrq = false;
    this.channel = 0;

    //Triangle wave channel VARs
    this.controlFlag = false;
    this.counterReload = 0;
    this.timerLowBits = 0;
    this.timerHighBits = 0;
    this.lenCounterReloadFlag = false;
    this.lenCounter = 0; //Len counter value
    this.vol = 0; //channel volume


    //Square 1 wave channel VARs
    this.vol = 0; //Square 1 channel volume
    this.sawEnvDisable = false; //Use Envelop or Constant volume
    this.lenCounterDisable = false; //envelope loop / length counter halt
    this.dutyCycle = 0; //Duty cycle of the wave
    this.period = 0; //11 bit Period 
    this.envPeriod = 0x0F; //Envelop decay counter
    this.periodLowBits = 0; //lower 8 bit period
    this.periodHighBits = 0; //High 3 bit period
    this.lenCounter = 0; //Len counter value
    this.envVolume = 0; //Envelop value
    this.frequency = 0; //Calculated frequency from period
    this.envStartFlag = false;
    this.dividerPeriod = 0;
    this.dividerOriginalPeriod = 0;
    this.decayLvlCount = 0;
    this.envCounter = 0; //Counter to countdown to 0 from envelope period
    this.inhibitInterrupt = true; //Inhibit the frame counter IR
    this.playing = false;
    this.sweepEnabled = false; //Enable Sweep
    this.sweepDividerPeriod = 0; //Sweep divider Period
    this.sweepNegate = 0;
    this.sweepShiftCount = 0;
    this.sweepCount = 0;
    //Tony JS vars
    // this.triangleOsc = new Tone.OmniOscillator(0, "triangle").toMaster().start();
    // this.triangleOsc.fadeOut = 0.07;
    // this.triangleOsc.width.value = 0.5;

    this.calcDuty = function(duty) {
        switch (duty) {
            case 0:
                return 0.125;
            case 1:
                return 0.25;
            case 2:
                return 0.5;
            case 3:
                return 0.75;
        }
    };

    //If envelope is enabled set the current env value or else set the constant volume passed in
    this.setVol = function(volume) {
        if (this.decayLvlCount > 0xF || volume > 0xF) {
            alert("volume higher than 0xF!!! Env Volume: " + this.decayLvlCount + ' Constant volume: ' + volume);
        }
        if (!this.sawEnvDisable) {
            this.vol = this.decayLvlCount;
        }
        else {
            this.vol = volume;
        }
        this.triangleOsc.volume.value = this.volumeLkpTbl[this.vol];
    };

    this.clockDecayLevelCounter = function() {
        if (this.decayLvlCount == 0) {
            if (this.lenCounterDisable) { //if loop flag set, reload the decay 
                this.decayLvlCount = 15;
            }
        }
        else {
            this.decayLvlCount--;
        }
    };
    // this.updateEnvelope = function() {
    //     if (!this.envStartFlag) {
    //         //Now clock divider
    //         if (this.dividerPeriod == 0) { //Reload divider period
    //             this.dividerPeriod = this.dividerOriginalPeriod;
    //             //Now clock Decay level counter
    //             this.clockDecayLevelCounter();
    //         }
    //         else {
    //             this.dividerPeriod--;
    //             //Now clock Decay level counter
    //             this.clockDecayLevelCounter();
    //         }
    //     }
    //     else {
    //         this.envStartFlag = false; //Clear Start flag
    //         this.decayLvlCount = 15; //Reload Decay level counter
    //         this.dividerPeriod = this.dividerOriginalPeriod; //Reload divider period
    //     }
    //     this.setVol(this.dividerOriginalPeriod - 1);
    // };

    //return sound freq in Hz
    this.calcFrequency = function(period) {
        return this.nes.cpuFreq / (16 * (period + 1));
    };

    this.updSweepAndLengthCounter = function() {
        //Update Lenght Counter
        if (!this.enabled) {
            this.lenCounter = 0;
            //Silence channel
            this.pulseOsc.mute = true;
        }
        else if (!this.lenCounterDisable && this.lenCounter > 0) {
            this.lenCounter--;
            //Silence Channel
            if (this.lenCounter == 0) {
                this.pulseOsc.mute = true;
            }
            else {
                this.pulseOsc.mute = false;
            }
        }

        //Update Sweep
        //Muting
        if (this.period < 0x08) {
            this.pulseOsc.mute = true;
        }
        else {
            this.pulseOsc.mute = false;
        }
        var sweepTargetPeriod = 0;
        //Divider has reached 0 do sweep now
        if (this.sweepCount == 0) {
            this.sweepCount = this.sweepDividerPeriod; //Relaod sweep divider count
            this.sweepReloadFlag = false; //clear reload flag
            var sweepChangeAmt = this.period >> this.sweepShiftCount;
            if (this.sweepNegate == 0) { //Add sweep
                sweepTargetPeriod = this.period + sweepChangeAmt;
            }
            else if (this.sweepNegate == 1) { //Negate sweep
                if (this.channel == 1) {
                    sweepTargetPeriod = this.period + (~sweepChangeAmt); //1's complement for pulse1 channel
                }
                else if (this.channel == 2) {
                    sweepTargetPeriod = this.period - sweepChangeAmt; //2's complement for pulse2 channel
                }
            }
            if (this.sweepEnabled) { //Adjust the sweep
                this.period = sweepTargetPeriod;
                this.frequency = this.calcFrequency(this.period);
                this.pulseOsc.frequency.value = this.frequency;
            }
        }
        else if (!this.sweepReloadFlag) {
            this.sweepCount--;
        }
        if (this.sweepReloadFlag) {
            this.sweepCount = this.sweepDividerPeriod; //Relaod sweep divider count
            this.sweepReloadFlag = false; //clear reload flag
        }

        //Muting
        if (sweepTargetPeriod > 0x7FF) {
            this.pulseOsc.mute = true;
        }
        else {
            this.pulseOsc.mute = false;
        }
    };
    
    this.clock = function() {
        if (this.period <= 0) {
            this.clockSequencer();
            this.period = this.periodLowBits | (this.periodHighBits << 8) + 1;
        }
        else {
            this.period--;
        }
    };

    this.updateLinearCounter = function() {
        if (this.lenCounterReloadFlag) {

        }
    };
}
