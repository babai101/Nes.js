// AudioWorklet processor for the NES APU.
//
// Runs on the browser's audio thread. The emulator (main thread) posts
// batches of samples to it; this processor plays them back from a ring
// buffer.
//
// The emulator's frame rate is set by requestAnimationFrame, so samples
// don't arrive at exactly the rate the audio device plays them. To keep the
// buffer (and so the audio delay) steady, playback runs up to 0.5% faster
// when the buffer is above its target size and up to 0.5% slower when it is
// below. A 0.5% pitch change is far too small to hear.
//
// This file is loaded with audioWorklet.addModule(), not bundled by webpack.
'use strict';

var BUFFER_SIZE = 16384;     // ring buffer capacity (~370 ms at 44.1 kHz)
var TARGET = 2048;           // samples to keep queued (~46 ms): about 3 video frames
var MAX_QUEUED = TARGET * 4; // above this, drop old samples to cut the delay
var MAX_RATE_ADJUST = 0.005; // play at most 0.5% faster or slower
var RATE_GAIN = 0.02;        // speed change per unit of buffer error; high enough that the
                             // buffer settles within a few % of TARGET

class NesAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buf = new Float32Array(BUFFER_SIZE);
        this.readPos = 0;      // index of the next sample to play
        this.writePos = 0;     // index where the next incoming sample goes
        this.count = 0;        // samples queued
        this.frac = 0;         // fractional position between buf[readPos] and the next sample
        this.playing = false;  // false while (re)filling the buffer up to TARGET
        this.lastSample = 0;
        this.underruns = 0;

        this.port.onmessage = (e) => {
            var msg = e.data;
            if (msg instanceof Float32Array) {
                this.push(msg);
            }
            else if (msg === 'stats') {
                this.port.postMessage({ queued: this.count, underruns: this.underruns });
            }
        };
    }

    push(samples) {
        for (var i = 0; i < samples.length; i++) {
            if (this.count === BUFFER_SIZE) {
                // full: drop the oldest sample
                this.readPos = (this.readPos + 1) % BUFFER_SIZE;
                this.count--;
            }
            this.buf[this.writePos] = samples[i];
            this.writePos = (this.writePos + 1) % BUFFER_SIZE;
            this.count++;
        }
        // If a lot has piled up (e.g. the tab was busy), skip ahead so the
        // sound doesn't lag behind the picture.
        if (this.count > MAX_QUEUED) {
            var drop = this.count - TARGET;
            this.readPos = (this.readPos + drop) % BUFFER_SIZE;
            this.count -= drop;
        }
    }

    process(inputs, outputs) {
        var out = outputs[0][0];

        if (!this.playing) {
            if (this.count >= TARGET) {
                this.playing = true;
            }
            else {
                // Still filling up: fade towards silence from the last sample
                // so a pause doesn't click.
                for (var j = 0; j < out.length; j++) {
                    this.lastSample *= 0.995;
                    out[j] = this.lastSample;
                }
                return true;
            }
        }

        // Nudge the playback speed to keep the buffer near TARGET.
        var error = (this.count - TARGET) / TARGET;
        var rate = 1 + Math.max(-MAX_RATE_ADJUST, Math.min(MAX_RATE_ADJUST, error * RATE_GAIN));

        for (var i = 0; i < out.length; i++) {
            if (this.count < 2) {
                // Ran dry: hold the last sample and refill before playing again.
                this.underruns++;
                this.playing = false;
                for (; i < out.length; i++) {
                    this.lastSample *= 0.995;
                    out[i] = this.lastSample;
                }
                break;
            }
            // Linear interpolation between the current and next sample.
            var a = this.buf[this.readPos];
            var b = this.buf[(this.readPos + 1) % BUFFER_SIZE];
            var s = a + (b - a) * this.frac;
            out[i] = s;
            this.lastSample = s;

            this.frac += rate;
            while (this.frac >= 1) {
                this.frac -= 1;
                this.readPos = (this.readPos + 1) % BUFFER_SIZE;
                this.count--;
            }
        }

        // Copy to any other output channels (stereo devices).
        for (var c = 1; c < outputs[0].length; c++) {
            outputs[0][c].set(out);
        }
        return true;
    }
}

registerProcessor('nes-audio', NesAudioProcessor);
