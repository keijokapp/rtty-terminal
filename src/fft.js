const mapExponent = {};

function exponent(k, N) {
	const x = -2 * Math.PI * (k / N);
	mapExponent[N] = mapExponent[N] || {};
	mapExponent[N][k] = mapExponent[N][k] || [Math.cos(x), Math.sin(x)];

	return mapExponent[N][k];
}

export default function fft(samples) {
	const N = samples.length;

	if (N === 1) {
		const r = new Float32Array(1);
		const i = new Float32Array(1);
		[r[0]] = samples;
		i[0] = 0;

		return [r, i];
	}

	if (N === 0 || N % 2 !== 0) {
		throw new Error('FFT size must be power of 2');
	}

	const [Xer, Xei] = fft(samples.filter((_, i) => i % 2 === 0));
	const [Xor, Xoi] = fft(samples.filter((_, i) => i % 2 === 1));

	const Xr = new Float32Array(N);
	const Xi = new Float32Array(N);

	for (let k = 0; k < N / 2; k++) {
		const [exr, exi] = exponent(k, N);
		const er = exr * Xor[k] - exi * Xoi[k];
		const ei = exr * Xoi[k] + exi * Xor[k];
		Xr[k] = Xer[k] + er;
		Xi[k] = Xei[k] + ei;
		Xr[k + (N / 2)] = Xer[k] - er;
		Xi[k + (N / 2)] = Xei[k] - ei;
	}

	return [Xr, Xi];
}
