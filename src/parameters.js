/*
export const markFrequency = 2125 / 48000; // in samples
export const spaceFrequency = 1955 / 48000; // in samples

export const markWaveLength = 48000 / 2125; // in samples
export const spaceWaveLength = 48000 / 1955; // in samples
*/
export const windowSize = 1024;

export const markWaveLength = 120;
export const spaceWaveLength = 30;

export const markFrequency = 1 / markWaveLength;
export const spaceFrequency = 1 / spaceWaveLength;
