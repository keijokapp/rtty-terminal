import { EventEmitter } from 'events';
import audioCtx from './audioContext';

export const Parity = {
	NONE: 0,
	ZERO: 1,
	ONE: 2,
	EVEN: 4,
	ODD: 3
};

// encoder

export class UARTTransmitter {

	/**
	 * @constructor
	 * @param keyer {Keyer} Keyer to be used for transmitting
	 * @param options {object} Options
	 * @param options.byteSize {number} Number of bits in byte
	 * @param options.bitSize {number} Length of bit in keyers time scale
	 * @param options.parity {Parity} Parity configuration
	 * @param options.stopBits {number} Number of stop bits
	 */
	constructor(keyer, options) {
		this._keyer = keyer;
		this._byteSize = options.byteSize;
		this._bitSize = options.bitSize;
		this._parity = options.parity;
		this._stopBits = options.stopBits;
	}

	/**
	 * Sends single byte
	 * @param byte {number} integer byte value
	 */
	send(byte) {
		const standbyTime = .01;

		const bits = [ ];

		var parity = 0;
		var time = 0;

		if(this._keyer.currentValue !== 1) {
			bits.push({ timestamp: time, value: 1 }) // standby value, high
			time += standbyTime;
		}

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

		// parity bit
		if(this._parity !== Parity.NONE) {
			var p;
			switch(this._parity) {
			case Parity.ZERO: p = -1; break
			case Parity.ONE: p = 1; break;
			case Parity.EVEN: p = parity ? -1 : 1; break;
			case Parity.ODD: p = parity ? 1 : -1; break;
			}
			bits.push({ timestamp: time, value: p });
			time += this._bitSize;
		}

		bits.push({ timestamp: time, value: 1 }); // stop bits

		// ensure queue pointer is after stop bits
		bits.push({ timestamp: time + this._stopBits * this._bitSize, value: 1 });

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
	 * @param options.parity {Parity} Parity configuration
	 * @param options.stopBits {number} Number of stop bits
	 */
	constructor(dekeyer, options) {
		super();

		this._dekeyer = dekeyer;
		this._byteSize = options.byteSize;
		this._bitSize = options.bitSize;
		this._parity = options.parity;
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

				changes.length = 0;
				samplings.length = 0;
	
				this._byteStart = time;
				this._decode(result => {
					if(result instanceof Error) {
						console.log('Failed to read byte: %s', result.message);
					} else {
						console.log('Got byte: %d', result);
					}
					this._reset();
				});
			} else {
				this._reset();
			}
			break;
		}

		changes.push({ value, time });
	}

	_decode(callback) {
		const _this = this;

		var byte = 0;
		var parity = 0;

		readStartBit();

		function readStartBit() {
			const sampleOffset = Math.round(_this._byteStart + _this._bitSize / 2);
			samplings.push({sample: sampleOffset});
			_this._dekeyer.once('' + sampleOffset, value => {
				if(value === -1) {
					readDataBits();
				} else {
					callback(new Error('Invalid start bit'));
				}
			});		
		}

		// read data bits
		function readDataBits() {

			var bitIndex = 0;

			const callback = (value, t) => {
				if(value === 0) {
					callback(new Error('Zero value'));
					return;
				}

				value = value === 1 ? 1 : 0;
				if(value) {
					parity++;
				}

				byte |= value << bitIndex++;
				if(bitIndex >= _this._byteSize) {
					if(_this._parity !== Parity.NONE) {
						readParity(byte, parity);
					} else {
						readStopBits();
					}
				}
			};

			for(let i = 1; i <= _this._byteSize; i++) {
				const sampleOffset = Math.round(_this._byteStart + (i + .5) * _this._bitSize);
				samplings.push({sample: sampleOffset});
				_this._dekeyer.once('' + sampleOffset, callback);
			}
		}

		// read & check parity
		function readParity() {

			const sampleOffset = Math.round(_this._byteStart + (_this._byteSize + 1.5) * _this._bitSize);
			samplings.push({sample: sampleOffset});

			_this._dekeyer.once('' + sampleOffset, value => {
				if(value === 0) {
					callback(new Error('Zero value'));
					return;				
				}

				value = value === 1 ? 1 : 0;

				var result;
				switch(e) {
				case Parity.ZERO: result = value === 0; break;
				case Parity.ONE: result = value === 1; break;
				case Parity.EVEN: result = value !== parity; break;
				case Parity.ODD: result = value === parity; break;
				}

				if(!result) {
					callback(new Error('Invalid parity'));
				} else {
					readStopBits();
				}
			});
		}

		function readStopBits() {
			const sampleOffset = Math.round(_this._byteStart + (1 + _this._byteSize + (_this._parityBits ? 1 : 0) + _this._stopBits / 2) * _this._bitSize);
			samplings.push({sample: sampleOffset});
			_this._dekeyer.once('' + sampleOffset, value => {
				if(value === 1) {
					callback(byte);
				} else {
					callback(new Error('Invalid stop bits'));
				}
			});
		}
	}
}


// debug

const changes = [];
const samplings = [];

function draw() {

//	requestAnimationFrame(draw);

	if(!changes.length) return;

	const drawStart = changes[0].time - 10; // samples
	const drawSize = 4000; // samples

	const e = document.getElementById('fsk-input');
	const ctx = e.getContext('2d');
	ctx.strokeStyle = 'blue';

	var changeIndex = 0;
	var currentValue = 0;
	var nextChange = changes[changeIndex];

	ctx.clearRect(0, 0, e.width, e.height);

	ctx.beginPath();
	for(let i = 0; i < e.width; i++) {
		const time = drawStart + i * drawSize / e.width;

		while(nextChange && nextChange.time <= time) {
			console.log('change');
			currentValue = nextChange.value;
			nextChange = changes[changeIndex++];
		}
		if(currentValue) {
			ctx.moveTo(i, e.height / 2);
			ctx.lineTo(i, currentValue < 0 ? e.height : 0);
		}
	}
	ctx.stroke();

	ctx.strokeStyle = 'red';
	ctx.beginPath();
	for(const sampling of samplings) {
		const x = (sampling.sample - drawStart) * (e.width / drawSize);
		ctx.moveTo(x, 0);
		ctx.lineTo(x, e.height);
	}
	ctx.stroke();
}

//draw();
setInterval(draw, 1000);
