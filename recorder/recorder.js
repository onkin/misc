var Recorder = function (config = {}) {

	if (!Recorder.isRecordingSupported()) {
		throw 'Recording is not supported in this browser';
	}

	config.format = config.format || Recorder.formats.WAV;
	config.bitDepth = (config.format != Recorder.formats.WAV ? 16 : config.bitDepth) || 16;
	config.bufferLength = config.bufferLength || 4096;
	config.monitorGain = config.monitorGain || 0;
	config.numberOfChannels = config.numberOfChannels || 1;
	config.sampleRate = config.sampleRate || (config.format != Recorder.formats.WAV ? 48000 : this.audioContext.sampleRate);
	config.workerPath = config.workerPath || 'workers/recorderWorker.js';
	config.streamOptions = config.streamOptions || {
			optional: [],
			mandatory: {
				googEchoCancellation: false,
				googAutoGainControl: false,
				googNoiseSuppression: false,
				googHighpassFilter: false
			}
		};

	this.config = config;
	this.state = 'inactive';
	this.callbacks = [];
	this.eventTarget = document.createDocumentFragment();
	this.createAudioNodes();
	this.initStream();
};

Recorder.formats = {
	WAV: 'wav',
	MP3: 'mp3',
	OGG: 'ogg'
};

Recorder.types = {
	'wav': 'audio/wav',
	'mp3': 'audio/mpeg',
	'ogg': 'audio/ogg'
};

Recorder.isRecordingSupported = function () {
	return AudioContext && navigator.getUserMedia;
};

Recorder.prototype.audioContext = audioContext;

Recorder.prototype.addEventListener = function (type, listener, useCapture) {
	this.eventTarget.addEventListener(type, listener, useCapture);
	return this;
};

Recorder.prototype.removeEventListener = function (type, listener, useCapture) {
	this.eventTarget.removeEventListener(type, listener, useCapture);
	return this;
};

Recorder.prototype.dispatchEvent = function (event) {
	if (typeof event === 'string') {
		event = new Event(event);
	}
	this.eventTarget.dispatchEvent(event);
	return this;
};

Recorder.prototype.createAudioNodes = function () {
	var that = this;
	this.scriptProcessorNode = this.audioContext.createScriptProcessor(this.config.bufferLength, this.config.numberOfChannels, this.config.numberOfChannels);
	this.scriptProcessorNode.onaudioprocess = function (e) {
		that.recordBuffers(e.inputBuffer);
	};
	this.monitorNode = this.audioContext.createGain();
	this.setMonitorGain(this.config.monitorGain);

	// 6th order butterworth
	if (this.config.sampleRate < this.audioContext.sampleRate) {
		this.filterNode = this.audioContext.createBiquadFilter();
		this.filterNode2 = this.audioContext.createBiquadFilter();
		this.filterNode3 = this.audioContext.createBiquadFilter();
		this.filterNode.type = this.filterNode2.type = this.filterNode3.type = 'lowpass';

		var nyquistFreq = this.config.sampleRate / 2;
		this.filterNode.frequency.value = this.filterNode2.frequency.value = this.filterNode3.frequency.value = nyquistFreq - ( nyquistFreq / 3.5355 );
		this.filterNode.Q.value = 0.51764;
		this.filterNode2.Q.value = 0.70711;
		this.filterNode3.Q.value = 1.93184;

		this.filterNode.connect(this.filterNode2);
		this.filterNode2.connect(this.filterNode3);
		this.filterNode3.connect(this.scriptProcessorNode);
	}
};

Recorder.prototype.getStream = function (callback) {
	var that = this;
	navigator.getUserMedia(
		{audio: this.config.streamOptions},
		function (stream) {
			callback(stream);
		},
		function (e) {
			that.dispatchEvent(new ErrorEvent('recordingError', {error: e}));
		}
	);
};

Recorder.prototype.initStream = function () {
	var that = this;
	this.getStream(function (stream) {
		that.stream = stream;
		that.sourceNode = that.audioContext.createMediaStreamSource(stream);
		that.sourceNode.connect(that.filterNode || that.scriptProcessorNode);
		that.sourceNode.connect(that.monitorNode);
	});
};

