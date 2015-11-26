var Encoder = function (config = {}) {

	config.format = config.format || Encoder.formats.WAV;
	config.bitDepth = (config.format != Encoder.formats.WAV ? 16 : config.bitDepth) || 16;
	config.bufferLength = config.bufferLength || 4096;
	config.monitorGain = config.monitorGain || 0;
	config.numberOfChannels = config.numberOfChannels || 1;
	config.sampleRate = config.sampleRate || (config.format != Encoder.formats.WAV ? 48000 : this.audioContext.sampleRate);
	config.workerPath = config.workerPath || 'workers/recorderWorker.js';

	this.config = config;
	this.state = 'inactive';
	this.callbacks = [];
};

Encoder.formats = {
	WAV: 'wav',
	MP3: 'mp3',
	OGG: 'ogg'
};

Encoder.types = {
	'wav': 'audio/wav',
	'mp3': 'audio/mpeg',
	'ogg': 'audio/ogg'
};

Encoder.prototype.audioContext = audioContext;

Encoder.prototype.createWorker = function (handlers) {
	handlers || (handlers = {});
	var worker = new Worker(this.config.workerPath);
	worker.addEventListener('message', function (e) {
		var data = e.data;
		var handler = handlers[data.command] || function () {
				console.log('unknown worker message', data);
			};
		handler(e.data);
	});

	worker.postMessage({
		command: 'init',
		bitDepth: this.config.bitDepth,
		bufferLength: this.config.bufferLength,
		inputSampleRate: this.audioContext.sampleRate,
		numberOfChannels: this.config.numberOfChannels,
		outputSampleRate: this.config.sampleRate,
		format: this.config.format,
		formats: Encoder.formats
	});

	return worker;
};

Encoder.prototype.load = function (path) {
	var deferred = $.Deferred();
	var request = new XMLHttpRequest();
	var that = this;
	request.open('GET', path, true);
	request.responseType = 'arraybuffer';
	request.onload = function () {
		if (request.response.status === Workle.http.statusCodes.forbidden) {
			deferred.reject(request.response);
		} else {
			var buffer = request.response;
			that.audioContext.decodeAudioData(buffer, function (audioBuffer) {
				var result = {
					buffer: buffer,
					audioBuffer: audioBuffer
				};
				deferred.resolve(result);
			}, function () {
				deferred.reject('Invalid audio');
			});
		}
	};
	request.onerror = deferred.reject.bind(deferred);
	request.send();
	return deferred.promise();
};

Encoder.prototype.encode = function (inputBuffer, callback) {
	var id = new Date().getTime();
	this.setCallback('encode' + id, callback);
	var that = this;
	this.encodeWorker = this.createWorker({
		'recordData': function (data) {
			var blob = new Blob([data.buffer], {type: Encoder.types[that.config.format]});
			var detail = {
				blob: blob,
				buffer: data.buffer
			};
			that.executeCallback('encode' + id, detail);
		}
	});
	var buffers = [];
	for (var i = 0; i < inputBuffer.numberOfChannels; i++) {
		buffers[i] = inputBuffer.getChannelData(i);
	}

	this.encodeWorker.postMessage({
		command: 'recordBuffers',
		buffers: buffers
	});

	this.encodeWorker.postMessage({
		command: 'requestData'
	});
};

Encoder.prototype.setCallback = function (callbackName, callback) {
	delete this.callbacks[callbackName];
	if (typeof callback === 'function') {
		this.callbacks[callbackName] = callback;
	}
};

Encoder.prototype.executeCallback = function (callbackName) {
	var args = [].slice.call(arguments, 1);
	if (typeof this.callbacks[callbackName] === 'function') {
		this.callbacks[callbackName].apply(null, args);
		delete this.callbacks[callbackName];
	}
};

Encoder.prototype.destroy = function () {
	if (this.encodeWorker) {
		this.encodeWorker.terminate();
	}
};

module.exports = Encoder;