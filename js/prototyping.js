import audioCtx from './audioContext';
import { analyser } from './visualisation';
import { FFT, InvFFT } from 'jsfft';


const canvasInput = document.getElementById('proto-input');
const canvasInputFft = document.getElementById('proto-input-fft');
const canvasPhase = document.getElementById('proto-phase');
const canvasDerivedInput = document.getElementById('proto-derived-input');
const canvasHilbertFft = document.getElementById('proto-hilbert-fft');
const canvasHilbert = document.getElementById('proto-hilbert');

const processor = audioCtx.createScriptProcessor(512, 1, 1);
const dummyDestination = audioCtx.createMediaStreamDestination();
processor.connect(dummyDestination);

var a = false;
processor.onaudioprocess = function(e) {

	const input = e.inputBuffer.getChannelData(0);

	for(let i = 0; i < input.length; i++) input[i] *= 10;

	const fft = FFT(input);

	clearCanvas(canvasInput, canvasInputFft, canvasPhase, canvasDerivedInput, canvasHilbertFft, canvasHilbert);
	drawCanvas(canvasInput, 'blue', input);
	drawCanvas(canvasInputFft, 'red', fft.imag);
	drawCanvas(canvasInputFft, 'blue', fft.real);

	const phase = new Float32Array(input.length);
	for(let i = 0; i < input.length; i++) {
		phase[i] = Math.atan2(fft.imag[i], fft.real[i]) / Math.PI;
	}
	drawCanvas(canvasPhase, 'blue', phase);

	const derived = InvFFT(fft);

	drawCanvas(canvasDerivedInput, 'red', fft.imag);
	drawCanvas(canvasDerivedInput, 'blue', fft.real);

	const h = hilbert(input);
	drawCanvas(canvasHilbert, 'red', h.imag);
	drawCanvas(canvasHilbert, 'blue', h.real);

	drawCanvas(canvasHilbert, 'red', h.imag);
	drawCanvas(canvasHilbert, 'blue', h.real);

}


analyser.connect(processor);


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