Recorder.prototype.createWorker = function (handlers) {
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
		formats: Recorder.formats
	});

	return worker;
};

Recorder.prototype.pause = function () {
	if (this.state === 'recording') {
		this.state = 'paused';
		this.dispatchEvent('pause');
	}
};

Recorder.prototype.recordBuffers = function (inputBuffer) {
	if (this.state === 'recording') {

		var buffers = [];
		for (var i = 0; i < inputBuffer.numberOfChannels; i++) {
			buffers[i] = inputBuffer.getChannelData(i);
		}

		this.recordWorker.postMessage({
			command: 'recordBuffers',
			buffers: buffers
		});
		this.recordingTime += inputBuffer.duration;
		this.dispatchEvent(new CustomEvent('recordingProgress', {detail: this.recordingTime}));
	}
};

Recorder.prototype.setCallback = function (callbackName, callback) {
	delete this.callbacks[callbackName];
	if (typeof callback === 'function') {
		this.callbacks[callbackName] = callback;
	}
};

Recorder.prototype.executeCallback = function (callbackName) {
	var args = [].slice.call(arguments, 1);
	if (typeof this.callbacks[callbackName] === 'function') {
		this.callbacks[callbackName].apply(null, args);
		delete this.callbacks[callbackName];
	}
};

Recorder.prototype.requestData = function (recordId, callback) {
	this.setCallback('recordData' + recordId, callback);
	if (this.state !== 'recording') {
		this.recordWorker.postMessage({command: 'requestData'});
	}
};

Recorder.prototype.resume = function () {
	if (this.state === 'paused') {
		this.state = 'recording';
		this.dispatchEvent('resume');
	}
};

Recorder.prototype.setMonitorGain = function (gain) {
	this.monitorNode.gain.value = gain;
};

Recorder.prototype.mergeBuffers = function (buffers, callback) {
	this.setCallback('mergedData', callback);
	var that = this;
	this.mergeWorker = this.createWorker({
		'mergedData': function (data) {
			var blob = new Blob([data.buffer], {type: Recorder.types[that.config.format]});
			var detail = {
				blob: blob,
				buffer: data.buffer
			};
			that.executeCallback('mergedData', detail);
			that.dispatchEvent(new CustomEvent(data.command + 'Available', {detail: detail}));
		}
	});
	this.mergeWorker.postMessage({
		command: 'mergeBuffers',
		buffers: buffers
	});
};

Recorder.prototype.start = function () {
	if (this.state === 'inactive' && this.sourceNode) {
		var recordId = this.recordId = ++this.recordId || 1;

		this.monitorNode.connect(this.audioContext.destination);
		this.scriptProcessorNode.connect(this.audioContext.destination);

		var that = this;
		this.recordWorker = this.createWorker({
			'recordData': function (data) {
				var blob = new Blob([data.buffer], {type: Recorder.types[that.config.format]});
				var detail = {
					blob: blob,
					buffer: data.buffer
				};
				that.executeCallback('recordData' + recordId, detail);
				that.dispatchEvent(new CustomEvent(data.command + 'Available', {detail: detail}));
			}
		});

		this.state = 'recording';
		this.recordingTime = 0;
		this.recordBuffers = function () {
			delete this.recordBuffers;
		};
		this.dispatchEvent('start');
		this.dispatchEvent(new CustomEvent('recordingProgress', {detail: this.recordingTime}));
		return recordId;
	}
	return null;
};

Recorder.prototype.stop = function (recordId, callback) {
	if (this.state !== 'inactive') {
		this.monitorNode.disconnect();
		this.scriptProcessorNode.disconnect();
		this.state = 'inactive';
		this.dispatchEvent('stop');
		this.requestData(recordId, callback);
		this.recordWorker.postMessage({command: 'stop'});
	}
};

Recorder.prototype.destroy = function () {
	this.stop();
	if (this.recordWorker) {
		this.recordWorker.terminate();
	}
	if (this.mergeWorker) {
		this.mergeWorker.terminate();
	}
};

module.exports = Recorder;
