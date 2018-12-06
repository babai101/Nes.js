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
	this.frameCount = 0;
	this.cpuClockRemaining = 0;
	this.elapsedCycles = 0;
	this.skipFrame = false;
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
		// this.pc = 0xC000;//Nestest
	};

	//CPU helper functions
	this.setFlag = function(flagToSet) {
		switch (flagToSet) {
			case 0:
				this.P = this.P & 0b11111110;
				this.P = this.P | 0b00000001;
				break;

			case 1:
				this.P = this.P & 0b11111101;
				this.P = this.P | 0b00000010;
				break;

			case 2:
				this.P = this.P & 0b11111011;
				this.P = this.P | 0b00000100;
				break;

			case 3:
				this.P = this.P & 0b11110111;
				this.P = this.P | 0b00001000;
				break;

			case 4:
				this.P = this.P & 0b10111111;
				this.P = this.P | 0b01000000;
				break;

			case 5:
				this.P = this.P & 0b01111111;
				this.P = this.P | 0b10000000;
				break;
		}
	};
	this.unsetFlag = function(flagToUnset) {
		switch (flagToUnset) {
			case 0:
				this.P = this.P & 0b11111110;
				break;

			case 1:
				this.P = this.P & 0b11111101;
				break;

			case 2:
				this.P = this.P & 0b11111011;
				break;

			case 3:
				this.P = this.P & 0b11110111;
				break;

			case 4:
				this.P = this.P & 0b10111111;
				break;

			case 5:
				this.P = this.P & 0b01111111;
				break;
		}
	};
	this.calcFlags = function(arg, checkOverflow, newValue) {

		//check if overflow flag is to be determined
		if (checkOverflow) {
			if (~(this.accumulator ^ arg) & (this.accumulator ^ newValue) & 0x80)
				this.setFlag(4);
			else
				this.unsetFlag(4);
		}
		else {
			//check for zero flag
			if (arg == null)
				arg = this.accumulator;
			if (arg == 0x00)
				this.setFlag(1);
			else
				this.unsetFlag(1);
			//check for negative flag	
			if ((arg >> 7) == 1)
				this.setFlag(5);
			else
				this.unsetFlag(5);
		}
	};
	this.writeCarry = function(value) {
		if (value > 0xFF) {
			this.setFlag(0);
			value = value & 0xFF;
			return value;
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(5);
		else
			this.unsetFlag(5);

		if (val1 > val2) {
			return 1;
		}
		else if (val1 == val2) {
			this.unsetFlag(5);
			return 0;
		}
		else if (val1 < val2) {
			return -1;
		}
	};
	var printLog = function() {
		var line = "";
		for (var i = 0; i < log.length; i++) {
			line += log[i] + " ";
		}
		console.log(line);
	};
	//Opcode implementaions

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
		this.IRQToRun = 0;
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
		this.IRQToRun = 0;
	};

	this.RTI = function() {
		this.memoryRead(4, this.pc);
		this.memoryRead(1, 0);
		var temp = this.memoryRead(2, 0);
		if ((temp & 1) === 1)
			this.setFlag(0);
		else this.unsetFlag(0);

		if ((temp & 0b00000010) === 0b00000010)
			this.setFlag(1);
		else this.unsetFlag(1);

		if ((temp & 0b00000100) == 0b00000100)
			this.setFlag(2);
		else this.unsetFlag(2);

		if ((temp & 0b00001000) == 0b00001000)
			this.setFlag(3);
		else this.unsetFlag(3);

		if ((temp & 0b01000000) == 0b01000000)
			this.setFlag(4);
		else this.unsetFlag(4);

		if ((temp & 0b10000000) == 0b10000000)
			this.setFlag(5);
		else this.unsetFlag(5);

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
			this.setFlag(0);
		else this.unsetFlag(0);

		if ((temp & 0b00000010) == 0b00000010)
			this.setFlag(1);
		else this.unsetFlag(1);

		if ((temp & 0b00000100) == 0b00000100)
			this.setFlag(2);
		else this.unsetFlag(2);

		if ((temp & 0b00001000) == 0b00001000)
			this.setFlag(3);
		else this.unsetFlag(3);

		if ((temp & 0b01000000) == 0b01000000)
			this.setFlag(4);
		else this.unsetFlag(4);

		if ((temp & 0b10000000) == 0b10000000)
			this.setFlag(5);
		else this.unsetFlag(5);
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
		this.unsetFlag(0);
		this.memoryRead(4, this.pc);
	};
	this.SEC = function() {
		this.setFlag(0);
		this.memoryRead(4, this.pc);
	};
	this.CLI = function() {
		this.unsetFlag(2);
		this.memoryRead(4, this.pc);
	};
	this.SEI = function() {
		this.setFlag(2);
		this.memoryRead(4, this.pc);
	};
	this.CLV = function() {
		this.unsetFlag(4);
		this.memoryRead(4, this.pc);
	};
	this.CLD = function() {
		this.unsetFlag(3);
		this.memoryRead(4, this.pc);
	};
	this.SED = function() {
		this.setFlag(3);
		this.memoryRead(4, this.pc);
	};

	//FIXME
	this.JSR_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		//Transfer next instruction - 1 point to stack
		this.memoryWrite(2, 0, (this.pc - 1) >> 8);
		this.memoryWrite(2, 0, (this.pc - 1) & 0x00FF);
		this.memoryRead(1, 0);
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
		// this.accumulator = this.memoryRead(4, param);
		this.clockUnits();
		this.accumulator = this.nes.MMU.cpuMem[param];
		this.calcFlags(null, false, null);
	};
	this.LDA_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		this.accumulator = this.nes.MMU.cpuMem[param];
		// this.accumulator = this.memoryRead(4, param);
		this.accumulator += this.X;
		this.clockUnits();
		this.accumulator = this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.X)]; //this.memoryRead(4, this.wrap8bit('sum', param, this.X));
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
		this.clockUnits();
		this.X = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.calcFlags(this.X, false, null);
	};
	this.LDX_Z_Y = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		this.X = this.nes.MMU.cpuMem[param] + this.Y; //this.memoryRead(4, param) + this.Y;
		this.clockUnits();
		this.X = this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.Y)]; // this.memoryRead(4, this.wrap8bit('sum', param, this.Y));
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
		this.clockUnits();
		// this.Y = this.memoryRead(4, param);
		this.Y = this.nes.MMU.cpuMem[param];
		this.calcFlags(this.Y, false, null);
	};
	this.LDY_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		this.Y = this.nes.MMU.cpuMem[param] + this.X; //this.memoryRead(4, param) + this.X;
		this.clockUnits();
		this.Y = this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.X)]; //this.memoryRead(4, this.wrap8bit('sum', param, this.X));
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
		this.clockUnits();
		// this.memoryWrite(3, param, this.accumulator);
		this.nes.MMU.cpuMem[param] = this.accumulator;
	};
	this.STA_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		// this.memoryRead(4, param) + this.X;
		this.clockUnits();
		this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.X)] = this.accumulator;
		// this.memoryWrite(3, this.wrap8bit('sum', param, this.X), this.accumulator);
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
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = this.X;
		// this.memoryWrite(3, param, this.X);
	};
	this.STX_Z_Y = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		// this.memoryRead(4, param) + this.Y;
		this.clockUnits();
		// this.memoryWrite(3, this.wrap8bit('sum', param, this.Y), this.X);
		this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.Y)] = this.X;
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
		this.clockUnits();
		// this.memoryWrite(3, param, this.Y);
		this.nes.MMU.cpuMem[param] = this.Y;
	};
	this.STY_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		// this.memoryRead(4, param) + this.X;
		// this.memoryWrite(3, this.wrap8bit('sum', param, this.X), this.Y);
		this.clockUnits();
		this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.X)] = this.Y;
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
		this.clockUnits();
		this.accumulator &= this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.AND_Z_X = function() {
		var param = this.memoryRead(0, 0);
		var temp = this.accumulator;
		this.clockUnits();
		this.accumulator = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.accumulator += this.X;
		this.clockUnits();
		this.accumulator = temp & this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.X)]; //this.memoryRead(4, this.wrap8bit('sum', param, this.X));
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
		this.clockUnits();
		this.accumulator ^= this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.EOR_Z_X = function() {
		var param = this.memoryRead(0, 0);
		var temp = this.accumulator;
		this.clockUnits();
		this.accumulator = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.accumulator += this.X;
		this.clockUnits();
		this.accumulator = temp ^ this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.X)]; //this.memoryRead(4, this.wrap8bit('sum', param, this.X));
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
		this.clockUnits();
		this.accumulator |= this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.calcFlags(null, false, null);
	};
	this.ORA_Z_X = function() {
		var param = this.memoryRead(0, 0);
		var temp = this.accumulator;
		this.clockUnits();
		this.accumulator = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.accumulator += this.X;
		this.clockUnits();
		this.accumulator = temp | this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.X)]; //this.memoryRead(4, this.wrap8bit('sum', param, this.X));
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};
	this.ADC_Z = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		var arg = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		var temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};
	this.ADC_Z_X = function() {
		var param = this.memoryRead(0, 0);
		var tempAcc = this.accumulator;
		this.clockUnits();
		this.accumulator = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.accumulator += this.X;
		this.clockUnits();
		var arg = this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.X)]; //this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var temp = this.to2sComplement(tempAcc) + this.to2sComplement(arg) + (this.P & 0x01);
		if (temp < -128 || temp > 127) {
			this.setFlag(4);
		}
		else this.unsetFlag(4);
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
			this.setFlag(4);
		}
		else this.unsetFlag(4);
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
			this.setFlag(4);
		}
		else this.unsetFlag(4);
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
			this.setFlag(4);
		}
		else this.unsetFlag(4);
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
			this.setFlag(4);
		}
		else this.unsetFlag(4);
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
			this.setFlag(4);
		}
		else this.unsetFlag(4);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
	};
	this.SBC_Z = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		var arg = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		var temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
	};
	this.SBC_Z_X = function() {
		var param = this.memoryRead(0, 0);
		var tempAcc = this.accumulator;
		this.clockUnits();
		this.accumulator = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.accumulator += this.X;
		this.clockUnits();
		var arg = this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.X)]; //this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var temp = tempAcc - arg - (1 - (this.P & 0x01));
		if (
			((tempAcc ^ temp) & 0x80) !== 0 &&
			((tempAcc ^ arg) & 0x80) !== 0
		) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
	};

	this.CMP_I = function() {
		var param = this.memoryRead(0, 0);
		var result = this.compareValsAndSetNegative(this.accumulator, param);
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result === 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};
	this.CMP_Z = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.cpuMem[param]); //this.memoryRead(4, param));
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};
	this.CMP_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		// this.memoryRead(4, param);
		this.clockUnits();
		var result = this.compareValsAndSetNegative(this.accumulator, this.nes.MMU.cpuMem[this.wrap8bit('sum', param, this.X)]); //this.memoryRead(4, this.wrap8bit('sum', param, this.X)));
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};
	this.CMP_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.accumulator, this.memoryRead(4, param));
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
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
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
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
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};
	this.CMP_I_X = function() {
		var param = this.memoryRead(0, 0);
		var tempAcc = this.accumulator;
		this.memoryRead(4, param) + this.X;
		var index1 = this.memoryRead(4, this.wrap8bit('sum', param, this.X));
		var index2 = this.memoryRead(4, this.wrap8bit('sum', param + this.X, 1));
		index2 = index2 << 8;
		var result = this.compareValsAndSetNegative(tempAcc, this.memoryRead(4, index2 | index1));
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
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
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};

	this.CPX_I = function() {
		var param = this.memoryRead(0, 0);
		var result = this.compareValsAndSetNegative(this.X, param);
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};
	this.CPX_Z = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		var result = this.compareValsAndSetNegative(this.X, this.nes.MMU.cpuMem[param]); //this.memoryRead(4, param));
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};
	this.CPX_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.X, this.memoryRead(4, param));
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};

	this.CPY_I = function() {
		var param = this.memoryRead(0, 0);
		var result = this.compareValsAndSetNegative(this.Y, param);
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};
	this.CPY_Z = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		var result = this.compareValsAndSetNegative(this.Y, this.nes.MMU.cpuMem[param]); //this.memoryRead(4, param));
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};
	this.CPY_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var result = this.compareValsAndSetNegative(this.Y, this.memoryRead(4, param));
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
		}
	};

	this.BIT_Z = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		var temp = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		var result = this.accumulator & temp;
		if (result == 0) {
			this.setFlag(1);
		}
		else
			this.unsetFlag(1);

		if ((0b10000000 & temp) == 128) {
			this.setFlag(5);
		}
		else {
			this.unsetFlag(5);
		}
		if ((0b01000000 & temp) == 64) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
	};
	this.BIT_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var temp = this.memoryRead(4, param);
		var result = this.accumulator & temp;
		if (result == 0) {
			this.setFlag(1);
		}
		else
			this.unsetFlag(1);

		if ((0b10000000 & temp) == 128) {
			this.setFlag(5);
		}
		else {
			this.unsetFlag(5);
		}
		if ((0b01000000 & temp) == 64) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
	};

	this.NOP = function() {
		this.memoryRead(4, 0);
	};

	this.ASL_AC = function() {
		if ((this.accumulator >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.accumulator <<= 1;
		this.accumulator &= 0xFF;
		this.calcFlags(null, false, null);
		this.memoryRead(4, this.pc);
	};
	this.ASL_Z = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.ASL_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		// this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[tempAddr]; //this.memoryRead(4, tempAddr);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val;
		// this.memoryWrite(3, tempAddr, val);
		val <<= 1;
		val &= 0xFF;
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val;
		// this.memoryWrite(3, tempAddr, val);
		this.calcFlags(val, false, null);
	};
	this.ASL_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.memoryWrite(3, param, val);
		val <<= 1;
		val &= 0xFF;
		this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.memoryWrite(3, param + this.X, val);
		val <<= 1;
		val &= 0xFF;
		this.memoryWrite(3, param + this.X, val);
		this.calcFlags(val, false, null);
	};

	this.LSR_AC = function() {
		if ((this.accumulator & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.accumulator >>= 1;
		this.calcFlags(null, false, null);
		this.memoryRead(4, this.pc);
	};
	this.LSR_Z = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val >>= 1;
		val &= 0xFF;
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val;
		//this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.LSR_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		// this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[tempAddr]; //this.memoryRead(4, tempAddr);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val; //this.memoryWrite(3, tempAddr, val);
		val >>= 1;
		val &= 0xFF;
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val;
		// this.memoryWrite(3, tempAddr, val);
		this.calcFlags(val, false, null);
	};
	this.LSR_A = function() {
		var param1 = this.memoryRead(0, 0);
		var param2 = this.memoryRead(0, 0);
		param2 = param2 << 8;
		var param = param2 | param1;
		var val = this.memoryRead(4, param);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.memoryWrite(3, param, val);
		val >>= 1;
		val &= 0xFF;
		this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.memoryWrite(3, param + this.X, val);
		val >>= 1;
		val &= 0xFF;
		this.memoryWrite(3, param + this.X, val);
		this.calcFlags(val, false, null);
	};

	this.ROL_AC = function() {
		var currCarry = this.P & 0x01;
		if ((this.accumulator >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[param]; // this.memoryRead(4, param);
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		var currCarry = this.P & 0x01;
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.ROL_Z_X = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		// this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[tempAddr]; //this.memoryRead(4, tempAddr);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val; // this.memoryWrite(3, tempAddr, val);
		val <<= 1;
		val &= 0xFF;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val; //this.memoryWrite(3, tempAddr, val);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.memoryWrite(3, param, val);
		val <<= 1;
		val &= 0xFF;
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.memoryWrite(3, param + this.X, val);
		val <<= 1;
		val &= 0xFF;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param + this.X, val);
		this.calcFlags(val, false, null);
	};

	this.ROR_AC = function() {
		var currCarry = this.P & 0x01;
		if ((this.accumulator & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.ROR_Z_X = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		// this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[tempAddr]; //this.memoryRead(4, tempAddr);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val; //this.memoryWrite(3, tempAddr, val);
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val; //this.memoryWrite(3, tempAddr, val);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		this.memoryWrite(3, param, val);
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		val = this.wrap8bit('increment', val, null);
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.INC_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		// this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[tempAddr]; //this.memoryRead(4, tempAddr);
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val; //this.memoryWrite(3, tempAddr, val);
		val = this.wrap8bit('increment', val, null);
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val; //this.memoryWrite(3, tempAddr, val);
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
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[param]; //this.memoryRead(4, param);
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		val = this.wrap8bit('decrement', val, null);
		this.clockUnits();
		this.nes.MMU.cpuMem[param] = val; //this.memoryWrite(3, param, val);
		this.calcFlags(val, false, null);
	};
	this.DEC_Z_X = function() {
		var param = this.memoryRead(0, 0);
		this.clockUnits();
		// this.memoryRead(4, param);
		var tempAddr = this.wrap8bit('sum', param, this.X);
		this.clockUnits();
		var val = this.nes.MMU.cpuMem[tempAddr]; //this.memoryRead(4, tempAddr);
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val; //this.memoryWrite(3, tempAddr, val);
		val = this.wrap8bit('decrement', val, null);
		this.clockUnits();
		this.nes.MMU.cpuMem[tempAddr] = val; //this.memoryWrite(3, tempAddr, val);
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
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
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
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
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
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
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
		this.memoryWrite(3, param + this.X, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param + this.X, val);
		var result = this.compareValsAndSetNegative(this.accumulator, val);
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
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
		this.memoryWrite(3, param + this.Y, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param + this.Y, val);
		var result = this.compareValsAndSetNegative(this.accumulator, val);
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
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
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
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
		this.memoryWrite(3, param + this.Y, val);
		val = this.wrap8bit('decrement', val, null);
		this.memoryWrite(3, param + this.Y, val);
		var result = this.compareValsAndSetNegative(this.accumulator, val);
		if (result > 0) {
			this.setFlag(0);
			this.unsetFlag(1);
		}
		if (result == 0) {
			this.setFlag(0);
			this.setFlag(1);
		}
		if (result < 0) {
			this.unsetFlag(0);
			this.unsetFlag(1);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
		this.memoryWrite(3, param + this.X, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param + this.X, val);
		var arg = val;
		temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
		this.memoryWrite(3, param + this.Y, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param + this.Y, val);
		var arg = val;
		temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
		this.memoryWrite(3, param + this.Y, val);
		val = this.wrap8bit('increment', val, null);
		this.memoryWrite(3, param + this.Y, val);
		var arg = val;
		var temp = this.accumulator - arg - (1 - (this.P & 0x01));
		if (
			((this.accumulator ^ temp) & 0x80) !== 0 &&
			((this.accumulator ^ arg) & 0x80) !== 0
		) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp < 0 ? 0 : 1) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
		}
		this.accumulator = temp & 0xff;
		this.calcFlags(null, false, null);
	};

	this.SLO_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
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
		this.memoryWrite(3, param + this.X, val);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
		this.memoryWrite(3, param + this.X, val);
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
		this.memoryWrite(3, param + this.Y, val);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
		this.memoryWrite(3, param + this.Y, val);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
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
		this.memoryWrite(3, param + this.Y, val);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
		this.memoryWrite(3, param + this.Y, val);
		this.accumulator |= val;
		this.calcFlags(null, false, null);
	};

	this.SRE_Z = function() {
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
		this.memoryWrite(3, param + this.X, val);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val >>= 1;
		this.memoryWrite(3, param + this.X, val);
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
		this.memoryWrite(3, param + this.Y, val);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val >>= 1;
		this.memoryWrite(3, param + this.Y, val);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
		this.memoryWrite(3, param + this.Y, val);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val >>= 1;
		this.memoryWrite(3, param + this.Y, val);
		this.accumulator ^= val;
		this.calcFlags(null, false, null);
	};

	this.RLA_Z = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
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
		this.memoryWrite(3, param + this.X, val);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param + this.X, val);
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
		this.memoryWrite(3, param + this.Y, val);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param + this.Y, val);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
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
		this.memoryWrite(3, param + this.Y, val);
		if ((val >> 7) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val <<= 1;
		val &= 0xFF;
		if (currCarry == 1) {
			val |= 0b00000001;
		}
		this.memoryWrite(3, param + this.Y, val);
		this.accumulator &= val;
		this.calcFlags(null, false, null);
	};

	this.RRA_Z = function() {
		var currCarry = this.P & 0x01;
		var param = this.memoryRead(0, 0);
		var val = this.memoryRead(4, param);
		this.memoryWrite(3, param, val);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
		this.memoryWrite(3, param + this.X, val);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param + this.X, val);
		var arg = val;
		temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
		this.memoryWrite(3, param + this.Y, val);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param + this.Y, val);
		var arg = val;
		temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
			this.setFlag(0);
		else
			this.unsetFlag(0);
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
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
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
		this.memoryWrite(3, param + this.Y, val);
		if ((val & 0x01) == 1)
			this.setFlag(0);
		else
			this.unsetFlag(0);
		val >>= 1;
		if (currCarry == 1) {
			val |= 0b10000000;
		}
		this.memoryWrite(3, param + this.Y, val);
		var arg = val;
		var temp = this.accumulator + arg + (this.P & 0x01);
		if (
			((this.accumulator ^ arg) & 0x80) === 0 &&
			((this.accumulator ^ temp) & 0x80) !== 0
		) {
			this.setFlag(4);
		}
		else {
			this.unsetFlag(4);
		}
		if (temp > 255 ? 1 : 0) {
			this.setFlag(0);
		}
		else {
			this.unsetFlag(0);
		}
		this.accumulator = temp & 255;
		this.calcFlags(null, false, null);
	};


	var log = [];

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
				console.log('Unknown opcode' + " " + opCode.toString(16).toUpperCase());
				alert('Unknown opcode' + " " + opCode.toString(16).toUpperCase());
				this.pc++;
				break;
		}
	};

	this.clockPPU = function() {
		if (this.nes.PPU.clock()) {
			if (this.renderedScanline == 260) {
				this.frameCompleted = true;
				// this.nes.MMU.setOAMADDR(0);
				return true;
			}
		}
		return false;
	};

	this.ppuClock = 0;
	this.fakeClockPPU = function() {
		this.ppuClock++;
		if (this.ppuClock == 341) {
			this.ppuClock = 0;
			this.renderedScanline++;
			if (this.renderedScanLine == 262)
				this.renderedScanLine = 0;
			if (this.renderedScanline == 241) {
				if (this.nes.PPU.nmi_output) {
					this.IRQToRun = 1;
				}
			}
			if (this.renderedScanline == 260) {
				this.frameCompleted = true;
			}
			return true;
		}
		return false;
	};

	this.clockUnits = function() {
		// this.clockAPU();
		for (var i = 0; i < 3; i++) {
			this.clockPPU();
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
				// log.push(("00" + retVal.toString(16).toUpperCase()).slice(-2));
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
		// this.clockUnits();
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
		// this.clockUnits();
	};
	this.IRQToRun = 0;
	this.runIRQ = function() {
		switch (this.IRQToRun) {
			case 1: //NMI
				this.NMI();
				break;
			case 2: //Immediate NMI
				this.IRQToRun--;
				break;
			case 3: //IRQ
				this.IRQ();
				break;
		}
	};

	this.pushStatusToLog = function() {
		log.push("A:" + ("00" + this.accumulator.toString(16).toUpperCase()).slice(-2));
		log.push("X:" + ("00" + this.X.toString(16).toUpperCase()).slice(-2));
		log.push("Y:" + ("00" + this.Y.toString(16).toUpperCase()).slice(-2));
		log.push("P:" + ("00" + this.P.toString(16).toUpperCase()).slice(-2));
		log.push("SP:" + ("00" + this.sp.toString(16).toUpperCase()).slice(-2));
	};
	this.execCPU = function() {
		// log = [];
		// log.push(("0000" + this.pc.toString(16).toUpperCase()).slice(-4));
		var opCode = this.memoryRead(0, 0);
		// this.pushStatusToLog();
		this.executeInstruction(opCode);
		// printLog();
		if (this.IRQToRun) this.runIRQ();
	};

	this.cyclesToHalt = 0;
	this.frame = function() {
		this.frameCompleted = false;
		this.renderedScanline = 0;
		while (!this.frameCompleted) {
			this.execCPU();
		}
		this.oddFrame = !this.oddFrame;
		this.skipFrame = !this.skipFrame;
	};
}
