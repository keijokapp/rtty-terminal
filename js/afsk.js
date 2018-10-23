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
			if(e.playbackTime <= audioCtx.currentTime) {
				console.log('Audio queue empty');
			}
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
			case 1:
				this.currentValue = 1;
				frequency = config.afskFrq - config.afskShift / 2;
				break;
			case -1:
				this.currentValue = -1;
				frequency = config.afskFrq + config.afskShift / 2;
				break;
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

	console.log('Butterworth bandpass coefficients:\n%f %f %f %f', d1, d2, d3, d4);

	var x0, x1, x2, x3, x4;
	var y0, y1, y2, y3, y4;
	x0 = x1 = x2 = x3 = 0;
	y0 = y1 = y2 = y3 = 0;

	return sample => {
		x4 = x3;
		x3 = x2;
		x2 = x1;
		x1 = x0;
		x0 = sample;
		y4 = y3;
		y3 = y2;
		y2 = y1;
		y1 = y0;
		y0 = x4 - 2 * x1 + x0
			+ d4 * y4 + d3 * y3
			+ d2 * y2 + d1 * y1;

		return y0;
	};
}


/**
 * Bandpass second-order biquad filter
 * @unused
 * @param f {number} Ceter frequency
 * @param q {number} Q value
 * @returns {function} Sample processor
 */
function biquadFilter(f, q) {
	const K = Math.tan(Math.PI * f);
	const norm = 1 / (1 + K / q + K * K);
	const a0 = K / q * norm;
	const a1 = 0;
	const a2 = -a0;
	const b1 = 2 * (K * K - 1) * norm;
	const b2 = (1 - K / q + K * K) * norm;
	let z1 = 0, z2 = 0;
	return sample => {
		const out = sample * a0 + z1;
		z1 = sample * a1 + z2 - b1 * out;
		z2 = sample * a2 - b2 * out;
		return out;
	};
}


/**
 * Lowpass second-order butterworth filter
 * @param f {number} Cutoff frequency
 * @returns {function} Sample processor
 */
function lowpassFilter(f) {

	const q = Math.sqrt(2.0);
	const K = 1 / Math.tan(Math.PI * f);
	const b0 = 1 / (1 + q * K + K * K);
	const b1 = 2 * b0;
	const b2 = b0;
	const d1 = 2 * (K * K - 1) * b0;
	const d2 = -(1 - q * K + K * K) * b0;

	console.log('Butterworth lowpass coefficients:\n%f %f', d1, d2);

	var x0, x1, x2;
	var y0, y1, y2;
	x0 = x1 = 0;
	y0 = y1 = 0;

	return sample => {
		x2 = x1;
		x1 = x0;
		x0 = sample;
		y2 = y1;
		y1 = y0;
		y0 = x2 + 2 * x1 + x0
			+ d2 * y2 + d1 * y1;
		return y0;
	};
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
	let z1 = 0, z2 = 0;
	return sample => {
		const out = sample * a0 + z1;
		z1 = sample * a1 + z2 - b1 * out;
		z2 = sample * a2 - b2 * out;
		return out;
	};
}


/**
 * Goertzel filter
 */
function goertzelFilter(f, N) {
	const buffer = new Array(N);
	for(let i = 0; i < N; i++) {
		buffer[i] = 0;
	}

	const realW = 2 * Math.cos(2 * Math.PI * f);
	const imagW = Math.sin(2.0 * Math.PI * f);

	let offset = 0;

	return sample => {
		buffer[offset] = sample;
		let Skn = 0, Skn1 = 0, Skn2 = 0;
		for(let i = 0; i < N; i++) {
			const sample = buffer[(offset + i) % N];
			Skn2 = Skn1;
			Skn1 = Skn;
			Skn = realW * Skn1 - Skn2 + sample;
		}
		offset = (offset + 1) % N;
		const resultr = 0.5 * realW * Skn1 - Skn2;
		const resulti = imagW * Skn1;
		return Math.sqrt(resultr * resultr + resulti * resulti);
	};
}


export class AFSKDekeyer extends EventEmitter {

	/**
	 * @constructor
	 */
	constructor() {
		super();

		this._source = null;

		console.log('Low frequency: %d', config.afskFrq - config.afskShift / 2);
		console.log('High frequency: %d', config.afskFrq + config.afskShift / 2);

		const normalizedMark = (config.afskFrq - config.afskShift / 2) / audioCtx.sampleRate;
		const normalizedSpace = (config.afskFrq + config.afskShift / 2) / audioCtx.sampleRate;

		const size = 5 / audioCtx.sampleRate;
		const gain = 8.7e7;

//		const markFilter = bandpassFilter(normalizedMark - size, normalizedMark + size);
//		const spaceFilter = bandpassFilter(normalizedSpace - size, normalizedSpace + size);
		const markFilter = goertzelFilter(normalizedMark, 240);
		const spaceFilter = goertzelFilter(normalizedSpace, 240);
//		const markFilter = goertzelFilter(normalizedMark);
//		const spaceFilter = goertzelFilter(normalizedSpace);
		const lpFilter = lowpassFilter2(1000 / audioCtx.sampleRate, 9e100);

		this._processor = audioCtx.createScriptProcessor(null, 1, 1);
		this._processor.onaudioprocess = function(e) {
			const input = e.inputBuffer.getChannelData(0);
			const markOutput = new Array(this.bufferSize);
			const spaceOutput = new Array(this.bufferSize);
			const fskSamples = new Array(this.bufferSize);

			for(let i = 0; i < input.length; i++) {
				markOutput[i] = markFilter(input[i]);
				spaceOutput[i] = spaceFilter(input[i]);
				fskSamples[i] = markOutput[i] - spaceOutput[i];
			}

			drawFilters(spaceOutput, markOutput);
			drawFskSamples(fskSamples);
		};

		// Workaround for Webkit/Blink issue 327649
		// https://bugs.chromium.org/p/chromium/issues/detail?id=327649
		const dummyDestination = audioCtx.createMediaStreamDestination();
		this._processor.connect(dummyDestination);
	}

