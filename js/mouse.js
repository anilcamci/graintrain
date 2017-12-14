function onMouseDown(event){
  if(!isTouchInterface){
    document.getElementById('globalContainer').style.pointerEvents = 'none';

    mousePressed = true;

    let scaledPointer = getScaledPointer(event);

    if( addMode ) trajectory.beginAt(getInteractionPoint(scaledPointer));

    if( moveMode && intersected){
      draggedObject = intersected.parent;
      setInteractionOffset(getInteractionPoint(scaledPointer));
    }

    if( deleteMode ){
      scene.remove(intersected.parent);
      intersected.voice.stopVoice();
      previouslyIntersected = [];
    }
  }
}

function onMouseUp(event){
  if(!isTouchInterface){
    document.getElementById('globalContainer').style.pointerEvents = 'auto';

    mousePressed = false;

    if(addMode){
      var obj = trajectory.createObject();
      trajectories.push(obj.spline);
      drawWave(obj.spline);
      toggleAddMode();
    }
  }
}

function onMouseMove(event){
  if(!isTouchInterface){
    let scaledPointer = getScaledPointer(event);

    if( mousePressed && addMode) trajectory.addPoint(getInteractionPoint(scaledPointer));

    interactWithWave(scaledPointer);
  }
}

function interactWithWave(scaledPointer){

  var interactionPoint = getInteractionPoint(scaledPointer);

  var raycaster = new THREE.Raycaster();
  raycaster.setFromCamera( scaledPointer, camera );
  var intersects = raycaster.intersectObjects(scene.children, true);

  if( moveMode && mousePressed ){
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
      previouslyIntersected[j].voice.stopVoice();

      for( var i = -highlightRange; i < highlightRange + 1; i++){
        var previousID = Math.max(Math.min(previouslyIntersected[j].index - i, previouslyIntersected[j].parent.children.length - 1), 0);
        previouslyIntersected[j].parent.children[previousID].material.color.setHex( 0x00ccff );
        previouslyIntersected[j].parent.children[previousID].scale.z = 1;
      }
    }

    // Paint the newly interacted objects
    for(var l = 0; l < intersects.length; l++){

      intersected = intersects[l].object;
      intersected.voice = new voice();
      if(!deleteMode) intersected.voice.playVoice(intersected);

      for( var i = -highlightRange; i < highlightRange + 1; i++){
        var gradient = (highlightRange - Math.abs(i))/7;
        var ID = Math.max(Math.min(intersected.index - i, intersected.parent.children.length - 1), 0);
        intersected.parent.children[ID].material.color.setRGB( gradient*2, gradient*0.8, 0.655 );
        intersected.parent.children[ID].scale.z = 1.1 + gradient;
      }

      previouslyIntersected[l] = intersected;
    }

    intersectes = [];
  }
}

function setInteractionOffset(interactionPoint) {
  interactionOffset = new THREE.Vector2();
  interactionOffset.x = interactionPoint.x;
  interactionOffset.y = interactionPoint.y;
  return interactionOffset;
}
