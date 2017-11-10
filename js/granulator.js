window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext;
let context = new AudioContext();

let master = context.createGain();
master.connect(context.destination);

let attack = 0.40;
let release = 0.40;
let density = 0.85;
let spread = 0.2;
let trans = 1;
let amp = 0.3;

function grain(intersectedBlock) {

	this.now = context.currentTime;

	this.source = context.createBufferSource();
	this.source.playbackRate.value = this.source.playbackRate.value * trans;
	this.source.buffer = intersectedBlock.parent.buffer;

	this.gain = context.createGain();
  this.source.connect(this.gain);
	this.gain.connect(master);

	this.posX = intersectedBlock.index;
	this.offset = this.posX * (this.source.buffer.duration / intersectedBlock.parent.children.length); //pixels to seconds
	this.amp = amp;

	this.attack = attack * 0.4;
	this.release = release * 0.5;

	if(this.release < 0){
		this.release = 0.1;
	}
	this.spread = spread;

	this.randomoffset = Math.max((Math.random() * this.spread) - (this.spread / 2), 0);

	this.source.start(this.now, this.offset + this.randomoffset, this.attack + this.release);
	this.gain.gain.setValueAtTime(0.0, this.now);
	this.gain.gain.linearRampToValueAtTime(this.amp ,this.now + this.attack);
	this.gain.gain.linearRampToValueAtTime(0,this.now + (this.attack +  this.release) );

	this.source.stop(this.now + this.attack + this.release + 0.1);
	let timeOutSeconds = (this.attack + this.release) * 1000;
	var this_ = this;
	setTimeout(function(){
		this_.gain.disconnect();
	},timeOutSeconds + 200);
}

function voice(){
	//this.toichID = id;
}

voice.prototype.playVoice = function(intersectedBlock){

	this.grains = [];
	this.graincount = 0;

	var that = this; //for scope issues
	this.play = function(){
		//create new grain
		var g = new grain(intersectedBlock);

		//push to the array
		that.grains[that.graincount] = g;
		that.graincount+=1;

		if(that.graincount > 20){
			that.graincount = 0;
		}
		//next interval
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

function createAudioContext () {
	var AudioCtor = window.AudioContext || window.webkitAudioContext

	// desiredSampleRate = typeof desiredSampleRate === 'number'
	// 	? desiredSampleRate
	// 	: 44100
	var context_ = new AudioCtor()

	// Check if hack is necessary. Only occurs in iOS6+ devices
	// and only when you first boot the iPhone, or play a audio/video
	// with a different sample rate
	// if (/(iPhone|iPad)/i.test(navigator.userAgent) &&
	// 		context_.sampleRate !== desiredSampleRate) {
	// 	var buffer = context_.createBuffer(1, 1, desiredSampleRate)
	// 	var dummy = context_.createBufferSource()
	// 	dummy.buffer = buffer
	// 	dummy.connect(context_.destination)
	// 	dummy.start(0)
	// 	dummy.disconnect()
  //
	// 	context_.close() // dispose old context
	// 	context_ = new AudioCtor()
	// }

	return context_;
}
