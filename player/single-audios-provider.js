let EventTarget = require('event-target');
let utils = require('./utils');
let states = require('./states');

function singleAudioElProvider(options) {

	var config = options.config,
		audio = options.el || createAudio(options.source),
		$audio = $(audio),
		eventTarget = new EventTarget(),
		isReady = false,
		deferred = $.Deferred(),
		dataDeferred = $.Deferred(),
		hasParent = audio.parentNode,
		metadataLoaded = false,
		currentTime = 0,
		duration = options.source && options.source.duration;

	if (!hasParent) {
		document.body.appendChild(audio);
	}

	function initialize() {
		audio.volume = config.volume || 1;
		audio.preload = config.preload || 'metadata';
		bindEvents();
		if (options.autoplay) {
			play();
		}
		if (audio.preload === 'none') {
			onReady();
		}
		if (!isNaN(audio.duration)) {
			metadataLoaded = true;
			onLoadedMetadata();
		}
	}

	function createAudio(source) {
		var a = document.createElement('audio'),
			src;
		if (source.path) {
			src = source.path;
		} else {
			src = source;
		}
		a.src = utils.getSupportedAudio(src).VirtualPath;
		return a;
	}

	function play() {
		audio.play();
	}

	function stop() {
		pause();
		setTime(0);
	}

	function pause() {
		audio.pause();
	}

	function setTime(time) {
		if (dataLoaded()) {
			audio.currentTime = time;
		} else {
			currentTime = time;
		}
	}

	function getTime() {
		return dataLoaded() ? audio.currentTime : currentTime;
	}

	function bindEvents() {
		$audio
			.bind('play', onPlay)
			.bind('pause', onPause)
			.bind('ended', onEnd)
			.bind('timeupdate', onTimeUpdate)
			.bind('loadedmetadata', onLoadedMetadata);
	}

	function unbindEvents() {
		$audio
			.unbind('play', onPlay)
			.unbind('pause', onPause)
			.unbind('ended', onEnd)
			.unbind('timeupdate', onTimeUpdate)
			.unbind('loadedmetadata', onLoadedMetadata);
	}

	function onEnd() {
		eventTarget.trigger('ended');
	}

	function onPause() {
		eventTarget.trigger('paused state.changed');
	}

	function onPlay() {
		eventTarget.trigger('playstarted state.changed');
	}

	function onTimeUpdate() {
		eventTarget.trigger('time.updated', {time: getTime()});
	}

	function onReady() {
		if (!isReady) {
			isReady = true;
			eventTarget.trigger('ready');
			deferred.resolve();
		}
	}

	function onLoadedMetadata() {
		if (!dataLoaded()) {
			metadataLoaded = true;
			if (currentTime) {
				setTime(currentTime);
			}
			eventTarget.trigger('dataloaded');
			dataDeferred.resolve();
			onReady();
		}
	}

	function dataLoaded() {
		return metadataLoaded;
	}

	initialize();

	return _.extend(eventTarget, {

		stop: stop,
		pause: pause,
		play: play,
		setTime: setTime,
		getTime: getTime,

		ready: function () {
			return deferred.promise();
		},

		data: function () {
			return dataDeferred.promise();
		},

		isReady: function () {
			return isReady;
		},

		dataLoaded: dataLoaded(),

		loadData: function () {
			if (!dataLoaded()) {
				audio.preload = 'metadata';
			}
		},

		getDuration: function () {
			return dataLoaded() ? audio.duration : duration || null;
		},

		getState: function () {
			return audio.paused
				? states.PAUSED
				: states.PLAYING;
		},

		destroy: function () {
			if (!hasParent) {
				document.body.removeChild(audio);
			}
			pause();
			unbindEvents();
		}

	});

}

module.exports = singleAudioElProvider;