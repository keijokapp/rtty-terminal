import { windowSize, markWaveLength, spaceWaveLength } from './parameters.js';

const buffer = new Float32Array(windowSize);
let noise = new Float32Array();
let sPower = 1;
let nPower = 0;
let minPhase = 0;
let maxPhase = 0;
let currentPhase = 0;
let waveLength = 0;

const inputs = [
	spaceWaveLength,
	512,
	markWaveLength
];

function generateNoise() {
	if (currentPhase < minPhase) {
		const additionalSamples = minPhase - currentPhase;
		console.log('Generating %d samples of noise to the left', additionalSamples);
		const newNoise = new Float32Array(additionalSamples + noise.length);

		for (let i = 0; i < additionalSamples; i++) {
			newNoise[i] = Math.random() * 2 - 1;
		}

		newNoise.set(noise, additionalSamples);
		noise = newNoise;
		minPhase = currentPhase;
	}

	if (currentPhase > maxPhase - windowSize) {
		const additionalSamples = currentPhase - maxPhase + windowSize;
		console.log('Generating %d samples of noise to the right', additionalSamples);
		const newNoise = new Float32Array(noise.length + additionalSamples);
		newNoise.set(noise, 0);

		for (let i = noise.length; i < newNoise.length; i++) {
			newNoise[i] = Math.random() * 2 - 1;
		}

		noise = newNoise;
		maxPhase = currentPhase + windowSize;
	}
}

function rebuildBuffer() {
	generateNoise();
	let phaseDelta = 0;
	let inputIndex = 0;
	let countDown = inputs[1] - currentPhase;

	for (let i = 0; i < buffer.length; i++) {
		countDown--;

		while (countDown < 0) {
			const twopit = 2 * Math.PI * (i + currentPhase + countDown);
			inputIndex += 2;
			countDown += inputs[inputIndex + 1];
			phaseDelta += twopit / inputs[inputIndex - 2] - twopit / inputs[inputIndex];
		}

		const sine = Math.sin(2 * Math.PI * (i + currentPhase) / inputs[inputIndex] + phaseDelta);
		buffer[i] = sPower * sine + nPower * noise[i + currentPhase - minPhase];
	}
}

export default function input() {
	return buffer;
}

export function setWaveLength(wl) {
	if (wl <= 0) {
		throw new Error('Bad wave length');
	}

	waveLength = wl;
	rebuildBuffer();

	return waveLength;
}

export function getPhase() {
	return currentPhase;
}

export function setPhase(phase) {
	currentPhase = phase;
	rebuildBuffer();

	return currentPhase;
}

export function setSignalPower(power) {
	if (power < 0) {
		throw new Error('Bad signal power');
	}

	sPower = power;
	rebuildBuffer();

	return sPower;
}

export function setNoisePower(power) {
	if (power < 0) {
		throw new Error('Bad noise power');
	}

	nPower = power;
	rebuildBuffer();

	return nPower;
}
