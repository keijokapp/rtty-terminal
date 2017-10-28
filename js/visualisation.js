import config, { events } from './state';
import audioCtx from './audioContext';

const inputCanvas = document.getElementById('input');
const inputCtx = inputCanvas.getContext('2d');
const waterfall1 = document.getElementById('waterfall1');
const waterfall2 = document.getElementById('waterfall2');
const waterfallStartTime = performance.now();

var samplesArray, fftArray, waterfallImageData, timeToWaterfallRatio, fftToWaterfallRatio;


export const analyser = audioCtx.createAnalyser();
analyser.smoothingTimeConstant = 0;

function update() {
	analyser.fftSize = config.fftSize;
	
	samplesArray = new Float32Array(config.fftSize);
	fftArray = new Uint8Array(config.fftSize / 2);

	timeToWaterfallRatio = config.waterfallPeriod / config.waterfallHeight;
	fftToWaterfallRatio = fftArray.length / config.waterfallWidth;
	waterfallImageData = new ImageData(config.waterfallWidth, 1);
}

events.on('fftSize', update);
events.on('waterfallWidth', update);
events.on('waterfallHeight', update);
update();


function draw() {
	requestAnimationFrame(draw);

	analyser.getByteFrequencyData(fftArray);

	inputCtx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
	inputCtx.strokeStyle = 'blue';
	const fftLength = fftArray.length;
	const xCoefficient = inputCanvas.width / fftLength;
	const yCoefficient = inputCanvas.height / 256;
	inputCtx.beginPath();
	for(let i = 0; i < fftLength; i++) {
		inputCtx.lineTo(i * xCoefficient, inputCanvas.height - fftArray[i] * yCoefficient);
	}
	inputCtx.stroke();


	const timeOffset = (performance.now() - waterfallStartTime) % (2 * config.waterfallPeriod);
	const pixelOffset = timeOffset / timeToWaterfallRatio;

	const activeWaterfall = timeOffset < config.waterfallPeriod ? waterfall1 : waterfall2;
	const ctx = activeWaterfall.getContext('2d');
	const inactiveWaterfall = activeWaterfall === waterfall1 ? waterfall2 : waterfall1;

	var min = Infinity, max = -Infinity;
	for(const bin of fftArray) {
		if(bin < min) min = bin;
		if(bin > max) max = bin;
	}

	const delta = max - min;
	const coefficient = 255 / delta;

	for(let x = 0; x < waterfallImageData.width; x++) {
		const i = x * fftToWaterfallRatio;
		const value = (fftArray[Math.round(i)] - min) * coefficient;
		waterfallImageData.data[4 * x + 0] = value;
		waterfallImageData.data[4 * x + 1] = value;
		waterfallImageData.data[4 * x + 2] = value	;
		waterfallImageData.data[4 * x + 3] = 255;
	}
	
	const y = parseInt(config.waterfallHeight - (pixelOffset % config.waterfallHeight));
	ctx.putImageData(waterfallImageData, 0, y);
	ctx.putImageData(waterfallImageData, 0, y + 1);
	ctx.putImageData(waterfallImageData, 0, y + 2);
	
	activeWaterfall.style.top = (pixelOffset % config.waterfallHeight) - config.waterfallHeight;
	inactiveWaterfall.style.top = pixelOffset % config.waterfallHeight;
}

requestAnimationFrame(draw);
