import { EventEmitter } from 'events';

// encoder

export class UARTTransmitter {

	/**
	 * @constructor
	 * @param keyer {Keyer} Keyer to be used for transmitting
	 * @param options {object} Options
   * @param options.byteSize {number} Number of bits in byte
   * @param options.bitSize {number} Length of bit in keyers time scale
   * @param options.parityBits {number} Number of parity bits
   * @param options.stopBits {number} Number of stop bits
	 */
	constructor(keyer, options) {
		this._keyer = keyer;
		this._byteSize = options.byteSize;
		this._bitSize = options.bitSize;
		this._parityBits = options.parityBits;
		this._stopBits = options.stopBits;
	}

	/**
	 * Sends single byte
	 * @param byte {number} integer byte value
	 */
	send(byte) {
		const standbyTime = .1;
		const maxParity = (1 << this._parityBits) - 1;

		const bits = [ ];

		var parity = 0;
		var time = 0;

//		bits.push({ timestamp: time, value: 1 }) // standby value, high
//		time += standbyTime;

		bits.push({ timestamp: time, value: -1 });
		time += this._bitSize;

		console.log('Sending: %s', byte.toString(2));

		// data bits
		for(let i = 0; i < this._byteSize; i++) {
			if(byte & 1) {
				bits.push({ timestamp: time, value: 1 }); // mark, high
				parity++;
			} else {
				bits.push({ timestamp: time, value: -1 }); // space, low
			}
			time += this._bitSize;
			byte >>= 1;
		}

		// parity bits
		for(let i = 0; i < this._parityBits; i++) {
			if(parity & 1) {
				bits.push({ timestamp: time, value: 1 }); // mark, high
			} else {
				bits.push({ timestamp: time, value: -1 }); // space, low
			}
			time += this._bitSize;
			parity >>= 1;
		}
		
		bits.push({ timestamp: time, value: 1 }); // stop bits

		bits.push({ timestamp: time + this._stopBits * this._bitSize, value: 0 });

		return this._keyer.queue(bits);
	}

}


// decoder


const States = {
	WAIT_HIGH: 1,
	WAIT_START: 2,
	DECODING: 3
}


export class UARTReceiver extends EventEmitter {

	/**
	 * @constructor
	 * @param dekeyer {Dekeyer} Dekeyer used for receiving
	 * @param options {object} Options
   * @param options.byteSize {number} Number of bits in byte
   * @param options.bitSize {number} Length of bit in keyers time scale
   * @param options.parityBits {number} Number of parity bits
   * @param options.stopBits {number} Number of stop bits
	 */
	constructor(dekeyer, options) {
		super();

		this._dekeyer = dekeyer;
		this._byteSize = options.byteSize;
		this._bitSize = options.bitSize;
		this._parityBits = options.parityBits;
		this._stopBits = options.stopBits;

		if(dekeyer.currentValue !== -1) {
			this._state = States.WAIT_HIGH;
		} else {
			this._state = States.WAIT_START;
		}

		this._dekeyer.on('change', this._change.bind(this));

	}

	_change(value, time, timeStamp) {

		changes.push({
			value, time: timeStamp, sample: time
		});
		
		switch(this._state) {
		case States.DECODING:
			break;
		case States.WAIT_HIGH:
			if(value === 1) { // Got high value
				this._state = States.WAIT_START;
			}
			break;
		case States.WAIT_START:
			if(value === -1) { // Got start bit
				this._state = States.DECODING;
				this._byteStart = time;
				this._decode();
			} else if(value !== 1) {
				console.log('Reverted to waiting high value')
				this._state = States.WAIT_HIGH;
			}
			break;
		}
	}

	_decode(bitIndex) {

		const ctrlMask = (((1 << this._stopBits) - 1) << (this._byteSize + this._parityBits + 1)) | 1; // mask for start and stop bits
		const maxParity = (1 << this._parityBits) - 1; // max parity value
		const parityMask = maxParity << (this._byteSize + 1); // mask for parity bits

		const bitCount = this._byteSize + 1 + this._parityBits + this._stopBits;
		var error = false;
		var byteValue = 0;
		var bitIndex = 0;
		var parity = 0;

		const callback = value => {
			if(error) {
				return;
			}
			if(value === 0) {
				error = true;
				console.log('ERROR: Got zero value');
				return;
			}

			value = value === 1 ? 1 : 0;
			if(value && bitIndex > 0 && bitIndex <= this._byteSize) parity++;

			byteValue |= value << bitIndex++;

			if(bitIndex >= bitCount) {
				if((byteValue & ctrlMask) === ctrlMask - 1) {
					console.log('Start and stop bits OK');
				} else {
					console.log('Start and stop bits NOT OK');
				}
				if((byteValue & parityMask) >> (this._byteSize + 1) === (parity & maxParity)) {
					console.log('Parity bits OK');
				} else {
					console.log('Parity bits NOT OK: parity bit: %d; byte parity: %d', (byteValue & parityMask) >> (this._byteSize + 1), parity);
				}
				byteValue >>= 1;
				byteValue &= (1 << this._byteSize) - 1;

				console.log('Got byte: %s', byteValue);
				this._state = this._dekeyer.currentValue !== 1 ? States.WAIT_HIGH : States.WAIT_START;
			}
		}

		for(let i = 0; i < bitCount; i++) {
			const sampleOffset = this._byteStart + i * this._bitSize + this._bitSize / 2;
			samplings.push({ sample: sampleOffset });
			this._dekeyer.once('' + sampleOffset, callback);
		}
	}
}


// debug

const changes = [];
const samplings = [];

function draw() {

	requestAnimationFrame(draw);

	const period = 8000; // in milliseconds
	const time = performance.now() - period;

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
			ctx.lineTo(i, currentValue > 0 ? 0 : e.height);
		}
	}
	ctx.stroke();
	
	if(changes[0]) {
		const referenceSample = changes[0].sample;
		const referenceTime = changes[0].time;
		const referenceTimeOffset = referenceTime - time;
		const referenceSampleOffset = referenceTimeOffset * audioCtx.sampleRate / 1000;
		const firstSample = referenceSample - referenceSampleOffset;
		const totalSamples = period * audioCtx.sampleRate / 1000;

		ctx.strokeStyle = 'red';
		ctx.beginPath();		
		for(const sampling of samplings) {
			const x = e.width * (sampling.sample - firstSample) / totalSamples;
			ctx.moveTo(x, 0);	
			ctx.lineTo(x, e.height);		
		}
		ctx.stroke();

		while(samplings[0] && samplings[0].sample < firstSample) {
			samplings.shift();
		}
	}
}
draw();
//setInterval(draw, 1000);
