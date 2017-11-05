import { EventEmitter } from 'events';
import config, { events } from './state';
import audioCtx from './audioContext';
import { bandpassButterworthFilter
       , lowpassButterworthFilter
       , bandpassFirFilter
       , tandemRTgoertzelFilter
       , goertzelFilter } from './filter';

// encoder

export class AFSKKeyer {

	constructor() {

		this.output = audioCtx.createChannelMerger(2);

		this._oscillator = audioCtx.createOscillator();
		this._oscillator.start();

		this._gain = audioCtx.createGain();
		this._gain.gain.value = 0;
		this._oscillator.connect(this._gain).connect(this.output);

		this.currentValue = 0;
		this._queueEnd = 0;

		// Noise generator
		const noise = audioCtx.createScriptProcessor(null, 1, 1);
		noise.onaudioprocess = function(e) {
			const outputData = e.outputBuffer.getChannelData(0);
			const l = outputData.length;
			for(let i = 0; i < l; i++) {
				outputData[i] = Math.random() * 2 - 1;
			}
			if(e.playbackTime <= audioCtx.currentTime) console.log('Audio queue empty');
		};
//		noise.connect(this.output);


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
			console.error(e);
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
		if(frequency) {
			this._oscillator.frequency.setValueAtTime(frequency, time);
			this._gain.gain.setValueAtTime(1, time);
		} else {
			this._gain.gain.setValueAtTime(0, time);
		}
	}

	setValueAtTime(value, time) {
		if(!Number.isFinite(time)) {
			time = 0;
		}

		switch(value) {
		case 1:
			this.currentValue = 1;
			this._setFrequencyAtTime(config.afskFrq - config.afskShift / 2, time);
			break;
		case -1:
			this.currentValue = -1;
			this._setFrequencyAtTime(config.afskFrq + config.afskShift / 2, time);
			break;
		default:
			this.currentValue = 0;
			this._setFrequencyAtTime(0, time);
		}
	}
}



// decoder

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

	const lpFilter = lowpassButterworthFilter(50 / filter.context.sampleRate, 1);
	const processor = audioCtx.createScriptProcessor(null, 2, 1);

	processor.onaudioprocess = function onaudioprocess(e) {
		const markInput = e.inputBuffer.getChannelData(0);
		const spaceInput = e.inputBuffer.getChannelData(1);

		for(let i = 0; i < this.bufferSize; i++) {

			const sample = markInput[i] - spaceInput[i]; //lpFilter(markInput[i] * markInput[i] - spaceInput[i] * spaceInput[i]); 

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

/*
		const markFilter = bandpassButterworthFilter(normalizedMark - size, normalizedMark + size);
		const spaceFilter = bandpassButterworthFilter(normalizedSpace - size, normalizedSpace + size);
*/
		const n = 48 * 3;
		const markFilter = goertzelFilter(normalizedMark, n);
		const spaceFilter = goertzelFilter(normalizedSpace, n);

		const canvasMarkInput = document.getElementById('mark-input');
		const canvasSpaceInput = document.getElementById('space-input');
		const canvasMarkFft = document.getElementById('mark-fft');
		const canvasSpaceFft = document.getElementById('space-fft');

		this._bandpass = audioCtx.createScriptProcessor(null, 1, 2);
		this._bandpass.onaudioprocess = function(e) {
			const input = e.inputBuffer.getChannelData(0);
			const markOutput = e.outputBuffer.getChannelData(0);
			const spaceOutput = e.outputBuffer.getChannelData(1);

			for(let i = 0; i < input.length; i++) {
				markOutput[i] = markFilter(input[i]);
				spaceOutput[i] = spaceFilter(input[i]);
			}

			clearCanvas(canvasMarkInput, canvasSpaceInput);
			drawCanvas(canvasMarkInput, 'red', input);
			drawCanvas(canvasSpaceInput, 'red', input);
			drawCanvas(canvasMarkInput, 'blue', markOutput);
			drawCanvas(canvasSpaceInput, 'blue', spaceOutput);
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


/**
 * Clears given canvas elements
 * @debug
 * @param * {HTMLCanvasElement}
 */
function clearCanvas() {
	for(const canvas of arguments) {
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}
}


/**
 * Draws signal `data` to canvas
 * @debug
 * @param canvas {HTMLCanvasElement}
 * @param style {string}
 * @param data {Float32Array}
 */
function drawCanvas(canvas, style, data) {

	const W = canvas.width;
	const H = canvas.height;
	const H2 = H / 2;

	const xCoeff = W / data.length;

	const ctx = canvas.getContext('2d');
	ctx.strokeStyle = style;
	ctx.beginPath();
	ctx.moveTo(0, H2);
	for(let i = 0; i < data.length; i++) {
		const x = i * xCoeff;
		ctx.lineTo(x, H2 - (data[i] * H2));
	}
	ctx.stroke();
}
