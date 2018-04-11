export default function noise() {
	this.dividerPeriod = 0;
	this.volume = 0;
	this.envStartFlag = false;
	this.decayLvlCount = 0;
	this.lenCounterDisable = false;
	this.period = 0;

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