let common = require('common');
let EventTarget = require('event-target');
let utils = require('./utils');
let states = require('./states');
let singleAudioProvider = require('./single-audios-provider');

function seriesAudiosProvider(options) {
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
		currentProvider,
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
		bindProvider(providers[0]);
	}

	function bindProvider(provider) {
		if (provider && provider !== currentProvider) {
			unbindProvider(currentProvider);
			currentProvider = provider;
			currentProvider
				.bind('state.changed', onChangeState)
				.bind('ended', onEnd)
				.bind('time.updated', onTimeUpdate);
		}
	}

	function unbindProvider(provider) {
		if (provider) {
			provider.stop();
			provider
				.unbind('state.changed', onChangeState)
				.unbind('ended', onEnd)
				.unbind('time.updated', onTimeUpdate);
		}
	}

	function next() {
		var index = providers.indexOf(currentProvider);
		var nextProvider = providers[index + 1];
		if (nextProvider) {
			bindProvider(nextProvider);
			currentProvider.play();
		} else {
			stop();
			eventTarget.trigger('ended');
		}
	}

	function play() {
		currentProvider.play();
	}

	function stop() {
		pause();
		setTime(0);
	}

	function pause() {
		currentProvider.pause();
	}

	function setTime(time) {
		var provider = findProviderByTime(time);
		if (provider) {
			bindProvider(provider);
			currentProvider.setTime(time - getOffset(currentProvider));
		}
	}

	function getTime() {
		return currentProvider.getTime() + getOffset(currentProvider);
	}

	function findProviderByTime(time) {
		return _.find(providers, function (provider) {
			var from = getOffset(provider);
			var to = provider.getDuration() + from;
			return time <= to && time >= from;
		});
	}

	function getDuration() {
		return _.reduce(providers, function (memo, provider) {
			return memo + provider.getDuration();
		}, 0);
	}

	function getOffset(provider) {
		if (provider.offset) {
			return provider.offset;
		}
		var i = providers.indexOf(provider);
		var offset = 0;
		while (i-- > 0) {
			offset += providers[i].getDuration();
		}
		provider.offset = offset;
		return offset;
	}

	function onEnd() {
		currentProvider.stop();
		next();
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
			return currentProvider.getState();
		},

		isReady: function () {
			return isReady;
		},

		dataLoaded: function () {
			return metadataLoaded;
		},

		loadData: function () {
			providers.forEach(function (provider) {
				provider.loadData();
			});
		},

		getParts: function () {
			return providers;
		},

		destroy: function () {
			pause();
			providers.forEach(function (provider) {
				provider.destroy();
			});
		}

	});

}

module.exports = seriesAudiosProvider;