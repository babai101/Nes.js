'use strict';
import nes from './nes';

function NES() {
    this.nes = new nes();
}
// NES.nes = nes;

if (window !== undefined)
    window.NES = NES;
