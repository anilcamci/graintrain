let touches = [];

function onTouchStart(event){

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

        // Reset pool and scheduler for new context
        grainPool = null;
        scheduler = null;
    }

    if (!isTouchInterface) isTouchInterface = true;

    for(var i = 0; i < event.changedTouches.length; i++){

        let scaledPointer = getScaledPointer(event.changedTouches[i]);
        let raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(scaledPointer, camera);

        event.changedTouches[i].previouslyIntersected = [];
        event.changedTouches[i].previouslyIntersectedParents = [];
        event.changedTouches[i].raycaster = raycaster;
        touches.push(event.changedTouches[i]);

        if(addMode){
            waveformPath.beginAt(getInteractionPoint(scaledPointer));
        }

        if(moveMode){
            var intersects = touches[touches.length - 1].raycaster.intersectObject(floor);
            touches[touches.length - 1].interactionPoint = intersects[0].point;
            touches[touches.length - 1].interactionOffset = intersects[0].point;
            intersects = touches[touches.length - 1].raycaster.intersectObjects(scene.children, true);
            if (intersects.length) touches[touches.length - 1].draggedObject = intersects[0].object.parent;
        }

        intersects = [];
        touchWave(touches[touches.length - 1]);
    }
}

function onTouchEnd(event){

    for(var i = 0; i < event.changedTouches.length; i++){
        for(var j = 0; j < touches.length; j++){
            if(event.changedTouches[i].identifier == touches[j].identifier){

                // Stop all voices for this touch
                for(var k = 0; k < touches[j].previouslyIntersectedParents.length; k++){
                    var parent = touches[j].previouslyIntersectedParents[k];
                    if(parent.voice){
                        parent.voice.stopVoice();
                        parent.voice.isPlaying = false;
                        parent.voice = null;
                    }
                }

                // Reset visual highlighting
                for(var k = 0; k < touches[j].previouslyIntersected.length; k++){
                    for(var l = -highlightRange; l < highlightRange + 1; l++){
                        var previousID = Math.max(Math.min(
                            touches[j].previouslyIntersected[k].index - l,
                            touches[j].previouslyIntersected[k].parent.children.length - 1
                        ), 0);
                        touches[j].previouslyIntersected[k].parent.children[previousID].material.color.setHex(0x00ccff);
                        touches[j].previouslyIntersected[k].parent.children[previousID].scale.z = 1;
                    }
                }

                touches.splice(j, 1);
                break;
            }
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
                event.changedTouches[i].previouslyIntersected = touches[j].previouslyIntersected;
                event.changedTouches[i].previouslyIntersectedParents = touches[j].previouslyIntersectedParents;
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

    if(moveMode){
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

        var currentIntersectedParents = [];

        // Paint and trigger newly interacted objects
        for(var l = 0; l < intersects.length; l++){

            intersected = intersects[l].object;
            currentIntersectedParents.push(intersected.parent);

            if(deleteMode){
                scene.remove(intersected.parent);
                toggleDeleteMode();
                if(intersected.parent.voice){
                    intersected.parent.voice.stopVoice();
                    intersected.parent.voice.isPlaying = false;
                    intersected.parent.voice = null;
                }
            } else {
                // If this parent doesn't have a voice yet, create one
                if(intersected.parent.voice == null){
                    intersected.parent.voice = new voice();
                    intersected.parent.voice.playVoice(intersected);
                } else {
                    // Voice exists — update the intersected block
                    // so grains play from the new position
                    intersected.parent.voice.intersectedBlock = intersected;
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

        // Stop voices for parents no longer being touched
        for(var m = 0; m < touch.previouslyIntersectedParents.length; m++){
            var parent = touch.previouslyIntersectedParents[m];
            if(currentIntersectedParents.indexOf(parent) === -1 && parent.voice){
                parent.voice.stopVoice();
                parent.voice.isPlaying = false;
                parent.voice = null;
            }
        }

        touch.previouslyIntersectedParents = currentIntersectedParents;
    }
}