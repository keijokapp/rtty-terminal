import audioCtx from './audioContext';
import { analyser } from './visualisation';
import { FFT } from 'jsfft';


const processor = audioCtx.createScriptProcessor(512, 1, 1);
const dummyDestination = audioCtx.createMediaStreamDestination();
processor.connect(dummyDestination);


processor.onaudioprocess = function(e) {

	const input = e.inputBuffer.getChannelData(0);

	input.map(s => s * 1000);

	const fft = FFT(input);

	drawSignal(document.getElementById('proto-input'), input, fft.real);
}


analyser.connect(processor);



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
