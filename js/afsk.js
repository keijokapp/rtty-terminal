import { EventEmitter } from 'events';
import config, { events } from './state';
import audioCtx from './audioContext';

// encoder

// class AFSKKeyer implementes Keyer
export class AFSKKeyer {

	constructor() {

		this._oscillator = audioCtx.createOscillator();
		this._oscillator.frequency.value = 0;
		this._oscillator.start();

		this.currentValue = 0;
		this._queueEnd = 0;

		// Noise generator
		this.output = audioCtx.createChannelMerger(2);

		const noise = audioCtx.createScriptProcessor(null, 1, 1);
		noise.onaudioprocess = function(e) {
			const outputData = e.outputBuffer.getChannelData(0);
			const l = outputData.length;
			for(let i = 0; i < l; i++) {
				outputData[i] = Math.random() * 2 - 1; //Math.sin(sampleIndex * coefficient);
			}
			if(e.playbackTime <= audioCtx.currentTime) console.log('Audio queue empty');
		};
//		noise.connect(this.output);

		const gain = audioCtx.createGain();
		gain.gain.value = 1;
		this._oscillator.connect(gain).connect(this.output);

		events.on('afskOutput', this._toggleAudioOutput.bind(this));
		this._toggleAudioOutput();
	}

	_toggleAudioOutput() {
		try {
			if(config.afskOutput) {
				this.output.connect(audioCtx.destination);
			} else {
				this.output.disconnect(audioCtx.destination);
			}
		} catch(e) {
			// intentionally ignored
		}
	}

	cleanup() {
		this._oscillator.stop();
		this._oscillator = undefined;
	}

	queue(values) {
		values = values.slice(0).sort((a, b) => a.timestamp - b.timestamp);
		const c = Math.max(this._queueEnd, audioCtx.currentTime + .001);
		for(const value of values) {
			this._queueEnd = c + value.timestamp;
			this.setValueAtTime(value.value, this._queueEnd);
		}

		return this._queueEnd;
	}

	_setFrequencyAtTime(frequency, time) {
		this._oscillator.frequency.setValueAtTime(frequency, time);
	}

	setValueAtTime(value, time) {
		if(!Number.isFinite(time)) {
			time = 0;
		}
		var frequency = 0;
		this.currentValue = 0;
		switch(value) {
		case 1: this.currentValue = 1; frequency = config.afskFrq - config.afskShift / 2; break;
		case -1: this.currentValue = -1; frequency = config.afskFrq + config.afskShift / 2; break;
		}
		this._oscillator.frequency.setValueAtTime(frequency, time);
	}
}



// decoder

/**
 * Bandpass second-order butterworth filter
 * @param f1 {number} Low cutoff frequency
 * @param f2 {number} High cutoff frequency
 * @returns {function} Sample processor
 */
function bandpassFilter(f1, f2) {

	const a = Math.cos(Math.PI * (f2 + f1)) / Math.cos(Math.PI * (f2 - f1));
	const a2 = a * a;
	const b = Math.tan(Math.PI * (f2 - f1));
	const b2 = b * b;

	const r = Math.sin(Math.PI / 4);
	const s = b2 + 2.0 * b * r + 1.0;
	const d1 = 4.0 * a * (1.0 + b * r) / s;
	const d2 = 2.0 * (b2 - 2.0 * a2 - 1.0) / s;
	const d3 = 4.0 * a * (1.0 - b * r) / s;
	const d4 = -(b2 - 2.0 * b * r + 1.0) / s;

	console.log("Butterworth bandpass coefficients:\n%f %f %f %f", d1, d2, d3, d4)

	var x0, x1, x2, x3, x4;
	var y0, y1, y2, y3, y4;
	x0 = x1 = x2 = x3 = 0;
	y0 = y1 = y2 = y3 = 0;

	return sample => {
		x4 = x3; x3 = x2; x2 = x1; x1 = x0;
		x0 = sample;
		y4 = y3; y3 = y2; y2 = y1; y1 = y0;
		y0 = x4 - 2 * x1 + x0
		   + d4 * y4 + d3 * y3
		   + d2 * y2 + d1 * y1;

		return y0;
	}
}


/**
 * Bandpass second-order biquad filter
 * @unused
 * @param f {number} Ceter frequency
 * @param q {number} Q value
 * @returns {function} Sample processor
 */
function bandpassFilter2(f, q) {

	const K = Math.tan(Math.PI * f);
	const norm = 1 / (1 + K / q + K * K);
	const a0 = K / q * norm;
	const a1 = 0;
	const a2 = -a0;
	const b1 = 2 * (K * K - 1) * norm;
	const b2 = (1 - K / q + K * K) * norm;

	var z1, z2;
	z1 = z2 = 0;

	return sample => {
		const out = sample * a0 + z1;
		z1 = sample * a1 + z2 - b1 * out;
		z2 = sample * a2 - b2 * out;
		return out;
	}
}


/**
 * Lowpass second-order butterworth filter
 * @param f {number} Cutoff frequency
 * @returns {function} Sample processor
 */
