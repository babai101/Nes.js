'use strict';
export default function cpu(nes) {
	this.nes = nes;
	this.pc; // 16-Bit Program Counter
	this.sp; // 8-Bit Stack Pointer
	this.accumulator; // 8-Bit Accumulator
	this.X; // 8-Bit Index Register X
	this.Y; // 8-Bit Index Register Y
	this.P; // Processor flag 
	this.elapsedCPUSyncCycles = 0;
	this.totalelapsedCycles = 0;
	this.totalCPUCyclesThisFrame = 0;
	this.loggingEnabled = false;
	// Bit No.       7   6   5   4   3   2   1   0
	//				 S   V       B   D   I   Z   C	


	//PPU related VARS
	this.renderedScanLine = -1;
	this.remainingCPUCycles = 0;
	this.oddFrame = false;
	this.oddCycle = false;
	this.currentOpcode; // Opcode currently processed
	this.operationType; // Current operation type
	this.frameCount = 0;
	this.cpuClockRemaining = 0;
	this.elapsedCycles = 0;
	//Reset CPU and initialize all registers and flags
	this.reset = function() {
		this.sp = 0xFD; //Adjusted for comparing with Nintedulator log
		this.accumulator = 0x00;
		this.X = 0x00;
		this.Y = 0x00;
		this.P = 0b00100100;
		this.totalCpuCyclesDbg = 0;
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
		this.CYCLog = this.totalthis.elapsedCycles;
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

	//CPU helper functions
	this.fetchOpcode = function() {
		this.currentOpcode = this.nes.MMU.getCpuMemVal(this.pc); // Fetched opcode only
	};
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

		//check if overflow flag is to be determined
		if (checkOverflow) {
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
	// this.ADC_I = function() {
	// 	this.opcodeType = 'ADC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var arg = param;
	// 	var temp = this.accumulator + arg + (this.P & 0x01);
	// 	if (((this.accumulator ^ arg) & 0x80) === 0 &&
	// 		((this.accumulator ^ temp) & 0x80) !== 0
	// 	) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	if (temp > 255 ? 1 : 0) {
	// 		this.setFlag('carry');
	// 	}
	// 	else {
	// 		this.unsetFlag('carry');
	// 	}
	// 	this.accumulator = temp & 255;
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 2;
	// };
	// this.ADC_Z = function() {
	// 	this.opcodeType = 'ADC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var arg = this.nes.MMU.getCpuMemVal(param);
	// 	var temp = this.accumulator + arg + (this.P & 0x01);
	// 	if (
	// 		((this.accumulator ^ arg) & 0x80) === 0 &&
	// 		((this.accumulator ^ temp) & 0x80) !== 0
	// 	) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	if (temp > 255 ? 1 : 0) {
	// 		this.setFlag('carry');
	// 	}
	// 	else {
	// 		this.unsetFlag('carry');
	// 	}
	// 	this.accumulator = temp & 255;
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.ADC_Z_X = function() {
	// 	this.opcodeType = 'ADC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var arg = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.ADC_A = function() {
	// 	this.opcodeType = 'ADC';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var arg = this.nes.MMU.getCpuMemVal(param);
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(arg, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + arg.toString(16).toUpperCase()).slice(-2);
	// 	this.elapsedCycles += 4;
	// };
	// this.ADC_A_X = function() {
	// 	this.opcodeType = 'ADC';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var arg = this.nes.MMU.getCpuMemVal(param + this.X);
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(arg, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.X) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.ADC_A_Y = function() {
	// 	this.opcodeType = 'ADC';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(arg, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.ADC_I_X = function() {
	// 	this.opcodeType = 'ADC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	var arg = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(arg, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + arg.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.ADC_I_Y = function() {
	// 	this.opcodeType = 'ADC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += ;
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	var arg = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(arg, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	if ((index1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 6;
	// 	else
	// 		this.elapsedCycles += 5;
	// };

	// //SBC Instructions
	// this.SBC_I = function() {
	// 	if (this.currentOpcode == 0xEB) {
	// 		this.opcodeType = '*SBC';
	// 	}
	// 	else
	// 		this.opcodeType = 'SBC';
	// 	this.pc++;
	// 	//fetch single param
	// 	var arg = this.fetchParams();
	// 	var temp = this.accumulator - arg - (1 - (this.P & 0x01));
	// 	// this.F_SIGN = (temp >> 7) & 1;
	// 	// this.F_ZERO = temp & 0xff;
	// 	if (
	// 		((this.accumulator ^ temp) & 0x80) !== 0 &&
	// 		((this.accumulator ^ arg) & 0x80) !== 0
	// 	) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	if (temp < 0 ? 0 : 1) {
	// 		this.setFlag('carry');
	// 	}
	// 	else {
	// 		this.unsetFlag('carry');
	// 	}
	// 	this.accumulator = temp & 0xff;
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 2;

	// 	// var arg = this.fetchParams();
	// 	// var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	// if ((this.P & 0x01) == 0x00)
	// 	// 	temp = temp - 1;
	// 	// if (temp < -128 || temp > 127) {
	// 	// 	this.setFlag('overflow');
	// 	// }
	// 	// else this.unsetFlag('overflow');

	// 	// if (this.accumulator >= arg)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');

	// 	// this.accumulator = this.toSigned8bit(temp);
	// 	// this.calcFlags(null, false, null);
	// 	// if(this.loggingEnabled)
	// 	// 	this.memLog = '#$' + ('00' + arg.toString(16).toUpperCase()).slice(-2);
	// 	// //instLen = 2;
	// 	// this.elapsedCycles += 2;
	// };
	// this.SBC_Z = function() {
	// 	this.opcodeType = 'SBC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var arg = this.nes.MMU.getCpuMemVal(param);
	// 	var temp = this.accumulator - arg - (1 - (this.P & 0x01));
	// 	// this.F_SIGN = (temp >> 7) & 1;
	// 	// this.F_ZERO = temp & 0xff;
	// 	if (
	// 		((this.accumulator ^ temp) & 0x80) !== 0 &&
	// 		((this.accumulator ^ arg) & 0x80) !== 0
	// 	) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	if (temp < 0 ? 0 : 1) {
	// 		this.setFlag('carry');
	// 	}
	// 	else {
	// 		this.unsetFlag('carry');
	// 	}
	// 	this.accumulator = temp & 0xff;
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 3;
	// 	// var param = this.fetchParams();
	// 	// var arg = this.nes.MMU.getCpuMemVal(param);
	// 	// var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	// if ((this.P & 0x01) == 0x00)
	// 	// 	temp = temp - 1;
	// 	// if (temp < -128 || temp > 127) {
	// 	// 	this.setFlag('overflow');
	// 	// }
	// 	// else this.unsetFlag('overflow');

	// 	// if (this.accumulator >= arg)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');

	// 	// this.accumulator = this.toSigned8bit(temp);
	// 	// this.calcFlags(null, false, null);
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + arg.toString(16).toUpperCase()).slice(-2);
	// 	// //instLen = 2;
	// 	// this.elapsedCycles += 3;
	// };
	// this.SBC_Z_X = function() {
	// 	this.opcodeType = 'SBC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var arg = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var temp = this.accumulator - arg - (1 - (this.P & 0x01));
	// 	// this.F_SIGN = (temp >> 7) & 1;
	// 	// this.F_ZERO = temp & 0xff;
	// 	if (
	// 		((this.accumulator ^ temp) & 0x80) !== 0 &&
	// 		((this.accumulator ^ arg) & 0x80) !== 0
	// 	) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	if (temp < 0 ? 0 : 1) {
	// 		this.setFlag('carry');
	// 	}
	// 	else {
	// 		this.unsetFlag('carry');
	// 	}
	// 	this.accumulator = temp & 0xff;
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 4;
	// 	// var param = this.fetchParams();
	// 	// var arg = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	// var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	// if ((this.P & 0x01) == 0x00)
	// 	// 	temp = temp - 1;
	// 	// if (temp < -128 || temp > 127) {
	// 	// 	this.setFlag('overflow');
	// 	// }
	// 	// else this.unsetFlag('overflow');

	// 	// if (this.accumulator >= arg)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');

	// 	// this.accumulator = this.toSigned8bit(temp);
	// 	// this.calcFlags(null, false, null);
	// 	// //instLen = 2;
	// 	// this.elapsedCycles += 4;
	// };
	// this.SBC_A = function() {
	// 	this.opcodeType = 'SBC';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var arg = this.nes.MMU.getCpuMemVal(param);
	// 	var temp = this.accumulator - arg - (1 - (this.P & 0x01));
	// 	// this.F_SIGN = (temp >> 7) & 1;
	// 	// this.F_ZERO = temp & 0xff;
	// 	if (
	// 		((this.accumulator ^ temp) & 0x80) !== 0 &&
	// 		((this.accumulator ^ arg) & 0x80) !== 0
	// 	) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	if (temp < 0 ? 0 : 1) {
	// 		this.setFlag('carry');
	// 	}
	// 	else {
	// 		this.unsetFlag('carry');
	// 	}
	// 	this.accumulator = temp & 0xff;
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 4;
	// 	// var param1 = this.fetchParams();
	// 	// var param2 = this.fetchParams();
	// 	// param2 = param2 << 8;
	// 	// var param = param2 | param1;
	// 	// var arg = this.nes.MMU.getCpuMemVal(param);
	// 	// var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	// if ((this.P & 0x01) == 0x00)
	// 	// 	temp = temp - 1;
	// 	// if (temp < -128 || temp > 127) {
	// 	// 	this.setFlag('overflow');
	// 	// }
	// 	// else this.unsetFlag('overflow');

	// 	// if (this.accumulator >= arg)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');

	// 	// this.accumulator = this.toSigned8bit(temp);
	// 	// this.calcFlags(null, false, null);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + arg.toString(16).toUpperCase()).slice(-2);
	// 	// //instLen = 3;
	// 	// this.elapsedCycles += 4;
	// };
	// this.SBC_A_X = function() {
	// 	this.opcodeType = 'SBC';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var arg = this.nes.MMU.getCpuMemVal(param + this.X);
	// 	var temp = this.accumulator - arg - (1 - (this.P & 0x01));
	// 	// this.F_SIGN = (temp >> 7) & 1;
	// 	// this.F_ZERO = temp & 0xff;
	// 	if (
	// 		((this.accumulator ^ temp) & 0x80) !== 0 &&
	// 		((this.accumulator ^ arg) & 0x80) !== 0
	// 	) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	if (temp < 0 ? 0 : 1) {
	// 		this.setFlag('carry');
	// 	}
	// 	else {
	// 		this.unsetFlag('carry');
	// 	}
	// 	this.accumulator = temp & 0xff;
	// 	this.calcFlags(null, false, null);
	// 	if ((param1 + this.X) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// 	// var param1 = this.fetchParams();
	// 	// var param2 = this.fetchParams();
	// 	// param2 = param2 << 8;
	// 	// var param = param2 | param1;
	// 	// var arg = this.nes.MMU.getCpuMemVal(param + this.X);
	// 	// var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	// if ((this.P & 0x01) == 0x00)
	// 	// 	temp = temp - 1;
	// 	// if (temp < -128 || temp > 127) {
	// 	// 	this.setFlag('overflow');
	// 	// }
	// 	// else this.unsetFlag('overflow');

	// 	// if (this.accumulator >= arg)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');

	// 	// this.accumulator = this.toSigned8bit(temp);
	// 	// this.calcFlags(null, false, null);
	// 	// //instLen = 3;
	// 	// if ((param1 + this.X) > 0xFF)
	// 	// 	this.elapsedCycles += 5;
	// 	// else
	// 	// 	this.elapsedCycles += 4;
	// };
	// this.SBC_A_Y = function() {
	// 	this.opcodeType = 'SBC';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	var temp = this.accumulator - arg - (1 - (this.P & 0x01));
	// 	// this.F_SIGN = (temp >> 7) & 1;
	// 	// this.F_ZERO = temp & 0xff;
	// 	if (
	// 		((this.accumulator ^ temp) & 0x80) !== 0 &&
	// 		((this.accumulator ^ arg) & 0x80) !== 0
	// 	) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	if (temp < 0 ? 0 : 1) {
	// 		this.setFlag('carry');
	// 	}
	// 	else {
	// 		this.unsetFlag('carry');
	// 	}
	// 	this.accumulator = temp & 0xff;
	// 	this.calcFlags(null, false, null);
	// 	if ((param1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// 	// var param1 = this.fetchParams();
	// 	// var param2 = this.fetchParams();
	// 	// param2 = param2 << 8;
	// 	// var param = param2 | param1;
	// 	// var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	// var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	// if ((this.P & 0x01) == 0x00)
	// 	// 	temp = temp - 1;
	// 	// if (temp < -128 || temp > 127) {
	// 	// 	this.setFlag('overflow');
	// 	// }
	// 	// else this.unsetFlag('overflow');

	// 	// if (this.accumulator >= arg)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');

	// 	// this.accumulator = this.toSigned8bit(temp);
	// 	// this.calcFlags(null, false, null);
	// 	// //instLen = 3;
	// 	// if ((param1 + this.Y) > 0xFF)
	// 	// 	this.elapsedCycles += 5;
	// 	// else
	// 	// 	this.elapsedCycles += 4;
	// };
	// this.SBC_I_X = function() {
	// 	this.opcodeType = 'SBC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	var arg = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	var temp = this.accumulator - arg - (1 - (this.P & 0x01));
	// 	// this.F_SIGN = (temp >> 7) & 1;
	// 	// this.F_ZERO = temp & 0xff;
	// 	if (
	// 		((this.accumulator ^ temp) & 0x80) !== 0 &&
	// 		((this.accumulator ^ arg) & 0x80) !== 0
	// 	) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	if (temp < 0 ? 0 : 1) {
	// 		this.setFlag('carry');
	// 	}
	// 	else {
	// 		this.unsetFlag('carry');
	// 	}
	// 	this.accumulator = temp & 0xff;
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 6;
	// 	// var param = this.fetchParams();
	// 	// var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	// var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	// index2 = index2 << 8;
	// 	// var arg = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	// var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	// if ((this.P & 0x01) == 0x00)
	// 	// 	temp = temp - 1;
	// 	// if (temp < -128 || temp > 127) {
	// 	// 	this.setFlag('overflow');
	// 	// }
	// 	// else this.unsetFlag('overflow');

	// 	// if (this.accumulator >= arg)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');

	// 	// this.accumulator = this.toSigned8bit(temp);
	// 	// this.calcFlags(null, false, null);
	// 	// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + arg.toString(16).toUpperCase()).slice(-2);
	// 	// //instLen = 2;
	// 	// this.elapsedCycles += 6;
	// };
	// this.SBC_I_Y = function() {
	// 	this.opcodeType = 'SBC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	var arg = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
	// 	var temp = this.accumulator - arg - (1 - (this.P & 0x01));
	// 	// this.F_SIGN = (temp >> 7) & 1;
	// 	// this.F_ZERO = temp & 0xff;
	// 	if (
	// 		((this.accumulator ^ temp) & 0x80) !== 0 &&
	// 		((this.accumulator ^ arg) & 0x80) !== 0
	// 	) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	if (temp < 0 ? 0 : 1) {
	// 		this.setFlag('carry');
	// 	}
	// 	else {
	// 		this.unsetFlag('carry');
	// 	}
	// 	this.accumulator = temp & 0xff;
	// 	this.calcFlags(null, false, null);
	// 	if ((index1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 6;
	// 	else
	// 		this.elapsedCycles += 5;
	// 	// var param = this.fetchParams();
	// 	// var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	// var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	// index2 = index2 << 8;
	// 	// var arg = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
	// 	// var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	// if ((this.P & 0x01) == 0x00)
	// 	// 	temp = temp - 1;
	// 	// if (temp < -128 || temp > 127) {
	// 	// 	this.setFlag('overflow');
	// 	// }
	// 	// else this.unsetFlag('overflow');

	// 	// if (this.accumulator >= arg)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');

	// 	// this.accumulator = this.toSigned8bit(temp);
	// 	// this.calcFlags(null, false, null);
	// 	// //instLen = 2;
	// 	// if ((index1 + this.Y) > 0xFF)
	// 	// 	this.elapsedCycles += 6;
	// 	// else
	// 	// 	this.elapsedCycles += 5;
	// };

	// //AND Instructions
	// this.AND_I = function() {
	// 	this.opcodeType = 'AND';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.accumulator & param;
	// 	this.calcFlags(null, false, null);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.AND_Z = function() {
	// 	this.opcodeType = 'AND';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param);
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.AND_Z_X = function() {
	// 	this.opcodeType = 'AND';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.AND_A = function() {
	// 	this.opcodeType = 'AND';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };
	// this.AND_A_X = function() {
	// 	this.opcodeType = 'AND';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param + this.X);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.X) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.AND_A_Y = function() {
	// 	this.opcodeType = 'AND';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.AND_I_X = function() {
	// 	this.opcodeType = 'AND';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	this.calcFlags(null, false, null);
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.AND_I_Y = function() {
	// 	this.opcodeType = 'AND';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.Y;
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	if ((index1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 6;
	// 	else
	// 		this.elapsedCycles += 5;
	// };

	// //EOR Instructions
	// this.EOR_I = function() {
	// 	this.opcodeType = 'EOR';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.accumulator ^ param;
	// 	this.calcFlags(null, false, null);
	// 	// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.EOR_Z = function() {
	// 	this.opcodeType = 'EOR';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param);
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.EOR_Z_X = function() {
	// 	this.opcodeType = 'EOR';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.EOR_A = function() {
	// 	this.opcodeType = 'EOR';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };
	// this.EOR_A_X = function() {
	// 	this.opcodeType = 'EOR';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param + this.X);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.X) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.EOR_A_Y = function() {
	// 	this.opcodeType = 'EOR';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.X) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.EOR_I_X = function() {
	// 	this.opcodeType = 'EOR';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	this.calcFlags(null, false, null);
	// 	// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.EOR_I_Y = function() {
	// 	this.opcodeType = 'EOR';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.Y;
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	if ((index1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 6;
	// 	else
	// 		this.elapsedCycles += 5;
	// };

	// //ORA Instructions
	// this.ORA_I = function() {
	// 	this.opcodeType = 'ORA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.accumulator | param;
	// 	this.calcFlags(null, false, null);
	// 	// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.ORA_Z = function() {
	// 	this.opcodeType = 'ORA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param);
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.ORA_Z_X = function() {
	// 	this.opcodeType = 'ORA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.ORA_A = function() {
	// 	this.opcodeType = 'ORA';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };
	// this.ORA_A_X = function() {
	// 	this.opcodeType = 'ORA';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param + this.X);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.X) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.ORA_A_Y = function() {
	// 	this.opcodeType = 'ORA';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.ORA_I_X = function() {
	// 	this.opcodeType = 'ORA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	this.calcFlags(null, false, null);
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.ORA_I_Y = function() {
	// 	this.opcodeType = 'ORA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.Y;
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	if ((index1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 6;
	// 	else
	// 		this.elapsedCycles += 5;
	// };

	// //ASL Instructions
	// this.ASL_AC = function() {
	// 	this.opcodeType = 'ASL';
	// 	this.pc++;
	// 	if ((this.accumulator >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.accumulator = this.accumulator << 1;
	// 	this.accumulator = this.accumulator & 0xFF;
	// 	this.calcFlags(null, false, null);
	// 	this.memLog = 'A';
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.ASL_Z = function() {
	// 	this.opcodeType = 'ASL';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.nes.MMU.setCpuMemVal(param, this.nes.MMU.getCpuMemVal(param) << 1);
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 5;
	// };
	// this.ASL_Z_X = function() {
	// 	this.opcodeType = 'ASL';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) << 1));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.ASL_A = function() {
	// 	this.opcodeType = 'ASL';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 6;
	// };
	// this.ASL_A_X = function() {
	// 	this.opcodeType = 'ASL';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.X) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) << 1));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 7;
	// };

	// //LDA instructions
	// this.LDA_I = function() {
	// 	this.opcodeType = 'LDA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = param;
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
	// 	this.elapsedCycles += 2;
	// };
	// this.LDA_Z = function() {
	// 	this.opcodeType = 'LDA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + this.accumulator.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.LDA_Z_X = function() {
	// 	this.opcodeType = 'LDA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.LDA_A = function() {
	// 	this.opcodeType = 'LDA';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + this.accumulator.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };
	// this.LDA_A_X = function() {
	// 	this.opcodeType = 'LDA';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var addr = param + this.X;
	// 	if (addr > 0xFFFF)
	// 		addr = addr - (0xFFFF + 1);
	// 	// this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(addr);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.X) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.LDA_A_Y = function() {
	// 	this.opcodeType = 'LDA';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	// this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.LDA_I_X = function() {
	// 	this.opcodeType = 'LDA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	this.calcFlags(null, false, null);
	// 	// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + this.accumulator.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.LDA_I_Y = function() {
	// 	this.opcodeType = 'LDA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	this.accumulator = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
	// 	// this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', (index2 | index1), this.Y));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	if ((index1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 6;
	// 	else
	// 		this.elapsedCycles += 5;
	// };


	// //LDX instructions
	// this.LDX_I = function() {
	// 	this.opcodeType = 'LDX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.X = param;
	// 	this.calcFlags(this.X, false, null);
	// 	//instLen = 2;
	// 	// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
	// 	this.elapsedCycles += 2;
	// };
	// this.LDX_Z = function() {
	// 	this.opcodeType = 'LDX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.X = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(this.X, false, null);
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + this.X.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.LDX_Z_Y = function() {
	// 	this.opcodeType = 'LDX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.X = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
	// 	this.calcFlags(this.X, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.LDX_A = function() {
	// 	this.opcodeType = 'LDX';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.X = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(this.X, false, null);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + this.X.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };
	// this.LDX_A_Y = function() {
	// 	this.opcodeType = 'LDX';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	// this.X = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
	// 	this.X = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(this.X, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };

	// //LDY Instructions
	// this.LDY_I = function() {
	// 	this.opcodeType = 'LDY';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.Y = param;
	// 	this.calcFlags(this.Y, false, null);
	// 	//instLen = 2;
	// 	// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
	// 	this.elapsedCycles += 2;
	// };
	// this.LDY_Z = function() {
	// 	this.opcodeType = 'LDY';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.Y = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(this.Y, false, null);
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + this.Y.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.LDY_Z_X = function() {
	// 	this.opcodeType = 'LDY';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.Y = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	this.calcFlags(this.Y, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.LDY_A = function() {
	// 	this.opcodeType = 'LDY';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.Y = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(this.Y, false, null);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + this.Y.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };
	// this.LDY_A_X = function() {
	// 	this.opcodeType = 'LDY';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	// this.Y = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	this.Y = this.nes.MMU.getCpuMemVal(param + this.X);
	// 	this.calcFlags(this.Y, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.X) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };

	// //LSR Instructions
	// this.LSR_AC = function() {
	// 	this.opcodeType = 'LSR';
	// 	this.pc++;
	// 	if ((this.accumulator & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.accumulator = this.accumulator >> 1;
	// 	this.calcFlags(null, false, null);
	// 	this.memLog = 'A';
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.LSR_Z = function() {
	// 	this.opcodeType = 'LSR';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 5;
	// };
	// this.LSR_Z_X = function() {
	// 	this.opcodeType = 'LSR';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 1));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.LSR_A = function() {
	// 	this.opcodeType = 'LSR';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 6;
	// };
	// this.LSR_A_X = function() {
	// 	this.opcodeType = 'LSR';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.X) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) >> 1));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 7;
	// };

	// //ROL Instructions
	// this.ROL_AC = function() {
	// 	this.opcodeType = 'ROL';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	if ((this.accumulator >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.accumulator = this.accumulator << 1;
	// 	this.accumulator = this.accumulator & 0xFF;
	// 	if (currCarry == 1) {
	// 		this.accumulator = this.accumulator | 0b00000001;
	// 	}
	// 	this.calcFlags(null, false, null);
	// 	this.memLog = 'A';
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.ROL_Z = function() {
	// 	this.opcodeType = 'ROL';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b00000001));
	// 	}
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 5;
	// };
	// this.ROL_Z_X = function() {
	// 	this.opcodeType = 'ROL';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) | 0b00000001));
	// 	}
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.ROL_A = function() {
	// 	this.opcodeType = 'ROL';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b00000001));
	// 	}
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 6;
	// };
	// this.ROL_A_X = function() {
	// 	this.opcodeType = 'ROL';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.X) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) | 0b00000001));
	// 	}
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 7;
	// };

	// //ROR Instructions
	// this.ROR_AC = function() {
	// 	this.opcodeType = 'ROR';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	if ((this.accumulator & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.accumulator = this.accumulator >> 1;
	// 	if (currCarry == 1) {
	// 		this.accumulator = this.accumulator | 0b10000000;
	// 	}
	// 	this.calcFlags(null, false, null);
	// 	this.memLog = 'A';
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.ROR_Z = function() {
	// 	this.opcodeType = 'ROR';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	if (this.loggingEnabled) {
	// 		var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 		this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	}

	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b10000000));
	// 	}
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 5;
	// };
	// this.ROR_Z_X = function() {
	// 	this.opcodeType = 'ROR';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) | 0b10000000));
	// 	}
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.ROR_A = function() {
	// 	this.opcodeType = 'ROR';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b10000000));
	// 	}
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 6;
	// };
	// this.ROR_A_X = function() {
	// 	this.opcodeType = 'ROR';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.X) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) | 0b10000000));
	// 	}
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 7;
	// };

	// //STA Instructions
	// this.STA_Z = function() {
	// 	this.opcodeType = 'STA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.accumulator));
	// 	if (this.loggingEnabled) {
	// 		this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	}
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.STA_Z_X = function() {
	// 	this.opcodeType = 'STA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.accumulator));
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.STA_A = function() {
	// 	this.opcodeType = 'STA';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	// var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.accumulator));
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };
	// this.STA_A_X = function() {
	// 	this.opcodeType = 'STA';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var addr = param + this.X;
	// 	if (addr > 0xFFFF)
	// 		addr = addr - (0xFFFF + 1);
	// 	// this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.accumulator));
	// 	this.nes.MMU.setCpuMemVal(addr, (this.accumulator));
	// 	//instLen = 3;
	// 	this.elapsedCycles += 5;
	// };
	// this.STA_A_Y = function() {
	// 	this.opcodeType = 'STA';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	// this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.Y)), (this.accumulator));
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.accumulator));
	// 	//instLen = 3;
	// 	this.elapsedCycles += 5;
	// };
	// this.STA_I_X = function() {
	// 	this.opcodeType = 'STA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	// var memLogBeforeVar = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	var memLogBeforeVar = this.nes.MMU.setCpuMemVal((index2 | index1), (this.accumulator));
	// 	// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.STA_I_Y = function() {
	// 	this.opcodeType = 'STA';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	// this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', (index2 | index1), this.Y)), (this.accumulator));
	// 	this.nes.MMU.setCpuMemVal(((index2 | index1) + this.Y), (this.accumulator));
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };

	//Stack Instructions
	// this.TXS = function() {
	// 	this.opcodeType = 'TXS';
	// 	this.pc++;
	// 	this.sp = this.X;
	// 	this.elapsedCycles += 2;
	// };
	// this.TSX = function() {
	// 	this.opcodeType = 'TSX';
	// 	this.pc++;
	// 	this.X = this.sp;
	// 	this.calcFlags(this.X, false, null);
	// 	this.elapsedCycles += 2;
	// };
	// this.PHA = function() {
	// 	this.opcodeType = 'PHA';
	// 	this.pc++;
	// 	this.pushToStack(this.accumulator);
	// 	// this.nes.MMU.setCpuMemVal(0x100 + this.sp) = this.accumulator;
	// 	// if (this.sp == 0x00)
	// 	// 	this.sp = 0xFF;
	// 	// else
	// 	// 	this.sp--;
	// 	this.elapsedCycles += 3;
	// };
	// this.PLA = function() {
	// 	this.opcodeType = 'PLA';
	// 	this.pc++;
	// 	this.accumulator = this.popFromStack();
	// 	// this.accumulator = this.nes.MMU.setCpuMemVal(0x100 + this.sp);
	// 	// if (this.sp == 0xFF)
	// 	// 	this.sp = 0x00;
	// 	// else
	// 	// 	this.sp++;
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 4;
	// };
	// this.PHP = function() {
	// 	this.opcodeType = 'PHP';
	// 	this.pc++;
	// 	var temp = this.P;
	// 	temp = temp & 0b11101111;
	// 	temp = temp | 0b00110000;
	// 	this.pushToStack(temp);
	// 	this.elapsedCycles += 3;
	// };
	// this.PLP = function() {
	// 	this.opcodeType = 'PLP';
	// 	this.pc++;
	// 	var temp = this.popFromStack();
	// 	if ((temp & 0b00000001) == 0x01)
	// 		this.setFlag('carry');
	// 	else this.unsetFlag('carry');

	// 	if ((temp & 0b00000010) >> 1 == 0x01)
	// 		this.setFlag('zero');
	// 	else this.unsetFlag('zero');

	// 	if ((temp & 0b00000100) >> 2 == 0x01)
	// 		this.setFlag('irqDisable');
	// 	else this.unsetFlag('irqDisable');

	// 	if ((temp & 0b00001000) >> 3 == 0x01)
	// 		this.setFlag('decimal');
	// 	else this.unsetFlag('decimal');

	// 	if ((temp & 0b01000000) >> 6 == 0x01)
	// 		this.setFlag('overflow');
	// 	else this.unsetFlag('overflow');

	// 	if ((temp & 0b10000000) >> 7 == 0x01)
	// 		this.setFlag('negative');
	// 	else this.unsetFlag('negative');

	// 	this.elapsedCycles += 4;
	// };

	//STX Instructions
	// this.STX_Z = function() {
	// 	this.opcodeType = 'STX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.X));
	// 	//instLen = 2;
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	this.elapsedCycles += 3;
	// };
	// this.STX_Z_Y = function() {
	// 	this.opcodeType = 'STX';
	// 	this.pc++;
	// 	var param = this.fetchParams();

	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.Y)), (this.X));
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.STX_A = function() {
	// 	this.opcodeType = 'STX';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	// var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.X));
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };

	// //STY Instructions
	// this.STY_Z = function() {
	// 	this.opcodeType = 'STY';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.Y));
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.STY_Z_X = function() {
	// 	this.opcodeType = 'STY';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.nes.MMU.setCpuMemVal(this.wrap8bit('sum', param, this.X), (this.Y));
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.STY_A = function() {
	// 	this.opcodeType = 'STY';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	// var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	var memLogBeforeVar = this.nes.MMU.setCpuMemVal(param, (this.Y));
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };


	//Register Instructions
	// this.TAX = function() {
	// 	this.opcodeType = 'TAX';
	// 	this.pc++;
	// 	this.X = this.accumulator;
	// 	this.calcFlags(this.X, false, null);
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.TXA = function() {
	// 	this.opcodeType = 'TXA';
	// 	this.pc++;
	// 	this.accumulator = this.X;
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.DEX = function() {
	// 	this.opcodeType = 'DEX';
	// 	this.pc++;
	// 	this.X = this.wrap8bit('decrement', this.X, null);
	// 	this.calcFlags(this.X, false, null);
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.INX = function() {
	// 	this.opcodeType = 'INX';
	// 	this.pc++;
	// 	this.X = this.wrap8bit('increment', this.X, null);
	// 	this.calcFlags(this.X, false, null);
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.TAY = function() {
	// 	this.opcodeType = 'TAY';
	// 	this.pc++;
	// 	this.Y = this.accumulator;
	// 	this.calcFlags(this.Y, false, null);
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.TYA = function() {
	// 	this.opcodeType = 'TYA';
	// 	this.pc++;
	// 	this.accumulator = this.Y;
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.DEY = function() {
	// 	this.opcodeType = 'DEY';
	// 	this.pc++;
	// 	this.Y = this.wrap8bit('decrement', this.Y, null);
	// 	this.calcFlags(this.Y, false, null);
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.INY = function() {
	// 	this.opcodeType = 'INY';
	// 	this.pc++;
	// 	this.Y = this.wrap8bit('increment', this.Y, null);
	// 	this.calcFlags(this.Y, false, null);
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };

	//INC Instructions
	// this.INC_Z = function() {
	// 	this.opcodeType = 'INC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param), null)));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 5;
	// };
	// this.INC_Z_X = function() {
	// 	this.opcodeType = 'INC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var loc = this.wrap8bit('sum', param, this.X);
	// 	var valueAtLoc = this.nes.MMU.getCpuMemVal(loc);
	// 	//increment
	// 	valueAtLoc = this.wrap8bit('increment', valueAtLoc, null);
	// 	// this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), null)));
	// 	this.nes.MMU.setCpuMemVal(loc, valueAtLoc);
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(loc), false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.INC_A = function() {
	// 	this.opcodeType = 'INC';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param), null)));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 6;
	// };
	// this.INC_A_X = function() {
	// 	this.opcodeType = 'INC';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param + this.X), null)));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 7;
	// };

	// this.DEC_Z = function() {
	// 	this.opcodeType = 'DEC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param), null)));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 5;
	// };
	// this.DEC_Z_X = function() {
	// 	this.opcodeType = 'DEC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), null)));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.DEC_A = function() {
	// 	this.opcodeType = 'DEC';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param), null)));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 6;
	// };
	// this.DEC_A_X = function() {
	// 	this.opcodeType = 'DEC';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param + this.X), null)));
	// 	this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 7;
	// };

	//Flag Instructions
	// this.CLC = function() {
	// 	this.opcodeType = 'CLC';
	// 	this.pc++;
	// 	this.unsetFlag('carry');
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.SEC = function() {
	// 	this.opcodeType = 'SEC';
	// 	this.pc++;
	// 	this.setFlag('carry');
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.CLI = function() {
	// 	this.opcodeType = 'CLI';
	// 	this.pc++;
	// 	this.unsetFlag('irqDisable');
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.SEI = function() {
	// 	this.opcodeType = 'SEI';
	// 	this.pc++;
	// 	this.setFlag('irqDisable');
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.CLV = function() {
	// 	this.opcodeType = 'CLV';
	// 	this.pc++;
	// 	this.unsetFlag('overflow');
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.CLD = function() {
	// 	this.opcodeType = 'CLD';
	// 	this.pc++;
	// 	this.unsetFlag('decimal');
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };
	// this.SED = function() {
	// 	this.opcodeType = 'SED';
	// 	this.pc++;
	// 	this.setFlag('decimal');
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };

	//JMP Instructions
	// this.JMP_A = function() {
	// 	this.opcodeType = 'JMP';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.pc = param;
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + param.toString(16).toUpperCase();
	// 	//instLen = 3;
	// 	this.elapsedCycles += 3;
	// };
	// this.JMP_I = function() {
	// 	this.opcodeType = 'JMP';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var lowerByte, higherByte;
	// 	var jmpLocation;
	// 	//var lowNibble = this.nes.MMU.getCpuMemVal(param);
	// 	if (param1 == 0xFF) {
	// 		lowerByte = param;
	// 		higherByte = param2 | 0x00;
	// 	}
	// 	else {
	// 		lowerByte = param;
	// 		higherByte = param2 | (param1 + 1);
	// 	}
	// 	jmpLocation = (this.nes.MMU.getCpuMemVal(higherByte) << 8) | this.nes.MMU.getCpuMemVal(lowerByte);
	// 	this.pc = jmpLocation;
	// 	//instLen = 3;
	// 	this.elapsedCycles += 5;
	// };

	//JSR Instructions
	// this.JSR_A = function() {
	// 	this.opcodeType = 'JSR';
	// 	this.pc++;
	// 	//get address to jump from params
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	//Transfer next instruction - 1 point to stack
	// 	this.pushToStack((this.pc - 1) >> 8);
	// 	this.pushToStack((this.pc - 1) & 0x00FF);
	// 	this.pc = param;
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + param.toString(16).toUpperCase();
	// 	//instLen = 3;
	// 	this.elapsedCycles += 6;
	// };

	//NOP 
	// this.NOP = function() {
	// 	if (this.currentOpcode == 0xEA)
	// 		this.opcodeType = 'NOP';
	// 	else
	// 		this.opcodeType = '*NOP';
	// 	this.pc++;
	// 	//instLen = 1;
	// 	this.elapsedCycles += 2;
	// };

	//BRK Instructions
	// this.BRK = function() {
	// 	this.opcodeType = 'BRK';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.serveISR('BRK');
	// 	//instLen = 1;
	// 	this.elapsedCycles += 7;
	// 	//TODO ??
	// };

	//RTI Instructions
	// this.RTI = function() {
	// 	this.opcodeType = 'RTI';
	// 	// this.P = this.popFromStack();
	// 	var temp = this.popFromStack();
	// 	if ((temp & 0b00000001) == 0x01)
	// 		this.setFlag('carry');
	// 	else this.unsetFlag('carry');

	// 	if ((temp & 0b00000010) >> 1 == 0x01)
	// 		this.setFlag('zero');
	// 	else this.unsetFlag('zero');

	// 	if ((temp & 0b00000100) >> 2 == 0x01)
	// 		this.setFlag('irqDisable');
	// 	else this.unsetFlag('irqDisable');

	// 	if ((temp & 0b00001000) >> 3 == 0x01)
	// 		this.setFlag('decimal');
	// 	else this.unsetFlag('decimal');

	// 	if ((temp & 0b01000000) >> 6 == 0x01)
	// 		this.setFlag('overflow');
	// 	else this.unsetFlag('overflow');

	// 	if ((temp & 0b10000000) >> 7 == 0x01)
	// 		this.setFlag('negative');
	// 	else this.unsetFlag('negative');

	// 	var lowByte = this.popFromStack();
	// 	var highByte = this.popFromStack();
	// 	this.pc = (highByte << 8) | lowByte;
	// 	//instLen = 1;
	// 	this.elapsedCycles += 6;
	// };
	// this.RTS = function() {
	// 	this.opcodeType = 'RTS';
	// 	var lowByte = this.popFromStack();
	// 	var highByte = this.popFromStack();
	// 	this.pc = ((highByte << 8) | lowByte) + 1;
	// 	//instLen = 1;
	// 	this.elapsedCycles += 6;
	// };

	//Branch Instructions
	// this.BPL = function() {
	// 	this.opcodeType = 'BPL';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var offset = this.calcOffset(param);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
	// 	if ((this.P >> 7) == 0) {
	// 		// this.pc--;
	// 		// var offset = this.calcOffset(param);
	// 		if ((this.pc >> 8) != ((this.pc + offset) >> 8))
	// 			this.elapsedCycles++; //Incrementing as page boundary crossing occured
	// 		this.pc += offset;
	// 		this.elapsedCycles++;
	// 	}
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.BMI = function() {
	// 	this.opcodeType = 'BMI';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var offset = this.calcOffset(param);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
	// 	if ((this.P >> 7) == 1) {
	// 		// this.pc--;
	// 		// var offset = this.calcOffset(param);
	// 		if ((this.pc >> 8) != ((this.pc + offset) >> 8))
	// 			this.elapsedCycles++; //Incrementing as page boundary crossing occured
	// 		this.pc += offset;
	// 		this.elapsedCycles++;
	// 	}
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.BVC = function() {
	// 	this.opcodeType = 'BVC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var offset = this.calcOffset(param);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
	// 	if (((this.P >> 6) & 0x01) == 0) {
	// 		// this.pc--;
	// 		// var offset = this.calcOffset(param);
	// 		if ((this.pc >> 8) != ((this.pc + offset) >> 8))
	// 			this.elapsedCycles++; //Incrementing as page boundary crossing occured
	// 		this.pc += offset;
	// 		this.elapsedCycles++;
	// 	}
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.BVS = function() {
	// 	this.opcodeType = 'BVS';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var offset = this.calcOffset(param);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
	// 	if (((this.P >> 6) & 0x01) == 1) {
	// 		// this.pc--;
	// 		// var offset = this.calcOffset(param);
	// 		if ((this.pc >> 8) != ((this.pc + offset) >> 8))
	// 			this.elapsedCycles++; //Incrementing as page boundary crossing occured
	// 		this.pc += offset;
	// 		this.elapsedCycles++;
	// 	}
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.BCC = function() {
	// 	this.opcodeType = 'BCC';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var offset = this.calcOffset(param);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
	// 	if ((this.P & 0x01) == 0) {
	// 		// this.pc--;
	// 		// var offset = this.calcOffset(param);
	// 		if ((this.pc >> 8) != ((this.pc + offset) >> 8))
	// 			this.elapsedCycles++; //Incrementing as page boundary crossing occured
	// 		this.pc += offset;
	// 		this.elapsedCycles++;
	// 	}
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.BCS = function() {
	// 	this.opcodeType = 'BCS';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var offset = this.calcOffset(param);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
	// 	if ((this.P & 0x01) == 1) {
	// 		// this.pc--;
	// 		if ((this.pc >> 8) != ((this.pc + offset) >> 8))
	// 			this.elapsedCycles++; //Incrementing as page boundary crossing occured
	// 		this.pc += offset;
	// 		this.elapsedCycles++; //Incrementing as branch is taken
	// 	}
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.BNE = function() {
	// 	this.opcodeType = 'BNE';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var offset = this.calcOffset(param);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
	// 	if (((this.P >> 1) & 0x01) == 0) {
	// 		// this.pc--;

	// 		if ((this.pc >> 8) != ((this.pc + offset) >> 8))
	// 			this.elapsedCycles++; //Incrementing as page boundary crossing occured
	// 		this.pc += offset;
	// 		this.elapsedCycles++;
	// 	}
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.BEQ = function() {
	// 	this.opcodeType = 'BEQ';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var offset = this.calcOffset(param);
	// 	if (this.loggingEnabled)
	// 		this.memLog = '$' + (this.pc + offset).toString(16).toUpperCase();
	// 	if (((this.P >> 1) & 0x01) == 1) {
	// 		// this.pc--;
	// 		// var offset = this.calcOffset(param);
	// 		if ((this.pc >> 8) != ((this.pc + offset) >> 8))
	// 			this.elapsedCycles++; //Incrementing as page boundary crossing occured
	// 		this.pc += offset;
	// 		this.elapsedCycles++;
	// 	}
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };

	//CPX Instructions
	// this.CPX_I = function() {
	// 	this.opcodeType = 'CPX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var result = this.compareValsAndSetNegative(this.X, param);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.CPX_Z = function() {
	// 	this.opcodeType = 'CPX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var result = this.compareValsAndSetNegative(this.X, this.nes.MMU.getCpuMemVal(param));
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	//instLen = 2;
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	this.elapsedCycles += 3;
	// };
	// this.CPX_A = function() {
	// 	this.opcodeType = 'CPX';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var result = this.compareValsAndSetNegative(this.X, this.nes.MMU.getCpuMemVal(param));
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };

	//CPY Instructions
	// this.CPY_I = function() {
	// 	this.opcodeType = 'CPY';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var result = this.compareValsAndSetNegative(this.Y, param);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	//instLen = 2;
	// 	// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
	// 	this.elapsedCycles += 2;
	// };
	// this.CPY_Z = function() {
	// 	this.opcodeType = 'CPY';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var result = this.compareValsAndSetNegative(this.Y, this.nes.MMU.getCpuMemVal(param));
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.CPY_A = function() {
	// 	this.opcodeType = 'CPY';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var result = this.compareValsAndSetNegative(this.Y, this.nes.MMU.getCpuMemVal(param));
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };

	//CMP Instructions
	// this.CMP_I = function() {
	// 	this.opcodeType = 'CMP';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var result = this.compareValsAndSetNegative(this.accumulator, param);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 2;
	// };
	// this.CMP_Z = function() {
	// 	this.opcodeType = 'CMP';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(param));
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.CMP_Z_X = function() {
	// 	this.opcodeType = 'CMP';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)));
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.CMP_A = function() {
	// 	this.opcodeType = 'CMP';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(param));
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(param);
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };
	// this.CMP_A_X = function() {
	// 	this.opcodeType = 'CMP';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(param + this.X));
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	//instLen = 2;
	// 	if ((param1 + this.X) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.CMP_A_Y = function() {
	// 	this.opcodeType = 'CMP';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(param + this.Y));
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	//instLen = 2;
	// 	if ((param1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };
	// this.CMP_I_X = function() {
	// 	this.opcodeType = 'CMP';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	// param = index2 | index1;
	// 	var memLogBeforeVar = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	var result = this.compareValsAndSetNegative(this.accumulator, memLogBeforeVar);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	// this.memLog = '($' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ',X) @ ' + ('00' + (this.wrap8bit('sum', param, this.X)).toString(16).toUpperCase()).slice(-2) + ' = ' + ('0000' + (index2 | index1).toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + memLogBeforeVar.toString(16).toUpperCase()).slice(-2);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.CMP_I_Y = function() {
	// 	this.opcodeType = 'CMP';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.getCpuMemVal(param + this.Y));
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	//instLen = 2;
	// 	if ((index1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 6;
	// 	else
	// 		this.elapsedCycles += 5;
	// };

	//BIT Instructions
	// this.BIT_Z = function() {
	// 	this.opcodeType = 'BIT';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var temp = this.nes.MMU.getCpuMemVal(param);
	// 	var result = this.accumulator & temp;
	// 	if (result == 0) {
	// 		this.setFlag('zero');
	// 	}
	// 	else
	// 		this.unsetFlag('zero');

	// 	if ((0b10000000 & temp) == 128) {
	// 		this.setFlag('negative');
	// 	}
	// 	else {
	// 		this.unsetFlag('negative');
	// 	}
	// 	if ((0b01000000 & temp) == 64) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	// this.memLog = '$' + ('00' + param.toString(16).toUpperCase()).slice(-2) + ' = ' + ('00' + temp.toString(16).toUpperCase()).slice(-2);
	// 	this.elapsedCycles += 3;
	// };
	// this.BIT_A = function() {
	// 	this.opcodeType = 'BIT';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	var temp = this.nes.MMU.getCpuMemVal(param);
	// 	var result = this.accumulator & temp;
	// 	if (result == 0) {
	// 		this.setFlag('zero');
	// 	}
	// 	else
	// 		this.unsetFlag('zero');

	// 	if ((0b10000000 & temp) == 128) {
	// 		this.setFlag('negative');
	// 	}
	// 	else {
	// 		this.unsetFlag('negative');
	// 	}
	// 	if ((0b01000000 & temp) == 64) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else {
	// 		this.unsetFlag('overflow');
	// 	}
	// 	// this.memLog = '$' + ('0000' + param.toString(16).toUpperCase()).slice(-4) + ' = ' + ('00' + temp.toString(16).toUpperCase()).slice(-2);
	// 	this.elapsedCycles += 4;
	// };

	//Unofficial OPcodes
	// this.DOP_Z = function() {
	// 	this.opcodeType = '*NOP';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.elapsedCycles += 3;
	// };
	// this.DOP_Z_X = function() {
	// 	this.opcodeType = '*NOP';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.elapsedCycles += 4;
	// };
	// this.DOP_I = function() {
	// 	this.opcodeType = '*NOP';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// this.memLog = '#$' + ('00' + param.toString(16).toUpperCase()).slice(-2);
	// 	this.elapsedCycles += 2;
	// };

	// this.TOP_A = function() {
	// 	this.opcodeType = '*NOP';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	this.elapsedCycles = 4;

	// };
	// this.TOP_A_X = function() {
	// 	this.opcodeType = '*NOP';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	if ((param1 + this.X) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;
	// };

	// this.LAX_Z = function() {
	// 	this.opcodeType = '*LAX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(param);
	// 	this.X = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.LAX_Z_Y = function() {
	// 	this.opcodeType = '*LAX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
	// 	this.X = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.LAX_A = function() {
	// 	this.opcodeType = '*LAX';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(param);
	// 	this.X = this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };
	// this.LAX_A_Y = function() {
	// 	this.opcodeType = '*LAX';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	// this.X = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.Y));
	// 	this.X = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	if ((param1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 5;
	// 	else
	// 		this.elapsedCycles += 4;

	// };
	// this.LAX_I_X = function() {
	// 	this.opcodeType = '*LAX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	this.accumulator = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	this.X = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.LAX_I_Y = function() {
	// 	this.opcodeType = '*LAX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	this.accumulator = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
	// 	this.X = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
	// 	// this.accumulator = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', (index2 | index1), this.Y));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	if ((index1 + this.Y) > 0xFF)
	// 		this.elapsedCycles += 6;
	// 	else
	// 		this.elapsedCycles += 5;
	// };

	// this.SAX_Z = function() {
	// 	this.opcodeType = '*SAX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.nes.MMU.setCpuMemVal(param, (this.accumulator & this.X));
	// 	// this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 3;
	// };
	// this.SAX_Z_Y = function() {
	// 	this.opcodeType = '*SAX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.nes.MMU.setCpuMemVal(this.wrap8bit('sum', param, this.Y), (this.accumulator & this.X));
	// 	// this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 4;
	// };
	// this.SAX_I_X = function() {
	// 	this.opcodeType = '*SAX';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	this.nes.MMU.setCpuMemVal((index2 | index1), (this.accumulator & this.X));
	// 	// this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.SAX_A = function() {
	// 	this.opcodeType = '*SAX';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.nes.MMU.setCpuMemVal(param, (this.accumulator & this.X));
	// 	// this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 4;
	// };

	// this.DCP_Z = function() {
	// 	this.opcodeType = '*DCP';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param), null)));
	// 	var temp = this.nes.MMU.getCpuMemVal(param);
	// 	var result = this.compareValsAndSetNegative(this.accumulator, temp);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	// if (temp == 0)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');
	// 	// if (temp == 0x00)
	// 	// 	this.setFlag('zero');
	// 	// else
	// 	// 	this.unsetFlag('zero');
	// 	// if ((temp >> 7) == 1)
	// 	// 	this.setFlag('negative');
	// 	// else
	// 	// 	this.unsetFlag('negative');
	// 	// temp = this.wrap8bit('decrement', temp, null);
	// 	// this.nes.MMU.setCpuMemVal(param, temp);
	// 	this.elapsedCycles += 5;
	// };
	// this.DCP_Z_X = function() {
	// 	this.opcodeType = '*DCP';
	// 	this.pc++;
	// 	var param = this.fetchParams(param);
	// 	this.nes.MMU.setCpuMemVal(this.wrap8bit('sum', param, this.X), (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), null)));
	// 	var temp = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var result = this.compareValsAndSetNegative(this.accumulator, temp);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	// var temp = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	// if (temp == 0)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');
	// 	// if (temp == 0x00)
	// 	// 	this.setFlag('zero');
	// 	// else
	// 	// 	this.unsetFlag('zero');
	// 	// if ((temp >> 7) == 1)
	// 	// 	this.setFlag('negative');
	// 	// else
	// 	// 	this.unsetFlag('negative');
	// 	// temp = this.wrap8bit('decrement', temp, null);
	// 	// this.nes.MMU.setCpuMemVal(this.wrap8bit('sum', param, this.X), temp);
	// 	this.elapsedCycles += 6;
	// };
	// this.DCP_A = function() {
	// 	this.opcodeType = '*DCP';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param), null)));
	// 	var temp = this.nes.MMU.getCpuMemVal(param);
	// 	var result = this.compareValsAndSetNegative(this.accumulator, temp);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	// if (temp == 0)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');
	// 	// if (temp == 0x00)
	// 	// 	this.setFlag('zero');
	// 	// else
	// 	// 	this.unsetFlag('zero');
	// 	// if ((temp >> 7) == 1)
	// 	// 	this.setFlag('negative');
	// 	// else
	// 	// 	this.unsetFlag('negative');
	// 	// temp = this.wrap8bit('decrement', temp, null);
	// 	// this.nes.MMU.setCpuMemVal(param, temp);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 6;
	// };
	// this.DCP_A_X = function() {
	// 	this.opcodeType = '*DCP';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	// var temp = this.nes.MMU.getCpuMemVal(param + this.X);
	// 	this.nes.MMU.setCpuMemVal(param + this.X, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param + this.X), null)));
	// 	var temp = this.nes.MMU.getCpuMemVal(param + this.X);
	// 	var result = this.compareValsAndSetNegative(this.accumulator, temp);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	// if (temp == 0)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');
	// 	// if (temp == 0x00)
	// 	// 	this.setFlag('zero');
	// 	// else
	// 	// 	this.unsetFlag('zero');
	// 	// if ((temp >> 7) == 1)
	// 	// 	this.setFlag('negative');
	// 	// else
	// 	// 	this.unsetFlag('negative');
	// 	// temp = this.wrap8bit('decrement', temp, null);
	// 	// this.nes.MMU.setCpuMemVal(param + this.X, temp);
	// 	this.elapsedCycles += 7;
	// };
	// this.DCP_A_Y = function() {
	// 	this.opcodeType = '*DCP';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	// var temp = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.nes.MMU.setCpuMemVal(param + this.Y, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param + this.Y), null)));
	// 	var temp = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	var result = this.compareValsAndSetNegative(this.accumulator, temp);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	// if (temp == 0)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');
	// 	// if (temp == 0x00)
	// 	// 	this.setFlag('zero');
	// 	// else
	// 	// 	this.unsetFlag('zero');
	// 	// if ((temp >> 7) == 1)
	// 	// 	this.setFlag('negative');
	// 	// else
	// 	// 	this.unsetFlag('negative');
	// 	// temp = this.wrap8bit('decrement', temp, null);
	// 	// this.nes.MMU.setCpuMemVal(param + this.Y, temp);
	// 	this.elapsedCycles += 7;
	// };
	// this.DCP_I_X = function() {
	// 	this.opcodeType = '*DCP';
	// 	this.pc++;
	// 	// var param = this.fetchParams();
	// 	// var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	// var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	// index2 = index2 << 8;
	// 	// var temp = this.nes.MMU.getCpuMemVal(index2 | index1);
	// 	// if (temp == 0)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');
	// 	// if (temp == 0x00)
	// 	// 	this.setFlag('zero');
	// 	// else
	// 	// 	this.unsetFlag('zero');
	// 	// if ((temp >> 7) == 1)
	// 	// 	this.setFlag('negative');
	// 	// else
	// 	// 	this.unsetFlag('negative');
	// 	// temp = this.wrap8bit('decrement', temp, null);
	// 	// this.nes.MMU.setCpuMemVal(index2 | index1, temp);
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param), null)));
	// 	// this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	var temp = this.nes.MMU.getCpuMemVal(param);
	// 	var result = this.compareValsAndSetNegative(this.accumulator, temp);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	this.elapsedCycles += 8;
	// };
	// this.DCP_I_Y = function() {
	// 	this.opcodeType = '*DCP';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	// var temp = this.nes.MMU.getCpuMemVal((index2 | index1) + this.Y);
	// 	this.nes.MMU.setCpuMemVal(param + this.Y, (this.wrap8bit('decrement', this.nes.MMU.getCpuMemVal(param + this.Y), null)));
	// 	var temp = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	var result = this.compareValsAndSetNegative(this.accumulator, temp);
	// 	if (result > 0) {
	// 		this.setFlag('carry');
	// 		// this.unsetFlag('negative');
	// 		this.unsetFlag('zero');
	// 	}
	// 	if (result == 0) {
	// 		this.setFlag('carry');
	// 		this.setFlag('zero');
	// 		// this.unsetFlag('negative');
	// 	}
	// 	if (result < 0) {
	// 		// this.setFlag('negative');
	// 		this.unsetFlag('carry');
	// 		this.unsetFlag('zero');
	// 	}
	// 	// if (temp == 0)
	// 	// 	this.setFlag('carry');
	// 	// else this.unsetFlag('carry');
	// 	// if (temp == 0x00)
	// 	// 	this.setFlag('zero');
	// 	// else
	// 	// 	this.unsetFlag('zero');
	// 	// if ((temp >> 7) == 1)
	// 	// 	this.setFlag('negative');
	// 	// else
	// 	// 	this.unsetFlag('negative');
	// 	// temp = this.wrap8bit('decrement', temp, null);
	// 	// this.nes.MMU.setCpuMemVal((index2 | index1) + this.Y, temp);
	// 	this.elapsedCycles += 8;
	// };

	// this.ISB_Z = function() {
	// 	this.opcodeType = '*ISB';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param), null)));
	// 	// this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	var arg = this.nes.MMU.getCpuMemVal(param);
	// 	// arg = ~arg;
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(null, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	if ((this.P & 0x01) == 0x00)
	// 		temp = temp - 1;
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');

	// 	if (this.accumulator >= arg)
	// 		this.setFlag('carry');
	// 	else this.unsetFlag('carry');

	// 	this.accumulator = this.toSigned8bit(temp);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 5;
	// };
	// this.ISB_Z_X = function() {
	// 	this.opcodeType = '*ISB';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)), null)));
	// 	// this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
	// 	var arg = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(null, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	if ((this.P & 0x01) == 0x00)
	// 		temp = temp - 1;
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');

	// 	if (this.accumulator >= arg)
	// 		this.setFlag('carry');
	// 	else this.unsetFlag('carry');

	// 	this.accumulator = this.toSigned8bit(temp);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 6;
	// };
	// this.ISB_A = function() {
	// 	this.opcodeType = '*ISB';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.nes.MMU.setCpuMemVal(param, (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param), null)));
	// 	// this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	var arg = this.nes.MMU.getCpuMemVal(param);
	// 	// arg = ~arg;
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(null, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	if ((this.P & 0x01) == 0x00)
	// 		temp = temp - 1;
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');

	// 	if (this.accumulator >= arg)
	// 		this.setFlag('carry');
	// 	else this.unsetFlag('carry');

	// 	this.accumulator = this.toSigned8bit(temp);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 6;
	// };
	// this.ISB_A_X = function() {
	// 	this.opcodeType = '*ISB';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param + this.X), null)));
	// 	// this.calcFlags(this.nes.MMU.getCpuMemVal(param + this.X), false, null);
	// 	var arg = this.nes.MMU.getCpuMemVal(param + this.X);
	// 	// arg = ~arg;
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(null, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	if ((this.P & 0x01) == 0x00)
	// 		temp = temp - 1;
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');

	// 	if (this.accumulator >= arg)
	// 		this.setFlag('carry');
	// 	else this.unsetFlag('carry');

	// 	this.accumulator = this.toSigned8bit(temp);
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 3;
	// 	this.elapsedCycles += 7;
	// };
	// this.ISB_A_Y = function() {
	// 	this.opcodeType = '*ISB';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param + this.Y), null)));
	// 	var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	// arg = ~arg;
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(null, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	if ((this.P & 0x01) == 0x00)
	// 		temp = temp - 1;
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');

	// 	if (this.accumulator >= arg)
	// 		this.setFlag('carry');
	// 	else this.unsetFlag('carry');

	// 	this.accumulator = this.toSigned8bit(temp);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 7;
	// };
	// this.ISB_I_X = function() {
	// 	this.opcodeType = '*ISB';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	this.nes.MMU.setCpuMemVal((param), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param), null)));
	// 	var arg = this.nes.MMU.getCpuMemVal(param);
	// 	// arg = ~arg;
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(null, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	if ((this.P & 0x01) == 0x00)
	// 		temp = temp - 1;
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');

	// 	if (this.accumulator >= arg)
	// 		this.setFlag('carry');
	// 	else this.unsetFlag('carry');

	// 	this.accumulator = this.toSigned8bit(temp);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 8;
	// };
	// this.ISB_I_Y = function() {
	// 	this.opcodeType = '*ISB';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.Y;
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.wrap8bit('increment', this.nes.MMU.getCpuMemVal(param + this.Y), null)));
	// 	var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	// arg = ~arg;
	// 	// var temp = this.accumulator + arg + (this.P & 0x01);
	// 	// temp = this.writeCarry(temp);
	// 	// this.calcFlags(arg, true, temp);
	// 	// this.accumulator = temp;
	// 	// this.calcFlags(null, false, null);
	// 	var temp = this.to2sComplement(this.accumulator) - this.to2sComplement(arg);
	// 	if ((this.P & 0x01) == 0x00)
	// 		temp = temp - 1;
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');

	// 	if (this.accumulator >= arg)
	// 		this.setFlag('carry');
	// 	else this.unsetFlag('carry');

	// 	this.accumulator = this.toSigned8bit(temp);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 8;
	// };

	// this.SLO_Z = function() {
	// 	this.opcodeType = '*SLO';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal(param, this.nes.MMU.getCpuMemVal(param) << 1);
	// 	// this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 5;
	// };
	// this.SLO_Z_X = function() {
	// 	this.opcodeType = '*SLO';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) << 1));
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 6;
	// };
	// this.SLO_A = function() {
	// 	this.opcodeType = '*SLO';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 6;
	// };
	// this.SLO_A_X = function() {
	// 	this.opcodeType = '*SLO';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.X) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) << 1));
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param + this.X);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 7;
	// };
	// this.SLO_A_Y = function() {
	// 	this.opcodeType = '*SLO';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.Y) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) << 1));
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 7;
	// };
	// this.SLO_I_X = function() {
	// 	this.opcodeType = '*SLO';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) << 1));
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 8;
	// };
	// this.SLO_I_Y = function() {
	// 	this.opcodeType = '*SLO';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	// param += this.Y;
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.Y) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) << 1));
	// 	this.accumulator = this.accumulator | this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 8;
	// };

	// this.RLA_Z = function() {
	// 	this.opcodeType = '*RLA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b00000001));
	// 	}
	// 	// this.calcFlags(this.nes.MMU.getCpuMemVal(param), false, null);
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 5;
	// };
	// this.RLA_Z_X = function() {
	// 	this.opcodeType = '*RLA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) | 0b00000001));
	// 	}
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 6;
	// };
	// this.RLA_A = function() {
	// 	this.opcodeType = '*RLA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b00000001));
	// 	}
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 6;
	// };
	// this.RLA_A_X = function() {
	// 	this.opcodeType = '*RLA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.X) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) | 0b00000001));
	// 	}
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param + this.X);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 7;
	// };
	// this.RLA_A_Y = function() {
	// 	this.opcodeType = '*RLA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.Y) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) | 0b00000001));
	// 	}
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 7;
	// };
	// this.RLA_I_X = function() {
	// 	this.opcodeType = '*RLA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	if ((this.nes.MMU.getCpuMemVal(param) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) | 0b00000001));
	// 	}
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 8;
	// };
	// this.RLA_I_Y = function() {
	// 	this.opcodeType = '*RLA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.Y) >> 7) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) << 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) | 0b00000001));
	// 	}
	// 	this.accumulator = this.accumulator & this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 8;
	// };

	// this.SRE_Z = function() {
	// 	this.opcodeType = '*SRE';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 5;
	// };
	// this.SRE_Z_X = function() {
	// 	this.opcodeType = '*SRE';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 1));
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 6;
	// };
	// this.SRE_A = function() {
	// 	this.opcodeType = '*SRE';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 6;
	// };
	// this.SRE_A_X = function() {
	// 	this.opcodeType = '*SRE';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.X) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) >> 1));
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param + this.X);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 7;
	// };
	// this.SRE_A_Y = function() {
	// 	this.opcodeType = '*SRE';
	// 	this.pc++;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.Y) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) >> 1));
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 7;
	// };
	// this.SRE_I_X = function() {
	// 	this.opcodeType = '*SRE';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) >> 1));
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 8;
	// };
	// this.SRE_I_Y = function() {
	// 	this.opcodeType = '*SRE';
	// 	this.pc++;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.Y) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) >> 1));
	// 	this.accumulator = this.accumulator ^ this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 8;
	// };

	// this.RRA_Z = function() {
	// 	this.opcodeType = '*RRA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b10000000));
	// 	}
	// 	var arg = this.nes.MMU.getCpuMemVal(param);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 5;
	// };
	// this.RRA_Z_X = function() {
	// 	this.opcodeType = '*RRA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	if ((this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((this.wrap8bit('sum', param, this.X)), (this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X)) | 0b10000000));
	// 	}
	// 	var arg = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 6;
	// };
	// this.RRA_A = function() {
	// 	this.opcodeType = '*RRA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal(param, (this.nes.MMU.getCpuMemVal(param) | 0b10000000));
	// 	}
	// 	var arg = this.nes.MMU.getCpuMemVal(param);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 6;
	// };
	// this.RRA_A_X = function() {
	// 	this.opcodeType = '*RRA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.X) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((param + this.X), (this.nes.MMU.getCpuMemVal(param + this.X) | 0b10000000));
	// 	}
	// 	var arg = this.nes.MMU.getCpuMemVal(param + this.X);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 7;
	// };
	// this.RRA_A_Y = function() {
	// 	this.opcodeType = '*RRA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param1 = this.fetchParams();
	// 	var param2 = this.fetchParams();
	// 	param2 = param2 << 8;
	// 	var param = param2 | param1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.Y) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) | 0b10000000));
	// 	}
	// 	var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 7;
	// };
	// this.RRA_I_X = function() {
	// 	this.opcodeType = '*RRA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	// param += this.X;
	// 	var index1 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, this.X));
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param + this.X, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	if ((this.nes.MMU.getCpuMemVal(param) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((param), (this.nes.MMU.getCpuMemVal(param) | 0b10000000));
	// 	}
	// 	var arg = this.nes.MMU.getCpuMemVal(param);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	//instLen = 2;
	// 	this.elapsedCycles += 8;
	// };
	// this.RRA_I_Y = function() {
	// 	this.opcodeType = '*RRA';
	// 	this.pc++;
	// 	var currCarry = this.P & 0x01;
	// 	var param = this.fetchParams();
	// 	var index1 = this.nes.MMU.getCpuMemVal(param);
	// 	var index2 = this.nes.MMU.getCpuMemVal(this.wrap8bit('sum', param, 1));
	// 	index2 = index2 << 8;
	// 	param = index2 | index1;
	// 	if ((this.nes.MMU.getCpuMemVal(param + this.Y) & 0x01) == 1)
	// 		this.setFlag('carry');
	// 	else
	// 		this.unsetFlag('carry');
	// 	this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) >> 1));
	// 	if (currCarry == 1) {
	// 		this.nes.MMU.setCpuMemVal((param + this.Y), (this.nes.MMU.getCpuMemVal(param + this.Y) | 0b10000000));
	// 	}
	// 	var arg = this.nes.MMU.getCpuMemVal(param + this.Y);
	// 	var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
	// 	if (temp < -128 || temp > 127) {
	// 		this.setFlag('overflow');
	// 	}
	// 	else this.unsetFlag('overflow');
	// 	this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
	// 	this.calcFlags(null, false, null);
	// 	this.elapsedCycles += 8;
	// };

	//Decode fetched instructions 
	this.decodeInstruction = function() {
		// this.prepareLogging();
		switch (this.currentOpcode) {
			//ADC Instructions
			case 0x69:
				this.ADC_I();
				break;
			case 0x65:
				this.ADC_Z();
				break;
			case 0x75:
				this.ADC_Z_X();
				break;
			case 0x6D:
				this.ADC_A();
				break;
			case 0x7D:
				this.ADC_A_X();
				break;
			case 0x79:
				this.ADC_A_Y();
				break;
			case 0x61:
				this.ADC_I_X();
				break;
			case 0x71:
				this.ADC_I_Y();
				break;

				//AND Instructions
			case 0x29:
				this.AND_I();
				break;
			case 0x25:
				this.AND_Z();
				break;
			case 0x35:
				this.AND_Z_X();
				break;
			case 0x2D:
				this.AND_A();
				break;
			case 0x3D:
				this.AND_A_X();
				break;
			case 0x39:
				this.AND_A_Y();
				break;
			case 0x21:
				this.AND_I_X();
				break;
			case 0x31:
				this.AND_I_Y();
				break;

				//ASL Instructions
			case 0x0A:
				this.ASL_AC();
				break;
			case 0x06:
				this.ASL_Z();
				break;
			case 0x16:
				this.ASL_Z_X();
				break;
			case 0x0E:
				this.ASL_A();
				break;
			case 0x1E:
				this.ASL_A_X();
				break;

				//BIT Instructions
			case 0x24:
				this.BIT_Z();
				break;
			case 0x2C:
				this.BIT_A();
				break;

				//Branch Instructions
			case 0x10:
				this.BPL();
				break;
			case 0x30:
				this.BMI();
				break;
			case 0x50:
				this.BVC();
				break;
			case 0x70:
				this.BVS();
				break;
			case 0x90:
				this.BCC();
				break;
			case 0xB0:
				this.BCS();
				break;
			case 0xD0:
				this.BNE();
				break;
			case 0xF0:
				this.BEQ();
				break;

				//BRK Instructions
			case 0x00:
				this.BRK();
				break;

				//CMP Instructions
			case 0xC9:
				this.CMP_I();
				break;
			case 0xC5:
				this.CMP_Z();
				break;
			case 0xD5:
				this.CMP_Z_X();
				break;
			case 0xCD:
				this.CMP_A();
				break;
			case 0xDD:
				this.CMP_A_X();
				break;
			case 0xD9:
				this.CMP_A_Y();
				break;
			case 0xC1:
				this.CMP_I_X();
				break;
			case 0xD1:
				this.CMP_I_Y();
				break;

				//CPX Instructions
			case 0xE0:
				this.CPX_I();
				break;
			case 0xE4:
				this.CPX_Z();
				break;
			case 0xEC:
				this.CPX_A();
				break;

				//CPY Instructions
			case 0xC0:
				this.CPY_I();
				break;
			case 0xC4:
				this.CPY_Z();
				break;
			case 0xCC:
				this.CPY_A();
				break;

				//DEC Instructions
			case 0xC6:
				this.DEC_Z();
				break;
			case 0xD6:
				this.DEC_Z_X();
				break;
			case 0xCE:
				this.DEC_A();
				break;
			case 0xDE:
				this.DEC_A_X();
				break;

				//EOR Instructions
			case 0x49:
				this.EOR_I();
				break;
			case 0x45:
				this.EOR_Z();
				break;
			case 0x55:
				this.EOR_Z_X();
				break;
			case 0x4D:
				this.EOR_A();
				break;
			case 0x5D:
				this.EOR_A_X();
				break;
			case 0x59:
				this.EOR_A_Y();
				break;
			case 0x41:
				this.EOR_I_X();
				break;
			case 0x51:
				this.EOR_I_Y();
				break;

				//Flag Instructions
			case 0x18:
				this.CLC();
				break;
			case 0x38:
				this.SEC();
				break;
			case 0x58:
				this.CLI();
				break;
			case 0x78:
				this.SEI();
				break;
			case 0xB8:
				this.CLV();
				break;
			case 0xD8:
				this.CLD();
				break;
			case 0xF8:
				this.SED();
				break;

				//INC Instructions
			case 0xE6:
				this.INC_Z();
				break;
			case 0xF6:
				this.INC_Z_X();
				break;
			case 0xEE:
				this.INC_A();
				break;
			case 0xFE:
				this.INC_A_X();
				break;

				//JMP Instructions
			case 0x4C:
				this.JMP_A();
				break;
			case 0x6C:
				this.JMP_I();
				break;

				//JSR Instructions
			case 0x20:
				this.JSR_A();
				break;

				//LDA Instuctions
			case 0xA9:
				this.LDA_I();
				break;
			case 0xA5:
				this.LDA_Z();
				break;
			case 0xB5:
				this.LDA_Z_X();
				break;
			case 0xAD:
				this.LDA_A();
				break;
			case 0xBD:
				this.LDA_A_X();
				break;
			case 0xB9:
				this.LDA_A_Y();
				break;
			case 0xA1:
				this.LDA_I_X();
				break;
			case 0xB1:
				this.LDA_I_Y();
				break;


				//LDX Instructions
			case 0xA2:
				this.LDX_I();
				break;
			case 0xA6:
				this.LDX_Z();
				break;
			case 0xB6:
				this.LDX_Z_Y();
				break;
			case 0xAE:
				this.LDX_A();
				break;
			case 0xBE:
				this.LDX_A_Y();
				break;

				//LDY Instructions
			case 0xA0:
				this.LDY_I();
				break;
			case 0xA4:
				this.LDY_Z();
				break;
			case 0xB4:
				this.LDY_Z_X();
				break;
			case 0xAC:
				this.LDY_A();
				break;
			case 0xBC:
				this.LDY_A_X();
				break;

				//LSR Instructions
			case 0x4A:
				this.LSR_AC();
				break;
			case 0x46:
				this.LSR_Z();
				break;
			case 0x56:
				this.LSR_Z_X();
				break;
			case 0x4E:
				this.LSR_A();
				break;
			case 0x5E:
				this.LSR_A_X();
				break;

				//NOP
			case 0xEA:
				this.NOP();
				break;

				//ORA Instructions
			case 0x09:
				this.ORA_I();
				break;
			case 0x05:
				this.ORA_Z();
				break;
			case 0x15:
				this.ORA_Z_X();
				break;
			case 0x0D:
				this.ORA_A();
				break;
			case 0x1D:
				this.ORA_A_X();
				break;
			case 0x19:
				this.ORA_A_Y();
				break;
			case 0x01:
				this.ORA_I_X();
				break;
			case 0x11:
				this.ORA_I_Y();
				break;

				//Register Instructions
			case 0xAA:
				this.TAX();
				break;
			case 0x8A:
				this.TXA();
				break;
			case 0xCA:
				this.DEX();
				break;
			case 0xE8:
				this.INX();
				break;
			case 0xA8:
				this.TAY();
				break;
			case 0x98:
				this.TYA();
				break;
			case 0x88:
				this.DEY();
				break;
			case 0xC8:
				this.INY();
				break;

				//ROL Instructions
			case 0x2A:
				this.ROL_AC();
				break;
			case 0x26:
				this.ROL_Z();
				break;
			case 0x36:
				this.ROL_Z_X();
				break;
			case 0x2E:
				this.ROL_A();
				break;
			case 0x3E:
				this.ROL_A_X();
				break;


				//ROR Instructions
			case 0x6A:
				this.ROR_AC();
				break;
			case 0x66:
				this.ROR_Z();
				break;
			case 0x76:
				this.ROR_Z_X();
				break;
			case 0x6E:
				this.ROR_A();
				break;
			case 0x7E:
				this.ROR_A_X();
				break;

				//RTI Instructions
			case 0x40:
				this.RTI();
				break;

				//RTS Instructions
			case 0x60:
				this.RTS();
				break;

				//SBC Instructions
			case 0xE9:
				this.SBC_I();
				break;
			case 0xE5:
				this.SBC_Z();
				break;
			case 0xF5:
				this.SBC_Z_X();
				break;
			case 0xED:
				this.SBC_A();
				break;
			case 0xFD:
				this.SBC_A_X();
				break;
			case 0xF9:
				this.SBC_A_Y();
				break;
			case 0xE1:
				this.SBC_I_X();
				break;
			case 0xF1:
				this.SBC_I_Y();
				break;


				//STA Instructions
			case 0x85:
				this.STA_Z();
				break;
			case 0x95:
				this.STA_Z_X();
				break;
			case 0x8D:
				this.STA_A();
				break;
			case 0x9D:
				this.STA_A_X();
				break;
			case 0x99:
				this.STA_A_Y();
				break;
			case 0x81:
				this.STA_I_X();
				break;
			case 0x91:
				this.STA_I_Y();
				break;

				//Stack Instructions
			case 0x9A:
				this.TXS();
				break;
			case 0xBA:
				this.TSX();
				break;
			case 0x48:
				this.PHA();
				break;
			case 0x68:
				this.PLA();
				break;
			case 0x08:
				this.PHP();
				break;
			case 0x28:
				this.PLP();
				break;

				//STX Instructions
			case 0x86:
				this.STX_Z();
				break;
			case 0x96:
				this.STX_Z_Y();
				break;
			case 0x8E:
				this.STX_A();
				break;


				//STY Instructions
			case 0x84:
				this.STY_Z();
				break;
			case 0x94:
				this.STY_Z_X();
				break;
			case 0x8C:
				this.STY_A();
				break;

				//Unofficial opcodes
				//http://www.oxyron.de/html/opcodes02.html
			case 0x04:
				this.DOP_Z();
				break;
			case 0x14:
				this.DOP_Z_X();
				break;
			case 0x34:
				this.DOP_Z_X();
				break;
			case 0x44:
				this.DOP_Z();
				break;
			case 0x54:
				this.DOP_Z_X();
				break;
			case 0x64:
				this.DOP_Z();
				break;
			case 0x74:
				this.DOP_Z_X();
				break;
			case 0x80:
				this.DOP_I();
				break;
			case 0x82:
				this.DOP_I();
				break;
			case 0x89:
				this.DOP_I();
				break;
			case 0xC2:
				this.DOP_I();
				break;
			case 0xD4:
				this.DOP_Z_X();
				break;
			case 0xE2:
				this.DOP_I();
				break;
			case 0xF4:
				this.DOP_Z_X();
				break;
			case 0x0C:
				this.TOP_A();
				break;
			case 0x1C:
				this.TOP_A_X();
				break;
			case 0x3C:
				this.TOP_A_X();
				break;
			case 0x5C:
				this.TOP_A_X();
				break;
			case 0x7C:
				this.TOP_A_X();
				break;
			case 0xDC:
				this.TOP_A_X();
				break;
			case 0xFC:
				this.TOP_A_X();
				break;
			case 0x1A:
				this.NOP();
				break;
			case 0x3A:
				this.NOP();
				break;
			case 0x5A:
				this.NOP();
				break;
			case 0x7A:
				this.NOP();
				break;
			case 0xDA:
				this.NOP();
				break;
			case 0xFA:
				this.NOP();
				break;
			case 0x0A7:
				this.LAX_Z();
				break;
			case 0xB7:
				this.LAX_Z_Y();
				break;
			case 0xAF:
				this.LAX_A();
				break;
			case 0xBF:
				this.LAX_A_Y();
				break;
			case 0xA3:
				this.LAX_I_X();
				break;
			case 0xB3:
				this.LAX_I_Y();
				break;
			case 0x87:
				this.SAX_Z();
				break;
			case 0x97:
				this.SAX_Z_Y();
				break;
			case 0x83:
				this.SAX_I_X();
				break;
			case 0x8F:
				this.SAX_A();
				break;
			case 0xEB:
				this.SBC_I();
				break;
			case 0xC7:
				this.DCP_Z();
				break;
			case 0xD7:
				this.DCP_Z_X();
				break;
			case 0xCF:
				this.DCP_A();
				break;
			case 0xDF:
				this.DCP_A_X();
				break;
			case 0xDB:
				this.DCP_A_Y();
				break;
			case 0xC3:
				this.DCP_I_X();
				break;
			case 0xD3:
				this.DCP_I_Y();
				break;
			case 0xE7:
				this.ISB_Z();
				break;
			case 0xF7:
				this.ISB_Z_X();
				break;
			case 0xEF:
				this.ISB_A();
				break;
			case 0xFF:
				this.ISB_A_X();
				break;
			case 0xFB:
				this.ISB_A_Y();
				break;
			case 0xE3:
				this.ISB_I_X();
				break;
			case 0xF3:
				this.ISB_I_Y();
				break;
			case 0x07:
				this.SLO_Z();
				break;
			case 0x17:
				this.SLO_Z_X();
				break;
			case 0x0F:
				this.SLO_A();
				break;
			case 0x1F:
				this.SLO_A_X();
				break;
			case 0x1B:
				this.SLO_A_Y();
				break;
			case 0x03:
				this.SLO_I_X();
				break;
			case 0x13:
				this.SLO_I_Y();
				break;
			case 0x27:
				this.RLA_Z();
				break;
			case 0x37:
				this.RLA_Z_X();
				break;
			case 0x2F:
				this.RLA_A();
				break;
			case 0x3F:
				this.RLA_A_X();
				break;
			case 0x3B:
				this.RLA_A_Y();
				break;
			case 0x23:
				this.RLA_I_X();
				break;
			case 0x33:
				this.RLA_I_Y();
				break;
			case 0x47:
				this.SRE_Z();
				break;
			case 0x57:
				this.SRE_Z_X();
				break;
			case 0x4F:
				this.SRE_A();
				break;
			case 0x5F:
				this.SRE_A_X();
				break;
			case 0x5B:
				this.SRE_A_Y();
				break;
			case 0x43:
				this.SRE_I_X();
				break;
			case 0x53:
				this.SRE_I_Y();
				break;
			case 0x67:
				this.RRA_Z();
				break;
			case 0x77:
				this.RRA_Z_X();
				break;
			case 0x6F:
				this.RRA_A();
				break;
			case 0x7F:
				this.RRA_A_X();
				break;
			case 0x7B:
				this.RRA_A_Y();
				break;
			case 0x63:
				this.RRA_I_X();
				break;
			case 0x73:
				this.RRA_I_Y();
				break;

				// default:
				// 	// console.log("Unknown opcode: " + this.currentOpcode.toString('16'));
				// 	// this.errorFlag = true;
				// 	this.pc++;
				// 	break;
		}
		// return this.opcodeLog;
	};
	var vector1 = 0,
		vector2 = 0;
	this.serveISR = function(interrupt) {
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
				break;
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
				break;
			case 'IRQ':
				vector1 = this.nes.MMU.getCpuMemVal(0xFFFE);
				vector2 = this.nes.MMU.getCpuMemVal(0xFFFE + 1);
				vector2 = vector2 << 8;
				//push pc to stack
				this.pushToStack((this.pc & 0xFF00) >> 8); //push high byte
				this.pushToStack(this.pc & 0x00FF); //push low byte
				//set bit 5 & 4 to 10
				var tempFlag = this.P & 0b11001111;
				tempFlag = tempFlag | 0b00100000;
				//push processor status to stack
				this.pushToStack(tempFlag);
				// //Set the Break flag 
				//Set the I flag
				this.P = this.P & 0b11111011;
				this.P = this.P | 0b00000100;
				this.pc = vector2 | vector1;
				break;
			default:
		}
	};

	this.doNMI = false;
	this.suppressNMI = false;

	this.clockCPU = function() {
		if (this.cpuClockRemaining <= 0) {
			this.currentOpcode = this.nes.MMU.getCpuMemVal(this.pc);
			this.elapsedCycles = 0;
			this.decodeInstruction();
			this.cpuClockRemaining = this.elapsedCycles;
		}
		this.cpuClockRemaining--;
		if (this.cpuClockRemaining <= 0) {
			if (!this.suppressNMI && this.doNMI) {
				this.elapsedCycles = 0;
				this.serveISR('NMI');
				this.cpuClockRemaining += this.elapsedCycles;
				this.suppressNMI = false;
				this.doNMI = false;
			}
		}
	};

	this.clockAPU = function() {
		this.nes.APU.run();
	};

	this.run = function() {
		this.totalCPUCyclesThisFrame = 0;
		this.frameCompleted = false;
		this.renderedScanline = 0;
		if (this.nes.MMU.chrRamWritten) {
			this.nes.Mapper.reRenderCHR();
		}
		while (!this.frameCompleted) {
			// if ((this.P >> 2) & 0x01 == 0x01) { //IRQ is enabled
			// 	if (this.nes.APU.doIrq) {
			// 		this.elapsedCycles = 0;
			// 		this.serveISR('IRQ');
			// 		this.cpuClockRemaining += this.elapsedCycles;
			// 		this.nes.APU.doIrq = false;
			// 	}
			// }
			if (this.oddFrame) {
				if (this.nes.MMU.OAMDMAwritten) {
					this.cpuClockRemaining += 514;
					this.nes.MMU.OAMDMAwritten = false;
				}
			}
			else {
				if (this.nes.MMU.OAMDMAwritten) {
					this.cpuClockRemaining += 513;
					this.nes.MMU.OAMDMAwritten = false;
				}
			}
			this.clockCPU();
			// this.clockAPU();
			//TODO: Check additional cycles after frame completed
			this.clockPPU();
			this.clockPPU();
			this.clockPPU();

			// for (var i = 0; i < 3; i++) {
			// 	// this.clockPPU();
			// 	this.fakeClockPPU();
			// 	if (this.frameCompleted)
			// 		break;
			// }
			// for (var i = 0; i < 3; i++) {
			// 	this.fakeClockPPU();
			// 	if (this.frameCompleted)
			// 		break;
			// }

			this.totalCPUCyclesThisFrame++;
		}
		this.oddFrame = !this.oddFrame;
		return this.totalCPUCyclesThisFrame;
	};

	this.scanline_complete = false;
	// var testClock = 0;

	this.ppuClock = 0;
	this.fakeClockPPU = function() {
		this.ppuClock++;
		if (this.ppuClock == 341) {
			this.ppuClock = 0;
			this.renderedScanline++;
			if (this.renderedScanline == 241) {
				this.nes.PPU.NMIOccured = true;
				if (this.nes.MMU.enableNMIGen && this.nes.PPU.NMIOccured) {
					this.elapsedCycles = 0;
					this.serveISR('NMI');
					this.cpuClockRemaining += this.elapsedCycles;
				}
			}
			if (this.renderedScanline == 262) {
				this.frameCompleted = true;
			}
		}
	};

	//----------------------xxxx------------------------------





	//New cycle accurate behavior below TODO: New stack behavior
	this.BRK = function() {
		this.memoryRead(0, 0);
		this.memoryWrite(2, 0, (this.pc & 0xFF00) >> 8);
		this.memoryWrite(2, 0, this.pc & 0x00FF);
		//Set the Break flag 
		this.P = this.P & 0b11101111;
		this.P = this.P | 0b00010000;
		this.P = this.P & 0b11011111;
		this.P = this.P | 0b00100000;
		this.memoryWrite(2, 0, this.P);
		//Set the I flag
		this.P = this.P & 0b11111011;
		this.P = this.P | 0b00000100;
		vector1 = this.memoryRead(4, 0xFFFE);
		vector2 = this.memoryRead(4, 0xFFFE + 1);
		vector2 <<= 8;
		this.pc = vector2 | vector1;
	};
	this.NMI = function() {
		this.memoryRead(4, this.PC);
		this.memoryRead(4, this.PC);
		//push pc to stack
		this.memoryWrite(2, 0, (this.pc & 0xFF00) >> 8);
		this.memoryWrite(2, 0, this.pc & 0x00FF);
		//push processor status to stack
		this.memoryWrite(2, 0, this.P);
		vector1 = this.memoryRead(4, 0xFFFA);
		vector2 = this.memoryRead(4, 0xFFFA + 1);
		vector2 <<= 8;
		this.pc = vector2 | vector1;
	};
	this.IRQ = function() {
		this.memoryRead(4, this.PC);
		this.memoryRead(4, this.PC);
		//push pc to stack
		this.memoryWrite(2, 0, (this.pc & 0xFF00) >> 8);
		this.memoryWrite(2, 0, this.pc & 0x00FF);
		//set bit 5 & 4 to 10
		var tempFlag = this.P & 0b11001111;
		tempFlag = tempFlag | 0b00100000;
		this.memoryWrite(2, 0, tempFlag);
		//Set the I flag
		this.P = this.P & 0b11111011;
		this.P = this.P | 0b00000100;
		vector1 = this.memoryRead(4, 0xFFFE);
		vector2 = this.memoryRead(4, 0xFFFE + 1);
		vector2 <<= 8;
		this.pc = vector2 | vector1;
	};

	this.RTI = function() {
		this.memoryRead(4, this.pc);
		this.memoryRead(1, 0);
		var temp = this.memoryRead(2, 0);
		if ((temp & 1) === 1)
			this.setFlag('carry');
		else this.unsetFlag('carry');

		if ((temp & 0b00000010) === 0b00000010)
			this.setFlag('zero');
		else this.unsetFlag('zero');

		if ((temp & 0b00000100) == 0b00000100)
			this.setFlag('irqDisable');
		else this.unsetFlag('irqDisable');

		if ((temp & 0b00001000) == 0b00001000)
			this.setFlag('decimal');
		else this.unsetFlag('decimal');

		if ((temp & 0b01000000) == 0b01000000)
			this.setFlag('overflow');
		else this.unsetFlag('overflow');

		if ((temp & 0b10000000) == 0b10000000)
			this.setFlag('negative');
		else this.unsetFlag('negative');

		var lowByte = this.memoryRead(2, 0);
		var highByte = this.memoryRead(2, 0);
		this.pc = (highByte << 8) | lowByte;
	};
	this.RTS = function() {
		this.memoryRead(4, this.pc);
		this.memoryRead(1, 0);
		var lowByte = this.memoryRead(2, 0);
		var highByte = this.memoryRead(2, 0);
		this.pc = ((highByte << 8) | lowByte);
		this.memoryWrite(0, 0, 0);
	};


	this.TXS = function() {
		this.sp = this.X;
		this.memoryRead(4, this.pc);
	};
	this.TSX = function() {
		this.X = this.sp;
		this.calcFlags(this.X, false, null);
		this.memoryRead(4, this.pc);
	};
	this.PHA = function() {
		this.memoryRead(1, 0);
		this.memoryWrite(2, 0, this.accumulator);
	};
	this.PHP = function() {
		this.memoryRead(1, 0);
		var temp = this.P;
		temp = temp & 0b11101111;
		temp = temp | 0b00110000;
		this.memoryWrite(2, 0, temp);
	};
	this.PLA = function() {
		this.memoryRead(1, 0);
		this.memoryWrite(1, 0, 0);
		this.accumulator = this.memoryRead(2, 0);
		this.calcFlags(null, false, null);
	};
	this.PLP = function() {
		this.memoryRead(1, 0);
		this.memoryWrite(1, 0, 0);
		var temp = this.memoryRead(2);
		if ((temp & 0b00000001) === 1)
			this.setFlag('carry');
		else this.unsetFlag('carry');

		if ((temp & 0b00000010) == 0b00000010)
			this.setFlag('zero');
		else this.unsetFlag('zero');

		if ((temp & 0b00000100) == 0b00000100)
			this.setFlag('irqDisable');
		else this.unsetFlag('irqDisable');

		if ((temp & 0b00001000) == 0b00001000)
			this.setFlag('decimal');
		else this.unsetFlag('decimal');

		if ((temp & 0b01000000) == 0b01000000)
			this.setFlag('overflow');
		else this.unsetFlag('overflow');

		if ((temp & 0b10000000) == 0b10000000)
			this.setFlag('negative');
		else this.unsetFlag('negative');
	};

	this.TAX = function() {
		this.X = this.accumulator;
		this.calcFlags(this.X, false, null);
		this.memoryRead(4, this.pc);
	};
	this.TXA = function() {
		this.accumulator = this.X;
		this.calcFlags(null, false, null);
		this.memoryRead(4, this.pc);
	};
	this.DEX = function() {
		this.X = this.wrap8bit('decrement', this.X, null);
		this.calcFlags(this.X, false, null);
		this.memoryRead(4, this.pc);
	};
	this.INX = function() {
		this.X = this.wrap8bit('increment', this.X, null);
		this.calcFlags(this.X, false, null);
		this.memoryRead(4, this.pc);
	};
	this.TAY = function() {
		this.Y = this.accumulator;
		this.calcFlags(this.Y, false, null);
		this.memoryRead(4, this.pc);
	};
	this.TYA = function() {
		this.accumulator = this.Y;
		this.calcFlags(null, false, null);
		this.memoryRead(4, this.pc);
	};
	this.DEY = function() {
		this.Y = this.wrap8bit('decrement', this.Y, null);
		this.calcFlags(this.Y, false, null);
		this.memoryRead(4, this.pc);
	};
	this.INY = function() {
		this.Y = this.wrap8bit('increment', this.Y, null);
		this.calcFlags(this.Y, false, null);
		this.memoryRead(4, this.pc);
	};

	this.CLC = function() {
		this.unsetFlag('carry');
		this.memoryRead(4, this.pc);
	};
	this.SEC = function() {
		this.setFlag('carry');
		this.memoryRead(4, this.pc);
	};
	this.CLI = function() {
		this.unsetFlag('irqDisable');
		this.memoryRead(4, this.pc);
	};
	this.SEI = function() {
		this.setFlag('irqDisable');
		this.memoryRead(4, this.pc);
	};
	this.CLV = function() {
		this.unsetFlag('overflow');
		this.memoryRead(4, this.pc);
	};
	this.CLD = function() {
		this.unsetFlag('decimal');
		this.memoryRead(4, this.pc);
	};
	this.SED = function() {
		this.setFlag('decimal');
		this.memoryRead(4, this.pc);
	};

	this.JSR_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		//Transfer next instruction - 1 point to stack
		this.memoryWrite(2, 0, (this.pc - 1) >> 8);
		this.memoryWrite(2, 0, (this.pc - 1) & 0x00FF);
		this.pc = param;
	};

	this.JMP_A = function() {
		var temp = 0;
		temp |= this.memoryRead(0, 0) & 0x00FF;
		temp |= this.memoryRead(0, 0) << 8;
		this.pc = temp;
	};
	this.JMP_I = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var lowerByte, higherByte;
		if (param1 == 0xFF) {
			lowerByte = param;
			higherByte = param2 | 0x00;
		}
		else {
			lowerByte = param;
			higherByte = param2 | (param1 + 1);
		}
		this.pc = (this.memoryRead(4, higherByte) << 8) | this.memoryRead(4, lowerByte);
	};

	this.BPL = function() {
		var param = this.memoryRead(0, 0);
		var offset = this.calcOffset(param);
		if ((this.P >> 7) == 0) {
			if ((this.pc >> 8) != ((this.pc + offset) >> 8))
				this.memoryRead(4, this.pc);
			this.pc += offset;
			this.memoryRead(4, this.pc);
		}
	};
	this.BMI = function() {
		var param = this.memoryRead(0, 0);
		var offset = this.calcOffset(param);
		if ((this.P >> 7) == 1) {
			if ((this.pc >> 8) != ((this.pc + offset) >> 8))
				this.memoryRead(4, this.pc);
			this.pc += offset;
			this.memoryRead(4, this.pc);
		}
	};
	this.BVC = function() {
		var param = this.memoryRead(0, 0);
		var offset = this.calcOffset(param);
		if (((this.P >> 6) & 0x01) == 0) {
			if ((this.pc >> 8) != ((this.pc + offset) >> 8))
				this.memoryRead(4, this.pc);
			this.pc += offset;
			this.memoryRead(4, this.pc);
		}
	};
	this.BVS = function() {
		var param = this.memoryRead(0, 0);
		var offset = this.calcOffset(param);
		if (((this.P >> 6) & 0x01) == 1) {
			if ((this.pc >> 8) != ((this.pc + offset) >> 8))
				this.memoryRead(4, this.pc);
			this.pc += offset;
			this.memoryRead(4, this.pc);
		}
	};
	this.BCC = function() {
		var param = this.memoryRead(0, 0);
		var offset = this.calcOffset(param);
		if ((this.P & 0x01) == 0) {
			if ((this.pc >> 8) != ((this.pc + offset) >> 8))
				this.memoryRead(4, this.pc);
			this.pc += offset;
			this.memoryRead(4, this.pc);
		}
	};
	this.BCS = function() {
		var param = this.memoryRead(0, 0);
		var offset = this.calcOffset(param);
		if ((this.P & 0x01) == 1) {
			if ((this.pc >> 8) != ((this.pc + offset) >> 8))
				this.memoryRead(4, this.pc);
			this.pc += offset;
			this.memoryRead(4, this.pc);
		}
	};
	this.BNE = function() {
		var param = this.memoryRead(0, 0);
		var offset = this.calcOffset(param);
		if (((this.P >> 1) & 0x01) == 0) {
			if ((this.pc >> 8) != ((this.pc + offset) >> 8))
				this.memoryRead(4, this.pc);
			this.pc += offset;
			this.memoryRead(4, this.pc);
		}
	};
	this.BEQ = function() {
		var param = this.memoryRead(0, 0);
		var offset = this.calcOffset(param);
		if (((this.P >> 1) & 0x01) == 1) {
			if ((this.pc >> 8) != ((this.pc + offset) >> 8))
				this.memoryRead(4, this.pc);
			this.pc += offset;
			this.memoryRead(4, this.pc);
		}
	};

	this.LDA_I = function() {
		this.accumulator = this.memoryRead(0, 0);
		this.calcFlags(null, false, null);
	};
	this.LDA_Z = function() {
		var param = this.memoryRead(0, 0);
		this.accumulator = this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.LDA_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.accumulator = this.memoryRead(4, param);
		this.accumulator += this.X;
		this.accumulator = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
	};
	this.LDA_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var param = param2 | param1;
		this.accumulator = this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.LDA_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var temp = param1 + this.X;
		var tempEffAddr = param2 | temp;
		if (tempEffAddr > 0xFFFF)
			tempEffAddr = tempEffAddr - (0xFFFF + 1);
		this.accumulator = this.memoryRead(4, tempEffAddr);
		if (temp > 0xFF) {
			var param = param2 | param1;
			tempEffAddr = param + this.X;
			if (tempEffAddr > 0xFFFF)
				tempEffAddr = tempEffAddr - (0xFFFF + 1);
			this.accumulator = this.memoryRead(4, tempEffAddr);
		}
		this.calcFlags(null, false, null);
	};
	this.LDA_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var temp = param1 + this.Y;
		var tempEffAddr = param2 | temp;
		if (tempEffAddr > 0xFFFF)
			tempEffAddr = tempEffAddr - (0xFFFF + 1);
		this.accumulator = this.memoryRead(4, tempEffAddr);
		if (temp > 0xFF) {
			var param = param2 | param1;
			tempEffAddr = param + this.Y;
			if (tempEffAddr > 0xFFFF)
				tempEffAddr = tempEffAddr - (0xFFFF + 1);
			this.accumulator = this.memoryRead(4, tempEffAddr);
		}
		this.calcFlags(null, false, null);
	};
	this.LDA_I_X = function() {
		var param = this.memoryRead(0, 0);
		this.accumulator = this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		this.accumulator = this.memoryRead(4, index2 | index1);
		this.calcFlags(null, false, null);
	};
	this.LDA_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var temp = index1 + this.Y;
		this.accumulator = this.memoryRead(4, index2 | temp);
		if (temp > 0xFF) {
			this.accumulator = this.memoryRead(4, (index2 | index1) + this.Y);
		}
		this.calcFlags(null, false, null);
	};

	this.LDX_I = function() {
		this.X = this.memoryRead(0, 0);
		this.calcFlags(this.X, false, null);
	};
	this.LDX_Z = function() {
		var param = this.memoryRead(0, 0);
		this.X = this.memoryRead(4, param);
		this.calcFlags(this.X, false, null);
	};
	this.LDX_Z_Y = function() {
		var param = this.memoryRead(0, 0);
		this.X = this.memoryRead(4, param) + this.Y;
		this.X = this.memoryRead(4, this.wrap8bit('sum', param, this.Y));
		this.calcFlags(this.X, false, null);
	};
	this.LDX_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		this.X = this.memoryRead(4, param);
		this.calcFlags(this.X, false, null);
	};
	this.LDX_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.Y;
		this.X = this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			this.X = this.memoryRead(4, param + this.Y);
		}
		this.calcFlags(this.X, false, null);
	};

	this.LDY_I = function() {
		this.Y = this.memoryRead(0, 0);
		this.calcFlags(this.Y, false, null);
	};
	this.LDY_Z = function() {
		var param = this.memoryRead(0, 0);
		this.Y = this.memoryRead(4, param);
		this.calcFlags(this.Y, false, null);
	};
	this.LDY_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.Y = this.memoryRead(4, param) + this.X;
		this.Y = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		this.calcFlags(this.Y, false, null);
	};
	this.LDY_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0)
		param2 = param2 << 8;
		var param = param2 | param1;
		this.Y = this.memoryRead(4, param);
		this.calcFlags(this.Y, false, null);
	};
	this.LDY_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.X;
		this.Y = this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			this.Y = this.memoryRead(4, param + this.X);
		}
		this.calcFlags(this.Y, false, null);
	};

	this.STA_Z = function() {
		var param = this.memoryRead(0, 0);
		this.memoryWrite(3, param, this.accumulator);
	};
	this.STA_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.X;
		this.memoryWrite(3, this.wrap8bit('sum', param, this.X), this.accumulator);
	};
	this.STA_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		this.memoryWrite(3, param, this.accumulator);
	};
	this.STA_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.X;
		var tempEffAddr = param2 | temp;
		if (tempEffAddr > 0xFFFF)
			tempEffAddr = tempEffAddr - (0xFFFF + 1);
		this.memoryRead(4, tempEffAddr);
		var param = param2 | param1;
		tempEffAddr = param + this.X;
		if (tempEffAddr > 0xFFFF)
			tempEffAddr = tempEffAddr - (0xFFFF + 1);
		this.memoryWrite(3, tempEffAddr, this.accumulator);
	};
	this.STA_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.Y;
		var tempEffAddr = param2 | temp;
		if (tempEffAddr > 0xFFFF)
			tempEffAddr = tempEffAddr - (0xFFFF + 1);
		this.memoryRead(4, tempEffAddr);
		var param = param2 | param1;
		tempEffAddr = param + this.Y;
		if (tempEffAddr > 0xFFFF)
			tempEffAddr = tempEffAddr - (0xFFFF + 1);
		this.memoryWrite(3, tempEffAddr, this.accumulator);
	};
	this.STA_I_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		this.memoryWrite(3, index2 | index1, this.accumulator);
	};
	this.STA_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var temp = index1 + this.Y;
		this.memoryRead(4, index2 | temp);
		this.memoryWrite(3, (index2 | index1) + this.Y, this.accumulator);
	};

	this.STX_Z = function() {
		var param = this.memoryRead(0, 0);
		this.memoryWrite(3, param, this.X);
	};
	this.STX_Z_Y = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.Y;
		this.memoryWrite(3, this.wrap8bit('sum', param, this.Y), this.X);
	};
	this.STX_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		this.memoryWrite(3, param, this.X);
	};

	this.STY_Z = function() {
		var param = this.memoryRead(0, 0);
		this.memoryWrite(3, param, this.Y);
	};
	this.STY_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.X;
		this.memoryWrite(3, this.wrap8bit('sum', param, this.X), this.Y);
	};
	this.STY_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		this.memoryWrite(3, param, this.Y);
	};

	this.AND_I = function() {
		this.accumulator &= this.memoryRead(0, 0);
		this.calcFlags(null, false, null);
	};
	this.AND_Z = function() {
		var param = this.memoryRead(0, 0);
		this.accumulator &= this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.AND_Z_X = function() {
		var param = this.memoryRead(0, 0);
		var temp = this.accumulator;
		this.accumulator = this.memoryRead(4, param);
		this.accumulator += this.X;
		this.accumulator = temp & this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
	};
	this.AND_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var param = param2 | param1;
		this.accumulator &= this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.AND_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var temp = param1 + this.X;
		var tempAcc = this.accumulator;
		this.accumulator &= this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			this.accumulator = tempAcc & this.memoryRead(4, param + this.X);
		}
		this.calcFlags(null, false, null);
	};
	this.AND_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var temp = param1 + this.Y;
		var tempAcc = this.accumulator;
		this.accumulator &= this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			this.accumulator = tempAcc & this.memoryRead(4, param + this.Y);
		}
		this.calcFlags(null, false, null);
	};
	this.AND_I_X = function() {
		var param = this.memoryRead(0, 0);
		var tempAcc = this.accumulator;
		this.accumulator = this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 <<= 8;
		this.accumulator = tempAcc & this.memoryRead(4, index2 | index1);
		this.calcFlags(null, false, null);
	};
	this.AND_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var temp = index1 + this.Y;
		var tempAcc = this.accumulator;
		this.accumulator &= this.memoryRead(4, index2 | temp);
		if (temp > 0xFF) {
			this.accumulator = tempAcc & this.memoryRead(4, (index2 | index1) + this.Y);
		}
		this.calcFlags(null, false, null);
	};

	this.EOR_I = function() {
		this.accumulator ^= this.memoryRead(0, 0);
		this.calcFlags(null, false, null);
	};
	this.EOR_Z = function() {
		var param = this.memoryRead(0, 0);
		this.accumulator ^= this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.EOR_Z_X = function() {
		var param = this.memoryRead(0, 0);
		var temp = this.accumulator;
		this.accumulator = this.memoryRead(4, param);
		this.accumulator += this.X;
		this.accumulator = temp ^ this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
	};
	this.EOR_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var param = param2 | param1;
		this.accumulator ^= this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.EOR_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var temp = param1 + this.X;
		var tempAcc = this.accumulator;
		this.accumulator ^= this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			this.accumulator = tempAcc ^ this.memoryRead(4, param + this.X);
		}
		this.calcFlags(null, false, null);
	};
	this.EOR_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var temp = param1 + this.Y;
		var tempAcc = this.accumulator;
		this.accumulator ^= this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			this.accumulator = tempAcc ^ this.memoryRead(4, param + this.Y);
		}
		this.calcFlags(null, false, null);
	};
	this.EOR_I_X = function() {
		var param = this.memoryRead(0, 0);
		var tempAcc = this.accumulator;
		this.accumulator = this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 <<= 8;
		this.accumulator = tempAcc ^ this.memoryRead(4, index2 | index1);
		this.calcFlags(null, false, null);
	};
	this.EOR_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var temp = index1 + this.Y;
		var tempAcc = this.accumulator;
		this.accumulator ^= this.memoryRead(4, index2 | temp);
		if (temp > 0xFF) {
			this.accumulator = tempAcc ^ this.memoryRead(4, (index2 | index1) + this.Y);
		}
		this.calcFlags(null, false, null);
	};

	this.ORA_I = function() {
		this.accumulator |= this.memoryRead(0, 0);
		this.calcFlags(null, false, null);
	};
	this.ORA_Z = function() {
		var param = this.memoryRead(0, 0);
		this.accumulator |= this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.ORA_Z_X = function() {
		var param = this.memoryRead(0, 0);
		var temp = this.accumulator;
		this.accumulator = this.memoryRead(4, param);
		this.accumulator += this.X;
		this.accumulator = temp | this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		this.calcFlags(null, false, null);
	};
	this.ORA_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var param = param2 | param1;
		this.accumulator |= this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.ORA_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var temp = param1 + this.X;
		var tempAcc = this.accumulator;
		this.accumulator |= this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			this.accumulator = tempAcc | this.memoryRead(4, param + this.X);
		}
		this.calcFlags(null, false, null);
	};
	this.ORA_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var temp = param1 + this.Y;
		var tempAcc = this.accumulator;
		this.accumulator |= this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			this.accumulator = tempAcc | this.memoryRead(4, param + this.Y);
		}
		this.calcFlags(null, false, null);
	};
	this.ORA_I_X = function() {
		var param = this.memoryRead(0, 0);
		var tempAcc = this.accumulator;
		this.accumulator = this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 <<= 8;
		this.accumulator = tempAcc | this.memoryRead(4, index2 | index1);
		this.calcFlags(null, false, null);
	};
	this.ORA_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var temp = index1 + this.Y;
		var tempAcc = this.accumulator;
		this.accumulator |= this.memoryRead(4, index2 | temp);
		if (temp > 0xFF) {
			this.accumulator = tempAcc | this.memoryRead(4, (index2 | index1) + this.Y);
		}
		this.calcFlags(null, false, null);
	};

	this.ADC_I = function() {
		var param = this.memoryRead(0, 0);
		var arg = param;
		var temp = this.accumulator + arg + (this.P & 0x01);
		if (((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};
	this.ADC_Z = function() {
		var param = this.memoryRead(0, 0);
		var arg = this.memoryRead(4, param);
		var temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};
	this.ADC_Z_X = function() {
		var param = this.memoryRead(0, 0);
		var tempAcc = this.accumulator;
		this.accumulator = this.memoryRead(4, param);
		this.accumulator += this.X;
		var arg = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var temp = this.to2sComplement(tempAcc) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(tempAcc + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
	};
	this.ADC_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var param = param2 | param1;
		var arg = this.memoryRead(4, param);
		var temp = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
	};
	this.ADC_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var temp = param1 + this.X;
		var arg = this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			arg = this.memoryRead(4, param + this.X);
		}
		var tempResult = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (tempResult < -128 || tempResult > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
	};
	this.ADC_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 <<= 8;
		var temp = param1 + this.Y;
		var arg = this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			arg = this.memoryRead(4, param + this.Y);
		}
		var tempResult = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (tempResult < -128 || tempResult > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
	};
	this.ADC_I_X = function() {
		var param = this.memoryRead(0, 0);
		var tempAcc = this.accumulator;
		this.accumulator = this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		var arg = this.memoryRead(4, index2 | index1);
		var temp = this.to2sComplement(tempAcc) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(tempAcc + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
	};
	this.ADC_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var temp = index1 + this.Y;
		var arg = this.memoryRead(4, index2 | temp);
		if (temp > 0xFF) {
			arg = this.memoryRead(4, (index2 | index1) + this.Y);
		}
		var tempResult = this.to2sComplement(this.accumulator) + this.to2sComplement(arg) + (this.P & 0x01);
		if (tempResult < -128 || tempResult > 127) {
			this.setFlag('overflow');
		}
		else this.unsetFlag('overflow');
		this.accumulator = this.writeCarry(this.accumulator + arg + (this.P & 0x01));
		this.calcFlags(null, false, null);
	};

	this.SBC_I = function() {
		var arg = this.memoryRead(0, 0);
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
	};
	this.SBC_Z = function() {
		var param = this.memoryRead(0, 0);
		var arg = this.memoryRead(4, param);
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
	};
	this.SBC_Z_X = function() {
		var param = this.fetchParams();
		var tempAcc = this.accumulator;
		this.accumulator = this.memoryRead(4, param);
		this.accumulator += this.X;
		var arg = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var temp = tempAcc - arg - (1 - (this.P & 0x01));
		if (
			((tempAcc ^ temp) & 0x80) !== 0 &&
			((tempAcc ^ arg) & 0x80) !== 0
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
	};
	this.SBC_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var arg = this.memoryRead(4, param);
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
	};
	this.SBC_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.X;
		var arg = this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			arg = this.memoryRead(4, param + this.X);
		}
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
	};
	this.SBC_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.Y;
		var arg = this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			arg = this.memoryRead(4, param + this.Y);
		}
		temp = this.accumulator - arg - (1 - (this.P & 0x01));
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
	};
	this.SBC_I_X = function() {
		var param = this.memoryRead(0, 0);
		var tempAcc = this.accumulator;
		this.accumulator = this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		var arg = this.memoryRead(4, index2 | index1);
		var temp = tempAcc - arg - (1 - (this.P & 0x01));
		if (
			((tempAcc ^ temp) & 0x80) !== 0 &&
			((tempAcc ^ arg) & 0x80) !== 0
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
	};
	this.SBC_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var temp = index1 + this.Y;
		var arg = this.memoryRead(4, index2 | temp);
		if (temp > 0xFF) {
			arg = this.memoryRead(4, (index2 | index1) + this.Y);
		}
		temp = this.accumulator - arg - (1 - (this.P & 0x01));
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
	};

	this.CMP_I = function() {
		var param = this.memoryRead(0, 0);
		var result = this.compareValsAndSetNegative(this.accumulator, param);
		if (result > 0) {
			this.setFlag('carry');
			this.unsetFlag('zero');
		}
		if (result === 0) {
			this.setFlag('carry');
			this.setFlag('zero');
		}
		if (result < 0) {
			this.unsetFlag('carry');
			this.unsetFlag('zero');
		}
	};
	this.CMP_Z = function() {
		var param = this.memoryRead(0, 0);
		var result = this.compareValsAndSetNegative(this.accumulator, this.memoryRead(4, param));
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
	};
	this.CMP_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.accumulator = this.memoryRead(4, param);
		this.accumulator += this.X;
		var result = this.compareValsAndSetNegative(this.accumulator, this.memoryRead(4, this.wrap8bit('sum', param, this.X)));
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
	};
	this.CMP_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.accumulator, this.memoryRead(4, param));
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
	};
	this.CMP_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.X;
		var result = this.compareValsAndSetNegative(this.accumulator, this.memoryRead(4, param2 | temp));
		if (temp > 0xFF) {
			var param = param2 | param1;
			result = this.compareValsAndSetNegative(this.accumulator, this.memoryRead(4, param + this.X));
		}
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
	};
	this.CMP_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.Y;
		var result = this.compareValsAndSetNegative(this.accumulator, this.memoryRead(4, param2 | temp));
		if (temp > 0xFF) {
			var param = param2 | param1;
			var result = this.compareValsAndSetNegative(this.accumulator, this.memoryRead(4, param + this.Y));
		}
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
	};
	this.CMP_I_X = function() {
		var param = this.memoryRead(0, 0);
		var tempAcc = this.accumulator;
		this.accumulator = this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		var result = this.compareValsAndSetNegative(tempAcc, this.memoryRead(4, index2 | index1));
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
	};
	this.CMP_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var temp = index1 + this.Y;
		var result = this.compareValsAndSetNegative(this.accumulator, this.memoryRead(4, index2 | temp));
		if (temp > 0xFF) {
			result = this.compareValsAndSetNegative(this.accumulator, this.memoryRead(4, (index2 | index1) + this.Y));
		}
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
	};

	this.CPX_I = function() {
		var param = this.memoryRead(0, 0);
		var result = this.compareValsAndSetNegative(this.X, param);
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
	};
	this.CPX_Z = function() {
		var param = this.memoryRead(0, 0);
		var result = this.compareValsAndSetNegative(this.X, this.memoryRead(4, param));
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
	};
	this.CPX_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.X, this.memoryRead(4, param));
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
	};

	this.CPY_I = function() {
		var param = this.memoryRead(0, 0);
		var result = this.compareValsAndSetNegative(this.Y, param);
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
	};
	this.CPY_Z = function() {
		var param = this.memoryRead(0, 0);
		var result = this.compareValsAndSetNegative(this.Y, this.memoryRead(4, param));
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
	};
	this.CPY_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.Y, this.memoryRead(4, param));
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
	};

	this.BIT_Z = function() {
		var param = this.memoryRead(0, 0);
		var result = this.accumulator & this.memoryRead(4, param);
		if (result == 0) {
			this.setFlag('zero');
		}
		else
			this.unsetFlag('zero');

		if ((0b10000000 & result) == 128) {
			this.setFlag('negative');
		}
		else {
			this.unsetFlag('negative');
		}
		if ((0b01000000 & result) == 64) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
	};
	this.BIT_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.accumulator & this.memoryRead(4, param);
		if (result == 0) {
			this.setFlag('zero');
		}
		else
			this.unsetFlag('zero');

		if ((0b10000000 & result) == 128) {
			this.setFlag('negative');
		}
		else {
			this.unsetFlag('negative');
		}
		if ((0b01000000 & result) == 64) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
	};

	this.NOP = function() {
		this.memoryRead(4, 0);
	};

	this.ASL_AC = function() {
		if ((this.accumulator >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.accumulator <<= 1;
		this.accumulator &= 0xFF;
		this.calcFlags(null, false, null);
		this.memoryRead(4, this.pc);
	};
	this.ASL_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, param, val << 1);
		this.calcFlags(val << 1, false, null);
	};
	this.ASL_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, tempAddr, val);
		this.memoryWrite(3, tempAddr, val << 1);
		this.calcFlags(val << 1, false, null);
	};
	this.ASL_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, param, val);
		this.memoryWrite(3, param, val << 1);
		this.calcFlags(val << 1, false, null);
	};
	this.ASL_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var param = param2 | param1;
		var val = this.memoryRead(4, param + this.X);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, param + this.X, val);
		this.memoryWrite(3, param + this.X, val << 1);
		this.calcFlags(val << 1, false, null);
	};

	this.LSR_AC = function() {
		if ((this.accumulator & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.accumulator >>= 1;
		this.calcFlags(null, false, null);
		this.memoryRead(4, this.pc);
	};
	this.LSR_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, param, val >> 1);
		this.calcFlags(val >> 1, false, null);
	};
	this.LSR_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, tempAddr, val);
		this.memoryWrite(3, tempAddr, val >> 1);
		this.calcFlags(val >> 1, false, null);
	};
	this.LSR_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, param, val);
		this.memoryWrite(3, param, val >> 1);
		this.calcFlags(val >> 1, false, null);
	};
	this.LSR_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var param = param2 | param1;
		var val = this.memoryRead(4, param + this.X);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, param + this.X, val);
		this.memoryWrite(3, param + this.X, val >> 1);
		this.calcFlags(val >> 1, false, null);
	};

	this.ROL_AC = function() {
		var currCarry = this.P & 0x01;
		if ((this.accumulator >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.accumulator <<= 1;
		this.accumulator &= 0xFF;
		if (currCarry == 1) {
			this.accumulator |= 0b00000001;
		}
		this.calcFlags(null, false, null);
		this.memoryRead(4, this.pc);
	};
	this.ROL_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		var currCarry = this.P & 0x01;
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.ROL_Z_X = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, tempAddr, val);
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, tempAddr, val);
		this.calcFlags(val, false, null);
	};
	this.ROL_A = function() {
		var currCarry = this.P & 0x01;
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, param, val);
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.ROL_A_X = function() {
		var currCarry = this.P & 0x01;
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var param = param2 | param1;
		var val = this.memoryRead(4, param + this.X);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, param + this.X, val);
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param + this.X, val);
		this.calcFlags(val, false, null);
	};

	this.ROR_AC = function() {
		var currCarry = this.P & 0x01;
		if ((this.accumulator & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.accumulator >>= 1;
		if (currCarry == 1) {
			this.accumulator |= 0b10000000;
		}
		this.calcFlags(null, false, null);
		this.memoryRead(4, this.pc);
	};
	this.ROR_Z = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.ROR_Z_X = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, tempAddr, val);
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, tempAddr, val);
		this.calcFlags(val, false, null);
	};
	this.ROR_A = function() {
		var currCarry = this.P & 0x01;
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, param, val);
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param, val);
	};
	this.ROR_A_X = function() {
		var currCarry = this.P & 0x01;
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var param = param2 | param1;
		var val = this.memoryRead(4, param + this.X);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		this.memoryWrite(3, param + this.X, val);
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param + this.X, val);
		this.calcFlags(val, false, null);
	};

	this.INC_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.INC_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		this.memoryWrite(3, tempAddr, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, tempAddr, val);
		this.calcFlags(val, false, null);
	};
	this.INC_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.INC_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var param = param2 | param1;
		var val = this.memoryRead(4, param + this.X);
		this.memoryWrite(3, param + this.X, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param + this.X, val);
		this.calcFlags(val, false, null);
	};

	this.DEC_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.DEC_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		this.memoryWrite(3, tempAddr, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, tempAddr, val);
		this.calcFlags(val, false, null);
	};
	this.DEC_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.DEC_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var param = param2 | param1;
		var val = this.memoryRead(4, param + this.X);
		this.memoryWrite(3, param + this.X, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param + this.X, val);
		this.calcFlags(val, false, null);
	};

	//unofficial opcodes (optional for most games)
	this.DOP_Z = function() {
		this.memoryRead(0, 0);
		this.memoryRead(4, this.pc);
	};
	this.DOP_Z_X = function() {
		this.memoryRead(0, 0);
		this.memoryRead(4, this.pc);
		this.memoryRead(4, this.pc);
	};
	this.DOP_I = function() {
		this.memoryRead(0, 0);
	};

	this.TOP_A = function() {
		this.memoryRead(0, 0);
		this.memoryRead(0, 0);
		this.memoryRead(4, this.pc);
	};
	this.TOP_A_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(0, 0);
		var temp = param + this.X;
		this.memoryRead(4, temp);
		if (temp > 0xFF) {
			this.memoryRead(4, this.pc);
		}
	};

	this.LAX_Z = function() {
		var param = this.memoryRead(0, 0);
		this.accumulator = this.X = this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.LAX_Z_Y = function() {
		var param = this.memoryRead(0, 0);
		this.accumulator = this.memoryRead(4, param);
		this.accumulator += this.Y;
		this.accumulator = this.X = this.memoryRead(4, this.wrap8bit('sum', param, this.Y));
		this.calcFlags(null, false, null);
	};
	this.LAX_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		this.accumulator = this.X = this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.LAX_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var temp = param1 + this.Y;
		this.accumulator = this.X = this.memoryRead(4, param2 | temp);
		if (temp > 0xFF) {
			var param = param2 | param1;
			this.accumulator = this.X = this.memoryRead(4, param + this.Y);
		}
		this.calcFlags(null, false, null);
	};
	this.LAX_I_X = function() {
		var param = this.memoryRead(0, 0);
		this.accumulator = this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		this.accumulator = this.X = this.memoryRead(4, index2 | index1);
		this.calcFlags(null, false, null);
	};
	this.LAX_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		var temp = index1 + this.Y;
		this.accumulator = this.X = this.memoryRead(4, index2 | temp);
		if (temp > 0xFF) {
			this.accumulator = this.X = this.memoryRead(4, (index2 | index1) + this.Y);
		}
		this.calcFlags(null, false, null);
	};

	this.SAX_Z = function() {
		var param = this.memoryRead(0, 0);
		this.memoryWrite(3, param, this.accumulator & this.X);
	};
	this.SAX_Z_Y = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.Y;
		this.memoryWrite(3, this.wrap8bit('sum', param, this.Y), (this.accumulator & this.X));
	};
	this.SAX_I_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		this.memoryWrite(3, index2 | index1, this.accumulator & this.X);
	};
	this.SAX_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		this.memoryWrite(3, param2 | param1, this.accumulator & this.X);
	};

	this.DCP_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param, val);
		var result = this.compareValsAndSetNegative(this.accumulator, val);
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
	};
	this.DCP_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		this.memoryWrite(3, tempAddr, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, tempAddr, val);
		var result = this.compareValsAndSetNegative(this.accumulator, val);
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
	};
	this.DCP_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param, val);
		var result = this.compareValsAndSetNegative(this.accumulator, val);
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
	};
	this.DCP_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.X);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param, val);
		var result = this.compareValsAndSetNegative(this.accumulator, val);
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
	};
	this.DCP_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.Y;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param, val);
		var result = this.compareValsAndSetNegative(this.accumulator, val);
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
	};
	this.DCP_I_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param, val);
		var result = this.compareValsAndSetNegative(this.accumulator, val);
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
	};
	this.DCP_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, index2 | (this.Y + index1));
		val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param, val);
		var result = this.compareValsAndSetNegative(this.accumulator, val);
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
	};

	this.ISB_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param, val);
		var arg = val;
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
	};
	this.ISB_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		this.memoryWrite(3, tempAddr, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, tempAddr, val);
		var arg = val;
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
	};
	this.ISB_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param, val);
		var arg = val;
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
	};
	this.ISB_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.X);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param, val);
		var arg = val;
		temp = this.accumulator - arg - (1 - (this.P & 0x01));
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
	};
	this.ISB_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.Y;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param, val);
		var arg = val;
		temp = this.accumulator - arg - (1 - (this.P & 0x01));
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
	};
	this.ISB_I_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param, val);
		var arg = val;
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
	};
	this.ISB_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, index2 | (this.Y + index1));
		val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param, val);
		var arg = val;
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
	};

	this.SLO_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		this.memoryWrite(3, param, val);
		this.accumulator |= val;
		this.calcFlags(null, false, null);
	};
	this.SLO_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		this.memoryWrite(3, tempAddr, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		this.memoryWrite(3, tempAddr, val);
		this.accumulator |= val;
		this.calcFlags(null, false, null);
	};
	this.SLO_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		this.memoryWrite(3, param, val);
		this.accumulator |= val;
		this.calcFlags(null, false, null);
	};
	this.SLO_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.X);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		this.memoryWrite(3, param, val);
		this.accumulator |= val;
		this.calcFlags(null, false, null);
	};
	this.SLO_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.Y;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		this.memoryWrite(3, param, val);
		this.accumulator |= val;
		this.calcFlags(null, false, null);
	};
	this.SLO_I_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		this.memoryWrite(3, param, val);
		this.accumulator |= val;
		this.calcFlags(null, false, null);
	};
	this.SLO_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, index2 | (this.Y + index1));
		val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		this.memoryWrite(3, param, val);
		this.accumulator |= val;
		this.calcFlags(null, false, null);
	};

	this.SRE_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		this.memoryWrite(3, param, val);
		this.accumulator ^= val;
		this.calcFlags(null, false, null);
	};
	this.SRE_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		this.memoryWrite(3, tempAddr, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		this.memoryWrite(3, tempAddr, val);
		this.accumulator ^= val;
		this.calcFlags(null, false, null);
	};
	this.SRE_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		this.memoryWrite(3, param, val);
		this.accumulator ^= val;
		this.calcFlags(null, false, null);
	};
	this.SRE_A_X = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.X);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		this.memoryWrite(3, param, val);
		this.accumulator ^= val;
		this.calcFlags(null, false, null);
	};
	this.SRE_A_Y = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.Y;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		this.memoryWrite(3, param, val);
		this.accumulator ^= val;
		this.calcFlags(null, false, null);
	};
	this.SRE_I_X = function() {
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		this.memoryWrite(3, param, val);
		this.accumulator ^= val;
		this.calcFlags(null, false, null);
	};
	this.SRE_I_Y = function() {
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, index2 | (this.Y + index1));
		val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		this.memoryWrite(3, param, val);
		this.accumulator ^= val;
		this.calcFlags(null, false, null);
	};

	this.RLA_Z = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param, val);
		this.accumulator &= val;
		this.calcFlags(null, false, null);
	};
	this.RLA_Z_X = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		this.memoryWrite(3, tempAddr, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, tempAddr, val);
		this.accumulator &= val;
		this.calcFlags(null, false, null);
	};
	this.RLA_A = function() {
		var currCarry = this.P & 0x01;
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param, val);
		this.accumulator &= val;
		this.calcFlags(null, false, null);
	};
	this.RLA_A_X = function() {
		var currCarry = this.P & 0x01;
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.X);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param, val);
		this.accumulator &= val;
		this.calcFlags(null, false, null);
	};
	this.RLA_A_Y = function() {
		var currCarry = this.P & 0x01;
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.Y;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param, val);
		this.accumulator &= val;
		this.calcFlags(null, false, null);
	};
	this.RLA_I_X = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param, val);
		this.accumulator &= val;
		this.calcFlags(null, false, null);
	};
	this.RLA_I_Y = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, index2 | (this.Y + index1));
		val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val <<= 1;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param, val);
		this.accumulator &= val;
		this.calcFlags(null, false, null);
	};

	this.RRA_Z = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param, val);
		var arg = val;
		var temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};

	this.RRA_Z_X = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		var val = this.memoryRead(4, tempAddr);
		this.memoryWrite(3, tempAddr, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, tempAddr, val);
		var arg = val;
		var temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};
	this.RRA_A = function() {
		var currCarry = this.P & 0x01;
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param, val);
		var arg = val;
		var temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};
	this.RRA_A_X = function() {
		var currCarry = this.P & 0x01;
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.X;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.X);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param, val);
		var arg = val;
		temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};
	this.RRA_A_Y = function() {
		var currCarry = this.P & 0x01;
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = param1 + this.Y;
		this.memoryRead(4, temp);
		var val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param, val);
		var arg = val;
		temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};
	this.RRA_I_X = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param, val);
		var arg = val;
		var temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};
	this.RRA_I_Y = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		var index1 = this.memoryRead(4, param);
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param, 1));
		index2 = index2 << 8;
		param = index2 | index1;
		var val = this.memoryRead(4, index2 | (this.Y + index1));
		val = this.memoryRead(4, param + this.Y);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag('carry');
		else
			this.unsetFlag('carry');
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param, val);
		var arg = val;
		var temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag('overflow');
		}
		else {
			this.unsetFlag('overflow');
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag('carry');
		}
		else {
			this.unsetFlag('carry');
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};


	this.executeInstruction = function(opCode) {
		switch (opCode) {
			//LDA Instuctions
			case 0xA9:
				this.LDA_I();
				break;
			case 0xA5:
				this.LDA_Z();
				break;
			case 0xB5:
				this.LDA_Z_X();
				break;
			case 0xAD:
				this.LDA_A();
				break;
			case 0xBD:
				this.LDA_A_X();
				break;
			case 0xB9:
				this.LDA_A_Y();
				break;
			case 0xA1:
				this.LDA_I_X();
				break;
			case 0xB1:
				this.LDA_I_Y();
				break;

				//STA Instructions
			case 0x85:
				this.STA_Z();
				break;
			case 0x95:
				this.STA_Z_X();
				break;
			case 0x8D:
				this.STA_A();
				break;
			case 0x9D:
				this.STA_A_X();
				break;
			case 0x99:
				this.STA_A_Y();
				break;
			case 0x81:
				this.STA_I_X();
				break;
			case 0x91:
				this.STA_I_Y();
				break;

				//ADC Instructions
			case 0x69:
				this.ADC_I();
				break;
			case 0x65:
				this.ADC_Z();
				break;
			case 0x75:
				this.ADC_Z_X();
				break;
			case 0x6D:
				this.ADC_A();
				break;
			case 0x7D:
				this.ADC_A_X();
				break;
			case 0x79:
				this.ADC_A_Y();
				break;
			case 0x61:
				this.ADC_I_X();
				break;
			case 0x71:
				this.ADC_I_Y();
				break;

				//AND Instructions
			case 0x29:
				this.AND_I();
				break;
			case 0x25:
				this.AND_Z();
				break;
			case 0x35:
				this.AND_Z_X();
				break;
			case 0x2D:
				this.AND_A();
				break;
			case 0x3D:
				this.AND_A_X();
				break;
			case 0x39:
				this.AND_A_Y();
				break;
			case 0x21:
				this.AND_I_X();
				break;
			case 0x31:
				this.AND_I_Y();
				break;

				//ASL Instructions
			case 0x0A:
				this.ASL_AC();
				break;
			case 0x06:
				this.ASL_Z();
				break;
			case 0x16:
				this.ASL_Z_X();
				break;
			case 0x0E:
				this.ASL_A();
				break;
			case 0x1E:
				this.ASL_A_X();
				break;

				//BIT Instructions
			case 0x24:
				this.BIT_Z();
				break;
			case 0x2C:
				this.BIT_A();
				break;

				//Branch Instructions
			case 0x10:
				this.BPL();
				break;
			case 0x30:
				this.BMI();
				break;
			case 0x50:
				this.BVC();
				break;
			case 0x70:
				this.BVS();
				break;
			case 0x90:
				this.BCC();
				break;
			case 0xB0:
				this.BCS();
				break;
			case 0xD0:
				this.BNE();
				break;
			case 0xF0:
				this.BEQ();
				break;

				//BRK Instructions
			case 0x00:
				this.BRK();
				break;

				//CMP Instructions
			case 0xC9:
				this.CMP_I();
				break;
			case 0xC5:
				this.CMP_Z();
				break;
			case 0xD5:
				this.CMP_Z_X();
				break;
			case 0xCD:
				this.CMP_A();
				break;
			case 0xDD:
				this.CMP_A_X();
				break;
			case 0xD9:
				this.CMP_A_Y();
				break;
			case 0xC1:
				this.CMP_I_X();
				break;
			case 0xD1:
				this.CMP_I_Y();
				break;

				//CPX Instructions
			case 0xE0:
				this.CPX_I();
				break;
			case 0xE4:
				this.CPX_Z();
				break;
			case 0xEC:
				this.CPX_A();
				break;

				//CPY Instructions
			case 0xC0:
				this.CPY_I();
				break;
			case 0xC4:
				this.CPY_Z();
				break;
			case 0xCC:
				this.CPY_A();
				break;

				//DEC Instructions
			case 0xC6:
				this.DEC_Z();
				break;
			case 0xD6:
				this.DEC_Z_X();
				break;
			case 0xCE:
				this.DEC_A();
				break;
			case 0xDE:
				this.DEC_A_X();
				break;

				//EOR Instructions
			case 0x49:
				this.EOR_I();
				break;
			case 0x45:
				this.EOR_Z();
				break;
			case 0x55:
				this.EOR_Z_X();
				break;
			case 0x4D:
				this.EOR_A();
				break;
			case 0x5D:
				this.EOR_A_X();
				break;
			case 0x59:
				this.EOR_A_Y();
				break;
			case 0x41:
				this.EOR_I_X();
				break;
			case 0x51:
				this.EOR_I_Y();
				break;

				//Flag Instructions
			case 0x18:
				this.CLC();
				break;
			case 0x38:
				this.SEC();
				break;
			case 0x58:
				this.CLI();
				break;
			case 0x78:
				this.SEI();
				break;
			case 0xB8:
				this.CLV();
				break;
			case 0xD8:
				this.CLD();
				break;
			case 0xF8:
				this.SED();
				break;

				//INC Instructions
			case 0xE6:
				this.INC_Z();
				break;
			case 0xF6:
				this.INC_Z_X();
				break;
			case 0xEE:
				this.INC_A();
				break;
			case 0xFE:
				this.INC_A_X();
				break;

				//JMP Instructions
			case 0x4C:
				this.JMP_A();
				break;
			case 0x6C:
				this.JMP_I();
				break;

				//JSR Instructions
			case 0x20:
				this.JSR_A();
				break;

				//LDX Instructions
			case 0xA2:
				this.LDX_I();
				break;
			case 0xA6:
				this.LDX_Z();
				break;
			case 0xB6:
				this.LDX_Z_Y();
				break;
			case 0xAE:
				this.LDX_A();
				break;
			case 0xBE:
				this.LDX_A_Y();
				break;

				//LDY Instructions
			case 0xA0:
				this.LDY_I();
				break;
			case 0xA4:
				this.LDY_Z();
				break;
			case 0xB4:
				this.LDY_Z_X();
				break;
			case 0xAC:
				this.LDY_A();
				break;
			case 0xBC:
				this.LDY_A_X();
				break;

				//LSR Instructions
			case 0x4A:
				this.LSR_AC();
				break;
			case 0x46:
				this.LSR_Z();
				break;
			case 0x56:
				this.LSR_Z_X();
				break;
			case 0x4E:
				this.LSR_A();
				break;
			case 0x5E:
				this.LSR_A_X();
				break;

				//NOP
			case 0xEA:
				this.NOP();
				break;

				//ORA Instructions
			case 0x09:
				this.ORA_I();
				break;
			case 0x05:
				this.ORA_Z();
				break;
			case 0x15:
				this.ORA_Z_X();
				break;
			case 0x0D:
				this.ORA_A();
				break;
			case 0x1D:
				this.ORA_A_X();
				break;
			case 0x19:
				this.ORA_A_Y();
				break;
			case 0x01:
				this.ORA_I_X();
				break;
			case 0x11:
				this.ORA_I_Y();
				break;

				//Register Instructions
			case 0xAA:
				this.TAX();
				break;
			case 0x8A:
				this.TXA();
				break;
			case 0xCA:
				this.DEX();
				break;
			case 0xE8:
				this.INX();
				break;
			case 0xA8:
				this.TAY();
				break;
			case 0x98:
				this.TYA();
				break;
			case 0x88:
				this.DEY();
				break;
			case 0xC8:
				this.INY();
				break;

				//ROL Instructions
			case 0x2A:
				this.ROL_AC();
				break;
			case 0x26:
				this.ROL_Z();
				break;
			case 0x36:
				this.ROL_Z_X();
				break;
			case 0x2E:
				this.ROL_A();
				break;
			case 0x3E:
				this.ROL_A_X();
				break;


				//ROR Instructions
			case 0x6A:
				this.ROR_AC();
				break;
			case 0x66:
				this.ROR_Z();
				break;
			case 0x76:
				this.ROR_Z_X();
				break;
			case 0x6E:
				this.ROR_A();
				break;
			case 0x7E:
				this.ROR_A_X();
				break;

				//RTI Instructions
			case 0x40:
				this.RTI();
				break;

				//RTS Instructions
			case 0x60:
				this.RTS();
				break;

				//SBC Instructions
			case 0xE9:
				this.SBC_I();
				break;
			case 0xE5:
				this.SBC_Z();
				break;
			case 0xF5:
				this.SBC_Z_X();
				break;
			case 0xED:
				this.SBC_A();
				break;
			case 0xFD:
				this.SBC_A_X();
				break;
			case 0xF9:
				this.SBC_A_Y();
				break;
			case 0xE1:
				this.SBC_I_X();
				break;
			case 0xF1:
				this.SBC_I_Y();
				break;

				//Stack Instructions
			case 0x9A:
				this.TXS();
				break;
			case 0xBA:
				this.TSX();
				break;
			case 0x48:
				this.PHA();
				break;
			case 0x68:
				this.PLA();
				break;
			case 0x08:
				this.PHP();
				break;
			case 0x28:
				this.PLP();
				break;

				//STX Instructions
			case 0x86:
				this.STX_Z();
				break;
			case 0x96:
				this.STX_Z_Y();
				break;
			case 0x8E:
				this.STX_A();
				break;


				//STY Instructions
			case 0x84:
				this.STY_Z();
				break;
			case 0x94:
				this.STY_Z_X();
				break;
			case 0x8C:
				this.STY_A();
				break;

				//Unofficial opcodes
				//http://www.oxyron.de/html/opcodes02.html
			case 0x04:
				this.DOP_Z();
				break;
			case 0x14:
				this.DOP_Z_X();
				break;
			case 0x34:
				this.DOP_Z_X();
				break;
			case 0x44:
				this.DOP_Z();
				break;
			case 0x54:
				this.DOP_Z_X();
				break;
			case 0x64:
				this.DOP_Z();
				break;
			case 0x74:
				this.DOP_Z_X();
				break;
			case 0x80:
				this.DOP_I();
				break;
			case 0x82:
				this.DOP_I();
				break;
			case 0x89:
				this.DOP_I();
				break;
			case 0xC2:
				this.DOP_I();
				break;
			case 0xD4:
				this.DOP_Z_X();
				break;
			case 0xE2:
				this.DOP_I();
				break;
			case 0xF4:
				this.DOP_Z_X();
				break;
			case 0x0C:
				this.TOP_A();
				break;
			case 0x1C:
				this.TOP_A_X();
				break;
			case 0x3C:
				this.TOP_A_X();
				break;
			case 0x5C:
				this.TOP_A_X();
				break;
			case 0x7C:
				this.TOP_A_X();
				break;
			case 0xDC:
				this.TOP_A_X();
				break;
			case 0xFC:
				this.TOP_A_X();
				break;
			case 0x1A:
				this.NOP();
				break;
			case 0x3A:
				this.NOP();
				break;
			case 0x5A:
				this.NOP();
				break;
			case 0x7A:
				this.NOP();
				break;
			case 0xDA:
				this.NOP();
				break;
			case 0xFA:
				this.NOP();
				break;
			case 0x0A7:
				this.LAX_Z();
				break;
			case 0xB7:
				this.LAX_Z_Y();
				break;
			case 0xAF:
				this.LAX_A();
				break;
			case 0xBF:
				this.LAX_A_Y();
				break;
			case 0xA3:
				this.LAX_I_X();
				break;
			case 0xB3:
				this.LAX_I_Y();
				break;
			case 0x87:
				this.SAX_Z();
				break;
			case 0x97:
				this.SAX_Z_Y();
				break;
			case 0x83:
				this.SAX_I_X();
				break;
			case 0x8F:
				this.SAX_A();
				break;
			case 0xEB:
				this.SBC_I();
				break;
			case 0xC7:
				this.DCP_Z();
				break;
			case 0xD7:
				this.DCP_Z_X();
				break;
			case 0xCF:
				this.DCP_A();
				break;
			case 0xDF:
				this.DCP_A_X();
				break;
			case 0xDB:
				this.DCP_A_Y();
				break;
			case 0xC3:
				this.DCP_I_X();
				break;
			case 0xD3:
				this.DCP_I_Y();
				break;
			case 0xE7:
				this.ISB_Z();
				break;
			case 0xF7:
				this.ISB_Z_X();
				break;
			case 0xEF:
				this.ISB_A();
				break;
			case 0xFF:
				this.ISB_A_X();
				break;
			case 0xFB:
				this.ISB_A_Y();
				break;
			case 0xE3:
				this.ISB_I_X();
				break;
			case 0xF3:
				this.ISB_I_Y();
				break;
			case 0x07:
				this.SLO_Z();
				break;
			case 0x17:
				this.SLO_Z_X();
				break;
			case 0x0F:
				this.SLO_A();
				break;
			case 0x1F:
				this.SLO_A_X();
				break;
			case 0x1B:
				this.SLO_A_Y();
				break;
			case 0x03:
				this.SLO_I_X();
				break;
			case 0x13:
				this.SLO_I_Y();
				break;
			case 0x27:
				this.RLA_Z();
				break;
			case 0x37:
				this.RLA_Z_X();
				break;
			case 0x2F:
				this.RLA_A();
				break;
			case 0x3F:
				this.RLA_A_X();
				break;
			case 0x3B:
				this.RLA_A_Y();
				break;
			case 0x23:
				this.RLA_I_X();
				break;
			case 0x33:
				this.RLA_I_Y();
				break;
			case 0x47:
				this.SRE_Z();
				break;
			case 0x57:
				this.SRE_Z_X();
				break;
			case 0x4F:
				this.SRE_A();
				break;
			case 0x5F:
				this.SRE_A_X();
				break;
			case 0x5B:
				this.SRE_A_Y();
				break;
			case 0x43:
				this.SRE_I_X();
				break;
			case 0x53:
				this.SRE_I_Y();
				break;
			case 0x67:
				this.RRA_Z();
				break;
			case 0x77:
				this.RRA_Z_X();
				break;
			case 0x6F:
				this.RRA_A();
				break;
			case 0x7F:
				this.RRA_A_X();
				break;
			case 0x7B:
				this.RRA_A_Y();
				break;
			case 0x63:
				this.RRA_I_X();
				break;
			case 0x73:
				this.RRA_I_Y();
				break;

			default:
				// console.log("Unknown opcode: " + this.currentOpcode.toString('16'));
				// this.errorFlag = true;
				alert('Unknown opcode');
				this.pc++;
				break;
		}
	};

	this.clockPPU = function() {
		// this.scanline_complete = this.nes.PPU.clock();
		if (this.nes.PPU.clock()) {
			if (this.renderedScanline == 260) {
				this.frameCompleted = true;
				this.nes.MMU.setOAMADDR(0);
				return true;
			}
		}
		return false;
	};

	var testClock = 0;
	var testFrameCounter = 0;
	this.clockUnits = function() {
		if (this.frameCompleted)
			this.cyclesToHalt++;
		// this.clockAPU();
		for (var i = 0; i < 3; i++) {
			// testClock++;
			if (this.clockPPU()) {
				this.nes.mainDisplay.updateCanvas();
			}

		}
		this.oddCycle = !this.oddCycle;
	};

	//memory read types--> 0: OpCode/Operand fetch, 1: dummy read, 2: pop stack, 3: increment pc
	this.memoryRead = function(type, location) {
		var retVal = 0;
		this.clockUnits();
		switch (type) {
			case 0:
				retVal = this.nes.MMU.getCpuMemVal(this.pc);
				this.pc++;
				break;
			case 1:
				break;
			case 2:
				retVal = this.popFromStack();
				break;
			case 3:
				this.pc++;
				break;
			case 4:
				retVal = this.nes.MMU.getCpuMemVal(location);
				break;
		}
		return retVal;
	};
	//memory read types--> 0: increment pc
	this.memoryWrite = function(type, location, value) {
		this.clockUnits();
		switch (type) {
			case 0:
				this.pc++;
				break;
			case 1:
				break;
			case 2:
				this.pushToStack(value);
				break;
			case 3:
				this.nes.MMU.setCpuMemVal(location, value);
				break;
		}
	};
	this.IRQToRun = 0;
	this.runIRQ = function() {
		switch (this.IRQToRun) {
			case 1: //NMI
				this.NMI();
				break;
			case 2: //IRQ
				this.IRQ();
				break;
		}
		this.IRQToRun = 0;
	};
	this.execCPU = function() {
		var opCode = this.memoryRead(0, 0);
		this.executeInstruction(opCode);
		if (this.IRQToRun) this.runIRQ();
	};

	this.cyclesToHalt = 0;
	this.newRun = function() {
		this.frameCompleted = false;
		this.renderedScanline = 0;
		while (!this.frameCompleted) {
			if (!this.cyclesToHalt) {
				this.execCPU();
			}
			else {
				this.cyclesToHalt--;
			}
		}
		// testFrameCounter++;
		// if (testFrameCounter == 60) {
		// 	alert("avg clocks passed in a frame: " + testClock / 60);
		// 	testClock = 0;
		// 	testFrameCounter = 0;
		// }

		this.oddFrame = !this.oddFrame;
	};

}
