// Done: state-machine
// - Each state has enter, draw, update and leave functions.
// - Each state can have any number of pre-scripted events
// - Events have a trigger predicate and enter, draw, update, leave functions.
// - Set up default states: titles, level1, win, lose.
// - Can have the check for victory conditions as a trigger predicate for an event?

// Done: Input tracking
// - keyboard
// - mouse
// Can enable and disable input devices independently.

// Done: Sound library
// - Support for loops (i.e. background music) and one-off sounds (e.g. sfx).
// - Function to add an audio tag to the page, given a parent.

// Drawing library
// - Support for webgl, canvas.
// - Consistent api regardless of which back-end is being used.
// - Option to fallback gracefully from WebGL to Canvas.
// - Function to add a drawing area to the page, given a parent.
// - Text rendering

// Sprites
// - Static or animated.
// - Sprite-to-sprite collision detection
// - Sprite-to-environment collision detection
// - Placeholder graphics for when textures haven't loaded yet

var ludum = function () {  // start of the ludum namespace

  //
  // Constants
  //

  var keycodes = {
    'ESCAPE': 27,
    'LEFT': 37,
    'RIGHT': 39,
    'UP': 38,
    'DOWN': 40,
  };

  var buttons = {
    'LEFT': 0,
    'MIDDLE': 1,
    'RIGHT': 2,
  };


  //
  // Variables
  //

  // Holds game configuration data - stuff that shouldn't change once set up.
  var config = {
    'states': {},
    'sounds': {},
    'externalUpdate': false,  // If false, ludum.js calls _update() during the render loop. If true, it doesn't and you're expected to call ludum.update() from your own code.
  };

  // Holds the current state of the game while running.
  var globals = {
    'lastT': 0,           // The current game time (in ms since datum).
    'lastStateT': 0,      // The time we last changed states at (in ms since datum).
    'stateT': 0,          // The amount of time we've been in the current state for, in seconds.
    'nextStateName': null,// The state we should change into at the end of this update cycle.
    'currentState': null, // The current game state.
    'prevStateName': null,// The previous state we were in, useful for coming back from e.g. a pause screen.
    'activeEvents': [],   // The currently active events for the current state.
    'pendingEvents': [],  // The events still waiting to be activated for the current state.

    'keysDown': {},       // Map of which keys are currently held down.
    'mouse': {
      'x': 0,             // Last known mouse x location.
      'y': 0,             // Last known mouse y location.
      'buttonsDown': {},  // Map of which mouse buttons are currently held down.
    },
  };


  //
  // Setup and configuration
  //

  function addState(name, stateObj)
  {
    // Set up properties for internal use.
    stateObj.name = name;
    stateObj.events = [];
    stateObj.initialised = false;

    // Set up default implementations for any missing lifecycle methods.
    if (!stateObj.init)
      stateObj.init = _noop;
    if (!stateObj.enter)
      stateObj.enter = _noop;
    if (!stateObj.draw)
      stateObj.draw = _noop;
    if (!stateObj.update)
      stateObj.update = _noop;
    if (!stateObj.leave)
      stateObj.leave = _noop;

    // Add the state object to the interal config.
    config.states[name] = stateObj;
  }


  function _noop()
  {
    // Do nothing - that's the *point* of this function.
  }


  function addEvent(stateName, trigger, expire, eventMethods)
  {
    var newEvent = _makeEvent(trigger, expire, eventMethods);
    _addEvent(stateName, newEvent);
  }


  function addAlwaysOnEvent(stateName, eventMethods)
  {
    var newEvent = _makeEvent(alwaysTrigger, null, eventMethods);
    _addEvent(stateName, newEvent);
  }


  function addTimeEvent(stateName, t, duration, eventMethods)
  {
    var trigger = timeTrigger;
    var expire = null;
    if (duration > 0.0)
      expire = timeExpire;

    var newEvent = _makeEvent(trigger, expire, eventMethods);
    // Extra properties.
    newEvent.t = t;
    if (duration > 0.0)
      newEvent.duration = duration;

    _addEvent(stateName, newEvent);
  }


  function addChangeStateAtTimeEvent(stateName, t, targetState, eventMethods)
  {
    var newEvent = _makeEvent(timeTrigger, null, eventMethods);
    // Extra properties
    newEvent.t = t;
    newEvent.wrappedEnter = newEvent.enter;
    newEvent.enter = function () {
      if (this.wrappedEnter)
        this.wrappedEnter();
      changeState(this.targetState);
    }
    newEvent.targetState = targetState;

    _addEvent(stateName, newEvent);
  }


  function addKeyPressEvent(stateName, key, duration, eventMethods)
  {
    var trigger = keyTrigger;
    var expire = null;
    if (duration > 0.0)
      expire = timeExpire;

    var newEvent = _makeEvent(trigger, expire, eventMethods);
    // Extra properties.
    newEvent.key = key;
    if (duration > 0.0) {
      newEvent.wrappedEnter = newEvent.enter;
      newEvent.enter = function () {
        this.t = globals.lastT;
        if (this.wrappedEnter)
          this.wrappedEnter();
      }
      newEvent.duration = duration;
    }

    _addEvent(stateName, newEvent);
  }


  function addChangeStateOnKeyPressEvent(stateName, key, targetState, eventMethods)
  {
    var trigger = keyTrigger;
    var expire = null;

    var newEvent = _makeEvent(trigger, null, eventMethods);
    // Extra properties
    newEvent.key = key;
    newEvent.wrappedEnter = newEvent.enter;
    newEvent.enter = function () {
      if (this.wrappedEnter)
        this.wrappedEnter();
      changeState(this.targetState);
    }
    newEvent.targetState = targetState;

    _addEvent(stateName, newEvent);
  }


  function addGameConditionEvent(stateName, victoryPred, targetState, eventMethods)
  {
    var newEvent = _makeEvent(victoryPred, null, eventMethods);
    // Extra properties
    newEvent.wrappedEnter = newEvent.enter;
    newEvent.enter = function () {
      if (this.wrappedEnter)
        this.wrappedEnter();
      changeState(this.targetState);
    }
    newEvent.targetState = targetState;

    _addEvent(stateName, newEvent);
  }


  function _makeEvent(trigger, expire, eventMethods)
  {
    var newEvent = {
      // Standard properties.
      'trigger': trigger,
      'expire': null,
      'enter': null,
      'leave': null,
      'update': null,
      'draw': null,
    };

    if (expire)
      newEvent.expire = expire;

    if (eventMethods) {
      if (eventMethods.enter)
        newEvent.enter = eventMethods.enter;
      if (eventMethods.leave)
        newEvent.leave = eventMethods.leave;
      if (eventMethods.update)
        newEvent.update = eventMethods.update;
      if (eventMethods.draw)
        newEvent.draw = eventMethods.draw;
    }

    return newEvent;
  }


  function _addEvent(stateName, newEvent)
  {
    config.states[stateName].events.push(newEvent);
  }


  //
  // Standard event trigger and expire methods
  //

  function alwaysTrigger()
  {
    return true;
  }


  function neverExpire()
  {
    return false;
  }


  function timeTrigger()
  {
    return (globals.stateT >= this.t);
  }


  function timeExpire()
  {
    return globals.stateT >= (this.t + this.duration);
  }


  function keyTrigger()
  {
    if (!this.key)
      return anyKeyPressed();
    else
      return globals.keysDown[this.key];
  }


  //
  // Main game logic.
  //

  function start(initialStateName)
  {
    window.requestAnimFrame = (function() {
      return window.requestAnimationFrame ||
             window.webkitRequestAnimationFrame ||
             window.mozRequestAnimationFrame ||
             window.oRequestAnimationFrame ||
             window.msRequestAnimationFrame ||
             function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
               window.setTimeout(callback, 1000/60);
             };
    })();

    // Set the initial state for the game.
    changeState(initialStateName);
    _changeState();

    _mainLoop();
  }


  // Call this to tell ludum.js that you'll be driving the game updates by
  // some other process, so that it knows not to call _update during the render
  // loop.
  function useExternalUpdates()
  {
    config.externalUpdate = true;
  }


  // This version of the update function can be called by users of ludum.js as
  // an alternative to the built-in updating. This is to allow the updates to
  // be driven by something other than the render loop, e.g. the physics
  // engine.
  function update()
  {
    _update();
  }


  function _mainLoop()
  {
    requestAnimFrame(_mainLoop);
    _draw();
    _update();
  }


  function _draw()
  {
    _drawState();
    _drawEvents();
  }


  function _drawState()
  {
    if (globals.currentState && globals.currentState.draw)
      globals.currentState.draw();
  }


  function _drawEvents()
  {
    for (var i = 0; i < globals.activeEvents.length; i++) {
      var ev = globals.activeEvents[i];
      if (ev.draw)
        ev.draw();
    }
  }


  function _update()
  {
    var dt = _updateGameTime();
    _updateState(dt);
    _expireEvents();
    _updateEvents(dt);
    _triggerEvents();
    _changeState();
  }


  function _updateGameTime()
  {
    var t = Date.now();
    var dt = t - globals.lastT;
    globals.lastT = t;
    globals.stateT = (t - globals.lastStateT) / 1000.0;
    return dt;
  }


  function _updateState(dt)
  {
    if (globals.currentState && globals.currentState.update)
      globals.currentState.update(dt);
  }


  function _expireEvents()
  {
    var newEvents = [];
    for (var i = 0; i < globals.activeEvents.length; i++) {
      var ev = globals.activeEvents[i];
      if (!ev.expire()) {
        newEvents.push(ev);
        continue;
      }

      if (ev.leave)
        ev.leave();
    }
    globals.activeEvents = newEvents;
  }


  function _updateEvents(dt)
  {
    for (var i = 0; i < globals.activeEvents.length; i++) {
      var ev = globals.activeEvents[i];
      if (ev.update)
        ev.update(dt);
    }
  }


  function _triggerEvents()
  {
    var newEvents = [];
    for (var i = 0; i < globals.pendingEvents.length; i++) {
      var ev = globals.pendingEvents[i];
      if (!ev.trigger()) {
        newEvents.push(ev);
        continue;
      }

      if (ev.enter)
        ev.enter();

      if (ev.expire)
        globals.activeEvents.push(ev);
      else if (ev.leave)
        ev.leave();
    }
    globals.pendingEvents = newEvents;
  }


  function changeState(newStateName)
  {
    globals.nextStateName = newStateName;
  }


  function changeToPrevState()
  {
    changeState(globals.prevStateName);
  }


  function _changeState()
  {
    if (!globals.nextStateName)
      return;

    globals.lastT = Date.now();
    clearKeyboard();

    // Clear out the current event lists.
    globals.activeEvents = [];
    globals.pendingEvents = [];

    // Change the state.
    if (globals.currentState) {
      globals.currentState.leave();
      globals.prevStateName = globals.currentState.name;
    }
    globals.currentState = config.states[globals.nextStateName];
    globals.nextStateName = null;
    if (!globals.currentState.initialised) {
      globals.currentState.init();
      globals.currentState.initialised = true;
    }
    globals.currentState.enter();
  
    // Populate the pending event list from the new state.
    for (var i = 0; i < globals.currentState.events.length; i++)
      globals.pendingEvents.push(globals.currentState.events[i]);

    // Record the timestamp of the change.
    globals.lastStateT = globals.lastT;
    globals.stateT = 0.0;
  }


  //
  // Input handling
  //

  function useKeyboard()
  {
    document.onkeydown = _keyDown;
    document.onkeyup = _keyUp;
  }


  function clearKeyboard()
  {
    // Clear the keyboard state.
    for (key in globals.keysDown)
      globals.keysDown[key] = false;
  }
  
  
  function anyKeyPressed()
  {
    for (key in game.keysDown) {
      if (globals.keysDown[key])
        return true;
    }
    return false;
  }


  function isKeyPressed(key)
  {
    return globals.keysDown[key];
  }
  
  
  function _keyDown(event)
  {
    globals.keysDown[event.keyCode] = true;
    globals.keysDown[String.fromCharCode(event.keyCode)] = true;
  }
  
  
  function _keyUp(event)
  {
    globals.keysDown[event.keyCode] = false;
    globals.keysDown[String.fromCharCode(event.keyCode)] = false;
  }


  function useMouse()
  {
    if (globals.canvas)
      globals.canvas.onmousedown = _mouseDown;
    else
      document.onmousedown = _mouseDown;
    document.onmouseup = _mouseUp;
    document.onmousemove = _mouseMove;
  }


  function anyButtonPressed()
  {
    for (btn in game.mouse.buttonsDown) {
      if (globals.mouse.buttonsDown[btn])
        return true;
    }
    return false;
  }


  function isButtonPressed(btn)
  {
    return globals.mouse.buttonsDown[btn];
  }


  function _mouseDown(event)
  {
    var btn = event.button;
    globals.mouse.buttonsDown[btn] = true;
    globals.mouse.x = event.clientX; // clientX is the DOM standard property.
    globals.mouse.y = event.clientY; // clientY is the DOM standard property.
  }


  function _mouseUp(event)
  {
    var btn = event.button;
    globals.mouse.buttonsDown[btn] = false;
    globals.mouse.x = event.clientX; // clientX is the DOM standard property.
    globals.mouse.y = event.clientY; // clientY is the DOM standard property.
  }


  function _mouseMove(event)
  {
    globals.mouse.x = event.clientX; // clientX is the DOM standard property.
    globals.mouse.y = event.clientY; // clientY is the DOM standard property.
  }


  //
  // Sound effects
  //

  function addSound(name, sources) {
    var audioElement = document.createElement('audio');
    for (var i = 0, endI = sources.length; i < endI; i++) {
      var sourceElement = document.createElement('source');
      sourceElement.src = sources[i];
      audioElement.appendChild(sourceElement);
    }
    config.sounds[name] = { 'name': name, 'audioElement': audioElement };
  }


  function playSound(name) {
    var sound = config.sounds[name];
    if (sound === undefined)
      return;

    if (sound.audioElement.ended) {
      if (sound.audioElement.seekable.length > 0)
        sound.audioElement.currentTime = sound.audioElement.seekable.start(0);
      else
        sound.audioElement.currentTime = 0;
    }
    sound.audioElement.play();
  }


  function stopSound(name) {
    var sound = config.sounds[name];
    if (sound === undefined)
      return;

    sound.audioElement.pause();
  }


  //
  // Browser-related methods
  //

  // Borrowed from three.js, examples/js/Detector.js - authored by mr doob & AlteredQualia
  function browserCapabilities()
  {
    return { 
      'canvas': !! window.CanvasRenderingContext2D,
	    'webgl': (function () { try { return !! window.WebGLRenderingContext && !! document.createElement( 'canvas' ).getContext( 'experimental-webgl' ); } catch( e ) { return false; } } )(),
	    'workers': !! window.Worker,
	    'fileapi': window.File && window.FileReader && window.FileList && window.Blob
    };
  }


  function showWarning(msgHTML, parentElem)
  {
    _showMessage(msgHTML, parentElem, '#ff8', '#000');
 }


  function showError(msgHTML, parentElem)
  {
    _showMessage(msgHTML, parentElem, '#fbb', '#700');
  }


  function _showMessage(msgHTML, parentElem, background, color, icon)
  {
    var parentNode = document.body;
    if (parentElem)
      parentNode = parentElem;

    // TODO: add an icon and a close button to this div
		var element = document.createElement( 'div' );
		element.id = 'webgl-error-message';
    element.style.fontFamily = 'sans-serif';
		element.style.fontSize = '13px';
		element.style.fontWeight = 'normal';
		element.style.textAlign = 'left';
		element.style.background = background;
		element.style.color = color;
		element.style.padding = '1.5em';
		element.style.width = parentNode.innerWidth;
		element.style.margin = '5em auto 0';
    element.innerHTML = msgHTML;

    parentNode.appendChild(element);
  }


  //
  // The Loader class
  //

  function Loader()
  {
    this.count = 0;
    this.succeeded = 0;
    this.failed = 0;
    this.assets = {};
    this.groups = {};
    this.verbose = true;
  }


  Loader.prototype = {};


  Loader.prototype.TEXT = 0;
  Loader.prototype.IMAGE = 1;
  Loader.prototype.AUDIO = 2;
  Loader.prototype.CUSTOM = 3;


  Loader.prototype.addGroup = function (name, postprocess)
  {
    if (this.groups[name])
      return;

    if (this.verbose)
      console.log("adding asset group: " + name);

    this.groups[name] = {
      'assets': [],
      'postprocess': postprocess,
      'value': null
    };
  }


  Loader.prototype.addText = function (url, group, postprocess)
  {
    this._addAsset(Loader.prototype.TEXT, url, group, postprocess, null, []);
  }


  Loader.prototype.addImage = function (url, group, postprocess)
  {
    this._addAsset(Loader.prototype.IMAGE, url, group, postprocess, null, []);
  }


  Loader.prototype.addAudio = function (url, group, postprocess)
  {
    this._addAsset(Loader.prototype.AUDIO, url, group, postprocess, null, []);
  }


  // start must be a function which takes the following three arguments:
  // - onLoad(val): a function which the custom loader must call when loading has finished successfully.
  // - onError(val): a function which the custom loader must call when loading fails.
  // - url: the url to load.
  // These will be followed by any additional URLs you provided when calling this function.
  Loader.prototype.addCustom = function (url, group, postprocess, start /*, url, url, ... */)
  {
    var args = Array.prototype.slice.call(arguments);
    this._addAsset(Loader.prototype.CUSTOM, url, group, postprocess, start, args.slice(4));
  }


  Loader.prototype.start = function ()
  {
    if (this.verbose)
      console.log("loading started");

    for (var url in this.assets)
      this._startAsset(url);
  }


  Loader.prototype.finished = function ()
  {
    return (this.succeeded + this.failed) >= this.count;
  }


  Loader.prototype.groupFinished = function (groupName)
  {
    var group = this.groups[groupName];
    if (!group)
      return false;

    for (var i = 0, end = group.assets.length; i < end; ++i) {
      var asset = this.assets[group.assets[i]];
      if (!asset.finished || asset.error)
        return false;
    }

    return true;
  }


  Loader.prototype.fractionComplete = function ()
  {
    if (this.count == 0)
      return 1.0;
    else
      return (this.succeeded + this.failed) / this.count;
  }


  Loader.prototype.fractionFailed = function ()
  {
    if (this.count == 0)
      return 0.0;
    else
      return this.failed / this.count;
  }


  //
  // Loader private methods
  //

  Loader.prototype._addAsset = function (type, url, group, postprocess, start, extraURLs)
  {
    if (this.assets[url])
      return;

    if (this.verbose) {
      var typeStr = [ "text", "image", "audio", "custom" ][type];
      console.log("adding " + typeStr + " asset: " + url);
    }

    this.count++;
    this.assets[url] = {
      'type': type,
      'group': group,
      'postprocess': postprocess,
      'finished': false,
      'value': null,
      'error': null,
      'start': start,
      'extraURLs': extraURLs
    };

    if (group) {
      if (!this.groups[group])
        this.addGroup(group);
      this.groups[group].assets.push(url);
    }
  }


  Loader.prototype._startAsset = function (url)
  {
    var asset = this.assets[url];
    if (!asset)
      return;

    switch (asset.type) {
      case Loader.prototype.TEXT:
        var req = new XMLHttpRequest();
        req.loader = this;
        req.onload = function () { this.loader._onLoaded(url, this.responseText); }
        req.onerror = function () { this.loader._onFailed(url, this.statusText); }
        req.open("GET", url, true);
        req.send();
        break;
      case Loader.prototype.IMAGE:
        var img = new Image();
        img.loader = this;
        img.onload = function () { this.loader._onLoaded(url, this); }
        img.onerror = function () { this.loader._onFailed(url, "image loading failed"); }
        img.src = url;
        break;
      case Loader.prototype.AUDIO:
        var auElem = document.createElement('audio');
        auElem.preload = true;
        auElem.controls = false;
        auElem.loader = this;
        auElem.addEventListener('canplaythrough', function () { this.loader._onLoaded(url, this); });
        auElem.addEventListener('error', function () { this.loader._onLoaded(url, this); });
        auElem.src = url;
        document.body.appendChild(auElem);
        break;
      case Loader.prototype.CUSTOM:
        var theLoader = this;
        var theArgs = [ url, 
                        function (val) { theLoader._onLoaded(url, val); },
                        function (err) { theLoader._onFailed(url, err); } ].concat(asset.extraURLs);
        asset.start.apply(url, theArgs);
        break;
      default:
        break;
    }
  }


  Loader.prototype._onLoaded = function (url, value)
  {
    var asset = this.assets[url];

    asset.req = null;
    asset.finished = true;

    if (asset.postprocess)
      asset.value = asset.postprocess(value);
    else
      asset.value = value;

    if (asset.value) {
      this.succeeded++;
      if (this.verbose)
        console.log("asset " + url + " loaded");
      if (asset.group && this._canPostprocessGroup(asset.group))
        this._postprocessGroup(asset.group);
    }
    else {
      this._onFailed(url, "postprocessing failed");
    }
  }


  Loader.prototype._onFailed = function (url, msg)
  {
    var asset = this.assets[url];
    if (!asset)
      return;

    this.failed++;
    asset.error = msg;
    console.error(msg + " for " + url);
  }


  Loader.prototype._canPostprocessGroup = function (groupName)
  {
    var group = this.groups[groupName];
    return group && group.postprocess && this.groupFinished(groupName);
  }


  Loader.prototype._postprocessGroup = function (groupName)
  {
    var group = this.groups[groupName];
    if (!group || !group.postprocess)
      return;

    var args = [];
    for (var i = 0, end = group.assets.length; i < end; ++i) {
      var asset = this.assets[group.assets[i]];
      args.push(asset.value);
    }

    group.value = group.postprocess.apply(undefined, args);
    if (this.verbose)
      console.log("finished postprocessing " + groupName);
  }


  //
  // Math helpers
  //

  function radians(angleInDegrees)
  {
    return angleInDegrees * Math.PI / 180.0;
  }


  function degrees(angleInRadians)
  {
    return angleInRadians * 180.0 / Math.PI;
  }


  function roundTo(value, decimalPlaces)
  {
    var scale = Math.pow(10, decimalPlaces);
    var rounded = Math.floor(value * scale) / scale;
    str = "" + rounded;
    if (decimalPlaces > 0 && rounded == Math.floor(rounded)) {
      str += ".";
      for (var i = 0; i < decimalPlaces; i++)
        str += 0;
    }
    return str;
  }


  function clamp(value, min, max)
  {
    if (value <= min)
      return min;
    else if (value >= max)
      return max;
    else
      return value;
  }


  function saturate(value)
  {
    return clamp(value, 0.0, 1.0);
  }


  //
  // Export public symbols.
  //

  return {
    // Constant bundles
    'keycodes': keycodes,
    'buttons': buttons,
    // Game variables
    'config': config,
    'globals': globals,
    'mouse': globals.mouse,
    // Setup and configuration
    'addState': addState,
    'addEvent': addEvent,
    'addAlwaysOnEvent': addAlwaysOnEvent,
    'addTimeEvent': addTimeEvent,
    'addChangeStateAtTimeEvent': addChangeStateAtTimeEvent,
    'addKeyPressEvent': addKeyPressEvent,
    'addChangeStateOnKeyPressEvent': addChangeStateOnKeyPressEvent,
    'addGameConditionEvent': addGameConditionEvent,
    // Standard event trigger and expire methods
    'alwaysTrigger': alwaysTrigger,
    'neverExpire': neverExpire,
    'timeTrigger': timeTrigger,
    'timeExpire': timeExpire,
    // Main game loop
    'start': start,
    'useExternalUpdates': useExternalUpdates,
    'update': update,
    'changeState': changeState,
    'changeToPrevState': changeToPrevState,
    // Input handling
    'useKeyboard': useKeyboard,
    'clearKeyboard': clearKeyboard,
    'anyKeyPressed': anyKeyPressed,
    'isKeyPressed': isKeyPressed,
    'useMouse': useMouse,
    'anyButtonPressed': anyButtonPressed,
    'isButtonPressed': isButtonPressed,
    // Sound functions
    'addSound': addSound,
    'playSound': playSound,
    'stopSound': stopSound,
    // Browser functions
    'browserCapabilities': browserCapabilities,
    'showWarning': showWarning,
    'showError': showError,
    // Asset loading
    'Loader': Loader,
    // Math helper functions
    'radians': radians,
    'degrees': degrees,
    'roundTo': roundTo,
    'clamp': clamp,
    'saturate': saturate
  };

}(); // end of the ludum namespace.

