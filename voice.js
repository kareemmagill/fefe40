/* FEFE40 voices: each guest reads a set of about 20 party lines into their phone in one go, and their avatar says them
   at the party (skål at the bar, singing at the karaoke, grattis to Fefe, the odd burp).
   The prompter shows one line at a time and moves on as soon as the guest has said it, listening for the pause after
   each line, so we know where every line starts and ends. Afterwards each line is cut out of the take, cleaned up and
   packed small (11 kHz, 4-bit IMA ADPCM, about 7 KB a second) so it can be shared.
   Exposes window.FefeVoice = { lines, byId, pickSet, createStep, encode, decode, toBuffer }. */
(() => {
  const DATA = window.FefeVoiceLines || { quotas: {}, lines: [] };
  const LINES = DATA.lines.filter((l) => l && typeof l.id === "string" && typeof l.text === "string");
  const byId = new Map(LINES.map((l) => [l.id, l]));
  const RATE = 11025; // what clips are stored at
  const MAX_SAY = 4.5, MAX_SING = 6; // longest clip kept, seconds

  // ---------- which lines a guest reads ----------
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const shuffle = (arr, r) => {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };
  // A set of n lines nobody else is likely to get the same of: the category quotas (lots of birthday wishes, cheers
  // and singing), drawn at random for this guest and round, skipping lines they've already recorded. It opens with an
  // easy warm-up, keeps the singing for the second half and ends on a birthday wish.
  function pickSet(seed, have, cheeky, n) {
    n = n || 20;
    have = have || new Set();
    const r = rng(hash(String(seed)));
    const pool = new Map();
    LINES.forEach((l) => {
      if (have.has(l.id) || (l.cheeky && !cheeky)) return;
      if (!pool.has(l.cat)) pool.set(l.cat, []);
      pool.get(l.cat).push(l);
    });
    pool.forEach((list) => shuffle(list, r));
    const quotas = Object.assign({}, DATA.quotas);
    if (!cheeky && quotas.cheeky) { quotas.react = (quotas.react || 0) + Math.ceil(quotas.cheeky / 2); quotas.laugh = (quotas.laugh || 0) + Math.floor(quotas.cheeky / 2); delete quotas.cheeky; }
    const out = [];
    Object.keys(quotas).forEach((cat) => {
      const list = pool.get(cat) || [];
      for (let i = 0; i < quotas[cat] && list.length; i++) out.push(list.shift());
    });
    const rest = shuffle([].concat(...pool.values()), r);
    while (out.length < n && rest.length) out.push(rest.shift());
    const set = out.slice(0, n);
    // order: warm-up, a shuffled middle with the singing later on, a birthday wish to finish
    const easy = set.findIndex((l) => l.kind !== "sing" && (l.cat === "greet" || l.cat === "cheers") && l.dur <= 1.6);
    const first = easy >= 0 ? set.splice(easy, 1) : [];
    const bday = set.findIndex((l) => l.cat === "birthday" && l.kind !== "sing");
    const last = bday >= 0 ? set.splice(bday, 1) : [];
    shuffle(set, r);
    const sung = set.filter((l) => l.kind === "sing"), said = set.filter((l) => l.kind !== "sing");
    const mid = [];
    const half = Math.ceil(said.length / 2);
    said.slice(0, half).forEach((l) => mid.push(l));
    // the second half alternates sung and said lines so singing doesn't all come at once
    const tail = said.slice(half);
    while (sung.length || tail.length) {
      if (sung.length) mid.push(sung.shift());
      if (tail.length) mid.push(tail.shift());
    }
    return first.concat(mid, last);
  }

  // ---------- capture ----------
  const AC = window.AudioContext || window.webkitAudioContext;
  const TAP = "class FefeTap extends AudioWorkletProcessor { constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }" +
    " process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) { for (let i = 0; i < ch.length; i++) { this.buf[this.n++] = ch[i];" +
    " if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; } } } return true; } }" +
    " registerProcessor('fefe-tap', FefeTap);";
  const FRAME = 0.02; // seconds per loudness frame
  // Microphone into memory, with the loudness of every 20 ms frame as it arrives (the prompter listens to that).
  async function openMic() {
    if (!AC || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("no-mic");
    const ctx = new AC();
    if (ctx.state !== "running" && ctx.resume) await ctx.resume().catch(() => {});
    let stream;
    try {
      // no noise suppression: it would swallow the raspberries and kisses; auto gain keeps quiet readers audible
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 } });
    } catch (e) { ctx.close().catch(() => {}); throw e; }
    const rate = ctx.sampleRate, per = Math.round(rate * FRAME);
    const mic = { ctx, stream, rate, chunks: [], length: 0, rms: [], acc: 0, accN: 0, on: true };
    const take = (data) => {
      if (!mic.on) return;
      mic.chunks.push(data);
      mic.length += data.length;
      for (let i = 0; i < data.length; i++) {
        mic.acc += data[i] * data[i];
        if (++mic.accN === per) { mic.rms.push(Math.sqrt(mic.acc / per)); mic.acc = 0; mic.accN = 0; }
      }
    };
    const src = ctx.createMediaStreamSource(stream);
    const mute = ctx.createGain();
    mute.gain.value = 0; // the capture node has to reach the speakers to run, silently
    mute.connect(ctx.destination);
    let node = null;
    if (ctx.audioWorklet && window.AudioWorkletNode) {
      try {
        const url = URL.createObjectURL(new Blob([TAP], { type: "application/javascript" }));
        await ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        node = new AudioWorkletNode(ctx, "fefe-tap");
        node.port.onmessage = (e) => take(e.data);
      } catch (e) { node = null; }
    }
    if (!node) {
      node = ctx.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = (e) => take(new Float32Array(e.inputBuffer.getChannelData(0)));
    }
    src.connect(node);
    node.connect(mute);
    mic.time = () => mic.rms.length * FRAME;
    mic.close = () => {
      mic.on = false;
      try { src.disconnect(); node.disconnect(); } catch (e) { /* already gone */ }
      stream.getTracks().forEach((t) => t.stop());
      const pcm = new Float32Array(mic.length);
      let o = 0;
      mic.chunks.forEach((c) => { pcm.set(c, o); o += c.length; });
      mic.chunks = [];
      return pcm;
    };
    return mic;
  }

  // ---------- cutting and cleaning ----------
  // One clip per line, from the moments the prompter heard it start and stop, trimmed to the voice, with the rumble
  // taken out, levelled and faded at both ends.
  function cut(pcm, rate, mark, floor) {
    const per = Math.round(rate * FRAME), frames = Math.floor(pcm.length / per);
    const rmsAt = (f) => { let s = 0; for (let i = f * per; i < (f + 1) * per && i < pcm.length; i++) s += pcm[i] * pcm[i]; return Math.sqrt(s / per); };
    let f0 = Math.max(0, Math.floor(mark.on / FRAME) - 6), f1 = Math.min(frames - 1, Math.ceil(mark.off / FRAME) + 10);
    const quiet = Math.max(floor * 1.6, 0.004);
    while (f0 < f1 && rmsAt(f0) < quiet && f0 < Math.floor(mark.on / FRAME)) f0++;
    while (f1 > f0 && rmsAt(f1) < quiet && f1 > Math.ceil(mark.off / FRAME)) f1--;
    const a = Math.max(0, (f0 - 3) * per), b = Math.min(pcm.length, (f1 + 6) * per);
    const max = Math.round(rate * (mark.sing ? MAX_SING : MAX_SAY));
    const out = pcm.slice(a, Math.min(b, a + max));
    // high-pass at ~90 Hz (breath pops, table knocks), then level to a steady peak
    const k = Math.exp((-2 * Math.PI * 90) / rate);
    let px = 0, py = 0, peak = 0;
    for (let i = 0; i < out.length; i++) { const y = k * (py + out[i] - px); px = out[i]; py = y; out[i] = y; peak = Math.max(peak, Math.abs(y)); }
    const gain = peak > 0 ? Math.min(10, 0.89 / peak) : 1;
    const fade = Math.min(Math.round(rate * 0.015), out.length >> 2);
    for (let i = 0; i < out.length; i++) {
      let g = gain;
      if (i < fade) g *= i / fade;
      if (i > out.length - 1 - fade) g *= (out.length - 1 - i) / fade;
      out[i] *= g;
    }
    return out;
  }
  // Down to 11 kHz: a windowed-sinc low-pass, then read off between samples.
  function resample(pcm, from, to) {
    if (from === to) return pcm.slice();
    const ratio = from / to, fc = 0.45 / ratio, N = 33, half = (N - 1) / 2, taps = new Float32Array(N);
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const x = i - half, s = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
      const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (N - 1));
      taps[i] = s * w;
      sum += taps[i];
    }
    for (let i = 0; i < N; i++) taps[i] /= sum;
    const smooth = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      let s = 0;
      for (let j = 0; j < N; j++) { const k = i + j - half; if (k >= 0 && k < pcm.length) s += pcm[k] * taps[j]; }
      smooth[i] = s;
    }
    const n = Math.floor(pcm.length / ratio), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = i * ratio, k = Math.floor(p), f = p - k;
      out[i] = smooth[k] * (1 - f) + (k + 1 < smooth.length ? smooth[k + 1] : 0) * f;
    }
    return out;
  }

  // ---------- packing: IMA ADPCM, 4 bits a sample ----------
  const STEPS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157,
    173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066,
    2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500,
    20350, 22385, 24623, 27086, 29794, 32767];
  const NEXT = [-1, -1, -1, -1, 2, 4, 6, 8];
  const clamp16 = (v) => (v > 32767 ? 32767 : v < -32768 ? -32768 : v);
  function toB64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  // "V1" + base64 of: rate (2 bytes), sample count (3 bytes), then two samples a byte
  function encode(pcm, fromRate) {
    const s = resample(pcm, fromRate, RATE), n = s.length, bytes = new Uint8Array(5 + ((n + 1) >> 1));
    bytes[0] = RATE & 255; bytes[1] = RATE >> 8;
    bytes[2] = n & 255; bytes[3] = (n >> 8) & 255; bytes[4] = (n >> 16) & 255;
    let pred = 0, idx = 0;
    for (let i = 0; i < n; i++) {
      let diff = clamp16(Math.round(s[i] * 32767)) - pred, code = 0, step = STEPS[idx], delta = step >> 3;
      if (diff < 0) { code = 8; diff = -diff; }
      if (diff >= step) { code |= 4; diff -= step; delta += step; }
      step >>= 1;
      if (diff >= step) { code |= 2; diff -= step; delta += step; }
      step >>= 1;
      if (diff >= step) { code |= 1; delta += step; }
      pred = clamp16(code & 8 ? pred - delta : pred + delta);
      idx = Math.max(0, Math.min(88, idx + NEXT[code & 7]));
      bytes[5 + (i >> 1)] |= i & 1 ? code << 4 : code;
    }
    return "V1" + toB64(bytes);
  }
  function decode(str) {
    if (typeof str !== "string" || str.slice(0, 2) !== "V1" || str.length > 60000) return null;
    let bin;
    try { bin = atob(str.slice(2)); } catch (e) { return null; }
    if (bin.length < 6) return null;
    const b = (i) => bin.charCodeAt(i);
    const rate = b(0) | (b(1) << 8), n = b(2) | (b(3) << 8) | (b(4) << 16);
    if (rate < 4000 || rate > 48000 || n < 1 || 5 + ((n + 1) >> 1) > bin.length) return null;
    const out = new Float32Array(n);
    let pred = 0, idx = 0;
    for (let i = 0; i < n; i++) {
      const byte = b(5 + (i >> 1)), code = i & 1 ? byte >> 4 : byte & 15, step = STEPS[idx];
      let delta = step >> 3;
      if (code & 4) delta += step;
      if (code & 2) delta += step >> 1;
      if (code & 1) delta += step >> 2;
      pred = clamp16(code & 8 ? pred - delta : pred + delta);
      idx = Math.max(0, Math.min(88, idx + NEXT[code & 7]));
      out[i] = pred / 32768;
    }
    return { pcm: out, rate };
  }
  // An AudioBuffer for a clip string. Older iPhones won't make buffers below 22 kHz, so those get it doubled up.
  function toBuffer(ctx, str) {
    const d = typeof str === "string" ? decode(str) : str;
    if (!d) return null;
    try {
      const buf = ctx.createBuffer(1, d.pcm.length, d.rate);
      buf.getChannelData(0).set(d.pcm);
      return buf;
    } catch (e) {
      const k = Math.ceil(22050 / d.rate), up = new Float32Array(d.pcm.length * k);
      for (let i = 0; i < up.length; i++) {
        const p = i / k, j = Math.floor(p), f = p - j;
        up[i] = d.pcm[j] * (1 - f) + (j + 1 < d.pcm.length ? d.pcm[j + 1] : 0) * f;
      }
      const buf = ctx.createBuffer(1, up.length, d.rate * k);
      buf.getChannelData(0).set(up);
      return buf;
    }
  }

  // ---------- the recording screen ----------
  // els: the step's elements (see index.html #step-voice). opts.onDone(clips) gets { id: clip string } for the lines
  // that came out; opts.onSkip() when they'd rather not.
  function createStep(els, opts) {
    let lines = [], marks = [], mic = null, run = null, clips = {}, pcmClips = {}, floor = 0.004, preview = null;
    const show = (which) => { els.intro.hidden = which !== "intro"; els.live.hidden = which !== "live"; els.review.hidden = which !== "review"; };
    function escape(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
    function open(setup) {
      lines = setup.lines;
      marks = [];
      clips = {};
      pcmClips = {};
      els.peek.innerHTML = lines.slice(0, 3).map((l) => "<li>" + escape(l.text) + (l.en ? " <span>" + escape(l.en) + "</span>" : "") + "</li>").join("") + "<li class=\"more\">… and " + (lines.length - 3) + " more</li>";
      els.intro.querySelector(".voice-count-n").textContent = lines.length;
      els.error.hidden = true;
      show("intro");
    }
    function stopAll() {
      if (run) { cancelAnimationFrame(run.raf); clearTimeout(run.timer); run = null; }
      if (mic) { mic.close(); mic.ctx.close().catch(() => {}); mic = null; }
      if (preview) { try { preview.close(); } catch (e) { /* gone */ } preview = null; }
    }
    // the take: a count-in (which also measures the room), then the lines one by one
    async function start(which) {
      els.error.hidden = true;
      try {
        mic = await openMic();
      } catch (e) {
        els.error.textContent = e && e.name === "NotAllowedError" ? "The microphone wasn't allowed. You can allow it in your browser settings, or skip this." : "No microphone here. You can skip this.";
        els.error.hidden = false;
        els.skip.hidden = false; // no microphone: there has to be a way out
        return;
      }
      const todo = which || lines;
      show("live");
      els.count.hidden = false;
      els.card.hidden = true;
      run = { todo, i: -1, state: "count", t0: performance.now(), got: [] };
      const beat = (k) => { if (!run) return; els.count.textContent = k ? String(k) : "Go!"; if (k) run.timer = setTimeout(() => beat(k - 1), 700); };
      beat(3);
      loop();
    }
    // Unhurried: a line counts as said after a proper pause (not a comma's breath), and only once they've been at it
    // for a fair part of the time it takes; nobody's timed.
    const GAP = { say: 0.7, sound: 0.55, sing: 0.95 };
    function next() {
      if (!run) return;
      run.i++;
      if (run.i >= run.todo.length) { finish(); return; }
      const l = run.todo[run.i];
      run.state = "wait";
      run.shown = mic.time();
      run.onset = -1;
      run.loud = 0;
      run.lastLoud = 0;
      els.count.hidden = true;
      els.card.hidden = false;
      els.line.textContent = l.text;
      els.en.textContent = l.en || "";
      els.en.hidden = !l.en;
      els.hint.textContent = l.hint ? "Say: " + l.hint : l.note || (l.kind === "sing" ? "Sing it!" : "");
      els.hint.hidden = !els.hint.textContent;
      els.card.classList.toggle("sing", l.kind === "sing");
      els.progress.textContent = (run.i + 1) + " / " + run.todo.length;
      els.fill.style.width = "0%"; // fills as they say it, rather than counting down
    }
    function loop() {
      if (!run || !mic) return;
      run.raf = requestAnimationFrame(loop);
      const r = mic.rms, t = mic.time(), last = r.length ? r[r.length - 1] : 0;
      els.level.style.width = Math.min(100, Math.round(Math.sqrt(last / 0.25) * 100)) + "%";
      if (run.state === "count") {
        if (performance.now() - run.t0 < 2400) return;
        // how loud the room is when nobody's reading: the quieter 30% of the count-in
        const q = r.slice(10).sort((a, b) => a - b);
        floor = Math.max(0.0015, q.length ? q[Math.floor(q.length * 0.3)] : 0.004);
        run.frame = r.length;
        next();
        return;
      }
      const l = run.todo[run.i], on = Math.max(floor * 3.2, 0.012), off = Math.max(floor * 2, 0.007);
      for (; run.frame < r.length; run.frame++) {
        const v = r[run.frame], ft = run.frame * FRAME;
        if (run.state === "wait") {
          run.loud = v > on ? run.loud + 1 : 0;
          if (run.loud >= 3) { run.state = "talk"; run.onset = ft - 2 * FRAME; run.lastLoud = ft; }
          else if (v < off) floor = Math.max(0.0015, floor * 0.995 + v * 0.005); // the room's noise drifts
        } else if (run.state === "talk") {
          if (v > off) run.lastLoud = ft;
          const gap = GAP[l.kind] || GAP.say, long = Math.min(l.kind === "sing" ? MAX_SING + 2 : MAX_SAY + 2, (l.dur || 1.5) * 2.5 + 2);
          // a quick reader may be done well before the line's usual time: a longer pause still ends it
          const talked = run.lastLoud - run.onset, quiet = ft - run.lastLoud;
          if ((quiet > gap && talked > Math.max(0.25, (l.dur || 1.5) * 0.35)) || (quiet > 1.4 && talked > 0.25) || ft - run.onset > long) {
            run.got.push({ id: l.id, on: run.onset, off: Math.min(run.lastLoud, run.onset + long), sing: l.kind === "sing" });
            run.state = "done";
            run.frame++;
            run.timer = setTimeout(next, 450); // a breather before the next line
            return;
          }
        }
      }
      // nothing heard for a while: move on, it counts as missed
      if (run.state === "talk") els.fill.style.width = Math.min(100, Math.round(((t - run.onset) / Math.max(0.8, l.dur || 1.5)) * 100)) + "%";
      if (run.state === "wait" && t - run.shown > Math.max(8, (l.dur || 1.5) + 6)) { run.state = "done"; next(); }
    }
    function finish() {
      const got = run.got;
      cancelAnimationFrame(run.raf);
      clearTimeout(run.timer);
      run = null;
      const pcm = mic.close(), rate = mic.rate;
      mic.ctx.close().catch(() => {});
      mic = null;
      got.forEach((m) => {
        const c = cut(pcm, rate, m, floor);
        if (c.length > rate * 0.15) { pcmClips[m.id] = { pcm: c, rate }; clips[m.id] = encode(c, rate); }
      });
      review();
    }
    function review() {
      const ok = lines.filter((l) => clips[l.id]).length, missed = lines.length - ok;
      els.summary.textContent = ok ? "Got " + ok + " of " + lines.length + "! Tap a line to hear it." + (missed ? " Some didn't come through: you can redo those." : "") : "We didn't hear anything. Check the microphone and try again, a bit louder.";
      els.list.innerHTML = lines.map((l) => "<li><button type=\"button\" data-id=\"" + escape(l.id) + "\"" + (clips[l.id] ? "" : " disabled") + ">" + (clips[l.id] ? "▶" : "✕") + "</button> " + escape(l.text) + "</li>").join("");
      els.redo.hidden = !missed || !ok;
      els.done.disabled = !ok;
      show("review");
    }
    function play(id) {
      const c = pcmClips[id];
      if (!c || !AC) return;
      if (!preview) preview = new AC();
      if (preview.state !== "running" && preview.resume) preview.resume().catch(() => {});
      const buf = toBuffer(preview, clips[id]);
      if (!buf) return;
      const s = preview.createBufferSource();
      s.buffer = buf;
      s.connect(preview.destination);
      s.start();
    }
    els.go.addEventListener("click", () => start());
    els.stop.addEventListener("click", () => { if (run && mic) finish(); });
    // skip this line: whatever they said of it so far is kept
    if (els.pass) els.pass.addEventListener("click", () => {
      if (!run || !mic || (run.state !== "wait" && run.state !== "talk")) return;
      const l = run.todo[run.i];
      if (run.state === "talk" && run.lastLoud - run.onset > 0.25) run.got.push({ id: l.id, on: run.onset, off: run.lastLoud, sing: l.kind === "sing" });
      run.state = "done";
      run.frame = mic.rms.length;
      next();
    });
    els.skip.addEventListener("click", () => { stopAll(); opts.onSkip(); });
    els.again.addEventListener("click", () => { clips = {}; pcmClips = {}; start(); });
    els.redo.addEventListener("click", () => start(lines.filter((l) => !clips[l.id])));
    els.done.addEventListener("click", () => {
      const out = Object.assign({}, clips);
      stopAll();
      opts.onDone(out);
    });
    els.list.addEventListener("click", (e) => { const b = e.target.closest("button[data-id]"); if (b) play(b.dataset.id); });
    return { open, close: stopAll };
  }

  window.FefeVoice = { lines: LINES, byId, pickSet, createStep, encode, decode, toBuffer, RATE };
})();
