// https://en.wikipedia.org/wiki/Talk%3ABaudot_code#Baudot_keyboard/keyset?
// eslint-disable-next-line no-unused-vars
const baudot = {
	a: 11000,
	b: 10011,
	c: 1110,
	d: 10010,
	e: 10000,
	f: 10110,
	g: 1011,
	h: 101,
	i: 1100,
	j: 11010,
	k: 11110,
	l: 1001,
	m: 111,
	n: 110,
	o: 11,
	p: 1101,
	q: 11101,
	r: 1010,
	s: 10100,
	t: 1,
	u: 11100,
	v: 1111,
	w: 11001,
	x: 10111,
	y: 10101,
	z: 10001
};

// const baudRate = 45.45;
const sampleRate = 48000;
const markFrequency = 1955; // waves in second
const spaceFrequency = 2125; // waves in second
const markWaveLength = 48000 / markFrequency; // in samples
const spaceWaveLength = 48000 / spaceFrequency; // in samples
const samplesPerByte = sampleRate * 60 / 45.45;
const samplesPerBit = samplesPerByte / 8;

console.log('Samples per byte: %f\nSamples per bit: %f', samplesPerByte, samplesPerBit);
console.log('Mark wave length: %f\nSpace wave length: %f', markWaveLength, spaceWaveLength);
console.log('Mark waves per bit: %f\nSpace waves per bit: %f', samplesPerBit / markWaveLength, samplesPerBit / spaceWaveLength);
