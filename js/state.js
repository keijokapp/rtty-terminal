import { EventEmitter } from 'events';

const config = {
	afskOutput: true,
	afskFrq: 1000,
	afskShift: 170,
	fftSize: 512,
	waterfallHeight: 128,
	waterfallWidth: 1,
	waterfallPeriod: 3000 // in milliseconds
};

export default config;
export const events = new EventEmitter;

function setState(key, value) {
	config[key] = value;
}

for(const key of Object.keys(config)) {
	events.on(key, setState.bind(config, key));
}

function resize() {
	const WIDTH = document.body.clientWidth;


	for(const canvas of document.querySelectorAll('.canvasContainer > canvas.full-width')) {
		canvas.width = WIDTH;
		canvas.height = 128;
	}

	events.emit('waterfallWidth', WIDTH);
}

window.addEventListener('resize', resize);

resize();
