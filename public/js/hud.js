var ld27hud = function() { // start of the ld27hud namespace

  //
  // The HUD class
  //

  function HUD(x, y, w, h, opacity, font, halign, color)
  {
    this.w = w;
    this.h = h;
    this.font = font;
    this.halign = halign;
    this.colorHex = '#' + (("00000" + color.toString(16)).slice(-6));

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.display = 'none';
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = this.colorHex;
    this.ctx.font = font;
    this.ctx.textAlign = halign;
    this.ctx.textBaseline = "middle";

    this.geometry = new THREE.PlaneGeometry(w, h);
    this.geometry.computeBoundingBox();

    this.texture = new THREE.Texture(this.canvas);
    this.material = new THREE.MeshBasicMaterial({ 'map': this.texture, 'transparent': true, 'opacity': opacity });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(x, y, 0);

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
      var iw = icon.width;
      var ih = icon.height;
      var iy = Math.min((h - ih) / 2, 4);
      this.ctx.drawImage(icon, 4, iy);
      if (this.halign == "left")
        x = iw + 8;
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


  HUD.prototype.onResize = function ()
  {
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    
    this.ctx.fillStyle = this.colorHex;
    this.ctx.font = this.font;
    this.ctx.textAlign = this.halign;
    this.ctx.textBaseline = "middle";

    this.texture.needsUpdate = true;
  }


  //
  // Public symbols
  //

  return {
    'HUD': HUD,
  };

}(); // end of the ld27hud namespace

