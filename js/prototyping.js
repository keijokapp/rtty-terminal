import audioCtx from './audioContext';
import { analyser } from './visualisation';
import { FFT, InvFFT } from 'jsfft';


const canvasInput = document.getElementById('proto-input');
const canvasInputFft = document.getElementById('proto-input-fft');
const canvasMark = document.getElementById('proto-mark');
const canvasSpace = document.getElementById('proto-space');
const canvasMarkFft = document.getElementById('proto-mark-fft');
const canvasSpaceFft = document.getElementById('proto-space-fft');
const canvasHilbertFft = document.getElementById('proto-hilbert-fft');
const canvasHilbert = document.getElementById('proto-hilbert');

const processor = audioCtx.createScriptProcessor(2048	, 1, 1);
const dummyDestination = audioCtx.createMediaStreamDestination();
processor.connect(dummyDestination);

var buffer = new Float32Array(512);

processor.onaudioprocess = function(e) {

	const input = e.inputBuffer.getChannelData(0);

	const fft = FFT(input);

	clearCanvas(canvasInput, canvasInputFft, canvasMark, canvasSpace, canvasMarkFft, canvasSpaceFft, canvasHilbertFft, canvasHilbert);
	drawCanvas(canvasInput, 'blue', input);
	drawCanvas(canvasInputFft, 'red', fft.imag);
	drawCanvas(canvasInputFft, 'blue', fft.real);

	const h = hilbert(input);
	drawCanvas(canvasHilbert, 'red', h.imag);
	drawCanvas(canvasHilbert, 'blue', h.real);

	drawCanvas(canvasHilbert, 'red', h.imag);
	drawCanvas(canvasHilbert, 'blue', h.real);

	const markOutput = new Float32Array(input.length);
	const spaceOutput = new Float32Array(input.length);

	for(let i = 0; i < input.length; i++) {
		const markFilter = bandpassFilter2(915 / audioCtx.sampleRate, 1000);
		const spaceFilter = bandpassFilter2(1085 / audioCtx.sampleRate, 1000);

		let outputIndex = 0;

		for(let ii = i; ii < buffer.length; ii++, outputIndex++) {
			markOutput[outputIndex] = markFilter(buffer[ii]);
			spaceOutput[outputIndex] = spaceFilter(buffer[ii]);
		}

//		for(let ii = 0; ii < buffer.length; ii++) {
//			markFilter(buffer[ii]);
//			spaceFilter(buffer[ii]);
//		}

		for(let ii = 0; ii <= i; ii++, outputIndex++) {
			markOutput[outputIndex] = markFilter(input[ii]);
			spaceOutput[outputIndex] = spaceFilter(input[ii]);
		}
//	}
	buffer = input;

	drawCanvas(canvasMark, 'blue', markOutput);
	drawCanvas(canvasSpace, 'blue', spaceOutput);

	const markFft = FFT(markOutput);
	const spaceFft = FFT(spaceOutput);

	drawCanvas(canvasMarkFft, 'red', markFft.imag);
	drawCanvas(canvasMarkFft, 'blue', markFft.real);
	drawCanvas(canvasSpaceFft, 'red', spaceFft.imag);
	drawCanvas(canvasSpaceFft, 'blue', spaceFft.real);
}


analyser.connect(processor);


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


function hilbert(data) {

	const fft = FFT(data);

	const N = data.length;
	const N2 = N / 2;

	for(let i = 1; i < N2 - 1; i++) {
		fft.real[i] *= 2;
		fft.imag[i] *= 2;
	}
	
	for(let i = N2 + 1; i < N; i++) {
		fft.real[i] = 0;
		fft.imag[i] = 0;
	}

	drawCanvas(canvasHilbertFft, 'red', fft.imag);
	drawCanvas(canvasHilbertFft, 'blue', fft.real);

	return InvFFT(fft);
}


// Drawing

function drawSignal(canvas, signal, fft) {

	const W = canvas.width;
	const H = canvas.height;
	const H2 = H / 2;
	const H4 = H / 4;
	const ctx = canvas.getContext('2d');

	const signalXCoeff = W / signal.length;
	const fftXCoeff = W / fft.length;

	ctx.clearRect(0, 0, W, H);

	ctx.strokeStyle = 'blue';
	ctx.beginPath();
	ctx.moveTo(0, H4);
	for(let i = 0; i < signal.length; i++) {
		const x = i * signalXCoeff;
		ctx.lineTo(x, H4 - (signal[i] * H4));
	}
	ctx.stroke();

	ctx.strokeStyle = 'blue';
	ctx.beginPath();
	ctx.moveTo(0, H - 1);
	for(let i = 0; i < fft.length; i++) {
		const x = i * fftXCoeff;
		ctx.lineTo(x, H2 + H4 - (fft[i] * H2));
	}
	ctx.stroke();

}

function clearCanvas() {
	for(const canvas of arguments) {
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}
}

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


const animationStart = audioCtx.currentTime;
const changes = [];

function draw() {

	requestAnimationFrame(draw);

	const period = 8; // in seconds
	const time = audioCtx.currentTime - period;

	const e = document.getElementById('fsk-input');
	const ctx = e.getContext('2d');
	ctx.strokeStyle = 'blue';

	while(changes[1] && changes[1].time < time - period) {
		changes.shift();
	}

	var changeIndex = 0;
	var currentValue = 0;
	var nextChange = changes[changeIndex];

	ctx.clearRect(0, 0, e.width, e.height);

	ctx.beginPath();
	for(let i = 0; i < e.width; i++) {
		const timeScale = time + period * i / e.width;
		while(nextChange && nextChange.time <= timeScale) {
			currentValue = nextChange.value;
			nextChange = changes[changeIndex++];
		}
		if(currentValue) {
			ctx.moveTo(i, e.height / 2);
			ctx.lineTo(i, currentValue < 0 ? e.height : 0);
		}
	}
	ctx.stroke();
}
draw();
