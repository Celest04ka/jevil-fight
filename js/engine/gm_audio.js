// WebAudio implementation of the GameMaker audio functions used by Deltarune.
'use strict';

(function () {
  const A = GM.audio = {
    ctx: null, master: null, masterGain: 1,
    voices: new Map(), nextVoice: 100000,
    assetGain: new Map(), assetPitch: new Map(), // per-asset gain/pitch (audio_sound_gain on an asset index)
    groupGain: [1, 1, 1],
    streams: [], // created streams: {index, url, buffer, loading}
    loader: null // function(url) -> Promise<ArrayBuffer>
  };

  A.init = function () {
    if (A.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    A.ctx = new AC();
    A.master = A.ctx.createGain();
    A.master.connect(A.ctx.destination);
  };
  A.resume = function () { if (A.ctx && A.ctx.state !== 'running') A.ctx.resume(); };

  async function decode(buf) {
    return await new Promise((res, rej) => A.ctx.decodeAudioData(buf.slice(0), res, rej));
  }

  // preload sound assets: list of {index, url}
  A.loadSounds = async function (entries, onProgress) {
    let done = 0;
    await Promise.all(entries.map(async (e) => {
      try {
        const buf = await A.loader(e.url);
        GM.sounds[e.index].buffer = await decode(buf);
      } catch (err) { console.warn('[audio] failed', e.url, err); }
      done++;
      onProgress && onProgress(done, entries.length);
    }));
  };

  function soundAsset(idx) { return GM.sounds[idx]; }

  function now() { return A.ctx.currentTime; }

  function effectiveGain(v) {
    const s = soundAsset(v.asset);
    const ag = A.assetGain.has(v.asset) ? A.assetGain.get(v.asset).value() : 1;
    const grp = s && s.group !== undefined ? (A.groupGain[s.group] !== undefined ? A.groupGain[s.group] : 1) : 1;
    return (s ? s.volume : 1) * v.gainObj.value() * ag * grp;
  }

  // a ramping gain value in "GM time" (seconds of audio clock)
  function Ramp(v) { this.from = v; this.to = v; this.t0 = 0; this.t1 = 0; }
  Ramp.prototype.set = function (to, ms) {
    const cur = this.value();
    this.from = cur; this.to = to; this.t0 = now(); this.t1 = now() + Math.max(0, ms) / 1000;
  };
  Ramp.prototype.value = function () {
    if (!A.ctx) return this.to;
    const t = now();
    if (t >= this.t1 || this.t1 <= this.t0) return this.to;
    return this.from + (this.to - this.from) * ((t - this.t0) / (this.t1 - this.t0));
  };

  A.play = function (asset, prio, loop, gain, offset, pitch) {
    A.init();
    const s = soundAsset(asset);
    const id = A.nextVoice++;
    const v = {
      id, asset, loop: !!loop, gainObj: new Ramp(gain === undefined ? 1 : gain), pitch: pitch === undefined ? 1 : pitch,
      src: null, node: null, startedAt: 0, offset: offset || 0, paused: false, ended: false, pending: false
    };
    A.voices.set(id, v);
    if (!s) { v.ended = true; return id; }
    if (!s.buffer) {
      if (s.stream) {
        v.pending = true;
        A.ensureStream(s).then(() => { if (!v.ended && !v.paused) startVoice(v); })
          .catch((e) => { v.ended = true; A.voices.delete(v.id); GM.warnOnce('stream:' + s.file, 'music stream failed', e && e.message); });
      }
      else { GM.warnOnce('nosnd:' + s.name, 'sound not loaded'); v.ended = true; }
      return id;
    }
    startVoice(v);
    return id;
  };

  function startVoice(v) {
    const s = soundAsset(v.asset);
    if (!s || !s.buffer) return;
    v.pending = false;
    const src = A.ctx.createBufferSource();
    src.buffer = s.buffer;
    src.loop = v.loop;
    const node = A.ctx.createGain();
    src.connect(node); node.connect(A.master);
    const ap = A.assetPitch.has(v.asset) ? A.assetPitch.get(v.asset) : 1;
    src.playbackRate.value = v.pitch * ap * (s.pitch || 1);
    node.gain.value = effectiveGain(v);
    const off = v.offset % s.buffer.duration;
    src.start(0, off);
    v.startedAt = now() - off / src.playbackRate.value;
    v.src = src; v.node = node;
    src.onended = () => { if (v.src === src && !v.paused) { v.ended = true; A.voices.delete(v.id); } };
  }

  function stopVoice(v) {
    v.ended = true;
    if (v.src) { try { v.src.onended = null; v.src.stop(); } catch (e) { /* already stopped */ } v.src.disconnect(); v.node.disconnect(); }
    v.src = null;
    A.voices.delete(v.id);
  }

  function voicesOf(x) {
    if (x >= 100000) { const v = A.voices.get(x); return v ? [v] : []; }
    return [...A.voices.values()].filter(v => v.asset === x);
  }

  A.stop = function (x) { voicesOf(x).forEach(stopVoice); };
  A.stopAll = function () { [...A.voices.values()].forEach(stopVoice); };
  A.isPlaying = function (x) { return voicesOf(x).some(v => !v.ended && !v.paused); };

  A.gain = function (x, vol, ms) {
    if (x >= 100000) { const v = A.voices.get(x); if (v) v.gainObj.set(vol, ms); return; }
    if (!A.assetGain.has(x)) A.assetGain.set(x, new Ramp(1));
    A.assetGain.get(x).set(vol, ms);
  };
  A.getGain = function (x) {
    if (x >= 100000) { const v = A.voices.get(x); return v ? v.gainObj.value() : 0; }
    return A.assetGain.has(x) ? A.assetGain.get(x).value() : 1;
  };
  A.pitch = function (x, p) {
    if (x >= 100000) {
      const v = A.voices.get(x);
      if (v) { v.pitch = p; if (v.src) v.src.playbackRate.value = p * (A.assetPitch.get(v.asset) || 1) * (soundAsset(v.asset).pitch || 1); }
      return;
    }
    A.assetPitch.set(x, p);
    voicesOf(x).forEach(v => { if (v.src) v.src.playbackRate.value = v.pitch * p; });
  };
  A.pause = function (x) {
    voicesOf(x).forEach(v => {
      if (v.paused || v.ended) return;
      v.paused = true;
      if (v.src) {
        const s = soundAsset(v.asset);
        v.offset = ((now() - v.startedAt) * v.src.playbackRate.value) % s.buffer.duration;
        v.src.onended = null; v.src.stop(); v.src.disconnect(); v.node.disconnect(); v.src = null;
      }
    });
  };
  A.resumeVoice = function (x) {
    voicesOf(x).forEach(v => { if (v.paused && !v.ended) { v.paused = false; startVoice(v); } });
  };
  A.pauseAll = function () { A.pause_all = true; [...A.voices.keys()].forEach(A.pause); };
  A.resumeAll = function () { [...A.voices.keys()].forEach(A.resumeVoice); };
  A.trackPos = function (x) {
    const v = voicesOf(x)[0];
    if (!v) return 0;
    if (!v.src) return v.offset;
    const s = soundAsset(v.asset);
    return ((now() - v.startedAt) * v.src.playbackRate.value) % s.buffer.duration;
  };
  A.setTrackPos = function (x, pos) {
    voicesOf(x).forEach(v => { v.offset = pos; if (v.src) { v.src.onended = null; v.src.stop(); v.src.disconnect(); v.node.disconnect(); v.src = null; startVoice(v); } });
  };

  // streams: audio_create_stream(file) creates a new sound asset index
  A.createStream = function (file) {
    const index = GM.sounds.length;
    const name = String(file).replace(/^.*[\\/]/, '').replace(/\.ogg$/i, '');
    GM.sounds.push({ name: 'stream_' + name, file, volume: 1, pitch: 1, group: 0, stream: true, buffer: A.streamCache[file] || null });
    return index;
  };
  A.streamCache = {};
  A.ensureStream = async function (s) {
    if (s.buffer) return;
    if (!s.loading) s.loading = (async () => {
      const buf = await A.loader(s.file);
      s.buffer = await decode(buf);
      A.streamCache[s.file] = s.buffer;
    })();
    await s.loading;
  };
  A.preloadStream = async function (file) {
    if (A.streamCache[file]) return;
    A.init();
    const buf = await A.loader(file);
    A.streamCache[file] = await decode(buf);
  };

  A.setMaster = function (g) { A.masterGain = g; if (A.master) A.master.gain.value = g; };

  // called once per game step to apply gain ramps
  A.update = function () {
    if (!A.ctx) return;
    for (const v of A.voices.values()) if (v.node) v.node.gain.value = effectiveGain(v);
  };
})();
