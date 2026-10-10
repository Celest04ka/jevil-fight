// Boot: load extracted Deltarune ch1 data, build the translated GML, start the game at the Jevil room.
'use strict';

(function () {
  const JF = window.JF = {
    paths: { meta: '_extract/meta/', assets: 'assets/' },
    running: false, paused: false, error: null,
    opts: { quick: false, practice: null, invincible: false, loadout: 'normal' }
  };
  const D = GM.draw;
  // music streams the Jevil room, battle and game over screens ask for (snd_init)
  JF.MUSIC = ['joker.ogg', 'prejoker.ogg', 'AUDIO_DRONE.ogg', 'AUDIO_DARKNESS.ogg'];

  // ------------------------------------------------------------ asset access
  // three sources: website pack (data/game.json + data/audio.bin + data/tex/*.png, see tools/build_site.js),
  // file:// bundles (window.JF_BUNDLE, tools/build_bundle.js), or the raw extraction (_extract/, dev only)
  let PACK = null;
  function urlFor(kind, name) {
    if (kind === 'meta') return JF.paths.meta + name;
    if (kind === 'tex') return JF.paths.meta + 'tex/' + name;
    if (kind === 'snd') return JF.paths.meta + 'snd/' + name;
    return JF.paths.assets + name;
  }
  async function fetchOk(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('fetch ' + url + ' ' + r.status);
    return r;
  }
  async function getJSON(kind, name) {
    const key = kind + '/' + name;
    if (PACK && PACK.json[key] !== undefined) return PACK.json[key];
    if (window.JF_BUNDLE && JF_BUNDLE.json[key]) return JF_BUNDLE.json[key];
    return (await fetchOk(urlFor(kind, name))).json();
  }
  async function getText(kind, name) {
    const key = kind + '/' + name;
    if (PACK && PACK.json[key] !== undefined) return PACK.json[key];
    if (window.JF_BUNDLE && JF_BUNDLE.text[key]) return JF_BUNDLE.text[key];
    return (await fetchOk(urlFor(kind, name))).text();
  }
  function b64ToBuf(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  async function getBinary(kind, name) {
    const key = kind + '/' + name;
    if (PACK && PACK.audioIndex[key]) { const [off, len] = PACK.audioIndex[key]; return PACK.audio.slice(off, off + len); }
    if (window.JF_BUNDLE && JF_BUNDLE.bin[key]) return b64ToBuf(JF_BUNDLE.bin[key]);
    return (await fetchOk(urlFor(kind, name))).arrayBuffer();
  }
  function getImage(name) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('image ' + name));
      if (PACK) img.src = 'data/tex/' + name;
      else if (window.JF_BUNDLE && JF_BUNDLE.bin['tex/' + name]) img.src = 'data:image/png;base64,' + JF_BUNDLE.bin['tex/' + name];
      else img.src = urlFor('tex', name);
    });
  }
  async function tryLoadPack(progress) {
    let r;
    try { r = await fetch('data/game.json'); } catch (e) { return false; }
    if (!r.ok) return false;
    progress && progress('data');
    const json = await r.json();
    progress && progress('audio');
    const audio = await (await fetchOk('data/audio.bin')).arrayBuffer();
    PACK = { json, audio, audioIndex: json.__audio };
    return true;
  }
  // GM file names used by audio streams ("mus/joker.ogg") and sounds ("ext:snd_x.ogg")
  GM.audio.loader = async function (file) {
    file = String(file).replace(/\\/g, '/');
    if (file.startsWith('snd:')) return getBinary('snd', file.slice(4));
    if (file.startsWith('ext:')) return getBinary('assets', 'ext/' + file.slice(4));
    return getBinary('assets', file.replace(/^.*?mus\//, 'mus/'));
  };

  // ------------------------------------------------------------ loading
  JF.load = async function (progress) {
    const say = (t) => progress && progress(t);
    say('data');
    const [sprites, objects, fonts, sounds, backgrounds, roomsList, rooms, general, scripts] = await Promise.all(
      ['sprites', 'objects', 'fonts', 'sounds', 'backgrounds', 'rooms_list', 'rooms', 'general', 'scripts'].map(n => getJSON('meta', n + '.json')));
    // asset index exactly like the translator (tools/gml2js.js buildAssets)
    const ai = GM.assetIndex;
    const add = (list, kind) => list.forEach((x, i) => { const nm = typeof x === 'string' ? x : x && x.name; if (nm) ai.set(nm, { kind, i }); });
    add(sprites, 'sprite'); add(sounds, 'sound'); add(backgrounds, 'background'); add(fonts, 'font'); add(roomsList, 'room'); add(objects, 'object');
    scripts.forEach((s, i) => { if (s && s.name && !ai.has(s.name)) ai.set(s.name, { kind: 'script', i }); });
    GM.scripts = scripts;
    GM.scriptByIndex = (i) => scripts[i] && GM.S[scripts[i].name];
    // sprites + collision masks
    GM.sprites = sprites.map(s => {
      if (!s) return null;
      const sp = Object.assign({}, s);
      sp.frames = s.frames.filter(Boolean);
      if (s.masks && s.masks.length && s.masks[0]) {
        sp.maskData = s.masks.map(m => m ? new Uint8Array(b64ToBuf(m)) : null);
        sp.mstride = (s.mw + 7) >> 3;
        // masks are either full-size or cropped to the bbox
        if (s.mw === s.w && s.mh === s.h) { sp.maskOx = 0; sp.maskOy = 0; } else { sp.maskOx = s.ml; sp.maskOy = s.mt; }
      }
      delete sp.masks;
      return sp;
    });
    GM.backgrounds = backgrounds;
    GM.roomNames = roomsList;
    GM.rooms = rooms;
    GM.roomOrder = general.roomOrder.map(n => ai.get(n) ? ai.get(n).i : -1).filter(i => i >= 0);
    GM.general = general;
    GM.sounds = sounds.map(s => s ? { name: s.name, file: s.file, volume: s.volume === undefined ? 1 : s.volume, pitch: s.pitch || 1, group: s.group, buffer: null } : null);
    D.setupFonts(fonts);
    // textures
    say('textures');
    const pages = Math.max(...sprites.filter(Boolean).flatMap(s => s.frames.filter(Boolean).map(f => f.p)), ...fonts.filter(Boolean).map(f => f.tex ? f.tex.p : 0)) + 1;
    await Promise.all(Array.from({ length: pages }, (_, i) => getImage(i + '.png').then(img => D.addPage(i, img))));
    // language file into the virtual file system
    GM.vfs.set('lang/lang_en.json', await getText('assets', 'lang/lang_en.json'));
    // sounds
    say('sounds');
    GM.audio.init();
    const entries = [];
    GM.sounds.forEach((s, i) => {
      if (!s || !s.file) return;
      entries.push({ index: i, url: s.file.startsWith('ext:') ? s.file : 'snd:' + s.file });
    });
    await GM.audio.loadSounds(entries, (d, n) => say(`sounds ${d}/${n}`));
    await Promise.all(JF.MUSIC.map(f => GM.audio.preloadStream('mus/' + f).catch(e => console.warn(e))));
    // translated GML
    say('code');
    JF.objectsMeta = objects;
    buildGML();
    say('ready');
  };

  function buildGML() {
    GM.S = {}; GM.C = {}; GM.I = {};
    const rt = Object.assign({}, GM.rt, { G: GM.globals, R: GM.R, F: GM.F, S: GM.S, C: GM.C, I: GM.I });
    GML_BUILD(rt);
    nativeOverrides();
    practicePatches();
    GM.setupObjects(JF.objectsMeta, GM.C);
  }

  // ------------------------------------------------------------ practice mode (our addition, not part of Deltarune)
  // Jevil picks his attack in obj_joker Step when "talked" goes 0 -> 1; in practice mode we replace the pick.
  function practicePatches() {
    const name = 'gml_Object_obj_joker_Step_0';
    const orig = GM.C[name];
    GM.C[name] = function (self, other) {
      const before = self.talked;
      orig(self, other);
      if (JF.opts.practice != null && before === 0 && self.talked === 1) {
        const a = JF.opts.practice;
        self.jattack = a;
        if (a === 2 || a === 5 || a === 9 || a === 13 || a === 15) GM.S.scr_targetall(self, other); else GM.S.scr_randomtarget(self, other);
        JF.practiceCount = (JF.practiceCount || 0) + 1;
      }
    };
  }

  // drives the hero menu in practice mode: everyone DEFENDs, HP is restored at the start of each player turn
  JF.practiceTick = function () {
    const G = GM.globals;
    if (JF.opts.practice == null || !GM.instanceExists(GM.assetIndex.get('obj_battlecontroller').i)) return;
    if (G.mnfight !== 0 || G.myfight !== 0) { JF.practiceHealed = false; return; }
    if (!JF.practiceHealed) {
      for (let i = 0; i < 3; i++) {
        const c = G.char[i];
        if (c > 0) G.hp[c] = G.maxhp[c];
      }
      for (let i = 0; i < 3; i++) if (G.char[i] > 0) GM.S.scr_revive(GM.globalSelf, GM.globalSelf, i);
      JF.practiceHealed = true;
    }
    if (G.bmenuno !== 0) return;
    const turn = G.charturn;
    if (turn < 0 || turn > 2) return;
    if (G.bmenucoord && G.bmenucoord[0]) G.bmenucoord[0][turn] = 4; // DEFEND button
    if ((GM.frame % 4) === 0) GM.input.keyDown(90); else if ((GM.frame % 4) === 2) GM.input.keyUp(90);
  };

  // faster native versions of a few compatibility scripts (same behaviour)
  function nativeOverrides() {
    const S = GM.S, F = GM.F;
    const viewProp = (prop, idx) => {
      const v = GM.views[idx] || GM.views[0];
      switch (prop) {
        case 0: return v.cam.x; case 1: return v.cam.y; case 2: return v.cam.w; case 3: return v.cam.h; case 4: return v.cam.angle;
        case 5: return v.cam.bx; case 6: return v.cam.by; case 7: return v.cam.sx; case 8: return v.cam.sy; case 9: return v.cam.target;
        case 10: return +v.visible; case 11: return v.px; case 12: return v.py; case 13: return v.pw; case 14: return v.ph; case 15: return idx; case 16: return -1;
      }
      return -1;
    };
    S.__view_get = (self, other, prop, idx) => viewProp(prop, idx);
    // retry after a game over: the real game reloads the temp save; we restart the fight (tempflag[4] keeps the short intro)
    S.scr_tempload = () => { JF.pending = 'retry'; };
    S.ossafe_game_end = () => { JF.pending = 'menu'; };
    const origSet = S.__view_set;
    S.__view_set = (self, other, prop, idx, val) => {
      const v = GM.views[idx] || GM.views[0];
      switch (prop) {
        case 0: v.cam.x = val; return; case 1: v.cam.y = val; return; case 2: v.cam.w = val; return; case 3: v.cam.h = val; return;
        case 9: v.cam.target = val; return; case 10: v.visible = RT_t(val); return;
      }
      if (origSet) origSet(self, other, prop, idx, val);
    };
  }
  const RT_t = (v) => GM.rt.$t(v);

  // ------------------------------------------------------------ game state for the fight (what a save before Jevil would hold)
  JF.LOADOUTS = {
    normal: { weapon: [0, 5, 6, 9], armor1: [0, 1, 1, 4], armor2: [0, 2, 0, 1], items: [6, 2, 8, 8, 13, 1, 1, 1] },
    strong: { weapon: [0, 8, 6, 9], armor1: [0, 5, 5, 4], armor2: [0, 2, 2, 3], items: [6, 2, 2, 11, 8, 13, 13, 12, 12, 1, 1, 1] },
    starter: { weapon: [0, 1, 2, 3], armor1: [0, 0, 0, 0], armor2: [0, 0, 0, 0], items: [1, 1, 1] }
  };
  function applyJevilSave(self) {
    const G = GM.globals, S = GM.S;
    const L = JF.LOADOUTS[JF.opts.loadout] || JF.LOADOUTS.normal;
    // the same calls obj_prisonevent makes when Susie and Ralsei rejoin (con 317), right before the Jevil area
    G.plot = 156;
    S.scr_losechar(self, self);
    G.char[0] = 1;
    S.scr_getchar(self, self, 2);
    S.scr_getchar(self, self, 3);
    G.charauto[0] = 0; G.charauto[1] = 0; G.charauto[2] = 0; G.charauto[3] = 0;
    G.darkzone = 1;
    G.truename = 'KRIS';
    G.gold = 120;
    for (let i = 1; i <= 3; i++) {
      G.charweapon[i] = L.weapon[i]; G.chararmor1[i] = L.armor1[i]; G.chararmor2[i] = L.armor2[i];
      G.hp[i] = G.maxhp[i];
    }
    for (let i = 0; i < 13; i++) G.item[i] = L.items[i] || 0;
    S.scr_weaponinfo_mine(self, self);
    S.scr_armorinfo_mine(self, self);
    S.scr_iteminfo_all(self, self);
    G.flag[16] = 1; // music volume
    G.flag[15] = 1; // sfx volume (if used)
    G.flag[241] = 0; // Jevil not beaten
    G.tempflag[4] = (JF.opts.quick || JF.retryQuick) ? 1 : 0; // short intro, as on a retry in the real game
    G.facing = 1;
    G.interact = 0;
    G.entrance = 0;
    if (JF.opts.invincible) G.chemg_god_mode = 1; // Deltarune's own debug god mode (checked in scr_damage)
    // the music the previous room (room_cc_prison_prejoker, obj_event_room) leaves playing when Kris reaches Jevil's door
    const song = GM.rt.$A(G, 'currentsong');
    song[0] = S.snd_init(self, self, 'prejoker.ogg');
    song[1] = S.mus_loop_ext(self, self, song[0], 1, 0.85);
    S.mus_volume(self, self, song[1], 0.8, 0);
    JF.onSaveApplied && JF.onSaveApplied(G);
  }

  // ------------------------------------------------------------ start / restart
  JF.start = function () {
    JF.error = null;
    GM.audio.stopAll();
    // fresh runtime state
    for (const k of Object.keys(GM.globals)) delete GM.globals[k];
    GM.instances.length = 0; GM.byId.clear(); GM.lastId = 300000; GM.room = -1; GM.newRoom = -1; GM.started = false;
    GM.dsMaps.length = 0; GM.dsLists.length = 0;
    D.fontsRt.length = 0; D.setupFonts(JF.fontsMeta || []);
    D.font = -1; D.color = 0xFFFFFF; D.alpha = 1; D.halign = 0; D.valign = 0;
    GM.input.clear();
    GM.globalSelf = new GM.Instance(-5, { index: -1, sprite: -1, mask: -1, depth: 0, visible: false, solid: false, persistent: false, ev: new Map(), col: [], ancSet: new Set(), descSet: new Set() });
    // global script top-level code (GMS 2.3 runs it before the first room)
    for (const name of GM.general.globalInit) { const f = GM.I[name]; if (f) f(GM.globalSelf, GM.globalSelf); }
    // redirect the first menu room to the Jevil room
    GM.roomRedirect = function (target) {
      const name = GM.roomNames[target];
      if (name === 'PLACE_CONTACT' || name === 'PLACE_MENU' || name === 'room_legend' || name === 'PLACE_DOG') {
        applyJevilSave(GM.globalSelf);
        return GM.assetIndex.get('room_cc_joker').i;
      }
      if (name === 'room_cc_prison_prejoker') { JF.onFightOver && JF.onFightOver(); return -1; }
      return target;
    };
    GM.beforeStep = JF.practiceTick;
    JF.practiceCount = 0;
    GM.gotoRoomNow(GM.assetIndex.get('ROOM_INITIALIZE').i);
    JF.running = true;
  };

  // room_goto goes through the redirect hook
  const origGoto = GM.F.room_goto;
  GM.checkRoomOrig = GM.checkRoom;
  GM.checkRoom = function () {
    if (GM.newRoom !== -1 && GM.roomRedirect) {
      const r = GM.roomRedirect(GM.newRoom);
      if (r === -1) { GM.newRoom = -1; JF.running = false; return true; }
      GM.newRoom = r;
    }
    return GM.checkRoomOrig();
  };

  // ------------------------------------------------------------ main loop
  GM.onGameEnd = () => { JF.pending = 'menu'; };
  // one game step plus handling of requests made by the game code during it
  JF.tick = function () {
    GM.step();
    if (JF.pending) {
      const p = JF.pending;
      JF.pending = null;
      if (p === 'retry') { JF.retryQuick = true; JF.start(); }
      else if (p === 'menu') { JF.running = false; GM.audio.stopAll(); JF.onQuit && JF.onQuit(); }
    }
  };
  let acc = 0, last = 0;
  const STEP = 1000 / 30;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    acc += now - last;
    last = now;
    if (!JF.running || JF.paused) {
      acc = 0;
      if (!JF.running && JF.menuFrame) { try { JF.menuFrame(now); } catch (e) { console.error(e); JF.menuFrame = null; } }
      return;
    }
    let n = 0;
    while (acc >= STEP && n < 3) {
      try { JF.tick(); } catch (e) { JF.fail(e); return; }
      acc -= STEP; n++;
    }
    if (acc > STEP * 3) acc = 0;
  }
  JF.fail = function (e) {
    JF.running = false;
    JF.error = e;
    console.error('[JevilFight] runtime error', e);
    JF.onError && JF.onError(e);
  };
  JF.stepN = function (n) { for (let i = 0; i < n; i++) JF.tick(); };

  // ------------------------------------------------------------ input
  const blockKeys = new Set([37, 38, 39, 40, 32, 13, 16, 17, 9, 112, 113, 114, 116, 117, 118, 119, 120, 121, 122, 123]);
  window.addEventListener('keydown', (e) => {
    if (e.keyCode === 115 || (e.keyCode === 13 && e.altKey)) { // F4 / Alt+Enter: fullscreen
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => 0);
      return;
    }
    if (JF.keyFilter && JF.keyFilter(e)) return;
    if (blockKeys.has(e.keyCode) || (e.keyCode >= 65 && e.keyCode <= 90 && !e.ctrlKey)) e.preventDefault();
    GM.input.keyDown(e.keyCode);
    GM.audio.resume();
  });
  window.addEventListener('keyup', (e) => { GM.input.keyUp(e.keyCode); });
  window.addEventListener('blur', () => GM.input.clear());

  // opened by double click (file://): fetch() is not allowed, so load the packed resources as scripts
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error('missing ' + src + ' (build it: node tools/build_bundle.js)'));
      document.head.appendChild(s);
    });
  }

  JF.init = async function (canvas, progress) {
    D.init(canvas);
    D.resize();
    window.addEventListener('resize', D.resize);
    if (location.protocol === 'file:' || /[?&]bundle/.test(location.search)) {
      progress && progress('resource packs');
      try {
        for (const n of ['meta', 'tex', 'snd']) await loadScript('data/bundle_' + n + '.js');
      } catch (e) {
        throw new Error('this copy has to be opened through a web server (for example the GitHub Pages site), not as a local file');
      }
    } else {
      await tryLoadPack(progress);
    }
    await JF.load(progress);
    JF.fontsMeta = await getJSON('meta', 'fonts.json');
    requestAnimationFrame(frame);
  };
})();
