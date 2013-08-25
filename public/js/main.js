// The scene graph is structured like this:
//
//  world
//    ambient light
//    sun light (a directional light).
//    level
//      floor (a single large card)
//      buildings
//        ...individual buildings...
//    enemies
//        ...individual mobs...
//    player
//    camera

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

  var textures = {
    'gravel': null,
    'grass': null,
    'bitumen': null,
    'patterned_metal': null
  };

  var icons = {
    'crosshairs': null,
  };

  var levels = [
    {
      'name': 'level1',
      'width': 100,
      'depth': 100,
      'buildings': [
        //{ 'x':  1, 'z':  1, 'orientation':  0, 'w':  2, 'h': 2, 'd':  2, 'color': 0x555560 },
        { 'x':  20, 'z':  10, 'orientation':  0, 'w':  5, 'h': 20, 'd':  5, 'color': 0x555560 },
        { 'x': -10, 'z':  20, 'orientation': 30, 'w':  5, 'h': 30, 'd':  5, 'color': 0x555555 },
        { 'x':  30, 'z': -20, 'orientation':  0, 'w': 10, 'h': 10, 'd': 25, 'color': 0x555555 },
      ]
    },
  ];

  var player = {
    'radius': 0.5,
  };

  var rayBox = new ludum.RayBoxIntersector();
  var raySphere = new ludum.RaySphereIntersector();


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
      loader.addCustom('models/scout.obj', null, function (val) {
          meshes.scout = val;
          meshes.scout.castShadow = true;
          meshes.scout.receiveShadow = true;
          return true;
      }, _startOBJLoader);

      // Load the textures for the level.
      loader.addGroup(levels[0].name, function () {
        var thisLevel = _createLevel(levels[0]);
        world.add(thisLevel);
      });
      loader.addImage('img/gravel.jpg', levels[0].name, function (val) { textures.gravel = _tiledTexture(val, 50, 50, false); return true; });
      loader.addImage('img/grass.jpg', levels[0].name, function (val) { textures.grass = _tiledTexture(val, 50, 50, true); return true; });
      loader.addImage('img/bitumen.jpg', levels[0].name, function (val) { textures.bitumen = _tiledTexture(val, 20, 20, false); return true; });
      loader.addImage('img/patterned_metal.jpg', levels[0].name, function (val) { textures.patterned_metal = _tiledTexture(val, 4, 10, false); return true; });

      // Load the icons.
      loader.addImage('img/crosshairs.png', null, function (val) { icons.crosshairs = val; return true; });

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

    var ambientLight = new THREE.AmbientLight(0x101010);
    var sunLight = new THREE.DirectionalLight(0xEFEFFF);
    //var skyLight = new THREE.HemisphereLight(0xA3E6F0, 0xDAD1BC, 0.2);
    var enemies = new THREE.Object3D();

    world.name = "world";
    ambientLight.name = "ambientLight";
    sunLight.name = "sunLight";
    //skyLight.name = "skyLight";
    enemies.name = "enemies";
    camera.name = "camera";

    world.fog = new THREE.Fog(0xADD8E6, 10, 50);

    sunLight.position.set(80, 40, 0);
    sunLight.castShadow = true;
    sunLight.shadowMapWidth = 1024;
    sunLight.shadowMapHeight = 1024;

    world.add(ambientLight);
    world.add(sunLight);
    //world.add(skyLight);
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

    /*
    var cameraLight = new THREE.SpotLight(0xffffff);
    cameraLight.castShadow = true;
    camera.add(cameraLight);
    */

    return camera;
  }


  function _createHUD()
  {
    var w = renderer.domElement.width;
    var h = renderer.domElement.height;

    hud = new THREE.Scene();
    hudCamera = new THREE.OrthographicCamera(0, w, h, 0, -100, 100);
    hudMain = new HUD(w / 2, h / 2, 1024, 256, 1.0, "96px LEDDisplay7", "middle", 0x1189AB);

    hud.name = "hud";

    hud.add(hudCamera);
    hud.add(hudMain.mesh);
  }


  function _createLevel(levelInfo)
  {
    var level = new THREE.Object3D();
    level.name = levelInfo.name;

    var groundGeometry = new THREE.CubeGeometry(levelInfo.width, 0.5, levelInfo.depth);
    var groundMaterial = new THREE.MeshPhongMaterial({
        'color': 0x444444,
        'shininess': 5.0,
        //'map': textures.gravel,
        //'map': textures.grass,
        'map': textures.bitumen,
    });
    var ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.name = "ground";
    ground.receiveShadow = true;
    ground.position.set(0.0, -0.25, 0.0);
    level.add(ground);

    var skyRadius = Math.max(levelInfo.width, levelInfo.depth) * 2;
    var skyGeometry = new THREE.SphereGeometry(skyRadius);
    var skyMaterial = new THREE.MeshBasicMaterial({ 'color': 0xB0E0E6, 'side': THREE.BackSide });
    var sky = new THREE.Mesh(skyGeometry, skyMaterial);
    sky.name = "sky";
    level.add(sky);

    for (var i = 0, end = levelInfo.buildings.length; i < end; ++i) {
      var info = levelInfo.buildings[i];
      var building = new Building(info.x, info.z, info.orientation, info.w, info.h, info.d);
      building.buildMesh(textures.patterned_metal, info.color);
      level.add(building.mesh);
      levelInfo.buildings[i] = building;
    }

    return level;
  }


  function _tiledTexture(img, sRepeat, tRepeat, mirrored)
  {
    var tex = new THREE.Texture(img);
    if (mirrored) {
      tex.wrapS = THREE.MirroredRepeatWrapping;
      tex.wrapT = THREE.MirroredRepeatWrapping;
    }
    else {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    tex.repeat.set(sRepeat, tRepeat);
    tex.needsUpdate = true;
    return tex;
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
      meshes.scout.translateOnAxis(Y_AXIS, 1.8);
      //meshes.scout.translateOnAxis(Z_AXIS, -5.0);
      world.getObjectByName('enemies').add(meshes.scout);

      // Set up FPS-style controls and use them to position the camera.
      controls = new FPSControls(camera);

      // Clear the main HUD.
      hudMain.setIcon(icons.crosshairs);

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

  function HUD(x, y, w, h, opacity, font, halign, color)
  {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.display = 'none';
    document.body.appendChild(this.canvas);

    var colorHex = color.toString(16);
    while (colorHex.length < 6)
      colorHex = "0" + colorHex;

    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = "#" + colorHex;
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
  }


  HUD.prototype = {};


  HUD.prototype.setText = function (msg, icon)
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
    if (icon) {
      var ih = icon.height;
      var iy = Math.min((h - ih) / 2, 4);
      this.ctx.drawImage(icon, 4, iy);
    }
    this.ctx.fillText(msg, x, y);

    this.texture.needsUpdate = true;
  }


  HUD.prototype.setIcon = function (icon)
  {
    var w = this.canvas.width,
        h = this.canvas.height,
        iw = icon.width,
        ih = icon.height;

    var x = (w - iw) / 2,
        y = (h - ih) / 2;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(icon, x, y);

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
    this.moveSpeed = 10.0;            // movement speed in metres per second.
    this.turnSpeed = Math.PI / 1000.0; // turning speed in radians per pixel.

    this.rotation = new THREE.Vector2(0.0, 0.0);
    this.extraRotation = new THREE.Vector2(0.0, 0.0);
    this.translation = new THREE.Vector3(0.0, this.height, 5.0);
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

    this.lastX = ludum.mouse.x;
    this.lastY = ludum.mouse.y;

    this.controlledObj.position.copy(this.translation);
    this.controlledObj.rotation.set(this.rotation.x, this.rotation.y, 0.0, 'YXZ');
  }


  //
  // The Building class
  //

  function Building(x, z, orientation, width, height, depth)
  {
    this.x = x;
    this.z = z;
    this.orientation = ludum.radians(orientation); // rotation about the y axis.
    this.w = width;
    this.h = height;
    this.d = depth;

    this.mesh = null;
  }


  Building.prototype = {};


  Building.prototype.buildMesh = function (map, color)
  {
    var materialColor = (color === undefined) ? 0x999999 : color;

    var geometry = new THREE.CubeGeometry(this.w, this.h, this.d);
    var material = new THREE.MeshPhongMaterial({ 'color': materialColor, 'map': map });
    this.mesh = new THREE.Mesh(geometry, material);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.set(this.x, this.h / 2.0, this.z);
    this.mesh.rotation.set(0.0, this.orientation, 0.0);
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
  // Collision detection
  //

  function hitGround(pos, delta)
  {
    return pos.y + delta.y < 0;
  }


  function hitLevelBoundary(level, pos, delta, offset)
  {
    var x = pos.x + delta.x,
        z = pos.z + delta.z;
    return (Math.abs(x) + offset) > (level.width / 2.0) ||
           (Math.abs(z) + offset) > (level.depth / 2.0);
  }


  function hitBuilding(level, pos, delta, offset)
  {
    var localPos = new THREE.Vector3();
    var localDelta = new THREE.Vector3();

    for (var i = 0, end = level.buildings.length; i < end; ++i) {
      var building = level.buildings[i];

      localPos.copy(pos);
      building.mesh.worldToLocal(localPos);

      localDelta.copy(pos);
      localDelta.add(delta);
      building.mesh.worldToLocal(localDelta);
      localDelta.sub(localPos);

      var halfW = building.w / 2.0;
      var halfH = building.h / 2.0;
      var halfD = building.d / 2.0;
      var t1 = localDelta.length() + offset;

      rayBox.setRaySrc(localPos.x, localPos.y, localPos.z);
      rayBox.setRayDir(localDelta.x, localDelta.y, localDelta.z, true);
      rayBox.setBox(-halfW, -halfH, -halfD, halfW, halfH, halfD);

      if (rayBox.shadowIntersect(0, t1))
        return true;
    }

    return false;
  }


  function hitEnemy(pos, delta, offset)
  {
    raySphere.setRaySrc(pos.x, pos.y, pos.z);
    raySphere.setRayDir(delta.x, delta.y, delta.z, true);

    var t0 = 0.00001;
    var t1 = delta.length() + offset;

    var enemyRadius = 1.0;
    var enemies = world.getObjectByName('enemies').children;
    var enemyPos = new THREE.Vector3();
    for (var i = 0, end = enemies.length; i < end; ++i) {
      enemyPos.set(0.0, 0.0, 0.0);
      enemies[i].localToWorld(enemyPos);
      raySphere.setSphere(enemyPos.x, enemyPos.y, enemyPos.z, enemyRadius);
      if (raySphere.shadowIntersect(0, t1))
        return true;
    }

    return false;
  }


  //
  // Main functions
  //

  function basicRenderer(width, height)
  {
    var renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = false;
    //renderer.shadowMapType = THREE.BasicShadowMap;
    renderer.shadowMapCascade = true;
    //renderer.shadowMapDebug = true;
    //renderer.physicallyBasedShading = true;

    renderer.setSize(width, height);

    return renderer;
  }


  function deferredRenderer(width, height)
  {
    var renderer = new THREE.WebGLDeferredRenderer({
      'width': width,
      'height': height,
      'scale': 1,
      'antialias': true,
      'tonemapping': THREE.FilmicOperator,
      'brightness': 2.5
    });

    var bloomEffect = new THREE.BloomPass(0.65);
    renderer.addEffect(bloomEffect);

    return renderer;
  }


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
      renderer = basicRenderer(width, height);
      //renderer = deferredRenderer(width, height);
    }
    else {
      ludum.showError("<strong>Your browser doesn't appear to support WebGL.</strong> Unable to continue. Sorry!");
      return false;
    }

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
