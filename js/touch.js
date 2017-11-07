let touches = [];

function onTouchStart(event){

  console.log(event.changedTouches);

  for(var i = 0; i < event.changedTouches.length; i++){

    let scaledPointer = getScaledPointer(event.changedTouches[i]);
    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera( scaledPointer, camera );

    event.changedTouches[i].previouslyIntersected = [];
    event.changedTouches[i].raycaster = raycaster;
    touches.push(event.changedTouches[i])

    if(addMode){
      trajectory.beginAt(getInteractionPoint(scaledPointer));
    }

    touchWave(touches[touches.length - 1]);
  }

  // var color = '#' + 'EE0000';
  // renderer.setClearColor(color);
}

function onTouchEnd(event){
  console.log(event.changedTouches);

  for(var i = 0; i < event.changedTouches.length; i++){
    for(var j = 0; j < touches[j].length; j++){
      if( event.changedTouches[i].identifier === touches[j].identifier){

        for(var j = 0; j < touches[j].previouslyIntersected.length; j++){

          touches[j].previouslyIntersected[j].voice.stopVoice();

          for( var i = -highlightRange; i < highlightRange + 1; i++){
            var previousID = Math.max(Math.min(touches[j].previouslyIntersected[j].index - i, touches[j].previouslyIntersected[j].parent.children.length - 1), 0);
            touches[j].previouslyIntersected[j].parent.children[previousID].material.color.setHex( 0x00ccff );
            touches[j].previouslyIntersected[j].parent.children[previousID].scale.z = 1;
          }
        }

        touches.splice(j, 1);
      }
    }
  }

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

  for(var i = 0; i < event.changedTouches.length; i++){
    for(var j = 0; j < touches[j].length; j++){
      if( event.changedTouches[i].identifier === touches[j].identifier){
        event.changedTouches[i].previouslyIntersected = touches[j].previouslyIntersected;
        let scaledPointer = getScaledPointer(event.changedTouches[i]);
        touches[j].raycaster.setFromCamera( scaledPointer, camera );
        touchWave(touches[j]);
      }
    }

    var touch = event.changedTouches[0];

    let scaledPointer = getScaledPointer(touch);

    if(addMode){
      trajectory.addPoint(getInteractionPoint(scaledPointer));
    }
  }
}

function touchWave(touch){

  // var interactionPoint = getInteractionPoint(scaledPointer);


  var intersects = touch.raycaster.intersectObjects(scene.children, true);


  // if( editMode && mousePressed){
  //   const dx = interactionPoint.x - interactionOffsetX;
  //   const dy = interactionPoint.y - interactionOffsetY;
  //   interactionOffsetX = interactionPoint.x;
  //   interactionOffsetY = interactionPoint.y;
  //   draggedObject.position.x += dx;
  //   draggedObject.position.y += dy;
  // }else
  if(!addMode){

    // draggedObjectIndex = null;

    // Reset previously painted interactions
    for(var j = 0; j < touch.previouslyIntersected.length; j++){

      touch.previouslyIntersected[j].voice.stopVoice();

      for( var i = -highlightRange; i < highlightRange + 1; i++){
        var previousID = Math.max(Math.min(touch.previouslyIntersected[j].index - i, touch.previouslyIntersected[j].parent.children.length - 1), 0);
        touch.previouslyIntersected[j].parent.children[previousID].material.color.setHex( 0x00ccff );
        touch.previouslyIntersected[j].parent.children[previousID].scale.z = 1;
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

      touch.previouslyIntersected.push(intersected);
    }
  }
}
