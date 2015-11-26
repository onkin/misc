let common = require('common');
let EventTarget = require('event-target');
let utils = require('./utils');
let states = require('./states');
let singleAudioProvider = require('./single-audios-provider');

function parallelAudiosProvider(options) {
	common.contracts(options)
		.contract('sources', {
			required: true,
			any: [1, null]
		});

	var sources = options.sources,
		eventTarget = new EventTarget(),
		isReady = false,
		metadataLoaded = false,
		deferred = $.Deferred(),
		dataDeferred = $.Deferred(),
		maxProvider,
		providers = sources.map((source) => {
			singleAudioProvider({
				source: source,
				config: options.config
			});
		});

	function initialize() {
		var deferreds = providers.map((provider) => {
			provider.ready();
		});
		var dataDeferreds = providers.map((provider) => {
			provider.data();
		});
		$.when.apply($, deferreds)
			.done(onReady);
		$.when.apply($, dataDeferreds)
			.done(onDataLoaded);
	}

	function bindProvider() {
		getMaxProvider()
			.bind('state.changed', onChangeState)
			.bind('ended', onEnd)
			.bind('time.updated', onTimeUpdate);
	}

	function unbindProvider() {
		getMaxProvider()
			.unbind('state.changed', onChangeState)
			.unbind('ended', onEnd)
			.unbind('time.updated', onTimeUpdate);
	}

	function play() {
		providers.forEach(function (provider) {
			provider.play();
		});
	}

	function stop() {
		pause();
		setTime(0);
	}

	function pause() {
		providers.forEach(function (provider) {
			provider.pause();
		});
	}

	function setTime(time) {
		providers.forEach(function (provider) {
			provider.setTime(time);
		});
	}

	function getTime() {
		return getMaxProvider()
			.getTime();
	}

	function getMaxProvider() {
		return maxProvider || (maxProvider = _.max(providers, (provider) => {
				provider.getDuration();
			}));
	}

	function getDuration() {
		return getMaxProvider()
			.getDuration();
	}

	function onEnd() {
		getMaxProvider()
			.stop();
		eventTarget.trigger('ended');
	}

	function onChangeState() {
		eventTarget.trigger('state.changed');
	}

	function onTimeUpdate(e) {
		eventTarget.trigger('time.updated', {time: getTime()});
	}

	function onReady() {
		if (!isReady) {
			isReady = true;
			eventTarget.trigger('ready');
			deferred.resolve();
		}
	}

	function onDataLoaded() {
		if (!metadataLoaded) {
			metadataLoaded = true;
			bindProvider();
			eventTarget.trigger('dataloaded');
			dataDeferred.resolve();
		}
	}

	initialize();

	return _.extend(eventTarget, {

		stop: stop,
		pause: pause,
		play: play,
		getTime: getTime,
		setTime: setTime,
		getDuration: getDuration,

		ready: function () {
			return deferred.promise();
		},

		data: function () {
			return dataDeferred.promise();
		},

		getState: function () {
			return getMaxProvider()
				.getState();
		},

		isReady: function () {
			return isReady;
		},

		dataLoaded: function () {
			return metadataLoaded;
		},

		loadData: function () {
			_.each(providers, function (provider) {
				provider.loadData();
			});
		},

		getParts: function () {
			return providers;
		},

		destroy: function () {
			pause();
			unbindProvider();
			_.each(providers, function (provider) {
				provider.destroy();
			});
		}

	});

}

module.exports = parallelAudiosProvider;
