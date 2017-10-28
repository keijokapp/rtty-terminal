### RTTY/AFSK terminal based on Web Audio API

Currently it's only able to transmit and receive UART messages (i.e. no real UI and RTTY).


Usage:

```sh
npm install
./index.js
```

Navigate to shown location and use browser console to interact with application
```javascript
startTx(); // connects oscillator to analyser and decoder input
startRx(); // connects microphone input to analyser and decoder input
send(byteNumber); // send byte to audio destination
setValueAtTime(-1|0|1); // manually set oscillator to space/silence/mark state
// decoded messages should also be logged to console 
```

Future plans:
 * Test against existing RTTY terminal
 * Increase decoder quality (filter/DSP research & additional signal detection intelligence)
 * Usable UI
 * RTTY/baudot support
 * Hardware FSK support via WebUSB or server backend
