let attack = 0.40;
let release = 0.40;
let density = 0.5;
let spread = 0.2;
let pitch = 1;
let lpf = 1;

const POOL_SIZE = 400;

function GrainPool(audioContext, destination) {
    this.context = audioContext;
    this.destination = destination;
    this.pool = [];
    this.index = 0;
    this.targetSize = POOL_SIZE;

    for (var i = 0; i < 80; i++) {
        this.pool.push(new PooledGrain(this.context, this.destination));
    }

    var self = this;
    var batchSize = 40;
    function growPool() {
        if (self.pool.length < self.targetSize) {
            for (var i = 0; i < batchSize && self.pool.length < self.targetSize; i++) {
                self.pool.push(new PooledGrain(self.context, self.destination));
            }
            setTimeout(growPool, 50);
        }
    }
    setTimeout(growPool, 50);
}

GrainPool.prototype.trigger = function(intersectedBlock) {
    var g = this.pool[this.index];
    this.index = (this.index + 1) % POOL_SIZE;
    g.trigger(intersectedBlock);
};

function PooledGrain(audioContext, destination) {
    this.context = audioContext;
    this.destination = destination;
    this.activeSource = null;
    this.currentBus = null;

    this.gain = this.context.createGain();
    this.gain.gain.value = 0;
}

PooledGrain.prototype.trigger = function(intersectedBlock) {
    var ctx = this.context;
    var now = ctx.currentTime;
    var startTime = now + 0.002;

    var trainBus = intersectedBlock.parent.bus || master;
    if(this.currentBus !== trainBus){
        try { this.gain.disconnect(); } catch(e) {}
        this.gain.connect(trainBus);
        this.currentBus = trainBus;
    }

    var params = intersectedBlock.parent.params;
    var localPitch = params ? Math.max(0.5, Math.min(2, pitch * params.pitchOffset)) : pitch;
    var localAttack = params ? Math.max(0.005, Math.min(0.5, attack + params.attackOffset)) : attack;
    var localRelease = params ? Math.max(0.005, Math.min(0.5, release + params.releaseOffset)) : release;
    var localDensity = params ? Math.max(0, Math.min(1, density + params.densityOffset)) : density;
    var localSpread = params ? Math.max(1, Math.min(10, highlightRange + params.spreadOffset)) : highlightRange;

    var baseSize = (localAttack + localRelease) * 0.25;
    var pitchScale = Math.max(localPitch, 0.5);
    var scaledSize = baseSize / pitchScale;
    var grainAttack = scaledSize;
    var grainRelease = scaledSize;
    var duration = grainAttack + grainRelease;

    var unscaledDuration = baseSize * 2;
    var dens = mapRange(localDensity, 1, 0, 0, 1);
    var interval = Math.max(dens * 0.1, MIN_GRAIN_INTERVAL);
    var overlapCount = Math.max(1, unscaledDuration / interval);
    var grainAmp = (amp * 2) / Math.pow(overlapCount, 0.3);

    var buffer = intersectedBlock.parent.buffer;
    var numChildren = intersectedBlock.parent.children.length;
    var offset = intersectedBlock.index * (buffer.duration / numChildren);

    var blockDuration = buffer.duration / numChildren;
    var spreadAmount = localSpread * blockDuration;
    var plusOrMinus = Math.random() < 0.5 ? -1 : 1;
    var randomOffset = plusOrMinus * Math.random() * spreadAmount;
    var playhead = Math.min(Math.max(offset + randomOffset, 0), buffer.duration);

    if (this.activeSource) {
        try {
            this.activeSource.onended = null;
            this.activeSource.disconnect();
        } catch (e) {}
        this.activeSource = null;
    }

    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = localPitch;
    source.connect(this.gain);
    this.activeSource = source;

    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(0.0, startTime);
    this.gain.gain.linearRampToValueAtTime(grainAmp, startTime + grainAttack);
    this.gain.gain.linearRampToValueAtTime(0.0, startTime + duration);

    source.start(startTime, playhead);
    source.stop(startTime + duration + 0.01);

    var self = this;
    source.onended = function() {
        try {
            source.disconnect();
        } catch (e) {}
        if (self.activeSource === source) {
            self.activeSource = null;
        }
    };
};

const SCHEDULE_AHEAD = 0.05;
const SCHEDULER_TICK = 25;

function AudioScheduler(audioContext) {
    this.context = audioContext;
    this.voices = [];
    this.running = false;
    this.timerID = null;
}

AudioScheduler.prototype.start = function() {
    if (this.running) return;
    this.running = true;
    this._tick();
};

AudioScheduler.prototype.stop = function() {
    this.running = false;
    if (this.timerID !== null) {
        clearTimeout(this.timerID);
        this.timerID = null;
    }
};

AudioScheduler.prototype.addVoice = function(v) {
    if (this.voices.indexOf(v) === -1) {
        this.voices.push(v);
    }
    this.start();
};

AudioScheduler.prototype.removeVoice = function(v) {
    var idx = this.voices.indexOf(v);
    if (idx !== -1) {
        this.voices.splice(idx, 1);
    }
    if (this.voices.length === 0) {
        this.stop();
    }
};

const MIN_GRAIN_INTERVAL = 0.008; // 8ms = 125 grains/sec max
const MAX_CONCURRENT_GRAINS = 100;

AudioScheduler.prototype._tick = function() {
    var now = this.context.currentTime;
    var horizon = now + SCHEDULE_AHEAD;

    for (var i = 0; i < this.voices.length; i++) {
        var v = this.voices[i];
        if (!v.isPlaying) continue;

        if (v.nextGrainTime < now - SCHEDULE_AHEAD) {
            v.nextGrainTime = now;
        }

        var grainsScheduled = 0;

        while (v.nextGrainTime < horizon) {
            grainPool.trigger(v.intersectedBlock);
            grainsScheduled++;

            var params = v.intersectedBlock.parent.params;
            var localDensity = params ? Math.max(0, Math.min(1, density + params.densityOffset)) : density;
            var dens = mapRange(localDensity, 1, 0, 0, 1);
            var interval = Math.max(dens * 0.1, MIN_GRAIN_INTERVAL);

            v.nextGrainTime += interval;

            if (grainsScheduled >= MAX_CONCURRENT_GRAINS) {
                v.nextGrainTime = horizon;
                break;
            }
        }
    }

    var self = this;
    this.timerID = setTimeout(function() {
        self._tick();
    }, SCHEDULER_TICK);
};


// Globals
var grainPool = null;
var scheduler = null;

function initGrainPool() {
    if (!grainPool) {
        grainPool = new GrainPool(context, master);
    }
    if (!scheduler) {
        scheduler = new AudioScheduler(context);
    }
}


// Voice
function voice() {
    this.isPlaying = false;
    this.intersectedBlock = null;
    this.nextGrainTime = 0;
}

voice.prototype.playVoice = function(intersectedBlock) {
    initGrainPool();

    this.intersectedBlock = intersectedBlock;

    if (!this.isPlaying) {
        this.isPlaying = true;
        this.nextGrainTime = context.currentTime;
        scheduler.addVoice(this);
    } else {
        // Voice already playing — just update the target block
        this.intersectedBlock = intersectedBlock;
    }
};

voice.prototype.stopVoice = function() {
    this.isPlaying = false;
    if (scheduler) {
        scheduler.removeVoice(this);
    }
};

function mapRange(value, low1, high1, low2, high2) {
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}