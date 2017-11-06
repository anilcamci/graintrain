function onTouchStart(event){

  console.log(event);

  for(var i = 0; i < event.touches.length; i++){

    var touch = event.touches[i];

    let scaledPointer = getScaledPointer(touch);

    if(addMode){
      trajectory.beginAt(getInteractionPoint(scaledPointer));
    }

    touchWave(scaledPointer);
  }

  // var color = '#' + 'EE0000';
  // renderer.setClearColor(color);
}

function onTouchEnd(event){

  if(context.state !== "running"){
    context = createAudioContext();
    master = context.createGain();
    master.connect(context.destination);
  }

  if(addMode){
    var obj = trajectory.createObject();
    trajectories.push(obj.spline);
    drawWave(obj.spline);
    addMode = false;
  }
}

function onTouchMove(event){

  event.preventDefault();

  console.log(event);

  for(var i = 0; i < event.touches.length; i++){

    var touch = event.touches[i];

    let scaledPointer = getScaledPointer(touch);

    if(addMode){
      trajectory.addPoint(getInteractionPoint(scaledPointer));
    }

    touchWave(scaledPointer);
  }
}

function touchWave(scaledPointer){

  var interactionPoint = getInteractionPoint(scaledPointer);

  var raycaster = new THREE.Raycaster();
  raycaster.setFromCamera( scaledPointer, camera );
  var intersects = raycaster.intersectObjects(scene.children, true);

  var previo

  if( editMode && mousePressed){
    const dx = interactionPoint.x - interactionOffsetX;
    const dy = interactionPoint.y - interactionOffsetY;
    interactionOffsetX = interactionPoint.x;
    interactionOffsetY = interactionPoint.y;
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

      let intersected = intersects[l].object;

      intersected.voice = new voice();
      intersected.voice.playVoice(intersected);

      for( var i = -highlightRange; i < highlightRange + 1; i++){
        var gradient = (highlightRange - Math.abs(i))/7;
        var ID = Math.max(Math.min(intersected.index - i, intersected.parent.children.length - 1), 0);
        intersected.parent.children[ID].material.color.setRGB( gradient*2, gradient*0.8, 0.655 );
        intersected.parent.children[ID].scale.z = 1.5 + gradient;
      }

      previouslyIntersected.push(intersected);
    }
  }
}
