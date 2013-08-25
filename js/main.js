// The scene graph is structured like this:
//
//  world
//    level
//      ambient light
//      sun light (a directional light).
//      floor (a single large card)
//      buildings
//        ...individual buildings...
//    mobs
//      ...individual mobs...
//    player
//    camera
//      torch (spotlight)
//    goal

var ld27 = function () { // start of the ld27 namespace

  //
  // Constants
  //

  // Some common vectors, so we don't have to keep reallocating them. Treat these as read only!
  var ZERO_VEC = new THREE.Vector3(0, 0, 0);
  var X_AXIS = new THREE.Vector3(1, 0, 0);
  var Y_AXIS = new THREE.Vector3(0, 1, 0);
  var Z_AXIS = new THREE.Vector3(0, 0, 1);


  //
  // Global variables
  //

  var loader = null;
  var renderer = null;

  var world = null;
  var camera = null;
  var controls = null;

  var hud = null;
  var hudCamera = null;
  var hudMain = null;

  var meshes = {
    'scout': null,
  };

  var music = {
    'glowy': null,
    'ominous': null,
  };


  //
  // The 'loading' state
  //

  var loadingStateFuncs = {
    'enter': function ()
    {
      // Create everything we can without loading.
      _createWorld();
      _createHUD();

      // Create an asset loader.
      loader = new ludum.Loader();

      // Load the audio assets
      loader.addAudio('music/Glowy.ogg', null, function (val) { music.glowy = val; return true; });
      loader.addAudio('music/Ominous.ogg', null, function (val) { music.ominous = val; return true; });

      // Load the models.
      loader.addCustom('models/scout.obj', null, function (val) { meshes.scout = val; return true; }, _startOBJLoader, 'models/scout.mtl');

      // Start loading.
      loader.start();
    },

    'draw': function ()
    {
      renderer.render(hud, hudCamera);
    },

    'update': function (dt)
    {
      // Set the HUD text to show the % loading complete.
      var percentComplete = ludum.roundTo(loader.fractionComplete() * 100, 0);
      hudMain.setText("loading " + percentComplete + "%");
    }
  };


  function _createWorld()
  {
    world = new THREE.Scene();
    camera = _createCamera();

    var level = new THREE.Object3D();
    var ambientLight = new THREE.AmbientLight(0x909090);
    var sunLight = new THREE.DirectionalLight(0xFFFF66);
    var enemies = new THREE.Object3D();

    world.name = "world";
    level.name = "level";
    ambientLight.name = "ambientLight";
    sunLight.name = "sunLight";
    enemies.name = "enemies";
    camera.name = "camera";

    sunLight.position.set(100, 100, 0);

    world.add(ambientLight);
    world.add(sunLight);
    world.add(level);
    world.add(enemies);
    world.add(camera);
  }


  function _createCamera()
  {
    var width = renderer.domElement.width;
    var height = renderer.domElement.height;

    var fieldOfView = 35.0; // in degrees.
    var aspectRatio = (width - 0.0) / height;
    var nearClip = 0.1;
    var farClip = 1000.0;

    camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearClip, farClip);
    return camera;
  }


  function _createHUD()
  {
    var w = renderer.domElement.width;
    var h = renderer.domElement.height;

    hud = new THREE.Scene();
    hudCamera = new THREE.OrthographicCamera(0, w, h, 0, -100, 100);
    hudMain = new HUD(w / 2, h / 2, 1024, 256, 1.0, "128px ArabDances", "middle");

    hud.name = "hud";

    hud.add(hudCamera);
    hud.add(hudMain.mesh);
  }


  //
  // The 'loadingFinished' state
  //

  var loadingFinishedStateFuncs = {
    'enter': function ()
    {
      // Show that loading has finished.
      hudMain.setText("loading 100%");
    },

    'draw': function ()
    {
      loadingStateFuncs.draw();
    },
  };


  //
  // The 'playing' state
  //

  var playingStateFuncs = {
    'enter': function ()
    {
      console.log("entered 'playing' state");

      // Add a scout mesh to the scene. TODO: once the spawning logic is in place, take this out.
      meshes.scout.translateOnAxis(Y_AXIS, 1.25);
      meshes.scout.translateOnAxis(Z_AXIS, -5.0);
      world.getObjectByName('enemies').add(meshes.scout);

      // Set up FPS-style controls and use them to position the camera.
      controls = new FPSControls(camera);

      // Clear the main HUD.
      hudMain.setText("");

      // Start the background music.
      //music.ominous.loop = true;
      //music.ominous.play();
    },

    'draw': function ()
    {
      renderer.autoClear = true;
      renderer.render(world, camera);
      renderer.autoClear = false;
      renderer.render(hud, hudCamera);
    },

    'update': function (dt)
    {
      // dt is in milliseconds, so we'll convert it to seconds for the controls.
      controls.update(dt / 1000.0);

      // TODO: all the game logic!
    },

    'leave': function ()
    {
      controls.enabled = false;
    }
  };


  //
  // The HUD class
  //

  function HUD(x, y, w, h, opacity, font, halign, icon)
  {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.display = 'none';
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = "#900";
    this.ctx.font = font;
    this.ctx.textAlign = halign;
    this.ctx.textBaseline = "middle";

    this.geometry = new THREE.PlaneGeometry(w, h);
    this.geometry.computeBoundingBox();

    this.texture = new THREE.Texture(this.canvas);
    this.material = new THREE.MeshBasicMaterial({ 'map': this.texture, 'transparent': true, 'opacity': opacity });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.translateOnAxis(X_AXIS, x);
    this.mesh.translateOnAxis(Y_AXIS, y);

    this.halign = halign;
    this.icon = icon;
  }


  HUD.prototype = {};


  HUD.prototype.setText = function (msg)
  {
    var w = this.canvas.width;
    var h = this.canvas.height;
    var tw = this.ctx.measureText(msg).width;

    var x = 0, y = h / 2;
    if (this.halign == "left")
      x = 0;
    else if (this.halign == "right")
      x = w - tw;
    else
      x = (w - tw) / 2;

    this.ctx.clearRect(0, 0, w, h);
    if (this.icon) {
      var ih = icon.height;
      var iy = Math.min((h - ih) / 2, 4);
      this.ctx.drawImage(icon, 4, iy);
    }
    this.ctx.fillText(msg, x, y);

    this.texture.needsUpdate = true;
  }


  //
  // Input handling functions
  //

  function FPSControls(controlledObj)
  {
    this.controlledObj = controlledObj;
    this.controlledObj.matrixAutoUpdate = true;

    this.height = 1.8;                // height of eyes above ground level, in metres.
    this.moveSpeed = 5.0;             // movement speed in metres per second.
    this.turnSpeed = Math.PI / 512.0; // turning speed in radians per pixel.

    this.rotation = new THREE.Vector2(0.0, 0.0);
    this.extraRotation = new THREE.Vector2(0.0, 0.0);
    this.translation = new THREE.Vector3(0.0, this.height, 0.0);
    this.extraTranslation = new THREE.Vector3(0.0, 0.0, 0.0);
    this.transform = new THREE.Matrix4();
    this.tmpMatrix = new THREE.Matrix4();

    this.transform.identity();

    this.lastX = ludum.mouse.x; // The mouse X position when the mouse-look began.
    this.lastY = ludum.mouse.y; // The mouse Y position when the mouse-look began.
  }


  FPSControls.prototype = {};


  FPSControls.prototype.update = function (dt)
  {
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

      // Transform 'extraTranslation' by the current rotation amounts.
      this.transform.makeRotationY(this.rotation.y);
      this.tmpMatrix.makeRotationX(this.rotation.x);
      this.transform.multiply(this.tmpMatrix);
      this.extraTranslation.applyMatrix4(this.transform);

      // Add 'extraTranslation' to the current translation.
      this.translation.add(this.extraTranslation);
    }

    if (ludum.isButtonPressed(ludum.buttons.LEFT)) {
      var dx = ludum.mouse.x - this.lastX;
      var dy = ludum.mouse.y - this.lastY;

      var thetaX = -dy * this.turnSpeed;
      var thetaY = -dx * this.turnSpeed;

      this.extraRotation.set(thetaX, thetaY);
      this.rotation.add(this.extraRotation);
    }

    this.lastX = ludum.mouse.x;
    this.lastY = ludum.mouse.y;

    this.controlledObj.position.copy(this.translation);
    this.controlledObj.rotation.set(this.rotation.x, this.rotation.y, 0.0, 'YXZ');
  }


  //
  // Loading helpers
  //

  function _startOBJLoader(objURL, onLoad, onError, mtlURL)
  {
    var objLoader = new THREE.OBJMTLLoader();
    objLoader.addEventListener('load', function (ev) { onLoad(ev.content); });
    objLoader.addEventListener('error', function (ev) { onError(ev.message); });
    objLoader.load(objURL, mtlURL);
  }


  //
  // Main functions
  //

  function initRenderer()
  {
    // Initialise the Three.JS renderer.
    var width = window.innerWidth;
    var height = window.innerHeight;
    var fieldOfView = 35; // degrees
    var aspectRatio = width / height;
    var nearClip = 1.0;
    var farClip = 1000.0;

    // Set up the three.js renderer.
    var caps = ludum.browserCapabilities();
    if (caps.webgl) {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.shadowMapEnabled = true;
      renderer.shadowMapSoft = true;
    }
    else if (caps.canvas) {
      ludum.showWarning("<strong>Your browser doesn't appear to support " +
                        "WebGL.</strong> You may get lower frame rates and/or " +
                        "poorer image quality as a result. Sorry!");
      renderer = new THREE.CanvasRenderer();
    }
    else {
      ludum.showError("<strong>Your browser doesn't appear to support WebGL " +
                      "<em>or</em> Canvas.</strong> Unable to continue. Sorry!");
      return false;
    }
    renderer.setSize(width, height);
    document.getElementById('viewport').appendChild(renderer.domElement);

    window.addEventListener('resize', setSize, false);

    return true;
  }


  function initGame()
  {
    // Set up the input devices.
    ludum.useKeyboard();
    ludum.useMouse();

    // Set up the game states.
    ludum.addState('loading', loadingStateFuncs);
    ludum.addState('loadingFinished', loadingFinishedStateFuncs);
    ludum.addState('playing', playingStateFuncs);

    // Set up events for the 'loading' state.
    var finishedLoadingPredicate = function () {
      return loader.finished();
    };
    ludum.addGameConditionEvent('loading', finishedLoadingPredicate, 'loadingFinished');

    // Set up events for the 'loadingFinished' state.
    ludum.addChangeStateAtTimeEvent('loadingFinished', 1.0, 'playing');

    // Set up events for the 'playing' state.
    // (No events yet...)

    return true;
  }


  function main()
  {
    if (!initRenderer())
      return;
    if (!initGame())
      return;

    ludum.start('loading')
  }


  function setSize(w, h)
  {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var textSize = height * 0.05;
    var x = width - (4 * textSize) - 10.0;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
  }


  //
  // Public functions
  //

  return {
    'main': main
  };

}(); // end of the ld27 namespace
