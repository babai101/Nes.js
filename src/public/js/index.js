import iNES from './iNES';
import mapper from './mapper';
import ppu from './ppu';
import cpu from './cpu';
import mmu from './mmu';
import apu from './apu';
import display from './display';

function NES() {
    
}
NES.iNES = iNES;
NES.mapper = mapper;
NES.ppu = ppu;
NES.cpu = cpu;
NES.mmu = mmu;
NES.apu = apu;
NES.display = display;

if(window !== undefined)
window.NES = NES;