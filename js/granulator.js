window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext;
var context = new AudioContext();

//master gain node
var master = context.createGain();
master.connect(context.destination);

//control initial settings
var attack = 0.40;
var release = 0.40;
var density = 1.0;
var spread = 0.2;
var trans = 1;
var amp = 0.5;

function grain(intersectedBlock) {

	var that = this; //for scope issues
	this.now = context.currentTime; //update the time value
	//create the source
	this.source = context.createBufferSource();
	this.source.playbackRate.value = this.source.playbackRate.value * trans;
	this.source.buffer = intersectedBlock.parent.buffer;

	//create the gain for enveloping
	this.gain = context.createGain();
  this.source.connect(this.gain);
	this.gain.connect(master);

	//update the position and calcuate the offset
	this.posX = intersectedBlock.index;
	this.offset = this.posX * (this.source.buffer.duration / intersectedBlock.parent.children.length); //pixels to seconds
	this.amp = amp;
	//parameters
	this.attack = attack * 0.4;
	this.release = release * 1.5;

	if(this.release < 0){
		this.release = 0.1; // 0 - release causes mute for some reason
	}
	this.spread = spread;

	this.randomoffset = Math.max((Math.random() * this.spread) - (this.spread / 2), 0); //in seconds
	///envelope
	this.source.start(this.now, this.offset + this.randomoffset, this.attack + this.release); //parameters (when,offset,duration)
	this.gain.gain.setValueAtTime(0.0, this.now);
	this.gain.gain.linearRampToValueAtTime(this.amp,this.now + this.attack);
	this.gain.gain.linearRampToValueAtTime(0,this.now + (this.attack +  this.release) );

	//garbage collection
	this.source.stop(this.now + this.attack + this.release + 0.1);
	var tms = (this.attack + this.release) * 1000; //calculate the time in miliseconds
	setTimeout(function(){
		that.gain.disconnect();
	},tms + 200);
}
