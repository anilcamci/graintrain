window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext;
var context = new AudioContext();

var buffers = []; //global variables for sample files

//master gain node
var master = context.createGain();
master.connect(context.destination);

//control initial settings
var attack = 0.40;
var release = 0.40;
var density = 1.0;
var spread = 0.2;
var reverb = 0.0;
var trans = 1;
var amp = 0.3

function grain(name) {

	var that = this; //for scope issues
	this.now = context.currentTime; //update the time value
	//create the source
	this.source = context.createBufferSource();
	this.source.playbackRate.value = this.source.playbackRate.value * trans;
	this.source.buffer = buffers[intersectedWave];

	//create the gain for enveloping
	this.gain = context.createGain();
  this.source.connect(this.gain);
	this.gain.connect(master);

	//update the position and calcuate the offset
	this.posX = name[0];
	this.offset = this.posX * (buffers[name[1]].duration / visibleObjects[name[1]].children.length); //pixels to seconds

	this.amp = amp;

	//parameters
	this.attack = attack * 0.4;
	this.release = release * 0.5;

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

function spectralCentroid(array) {

	var weigthedAmplitudeSum = 0;
	var amplitudeSum = 0;

	for (var i = 0; i < array.length; i++) {
		weigthedAmplitudeSum += (i + 1) * array[i];
		amplitudeSum += array[i];
	}
	return (weigthedAmplitudeSum / amplitudeSum);
}

//the voice class
function voice(id, bufferIndex){

	this.touchid = id; //the id of the touch event
}

voice.prototype.playmouse = function(name){

	this.grains = [];
	this.grainscount = 0;
	var that = this; //for scope issues

	this.play = function(){
		//create new grain
		var g = new grain(name);

		//push to the array
		that.grains[that.graincount] = g;
		that.graincount+=1;

		if(that.graincount > 20){
			that.graincount = 0;
		}
		//next interval
		this.dens = map_range(density, 1, 0, 0, 1);
		this.interval = (this.dens * 500) + 70;
		that.timeout = setTimeout(that.play, this.interval);
	}

	this.play();
}

//stop method
voice.prototype.stop = function(){

	clearTimeout(this.timeout);
}

function map_range(value, low1, high1, low2, high2) {

    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}
