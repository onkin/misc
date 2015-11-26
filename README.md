##Audio Player

```js
let player = require('./player');
let sources = [/* audios... */];

let singlePlayer1 = player({el: this.el});

let seriesPlayer = player({
	el: this.el,
	sources: sources,
	config: {
		preload: 'none'
	}
});

let parallelPlayer = player({
	el: this.el,
	sources: sources,
	isParallel: true,
	config: {
		preload: 'none'
	}
});
```


##Audio Encoder

```js
let Encoder = require('./encoder');

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
```


##Audio Recorder

```js
let Recorder = require('./recorder');

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
```