	setSource(source) {
		if(!(source instanceof AudioNode)) {
			throw new Error('Argument is not AudioNode');
		}

		if(this._source) {
			this._source.disconnect(this._processor);
		}

		this._source = source;

		source.connect(this._processor);
	}
}

/*
const samples = [];
const period = 3000; // in milliseconds

function draw() {

	const time = performance.now();

	// GC old data
	let gcSize = 0;
	while(samples[gcSize] && samples[gcSize].time < time - period) {
		gcSize++;
	}
	samples.splice(0, gcSize);

	const e = document.getElementById('fsk-samples');
	const halfHeight = e.height / 2;
	const pixelsPerMillisecond = e.width / period;

	const ctx = e.getContext('2d');
	ctx.clearRect(0, 0, e.width, e.height);
	ctx.beginPath();
	ctx.strokeStyle = 'gray';
	ctx.moveTo(0, e.height / 2);
	ctx.lineTo(e.width, e.height / 2);
	ctx.stroke();
	if(samples[0]) {
		ctx.strokeStyle = 'blue';
		ctx.beginPath();
		ctx.moveTo((samples[0].time - time + period) * pixelsPerMillisecond, halfHeight + samples[0].value);
		for(const sample of samples) {
			ctx.lineTo((sample.time - time + period) * pixelsPerMillisecond, halfHeight + sample.value);
		}
		ctx.stroke();
	}

	requestAnimationFrame(draw);
}

draw();*/


function drawFilters(spaceSamples, markSamples) {
	const e = document.getElementById('mark-filter');
	const halfHeight = e.height / 2;

	const ctx = e.getContext('2d');
	ctx.clearRect(0, 0, e.width, e.height);
	ctx.beginPath();
	ctx.strokeStyle = 'gray';
	ctx.moveTo(0, halfHeight);
	ctx.lineTo(e.width, halfHeight);
	ctx.stroke();

	const pixelsPerSample = e.width / spaceSamples.length;

	let max = 0;
	for(const sample of spaceSamples) {
		const abs = sample > 0 ? sample : -sample;
		if(abs > max) max = abs;
	}

	for(const sample of markSamples) {
		const abs = sample > 0 ? sample : -sample;
		if(abs > max) max = abs;
	}

	const coeff = halfHeight / max;

	ctx.beginPath();
	ctx.strokeStyle = 'red';
	ctx.moveTo(0, halfHeight);
	for(let i = 0, l = spaceSamples.length; i < l; i++) {
		ctx.lineTo(i * pixelsPerSample, halfHeight - spaceSamples[i] * coeff);
	}
	ctx.stroke();

	ctx.beginPath();
	ctx.strokeStyle = 'blue';
	ctx.moveTo(0, halfHeight);
	for(let i = 0, l = markSamples.length; i < l; i++) {
		ctx.lineTo(i * pixelsPerSample, halfHeight - markSamples[i] * coeff);
	}
	ctx.stroke();

}


function drawFskSamples(samples) {
	const e = document.getElementById('fsk-samples');
	const halfHeight = e.height / 2;

	const ctx = e.getContext('2d');
	ctx.clearRect(0, 0, e.width, e.height);
	ctx.beginPath();
	ctx.strokeStyle = 'gray';
	ctx.moveTo(0, halfHeight);
	ctx.lineTo(e.width, halfHeight);
	ctx.stroke();

	const pixelsPerSample = e.width / samples.length;

	ctx.beginPath();
	ctx.strokeStyle = 'red';
	ctx.moveTo(0, halfHeight);
	for(let i = 0, l = samples.length; i < l; i++) {
		ctx.lineTo(i * pixelsPerSample, samples[i] > 0 ? 0 : (samples[i] < 0 ? e.height : halfHeight));
	}
	ctx.stroke();

	ctx.beginPath();
	ctx.strokeStyle = 'blue';
	ctx.moveTo(0, halfHeight);
	for(let i = 0, l = samples.length; i < l; i++) {
		ctx.lineTo(i * pixelsPerSample, halfHeight - samples[i]);
	}
	ctx.stroke();
}
