/*global Tone*/
export default function pulse() {
    this.Enabled = false;
    this.doIrq = false;
    this.channel = 0;
    //Square wave channel VARs
    this.volume = 0; //Square channel volume
    this.sawEnvDisable = true; //Use Envelop or Constant volume
    this.lenCounterDisable = false; //envelope loop / length counter halt
    this.dutyCycle = 0; //Duty cycle of the wave
    this.period = 0; //11 bit Period 
    this.envPeriod = 0x0F; //Envelop decay counter
    this.periodLowBits = 0; //lower 8 bit period
    this.periodHighBits = 0; //High 3 bit period
    this.lenCounter = 0; //Len counter value
    this.envVolume = 0; //Envelop value
    this.envStartFlag = false;
    this.dividerPeriod = 0;
    this.decayLvlCount = 0;
    this.envCounter = 0; //Counter to countdown to 0 from envelope period
    this.inhibitInterrupt = true; //Inhibit the frame counter IR
    this.sweepEnabled = false; //Enable Sweep
    this.sweepDividerPeriod = 0; //Sweep divider Period
    this.sweepNegate = 0;
    this.sweepShiftCount = 0;
    this.sweepCount = 0;
    this.sweepReloadFlag = false;
    this.currentSequence = 0;
    this.outputValue = false;
    this.sweepTargetPeriod = 0;
    var dutyCycles = [
        [0, 1, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 0, 0, 0],
        [1, 0, 0, 1, 1, 1, 1, 1]
    ];

    //calculate the current sequence value
    this.calcSequence = function(duty, sequence) {
        return dutyCycles[duty][sequence];
    };

    //Clocks the sequencer
    this.clockSequencer = function() {
        if (this.calcSequence(this.dutyCycle, this.currentSequence) == 1) {
            this.outputValue = true;
        }
        else this.outputValue = false;
        this.currentSequence++;
        if (this.currentSequence == 8)
            this.currentSequence = 0;
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

    this.updateEnvelope = function() {
        if (!this.envStartFlag) {
            //Now clock divider
            if (this.dividerPeriod == 0) { //Reload divider period
                this.dividerPeriod = this.volume + 1;
                //Now clock Decay level counter
                this.clockDecayLevelCounter();
            }
            else {
                this.dividerPeriod--;
                //Now clock Decay level counter
                this.clockDecayLevelCounter();
            }
        }
        else {
            this.envStartFlag = false; //Clear Start flag
            this.decayLvlCount = 15; //Reload Decay level counter
            this.dividerPeriod = this.volume + 1; //Reload divider period
        }
        // if (this.dividerOriginalPeriod > 0)
        //     this.setVol(this.dividerOriginalPeriod - 1);
        // else this.setVol(0);
    };

    this.updSweepAndLengthCounter = function() {
        //Update Lenght Counter
        if (!this.enabled) {
            this.lenCounter = 0;
        }
        else if (!this.lenCounterDisable && this.lenCounter > 0) {
            this.lenCounter--;
        }
        //Update Sweep
        this.sweepTargetPeriod = 0;
        //Divider has reached 0 do sweep now
        if (this.sweepCount == 0) {
            this.sweepCount = this.sweepDividerPeriod; //Relaod sweep divider count
            this.sweepReloadFlag = false; //clear reload flag
            var sweepChangeAmt = this.period >> this.sweepShiftCount;
            if (this.sweepNegate == 0) { //Add sweep
                this.sweepTargetPeriod = this.period + sweepChangeAmt;
            }
            else if (this.sweepNegate == 1) { //Negate sweep
                if (this.channel == 1) {
                    this.sweepTargetPeriod = this.period + (~sweepChangeAmt); //1's complement for pulse1 channel
                }
                else if (this.channel == 2) {
                    this.sweepTargetPeriod = this.period - sweepChangeAmt; //2's complement for pulse2 channel
                }
            }
            if (this.sweepEnabled) { //Adjust the sweep
                this.period = this.sweepTargetPeriod;
            }
        }
        else if (!this.sweepReloadFlag) {
            this.sweepCount--;
        }
        if (this.sweepReloadFlag) {
            this.sweepCount = this.sweepDividerPeriod; //Relaod sweep divider count
            this.sweepReloadFlag = false; //clear reload flag
        }
    };

    //Clock the sequencer after timer has counted down
    this.clock = function() {
        if (this.period <= 0) {
            this.clockSequencer();
            this.period = this.periodLowBits | (this.periodHighBits << 8) + 1;
        }
        else {
            this.period--;
        }
    };

    this.output = function() {
        if ((this.outputValue) && (this.sweepTargetPeriod <= 0x7FF) && (this.period >= 0x08)) {
            if (!this.lenCounterDisable && this.lenCounter <= 0)
                return 0;
            if (!this.sawEnvDisable) {
                return this.decayLvlCount;
            }
            else {
                return this.volume;
            }
        }
        else return 0;
    };
}
