function onMouseDown(event){
    if(!isTouchInterface){
        document.getElementById('globalContainer').style.pointerEvents = 'none';

        mousePressed = true;

        let scaledPointer = getScaledPointer(event);

        if( addMode ) waveformPath.beginAt(getInteractionPoint(scaledPointer));

        if( moveMode && currentlyIntersecting ){
            draggedObject = intersected.parent;
            setInteractionOffset(getInteractionPoint(scaledPointer));
        }

        if( duplicateMode && currentlyIntersecting ){
            var clone = duplicateWaveform(intersected.parent);
            draggedObject = clone;
            setInteractionOffset(getInteractionPoint(scaledPointer));
        }

        if( deleteMode && currentlyIntersecting ){
            scene.remove(intersected.parent);
            if(intersected.parent.voice) intersected.parent.voice.stopVoice();
            previouslyIntersected = [];
            toggleDeleteMode();
        }
    }
}

function onMouseUp(event){
    if(!isTouchInterface){
        document.getElementById('globalContainer').style.pointerEvents = 'auto';

        mousePressed = false;

        if(addMode){
            var obj = waveformPath.createObject();
            waveformPaths.push(obj.spline);
            drawWave(obj.spline);
            toggleAddMode();
        }

        if(duplicateMode && draggedObject){
            draggedObject = null;
            toggleDuplicateMode();
        }
    }
}

function onMouseMove(event){
  if(!isTouchInterface){
    let scaledPointer = getScaledPointer(event);

    if( mousePressed && addMode ) waveformPath.addPoint(getInteractionPoint(scaledPointer));

    interactWithWave(scaledPointer);
  }
}

function interactWithWave(scaledPointer){

  var interactionPoint = getInteractionPoint(scaledPointer);

  var raycaster = new THREE.Raycaster();
  raycaster.setFromCamera( scaledPointer, camera );
  var intersects = raycaster.intersectObjects(scene.children, true);
  

  if( (moveMode || duplicateMode) && mousePressed && currentlyIntersecting){
    const dx = interactionPoint.x - interactionOffset.x;
    const dy = interactionPoint.y - interactionOffset.y;
    interactionOffset.x = interactionPoint.x;
    interactionOffset.y = interactionPoint.y;
    draggedObject.position.x += dx;
    draggedObject.position.y += dy;
  }else if(!addMode){

    draggedObjectIndex = null;

    // Reset previously painted interactions
    for(var j = 0; j < previouslyIntersected.length; j++){
      for( var i = -highlightRange; i < highlightRange + 1; i++){
        var previousID = Math.max(Math.min(previouslyIntersected[j].index - i, previouslyIntersected[j].parent.children.length - 1), 0);
        previouslyIntersected[j].parent.children[previousID].material.color.setHex( 0x00ccff );
        previouslyIntersected[j].parent.children[previousID].scale.z = 1;
      }
    }
    
    for(var l = 0; l < intersects.length; l++){
      if(!intersects[l].object.parent.buffer) continue;
      currentlyIntersecting = true;
      intersected = intersects[l].object;
      
      intersectedParents.push(intersected.parent);

      if(intersected.parent.voice == null){
         intersected.parent.voice = new voice();
         voices.push(intersected.parent.voice);
      }
      intersected.parent.voice.playVoice(intersected);
      previouslyIntersectedParents.push(intersected.parent);

      // Paint the newly interacted objects
      for( var i = -highlightRange; i < highlightRange + 1; i++){
        var gradient = (highlightRange - Math.abs(i))/7;
        var ID = Math.max(Math.min(intersected.index - i, intersected.parent.children.length - 1), 0);
        intersected.parent.children[ID].material.color.setRGB( gradient*2, gradient*0.8, 0.655 );
        intersected.parent.children[ID].scale.z = 1.1 + gradient;
      }
      previouslyIntersected[l] = intersected;
    }
    
    if(intersects.length == 0){ 
      currentlyIntersecting = false;
      voices = [];
    }
  }

  for (const element of previouslyIntersectedParents) {
    if(intersectedParents.indexOf(element) == -1){ 
      element.voice.stopVoice();
      element.voice.isPlaying = false;
      previouslyIntersectedParents.splice(previouslyIntersectedParents.indexOf(element), 1);
    }
  }

  intersectedParents = [];
  
}

function setInteractionOffset(interactionPoint) {
  interactionOffset = new THREE.Vector2();
  interactionOffset.x = interactionPoint.x;
  interactionOffset.y = interactionPoint.y;
  return interactionOffset;
}
