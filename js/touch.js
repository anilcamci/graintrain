let touches = [];

function onTouchStart(event){
    event.preventDefault();
    
    if(context.state !== "running"){
        context = new AudioContext({ latencyHint: 'playback' });
        
        master = context.createGain();

        lowPassFilter = context.createBiquadFilter();
        lowPassFilter.type = "lowpass";
        lowPassFilter.frequency.value = logarithmicSlider(brightnessSlider.value);

        limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -1;
        limiter.knee.value = 1;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.05;

        reverb = context.createConvolver();
        loadImpulse();
        dryGain = context.createGain();
        wetGain = context.createGain();
        dryGain.gain.value = 1 - reverbSlider.value / 100;
        wetGain.gain.value = reverbSlider.value / 100;

        master.connect(lowPassFilter);
        lowPassFilter.connect(dryGain);
        lowPassFilter.connect(wetGain);
        dryGain.connect(limiter);
        wetGain.connect(reverb);
        reverb.connect(limiter);
        limiter.connect(context.destination);

        grainPool = null;
        scheduler = null;
    }

    if (!isTouchInterface) isTouchInterface = true;

    for(var i = 0; i < event.changedTouches.length; i++){

        let scaledPointer = getScaledPointer(event.changedTouches[i]);
        let raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(scaledPointer, camera);

        // Create a tracked touch object with its own state
        var trackedTouch = {
            identifier: event.changedTouches[i].identifier,
            raycaster: raycaster,
            previouslyIntersected: [],
            voices: {},           // keyed by parent.uuid
            interactionPoint: null,
            interactionOffset: null,
            draggedObject: null
        };

        touches.push(trackedTouch);

        if(addMode){
            waveformPath.beginAt(getInteractionPoint(scaledPointer));
        }

        if(moveMode || duplicateMode){
            var intersects = trackedTouch.raycaster.intersectObject(floor);
            trackedTouch.interactionPoint = intersects[0].point;
            trackedTouch.interactionOffset = intersects[0].point;
            intersects = trackedTouch.raycaster.intersectObjects(scene.children, true);
            if (intersects.length) {
                if(intersects[0].object.parent.buffer){
                    if(duplicateMode){
                        trackedTouch.draggedObject = duplicateWaveform(intersects[0].object.parent);
                    } else {
                        trackedTouch.draggedObject = intersects[0].object.parent;
                    }
                }
            }
        }

        touchWave(trackedTouch);
    }
}

function onTouchEnd(event){
    event.preventDefault();
    for(var i = 0; i < event.changedTouches.length; i++){
        for(var j = 0; j < touches.length; j++){
            if(event.changedTouches[i].identifier == touches[j].identifier){

                var touch = touches[j];

                // Stop all voices owned by this specific touch
                for(var key in touch.voices){
                    if(touch.voices[key]){
                        touch.voices[key].stopVoice();
                        touch.voices[key].isPlaying = false;
                    }
                }

                // Reset visual highlighting
                for(var k = 0; k < touch.previouslyIntersected.length; k++){
                    for(var l = -highlightRange; l < highlightRange + 1; l++){
                        var previousID = Math.max(Math.min(
                            touch.previouslyIntersected[k].index - l,
                            touch.previouslyIntersected[k].parent.children.length - 1
                        ), 0);
                        touch.previouslyIntersected[k].parent.children[previousID].material.color.setHex(0x00ccff);
                        touch.previouslyIntersected[k].parent.children[previousID].scale.z = 1;
                    }
                }

                touches.splice(j, 1);
                if(touches.length === 0 && localMode){
                    sliderOwner = null;
                }
                
                break;
            }
        }

        if(duplicateMode && touch.draggedObject){
            touch.draggedObject = null;
            toggleDuplicateMode();
        }
    }

    if(addMode){
        var obj = waveformPath.createObject();
        waveformPaths.push(obj.spline);
        drawWave(obj.spline);
        toggleAddMode();
    }
}

function onTouchMove(event){
    event.preventDefault();
    for(var i = 0; i < event.changedTouches.length; i++){
        for(var j = 0; j < touches.length; j++){
            if(event.changedTouches[i].identifier == touches[j].identifier){
                let scaledPointer = getScaledPointer(event.changedTouches[i]);
                touches[j].raycaster.setFromCamera(scaledPointer, camera);
                var intersects = touches[j].raycaster.intersectObject(floor);
                touches[j].interactionPoint = intersects[0].point;
                touchWave(touches[j]);
            }
        }

        if(addMode){
            var touch = event.changedTouches[0];
            let scaledPointer = getScaledPointer(touch);
            waveformPath.addPoint(getInteractionPoint(scaledPointer));
        }
    }
}

