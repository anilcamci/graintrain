window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext;
let context = new AudioContext();

//master gain node
let master = context.createGain();

//control initial settings
let attack = 0.40;
let release = 0.40;
let density = 1.0;
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
	this.gain.gain.linearRampToValueAtTime(this.amp,this.now + this.attack);
	this.gain.gain.linearRampToValueAtTime(0,this.now + (this.attack +  this.release) );

	this.source.stop(this.now + this.attack + this.release + 0.1);
	let timeOutSeconds = (this.attack + this.release) * 1000;
	var this_ = this;
	setTimeout(function(){
		this_.gain.disconnect();
	},timeOutSeconds + 200);
}
