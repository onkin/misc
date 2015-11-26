let common = require('common');
let utils = require('./utils');
let states = require('./states');
let seriesAudioProvider = require('./series-audios-provider');
let parallelAudioProvider = require('./parallel-audios-provider');
let singleAudioProvider = require('./single-audios-provider');


let AudioPlayer = function audioPlayer(options = {}) {

	var config = _.extend({volume: 1}, options.config);

	var el = options.el,
		$el = $(el),
		audioEl = $el.find('audio')[0],
		$container = Boolean(audioEl) ? $el.parent() : $el,
		$button = $container.find('.j-audio__control'),
		$progressbarWrapper = $container.find('.j-audio__bar_wrapper'),
		$progressbar = $container.find('.j-audio__bar'),
		$time = $container.find('.j-audio__time'),
		provider;

	if (options.sources) {
		if (options.isParallel) {
			provider = parallelAudioProvider({
				sources: options.sources,
				config: config
			});
		} else {
			provider = seriesAudioProvider({
				sources: options.sources,
				config: config
			});
		}
	} else if (options.source) {
		provider = singleAudioProvider({
			source: options.source,
			config: config
		});
	} else if (audioEl) {
		provider = singleAudioProvider({
			el: $el.find('audio')[0],
			config: config
		});
	} else {
		throw new Error('"audioEl" or "sources" must be defined!');
	}

	function play() {
		$('audio')
			.each(function () {
				this.pause();
			});
		provider.play();
	}

	function pause() {
		provider.pause();
	}

	function stop() {
		provider.stop();
	}

	function toggle() {
		(provider.getState() === states.PLAYING) ? pause() : play();
	}

	function init() {
		bindEvents();
		provider.data()
			.done(function () {
				$time.html(getTimeString());
			});
	}

	function unbindEvents() {
		$button.off('click', toggle);

		$progressbarWrapper.off('click', onClickProgressBar);

		provider
			.unbind('state.changed', onChangeState)
			.unbind('ended', onEnd)
			.unbind('timeupdate', onTimeUpdate);
	}

	function bindEvents() {
		$button.on('click', toggle);

		$progressbarWrapper.on('click', onClickProgressBar);

		provider
			.bind('state.changed', onChangeState)
			.bind('ended', onEnd)
			.bind('time.updated', onTimeUpdate);
	}

	function getTimeString() {
		var timeString = '',
			time = provider.getTime(),
			duration = provider.getDuration();
		if (time) {
			timeString = utils.timeFormat(time) + ' / ';
		}
		return timeString + utils.timeFormat(duration);
	}

	function onClickProgressBar(e) {
		var duration = provider.getDuration();
		if (duration != 0) {
			var left = $progressbarWrapper.offset().left,
				offset = e.pageX - left,
				percent = offset / $progressbarWrapper.width(),
				currentTime = percent * duration;
			if (provider.getState() === states.PLAYING) {
				provider.pause();
				provider.setTime(currentTime);
				provider.play();
			} else {
				provider.setTime(currentTime);
			}

		}
	}

	function onEnd() {
		stop();
		Workle.functions.safe(options.onListen)();
	}

	function onChangeState() {
		$button.attr('data-state', provider.getState().alias);
	}

	function onTimeUpdate(e) {
		var duration = provider.getDuration();
		var fraction = e.time / duration,
			percent = fraction * 100;
		$progressbar.css({width: percent + '%'});
		$time.html(getTimeString());
	}

	init();

	return {
		getDuration: function () {
			return provider.getDuration();
		},

		getFriendlyDuration: function () {
			return utils.timeFormat(this.getDuration());
		},

		ready: function () {
			return provider.ready();
		},
		data: function () {
			return provider.data();
		},
		getProvider: function () {
			return provider;
		},
		loadData: function () {
			provider.loadData();
		},
		toggle: toggle,
		stop: stop,
		pause: pause,
		play: play,
		destroy: function () {
			stop();
			provider.destroy();
			unbindEvents();
		}
	};
};

module.exports = AudioPlayer;
