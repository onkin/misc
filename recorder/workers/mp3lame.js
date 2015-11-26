importScripts('../libs/libmp3lame.min.js', '../libs/wavepcm.js');

var Mp3Lame = function (config) {

	this.numberOfChannels = config.numberOfChannels;
	this.inputSampleRate = config.inputSampleRate;
	this.outputSampleRate = config.outputSampleRate;
	this.bitDepth = config.bitDepth;
	this.encoderFrameSize = config.encoderFrameSize || 20; // 20ms frame
	this.mode = config.mode || (this.numberOfChannels === 2) ? Lame.STEREO : Lame.MONO;
	this.bitrate = this.outputSampleRate * this.bitDepth / 1000;
	this.wavepcm = new WavePCM(config);
	this.packets = [];

	this.initCodec();
};

Mp3Lame.prototype.encode = function (samples) {
	samples[1] || (samples[1] = samples[0]);
	var mp3Data = Lame.encode_buffer_ieee_float(this.encoder, samples[0], samples[1]);

	return mp3Data.data;
};

Mp3Lame.prototype.initCodec = function () {
	this.encoder = Lame.init();
	Lame.set_mode(this.encoder, this.mode);
	Lame.set_num_channels(this.encoder, this.numberOfChannels);
	Lame.set_num_samples(this.encoder, -1);
	Lame.set_in_samplerate(this.encoder, this.inputSampleRate);
	Lame.set_out_samplerate(this.encoder, this.outputSampleRate);
	Lame.set_bitrate(this.encoder, this.bitrate);
	Lame.init_params(this.encoder);
};

Mp3Lame.prototype.recordBuffers = function (buffers) {
	this.packets.push(this.encode(buffers));
};

Mp3Lame.prototype.requestData = function () {
	return this.getFileFromBuffers(this.packets);
};

Mp3Lame.prototype.getFileFromBuffers = function (buffers) {
	return this.getFile(this.segmentPackets(buffers));
};

Mp3Lame.prototype.getFile = function (segmentedPackets) {
	var lastPage = segmentedPackets[segmentedPackets.length - 1];
	var mp3File = new Uint8Array(lastPage.fileOffset + lastPage.segmentData.length);

	for (var i = 0; i < segmentedPackets.length; i++) {
		mp3File.set(segmentedPackets[i].segmentData, segmentedPackets[i].fileOffset);
	}

	return mp3File;
};

Mp3Lame.prototype.segmentPackets = function (packets) {
	var segmentedPackets = [];
	var fileOffset = 0; // size of comment and id page

	for (var i = 0; i < packets.length; i++) {
		segmentedPackets.push({
			segmentData: packets[i],
			fileOffset: fileOffset
		});
		fileOffset += packets[i].byteLength;
	}

	return segmentedPackets;
};