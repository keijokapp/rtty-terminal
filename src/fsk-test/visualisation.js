import React, { useRef } from 'react';
import { flushSync } from 'react-dom';
import ReactDOM from 'react-dom/client';
import { windowSize, markWaveLength, spaceWaveLength } from './parameters.js';
import input, { getPhase } from './input.js';
import fft from './fft.js';

function Content() {
	const infoContainerRef = useRef();

	function onInfo(event) {
		const infoContainer = infoContainerRef.current;

		if (event == null) {
			infoContainer.style.display = 'none';
			infoContainer.graph = {};
		} else {
			infoContainer.style.top = event.clientY + 28;
			infoContainer.style.left = event.clientX;
			infoContainer.graph = {
				graph: event.target.id,
				x: event.nativeEvent.offsetX / event.target.clientWidth,
				y: event.nativeEvent.offsetY / event.target.clientHeight
			};
		}
	}

	return (
		React.createElement(React.Fragment, {}, [
			React.createElement('div', { id: 'info-container', ref: infoContainerRef, style: { display: 'none', position: 'absolute' } }),
			React.createElement('div', { className: 'canvasContainer' }, [
				React.createElement(Canvas, { fullWidth: true, id: 'inputSamples', onInfo })
			]),
			React.createElement('div', { className: 'canvasContainer' }, [
				React.createElement(Canvas, { id: 'inputFft', fullWidth: true, onInfo })
			]),
			React.createElement('div', { className: 'canvasContainer' }, [
				React.createElement(Canvas, {
					id: 'inputTone-0', height: 200, onInfo, width: 200
				}),
				' ',
				React.createElement(Canvas, {
					id: 'inputTone-1', height: 200, onInfo, width: 200
				}),
				' ',
				React.createElement(Canvas, {
					id: 'inputTone-2', height: 200, onInfo, width: 200
				}),
				' ',
				React.createElement(Canvas, {
					id: 'inputTone-3', height: 200, onInfo, width: 200
				}),
				' ',
				React.createElement(Canvas, {
					id: 'inputTone-4', height: 200, onInfo, width: 200
				}),
				' ',
				React.createElement(Canvas, {
					id: 'inputTone-5', height: 200, onInfo, width: 200
				}),
				' ',
				React.createElement(Canvas, {
					id: 'inputTone-6', height: 200, onInfo, width: 200
				}),
				' ',
				React.createElement(Canvas, {
					id: 'inputTone-7', height: 200, onInfo, width: 200
				}),
				' ',
				React.createElement(Canvas, {
					id: 'inputTone-8', height: 200, onInfo, width: 200
				})
			]),
			React.createElement('div', { className: 'canvasContainer' }, [
				React.createElement(Canvas, { fullWidth: true, id: 'filters-0', onInfo }),
				React.createElement(Canvas, { fullWidth: true, id: 'filters-1', onInfo }),
				React.createElement(Canvas, { fullWidth: true, id: 'filters-2', onInfo }),
				React.createElement(Canvas, { fullWidth: true, id: 'filters-3', onInfo })
			])
		])
	);
}

function Canvas({
	fullWidth, height, id, onInfo, width
}) {
	return React.createElement('canvas', {
		className: fullWidth ? 'full-width' : undefined,
		height,
		id,
		onMouseMove: onInfo,
		onMouseOut() { onInfo(); },
		width
	});
}

flushSync(() => {
	ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Content));
});

const inputSamplesCanvas = document.getElementById('inputSamples');
const inputSamplesCtx = inputSamplesCanvas.getContext('2d');
const inputFftCanvas = document.getElementById('inputFft');
const inputFftCtx = inputFftCanvas.getContext('2d');
const infoContainer = document.getElementById('info-container');
infoContainer.graph = {};

requestAnimationFrame(draw);

function draw() {
	setTimeout(() => requestAnimationFrame(draw), 100);

	const inputSamples = input();

	drawInput(inputSamples);
	drawFft(inputSamples);

	drawTone(0, inputSamples, markWaveLength);
	drawTone(1, inputSamples, spaceWaveLength);
	drawTone(2, inputSamples, windowSize / 8);
	drawTone(2, inputSamples, windowSize / 4);
	drawTone(3, inputSamples, windowSize / 2);
	drawTone(4, inputSamples, windowSize);
}

function drawInput(inputSamples) {
	const canvasWidth = inputSamplesCanvas.width; const
		canvasHeight = inputSamplesCanvas.height;
	inputSamplesCtx.clearRect(0, 0, canvasWidth, canvasHeight);

	inputSamplesCtx.strokeStyle = 'gray';
	inputSamplesCtx.beginPath();
	inputSamplesCtx.moveTo(0, canvasHeight / 2);
	inputSamplesCtx.lineTo(canvasWidth, canvasHeight / 2);

	for (let x = 0; x < windowSize; x += 100) {
		inputSamplesCtx.moveTo(x * canvasWidth / windowSize, canvasHeight / 2 - 10);
		inputSamplesCtx.lineTo(x * canvasWidth / windowSize, canvasHeight / 2 + 10);
	}

	inputSamplesCtx.stroke();
	inputSamplesCtx.strokeStyle = 'blue';
	inputSamplesCtx.beginPath();
	inputSamplesCtx.moveTo(0, canvasHeight / 2);

	for (let x = 0; x < windowSize; x++) {
		inputSamplesCtx.lineTo(
			x * canvasWidth / windowSize,
			canvasHeight / 2 - inputSamples[x] * canvasHeight / 2
		);
	}

	inputSamplesCtx.stroke();

	if (infoContainer.graph.graph === 'inputSamples') {
		infoContainer.style.display = null;
		const time = Math.floor(windowSize * infoContainer.graph.x);
		const amplitude = inputSamples[time];
		infoContainer.innerHTML = `Time: ${time + getPhase()}<br/>Amplitude: ${amplitude}`;
	}
}