function lowpassFilter(f) {

  const ita = 1.0 / Math.tan(Math.PI * f);
  const q = Math.sqrt(2.0);
	const b0 = 1.0 / (1.0 + q * ita + ita * ita);
	const b1 = 2*b0;
	const b2 = b0;
	const d1 = 2.0 * (ita * ita - 1.0) * b0;
	const d2 = -(1.0 - q * ita + ita * ita) * b0;

	console.log("Butterworth lowpass coefficients:\n%f %f", d1, d2);

	var x0, x1, x2;
	var y0, y1, y2;
	x0 = x1 = 0;
	y0 = y1 = 0;

	return sample => {
		x2 = x1; x1 = x0; 
		x0 = sample;
		y2 = y1; y1 = y0;
		y0 = x2 + 2 * x1 + x0
       + d2 * y2 + d1 * y1;
		return y0;
	}
}


/**
 * Lowpass second-order biquad filter
 * @unused
 * @param f {number} Cutoff frequency
 * @param q {number} Q value
 * @returns {function} Sample processor
 */
function lowpassFilter2(f, q) {

	const K = Math.tan(Math.PI * f);
	const norm = 1 / (1 + K / q + K * K);
	const a0 = K * K * norm;
	const a1 = 2 * a0;
	const a2 = a0;
	const b1 = 2 * (K * K - 1) * norm;
	const b2 = (1 - K / q + K * K) * norm;

	var z1, z2;
	z1 = z2 = 0;

	return sample => {
		const out = sample * a0 + z1;
		z1 = sample * a1 + z2 - b1 * out;
		z2 = sample * a2 - b2 * out;
		return out;
	}
}


/**
 * FSK signal extractor
 * @param filter {AudioNode} AudioNode with two outputs (mark and space filters)
 * @returns eventEmitter {EventEmitter} Object to emit events
 */
function processor(filter, eventEmitter) {

	const deferZeroTime = filter.context.sampleRate / 200; // 5ms

	var sampleCounter = 0;
	var lastValue = NaN;
	var zeroStart = NaN;

	const lpFilter = lowpassFilter(50 / filter.context.sampleRate, 1);
	const processor = audioCtx.createScriptProcessor(null, 2, 1);

	processor.onaudioprocess = function onaudioprocess(e) {
		const markInput = e.inputBuffer.getChannelData(0);
		const spaceInput = e.inputBuffer.getChannelData(1);

		for(let i = 0; i < this.bufferSize; i++) {

			const sample = lpFilter(markInput[i] * markInput[i] - spaceInput[i] * spaceInput[i]); 

			const currentValue = sample > 0 ? 1 : (sample < 0 ? -1 : 0);

			if(currentValue === 0) {
				if(!zeroStart) {
					zeroStart = sampleCounter;
				} else if(lastValue !== 0 && sampleCounter - zeroStart > deferZeroTime) {
					eventEmitter.emit('change', currentValue, zeroStart, e.timeStamp);
					lastValue = currentValue;
				}
			} else {
				if(currentValue !== lastValue) {
					eventEmitter.emit('change', currentValue, zeroStart || sampleCounter, e.timeStamp + i * 1000 / audioCtx.sampleRate);
					lastValue = currentValue;
				}
				zeroStart = NaN;
			}
			if(eventEmitter._events[sampleCounter]) {
				eventEmitter.emit('' + sampleCounter, currentValue, sampleCounter);
			}

			sampleCounter++;
		}
	};

	filter.connect(processor);

	// Workaround for Webkit/Blink issue 327649
	// https://bugs.chromium.org/p/chromium/issues/detail?id=327649
	const dummyDestination = audioCtx.createMediaStreamDestination();
	processor.connect(dummyDestination);

	return processor;
}


export class AFSKDekeyer extends EventEmitter {

	/**
	 * @constructor
	 */
	constructor() {
		super();

		this._source = null;
		this.currentValue = 0;

		this.on('change', value => {
			this.currentValue = value;
		});

		console.log('Low frequency: %d', config.afskFrq - config.afskShift / 2);
		console.log('High frequency: %d', config.afskFrq + config.afskShift / 2);

		const normalizedMark = (config.afskFrq - config.afskShift / 2) / audioCtx.sampleRate;
		const normalizedSpace = (config.afskFrq + config.afskShift / 2) / audioCtx.sampleRate;

		const size = 5 / audioCtx.sampleRate;
		const gain = 8.7e7;

		const markFilter = bandpassFilter(normalizedMark - size, normalizedMark + size);
		const spaceFilter = bandpassFilter(normalizedSpace - size, normalizedSpace + size);

		this._bandpass = audioCtx.createScriptProcessor(null, 1, 2);
		this._bandpass.onaudioprocess = function(e) {
			const input = e.inputBuffer.getChannelData(0);
			const markOutput = e.outputBuffer.getChannelData(0);
			const spaceOutput = e.outputBuffer.getChannelData(1);

			for(let i = 0; i < input.length; i++) {
				markOutput[i] = markFilter(input[i] / gain);
				spaceOutput[i] = spaceFilter(input[i] / gain);
			}
		}

		processor(this._bandpass, this);
	}

	setSource(source) {
		if(!(source instanceof AudioNode)) {
			throw new Error('Argument is not AudioNode');
		}

		if(this._source) {
			this._source.disconnect(this._bandpass);
		}

		this._source = source;

		source.connect(this._bandpass);
	}
}
