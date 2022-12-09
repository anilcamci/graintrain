// Granular processing is partly based on Ehsan Ziya's great
// work on an HTML5 granulator found at: https://github.com/zya/granular

let attack = 0.40;
let release = 0.40;
let density = 0.85;
let spread = 0.2;
let pitch = 1;
let amp = 0.3;
let lpf = 1;

function grain(intersectedBlock) {

	this.now = context.currentTime;

	this.source = context.createBufferSource();
	this.source.playbackRate.value = this.source.playbackRate.value * pitch;
	this.source.buffer = intersectedBlock.parent.buffer;

	this.gain = context.createGain();
  	this.source.connect(this.gain);
	this.gain.connect(master);

	this.posX = intersectedBlock.index;
	this.offset = this.posX * (this.source.buffer.duration / intersectedBlock.parent.children.length);
	this.amp = amp;

	this.attack = attack * 0.4;
	this.release = release * 0.5;

	if(this.release < 0){
		this.release = 0.1;
	}
	this.spread = highlightRange * 10 / intersectedBlock.parent.children.length;

	var plusOrMinus = Math.random() < 0.5 ? -1 : 1;
	this.randomoffset = plusOrMinus * Math.random() * this.spread;
	this.playhead = Math.min(Math.max(this.offset + this.randomoffset, 0), this.source.buffer.duration);

	this.source.start(this.now, this.playhead, this.attack + this.release);
	this.gain.gain.setValueAtTime(0.0, this.now);
	this.gain.gain.linearRampToValueAtTime(this.amp, this.now + this.attack);
	this.gain.gain.linearRampToValueAtTime(0.0, this.now + (this.attack +  this.release) );

	this.source.stop(this.now + this.attack + this.release + 0.1);
	let timeOutSeconds = (this.attack + this.release) * 1000;
	var this_ = this;
	setTimeout(function(){
		this_.gain.disconnect();
	},timeOutSeconds + 200);
}

function voice(){

}

voice.prototype.playVoice = function(intersectedBlock){

	this.grains = [];
	this.graincount = 0;

	var that = this;
	this.play = function(){

		var g = new grain(intersectedBlock);
		that.grains[that.graincount] = g;
		that.graincount+=1;

		if(that.graincount > 20){
			that.graincount = 0;
		}

		this.dens = mapRange(density,1,0,0,1);
		this.interval = (this.dens * 500) + 70;
		that.timeout = setTimeout( that.play, this.interval );
	}
	this.play();
}

voice.prototype.stopVoice = function(){
	clearTimeout(this.timeout);
}

function mapRange(value, low1, high1, low2, high2) {
	return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}