function drawFft(inputSamples) {
	const [inputFftR, inputFftI] = fft(inputSamples);

	const canvasWidth = inputFftCanvas.width;
	const canvasHeight = inputFftCanvas.height;
	inputFftCtx.clearRect(0, 0, canvasWidth, canvasHeight);

	inputFftCtx.strokeStyle = 'blue';
	inputFftCtx.beginPath();
	inputFftCtx.moveTo(0, canvasHeight / 2);

	for (let x = 0; x < windowSize; x++) {
		inputFftCtx.lineTo(x * canvasWidth / windowSize, canvasHeight / 2 - inputFftR[x] / 2);
	}

	inputFftCtx.stroke();
	inputFftCtx.strokeStyle = 'red';
	inputFftCtx.beginPath();
	inputFftCtx.moveTo(0, canvasHeight / 2);

	for (let x = 0; x < windowSize; x++) {
		inputFftCtx.lineTo(x * canvasWidth / windowSize, canvasHeight / 2 - inputFftI[x] / 2);
	}

	inputFftCtx.stroke();

	if (infoContainer.graph.graph === 'inputFft') {
		infoContainer.style.display = null;
		const bin = Math.floor(windowSize * infoContainer.graph.x);
		const waveLength = 1 / infoContainer.graph.x;
		const r = inputFftR[bin];
		const i = inputFftI[bin];
		const d = Math.sqrt(r * r + i * i);
		infoContainer.innerHTML = `Bin: ${bin}<br/>Wavelength: ${waveLength}<br/>Frequency: ${1 / waveLength}<br/>R: ${r}<br/>I: ${i}<br/>D: ${d}`;
	}
}

function drawTone(index, input, d) {
	const inputToneCanvas = document.getElementById(`inputTone-${index}`);
	const inputToneCtx = inputToneCanvas.getContext('2d');

	const canvasWidth = inputToneCanvas.width;
	const canvasHeight = inputToneCanvas.height;

	const centerX = canvasWidth / 2;
	const centerY = canvasHeight / 2;

	inputToneCtx.clearRect(0, 0, canvasWidth, canvasHeight);

	const omega = 2 * Math.PI / d;

	const slope = [Math.cos(input.length * omega), Math.sin(input.length * omega)];
	inputToneCtx.strokeStyle = 'gray';
	inputToneCtx.beginPath();
	inputToneCtx.moveTo(centerX, centerY);
	inputToneCtx.lineTo(centerX - slope[0] * 300, centerY - slope[1] * 300);
	inputToneCtx.stroke();
	inputToneCtx.strokeStyle = 'black';
	inputToneCtx.beginPath();
	inputToneCtx.moveTo(centerX, centerY);
	inputToneCtx.lineTo(centerX + slope[0] * 300, centerX + slope[1] * 300);
	inputToneCtx.stroke();

	inputToneCtx.fillStyle = 'gray';
	inputToneCtx.fillRect(centerX, centerY, 1, 1);

	inputToneCtx.strokeStyle = 'gray';
	inputToneCtx.beginPath();
	inputToneCtx.moveTo(centerX, 0);
	inputToneCtx.lineTo(centerX, 10);
	inputToneCtx.moveTo(centerX, canvasHeight - 10);
	inputToneCtx.lineTo(centerX, canvasHeight);
	inputToneCtx.moveTo(0, centerY);
	inputToneCtx.lineTo(10, centerY);
	inputToneCtx.moveTo(canvasWidth - 10, centerY);
	inputToneCtx.lineTo(canvasWidth, centerY);
	inputToneCtx.stroke();

	inputToneCtx.fillStyle = 'blue';
	let sumR = 0;
	let sumI = 0;

	for (let i = 0; i < input.length; i++) {
		const real = Math.cos(i * omega);
		const imag = Math.sin(i * omega);
		sumR += real * input[i];
		sumI += imag * input[i];
		inputToneCtx.fillRect(centerX + real * input[i] * 100, centerY + imag * input[i] * 100, 1, 1);
	}

	sumR /= input.length;
	sumI /= input.length;

	inputToneCtx.fillStyle = 'red';
	inputToneCtx.fillRect(centerX + sumR * 100 - 1, centerY + sumI * 100 - 1, 2, 2);

	if (infoContainer.graph.graph === `inputTone-${d}`) {
		infoContainer.style.display = null;
		const angle = Math.atan2(slope[1], slope[0]) * 180 / Math.PI;
		infoContainer.innerHTML = `D: ${d}<br/>Angle: ${angle}`;
	}
}
