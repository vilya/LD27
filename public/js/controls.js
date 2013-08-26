var ld27controls = function() { //start of the ld27controls namespace

  //
  // FPSControls class
  //

  function FPSControls(controlledObj, domElement)
  {
    this.controlledObj = controlledObj;
    this.controlledObj.matrixAutoUpdate = true;

    this.domElement = domElement;

    this.height = 1.8;                // height of eyes above ground level, in metres.
    this.moveSpeed = 10.0;            // movement speed in metres per second.
    this.turnSpeed = Math.PI / 256.0; // turning speed in radians per pixel.

    this.rotation = new THREE.Vector2(0.0, 0.0);
    this.extraRotation = new THREE.Vector2(0.0, 0.0);
    this.translation = new THREE.Vector3(0.0, this.height, 5.0);
    this.extraTranslation = new THREE.Vector3(0.0, 0.0, 0.0);
    this.transform = new THREE.Matrix4();
    this.tmpMatrix = new THREE.Matrix4();

    this.transform.identity();

    this.lastX = ludum.mouse.x; // The mouse X position when the mouse-look began.
    this.lastY = ludum.mouse.y; // The mouse Y position when the mouse-look began.

    if (document.hasFocus())
      this.state = FPSControls.prototype.ENABLING;
    else
      this.state = FPSControls.prototype.DISABLED;
  }


  FPSControls.prototype = {};


  //
  // FPSControls constants
  //

  FPSControls.prototype.DISABLED = 0;
  FPSControls.prototype.ENABLING = 1;
  FPSControls.prototype.ENABLED = 2;


  //
  // FPSControls public methods
  //

  FPSControls.prototype.update = function (dt)
  {
    if (!document.hasFocus() || this.state == FPSControls.prototype.DISABLED)
      return;

    if (this.state == FPSControls.prototype.ENABLING) {
      this.lastX = ludum.mouse.x;
      this.lastY = ludum.mouse.y;
      this.state = FPSControls.prototype.ENABLED;
      return;
    }

    this.extraTranslation.set(0, 0, 0);
    if (ludum.isKeyPressed('A') || ludum.isKeyPressed(ludum.keycodes.LEFT))
      this.extraTranslation.x -= 1.0;
    if (ludum.isKeyPressed('D') || ludum.isKeyPressed(ludum.keycodes.RIGHT))
      this.extraTranslation.x += 1.0;
    if (ludum.isKeyPressed('S') || ludum.isKeyPressed(ludum.keycodes.DOWN))
      this.extraTranslation.z += 1.0;
    if (ludum.isKeyPressed('W') || ludum.isKeyPressed(ludum.keycodes.UP))
      this.extraTranslation.z -= 1.0;

    if (this.extraTranslation.lengthSq() > 0.0) {
      this.extraTranslation.normalize();
      this.extraTranslation.multiplyScalar(this.moveSpeed * dt);

      // Transform 'extraTranslation' by the current rotation amounts. Note
      // that the only rotate around the y axis, because rotating
      // extraTranslation around the x axis means you can move off the ground
      // plane - and we want the player to stay on it.
      this.transform.makeRotationY(this.rotation.y);
      this.extraTranslation.applyMatrix4(this.transform);

      // Check if the extra translation would move us into an obstacle. If so,
      // stop (for now).
      var level = levels[0];
      var stop = hitLevelBoundary(level, this.translation, this.extraTranslation, player.radius);
      if (!stop)
        stop = hitBuilding(level, this.translation, this.extraTranslation, player.radius);
      if (!stop)
        stop = hitEnemy(this.translation, this.extraTranslation, player.radius);
      if (!stop) {
        // Add 'extraTranslation' to the current translation.
        this.translation.add(this.extraTranslation);
      }
    }

    // Look around following the mouse.
    var dx = ludum.mouse.x - this.lastX;
    var dy = ludum.mouse.y - this.lastY;

    var thetaX = -dy * this.turnSpeed;
    var thetaY = -dx * this.turnSpeed;

    this.extraRotation.set(thetaX, thetaY);
    this.rotation.add(this.extraRotation);

    this.controlledObj.position.copy(this.translation);
    this.controlledObj.rotation.set(this.rotation.x, this.rotation.y, 0.0, 'YXZ');

    this.lastX = ludum.mouse.x;
    this.lastY = ludum.mouse.y;
  }


  FPSControls.prototype.enable = function ()
  {
    this.state = FPSControls.prototype.ENABLING;
  }


  FPSControls.prototype.disable = function ()
  {
    this.state = FPSControls.prototype.DISABLED;
  }

  //
  // Public symbols
  //

  return {
    'FPSControls': FPSControls,
  };

}(); // end of the ld27controls namespace
