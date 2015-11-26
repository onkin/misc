this.onmessage = function (e) {
	var data = e.data;
	switch (data.command) {
		case 'recordBuffers':
			this.recorder.recordBuffers(data.buffers);
			break;

		case 'requestData':
			var recordData = this.recorder.requestData();
			this.postMessage({
				command: 'recordData',
				buffer: recordData
			});
			break;

		case 'mergeBuffers':
			var mergedData = this.recorder.getFileFromBuffers(data.buffers);
			this.postMessage({
				command: 'mergedData',
				buffer: mergedData
			});
			this.close();
			break;

		case 'stop':
			this.close();
			break;

		case 'init':
			var f = data.formats;
			switch (data.format) {
				case f.OGG:
					importScripts('oggopus.js');
					this.recorder = new OggOpus(data);
					break;
				case f.MP3:
					importScripts('mp3lame.js');
					this.recorder = new Mp3Lame(data);
					break;
				case f.WAV:
				default:
					importScripts('wavepcm.js');
					this.recorder = new WavePCM(data);
			}
			break;
	}
};