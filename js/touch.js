let touches = [];

function onTouchStart(event){

  if(context.state !== "running"){
    context = new AudioContext();
    master = context.createGain();
    master.connect(context.destination);
  }

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

    if(moveMode){
      var intersects = touches[touches.length - 1].raycaster.intersectObject( floor );
      touches[touches.length - 1].interactionPoint = intersects[0].point;
      touches[touches.length - 1].interactionOffset = intersects[0].point;
      intersects = touches[touches.length - 1].raycaster.intersectObjects( scene.children, true );
      touches[touches.length - 1].draggedObject = intersects[0].object.parent;
    }

    touchWave(touches[touches.length - 1]);
  }
}

function onTouchEnd(event){

  for(var i = 0; i < event.changedTouches.length; i++){
    for(var j = 0; j < touches.length; j++){
      if( event.changedTouches[i].identifier == touches[j].identifier){
        for(var k = 0; k < touches[j].previouslyIntersected.length; k++){
          touches[j].previouslyIntersected[k].voice.stopVoice();

          for( var l = -highlightRange; l < highlightRange + 1; l++){
            var previousID = Math.max(Math.min(touches[j].previouslyIntersected[k].index - l, touches[j].previouslyIntersected[k].parent.children.length - 1), 0);
            touches[j].previouslyIntersected[k].parent.children[previousID].material.color.setHex( 0x00ccff );
            touches[j].previouslyIntersected[k].parent.children[previousID].scale.z = 1;
          }
        }

        touches.splice(j, 1);
      }
    }
  }

  if(addMode){
    var obj = trajectory.createObject();
    trajectories.push(obj.spline);
    drawWave(obj.spline);
    toggleAddMode();
  }
}

function onTouchMove(event){

  event.preventDefault();

  for(var i = 0; i < event.changedTouches.length; i++){
    for(var j = 0; j < touches.length; j++){
      if( event.changedTouches[i].identifier == touches[j].identifier){
        event.changedTouches[i].previouslyIntersected = touches[j].previouslyIntersected;
        let scaledPointer = getScaledPointer(event.changedTouches[i]);
        touches[j].raycaster.setFromCamera( scaledPointer, camera );
        var intersects = touches[j].raycaster.intersectObject( floor );
        touches[j].interactionPoint = intersects[0].point;
        touchWave(touches[j]);
      }
    }

    if(addMode){
      var touch = event.changedTouches[0];
      let scaledPointer = getScaledPointer(touch);
      trajectory.addPoint(getInteractionPoint(scaledPointer));
    }
  }
}

function touchWave(touch){

  var intersects = touch.raycaster.intersectObjects(scene.children, true);

  if( moveMode ){
    const dx = touch.interactionPoint.x - touch.interactionOffset.x;
    const dy = touch.interactionPoint.y - touch.interactionOffset.y;
    touch.interactionOffset.x = touch.interactionPoint.x;
    touch.interactionOffset.y = touch.interactionPoint.y;
    touch.draggedObject.position.x += dx;
    touch.draggedObject.position.y += dy;
  }else if(!addMode){

    // Reset previously painted interactions
    for(var j = 0; j < touch.previouslyIntersected.length; j++){
      touch.previouslyIntersected[j].voice.stopVoice();

      for( var i = -highlightRange; i < highlightRange + 1; i++){
        var previousID = Math.max(Math.min(touch.previouslyIntersected[j].index - i, touch.previouslyIntersected[j].parent.children.length - 1), 0);
        touch.previouslyIntersected[j].parent.children[previousID].material.color.setHex( 0x00ccff );
        touch.previouslyIntersected[j].parent.children[previousID].scale.z = 1;
      }
    }
    touch.previouslyIntersected = [];

    // Paint the newly interacted objects
    for(var l = 0; l < intersects.length; l++){

      let intersected = intersects[l].object;

      if( deleteMode ){
        scene.remove(intersected.parent);
        intersected.voice.stopVoice();
      }else{

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
}
