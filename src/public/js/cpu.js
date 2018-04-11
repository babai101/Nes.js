export default function cpu(nes) {
	this.nes = nes;
	this.pc; // 16-Bit Program Counter
	this.sp; // 8-Bit Stack Pointer
	this.accumulator; // 8-Bit Accumulator
	this.X; // 8-Bit Index Register X
	this.Y; // 8-Bit Index Register Y
	this.P; // Processor flag 
	this.errorFlag = false;
	this.elapsedCycles;
	this.elapsedCPUSyncCycles = 0;
	this.totalElapsedCycles = 0;
	this.totalCPUCyclesThisFrame = 0;
	this.loggingEnabled = false;
	this.excessCpuCycles = 0;
	// Bit No.       7   6   5   4   3   2   1   0
	//				 S   V       B   D   I   Z   C	


	//PPU related VARS
	this.renderedScanLine = -1;
	this.ticksPerSecond = 29781;
	this.remainingCPUCycles = 0;
	this.ppuCyclesPerSecond = 89341.5;
	this.ppuCyclesCurrentScanLine = 341;
	this.oddFrame = false;
	this.ppuSyncCycles = 0;
	this.excessPPUCycles = 0;
	this.nmiLoopCounter = 0;
	this.masterCpuCyclesElapsed = 0;
	this.currentOpcode; // Opcode currently processed
	this.operationType; // Current operation type
	this.cpuCyclesGenerated = 0;
	this.cpuCyclesConsumed = 0;
	this.ppuCyclesConsumed = 0;
	this.cpuCyclesThisSecond = 0;
	this.ppuCyclesThisFrame = 0;
	this.frameCount = 0;
	this.cpuClockRemaining = 0;
	//Reset CPU and initialize all registers and flags
	this.reset = function() {
		this.sp = 0xFD; //Adjusted for comparing with Nintedulator log
		this.accumulator = 0x00;
		this.X = 0x00;
		this.Y = 0x00;
		this.P = 0b00100100;
		this.totalCpuCyclesDbg = 0;
		this.excessCpuCyclesDbg = 0;
		this.currentOpcode = 0x00;
		this.elapsedCycles = 0;
		var vector1 = this.nes.MMU.getCpuMemVal(this.nes.MMU.startAddress);
		var vector2 = this.nes.MMU.getCpuMemVal(this.nes.MMU.startAddress + 1);
		vector2 = vector2 << 8;
		this.pc = vector2 | vector1;
	};

	this.prepareLogging = function() {
		this.PCLog = ("0000" + this.pc.toString(16).toUpperCase()).slice(-4);
		this.currentOpcodeLog = ("00" + this.currentOpcode.toString(16).toUpperCase()).slice(-2);
		this.accumulatorLog = ("00" + this.accumulator.toString(16).toUpperCase()).slice(-2);
		this.XLog = ("00" + this.X.toString(16).toUpperCase()).slice(-2);
		this.YLog = ("00" + this.Y.toString(16).toUpperCase()).slice(-2);
		this.SPLog = ("00" + this.sp.toString(16).toUpperCase()).slice(-2);
		this.PLog = ("00" + this.P.toString(16).toUpperCase()).slice(-2);
		this.CYCLog = this.totalElapsedCycles;
		this.ArgLog = '';
		this.opcodeType = '';
		this.memLog = '';
	};

	this.logInConsole = function() {
		// var temp1 = (this.currentOpcodeLog + ' ' + this.ArgLog + '          ').slice(0, 10);
		var temp1 = (this.currentOpcodeLog + ' ' + this.ArgLog + '          ').slice(0, 9);
		if (this.opcodeType[0] != '*') {
			this.opcodeType = ' ' + this.opcodeType;
		}
		var temp2 = this.PCLog + '  ' + temp1 + this.opcodeType;
		var logLine = temp2 + '  ' + 'A:' + this.accumulatorLog + ' X:' + this.XLog + ' Y:' + this.YLog + ' P:' + this.PLog + ' SP:' + this.SPLog + ' CYC:' + this.CYCLog;
		console.log(logLine);
	};
	//Fetch opcode from work ram 
	this.fetchOpcode = function() {
		this.currentOpcode = this.nes.MMU.getCpuMemVal(this.pc); // Fetched opcode only
	};

	//Fetch parameters for opcode
	this.fetchParams = function() {
		var param = this.nes.MMU.getCpuMemVal(this.pc);

		// if (this.ArgLog.length > 0) {
		// 	this.ArgLog = this.ArgLog.concat(' ', ("00" + param.toString(16).toUpperCase()).slice(-2));
		// }
		// else
		// 	this.ArgLog = ("00" + param.toString(16).toUpperCase()).slice(-2);
		this.pc++;
		return param;
	};

	this.setFlag = function(flagToSet) {
		switch (flagToSet) {
			case 'carry':
				this.P = this.P & 0b11111110;
				this.P = this.P | 0b00000001;
				break;

			case 'zero':
				this.P = this.P & 0b11111101;
				this.P = this.P | 0b00000010;
				break;

			case 'irqDisable':
				this.P = this.P & 0b11111011;
				this.P = this.P | 0b00000100;
				break;

			case 'decimal':
				this.P = this.P & 0b11110111;
				this.P = this.P | 0b00001000;
				break;

			case 'overflow':
				this.P = this.P & 0b10111111;
				this.P = this.P | 0b01000000;
				break;

			case 'negative':
				this.P = this.P & 0b01111111;
				this.P = this.P | 0b10000000;
				break;
		}
	};

	this.unsetFlag = function(flagToUnset) {
		switch (flagToUnset) {
			case 'carry':
				this.P = this.P & 0b11111110;
				break;

			case 'zero':
				this.P = this.P & 0b11111101;
				break;

			case 'irqDisable':
				this.P = this.P & 0b11111011;
				break;

			case 'decimal':
				this.P = this.P & 0b11110111;
				break;

			case 'overflow':
				this.P = this.P & 0b10111111;
				break;

			case 'negative':
				this.P = this.P & 0b01111111;
				break;
		}
	};

	this.calcFlags = function(arg, checkOverflow, newValue) {

		// var bit7 = registerToCheck >> 7;
		//check if overflow flag is to be determined
		if (checkOverflow) {
			// if (bit7 != (newValue >> 7))
			// 	this.setFlag('overflow');
			// else 
			// 	this.unsetFlag('overflow');
			if (~(this.accumulator ^ arg) & (this.accumulator ^ newValue) & 0x80)
				this.setFlag('overflow');
			else
				this.unsetFlag('overflow');
		}
		else {
			//check for zero flag
			if (arg == null)
				arg = this.accumulator;
			if (arg == 0x00)
				this.setFlag('zero');
			else
				this.unsetFlag('zero');
			//check for negative flag	
			if ((arg >> 7) == 1)
				this.setFlag('negative');
			else
				this.unsetFlag('negative');
		}
	};

	this.writeCarry = function(value) {
		if (value > 0xFF) {
			this.setFlag('carry');
			value = value & 0xFF;
			return value;
		}
		else {
			this.unsetFlag('carry');
			return value;
		}
	};

	this.wrap8bit = function(operation, operand, input) {
		var output = operand;
		switch (operation) {
			case 'increment':
				//Simple one off wrap around 	
				if (operand == 0xFF)
					output = 0x00;
				else output = operand + 1;
				break;

			case 'decrement':
				//Simple one off wrap around
				if (operand == 0x00)
					output = 0xFF;
				else output = operand - 1;
				break;

			case 'sum':
				//Wrap around from zero and go upwards 
				var temp = operand + input;
				if (temp > 0xFF) {
					output = 0x00 + (temp - 0xFF - 1);
				}
				else
					output = temp;
				break;

			case 'subtract':
				//Wrap around from FF and go downwards
				if (input > operand) {
					output = 0xFF - (input - operand - 1);
				}
				else
					output = operand - input;
				break;
		}
		return output;
	};

	this.to2sComplement = function(val) {
		if (val == 128)
			return -128;
		else if (val >= 129 && val <= 255)
			return val - 256;
		else return val;
	};

	this.toSigned8bit = function(val) {
		if (val == -128)
			return 128;
		else if (val >= 0 && val <= 127)
			return val;
		else return val + 256;
	};

	this.pushToStack = function(value) {
		this.nes.MMU.setCpuMemVal((0x100 + this.sp), (value));
		if (this.sp == 0x00)
			this.sp = 0xFF;
		else
			this.sp--;
	};


	this.popFromStack = function() {
		if (this.sp == 0xFF)
			this.sp = 0x00;
		else
			this.sp++;
		var value = this.nes.MMU.getCpuMemVal(0x100 + this.sp);
		return value;
	};

	this.calcOffset = function(param) {
		if (param > 0x7F) {
			param = param ^ 0b11111111;
			param++;
			param = 0 - param;
		}
		return param;
	};

	this.compareValsAndSetNegative = function(val1, val2) {
		//Turns out compare instructions do unsigned comparison :(
		var temp = val1 - val2;
		if (((temp >> 7) & 1) == 1)
			this.setFlag('negative');
		else
			this.unsetFlag('negative');

		if (val1 > val2) {
			return 1;
		}
		else if (val1 == val2) {
			this.unsetFlag('negative');
			return 0;
		}
		else if (val1 < val2) {
			return -1;
		}
	};

	//Opcode implementaions

	//ADC instructinos 
	this.ADC_I = function() {
		this.opcodeType = 'ADC';
		//increment pc by 1
		this.pc++;
		//fetch single param
		var param = this.fetchParams();
		var arg = param;
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 2;
		return 2;
	};

	this.ADC_Z = function() {
		this.opcodeType = 'ADC';
		this.pc++;
		var param = this.fetchParams();
		var arg = this.nes.MMU.getCpuMemVal(param);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		if (this.loggingEnabled)
			this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + arg.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.ADC_Z_X = function() {
		this.opcodeType = 'ADC';
		this.pc++;
		var param = this.fetchParams();
		var arg = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.ADC_A = function() {
		this.opcodeType = 'ADC';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var arg = this.nes.MMU.getCpuMemVal(param);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		//instLen = 3;
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + arg.toString(16).toUpperCase()).slice(-2);
		this.elapsedCycles += 4;
		return 4;
	};

	this.ADC_A_X = function() {
		this.opcodeType = 'ADC';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var arg = this.nes.MMU.getCpuMemVal(param + this.X);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.X) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.ADC_A_Y = function() {
		this.opcodeType = 'ADC';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.Y) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.ADC_I_X = function() {
		this.opcodeType = 'ADC';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		var arg = this.nes.MMU.getCpuMemVal(index2 | index1);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + arg.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.ADC_I_Y = function() {
		this.opcodeType = 'ADC';
		this.pc++;
		var param = this.fetchParams();
		// param += ;
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var arg = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		//instLen = 2;
		if ((index1 + this.Y) > 0xFF) {
			this.elapsedCycles += 6;
			return 6;
		}
		else {
			this.elapsedCycles += 5;
			return 5;
		}
	};

	//SBC Instructions
	this.SBC_I = function() {
		if (this.currentOpcode == 0xEB) {
			this.opcodeType = '*SBC';
		}
		else
			this.opcodeType = 'SBC';
		this.pc++;
		//fetch single param
		var arg = this.fetchParams();
		var temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
		this.elapsedCycles += 2;
		return 2;
	};

	this.SBC_Z = function() {
		this.opcodeType = 'SBC';
		this.pc++;
		var param = this.fetchParams();
		var arg = this.nes.MMU.getCpuMemVal(param);
		var temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
		this.elapsedCycles += 3;
		return 3;
	};

	this.SBC_Z_X = function() {
		this.opcodeType = 'SBC';
		this.pc++;
		var param = this.fetchParams();
		var arg = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
		this.elapsedCycles += 4;
		return 4;
	};

	this.SBC_A = function() {
		this.opcodeType = 'SBC';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var arg = this.nes.MMU.getCpuMemVal(param);
		var temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
		this.elapsedCycles += 4;
		return 4;
	};

	this.SBC_A_X = function() {
		this.opcodeType = 'SBC';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var arg = this.nes.MMU.getCpuMemVal(param + this.X);
		var temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
		if ((param1 + this.X) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.SBC_A_Y = function() {
		this.opcodeType = 'SBC';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
		var temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
		if ((param1 + this.Y) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.SBC_I_X = function() {
		this.opcodeType = 'SBC';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		var arg = this.nes.MMU.getCpuMemVal(index2 | index1);
		var temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
		this.elapsedCycles += 6;
		return 6;
	};

	this.SBC_I_Y = function() {
		this.opcodeType = 'SBC';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var arg = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
		var temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
		if ((index1 + this.Y) > 0xFF) {
			this.elapsedCycles += 6;
			return 6;
		}
		else {
			this.elapsedCycles += 5;
			return 5;
		}
	};

	//AND Instructions

	this.AND_I = function() {
		this.opcodeType = 'AND';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.accumulator & param;
		this.calcFlags(null, false, null);
		if (this.loggingEnabled)
			this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 2;
		return 2;
	};

	this.AND_Z = function() {
		this.opcodeType = 'AND';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param);
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		if (this.loggingEnabled)
			this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.AND_Z_X = function() {
		this.opcodeType = 'AND';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.AND_A = function() {
		this.opcodeType = 'AND';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	this.AND_A_X = function() {
		this.opcodeType = 'AND';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param + this.X);
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.X) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.AND_A_Y = function() {
		this.opcodeType = 'AND';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.Y) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.AND_I_X = function() {
		this.opcodeType = 'AND';
		this.pc++;
		var param = this.fetchParams();
		// param += this.X;
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(index2 | index1);
		this.calcFlags(null, false, null);
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(index2 | index1);
		// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.AND_I_Y = function() {
		this.opcodeType = 'AND';
		this.pc++;
		var param = this.fetchParams();
		// param += this.Y;
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
		this.calcFlags(null, false, null);
		//instLen = 2;
		if ((index1 + this.Y) > 0xFF) {
			this.elapsedCycles += 6;
			return 6;
		}
		else {
			this.elapsedCycles += 5;
			return 5;
		}
	};

	//EOR Instructions

	this.EOR_I = function() {
		this.opcodeType = 'EOR';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.accumulator ^ param;
		this.calcFlags(null, false, null);
		// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 2;
		return 2;
	};

	this.EOR_Z = function() {
		this.opcodeType = 'EOR';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param);
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		if (this.loggingEnabled)
			this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.EOR_Z_X = function() {
		this.opcodeType = 'EOR';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.EOR_A = function() {
		this.opcodeType = 'EOR';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		if (this.loggingEnabled)
			this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	this.EOR_A_X = function() {
		this.opcodeType = 'EOR';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param + this.X);
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.X) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.EOR_A_Y = function() {
		this.opcodeType = 'EOR';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.X) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.EOR_I_X = function() {
		this.opcodeType = 'EOR';
		this.pc++;
		var param = this.fetchParams();
		// param += this.X;
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(index2 | index1);
		// var memLogBeforeVar = this.nes.MMU.getCpuMemVal(index2 | index1);
		this.calcFlags(null, false, null);
		// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.EOR_I_Y = function() {
		this.opcodeType = 'EOR';
		this.pc++;
		var param = this.fetchParams();
		// param += this.Y;
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
		this.calcFlags(null, false, null);
		//instLen = 2;
		if ((index1 + this.Y) > 0xFF) {
			this.elapsedCycles += 6;
			return 6;
		}
		else {
			this.elapsedCycles += 5;
			return 5;
		}
	};

	//ORA Instructions

	this.ORA_I = function() {
		this.opcodeType = 'ORA';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.accumulator | param;
		this.calcFlags(null, false, null);
		// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 2;
		return 2;
	};

	this.ORA_Z = function() {
		this.opcodeType = 'ORA';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param);
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.ORA_Z_X = function() {
		this.opcodeType = 'ORA';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.ORA_A = function() {
		this.opcodeType = 'ORA';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	this.ORA_A_X = function() {
		this.opcodeType = 'ORA';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param + this.X);
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.X) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.ORA_A_Y = function() {
		this.opcodeType = 'ORA';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.Y) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.ORA_I_X = function() {
		this.opcodeType = 'ORA';
		this.pc++;
		var param = this.fetchParams();
		// param += this.X;
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(index2 | index1);
		this.calcFlags(null, false, null);
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(index2 | index1);
		// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.ORA_I_Y = function() {
		this.opcodeType = 'ORA';
		this.pc++;
		var param = this.fetchParams();
		// param += this.Y;
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
		this.calcFlags(null, false, null);
		//instLen = 2;
		if ((index1 + this.Y) > 0xFF) {
			this.elapsedCycles += 6;
			return 6;
		}
		else {
			this.elapsedCycles += 5;
			return 5;
		}
	};

	//ASL Instructions

	this.ASL_AC = function() {
		this.opcodeType = 'ASL';
		this.pc++;
		if ((this.accumulator >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.accumulator = this.accumulator << 1;
		this.accumulator = this.accumulator & 0xFF;
		this.calcFlags(null, false, null);
		this.memLog = 'A';
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.ASL_Z = function() {
		this.opcodeType = 'ASL';
		this.pc++;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.nes.MMU.setCpuMemVal(param, this.nes.MMU.getCpuMemVal(param) << 1);
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 5;
		return 5;
	};

	this.ASL_Z_X = function() {
		this.opcodeType = 'ASL';
		this.pc++;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) << 1));
		this.calcFlags(this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), false, null);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.ASL_A = function() {
		this.opcodeType = 'ASL';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 6;
		return 6;
	};

	this.ASL_A_X = function() {
		this.opcodeType = 'ASL';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.X) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) << 1));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
		//instLen = 3;
		this.elapsedCycles += 7;
		return 7;
	};

	//LDA instructions

	this.LDA_I = function() {
		this.opcodeType = 'LDA';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = param;
		this.calcFlags(null, false, null);
		//instLen = 2;
		// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		this.elapsedCycles += 2;
		return 2;
	};


	this.LDA_Z = function() {
		this.opcodeType = 'LDA';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		if (this.loggingEnabled)
			this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + this.accumulator.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.LDA_Z_X = function() {
		this.opcodeType = 'LDA';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.LDA_A = function() {
		this.opcodeType = 'LDA';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		if (this.loggingEnabled)
			this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + this.accumulator.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	this.LDA_A_X = function() {
		this.opcodeType = 'LDA';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		// this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		this.accumulator = this.nes.MMU.getCpuMemVal(param + this.X);
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.X) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.LDA_A_Y = function() {
		this.opcodeType = 'LDA';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		// this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
		this.accumulator = this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.Y) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.LDA_I_X = function() {
		this.opcodeType = 'LDA';
		this.pc++;
		var param = this.fetchParams();
		// param += this.X;
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		this.accumulator = this.nes.MMU.getCpuMemVal(index2 | index1);
		this.calcFlags(null, false, null);
		// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + this.accumulator.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.LDA_I_Y = function() {
		this.opcodeType = 'LDA';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		this.accumulator = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
		// this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', (index2 | index1), this.Y));
		this.calcFlags(null, false, null);
		//instLen = 2;
		if ((index1 + this.Y) > 0xFF) {
			this.elapsedCycles += 6;
			return 6;
		}
		else {
			this.elapsedCycles += 5;
			return 5;
		}
	};


	//LDX instructions

	this.LDX_I = function() {
		this.opcodeType = 'LDX';
		this.pc++;
		var param = this.fetchParams();
		this.X = param;
		this.calcFlags(this.X, false, null);
		//instLen = 2;
		// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		this.elapsedCycles += 2;
		return 2;
	};

	this.LDX_Z = function() {
		this.opcodeType = 'LDX';
		this.pc++;
		var param = this.fetchParams();
		this.X = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(this.X, false, null);
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + this.X.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.LDX_Z_Y = function() {
		this.opcodeType = 'LDX';
		this.pc++;
		var param = this.fetchParams();
		this.X = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
		this.calcFlags(this.X, false, null);
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.LDX_A = function() {
		this.opcodeType = 'LDX';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.X = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(this.X, false, null);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + this.X.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};


	this.LDX_A_Y = function() {
		this.opcodeType = 'LDX';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		// this.X = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
		this.X = this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(this.X, false, null);
		//instLen = 3;
		if ((param1 + this.Y) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	//LDY Instructions

	this.LDY_I = function() {
		this.opcodeType = 'LDY';
		this.pc++;
		var param = this.fetchParams();
		this.Y = param;
		this.calcFlags(this.Y, false, null);
		//instLen = 2;
		// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		this.elapsedCycles += 2;
		return 2;
	};

	this.LDY_Z = function() {
		this.opcodeType = 'LDY';
		this.pc++;
		var param = this.fetchParams();
		this.Y = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(this.Y, false, null);
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + this.Y.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.LDY_Z_X = function() {
		this.opcodeType = 'LDY';
		this.pc++;
		var param = this.fetchParams();
		this.Y = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		this.calcFlags(this.Y, false, null);
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.LDY_A = function() {
		this.opcodeType = 'LDY';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.Y = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(this.Y, false, null);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + this.Y.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	this.LDY_A_X = function() {
		this.opcodeType = 'LDY';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		// this.Y = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		this.Y = this.nes.MMU.getCpuMemVal(param + this.X);
		this.calcFlags(this.Y, false, null);
		//instLen = 3;
		if ((param1 + this.X) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	//LSR Instructions

	this.LSR_AC = function() {
		this.opcodeType = 'LSR';
		this.pc++;
		if ((this.accumulator & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.accumulator = this.accumulator >> 1;
		this.calcFlags(null, false, null);
		this.memLog = 'A';
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.LSR_Z = function() {
		this.opcodeType = 'LSR';
		this.pc++;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 5;
		return 5;
	};

	this.LSR_Z_X = function() {
		this.opcodeType = 'LSR';
		this.pc++;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 1));
		this.calcFlags(this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), false, null);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.LSR_A = function() {
		this.opcodeType = 'LSR';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 6;
		return 6;
	};

	this.LSR_A_X = function() {
		this.opcodeType = 'LSR';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.X) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) >> 1));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
		//instLen = 3;
		this.elapsedCycles += 7;
		return 7;
	};

	//ROL Instructions

	this.ROL_AC = function() {
		this.opcodeType = 'ROL';
		this.pc++;
		var currCarry = this.P & 0x01;
		if ((this.accumulator >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.accumulator = this.accumulator << 1;
		this.accumulator = this.accumulator & 0xFF;
		if (currCarry == 1) {
			this.accumulator = this.accumulator | 0b00000001;
		}
		this.calcFlags(null, false, null);
		this.memLog = 'A';
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.ROL_Z = function() {
		this.opcodeType = 'ROL';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b00000001));
		}
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 5;
		return 5;
	};

	this.ROL_Z_X = function() {
		this.opcodeType = 'ROL';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) | 0b00000001));
		}
		this.calcFlags(this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), false, null);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.ROL_A = function() {
		this.opcodeType = 'ROL';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b00000001));
		}
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 6;
		return 6;
	};

	this.ROL_A_X = function() {
		this.opcodeType = 'ROL';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.X) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) | 0b00000001));
		}
		this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
		//instLen = 3;
		this.elapsedCycles += 7;
		return 7;
	};

	//ROR Instructions

	this.ROR_AC = function() {
		this.opcodeType = 'ROR';
		this.pc++;
		var currCarry = this.P & 0x01;
		if ((this.accumulator & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.accumulator = this.accumulator >> 1;
		if (currCarry == 1) {
			this.accumulator = this.accumulator | 0b10000000;
		}
		this.calcFlags(null, false, null);
		this.memLog = 'A';
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.ROR_Z = function() {
		this.opcodeType = 'ROR';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		if (this.loggingEnabled) {
			var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
			this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		}

		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b10000000));
		}
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		//instLen = 2;
		this.elapsedCycles += 5;
		return 5;
	};

	this.ROR_Z_X = function() {
		this.opcodeType = 'ROR';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) | 0b10000000));
		}
		this.calcFlags(this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), false, null);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.ROR_A = function() {
		this.opcodeType = 'ROR';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b10000000));
		}
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 6;
		return 6;
	};

	this.ROR_A_X = function() {
		this.opcodeType = 'ROR';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.X) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) | 0b10000000));
		}
		this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
		//instLen = 3;
		this.elapsedCycles += 7;
		return 7;
	};

	//STA Instructions

	this.STA_Z = function() {
		this.opcodeType = 'STA';
		this.pc++;
		var param = this.fetchParams();
		// var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.accumulator));
		// if (this.loggingEnabled) {
		// 	this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		// }
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.STA_Z_X = function() {
		this.opcodeType = 'STA';
		this.pc++;
		var param = this.fetchParams();
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.accumulator));
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.STA_A = function() {
		this.opcodeType = 'STA';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.accumulator));
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	this.STA_A_X = function() {
		this.opcodeType = 'STA';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal((param + this.X), (this.accumulator));
		//instLen = 3;
		this.elapsedCycles += 5;
		return 5;
	};

	this.STA_A_Y = function() {
		this.opcodeType = 'STA';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.accumulator));
		//instLen = 3;
		this.elapsedCycles += 5;
		return 5;
	};

	this.STA_I_X = function() {
		this.opcodeType = 'STA';
		this.pc++;
		var param = this.fetchParams();
		// param += this.X;
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		var memLogBeforeVar = this.nes.MMU.setCpuMemVal((index2 | index1), (this.accumulator));
		// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.STA_I_Y = function() {
		this.opcodeType = 'STA';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		this.nes.MMU.setCpuMemVal(((index2 | index1) + this.Y), (this.accumulator));
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	//Stack Instructions

	this.TXS = function() {
		this.opcodeType = 'TXS';
		this.pc++;
		this.sp = this.X;
		this.elapsedCycles += 2;
		return 2;
	};

	this.TSX = function() {
		this.opcodeType = 'TSX';
		this.pc++;
		this.X = this.sp;
		this.calcFlags(this.X, false, null);
		this.elapsedCycles += 2;
		return 2;
	};

	this.PHA = function() {
		this.opcodeType = 'PHA';
		this.pc++;
		this.pushToStack(this.accumulator);
		this.elapsedCycles += 3;
		return 3;
	};

	this.PLA = function() {
		this.opcodeType = 'PLA';
		this.pc++;
		this.accumulator = this.popFromStack();
		this.calcFlags(null, false, null);
		this.elapsedCycles += 4;
		return 4;
	};

	this.PHP = function() {
		this.opcodeType = 'PHP';
		this.pc++;
		var temp = this.P;
		temp = temp & 0b11101111;
		temp = temp | 0b00110000;
		this.pushToStack(temp);
		this.elapsedCycles += 3;
		return 3;
	};

	this.PLP = function() {
		this.opcodeType = 'PLP';
		this.pc++;
		var temp = this.popFromStack();
		if ((temp & 0b00000001) == 0x01)
			this.setFlag('carry');
		else this.unsetFlag('carry');

		if ((temp & 0b00000010) >> 1 == 0x01)
			this.setFlag('zero');
		else this.unsetFlag('zero');

		if ((temp & 0b00000100) >> 2 == 0x01)
			this.setFlag('irqDisable');
		else this.unsetFlag('irqDisable');

		if ((temp & 0b00001000) >> 3 == 0x01)
			this.setFlag('decimal');
		else this.unsetFlag('decimal');

		if ((temp & 0b01000000) >> 6 == 0x01)
			this.setFlag('overflow');
		else this.unsetFlag('overflow');

		if ((temp & 0b10000000) >> 7 == 0x01)
			this.setFlag('negative');
		else this.unsetFlag('negative');

		this.elapsedCycles += 4;
		return 4;
	};


	//STX Instructions

	this.STX_Z = function() {
		this.opcodeType = 'STX';
		this.pc++;
		var param = this.fetchParams();
		var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.X));
		//instLen = 2;
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		this.elapsedCycles += 3;
		return 3;
	};

	this.STX_Z_Y = function() {
		this.opcodeType = 'STX';
		this.pc++;
		var param = this.fetchParams();
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.Y)), (this.X));
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.STX_A = function() {
		this.opcodeType = 'STX';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.X));
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};


	//STY Instructions

	this.STY_Z = function() {
		this.opcodeType = 'STY';
		this.pc++;
		var param = this.fetchParams();
		var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.Y));
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.STY_Z_X = function() {
		this.opcodeType = 'STY';
		this.pc++;
		var param = this.fetchParams();
		this.nes.MMU.setCpuMemVal(this.wrap8bit('sum', param, this.X), (this.Y));
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.STY_A = function() {
		this.opcodeType = 'STY';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.Y));
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};


	//Register Instructions

	this.TAX = function() {
		this.opcodeType = 'TAX';
		this.pc++;
		this.X = this.accumulator;
		this.calcFlags(this.X, false, null);
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.TXA = function() {
		this.opcodeType = 'TXA';
		this.pc++;
		this.accumulator = this.X;
		this.calcFlags(null, false, null);
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.DEX = function() {
		this.opcodeType = 'DEX';
		this.pc++;
		this.X = this.wrap8bit('decrement', this.X, null);
		this.calcFlags(this.X, false, null);
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.INX = function() {
		this.opcodeType = 'INX';
		this.pc++;
		this.X = this.wrap8bit('increment', this.X, null);
		this.calcFlags(this.X, false, null);
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.TAY = function() {
		this.opcodeType = 'TAY';
		this.pc++;
		this.Y = this.accumulator;
		this.calcFlags(this.Y, false, null);
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.TYA = function() {
		this.opcodeType = 'TYA';
		this.pc++;
		this.accumulator = this.Y;
		this.calcFlags(null, false, null);
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.DEY = function() {
		this.opcodeType = 'DEY';
		this.pc++;
		this.Y = this.wrap8bit('decrement', this.Y, null);
		this.calcFlags(this.Y, false, null);
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.INY = function() {
		this.opcodeType = 'INY';
		this.pc++;
		this.Y = this.wrap8bit('increment', this.Y, null);
		this.calcFlags(this.Y, false, null);
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	//INC Instructions

	this.INC_Z = function() {
		this.opcodeType = 'INC';
		this.pc++;
		var param = this.fetchParams();
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param), null)));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		if (this.loggingEnabled)
			this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 5;
		return 5;
	};

	this.INC_Z_X = function() {
		this.opcodeType = 'INC';
		this.pc++;
		var param = this.fetchParams();
		var loc = this.wrap8bit('sum', param, this.X);
		var valueAtLoc = this.nes.MMU.getCpuMemVal(loc);
		//increment
		valueAtLoc = this.wrap8bit('increment', valueAtLoc, null);
		// this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), null)));
		this.nes.MMU.setCpuMemVal(loc, valueAtLoc);
		this.calcFlags(this.nes.MMU.getCpuMemVal(loc), false, null);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.INC_A = function() {
		this.opcodeType = 'INC';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param), null)));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 6;
		return 6;
	};

	this.INC_A_X = function() {
		this.opcodeType = 'INC';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal((param + this.X), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param + this.X), null)));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
		//instLen = 3;
		this.elapsedCycles += 7;
		return 7;
	};

	this.DEC_Z = function() {
		this.opcodeType = 'DEC';
		this.pc++;
		var param = this.fetchParams();
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param), null)));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 5;
		return 5;
	};

	this.DEC_Z_X = function() {
		this.opcodeType = 'DEC';
		this.pc++;
		var param = this.fetchParams();
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), null)));
		this.calcFlags(this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), false, null);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.DEC_A = function() {
		this.opcodeType = 'DEC';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param), null)));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 6;
		return 6;
	};

	this.DEC_A_X = function() {
		this.opcodeType = 'DEC';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal((param + this.X), (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param + this.X), null)));
		this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
		//instLen = 3;
		this.elapsedCycles += 7;
		return 7;
	};

	//Flag Instructions

	this.CLC = function() {
		this.opcodeType = 'CLC';
		this.pc++;
		this.unsetFlag('carry');
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.SEC = function() {
		this.opcodeType = 'SEC';
		this.pc++;
		this.setFlag('carry');
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.CLI = function() {
		this.opcodeType = 'CLI';
		this.pc++;
		this.unsetFlag('irqDisable');
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.SEI = function() {
		this.opcodeType = 'SEI';
		this.pc++;
		this.setFlag('irqDisable');
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.CLV = function() {
		this.opcodeType = 'CLV';
		this.pc++;
		this.unsetFlag('overflow');
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.CLD = function() {
		this.opcodeType = 'CLD';
		this.pc++;
		this.unsetFlag('decimal');
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	this.SED = function() {
		this.opcodeType = 'SED';
		this.pc++;
		this.setFlag('decimal');
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	//JMP Instructions

	this.JMP_A = function() {
		this.opcodeType = 'JMP';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.pc = param;
		if (this.loggingEnabled)
			this.memLog = '$' + param.toString(16).toUpperCase();
		//instLen = 3;
		this.elapsedCycles += 3;
		return 3;
	};

	this.JMP_I = function() {
		this.opcodeType = 'JMP';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var lowerByte, higherByte;
		var jmpLocation;
		//var lowNibble = this.nes.MMU.getCpuMemVal(param);
		if (param1 == 0xFF) {
			lowerByte = param;
			higherByte = param2 | 0x00;
		}
		else {
			lowerByte = param;
			higherByte = param2 | (param1 + 1);
		}
		jmpLocation = (this.nes.MMU.getCpuMemVal(higherByte) << 8) | this.nes.MMU.getCpuMemVal(lowerByte);
		this.pc = jmpLocation;
		//instLen = 3;
		this.elapsedCycles += 5;
		return 5;
	};

	//JSR Instructions

	this.JSR_A = function() {
		this.opcodeType = 'JSR';
		this.pc++;
		//get address to jump from params
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		//Transfer next instruction - 1 point to stack
		this.pushToStack((this.pc - 1) >> 8);
		this.pushToStack((this.pc - 1) & 0x00FF);
		this.pc = param;
		if (this.loggingEnabled)
			this.memLog = '$' + param.toString(16).toUpperCase();
		//instLen = 3;
		this.elapsedCycles += 6;
		return 6;
	};

	//NOP 

	this.NOP = function() {
		if (this.currentOpcode == 0xEA)
			this.opcodeType = 'NOP';
		else
			this.opcodeType = '*NOP';
		this.pc++;
		//instLen = 1;
		this.elapsedCycles += 2;
		return 2;
	};

	//BRK Instructions

	this.BRK = function() {
		this.opcodeType = 'BRK';
		this.pc++;
		var param = this.fetchParams();
		this.serveISR('BRK');
		//instLen = 1;
		this.elapsedCycles += 7;
		return 7;
		//TODO ??
	};

	//RTI Instructions

	this.RTI = function() {
		this.opcodeType = 'RTI';
		// this.P = this.popFromStack();
		var temp = this.popFromStack();
		if ((temp & 0b00000001) == 0x01)
			this.setFlag('carry');
		else this.unsetFlag('carry');

		if ((temp & 0b00000010) >> 1 == 0x01)
			this.setFlag('zero');
		else this.unsetFlag('zero');

		if ((temp & 0b00000100) >> 2 == 0x01)
			this.setFlag('irqDisable');
		else this.unsetFlag('irqDisable');

		if ((temp & 0b00001000) >> 3 == 0x01)
			this.setFlag('decimal');
		else this.unsetFlag('decimal');

		if ((temp & 0b01000000) >> 6 == 0x01)
			this.setFlag('overflow');
		else this.unsetFlag('overflow');

		if ((temp & 0b10000000) >> 7 == 0x01)
			this.setFlag('negative');
		else this.unsetFlag('negative');

		var lowByte = this.popFromStack();
		var highByte = this.popFromStack();
		this.pc = (highByte << 8) | lowByte;
		//instLen = 1;
		this.elapsedCycles += 6;
		return 6;
	};

	this.RTS = function() {
		this.opcodeType = 'RTS';
		var lowByte = this.popFromStack();
		var highByte = this.popFromStack();
		this.pc = ((highByte << 8) | lowByte) + 1;
		//instLen = 1;
		this.elapsedCycles += 6;
		return 6;
	};

	//Branch Instructions

	this.BPL = function() {
		this.opcodeType = 'BPL';
		var cycles = 0;
		this.pc++;
		var param = this.fetchParams();
		var offset = this.calcOffset(param);
		if (this.loggingEnabled)
			this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
		if ((this.P >> 7) == 0) {
			// this.pc--;
			// var offset = this.calcOffset(param);
			if ((this.pc >> 8) != ((this.pc + offset) >> 8)) {
				this.elapsedCycles++; //Incrementing as page boundary crossing occured
				cycles++;
			}
			this.pc += offset;
			this.elapsedCycles++;
			cycles++;
		}
		//instLen = 2;
		this.elapsedCycles += 2;
		return cycles + 2;
	};

	this.BMI = function() {
		this.opcodeType = 'BMI';
		var cycles = 0;
		this.pc++;
		var param = this.fetchParams();
		var offset = this.calcOffset(param);
		if (this.loggingEnabled)
			this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
		if ((this.P >> 7) == 1) {
			// this.pc--;
			// var offset = this.calcOffset(param);
			if ((this.pc >> 8) != ((this.pc + offset) >> 8)) {
				this.elapsedCycles++; //Incrementing as page boundary crossing occured
				cycles++;
			}
			this.pc += offset;
			this.elapsedCycles++;
			cycles++;
		}
		//instLen = 2;
		this.elapsedCycles += 2;
		return cycles + 2;
	};

	this.BVC = function() {
		this.opcodeType = 'BVC';
		var cycles = 0;
		this.pc++;
		var param = this.fetchParams();
		var offset = this.calcOffset(param);
		if (this.loggingEnabled)
			this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
		if (((this.P >> 6) & 0x01) == 0) {
			// this.pc--;
			// var offset = this.calcOffset(param);
			if ((this.pc >> 8) != ((this.pc + offset) >> 8)) {
				this.elapsedCycles++; //Incrementing as page boundary crossing occured
				cycles++;
			}
			this.pc += offset;
			this.elapsedCycles++;
			cycles++;
		}
		//instLen = 2;
		this.elapsedCycles += 2;
		return cycles + 2;
	};

	this.BVS = function() {
		this.opcodeType = 'BVS';
		var cycles = 0;
		this.pc++;
		var param = this.fetchParams();
		var offset = this.calcOffset(param);
		if (this.loggingEnabled)
			this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
		if (((this.P >> 6) & 0x01) == 1) {
			// this.pc--;
			// var offset = this.calcOffset(param);
			if ((this.pc >> 8) != ((this.pc + offset) >> 8)) {
				this.elapsedCycles++; //Incrementing as page boundary crossing occured
				cycles++;
			}
			this.pc += offset;
			this.elapsedCycles++;
			cycles++;
		}
		//instLen = 2;
		this.elapsedCycles += 2;
		return cycles + 2;
	};

	this.BCC = function() {
		this.opcodeType = 'BCC';
		var cycles = 0;
		this.pc++;
		var param = this.fetchParams();
		var offset = this.calcOffset(param);
		if (this.loggingEnabled)
			this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
		if ((this.P & 0x01) == 0) {
			// this.pc--;
			// var offset = this.calcOffset(param);
			if ((this.pc >> 8) != ((this.pc + offset) >> 8)) {
				this.elapsedCycles++; //Incrementing as page boundary crossing occured
				cycles++;
			}
			this.pc += offset;
			this.elapsedCycles++;
			cycles++;
		}
		//instLen = 2;
		this.elapsedCycles += 2;
		return cycles + 2;
	};

	this.BCS = function() {
		this.opcodeType = 'BCS';
		var cycles = 0;
		this.pc++;
		var param = this.fetchParams();
		var offset = this.calcOffset(param);
		if (this.loggingEnabled)
			this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
		if ((this.P & 0x01) == 1) {
			// this.pc--;
			if ((this.pc >> 8) != ((this.pc + offset) >> 8)) {
				this.elapsedCycles++; //Incrementing as page boundary crossing occured
				cycles++;
			}
			this.pc += offset;
			this.elapsedCycles++; //Incrementing as branch is taken
			cycles++;
		}
		//instLen = 2;
		this.elapsedCycles += 2;
		return cycles + 2;
	};

	this.BNE = function() {
		this.opcodeType = 'BNE';
		var cycles = 0;
		this.pc++;
		var param = this.fetchParams();
		var offset = this.calcOffset(param);
		if (this.loggingEnabled)
			this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
		if (((this.P >> 1) & 0x01) == 0) {
			// this.pc--;

			if ((this.pc >> 8) != ((this.pc + offset) >> 8)) {
				this.elapsedCycles++; //Incrementing as page boundary crossing occured
				cycles++;
			}
			this.pc += offset;
			this.elapsedCycles++;
			cycles++;
		}
		//instLen = 2;
		this.elapsedCycles += 2;
		return cycles + 2;
	};

	this.BEQ = function() {
		this.opcodeType = 'BEQ';
		var cycles = 0;
		this.pc++;
		var param = this.fetchParams();
		var offset = this.calcOffset(param);
		if (this.loggingEnabled)
			this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
		if (((this.P >> 1) & 0x01) == 1) {
			// this.pc--;
			// var offset = this.calcOffset(param);
			if ((this.pc >> 8) != ((this.pc + offset) >> 8)) {
				this.elapsedCycles++; //Incrementing as page boundary crossing occured
			}
			this.pc += offset;
			this.elapsedCycles++;
			cycles++;
		}
		//instLen = 2;
		this.elapsedCycles += 2;
		return cycles + 2;
	};

	//CPX Instructions

	this.CPX_I = function() {
		this.opcodeType = 'CPX';
		this.pc++;
		var param = this.fetchParams();
		var result = this.compareValsAndSetNegative(this.X, param);
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 2;
		return 2;
	};

	this.CPX_Z = function() {
		this.opcodeType = 'CPX';
		this.pc++;
		var param = this.fetchParams();
		var result = this.compareValsAndSetNegative(this.X, this.nes.MMU.getCpuMemVal(param));
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		//instLen = 2;
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		this.elapsedCycles += 3;
		return 3;
	};

	this.CPX_A = function() {
		this.opcodeType = 'CPX';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.X, this.nes.MMU.getCpuMemVal(param));
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	//CPY Instructions

	this.CPY_I = function() {
		this.opcodeType = 'CPY';
		this.pc++;
		var param = this.fetchParams();
		var result = this.compareValsAndSetNegative(this.Y, param);
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		//instLen = 2;
		// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		this.elapsedCycles += 2;
		return 2;
	};

	this.CPY_Z = function() {
		this.opcodeType = 'CPY';
		this.pc++;
		var param = this.fetchParams();
		var result = this.compareValsAndSetNegative(this.Y, this.nes.MMU.getCpuMemVal(param));
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.CPY_A = function() {
		this.opcodeType = 'CPY';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.Y, this.nes.MMU.getCpuMemVal(param));
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	//CMP Instructions

	this.CMP_I = function() {
		this.opcodeType = 'CMP';
		this.pc++;
		var param = this.fetchParams();
		var result = this.compareValsAndSetNegative(this.accumulator, param);
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 2;
		return 2;
	};

	this.CMP_Z = function() {
		this.opcodeType = 'CMP';
		this.pc++;
		var param = this.fetchParams();
		var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(param));
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.CMP_Z_X = function() {
		this.opcodeType = 'CMP';
		this.pc++;
		var param = this.fetchParams();
		var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)));
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.CMP_A = function() {
		this.opcodeType = 'CMP';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(param));
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	this.CMP_A_X = function() {
		this.opcodeType = 'CMP';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(param + this.X));
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		//instLen = 2;
		if ((param1 + this.X) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.CMP_A_Y = function() {
		this.opcodeType = 'CMP';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(param + this.Y));
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		//instLen = 2;
		if ((param1 + this.Y) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.CMP_I_X = function() {
		this.opcodeType = 'CMP';
		this.pc++;
		var param = this.fetchParams();
		// param += this.X;
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		// param = index2 | index1;
		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(index2 | index1);
		var result = this.compareValsAndSetNegative(this.accumulator, memLogBeforeVar);
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.CMP_I_Y = function() {
		this.opcodeType = 'CMP';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(param + this.Y));
		if (result > 0) {
			this.setFlag('carry');
			// this.unsetFlag('negative');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
			// this.unsetFlag('negative');
		}
		if (result < 0) {
			// this.setFlag('negative');
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		//instLen = 2;
		if ((index1 + this.Y) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	//BIT Instructions

	this.BIT_Z = function() {
		this.opcodeType = 'BIT';
		this.pc++;
		var param = this.fetchParams();
		var temp = this.nes.MMU.getCpuMemVal(param);
		var result = this.accumulator & temp;
		if (result == 0) {
			this.setFlag('zero');
		}
		else
			this.unsetFlag('zero');

		if ((0b10000000 & temp) == 128) {
			this.setFlag('negative');
		}
		else {
			this.unsetFlag('negative');
		}
		if ((0b01000000 & temp) == 64) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + temp.toString(16).toUpperCase()).slice(-2);
		this.elapsedCycles += 3;
		return 3;
	};


	this.BIT_A = function() {
		this.opcodeType = 'BIT';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = this.nes.MMU.getCpuMemVal(param);
		var result = this.accumulator & temp;
		if (result == 0) {
			this.setFlag('zero');
		}
		else
			this.unsetFlag('zero');

		if ((0b10000000 & temp) == 128) {
			this.setFlag('negative');
		}
		else {
			this.unsetFlag('negative');
		}
		if ((0b01000000 & temp) == 64) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + temp.toString(16).toUpperCase()).slice(-2);
		this.elapsedCycles += 4;
		return 4;
	};


	//Unofficial OPcodes
	this.DOP_Z = function() {
		this.opcodeType = '*NOP';
		this.pc++;
		var param = this.fetchParams();
		this.elapsedCycles += 3;
		return 3;
	};

	this.DOP_Z_X = function() {
		this.opcodeType = '*NOP';
		this.pc++;
		var param = this.fetchParams();
		this.elapsedCycles += 4;
		return 4;
	};

	this.DOP_I = function() {
		this.opcodeType = '*NOP';
		this.pc++;
		var param = this.fetchParams();
		// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
		this.elapsedCycles += 2;
		return 2;
	};

	this.TOP_A = function() {
		this.opcodeType = '*NOP';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		this.elapsedCycles = 4;
		return 4;
	};

	this.TOP_A_X = function() {
		this.opcodeType = '*NOP';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		if ((param1 + this.X) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}
	};

	this.LAX_Z = function() {
		this.opcodeType = '*LAX';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.nes.MMU.getCpuMemVal(param);
		this.X = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};

	this.LAX_Z_Y = function() {
		this.opcodeType = '*LAX';
		this.pc++;
		var param = this.fetchParams();
		this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
		this.X = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
		this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.LAX_A = function() {
		this.opcodeType = '*LAX';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.nes.MMU.getCpuMemVal(param);
		this.X = this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	this.LAX_A_Y = function() {
		this.opcodeType = '*LAX';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		// this.X = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
		this.X = this.nes.MMU.getCpuMemVal(param + this.Y);
		this.accumulator = this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		//instLen = 3;
		if ((param1 + this.Y) > 0xFF) {
			this.elapsedCycles += 5;
			return 5;
		}
		else {
			this.elapsedCycles += 4;
			return 4;
		}

	};
	this.LAX_I_X = function() {
		this.opcodeType = '*LAX';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		this.accumulator = this.nes.MMU.getCpuMemVal(index2 | index1);
		this.X = this.nes.MMU.getCpuMemVal(index2 | index1);
		this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.LAX_I_Y = function() {
		this.opcodeType = '*LAX';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		this.accumulator = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
		this.X = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
		// this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', (index2 | index1), this.Y));
		this.calcFlags(null, false, null);
		//instLen = 2;
		if ((index1 + this.Y) > 0xFF) {
			this.elapsedCycles += 6;
			return 6;
		}
		else {
			this.elapsedCycles += 5;
			return 5;
		}
	};

	this.SAX_Z = function() {
		this.opcodeType = '*SAX';
		this.pc++;
		var param = this.fetchParams();
		this.nes.MMU.setCpuMemVal(param, (this.accumulator & this.X));
		// this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 3;
		return 3;
	};
	this.SAX_Z_Y = function() {
		this.opcodeType = '*SAX';
		this.pc++;
		var param = this.fetchParams();
		this.nes.MMU.setCpuMemVal(this.wrap8bit('sum', param, this.Y), (this.accumulator & this.X));
		// this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 4;
		return 4;
	};

	this.SAX_I_X = function() {
		this.opcodeType = '*SAX';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		this.nes.MMU.setCpuMemVal((index2 | index1), (this.accumulator & this.X));
		// this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};
	this.SAX_A = function() {
		this.opcodeType = '*SAX';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal(param, (this.accumulator & this.X));
		// this.calcFlags(null, false, null);
		//instLen = 3;
		this.elapsedCycles += 4;
		return 4;
	};

	this.DCP_Z = function() {
		this.opcodeType = '*DCP';
		this.pc++;
		var param = this.fetchParams();
		this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param), null)));
		var temp = this.nes.MMU.getCpuMemVal(param);
		var result = this.compareValsAndSetNegative(this.accumulator, temp);
		if (result > 0) {
			this.setFlag('carry');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
		}
		if (result < 0) {
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		this.elapsedCycles += 5;
		return 5;
	};

	this.DCP_Z_X = function() {
		this.opcodeType = '*DCP';
		this.pc++;
		var param = this.fetchParams(param);
		this.nes.MMU.setCpuMemVal(this.wrap8bit('sum', param, this.X), (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), null)));
		var temp = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var result = this.compareValsAndSetNegative(this.accumulator, temp);
		if (result > 0) {
			this.setFlag('carry');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
		}
		if (result < 0) {
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		this.elapsedCycles += 6;
		return 6;
	};

	this.DCP_A = function() {
		this.opcodeType = '*DCP';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param), null)));
		var temp = this.nes.MMU.getCpuMemVal(param);
		var result = this.compareValsAndSetNegative(this.accumulator, temp);
		if (result > 0) {
			this.setFlag('carry');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
		}
		if (result < 0) {
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		this.elapsedCycles += 6;
		return 6;
	};

	this.DCP_A_X = function() {
		this.opcodeType = '*DCP';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal(param + this.X, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param + this.X), null)));
		var temp = this.nes.MMU.getCpuMemVal(param + this.X);
		var result = this.compareValsAndSetNegative(this.accumulator, temp);
		if (result > 0) {
			this.setFlag('carry');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
		}
		if (result < 0) {
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		this.elapsedCycles += 7;
		return 7;
	};
	this.DCP_A_Y = function() {
		this.opcodeType = '*DCP';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal(param + this.Y, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param + this.Y), null)));
		var temp = this.nes.MMU.getCpuMemVal(param + this.Y);
		var result = this.compareValsAndSetNegative(this.accumulator, temp);
		if (result > 0) {
			this.setFlag('carry');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
		}
		if (result < 0) {
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		this.elapsedCycles += 7;
		return 7;
	};
	this.DCP_I_X = function() {
		this.opcodeType = '*DCP';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param), null)));
		var temp = this.nes.MMU.getCpuMemVal(param);
		var result = this.compareValsAndSetNegative(this.accumulator, temp);
		if (result > 0) {
			this.setFlag('carry');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
		}
		if (result < 0) {
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		this.elapsedCycles += 8;
		return 8;
	};
	this.DCP_I_Y = function() {
		this.opcodeType = '*DCP';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		this.nes.MMU.setCpuMemVal(param + this.Y, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param + this.Y), null)));
		var temp = this.nes.MMU.getCpuMemVal(param + this.Y);
		var result = this.compareValsAndSetNegative(this.accumulator, temp);
		if (result > 0) {
			this.setFlag('carry');
			this.unsetFlag('zero');
		}
		if (result == 0) {
			this.setFlag('carry');
			this.setFlag('zero');
		}
		if (result < 0) {
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
		this.elapsedCycles += 8;
		return 8;
	};

	this.ISB_Z = function() {
		this.opcodeType = '*ISB';
		this.pc++;
		var param = this.fetchParams();
		this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param), null)));
		var arg = this.nes.MMU.getCpuMemVal(param);
		var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
		if ((this.P & 0x01) == 0x00)
			temp = temp - 1;
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');

		if (this.accumulator >= arg)
			this.setFlag('carry');
		else this.unsetFlag('carry');

		this.accumulator = this.toSigned8bit(temp);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 5;
		return 5;
	};

	this.ISB_Z_X = function() {
		this.opcodeType = '*ISB';
		this.pc++;
		var param = this.fetchParams();
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), null)));
		var arg = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
		if ((this.P & 0x01) == 0x00)
			temp = temp - 1;
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');

		if (this.accumulator >= arg)
			this.setFlag('carry');
		else this.unsetFlag('carry');
		this.accumulator = this.toSigned8bit(temp);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 6;
		return 6;
	};

	this.ISB_A = function() {
		this.opcodeType = '*ISB';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param), null)));
		var arg = this.nes.MMU.getCpuMemVal(param);
		var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
		if ((this.P & 0x01) == 0x00)
			temp = temp - 1;
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');

		if (this.accumulator >= arg)
			this.setFlag('carry');
		else this.unsetFlag('carry');

		this.accumulator = this.toSigned8bit(temp);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 6;
		return 6;
	};

	this.ISB_A_X = function() {
		this.opcodeType = '*ISB';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal((param + this.X), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param + this.X), null)));
		var arg = this.nes.MMU.getCpuMemVal(param + this.X);
		var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
		if ((this.P & 0x01) == 0x00)
			temp = temp - 1;
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');

		if (this.accumulator >= arg)
			this.setFlag('carry');
		else this.unsetFlag('carry');

		this.accumulator = this.toSigned8bit(temp);
		this.calcFlags(null, false, null);
		//instLen = 3;
		this.elapsedCycles += 7;
		return 3;
	};

	this.ISB_A_Y = function() {
		this.opcodeType = '*ISB';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param + this.Y), null)));
		var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
		var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
		if ((this.P & 0x01) == 0x00)
			temp = temp - 1;
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');

		if (this.accumulator >= arg)
			this.setFlag('carry');
		else this.unsetFlag('carry');

		this.accumulator = this.toSigned8bit(temp);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 7;
		return 7;
	};

	this.ISB_I_X = function() {
		this.opcodeType = '*ISB';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		this.nes.MMU.setCpuMemVal((param), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param), null)));
		var arg = this.nes.MMU.getCpuMemVal(param);
		var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
		if ((this.P & 0x01) == 0x00)
			temp = temp - 1;
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');

		if (this.accumulator >= arg)
			this.setFlag('carry');
		else this.unsetFlag('carry');

		this.accumulator = this.toSigned8bit(temp);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 8;
		return 8;
	};
	this.ISB_I_Y = function() {
		this.opcodeType = '*ISB';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param + this.Y), null)));
		var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
		var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
		if ((this.P & 0x01) == 0x00)
			temp = temp - 1;
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');

		if (this.accumulator >= arg)
			this.setFlag('carry');
		else this.unsetFlag('carry');

		this.accumulator = this.toSigned8bit(temp);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 8;
		return 8;
	};

	this.SLO_Z = function() {
		this.opcodeType = '*SLO';
		this.pc++;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal(param, this.nes.MMU.getCpuMemVal(param) << 1);
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 5;
		return 5;
	};

	this.SLO_Z_X = function() {
		this.opcodeType = '*SLO';
		this.pc++;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) << 1));
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
		this.elapsedCycles += 6;
		return 6;
	};
	this.SLO_A = function() {
		this.opcodeType = '*SLO';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 6;
		return 6;
	};
	this.SLO_A_X = function() {
		this.opcodeType = '*SLO';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.X) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) << 1));
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param + this.X);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 7;
		return 7;
	};

	this.SLO_A_Y = function() {
		this.opcodeType = '*SLO';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.Y) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) << 1));
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 7;
		return 7;
	};
	this.SLO_I_X = function() {
		this.opcodeType = '*SLO';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) << 1));
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 8;
		return 8;
	};
	this.SLO_I_Y = function() {
		this.opcodeType = '*SLO';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		if ((this.nes.MMU.getCpuMemVal(param + this.Y) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) << 1));
		this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 8;
		return 8;
	};

	this.RLA_Z = function() {
		this.opcodeType = '*RLA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b00000001));
		}
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 5;
		return 5;
	};

	this.RLA_Z_X = function() {
		this.opcodeType = '*RLA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) | 0b00000001));
		}
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
		this.elapsedCycles += 6;
		return 6;
	};

	this.RLA_A = function() {
		this.opcodeType = '*RLA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b00000001));
		}
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 6;
		return 6;
	};

	this.RLA_A_X = function() {
		this.opcodeType = '*RLA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.X) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) | 0b00000001));
		}
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param + this.X);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 7;
		return 7;
	};
	this.RLA_A_Y = function() {
		this.opcodeType = '*RLA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.Y) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) | 0b00000001));
		}
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 7;
		return 7;
	};
	this.RLA_I_X = function() {
		this.opcodeType = '*RLA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		// param += this.X;
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) | 0b00000001));
		}
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 8;
		return 8;
	};

	this.RLA_I_Y = function() {
		this.opcodeType = '*RLA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		if ((this.nes.MMU.getCpuMemVal(param + this.Y) >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) << 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) | 0b00000001));
		}
		this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 8;
		return 8;
	};

	this.SRE_Z = function() {
		this.opcodeType = '*SRE';
		this.pc++;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 5;
		return 5;
	};

	this.SRE_Z_X = function() {
		this.opcodeType = '*SRE';
		this.pc++;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 1));
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
		this.elapsedCycles += 6;
		return 6;
	};

	this.SRE_A = function() {
		this.opcodeType = '*SRE';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 6;
		return 6;
	};

	this.SRE_A_X = function() {
		this.opcodeType = '*SRE';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.X) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) >> 1));
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param + this.X);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 7;
		return 7;
	};

	this.SRE_A_Y = function() {
		this.opcodeType = '*SRE';
		this.pc++;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.Y) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) >> 1));
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 7;
		return 7;
	};
	this.SRE_I_X = function() {
		this.opcodeType = '*SRE';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) >> 1));
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 8;
		return 8;
	};

	this.SRE_I_Y = function() {
		this.opcodeType = '*SRE';
		this.pc++;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		if ((this.nes.MMU.getCpuMemVal(param + this.Y) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) >> 1));
		this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param + this.Y);
		this.calcFlags(null, false, null);
		this.elapsedCycles += 8;
		return 8;
	};

	this.RRA_Z = function() {
		this.opcodeType = '*RRA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b10000000));
		}
		var arg = this.nes.MMU.getCpuMemVal(param);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		this.elapsedCycles += 5;
		return 5;
	};

	this.RRA_Z_X = function() {
		this.opcodeType = '*RRA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) | 0b10000000));
		}
		var arg = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 6;
		return 6;
	};

	this.RRA_A = function() {
		this.opcodeType = '*RRA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b10000000));
		}
		var arg = this.nes.MMU.getCpuMemVal(param);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		this.elapsedCycles += 6;
		return 6;
	};

	this.RRA_A_X = function() {
		this.opcodeType = '*RRA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.X) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) | 0b10000000));
		}
		var arg = this.nes.MMU.getCpuMemVal(param + this.X);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		this.elapsedCycles += 7;
		return 7;
	};

	this.RRA_A_Y = function() {
		this.opcodeType = '*RRA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param1 = this.fetchParams();
		var param2 = this.fetchParams();
		param2 = param2 << 8;
		var param = param2 | param1;
		if ((this.nes.MMU.getCpuMemVal(param + this.Y) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) | 0b10000000));
		}
		var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		this.elapsedCycles += 7;
		return 7;
	};

	this.RRA_I_X = function() {
		this.opcodeType = '*RRA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		// param += this.X;
		var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) | 0b10000000));
		}
		var arg = this.nes.MMU.getCpuMemVal(param);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		//instLen = 2;
		this.elapsedCycles += 8;
		return 8;
	};

	this.RRA_I_Y = function() {
		this.opcodeType = '*RRA';
		this.pc++;
		var currCarry = this.P & 0x01;
		var param = this.fetchParams();
		var index1 = this.nes.MMU.getCpuMemVal(param);
		var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		if ((this.nes.MMU.getCpuMemVal(param + this.Y) & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) >> 1));
		if (currCarry == 1) {
			this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) | 0b10000000));
		}
		var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
		this.elapsedCycles += 8;
		return 8;
	};

	//Decode fetched instructions 
	this.decodeInstruction = function() {
		// this.prepareLogging();
		switch (this.currentOpcode) {
			//ADC Instructions
			case 0x69:
				return this.ADC_I();
			case 0x65:
				return this.ADC_Z();
			case 0x75:
				return this.ADC_Z_X();
			case 0x6D:
				return this.ADC_A();
			case 0x7D:
				return this.ADC_A_X();
			case 0x79:
				return this.ADC_A_Y();
			case 0x61:
				return this.ADC_I_X();
			case 0x71:
				return this.ADC_I_Y();

				//AND Instructions
			case 0x29:
				return this.AND_I();
			case 0x25:
				return this.AND_Z();
			case 0x35:
				return this.AND_Z_X();
			case 0x2D:
				return this.AND_A();
			case 0x3D:
				return this.AND_A_X();
			case 0x39:
				return this.AND_A_Y();
			case 0x21:
				return this.AND_I_X();
			case 0x31:
				return this.AND_I_Y();

				//ASL Instructions
			case 0x0A:
				return this.ASL_AC();
			case 0x06:
				return this.ASL_Z();
			case 0x16:
				return this.ASL_Z_X();
			case 0x0E:
				return this.ASL_A();
			case 0x1E:
				return this.ASL_A_X();

				//BIT Instructions
			case 0x24:
				return this.BIT_Z();
			case 0x2C:
				return this.BIT_A();

				//Branch Instructions
			case 0x10:
				return this.BPL();
			case 0x30:
				return this.BMI();
			case 0x50:
				return this.BVC();
			case 0x70:
				return this.BVS();
			case 0x90:
				return this.BCC();
			case 0xB0:
				return this.BCS();
			case 0xD0:
				return this.BNE();
			case 0xF0:
				return this.BEQ();

				//BRK Instructions
			case 0x00:
				return this.BRK();

				//CMP Instructions
			case 0xC9:
				return this.CMP_I();
			case 0xC5:
				return this.CMP_Z();
			case 0xD5:
				return this.CMP_Z_X();
			case 0xCD:
				return this.CMP_A();
			case 0xDD:
				return this.CMP_A_X();
			case 0xD9:
				return this.CMP_A_Y();
			case 0xC1:
				return this.CMP_I_X();
			case 0xD1:
				return this.CMP_I_Y();

				//CPX Instructions
			case 0xE0:
				return this.CPX_I();
			case 0xE4:
				return this.CPX_Z();
			case 0xEC:
				return this.CPX_A();

				//CPY Instructions
			case 0xC0:
				return this.CPY_I();
			case 0xC4:
				return this.CPY_Z();
			case 0xCC:
				return this.CPY_A();

				//DEC Instructions
			case 0xC6:
				return this.DEC_Z();
			case 0xD6:
				return this.DEC_Z_X();
			case 0xCE:
				return this.DEC_A();
			case 0xDE:
				return this.DEC_A_X();

				//EOR Instructions
			case 0x49:
				return this.EOR_I();
			case 0x45:
				return this.EOR_Z();
			case 0x55:
				return this.EOR_Z_X();
			case 0x4D:
				return this.EOR_A();
			case 0x5D:
				return this.EOR_A_X();
			case 0x59:
				return this.EOR_A_Y();
			case 0x41:
				return this.EOR_I_X();
			case 0x51:
				return this.EOR_I_Y();

				//Flag Instructions
			case 0x18:
				return this.CLC();
			case 0x38:
				return this.SEC();
			case 0x58:
				return this.CLI();
			case 0x78:
				return this.SEI();
			case 0xB8:
				return this.CLV();
			case 0xD8:
				return this.CLD();
			case 0xF8:
				return this.SED();

				//INC Instructions
			case 0xE6:
				return this.INC_Z();
			case 0xF6:
				return this.INC_Z_X();
			case 0xEE:
				return this.INC_A();
			case 0xFE:
				return this.INC_A_X();

				//JMP Instructions
			case 0x4C:
				return this.JMP_A();
			case 0x6C:
				return this.JMP_I();

				//JSR Instructions
			case 0x20:
				return this.JSR_A();

				//LDA Instuctions
			case 0xA9:
				return this.LDA_I();
			case 0xA5:
				return this.LDA_Z();
			case 0xB5:
				return this.LDA_Z_X();
			case 0xAD:
				return this.LDA_A();
			case 0xBD:
				return this.LDA_A_X();
			case 0xB9:
				return this.LDA_A_Y();
			case 0xA1:
				return this.LDA_I_X();
			case 0xB1:
				return this.LDA_I_Y();

				//LDX Instructions
			case 0xA2:
				return this.LDX_I();
			case 0xA6:
				return this.LDX_Z();
			case 0xB6:
				return this.LDX_Z_Y();
			case 0xAE:
				return this.LDX_A();
			case 0xBE:
				return this.LDX_A_Y();

				//LDY Instructions
			case 0xA0:
				return this.LDY_I();
			case 0xA4:
				return this.LDY_Z();
			case 0xB4:
				return this.LDY_Z_X();
			case 0xAC:
				return this.LDY_A();
			case 0xBC:
				return this.LDY_A_X();

				//LSR Instructions
			case 0x4A:
				this.LSR_AC();
				break;
			case 0x46:
				return this.LSR_Z();
			case 0x56:
				return this.LSR_Z_X();
			case 0x4E:
				return this.LSR_A();
			case 0x5E:
				return this.LSR_A_X();

				//NOP
			case 0xEA:
				return this.NOP();

				//ORA Instructions
			case 0x09:
				return this.ORA_I();
			case 0x05:
				return this.ORA_Z();
			case 0x15:
				return this.ORA_Z_X();
			case 0x0D:
				return this.ORA_A();
			case 0x1D:
				return this.ORA_A_X();
			case 0x19:
				return this.ORA_A_Y();
			case 0x01:
				return this.ORA_I_X();
			case 0x11:
				return this.ORA_I_Y();

				//Register Instructions
			case 0xAA:
				return this.TAX();
			case 0x8A:
				return this.TXA();
			case 0xCA:
				return this.DEX();
			case 0xE8:
				return this.INX();
			case 0xA8:
				return this.TAY();
			case 0x98:
				return this.TYA();
			case 0x88:
				return this.DEY();
			case 0xC8:
				return this.INY();

				//ROL Instructions
			case 0x2A:
				return this.ROL_AC();
			case 0x26:
				return this.ROL_Z();
			case 0x36:
				return this.ROL_Z_X();
			case 0x2E:
				return this.ROL_A();
			case 0x3E:
				return this.ROL_A_X();


				//ROR Instructions
			case 0x6A:
				return this.ROR_AC();
			case 0x66:
				return this.ROR_Z();
			case 0x76:
				return this.ROR_Z_X();
			case 0x6E:
				return this.ROR_A();
			case 0x7E:
				return this.ROR_A_X();

				//RTI Instructions
			case 0x40:
				return this.RTI();

				//RTS Instructions
			case 0x60:
				return this.RTS();

				//SBC Instructions
			case 0xE9:
				return this.SBC_I();
			case 0xE5:
				return this.SBC_Z();
			case 0xF5:
				return this.SBC_Z_X();
			case 0xED:
				return this.SBC_A();
			case 0xFD:
				return this.SBC_A_X();
			case 0xF9:
				return this.SBC_A_Y();
			case 0xE1:
				return this.SBC_I_X();
			case 0xF1:
				return this.SBC_I_Y();


				//STA Instructions
			case 0x85:
				return this.STA_Z();
			case 0x95:
				return this.STA_Z_X();
			case 0x8D:
				return this.STA_A();
			case 0x9D:
				return this.STA_A_X();
			case 0x99:
				return this.STA_A_Y();
			case 0x81:
				return this.STA_I_X();
			case 0x91:
				return this.STA_I_Y();

				//Stack Instructions
			case 0x9A:
				return this.TXS();
			case 0xBA:
				return this.TSX();
			case 0x48:
				return this.PHA();
			case 0x68:
				return this.PLA();
			case 0x08:
				return this.PHP();
			case 0x28:
				return this.PLP();

				//STX Instructions
			case 0x86:
				return this.STX_Z();
			case 0x96:
				return this.STX_Z_Y();
			case 0x8E:
				return this.STX_A();

				//STY Instructions
			case 0x84:
				return this.STY_Z();
			case 0x94:
				return this.STY_Z_X();
			case 0x8C:
				return this.STY_A();

				//Unofficial opcodes
				//http://www.oxyron.de/html/opcodes02.html
			case 0x04:
				return this.DOP_Z();
			case 0x14:
				return this.DOP_Z_X();
			case 0x34:
				return this.DOP_Z_X();
			case 0x44:
				return this.DOP_Z();
			case 0x54:
				return this.DOP_Z_X();
			case 0x64:
				return this.DOP_Z();
			case 0x74:
				return this.DOP_Z_X();
			case 0x80:
				return this.DOP_I();
			case 0x82:
				return this.DOP_I();
			case 0x89:
				return this.DOP_I();
			case 0xC2:
				return this.DOP_I();
			case 0xD4:
				return this.DOP_Z_X();
			case 0xE2:
				return this.DOP_I();
			case 0xF4:
				return this.DOP_Z_X();
			case 0x0C:
				return this.TOP_A();
			case 0x1C:
				return this.TOP_A_X();
			case 0x3C:
				return this.TOP_A_X();
			case 0x5C:
				return this.TOP_A_X();
			case 0x7C:
				return this.TOP_A_X();
			case 0xDC:
				return this.TOP_A_X();
			case 0xFC:
				return this.TOP_A_X();
			case 0x1A:
				return this.NOP();
			case 0x3A:
				return this.NOP();
			case 0x5A:
				return this.NOP();
			case 0x7A:
				return this.NOP();
			case 0xDA:
				return this.NOP();
			case 0xFA:
				return this.NOP();
			case 0x0A7:
				return this.LAX_Z();
			case 0xB7:
				return this.LAX_Z_Y();
			case 0xAF:
				return this.LAX_A();
			case 0xBF:
				return this.LAX_A_Y();
			case 0xA3:
				return this.LAX_I_X();
			case 0xB3:
				return this.LAX_I_Y();
			case 0x87:
				return this.SAX_Z();
			case 0x97:
				return this.SAX_Z_Y();
			case 0x83:
				return this.SAX_I_X();
			case 0x8F:
				return this.SAX_A();
			case 0xEB:
				return this.SBC_I();
			case 0xC7:
				return this.DCP_Z();
			case 0xD7:
				return this.DCP_Z_X();
			case 0xCF:
				return this.DCP_A();
			case 0xDF:
				return this.DCP_A_X();
			case 0xDB:
				return this.DCP_A_Y();
			case 0xC3:
				return this.DCP_I_X();
			case 0xD3:
				return this.DCP_I_Y();
			case 0xE7:
				return this.ISB_Z();
			case 0xF7:
				return this.ISB_Z_X();
			case 0xEF:
				return this.ISB_A();
			case 0xFF:
				return this.ISB_A_X();
			case 0xFB:
				return this.ISB_A_Y();
			case 0xE3:
				return this.ISB_I_X();
			case 0xF3:
				return this.ISB_I_Y();
			case 0x07:
				return this.SLO_Z();
			case 0x17:
				return this.SLO_Z_X();
			case 0x0F:
				return this.SLO_A();
			case 0x1F:
				return this.SLO_A_X();
			case 0x1B:
				return this.SLO_A_Y();
			case 0x03:
				return this.SLO_I_X();
			case 0x13:
				return this.SLO_I_Y();
			case 0x27:
				return this.RLA_Z();
			case 0x37:
				return this.RLA_Z_X();
			case 0x2F:
				return this.RLA_A();
			case 0x3F:
				return this.RLA_A_X();
			case 0x3B:
				return this.RLA_A_Y();
			case 0x23:
				return this.RLA_I_X();
			case 0x33:
				return this.RLA_I_Y();
			case 0x47:
				return this.SRE_Z();
			case 0x57:
				return this.SRE_Z_X();
			case 0x4F:
				return this.SRE_A();
			case 0x5F:
				return this.SRE_A_X();
			case 0x5B:
				return this.SRE_A_Y();
			case 0x43:
				return this.SRE_I_X();
			case 0x53:
				return this.SRE_I_Y();
			case 0x67:
				return this.RRA_Z();
			case 0x77:
				return this.RRA_Z_X();
			case 0x6F:
				return this.RRA_A();
			case 0x7F:
				return this.RRA_A_X();
			case 0x7B:
				return this.RRA_A_Y();
			case 0x63:
				return this.RRA_I_X();
			case 0x73:
				return this.RRA_I_Y();

			default:
				console.log("Unknown opcode: " + this.currentOpcode.toString('16'));
				this.errorFlag = true;
				this.pc++;
				break;
		}
	};

	this.serveISR = function(interrupt) {
		var vector1, vector2;
		switch (interrupt) {
			case 'NMI':
				vector1 = this.nes.MMU.getCpuMemVal(0xFFFA);
				vector2 = this.nes.MMU.getCpuMemVal(0xFFFA + 1);
				vector2 = vector2 << 8;
				//push pc to stack
				this.pushToStack((this.pc & 0xFF00) >> 8); //push high byte
				this.pushToStack(this.pc & 0x00FF); //push low byte
				//push processor status to stack
				this.pushToStack(this.P);
				this.pc = vector2 | vector1;
				this.elapsedCycles += 7;
				return 7;
			case 'BRK':
				vector1 = this.nes.MMU.getCpuMemVal(0xFFFE);
				vector2 = this.nes.MMU.getCpuMemVal(0xFFFE + 1);
				vector2 = vector2 << 8;
				//push pc to stack
				this.pushToStack((this.pc & 0xFF00) >> 8); //push high byte
				this.pushToStack(this.pc & 0x00FF); //push low byte

				//Set the Break flag 
				this.P = this.P & 0b11101111;
				this.P = this.P | 0b00010000;
				this.P = this.P & 0b11011111;
				this.P = this.P | 0b00100000;
				//set unused flag
				//push processor status to stack
				this.pushToStack(this.P);
				//Set the I flag
				this.P = this.P & 0b11111011;
				this.P = this.P | 0b00000100;
				this.pc = vector2 | vector1;
				return 0;
			case 'IRQ':
				vector1 = this.nes.MMU.getCpuMemVal(0xFFFE);
				vector2 = this.nes.MMU.getCpuMemVal(0xFFFE + 1);
				vector2 = vector2 << 8;
				//Clear the BRK flag
				this.P = this.P & 0b11101111;
				//push pc to stack
				this.pushToStack((this.pc & 0xFF00) >> 8); //push high byte
				this.pushToStack(this.pc & 0x00FF); //push low byte
				//set unused flag
				this.P = this.P & 0b11011111;
				this.P = this.P | 0b00100000;
				//push processor status to stack
				this.pushToStack(this.P);
				// //Set the Break flag 
				//Set the I flag
				this.P = this.P & 0b11111011;
				this.P = this.P | 0b00000100;
				this.pc = vector2 | vector1;
				return 0;
			default:
		}
	};

	this.clockCPU = function() {
		if (this.cpuClockRemaining <= 0) {
			this.fetchOpcode();
			this.cpuClockRemaining = this.decodeInstruction();
		}
		this.cpuClockRemaining--;
	};

	this.clockPPU = function() {
		this.ppuCyclesConsumed++;
		if (this.oddFrame && (this.renderedScanline == -1)) {
			this.ppuCyclesCurrentScanLine = 340;
		}
		else {
			this.ppuCyclesCurrentScanLine = 341;
		}
		if (this.ppuCyclesConsumed >= this.ppuCyclesCurrentScanLine) {
			this.renderedScanline = this.nes.PPU.RenderNextScanline(this.nes.MMU.getOAM(), this.nes.MMU.getNameTable(), this.nes.MMU.getAttrTable());
			this.ppuCyclesConsumed = 0;
		}
	};

	this.clockAPU = function() {
		this.nes.APU.run();
	};

	this.run = function() {
		this.frameCompleted = false;
		this.renderedScanline = -1;
		if (this.nes.MMU.chrRamWritten) {
			this.nes.Mapper.reRenderCHR();
		}
		while (!this.frameCompleted) {
			if ((this.P >> 2) & 0x01 == 0x01) { //IRQ is enabled
				if (this.nes.APU.doIrq) {
					this.cpuClockRemaining += this.serveISR('IRQ');
					this.nes.APU.doIrq = false;
				}
			}
			if (this.oddFrame) {
				this.ppuCyclesCurrentScanLine = 340;
				if (this.nes.MMU.OAMDMAwritten) {
					this.cpuClockRemaining += 514;
					this.nes.MMU.OAMDMAwritten = false;
				}
			}
			else {
				this.ppuCyclesCurrentScanLine = 341;
				if (this.nes.MMU.OAMDMAwritten) {
					this.cpuClockRemaining += 513;
					this.nes.MMU.OAMDMAwritten = false;
				}
			}
			this.clockCPU();
			this.clockPPU();
			this.clockPPU();
			this.clockPPU();
			this.clockAPU();
			//Reset OAMADDR, TODO: move this to this.nes.MMU after refactoring
			if (this.renderedScanline == 261 || (this.renderedScanline >= 0 && this.renderedScanline < 240)) {
				this.nes.MMU.setOAMADDR(0);
			}
			if (this.renderedScanline == 241) {
				if (this.nes.MMU.enableNMIGen && this.nes.PPU.NMIOccured) {
					this.cpuClockRemaining += this.serveISR('NMI');
				}
			}
			else if (this.renderedScanline == 261) {
				this.frameCompleted = true;
			}
		}
		this.oddFrame = !this.oddFrame;
	};

	this.runFrame = function() {
		this.frameCompleted = false;
		this.renderedScanline = -1;
		//Need to re render CHR for games using CHR RAM
		if (this.nes.MMU.chrRamWritten) {
			this.nes.Mapper.reRenderCHR();
		}
		this.totalCPUCyclesThisFrame = 0;
		while (!this.frameCompleted) {
			if ((this.P >> 2) & 0x01 == 0x01) { //IRQ is enabled
				if (this.nes.APU.doIrq) {
					this.serveISR('IRQ');
					this.nes.APU.doIrq = false;
				}
			}
			this.cpuCyclesConsumed = this.elapsedCycles;
			this.fetchOpcode();
			this.decodeInstruction();
			this.cpuCyclesGenerated = this.elapsedCycles - this.cpuCyclesConsumed;
			this.elapsedCycles += this.excessCpuCycles;
			this.excessCpuCycles = 0;
			if (this.oddFrame) {
				this.ppuCyclesCurrentScanLine = 340;
				if (this.nes.MMU.OAMDMAwritten) {
					this.elapsedCycles += 514;
					this.nes.MMU.OAMDMAwritten = false;
				}
			}
			else {
				this.ppuCyclesCurrentScanLine = 341;
				if (this.nes.MMU.OAMDMAwritten) {
					this.elapsedCycles += 513;
					this.nes.MMU.OAMDMAwritten = false;
				}
			}
			this.cpuCyclesConsumed = this.elapsedCycles - this.cpuCyclesConsumed;
			this.clockPPU(this.cpuCyclesConsumed);
			this.clockAPU(this.cpuCyclesGenerated);
			this.totalCPUCyclesThisFrame += this.cpuCyclesGenerated;
		}
		this.oddFrame = !this.oddFrame;
	};

}
