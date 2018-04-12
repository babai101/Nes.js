/*global Tone*/
export default function triangle() {
    this.Enabled = false;
    this.doIrq = false;
    this.channel = 0;

    //Triangle wave channel VARs
    this.controlFlag = false;
    this.counterReload = 0;
    this.periodLowBits = 0;
    this.periodHighBits = 0;
    this.linearCounterReloadFlag = false;
    this.currentSequence = 0;
    this.lenCounter = 0; //Len counter value
    this.linearCounter = 0;
    this.sequenceTable = [15, 14, 13, 12, 11, 10,  9,  8,  7,  6,  5,  4,  3,  2,  1,  0,
    0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15];

    //Clocks the sequencer
    this.clockSequencer = function() {
        if (!this.controlFlag && (this.lenCounter > 0) && (this.linearCounter > 0)) {
            this.outputValue  = this.sequenceTable[this.currentSequence];
            this.currentSequence++;
            if (this.currentSequence == 32)
                this.currentSequence = 0;
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
        if (this.linearCounterReloadFlag) {
            this.linearCounter = this.counterReload;
        }
        else if (this.linearCounter > 0) {
            this.linearCounter--;
        }
        if (!this.controlFlag) {
            this.linearCounterReloadFlag = false;
        }
    };

    this.updateLenCounter = function() {
        if (!this.enabled) {
            this.lenCounter = 0;
        }
        else if (!this.controlFlag && this.lenCounter > 0) {
            this.lenCounter--;
        }
    };

    this.output = function() {
        return this.outputValue;
    };
}
