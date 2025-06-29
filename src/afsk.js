import { EventEmitter } from 'events';
import config, { events } from './state.js';
import audioCtx from './audioContext.js';

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

		noise.onaudioprocess = function (e) {
			const outputData = e.outputBuffer.getChannelData(0);
			const l = outputData.length;

			for (let i = 0; i < l; i++) {
				outputData[i] = Math.random() * 2 - 1; // Math.sin(sampleIndex * coefficient);
			}

			if (e.playbackTime <= audioCtx.currentTime) {
				console.log('Audio queue empty');
			}
		};
		// noise.connect(this.output);

		const gain = audioCtx.createGain();
		gain.gain.value = 1;
		this._oscillator.connect(gain).connect(this.output);

		events.on('afskOutput', this._toggleAudioOutput.bind(this));
		this._toggleAudioOutput();
	}

	_toggleAudioOutput() {
		try {
			if (config.afskOutput) {
				this.output.connect(audioCtx.destination);
			} else {
				this.output.disconnect(audioCtx.destination);
			}
		} catch {
			// intentionally ignored
		}
	}

	cleanup() {
		this._oscillator.stop();
		this._oscillator = undefined;
	}

	queue(values) {
		values = values.slice(0).sort((a, b) => a.timestamp - b.timestamp);
		const c = Math.max(this._queueEnd, audioCtx.currentTime + 0.001);

		for (const value of values) {
			this._queueEnd = c + value.timestamp;
			this.setValueAtTime(value.value, this._queueEnd);
		}

		return this._queueEnd;
	}

	_setFrequencyAtTime(frequency, time) {
		this._oscillator.frequency.setValueAtTime(frequency, time);
	}

	setValueAtTime(value, time) {
		if (!Number.isFinite(time)) {
			time = 0;
		}

		let frequency = 0;
		this.currentValue = 0;

		switch (value) {
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
 * Goertzel filter
 */
function goertzelFilter(f, N) {
	const buffer = new Array(N);

	for (let i = 0; i < N; i++) {
		buffer[i] = 0;
	}

	const realW = 2 * Math.cos(2 * Math.PI * f);
	const imagW = Math.sin(2.0 * Math.PI * f);

	let offset = 0;

	return sample => {
		buffer[offset] = sample;
		let Skn = 0;
		let Skn1 = 0;
		let Skn2 = 0;

		for (let i = 0; i < N; i++) {
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

		const markFilter = goertzelFilter(normalizedMark, 240);
		const spaceFilter = goertzelFilter(normalizedSpace, 240);

		this._processor = audioCtx.createScriptProcessor(null, 1, 1);

		this._processor.onaudioprocess = function (e) {
			const input = e.inputBuffer.getChannelData(0);
			const markOutput = new Array(this.bufferSize);
			const spaceOutput = new Array(this.bufferSize);
			const fskSamples = new Array(this.bufferSize);

			for (let i = 0; i < input.length; i++) {
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
		if (!(source instanceof AudioNode)) {
			throw new Error('Argument is not AudioNode');
		}

		if (this._source) {
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
		ctx.moveTo(
			(samples[0].time - time + period) * pixelsPerMillisecond,
			halfHeight + samples[0].value
		);
		for(const sample of samples) {
			ctx.lineTo((sample.time - time + period) * pixelsPerMillisecond, halfHeight + sample.value);
		}
		ctx.stroke();
	}

	requestAnimationFrame(draw);
}

draw(); */

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

	for (const sample of spaceSamples) {
		const abs = sample > 0 ? sample : -sample;

		if (abs > max) {
			max = abs;
		}
	}

	for (const sample of markSamples) {
		const abs = sample > 0 ? sample : -sample;

		if (abs > max) {
			max = abs;
		}
	}

	const coeff = halfHeight / max;

	ctx.beginPath();
	ctx.strokeStyle = 'red';
	ctx.moveTo(0, halfHeight);

	for (let i = 0, l = spaceSamples.length; i < l; i++) {
		ctx.lineTo(i * pixelsPerSample, halfHeight - spaceSamples[i] * coeff);
	}

	ctx.stroke();

	ctx.beginPath();
	ctx.strokeStyle = 'blue';
	ctx.moveTo(0, halfHeight);

	for (let i = 0, l = markSamples.length; i < l; i++) {
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

	for (let i = 0, l = samples.length; i < l; i++) {
		// eslint-disable-next-line no-nested-ternary
		ctx.lineTo(i * pixelsPerSample, samples[i] > 0 ? 0 : (samples[i] < 0 ? e.height : halfHeight));
	}

	ctx.stroke();

	ctx.beginPath();
	ctx.strokeStyle = 'blue';
	ctx.moveTo(0, halfHeight);

	for (let i = 0, l = samples.length; i < l; i++) {
		ctx.lineTo(i * pixelsPerSample, halfHeight - samples[i]);
	}

	ctx.stroke();
}
