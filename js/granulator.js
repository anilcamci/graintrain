// granulator.js

let attack = 0.40;
let release = 0.40;
let density = 0.5;
let spread = 0.2;
let pitch = 1;
let amp = 0.3;
let lpf = 1;

// ============================================
// GRAIN POOL
// ============================================

const POOL_SIZE = 60;

function GrainPool(audioContext, destination) {
    this.context = audioContext;
    this.destination = destination;
    this.pool = [];
    this.index = 0;

    for (var i = 0; i < POOL_SIZE; i++) {
        this.pool.push(new PooledGrain(this.context, this.destination));
    }
}

GrainPool.prototype.trigger = function(intersectedBlock) {
    var g = this.pool[this.index];
    this.index = (this.index + 1) % POOL_SIZE;
    g.trigger(intersectedBlock);
};

// ============================================
// POOLED GRAIN
// ============================================

function PooledGrain(audioContext, destination) {
    this.context = audioContext;
    this.destination = destination;
    this.activeSource = null;

    this.gain = this.context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(this.destination);
}

PooledGrain.prototype.trigger = function(intersectedBlock) {
    var ctx = this.context;
    var now = ctx.currentTime;
    var startTime = now + 0.002;

    var baseSize = (attack + release) * 0.25;
    var pitchScale = Math.max(pitch, 0.5);
    var scaledSize = baseSize / pitchScale;
    var grainAttack = scaledSize;
    var grainRelease = scaledSize;
    var duration = grainAttack + grainRelease;

    var unscaledDuration = baseSize * 2;
    var dens = Math.pow(mapRange(density, 1, 0, 0, 1), 2);
    var interval = Math.max(dens * 0.25, MIN_GRAIN_INTERVAL);
    var overlapCount = Math.max(1, unscaledDuration / interval);
    var grainAmp = (amp * 2) / Math.pow(overlapCount, 0.3);

    var buffer = intersectedBlock.parent.buffer;
    var numChildren = intersectedBlock.parent.children.length;
    var offset = intersectedBlock.index * (buffer.duration / numChildren);

    var spreadAmount = highlightRange * 10 / numChildren;
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
    source.playbackRate.value = pitch;
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

// ============================================
// AUDIO-CLOCK SCHEDULER
// ============================================
// Uses a look-ahead approach: the main thread wakes up
// periodically and schedules grains into the future using
// the audio clock. Even if the main thread is late, grains
// are pre-scheduled with precise audio-clock timing.

const SCHEDULE_AHEAD = 0.05;  // Schedule 50ms into the future
const SCHEDULER_TICK = 25;     // Main thread wakes every 25ms

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
const MAX_CONCURRENT_GRAINS = 40;

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

            var dens = Math.pow(mapRange(density, 1, 0, 0, 1), 2);
            var interval = Math.max(dens * 0.25, MIN_GRAIN_INTERVAL);

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

// ============================================
// GLOBALS
// ============================================

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

// ============================================
// VOICE
// ============================================

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