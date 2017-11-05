import { EventEmitter } from 'events';
import audioCtx from './audioContext';

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

		bits.push({ timestamp: time + this._stopBits * this._bitSize, value: 1 }); // ensure queue pointer is at the end of word

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

		this._dekeyer.on('change', this._change.bind(this));

		this._reset();
	}

	_reset() {
		if(this._dekeyer.currentValue !== 1) {
			this._state = States.WAIT_HIGH;
		} else {
			this._state = States.WAIT_START;
		}	
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
				this._decode().then(byte => {
					console.log('Got byte: %d', byte);
					this._reset();
				}).catch(e => {
					console.log('Failed to decode: %s', e.message);
					this._reset();
				});
			} else {
				this._reset();
			}
			break;
		}
	}

	async _decode(bitIndex) {

		const ctrlMask = (((1 << this._stopBits) - 1) << (this._byteSize + this._parityBits + 1)) | 1; // mask for start and stop bits
		const maxParity = (1 << this._parityBits) - 1; // max parity value
		const parityMask = maxParity << (this._byteSize + 1); // mask for parity bits

		const bitCount = this._byteSize + 1 + this._parityBits + this._stopBits;

		// read start bit
		console.log('Reading start bit');
		await new Promise((resolve, reject) => {
			const sampleOffset = Math.round(this._byteStart + this._bitSize / 2);
			samplings.push({sample: sampleOffset});
			this._dekeyer.once('' + sampleOffset, value => {
				if(value === -1) {
					resolve();
				} else {
					reject(new Error('Invalid start bit'));
				}
			})
		});


		// read data bits
		console.log('Reading data bits');
		const data = await new Promise((resolve, reject) => {

			var byte = 0;
			var parity = 0;
			var bitIndex = 0;

			const callback = (value, t) => {
				console.log('fired: %d', t);
				if(value === 0) {
				console.log('failed');
					reject(new Error('Zero value'));
					return;
				}

				value = value === 1 ? 1 : 0;
				if(value) {
					parity++;
				}

				byte |= value << bitIndex++;
				console.log(bitIndex);
				if(bitIndex >= this._byteSize) {
					resolve({ byte, parity });
				}
			};

			for(let i = 1; i <= this._byteSize; i++) {
				const sampleOffset = Math.round(this._byteStart + (i + .5) * this._bitSize);
console.log(sampleOffset);
				samplings.push({sample: sampleOffset});
				this._dekeyer.once('' + sampleOffset, callback);
			}
		});

		// read & check parity
		if(this._parityBits) {
			console.log('Reading parity bits');
			const parity = await new Promise((resolve, reject) => {

				var parity = 0;
				var bitIndex = 0;

				const callback = value => {
					if(value === 0) {
						reject(new Error('Zero value'));
						return;
					}

					value = value === 1 ? 1 : 0;
					parity |= value << bitIndex++;

					if(bitIndex >= this._parityBits) {
						resolve(parity);
					}
				};

				for(let i = this._byteSize + 1; i <= this._byteSize + this._parityBits; i++) {
					const sampleOffset = Math.round(this._byteStart + (i + .5) * this._bitSize);
					samplings.push({sample: sampleOffset});
					this._dekeyer.once('' + sampleOffset, callback);
				}
			});
			
			if(parity !== data.parity) {
				throw new Error('Invalid parity');
			}
		}

		// read stop bits
		console.log('Reading stop bits');
		await new Promise((resolve, reject) => {
			const sampleOffset = Math.round(this._byteStart + (1 + this._byteSize + this._parityBits + this._stopBits / 2) * this._bitSize);
			samplings.push({sample: sampleOffset});
			this._dekeyer.once('' + sampleOffset, value => {
				if(value === 1) {
					resolve();
				} else {
					reject(new Error('Invalid stop bits'));
				}
			});
		});
		
		return data.byte;
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
			ctx.lineTo(i, currentValue < 0 ? e.height : 0);
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
