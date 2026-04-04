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
            for(var i = -highlightRange; i < highlightRange + 1; i++){
                var previousID = Math.max(Math.min(
                    touch.previouslyIntersected[j].index - i,
                    touch.previouslyIntersected[j].parent.children.length - 1
                ), 0);
                touch.previouslyIntersected[j].parent.children[previousID].material.color.setHex(0x00ccff);
                touch.previouslyIntersected[j].parent.children[previousID].scale.z = 1;
            }
        }
        touch.previouslyIntersected = [];

        var currentParentUUIDs = [];

        for(var l = 0; l < intersects.length; l++){
            if(!intersects[l].object.parent.buffer) continue;
            var intersected = intersects[l].object;
            var parentUUID = intersected.parent.uuid;
            currentParentUUIDs.push(parentUUID);

            if(deleteMode){
                scene.remove(intersected.parent);
                toggleDeleteMode();
                if(touch.voices[parentUUID]){
                    touch.voices[parentUUID].stopVoice();
                    touch.voices[parentUUID].isPlaying = false;
                    delete touch.voices[parentUUID];
                }
            } else {
                // If this touch doesn't have a voice for this parent, create one
                if(!touch.voices[parentUUID]){
                    touch.voices[parentUUID] = new voice();
                    touch.voices[parentUUID].playVoice(intersected);
                } else {
                    var currentVoiceKeys = [];

                    for(var l = 0; l < intersects.length; l++){

                        if(!intersects[l].object.parent.buffer) continue;

                        var intersected = intersects[l].object;
                        var parentUUID = intersected.parent.uuid;
                        var voiceKey = parentUUID + '_' + l;
                        currentParentUUIDs.push(parentUUID);
                        currentVoiceKeys.push(voiceKey);

                        if(deleteMode){
                            scene.remove(intersected.parent);
                            toggleDeleteMode();
                            // Stop all voices for this parent
                            for(var key in touch.voices){
                                if(key.indexOf(parentUUID) === 0){
                                    touch.voices[key].stopVoice();
                                    touch.voices[key].isPlaying = false;
                                    delete touch.voices[key];
                                }
                            }
                        } else {
                            if(!touch.voices[voiceKey]){
                                touch.voices[voiceKey] = new voice();
                                touch.voices[voiceKey].playVoice(intersected);
                            } else {
                                touch.voices[voiceKey].intersectedBlock = intersected;
                            }

                            for(var i = -highlightRange; i < highlightRange + 1; i++){
                                var gradient = (highlightRange - Math.abs(i)) / 7;
                                var ID = Math.max(Math.min(
                                    intersected.index - i,
                                    intersected.parent.children.length - 1
                                ), 0);
                                intersected.parent.children[ID].material.color.setRGB(gradient * 2, gradient * 0.8, 0.655);
                                intersected.parent.children[ID].scale.z = 1.5 + gradient;
                            }

                            touch.previouslyIntersected.push(intersected);
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

                for(var i = -highlightRange; i < highlightRange + 1; i++){
                    var gradient = (highlightRange - Math.abs(i)) / 7;
                    var ID = Math.max(Math.min(
                        intersected.index - i,
                        intersected.parent.children.length - 1
                    ), 0);
                    intersected.parent.children[ID].material.color.setRGB(gradient * 2, gradient * 0.8, 0.655);
                    intersected.parent.children[ID].scale.z = 1.5 + gradient;
                }

                touch.previouslyIntersected[l] = intersected;
            }
        }

        // Stop voices for parents this touch is no longer intersecting
        for(var key in touch.voices){
            if(currentParentUUIDs.indexOf(key) === -1){
                touch.voices[key].stopVoice();
                touch.voices[key].isPlaying = false;
                delete touch.voices[key];
            }
        }
    }
}