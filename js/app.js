import audioCtx from './audioContext';
import { AFSKDekeyer, AFSKKeyer } from './afsk';
import { UARTReceiver, UARTTransmitter } from './uart';
import { analyser } from './visualisation';

// Microphone input node
var source;

const bitSize = 60 / 60 / 11; // in seconds
const samplesPerBit = parseInt(audioCtx.sampleRate * bitSize / 2) * 2;

const afskKeyer = new AFSKKeyer();
const afskDekeyer = new AFSKDekeyer();
const uartTransmitter = new UARTTransmitter(afskKeyer, {
	byteSize: 8,
	parityBits: 1,
	bitSize: samplesPerBit / audioCtx.sampleRate,
	stopBits: 2
});
const uartReceiver = new UARTReceiver(afskDekeyer, {
	byteSize: 8,
	parityBits: 1,
	bitSize: samplesPerBit,
	stopBits: 2
});

function startRx() {
	try {
		afskKeyer.output.disconnect(analyser);
	} catch(e) {
		// ignored intentionally
	}

	if(source) {
		source.connect(analyser);
	} else {
		console.warn('Source is not available');
	}
}

function startTx() {
	if(source) {
		try {
			source.disconnect(analyser);
		} catch(e) {
			// ignored intentionally
		}
	} else {
		console.warn('Source is not available');
	}

	afskKeyer.output.connect(analyser);
}


const oscillator = audioCtx.createOscillator();
oscillator.frequency.value = 915;
oscillator.start()

window.onkeydown = () => {
	oscillator.frequency.setValueAtTime(1085, 0);
};

window.onkeyup = () => {
	oscillator.frequency.setValueAtTime(915, 0);
};


const noise = audioCtx.createScriptProcessor();
noise.onaudioprocess = e => {
	const input = e.inputBuffer.getChannelData(0);
	const output= e.outputBuffer.getChannelData(0);
	for(let i = 0; i < input.length; i++) {
		output[i] = input[i] / 10 + Math.random() - .5;
	}
};

source = oscillator.connect(noise);
noise.connect(audioCtx.destination);
afskDekeyer.setSource(noise);
startRx();

window.startRx = startRx;
window.startTx = startTx;
window.audioCtx = audioCtx;
window.send = v => uartTransmitter.send(v);

/*
navigator.mediaDevices.getUserMedia({
	audio: {
		echoCancellation: false,
		noiseSuppression: false,
		autoGainControl: false
	}
}).then(media => {
	const mediaSource = audioCtx.createMediaStreamSource(media);
	mediaSource.connect(noise);
	source = noise;
	afskDekeyer.setSource(noise);
	startRx();
}).catch(e => {
	console.warn(e);
});

*/
