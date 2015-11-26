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