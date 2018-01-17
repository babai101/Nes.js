function iNES(nes) {
    this.nes = nes;
    this.headers = []; //hold 16 byte iNES headers
    this.prgRomUnits;
    this.chrRomUnits = 1;
    this.prgRamUnits = 1;
    this.mirroring;
    this.batBackedPrg = false;
    this.trainer = false;
    this.ignoreMirrorin = false;
    this.mapperLowBits;
    this.mapperHighBits;
    this.vsUnisystem = false;
    this.nes20format = false;
    this.tvSystem = 'NTSC';
    this.cyclesPerScanLine = 341;

    this.parseHeaders = function() {
        if (this.headers[0] == 0x4E)
            if (this.headers[1] == 0x45)
                if (this.headers[2] == 0x53)
                    if (this.headers[3] == 0x1A)
                        console.log("proper iNES header found");

        this.prgRomUnits = this.headers[4];
        this.chrRomUnits = this.headers[5];
        this.flag6 = this.headers[6];
        this.flag7 = this.headers[7];
        if (this.headers[8] != 0)
            this.prgRamUnits = this.headers[8];
        this.flag9 = this.headers[9];
        this.flag10 = this.headers[10];

        //flag 6 bit map
        // 76543210
        // ||||||||
        // |||||||+- Mirroring: 0: horizontal (vertical arrangement) (CIRAM A10 = PPU A11)
        // |||||||              1: vertical (horizontal arrangement) (CIRAM A10 = PPU A10)
        // ||||||+-- 1: Cartridge contains battery-backed PRG RAM ($6000-7FFF) or other persistent memory
        // |||||+--- 1: 512-byte trainer at $7000-$71FF (stored before PRG data)
        // ||||+---- 1: Ignore mirroring control or above mirroring bit; instead provide four-screen VRAM
        // ++++----- Lower nybble of mapper number
        if ((this.flag6 & 0x01) == 1) {
            this.mirroring = 'vertical';
        }
        else
            this.mirroring = 'horizontal';

        if (((this.flag6 >> 1) & 0x01) == 1) {
            this.batBackedPrg = true;
        }

        if (((this.flag6 >> 2) & 0x01) == 1) {
            this.trainer = true;
        }

        if (((this.flag6 >> 3) & 0x01) == 1) {
            this.ignoreMirroring = true;
        }

        this.mapperLowBits = this.flag6 >> 4;

        //Flag 7 bit map
        // 76543210
        // ||||||||
        // |||||||+- VS Unisystem
        // ||||||+-- PlayChoice-10 (8KB of Hint Screen data stored after CHR data)
        // ||||++--- If equal to 2, flags 8-15 are in NES 2.0 format
        // ++++----- Upper nybble of mapper number

        if ((this.flag7 & 0x01) == 1) {
            this.vsUnisystem = true;
        }

        if (((this.flag7 >> 1) & 0x01) == 1) {
            this.playChoice10 = true;
        }

        if (((this.flag7 >> 2) & 0x03) == 2) {
            this.nes20format = true;
        }

        this.mapperHighBits = this.flag7 >> 4;
        this.mapperNum =  (this.mapperHighBits << 4) | this.mapperLowBits;
        //Flag 9 bit map
        // 76543210
        // ||||||||
        // |||||||+- TV system (0: NTSC; 1: PAL)
        // +++++++-- Reserved, set to zero
        if ((this.flag9 & 0x01) == 1) {
            this.tvSystem = 'PAL';
        }
        else
            this.tvSystem = 'NTSC';

    };

    this.setFlags = function() {

    };

    this.parseRom = function(romBytes) {
        for (var i = 0; i < 16; i++) {
            this.headers.push(romBytes[i]);
        }
        this.parseHeaders();
        this.nes.Mapper.loadRom(romBytes);
        this.setFlags();
    };
}
