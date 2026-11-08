// Outer menu, drawn on the game screen with Deltarune's own fonts and sprites (battle-menu style).
// The fight itself is Deltarune's code; this file only starts it with the chosen options.
'use strict';

(function () {
  const D = GM.draw;
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), status = $('status');

  const WHITE = 0xFFFFFF, YELLOW = 0x00FFFF, GRAY = 0x808080, LIGHT = 0xC0C0C0;

  // Jevil's attacks, numbered like jattack in obj_joker (14 and 15 are his last scripted turns)
  const ATTACKS = [
    'Spade Teleport', 'Spade Ring', 'Heart Bomb', 'Scythes',
    'Carousel', 'Club Bombs', 'Diamonds', 'Spade Circle',
    'Carousel II', 'Spade Bursts', 'Club Chains', 'Red Scythe',
    'Box Dance', 'Suit Bombs', 'Diamonds II', 'Final Chaos'
  ];
  const LOADOUTS = {
    normal: { name: 'Normal', lines: ['KRIS: Spookysword, Amber Card, Dice Brace', 'SUSIE: Brave Ax, Amber Card', 'RALSEI: Ragger, White Ribbon, Amber Card', 'ITEMS: Top Cake, ReviveMint, 2 Darkburger, ChocDiamond, 3 Dark Candy'] },
    strong: { name: 'Strong', lines: ['KRIS: Trefoil, IronShackle, Dice Brace', 'SUSIE: Brave Ax, IronShackle, Dice Brace', 'RALSEI: Ragger, White Ribbon, Pink Ribbon', 'ITEMS: 12, including 2 ReviveMint and Top Cake'] },
    strongest: { name: 'Strongest', lines: ['KRIS: Trefoil, IronShackle, Dice Brace', 'SUSIE: Brave Ax, IronShackle, Dice Brace', 'RALSEI: Ragger, IronShackle, White Ribbon', 'ITEMS: Top Cake, 2 Club Sandwiches, 3 ReviveMints, 6 Darkburgers'] },
    starter: { name: 'Starter', lines: ['Starting weapons, no armor', 'ITEMS: 3 Dark Candy'] }
  };

  const settings = { loadout: 'normal', invincible: false, practiceInvincible: false, volume: 1 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('jevilfight_settings') || '{}')); } catch (e) { /* no storage */ }
  function saveSettings() { try { localStorage.setItem('jevilfight_settings', JSON.stringify(settings)); } catch (e) { /* no storage */ } }

  let A = null; // asset indices, resolved after loading
  const menu = { screen: 'main', sel: 0, message: '', frame: 0 };

  // ------------------------------------------------------------ sound & music
  function sfx(i) { if (A) GM.audio.play(i, 0, false); }
  let musicIdx = null, musicVoice = null;
  function startMusic() {
    if (musicVoice && GM.audio.voices.has(musicVoice)) return;
    if (musicIdx == null) musicIdx = GM.audio.createStream('mus/prejoker.ogg');
    // the same pitch the game uses for this song in the room before Jevil
    musicVoice = GM.audio.play(musicIdx, 0, true, 0.6, 0, 0.85);
  }

  // ------------------------------------------------------------ drawing helpers
  function text(x, y, s, font, col, align, scale) {
    D.font = font; D.halign = align || 0; D.valign = 0;
    D.text(x, y, s, scale || 1, scale || 1, 0, [col, col, col, col], 1);
  }
  function heart(x, y) {
    const s = GM.sprites[A.heart];
    D.sprite(A.heart, 0, x + s.ox, y + s.oy, 1, 1, 0, WHITE, 1);
  }
  // the dark-world textbox frame, drawn like scr_darkbox does
  function darkbox(x1, y1, x2, y2) {
    const tw = x2 - x1 - 63, th = y2 - y1 - 63, j = menu.frame / 10;
    if (tw > 0) {
      D.spriteStretched(A.boxTop, 0, x1 + 32, y1, tw, 32, WHITE, 1);
      D.sprite(A.boxTop, 0, x1 + 32, y2 + 1, tw, -2, 0, WHITE, 1);
    }
    if (th > 0) {
      D.sprite(A.boxLeft, 0, x2 + 1, y1 + 32, -2, th, 0, WHITE, 1);
      D.sprite(A.boxLeft, 0, x1, y1 + 32, 2, th, 0, WHITE, 1);
    }
    D.sprite(A.boxCorner, j, x1, y1, 2, 2, 0, WHITE, 1);
    D.sprite(A.boxCorner, j, x2 + 1, y1, -2, 2, 0, WHITE, 1);
    D.sprite(A.boxCorner, j, x1, y2 + 1, 2, -2, 0, WHITE, 1);
    D.sprite(A.boxCorner, j, x2 + 1, y2 + 1, -2, -2, 0, WHITE, 1);
  }
  function title(s) { text(320, 22, s, A.big, WHITE, 1, 2); }
  function hint(lines, y) { lines.forEach((l, i) => text(320, y + i * 18, l, A.small, GRAY, 1)); }

  // ------------------------------------------------------------ screens
  const MAIN = [
    { label: 'Fight Jevil', go: () => startGame({ quick: false }) },
    { label: 'Quick Fight', go: () => startGame({ quick: true }) },
    { label: 'Practice', go: () => open('practice', 0) },
    { label: 'Settings', go: () => open('settings', 0) }
  ];
  function settingItems() {
    return [
      { label: 'Equipment: ' + LOADOUTS[settings.loadout].name, change: (d) => { const k = Object.keys(LOADOUTS); settings.loadout = k[(k.indexOf(settings.loadout) + k.length + d) % k.length]; } },
      { label: 'God Mode (fight): ' + (settings.invincible ? 'ON' : 'OFF'), change: () => { settings.invincible = !settings.invincible; } },
      { label: 'God Mode (practice): ' + (settings.practiceInvincible ? 'ON' : 'OFF'), change: () => { settings.practiceInvincible = !settings.practiceInvincible; } },
      { label: 'Volume: ' + Math.round(settings.volume * 100) + '%', change: (d) => { const v = [0, 0.25, 0.5, 0.75, 1]; settings.volume = v[(v.indexOf(settings.volume) + v.length + d) % v.length]; GM.audio.setMaster(settings.volume); } },
      { label: 'Back', go: () => open('main', 3) }
    ];
  }

  function drawMain() {
    title('JEVIL FIGHT');
    text(320, 92, 'DELTARUNE  CHAPTER 1', A.small, GRAY, 1);
    darkbox(170, 150, 470, 350);
    MAIN.forEach((it, i) => {
      const y = 178 + i * 40;
      text(232, y, it.label, A.big, i === menu.sel ? YELLOW : WHITE);
      if (i === menu.sel) heart(204, y + 9);
    });
    if (menu.message) text(320, 372, menu.message, A.small, WHITE, 1);
    hint(['Z / ENTER - Confirm     X / SHIFT - Back     F4 - Fullscreen', 'Hold ESC during the fight to return here'], 420);
  }

  function drawPractice() {
    title('PRACTICE');
    darkbox(20, 96, 620, 392);
    ATTACKS.forEach((name, i) => {
      const col = i < 8 ? 0 : 1, row = i % 8;
      const x = col ? 342 : 62, y = 118 + row * 33;
      const c = i === menu.sel ? YELLOW : WHITE;
      text(x + 32, y, String(i), A.big, c, 2);
      text(x + 48, y, name, A.big, c);
      if (i === menu.sel) heart(x - 18, y + 9);
    });
    hint(['Heroes DEFEND on their own, HP refills every turn.', 'God Mode: ' + (settings.practiceInvincible ? 'ON' : 'OFF') + ' (Settings)     Z - Start     X - Back'], 410);
  }

  function drawSettings() {
    title('SETTINGS');
    const items = settingItems();
    darkbox(60, 96, 580, 312);
    items.forEach((it, i) => {
      const y = 120 + i * 36;
      text(122, y, it.label, A.big, i === menu.sel ? YELLOW : WHITE);
      if (i === menu.sel) heart(94, y + 9);
    });
    if (menu.sel === 0) LOADOUTS[settings.loadout].lines.forEach((l, i) => text(320, 330 + i * 18, l, A.small, LIGHT, 1));
    else if (menu.sel === 1 || menu.sel === 2) text(320, 330, "Uses Deltarune's own debug god mode.", A.small, LIGHT, 1);
    hint(['LEFT / RIGHT / Z - Change     X - Back'], 440);
  }

  JF.menuFrame = function () {
    if (!A) return;
    menu.frame++;
    D.setBlend(0); D.setFog(false); D.setBlendEnable(true);
    D.begin(0);
    if (menu.screen === 'main') drawMain();
    else if (menu.screen === 'practice') drawPractice();
    else drawSettings();
    D.end();
  };

  // practice label on top of the fight (restores the game's draw state afterwards)
  D.hudDraw = function () {
    if (!A || JF.opts.practice == null) return;
    const saved = [D.font, D.halign, D.valign, D.color, D.alpha];
    D.font = A.small; D.halign = 1; D.valign = 0;
    const s = `PRACTICE ${JF.opts.practice}: ${ATTACKS[JF.opts.practice].toUpperCase()}   -   HOLD ESC TO QUIT`;
    D.text(320, 4, s, 1, 1, 0, [GRAY, GRAY, GRAY, GRAY], 0.8);
    [D.font, D.halign, D.valign, D.color, D.alpha] = saved;
  };

  // ------------------------------------------------------------ input
  function open(screen, sel) { menu.screen = screen; menu.sel = sel || 0; }
  function key(e) {
    const k = e.keyCode;
    if (e.repeat) return;
    const up = k === 38, down = k === 40, left = k === 37, right = k === 39;
    const ok = k === 90 || k === 13, back = k === 88 || k === 16 || k === 27;
    if (menu.screen === 'main') {
      if (up || down) { menu.sel = (menu.sel + (down ? 1 : MAIN.length - 1)) % MAIN.length; sfx(A.move); }
      else if (ok) { sfx(A.select); MAIN[menu.sel].go(); }
    } else if (menu.screen === 'practice') {
      const col = menu.sel < 8 ? 0 : 1, row = menu.sel % 8;
      if (up || down) { menu.sel = col * 8 + (row + (down ? 1 : 7)) % 8; sfx(A.move); }
      else if (left || right) { menu.sel = (1 - col) * 8 + row; sfx(A.move); }
      else if (ok) { sfx(A.select); startGame({ quick: true, practice: menu.sel }); }
      else if (back) open('main', 2);
    } else {
      const items = settingItems();
      if (up || down) { menu.sel = (menu.sel + (down ? 1 : items.length - 1)) % items.length; sfx(A.move); }
      else if ((ok || left || right) && items[menu.sel].change) { items[menu.sel].change(left ? -1 : 1); saveSettings(); sfx(A.select); }
      else if (ok && items[menu.sel].go) { sfx(A.select); items[menu.sel].go(); }
      else if (back) open('main', 3);
    }
  }
  JF.keyFilter = (e) => {
    if (JF.running) return false;
    if ([37, 38, 39, 40, 13, 16, 27, 88, 90].includes(e.keyCode)) e.preventDefault();
    GM.audio.resume();
    if (A) key(e);
    return true;
  };

  // ------------------------------------------------------------ game start / return
  function startGame(opts) {
    Object.assign(JF.opts, {
      quick: false, practice: null, loadout: settings.loadout,
      invincible: opts.practice != null ? settings.practiceInvincible : settings.invincible
    }, opts);
    JF.retryQuick = false;
    musicVoice = null;
    GM.audio.resume();
    GM.audio.setMaster(settings.volume);
    JF.start();
  }

  function backToMenu(message) {
    GM.audio.stopAll();
    musicVoice = null;
    menu.message = message || '';
    open('main', 0);
    startMusic();
  }

  JF.onError = (e) => backToMenu('Error: ' + (e && e.message ? e.message : e));
  JF.onFightOver = () => {
    const f = GM.globals.flag ? GM.globals.flag[241] : 0;
    backToMenu(f === 6 ? 'You beat Jevil by force. Got Devilsknife!' : f === 7 ? 'Jevil fell asleep. Got Jevilstail!' : '');
  };
  JF.onQuit = () => backToMenu('');

  document.addEventListener('visibilitychange', () => {
    if (!GM.audio.ctx) return;
    if (document.hidden) GM.audio.ctx.suspend(); else GM.audio.ctx.resume();
  });

  JF.init($('screen'), (t) => { status.textContent = 'Loading: ' + t; })
    .then(() => {
      const id = (n) => GM.assetIndex.get(n).i;
      A = {
        big: id('fnt_mainbig'), small: id('fnt_main'), heart: id('spr_heart'),
        boxTop: id('spr_textbox_top'), boxLeft: id('spr_textbox_left'), boxCorner: id('spr_textbox_topleft'),
        move: id('snd_menumove'), select: id('snd_select')
      };
      GM.audio.setMaster(settings.volume);
      overlay.hidden = true;
      startMusic();
    })
    .catch((e) => { status.textContent = 'Could not load: ' + e.message; console.error(e); });
})();
