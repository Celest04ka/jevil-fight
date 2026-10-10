// WebGL renderer emulating GameMaker drawing into a 640x480 application surface.
'use strict';

(function () {
  const D = GM.draw = {
    W: 640, H: 480,
    color: 0xFFFFFF, alpha: 1, font: -1, halign: 0, valign: 0,
    fog: null, blendEnabled: true, blendMode: 0, circlePrecision: 24,
    pages: [], // {tex, w, h}
    fontsRt: [] // runtime font objects (index = font asset index, plus added sprite fonts)
  };

  const MAXV = 6 * 4096;
  const STRIDE = 20; // x,y,u,v float32 + rgba u8
  let gl, prog, vbuf, data, f32, u8, count = 0, curTex = null, whiteTex, appFbo, appTex, canvas, uRes, uFog, uFlipY;
  let curTarget = null; // null = app surface

  D.init = function (cnv) {
    canvas = cnv;
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL is not available');
    D.gl = gl;
    const vs = `attribute vec2 aPos; attribute vec2 aUV; attribute vec4 aCol;
      uniform vec2 uRes; uniform float uFlipY; varying vec2 vUV; varying vec4 vCol;
      void main() { vec2 p = aPos / uRes * 2.0 - 1.0; gl_Position = vec4(p.x, -p.y * uFlipY, 0.0, 1.0); vUV = aUV; vCol = aCol; }`;
    const fs = `precision mediump float; uniform sampler2D uTex; uniform vec4 uFog; varying vec2 vUV; varying vec4 vCol;
      void main() { vec4 c = texture2D(uTex, vUV) * vCol; if (uFog.a > 0.5) c.rgb = uFog.rgb; gl_FragColor = c; }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    uRes = gl.getUniformLocation(prog, 'uRes');
    uFog = gl.getUniformLocation(prog, 'uFog');
    uFlipY = gl.getUniformLocation(prog, 'uFlipY');
    gl.uniform4f(uFog, 0, 0, 0, 0);
    data = new ArrayBuffer(MAXV * STRIDE);
    f32 = new Float32Array(data);
    u8 = new Uint8Array(data);
    vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos'), aUV = gl.getAttribLocation(prog, 'aUV'), aCol = gl.getAttribLocation(prog, 'aCol');
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(aUV); gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, STRIDE, 8);
    gl.enableVertexAttribArray(aCol); gl.vertexAttribPointer(aCol, 4, gl.UNSIGNED_BYTE, true, STRIDE, 16);
    whiteTex = makeTex(1, 1, new Uint8Array([255, 255, 255, 255]));
    whiteTex.w = 1; whiteTex.h = 1;
    // application surface
    appTex = makeTex(D.W, D.H, null);
    appFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, appFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, appTex, 0);
    gl.enable(gl.BLEND);
    setBlend(0);
  };

  function makeTex(w, h, pixels, img) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (img) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return t;
  }

  D.addPage = function (i, img) {
    const t = makeTex(img.width, img.height, null, img);
    t.w = img.width; t.h = img.height;
    D.pages[i] = t;
  };

  function flush() {
    if (count === 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Uint8Array(data, 0, count * STRIDE));
    gl.drawArrays(gl.TRIANGLES, 0, count);
    count = 0;
  }
  D.flush = flush;

  function useTex(t) {
    if (t !== curTex) { flush(); curTex = t; gl.bindTexture(gl.TEXTURE_2D, t); }
  }

  function setBlend(mode) {
    flush();
    D.blendMode = mode;
    gl.blendEquation(gl.FUNC_ADD);
    switch (mode) {
      case 1: gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.SRC_ALPHA, gl.ONE); break; // add
      case 2: gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_COLOR, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); break; // max
      case 3: gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA); break; // subtract
      case 4: gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.SRC_ALPHA, gl.ONE); break;
      default: gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
    }
  }
  D.setBlend = setBlend;
  D.setBlendEnable = function (on) { flush(); D.blendEnabled = on; if (on) gl.enable(gl.BLEND); else gl.disable(gl.BLEND); };
  D.setFog = function (on, col) {
    flush();
    if (on) gl.uniform4f(uFog, (col & 255) / 255, ((col >> 8) & 255) / 255, ((col >> 16) & 255) / 255, 1);
    else gl.uniform4f(uFog, 0, 0, 0, 0);
    D.fog = on ? col : null;
  };

  // room-space -> surface offset (camera), applied at vertex write time
  let offX = 0, offY = 0;
  D.setOffset = function (x, y) { flush(); offX = x; offY = y; D.offX = x; D.offY = y; };

  function vert(x, y, u, v, r, g, b, a) {
    if (count >= MAXV) flush();
    const o = count * 5;
    f32[o] = x + offX; f32[o + 1] = y + offY; f32[o + 2] = u; f32[o + 3] = v;
    const ob = count * STRIDE + 16;
    u8[ob] = r; u8[ob + 1] = g; u8[ob + 2] = b; u8[ob + 3] = a;
    count++;
  }

  // textured quad: 4 corners (x,y) and uv rect, per-corner colours [c0 tl, c1 tr, c2 br, c3 bl] as BGR ints
  function quad(tex, x0, y0, x1, y1, x2, y2, x3, y3, u0, v0, u1, v1, c0, c1, c2, c3, alpha) {
    if (count + 6 > MAXV) flush();
    useTex(tex);
    const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
    const R = c => c & 255, G = c => (c >> 8) & 255, B = c => (c >> 16) & 255;
    vert(x0, y0, u0, v0, R(c0), G(c0), B(c0), a);
    vert(x1, y1, u1, v0, R(c1), G(c1), B(c1), a);
    vert(x2, y2, u1, v1, R(c2), G(c2), B(c2), a);
    vert(x0, y0, u0, v0, R(c0), G(c0), B(c0), a);
    vert(x2, y2, u1, v1, R(c2), G(c2), B(c2), a);
    vert(x3, y3, u0, v1, R(c3), G(c3), B(c3), a);
  }

  function tri(x0, y0, x1, y1, x2, y2, c0, c1, c2, alpha) {
    if (count + 3 > MAXV) flush();
    useTex(whiteTex);
    const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
    vert(x0, y0, 0.5, 0.5, c0 & 255, (c0 >> 8) & 255, (c0 >> 16) & 255, a);
    vert(x1, y1, 0.5, 0.5, c1 & 255, (c1 >> 8) & 255, (c1 >> 16) & 255, a);
    vert(x2, y2, 0.5, 0.5, c2 & 255, (c2 >> 8) & 255, (c2 >> 16) & 255, a);
  }
  D.tri = tri;

  // ---------------------------------------------------------------- sprites
  function frameOf(s, sub) {
    const n = s.frames.length;
    if (n === 0) return null;
    let i = Math.floor(sub) % n;
    if (i < 0) i += n;
    return s.frames[i];
  }
  D.frameOf = frameOf;

  // draw a texture-page region whose local (unrotated, unscaled) top-left is (lx,ly) relative to the anchor
  function drawRegion(fr, sx, sy, sw, sh, lx, ly, lw, lh, x, y, xs, ys, rot, col, alpha, cols) {
    const page = D.pages[fr.p];
    if (!page) return;
    const u0 = sx / page.w, v0 = sy / page.h, u1 = (sx + sw) / page.w, v1 = (sy + sh) / page.h;
    const ax = lx * xs, ay = ly * ys, bx = (lx + lw) * xs, by = (ly + lh) * ys;
    let x0, y0, x1, y1, x2, y2, x3, y3;
    if (rot === 0) {
      x0 = x + ax; y0 = y + ay; x1 = x + bx; y1 = y + ay; x2 = x + bx; y2 = y + by; x3 = x + ax; y3 = y + by;
    } else {
      const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
      const tx = (px, py) => x + px * c + py * s, ty = (px, py) => y - px * s + py * c;
      x0 = tx(ax, ay); y0 = ty(ax, ay); x1 = tx(bx, ay); y1 = ty(bx, ay); x2 = tx(bx, by); y2 = ty(bx, by); x3 = tx(ax, by); y3 = ty(ax, by);
    }
    if (cols) quad(page, x0, y0, x1, y1, x2, y2, x3, y3, u0, v0, u1, v1, cols[0], cols[1], cols[2], cols[3], alpha);
    else quad(page, x0, y0, x1, y1, x2, y2, x3, y3, u0, v0, u1, v1, col, col, col, col, alpha);
  }

  D.sprite = function (spr, sub, x, y, xs, ys, rot, col, alpha) {
    const s = GM.sprites[spr];
    if (!s) return;
    const fr = frameOf(s, sub);
    if (!fr) return;
    drawRegion(fr, fr.sx, fr.sy, fr.sw, fr.sh, fr.tx - s.ox, fr.ty - s.oy, fr.tw, fr.th, x, y, xs, ys, rot, col, alpha);
  };

  D.spriteGeneral = function (spr, sub, left, top, w, h, x, y, xs, ys, rot, cols, alpha) {
    const s = GM.sprites[spr];
    if (!s) return;
    const fr = frameOf(s, sub);
    if (!fr) return;
    // intersect requested part with the trimmed frame
    const ix0 = Math.max(left, fr.tx), iy0 = Math.max(top, fr.ty);
    const ix1 = Math.min(left + w, fr.tx + fr.tw), iy1 = Math.min(top + h, fr.ty + fr.th);
    if (ix1 <= ix0 || iy1 <= iy0) return;
    const kx = fr.sw / fr.tw, ky = fr.sh / fr.th;
    const sx = fr.sx + (ix0 - fr.tx) * kx, sy = fr.sy + (iy0 - fr.ty) * ky;
    drawRegion(fr, sx, sy, (ix1 - ix0) * kx, (iy1 - iy0) * ky, ix0 - left, iy0 - top, ix1 - ix0, iy1 - iy0, x, y, xs, ys, rot, cols ? 0 : 0xFFFFFF, alpha, cols);
  };

  D.spritePart = function (spr, sub, left, top, w, h, x, y, xs, ys, col, alpha) {
    D.spriteGeneral(spr, sub, left, top, w, h, x, y, xs, ys, 0, [col, col, col, col], alpha);
  };

  D.spriteStretched = function (spr, sub, x, y, w, h, col, alpha) {
    const s = GM.sprites[spr];
    if (!s) return;
    D.spriteGeneral(spr, sub, 0, 0, s.w, s.h, x, y, w / s.w, h / s.h, 0, [col, col, col, col], alpha);
  };

  D.spriteTiled = function (spr, sub, x, y, xs, ys, col, alpha) {
    const s = GM.sprites[spr];
    if (!s) return;
    const w = s.w * xs, h = s.h * ys;
    if (w <= 0 || h <= 0) return;
    const cam = GM.views[0] && GM.views[0].visible ? GM.views[0].cam : { x: 0, y: 0, w: D.W, h: D.H };
    let sx = x - s.ox * xs, sy = y - s.oy * ys;
    sx = cam.x + ((sx - cam.x) % w) - w; sy = cam.y + ((sy - cam.y) % h) - h;
    for (let yy = sy; yy < cam.y + cam.h; yy += h) for (let xx = sx; xx < cam.x + cam.w; xx += w) D.sprite(spr, sub, xx + s.ox * xs, yy + s.oy * ys, xs, ys, 0, col, alpha);
  };

  // ---------------------------------------------------------------- primitives
  D.rect = function (x1, y1, x2, y2, outline, c1, c2, c3, c4, alpha) {
    if (x1 > x2) { const q = x1; x1 = x2; x2 = q; }
    if (y1 > y2) { const q = y1; y1 = y2; y2 = q; }
    if (outline) {
      D.rect(x1, y1, x2, y1, false, c1, c2, c2, c1, alpha);
      D.rect(x1, y2, x2, y2, false, c4, c3, c3, c4, alpha);
      D.rect(x1, y1 + 1, x1, y2 - 1, false, c1, c1, c4, c4, alpha);
      D.rect(x2, y1 + 1, x2, y2 - 1, false, c2, c2, c3, c3, alpha);
      return;
    }
    useTex(whiteTex);
    quad(whiteTex, x1, y1, x2 + 1, y1, x2 + 1, y2 + 1, x1, y2 + 1, 0, 0, 1, 1, c1, c2, c3, c4, alpha);
  };

  D.line = function (x1, y1, x2, y2, w, c1, c2, alpha) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) { D.rect(Math.floor(x1), Math.floor(y1), Math.floor(x1), Math.floor(y1), false, c1, c1, c1, c1, alpha); return; }
    const nx = -dy / len * w / 2, ny = dx / len * w / 2;
    const ox = w <= 1 ? 0.5 : 0, oy = w <= 1 ? 0.5 : 0;
    // extend 1px lines by half a pixel at both ends so endpoints are covered like GM's line primitive
    const ex = w <= 1 ? dx / len * 0.5 : 0, ey = w <= 1 ? dy / len * 0.5 : 0;
    const ax = x1 + ox - ex, ay = y1 + oy - ey, bx = x2 + ox + ex, by = y2 + oy + ey;
    quad(whiteTex, ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax - nx, ay - ny, 0, 0, 1, 1, c1, c2, c2, c1, alpha);
  };

  D.triangle = function (x1, y1, x2, y2, x3, y3, outline, c1, c2, c3, alpha) {
    if (outline) {
      D.line(x1, y1, x2, y2, 1, c1, c2, alpha);
      D.line(x2, y2, x3, y3, 1, c2, c3, alpha);
      D.line(x3, y3, x1, y1, 1, c3, c1, alpha);
      return;
    }
    tri(x1, y1, x2, y2, x3, y3, c1, c2, c3, alpha);
  };

  D.ellipse = function (x1, y1, x2, y2, outline, c1, c2, alpha) {
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
    const n = D.circlePrecision;
    let px = cx + rx, py = cy;
    for (let i = 1; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const nx = cx + Math.cos(a) * rx, ny = cy + Math.sin(a) * ry;
      if (outline) D.line(px, py, nx, ny, 1, c2, c2, alpha);
      else tri(cx, cy, px, py, nx, ny, c1, c2, c2, alpha);
      px = nx; py = ny;
    }
  };

  D.circle = function (x, y, r, outline, c1, c2, alpha) { D.ellipse(x - r, y - r, x + r, y + r, outline, c1, c2, alpha); };

  D.clear = function (col, alpha) {
    flush();
    gl.clearColor((col & 255) / 255, ((col >> 8) & 255) / 255, ((col >> 16) & 255) / 255, alpha);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  // ---------------------------------------------------------------- fonts & text
  D.setupFonts = function (fontsMeta) {
    D.fontsRt = fontsMeta.map((f, i) => {
      if (!f) return null;
      const glyphs = new Map();
      let maxH = 0;
      for (const g of f.glyphs) { glyphs.set(g[0], { x: g[1], y: g[2], w: g[3], h: g[4], shift: g[5], offset: g[6] }); if (g[4] > maxH) maxH = g[4]; }
      return { name: f.name, tex: f.tex, glyphs, lineH: maxH, size: f.size, sprite: -1 };
    });
  };

  D.addSpriteFont = function (spr, map, prop, sep) {
    const s = GM.sprites[spr];
    const glyphs = new Map();
    let maxH = 0;
    [...map].forEach((ch, i) => {
      const fr = s.frames[i];
      if (!fr) return;
      const w = prop ? fr.tw : s.w;
      const off = prop ? -fr.tx : 0;
      glyphs.set(ch.codePointAt(0), { frame: i, shift: w + sep, offset: off, h: s.h });
      maxH = Math.max(maxH, s.h);
    });
    const f = { name: 'spritefont', sprite: spr, glyphs, lineH: maxH, prop };
    D.fontsRt.push(f);
    return D.fontsRt.length - 1;
  };

  function curFont() { return D.fontsRt[D.font] || D.fontsRt.find(f => f) || null; }
  D.curFont = curFont;

  function glyphOf(f, code) { return f.glyphs.get(code) || f.glyphs.get(32) || null; }

  function lineWidth(f, line) {
    let w = 0;
    for (const ch of line) { const g = glyphOf(f, ch.codePointAt(0)); if (g) w += g.shift; }
    return w;
  }

  function splitLines(str) { return String(str).split(/\r\n|\n|\r/); }

  D.stringWidth = function (str) {
    const f = curFont();
    if (!f) return 0;
    let m = 0;
    for (const l of splitLines(str)) m = Math.max(m, lineWidth(f, l));
    return m;
  };
  D.stringHeight = function (str) {
    const f = curFont();
    if (!f) return 0;
    return splitLines(str).length * f.lineH;
  };

  // generic text: cols = [tl, tr, br, bl] gradient across each line
  D.text = function (x, y, str, xs, ys, angle, cols, alpha, sep, maxw) {
    const f = curFont();
    if (!f) return;
    let lines = splitLines(str);
    const lh = sep !== undefined && sep >= 0 ? sep : f.lineH;
    if (maxw !== undefined && maxw > 0) lines = wrapLines(f, lines, maxw);
    const totalH = lines.length * lh;
    let oy = 0;
    if (D.valign === 1) oy = -totalH / 2; else if (D.valign === 2) oy = -totalH;
    const c = Math.cos(angle * Math.PI / 180), s = Math.sin(angle * Math.PI / 180);
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lw = lineWidth(f, line);
      let ox = 0;
      if (D.halign === 1) ox = -Math.floor(lw / 2); else if (D.halign === 2) ox = -lw;
      let cx = ox;
      const cy = oy + li * lh;
      for (const ch of line) {
        const g = glyphOf(f, ch.codePointAt(0));
        if (!g) continue;
        const gx = cx + g.offset;
        // gradient colours for this glyph
        let gc = null;
        if (cols) {
          const t0 = lw > 0 ? (gx - ox) / lw : 0, t1 = lw > 0 ? (gx - ox + (g.w || g.shift)) / lw : 1;
          const top0 = mergeCol(cols[0], cols[1], t0), top1 = mergeCol(cols[0], cols[1], t1);
          const bot0 = mergeCol(cols[3], cols[2], t0), bot1 = mergeCol(cols[3], cols[2], t1);
          gc = [top0, top1, bot1, bot0];
        }
        const px = x + (gx * xs) * c + (cy * ys) * s, py = y - (gx * xs) * s + (cy * ys) * c;
        if (f.sprite >= 0) {
          const spr = GM.sprites[f.sprite];
          const fr = spr.frames[g.frame];
          if (fr) drawRegion(fr, fr.sx, fr.sy, fr.sw, fr.sh, fr.tx, fr.ty, fr.tw, fr.th, px, py, xs, ys, angle, 0xFFFFFF, alpha, gc || [D.color, D.color, D.color, D.color]);
        } else if (g.w > 0 && g.h > 0) {
          const t = f.tex;
          drawRegion({ p: t.p }, t.sx + g.x, t.sy + g.y, g.w, g.h, 0, 0, g.w, g.h, px, py, xs, ys, angle, 0xFFFFFF, alpha, gc || [D.color, D.color, D.color, D.color]);
        }
        cx += g.shift;
      }
    }
  };

  function wrapLines(f, lines, maxw) {
    const out = [];
    for (const line of lines) {
      const words = line.split(' ');
      let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (cur && lineWidth(f, t) > maxw) { out.push(cur); cur = w; } else cur = t;
      }
      out.push(cur);
    }
    return out;
  }

  function mergeCol(c1, c2, a) {
    const r = (c1 & 255) + ((c2 & 255) - (c1 & 255)) * a;
    const g = ((c1 >> 8) & 255) + (((c2 >> 8) & 255) - ((c1 >> 8) & 255)) * a;
    const b = ((c1 >> 16) & 255) + (((c2 >> 16) & 255) - ((c1 >> 16) & 255)) * a;
    return (r | 0) | ((g | 0) << 8) | ((b | 0) << 16);
  }
  D.mergeCol = mergeCol;

  // ---------------------------------------------------------------- frame
  // begin/end a frame on the application surface (also used by the outer menu, which draws without the game)
  D.begin = function (bg) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, appFbo);
    gl.viewport(0, 0, D.W, D.H);
    gl.uniform2f(uRes, D.W, D.H);
    gl.uniform1f(uFlipY, 1);
    D.clear(bg == null ? 0 : bg, 1);
    D.setOffset(0, 0);
  };
  D.end = function () { flush(); D.blit(); };

  D.frame = function () {
    D.begin(GM.bgColor);
    // camera transform: we draw in room coords offset by the view position
    const v = GM.views && GM.views[0];
    D.camX = v && v.visible ? v.cam.x : 0;
    D.camY = v && v.visible ? v.cam.y : 0;
    D.setOffset(-D.camX, -D.camY);
    const list = GM.instances.filter(i => !i.$dead && i.$active && i.visible);
    list.sort((a, b) => (b.$depth - a.$depth) || (a.$seq - b.$seq));
    D.drawLayerBackgrounds();
    const EVD = GM.EV.DRAW;
    for (const inst of list) if (!inst.$dead && inst.visible) GM.perform(inst, EVD, 72);
    for (const inst of list) {
      if (inst.$dead || !inst.visible) continue;
      if (!GM.perform(inst, EVD, 0)) GM.F.draw_self(inst, inst);
    }
    for (const inst of list) if (!inst.$dead && inst.visible) GM.perform(inst, EVD, 73);
    D.setOffset(0, 0);
    if (D.debugDraw) D.debugDraw();
    for (const inst of list) if (!inst.$dead && inst.visible) GM.perform(inst, EVD, 64);
    if (D.hudDraw) D.hudDraw();
    D.end();
  };

  D.drawLayerBackgrounds = function () {
    if (!GM.layers) return;
    for (const l of GM.layers) {
      if (l.type !== 1 || !l.visible || !l.data || l.data.sprite == null) continue;
      const si = GM.assetIndex.get(l.data.sprite);
      if (!si) continue;
      const s = GM.sprites[si.i];
      const alpha = ((l.data.color >>> 24) & 255) / 255;
      if (l.data.htiled || l.data.vtiled) D.spriteTiled(si.i, 0, l.x, l.y, 1, 1, l.data.color & 0xFFFFFF, alpha);
      else D.sprite(si.i, 0, l.x + s.ox, l.y + s.oy, 1, 1, 0, l.data.color & 0xFFFFFF, alpha);
    }
  };

  D.blit = function () {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const cw = canvas.width, ch = canvas.height;
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const sc = Math.min(cw / D.W, ch / D.H);
    const w = D.W * sc, h = D.H * sc, x = (cw - w) / 2, y = (ch - h) / 2;
    gl.uniform2f(uRes, cw, ch);
    const savedOX = offX, savedOY = offY;
    offX = 0; offY = 0;
    gl.disable(gl.BLEND);
    useTex(appTex);
    quad(appTex, x, y, x + w, y, x + w, y + h, x, y + h, 0, 1, 1, 0, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 1);
    flush();
    if (D.blendEnabled) gl.enable(gl.BLEND);
    offX = savedOX; offY = savedOY;
    D.overlay && D.overlay(gl);
  };

  D.resize = function () {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(320, Math.floor((window.innerWidth || 1280) * dpr));
    const h = Math.max(240, Math.floor((window.innerHeight || 720) * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  };

  // sprite_create_from_surface(application_surface, ...): copy a region of the app surface into a new 1-frame sprite
  D.captureSprite = function (x, y, w, h, ox, oy) {
    flush();
    w = Math.max(1, Math.min(D.W, Math.round(w))); h = Math.max(1, Math.min(D.H, Math.round(h)));
    gl.bindFramebuffer(gl.FRAMEBUFFER, appFbo);
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(Math.round(x), D.H - Math.round(y) - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // flip rows (GL origin is bottom-left) and force opaque
    const rows = new Uint8Array(w * h * 4);
    for (let r = 0; r < h; r++) rows.set(px.subarray((h - 1 - r) * w * 4, (h - r) * w * 4), r * w * 4);
    for (let i = 3; i < rows.length; i += 4) rows[i] = 255;
    const t = makeTex(w, h, rows);
    t.w = w; t.h = h;
    const p = D.pages.length;
    D.pages.push(t);
    GM.sprites.push({ name: 'captured', w, h, ox: ox || 0, oy: oy || 0, ml: 0, mr: w - 1, mt: 0, mb: h - 1, sep: 0, speed: 1, speedType: 1,
      frames: [{ p, sx: 0, sy: 0, sw: w, sh: h, tx: 0, ty: 0, tw: w, th: h, bw: w, bh: h }] });
    gl.bindFramebuffer(gl.FRAMEBUFFER, appFbo);
    return GM.sprites.length - 1;
  };

  // read back the application surface (for screenshots / tests)
  D.snapshot = function () {
    gl.bindFramebuffer(gl.FRAMEBUFFER, appFbo);
    const px = new Uint8Array(D.W * D.H * 4);
    gl.readPixels(0, 0, D.W, D.H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return px;
  };
})();
