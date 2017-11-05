/**
 * Bandpass second-order butterworth filter
 * @param f1 {number} Low cutoff frequency
 * @param f2 {number} High cutoff frequency
 * @returns {function} Sample processor
 */
export function bandpassButterworthFilter(f1, f2) {

	const a = Math.cos(Math.PI * (f2 + f1)) / Math.cos(Math.PI * (f2 - f1));
	const a2 = a * a;
	const b = Math.tan(Math.PI * (f2 - f1));
	const b2 = b * b;

	const r = Math.sin(Math.PI / 4);
	const s = b2 + 2.0 * b * r + 1.0;
	const d1 = 4.0 * a * (1.0 + b * r) / s;
	const d2 = 2.0 * (b2 - 2.0 * a2 - 1.0) / s;
	const d3 = 4.0 * a * (1.0 - b * r) / s;
	const d4 = -(b2 - 2.0 * b * r + 1.0) / s;

	console.log("Butterworth bandpass coefficients:\n%f %f %f %f", d1, d2, d3, d4)

	var x0, x1, x2, x3, x4;
	var y0, y1, y2, y3, y4;
	x0 = x1 = x2 = x3 = 0;
	y0 = y1 = y2 = y3 = 0;

	return sample => {
		x4 = x3; x3 = x2; x2 = x1; x1 = x0;
		x0 = sample;
		y4 = y3; y3 = y2; y2 = y1; y1 = y0;
		y0 = x4 - 2 * x1 + x0
		   + d4 * y4 + d3 * y3
		   + d2 * y2 + d1 * y1;

		return y0;
	}
}


/**
 * Bandpass second-order biquad filter
 * @unused
 * @param f {number} Ceter frequency
 * @param q {number} Q value
 * @returns {function} Sample processor
 */
export function bandpassBiquadFilter(f, q) {

	const K = Math.tan(Math.PI * f);
	const norm = 1 / (1 + K / q + K * K);
	const a0 = K / q * norm;
	const a1 = 0;
	const a2 = -a0;
	const b1 = 2 * (K * K - 1) * norm;
	const b2 = (1 - K / q + K * K) * norm;

	var z1, z2;
	z1 = z2 = 0;

	return sample => {
		const out = sample * a0 + z1;
		z1 = sample * a1 + z2 - b1 * out;
		z2 = sample * a2 - b2 * out;
		return out;
	}
}


/**
 * Lowpass second-order butterworth filter
 * @param f {number} Cutoff frequency
 * @returns {function} Sample processor
 */
export function lowpassButterworthFilter(f) {

  const ita = 1.0 / Math.tan(Math.PI * f);
  const q = Math.sqrt(2.0);
	const b0 = 1.0 / (1.0 + q * ita + ita * ita);
	const b1 = 2*b0;
	const b2 = b0;
	const d1 = 2.0 * (ita * ita - 1.0) * b0;
	const d2 = -(1.0 - q * ita + ita * ita) * b0;

	console.log("Butterworth lowpass coefficients:\n%f %f", d1, d2);

	var x0, x1, x2;
	var y0, y1, y2;
	x0 = x1 = 0;
	y0 = y1 = 0;

	return sample => {
		x2 = x1; x1 = x0;
		x0 = sample;
		y2 = y1; y1 = y0;
		y0 = x2 + 2 * x1 + x0
	           + d2 * y2 + d1 * y1;
		return y0;
	}
}


/**
 * Lowpass second-order biquad filter
 * @unused
 * @param f {number} Cutoff frequency
 * @param q {number} Q value
 * @returns {function} Sample processor
 */
export function lowpassBiquadFilter(f, q) {

	const K = Math.tan(Math.PI * f);
	const norm = 1 / (1 + K / q + K * K);
	const a0 = K * K * norm;
	const a1 = 2 * a0;
	const a2 = a0;
	const b1 = 2 * (K * K - 1) * norm;
	const b2 = (1 - K / q + K * K) * norm;

	var z1, z2;
	z1 = z2 = 0;

	return sample => {
		const out = sample * a0 + z1;
		z1 = sample * a1 + z2 - b1 * out;
		z2 = sample * a2 - b2 * out;
		return out;
	}
}


/**
 * Bandpass FIR filter
 */
export function bandpassFirFilter(f, n) {
	const coeffs = new Float32Array(n);
	
	const sinCoeff = 2 * Math.PI * f;
	for(let i = 0; i < n; i++) {
		coeffs[i] = Math.sin(i * sinCoeff) / n;
	}
	
	const n2 = n * 2;
	const history = new Float32Array(n2);
	var pointer = 0;

	return sample => {
	
		if(pointer === n2) {
			history.copyWithin(0, n2 - n, n);
			pointer = n
		}
		history[pointer] = sample;

		var sum = 0;
		for(let i = 0; i < n; i++) {
			sum += coeffs[i] * history[pointer - i];
		}

		pointer++;
//		if(pointer > n && sum !== 0) console.log(sum);
		return sum;
	}
}


export function goertzelFilter(f, n) {
	const omega = 2.0 * Math.PI * f;
	const sine = Math.sin(omega);
	const cosine = Math.cos(omega);
	const coeff = 2.0 * cosine;

	const buffer = new Float32Array(n);

	return sample => {
	    var q0 = 0;
	    var q1 = 0;
	    var q2 = 0;

			buffer.copyWithin(0, 1);
			buffer[n - 1] = sample;
		  for(const s of buffer) {
		      q0 = coeff * q1 - q2 + s;
		      q2 = q1;
		      q1 = q0;
		  }

//		return q2 * q2 + q1 * q1 - coeff * q1 * q2;


		const real = (q1 * cosine - q2);
		const imag = (q1 * sine);
		return Math.sqrt(real*real + imag*imag);
	}
}

