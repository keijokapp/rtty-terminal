import {
	windowSize, markFrequency, spaceFrequency, markWaveLength, spaceWaveLength
} from './parameters.js';
import input from './input.js';

/**
 * Goertzel filter
 */
function goertzelFilter(f, N) {
	const buffer = new Float32Array(N);

	const realW = Math.cos(2 * Math.PI * f);
	const imagW = Math.sin(2 * Math.PI * f);
	const coeff = 2 * realW;

	let offset = 0;

	return sample => {
		buffer[offset] = sample;
		let Skn1 = 0; let
			Skn2 = 0;

		for (let i = 0; i < N; i++) {
			const Skn = buffer[(offset + i) % N] + coeff * Skn1 - Skn2;
			Skn2 = Skn1;
			Skn1 = Skn;
		}

		offset = (offset + 1) % N;
		const resultr = Skn1 - realW * Skn2;
		const resulti = -imagW * Skn2;

		return Math.sqrt(resultr * resultr + resulti * resulti);
	};
}

requestAnimationFrame(draw);

function draw() {
	setTimeout(() => requestAnimationFrame(draw), 100);
	drawFilters(0, spaceWaveLength * 100, markWaveLength * 100);
}

function drawFilters(index, spaceFilterSize, markFilterSize) {
	const markFilter = goertzelFilter(markFrequency, markFilterSize);
	const spaceFilter = goertzelFilter(spaceFrequency, spaceFilterSize);
	const markSamples = new Float32Array(windowSize);
	const spaceSamples = new Float32Array(windowSize);
	const samples = input();

	for (let i = 0; i < windowSize; i++) {
		markSamples[i] = markFilter(samples[i]);
		spaceSamples[i] = spaceFilter(samples[i]);
	}

	/// drawing

	const e = document.getElementById(`filters-${index}`);
	const halfHeight = e.height / 2;
	const ctx = e.getContext('2d');

	ctx.clearRect(0, 0, e.width, e.height);
	ctx.beginPath();
	ctx.strokeStyle = 'gray';
	ctx.moveTo(-1, halfHeight);
	ctx.lineTo(e.width, halfHeight);
	ctx.stroke();

	const pixelsPerSample = e.width / windowSize;

	ctx.beginPath();
	ctx.strokeStyle = 'red';
	ctx.moveTo(-1, halfHeight);

	for (let i = 0; i < windowSize; i++) {
		ctx.lineTo(i * pixelsPerSample, halfHeight - spaceSamples[i] / 10);
	}

	ctx.moveTo(spaceFilterSize * pixelsPerSample, 0);
	ctx.lineTo(spaceFilterSize * pixelsPerSample, e.height);
	ctx.stroke();

	ctx.beginPath();
	ctx.strokeStyle = 'blue';
	ctx.moveTo(-1, halfHeight);

	for (let i = 0; i < windowSize; i++) {
		ctx.lineTo(i * pixelsPerSample, halfHeight - markSamples[i] / 10);
	}

	ctx.moveTo(markFilterSize * pixelsPerSample, 0);
	ctx.lineTo(markFilterSize * pixelsPerSample, e.height);
	ctx.stroke();
}
