let utils = {

	parseDuration: function (duration) {
		if (typeof duration === 'string') {
			var p = duration.split(':');
			duration = 3600 * p[0] + 60 * p[1] + 1 * p[2];
		}
		return duration;
	},

	getSupportedAudio: (function () {

		var map = {
			'mp3': {
				Extension: 'mp3',
				AudioType: 'audio/mpeg'
			},
			'ogg': {
				Extension: 'ogg',
				AudioType: 'audio/ogg'
			}
		};

		function getSupportedAudio(audios) {
			var a = document.createElement('audio'),
				originalAudio;
			return _.find(audios, function (audio) {
					var isSupported = Boolean(a.canPlayType && a.canPlayType(audio.AudioType + ';')
							.replace(/no/, ''));
					if (isSupported && audio.Type === 'original') {
						originalAudio = audio;
					}
					return isSupported && audio.Type !== 'original';
				}) || originalAudio || null;
		}

		function parseAudio(audio) {
			return _.extend({}, audio, {
				VirtualPath: Workle.utils.url.prependHost(audio.VirtualPath)
			});
		}

		function parseAudios(audios) {
			var copyAudios = [];

			function getExtension(path) {
				var reg = /[^?]+\.([A-Za-z0-9]+)(?:\?.*)?$/;
				var matches = path.match(reg);
				return matches && matches[1] || null;
			}

			_.each(audios, function (audio) {
				var ext = getExtension(audio.VirtualPath);
				copyAudios.push(_.extend({}, parseAudio(audio), map[ext]));
			}, this);
			return copyAudios;
		}

		return function (audios) {
			audios = parseAudios(audios);
			return getSupportedAudio(audios);
		};

	})(),

	timeFormat: (function () {
		function pad(d) {
			return d.padLeft('0', 2);
		}

		return function (sec) {
			sec = Math.ceil(sec) || 0;
			var res = [],
				hours, minutes, seconds;
			hours = Math.floor(sec / (60 * 60));
			sec = sec % (60 * 60);
			minutes = Math.floor(sec / 60);
			sec = sec % 60;
			seconds = sec;
			hours && res.push(pad(hours));
			res.push(pad(minutes), pad(seconds));
			return res.join(':');
		};
	})()

};

module.exports = utils;