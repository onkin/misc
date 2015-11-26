let Encoder = require('./encoder');
let Recorder = require('./recorder');

// encoder
let encoder = new Encoder({
	numberOfChannels: 2,
	bitDepth: 8,
	format: 'mp3',
	sampleRate: 48000
});
encoder.encode(audioBuffer, function(data) {
	encoder.destroy();
	encoder = null;
	console.log(data.blob);
});

// recorder
let recorder = new Recorder({
	stream: stream,
	monitorGain: 0,
	numberOfChannels: 1,
	bitDepth: 8,
	format: 'ogg',
	sampleRate: 8000
});

let recordId = recorder.start();

setTimeout(()=>{
	recorder.stop(recordId, function(data) {
		console.log(data);
	});
}, 5000);