function touchWave(touch){

    var intersects = touch.raycaster.intersectObjects(scene.children, true);

    if(moveMode || duplicateMode){
        const dx = touch.interactionPoint.x - touch.interactionOffset.x;
        const dy = touch.interactionPoint.y - touch.interactionOffset.y;
        touch.interactionOffset.x = touch.interactionPoint.x;
        touch.interactionOffset.y = touch.interactionPoint.y;
        if(touch.draggedObject){
            touch.draggedObject.position.x += dx;
            touch.draggedObject.position.y += dy;
        }
    } else if(!addMode){

        // Reset previously painted interactions
        for(var j = 0; j < touch.previouslyIntersected.length; j++){
            if(!touch.previouslyIntersected[j] || !touch.previouslyIntersected[j].parent) continue;
            var parent = touch.previouslyIntersected[j].parent;

            var prevSpread = parent.params ?
                Math.ceil(Math.max(1, highlightRange + parent.params.spreadOffset)) :
                Math.ceil(highlightRange);

            for(var i = -prevSpread; i < prevSpread + 1; i++){
                var previousID = Math.max(Math.min(
                    touch.previouslyIntersected[j].index - i,
                    parent.children.length - 1
                ), 0);

                if(parent.children[previousID]){
                    parent.children[previousID].material.color.setHex(0x00ccff);
                    parent.children[previousID].scale.z = 1;
                }
            }
        }
        touch.previouslyIntersected = [];

        // Group intersections by parent, collecting all hit indices
        var parentHits = {};

        for(var l = 0; l < intersects.length; l++){
            if(!intersects[l].object.parent.buffer) continue;

            var intersected = intersects[l].object;
            var parentUUID = intersected.parent.uuid;

            // Handle delete mode immediately and return
            if(deleteMode){
                // Stop any active voices for this touch on this parent
                for(var key in touch.voices){
                    if(key.indexOf(parentUUID) === 0){
                        touch.voices[key].stopVoice();
                        touch.voices[key].isPlaying = false;
                        delete touch.voices[key];
                    }
                }
                scene.remove(intersected.parent);
                toggleDeleteMode();
                return;
            }

            lastInteractedWave = intersected.parent;
            if(localMode && sliderOwner === null && lastInteractedWave.params){
                sliderOwner = lastInteractedWave;
                loadParamsToSliders(sliderOwner.params);
            }

            if(!parentHits[parentUUID]){
                parentHits[parentUUID] = {
                    parent: intersected.parent,
                    hits: []
                };
            }
            parentHits[parentUUID].hits.push(intersected);

            var localSpread = intersected.parent.params ?
                Math.ceil(Math.max(1, highlightRange + intersected.parent.params.spreadOffset)) :
                Math.ceil(highlightRange);

            for(var i = -localSpread; i < localSpread + 1; i++){
                var gradient = (localSpread - Math.abs(i)) / 7;
                var ID = Math.max(Math.min(
                    intersected.index - i,
                    intersected.parent.children.length - 1
                ), 0);

                if(intersected.parent.children[ID]){
                    intersected.parent.children[ID].material.color.setRGB(gradient * 2, gradient * 0.8, 0.655);
                    intersected.parent.children[ID].scale.z = 1.2 + gradient;
                }
            }

            touch.previouslyIntersected.push(intersected);
        }

        // For each parent, assign voices to each hit region
        var currentVoiceKeys = [];

        for(var uuid in parentHits){
            var hits = parentHits[uuid].hits;

            // Sort hits by index to get stable ordering
            hits.sort(function(a, b){ return a.index - b.index; });

            // Group nearby hits (within highlightRange) into single regions
            var regions = [];
            var currentRegion = [hits[0]];

            for(var h = 1; h < hits.length; h++){
                if(hits[h].index - currentRegion[currentRegion.length - 1].index <= highlightRange * 2){
                    currentRegion.push(hits[h]);
                } else {
                    regions.push(currentRegion);
                    currentRegion = [hits[h]];
                }
            }
            regions.push(currentRegion);

            // Each region gets a voice keyed by parent UUID and region index
            for(var r = 0; r < regions.length; r++){
                var regionCenter = regions[r][Math.floor(regions[r].length / 2)];
                // Round to nearest chunk so small movements don't change the key
                var stableIndex = Math.round(regionCenter.index / highlightRange) * highlightRange;
                var voiceKey = uuid + '_' + stableIndex;
                currentVoiceKeys.push(voiceKey);

                if(!touch.voices[voiceKey]){
                    touch.voices[voiceKey] = new voice();
                    touch.voices[voiceKey].playVoice(regionCenter);
                } else {
                    touch.voices[voiceKey].intersectedBlock = regionCenter;
                }
            }
        }

        // Stop voices no longer active
        for(var key in touch.voices){
            if(currentVoiceKeys.indexOf(key) === -1){
                touch.voices[key].stopVoice();
                touch.voices[key].isPlaying = false;
                delete touch.voices[key];
            }
        }
    }
}