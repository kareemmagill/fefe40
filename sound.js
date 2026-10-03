/* FEFE40 sound: party effects, the disco loop and Swedish voice lines, all synthesized live (Web Audio + speechSynthesis), no audio files.
   Exposes window.FefeSound = { create() }. The engine: { enabled, enable(), disable(), setListener(x, z, fit), setNight(b),
   setMusicLevel(v), play(name, x, z, opts), say(key, x, z), update(dt), context(), now(), playClip(buffer, x, z, opts),
   setMusic(on, x, z), nextBar() }. Call enable() from inside a tap/click handler. */
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  const SS = window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null;
  const FLOOR_X = 47, FLOOR_Z = 30; // dance floor centre, world metres
  const MAX_VOICES = 24, PER_NAME = 8, SAY_GAP = 2200, MASTER = 0.8;
  const DAY_BPM = 112, NIGHT_BPM = 124;
  // Voice lines, said in the phone's Swedish voice ("en:" lines in an English one). Each key picks one of its lines.
  // Helan går and Ja, må han leva are traditional songs, free to use.
  const LINES = {
    skal: ["Skål!", "Skål på er!", "Skåål!"],
    grattis: ["Grattis Filip!", "Grattis på födelsedagen, Filip!", "Hurra för Filip!"],
    helan: ["Helan går! Sjung hopp faderallan lallan lej!", "Helan går! Sjung hopp faderallan lej! Och den som inte helan tar, han heller inte halvan får!"],
    leva: ["Ja, må han leva! Ja, må han leva! Ja, må han leva uti hundrade år!", "Hurra! Hurra! Hurra! Hurraaa!"],
    hej: ["Hej hej!", "Hallå!", "Tjena!"], oj: ["Oj oj oj!", "Oj!", "Hoppsan!"], tack: ["Tack!"],
    heja: ["Heja!", "Heja heja!", "Heja Sverige!"], jaa: ["Jaaa!", "Wohoo!", "Jaaaa!"],
    fika: ["Fika!", "Nu blir det fika!", "Kanelbulle!"], jattebra: ["Jättebra!", "Mums!"], nej: ["Nej nej nej!", "Men nej!"],
    kul: ["Vad kul!", "Så kul!"], alskar: ["Jag älskar dig!", "Puss puss!"], puss: ["Puss!", "Puss puss!", "Mwah!"],
    godis: ["Vill du ha godis?", "Godis!", "Mer godis!", "en:Want some candy?", "en:Candy!"],
    haha: ["Ha ha ha ha!", "Haha!"], hihi: ["Hi hi hi!", "Hihi!"],
    hick: ["Hick!", "Hick! Hick!"], rap: ["Rapp!", "Buuurp!"], blah: ["Bläää!", "Bleeeh!"], prutt: ["Prutt!", "Oj, förlåt!"],
    plopp: ["Plopp!", "Ahhh!"], aah: ["Aaaah!", "Skönt!"], plask: ["Plask!", "Hoppa i!", "Kallt!"],
    snus: ["Snus!", "En prilla!"], tut: ["Tut tut!", "Tuuut!"], brum: ["Brum brum!", "Vroom!"], krasch: ["Krasch!", "Aj aj aj!", "Hoppsan!"],
    aj: ["Aj!", "Aj aj!"], dansa: ["Nu dansar vi!", "Nu kör vi!", "Dansa!"], sjung: ["La la la laaa!", "Tralalala!"],
    hockey: ["Heja Tre Kronor!", "Hockey!"], kott: ["Köttbullar!", "Vem vill ha köttbullar?", "Chokladbollar!"],
    // Swedish-Chef-style gibberish (original lines in that spirit): the cook in the kitchen and anyone drunk
    bork: ["Börk börk börk!", "Hurdi gurdi, flurdi smörgås!", "Bjork a bjork a bjork!", "Hurdi gurdi durdi, bla bla bla!", "Smörgåsbörk! Hurdi flurdi!",
      "Bla bla bla bla, börk!", "Hurdi durdi köttbullar, börk börk!", "Fläsk i flurdi, börk!"],
    valkommen: ["Välkommen till festen!", "Välkommen till Filips fest!"], lek: ["Wohoo!", "Vi leker!"],
    // random party chatter
    chatter: ["Börk börk börk!", "Ska vi åka skidor?", "en:Let's go skiing!", "Heja Tre Kronor!", "Köttbullar!", "Vill du ha godis?", "Fika!", "Skål!", "Grattis Filip!", "Vad kul!", "Chokladbollar!"]
  };
  // what each game sound becomes: a voice line key (sounds with no entry stay quiet)
  const SPOKEN = {
    laugh: "haha", giggle: "hihi", cheer: "jaa", clap: "heja", hiccup: "hick", burp: "bork", babble: "bork", vomit: "blah", fart: "prutt",
    plop: "plopp", pee: "aah", flush: "plopp", splash: "plask", cannonball: "plask", kiss: "puss", sniff: "snus", chug: "skal",
    clink: "skal", horn: "tut", engine: "brum", crash: "krasch", bonk: "aj", wave: "hej", sparkle: "godis", shower: "sjung",
    boing: "oj", pillow: "hihi"
  };
  const rand = Math.random;
  const noop = () => {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const nowMs = () => (window.performance && performance.now ? performance.now() : Date.now());

  // Original 8-bar loop over Am - F - C - G, 16 steps (sixteenth notes) per bar.
  const CH = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]]
    .map((c) => ({ r: c[0], n: c[1], hi: c[1].map((m) => m + 12) }));
  // Melody as step, midi note, length-in-steps triples; phrase A then phrase B.
  const PHRASES = [
    [0, 76, 2, 3, 76, 1, 4, 74, 2, 6, 72, 2, 8, 69, 4, 12, 72, 2, 14, 76, 2,
      16, 77, 3, 19, 76, 1, 20, 72, 2, 22, 69, 2, 24, 72, 6,
      32, 79, 2, 35, 76, 1, 36, 79, 2, 38, 76, 2, 40, 74, 2, 42, 72, 2, 44, 76, 4,
      48, 74, 3, 51, 71, 1, 52, 74, 2, 54, 79, 2, 56, 74, 2, 58, 71, 2, 60, 67, 4],
    [0, 81, 2, 2, 79, 2, 4, 76, 4, 8, 72, 2, 10, 74, 2, 12, 76, 4,
      16, 77, 2, 18, 76, 2, 20, 74, 2, 22, 72, 2, 24, 69, 4, 28, 72, 2, 30, 74, 2,
      32, 76, 3, 35, 79, 1, 36, 76, 2, 38, 72, 2, 40, 67, 4, 44, 72, 2, 46, 76, 2,
      48, 74, 4, 52, 71, 2, 54, 74, 2, 56, 76, 8]
  ];
  const MEL = new Array(128).fill(null);
  PHRASES.forEach((p, k) => { for (let i = 0; i < p.length; i += 3) MEL[k * 64 + p[i]] = [p[i + 1], p[i + 2]]; });
  const DAY_BASS = [0, null, null, 0, null, null, 12, null, 0, null, null, 7, null, null, 12, null];
  const PENTA = [0, 2, 4, 7, 9];

  function create(opts) {
    let ctx = null, offline = false, noiseBuf = null, master = null, fxBus = null, musicBus = null, nyq = 22050;
    let pm = 1; // pitch multiplier of the effect being built
    const L = { x: FLOOR_X, z: FLOOR_Z, fit: 30 };
    let night = false, barNight = false, levelTarget = 0, energy = 0;
    let musicOn = false, step = 0, nextT = 0, lastMix = -1, hadRun = false, lastRetry = 0, listening = false;
    let voices = [];
    const recent = {};
    let lastSay = -1e9, svVoice = null, enVoice = null, voicesSeen = 0, queued = 0, speechUnlocked = false;
    let clips = [], lastClip = -1e9;
    const spot = { x: FLOOR_X, z: FLOOR_Z }; // where the music comes from
    // bedroom music: its own slow loop from wherever a bedroom scene is on (setLove)
    const love = { on: false, x: 0, z: 0, next: 0, step: 0 };
    let loveBus = null;
    // a tree on fire: a low roar and crackling from the nearest one (setFire)
    const fire = { on: false, x: 0, z: 0, next: 0 };
    let fireBus = null, roar = null;
    // the oompah band marching round the party: its own polka from wherever the band is (setBand)
    const band = { on: false, x: 0, z: 0, next: 0, step: 0 };
    let bandBus = null;
    let club = false, musicArea = -1; // musicArea: 0-1 from the game, or -1 to go by distance from the spot

    // ---------- building blocks ----------
    const hz = (f) => clamp(f * pm, 10, nyq);

    // Linear attack, optional hold, exponential release.
    function env(p, t, v, a, r, h) {
      v = Math.max(v, 0.0002);
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(v, t + a);
      if (h) p.setValueAtTime(v, t + a + h);
      p.exponentialRampToValueAtTime(0.0001, t + a + (h || 0) + r);
    }
    function osc(type, f, t, end, dst) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(hz(f), t);
      o.connect(dst);
      o.start(t);
      o.stop(end + 0.03);
      return o;
    }
    // One oscillator note; the pitch glides to f2 over the note when f2 is given.
    function tone(d, t, type, f, f2, v, a, r, h) {
      const g = ctx.createGain(), end = t + a + (h || 0) + r;
      const o = osc(type, f, t, end, g);
      if (f2) o.frequency.exponentialRampToValueAtTime(hz(f2), end);
      env(g.gain, t, v, a, r, h);
      g.connect(d);
      return o;
    }
    // Filtered white noise; the filter sweeps to f2 when given. Returns the filter.
    function hiss(d, t, ftype, f, f2, q, v, a, r, h) {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + a + (h || 0) + r;
      s.buffer = noiseBuf;
      s.loop = true;
      fl.type = ftype;
      fl.Q.value = q;
      fl.frequency.setValueAtTime(hz(f), t);
      if (f2) fl.frequency.exponentialRampToValueAtTime(hz(f2), end);
      env(g.gain, t, v, a, r, h);
      s.connect(fl); fl.connect(g); g.connect(d);
      s.start(t, rand() * 1.5);
      s.stop(end + 0.03);
      return fl;
    }
    // Oscillator through a filter and an envelope; returns both so callers can automate them.
    function synth(d, t, type, f, ftype, ff, q, v, a, r, h) {
      const fl = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + a + (h || 0) + r;
      fl.type = ftype;
      fl.Q.value = q;
      fl.frequency.setValueAtTime(hz(ff), t);
      env(g.gain, t, v, a, r, h);
      fl.connect(g); g.connect(d);
      return { o: osc(type, f, t, end, fl), fl, end };
    }
    // Wobbles an AudioParam: rate in Hz, depth in the param's own units.
    function lfo(p, t, rate, depth, dur, type) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine";
      o.frequency.value = rate;
      g.gain.value = depth;
      o.connect(g); g.connect(p);
      o.start(t);
      o.stop(t + dur + 0.05);
      return g;
    }
    // A cartoon voice: a sawtooth "throat" through two formant band-passes (F1, F2 pick the vowel).
    function vowel(d, t, f0, f1, F1, F2, v, a, r, h) {
      const g = ctx.createGain(), b1 = ctx.createBiquadFilter(), b2 = ctx.createBiquadFilter(), end = t + a + (h || 0) + r;
      const o = osc("sawtooth", f0, t, end, g);
      if (f1) o.frequency.exponentialRampToValueAtTime(hz(f1), end);
      b1.type = b2.type = "bandpass";
      b1.frequency.value = hz(F1); b1.Q.value = 5;
      b2.frequency.value = hz(F2); b2.Q.value = 8;
      env(g.gain, t, v, a, r, h);
      g.connect(b1); g.connect(b2); b1.connect(d); b2.connect(d);
      return o;
    }
    function drops(d, t, n, span, v) {
      for (let i = 0; i < n; i++) {
        const f = 500 + rand() * 900;
        tone(d, t + rand() * span, "sine", f, f * 2.3, v, 0.002, 0.05);
      }
    }
    function clapHit(d, t, v) {
      hiss(d, t, "bandpass", 1300, 0, 1.1, v, 0.001, 0.01);
      hiss(d, t + 0.012, "bandpass", 1250, 0, 1.1, v, 0.001, 0.01);
      hiss(d, t + 0.024, "bandpass", 1200, 0, 0.9, v, 0.001, 0.12);
    }
    function honk(d, t, len) {
      const fl = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + 0.01 + len + 0.05;
      fl.type = "lowpass";
      fl.frequency.value = hz(2200);
      env(g.gain, t, 0.25, 0.01, 0.05, len);
      fl.connect(g); g.connect(d);
      [400, 504].forEach((f) => {
        const o = osc("square", f * 0.94, t, end, fl);
        o.frequency.exponentialRampToValueAtTime(hz(f), t + 0.03);
      });
    }
    function ball(d, t, v) {
      tone(d, t, "sine", 3100, 2900, v, 0.0005, 0.035);
      tone(d, t, "sine", 4700, 0, v * 0.5, 0.0005, 0.02);
      hiss(d, t, "highpass", 3500, 0, 0.7, v * 0.8, 0.0005, 0.012);
    }
    function glass(d, t, k, v) {
      tone(d, t, "sine", 2350 * k, 0, v, 0.001, 0.75);
      tone(d, t, "sine", 3710 * k, 0, v * 0.55, 0.001, 0.45);
      tone(d, t, "sine", 5580 * k, 0, v * 0.35, 0.001, 0.25);
      hiss(d, t, "highpass", 5000, 0, 0.7, v * 0.6, 0.0005, 0.01);
    }

    // ---------- effects: each builds its sound into d at time t and returns its length in seconds ----------
    const FX = {
      hiccup(d, t) {
        hiss(d, t, "bandpass", 1800, 0, 1.5, 0.3, 0.002, 0.03);
        vowel(d, t + 0.01, 300, 560, 350, 2300, 1.4, 0.004, 0.09);
        tone(d, t + 0.01, "sine", 520, 1150, 0.22, 0.003, 0.08);
        return 0.2;
      },
      burp(d, t) {
        const o = vowel(d, t, 110, 68, 480, 950, 1.8, 0.04, 0.22, 0.3);
        lfo(o.frequency, t, 31, 14, 0.6, "square");
        lfo(o.frequency, t, 7, 9, 0.6);
        return 0.6;
      },
      sniff(d, t) {
        hiss(d, t, "bandpass", 2600, 5200, 3, 0.7, 0.04, 0.07, 0.02);
        hiss(d, t + 0.19, "bandpass", 2800, 5800, 3, 0.85, 0.05, 0.09, 0.03);
        return 0.4;
      },
      plop(d, t) {
        tone(d, t, "sine", 170, 950, 0.55, 0.003, 0.11);
        tone(d, t, "sine", 130, 60, 0.35, 0.002, 0.15);
        hiss(d, t + 0.01, "highpass", 2500, 0, 0.7, 0.1, 0.002, 0.08);
        tone(d, t + 0.13, "sine", 600, 1500, 0.15, 0.003, 0.05);
        return 0.3;
      },
      fart(d, t) {
        const s = synth(d, t, "sawtooth", 92, "lowpass", 1300, 5, 0.6, 0.02, 0.26, 0.18);
        osc("square", 93, t, s.end, s.fl);
        s.o.frequency.exponentialRampToValueAtTime(hz(60), t + 0.34);
        s.o.frequency.exponentialRampToValueAtTime(hz(125), t + 0.46);
        s.fl.frequency.exponentialRampToValueAtTime(hz(500), t + 0.46);
        lfo(s.o.frequency, t, 24, 12 * pm, 0.5, "square");
        lfo(s.fl.frequency, t, 26, 400, 0.5);
        return 0.5;
      },
      flush(d, t) {
        tone(d, t, "square", 1400, 700, 0.07, 0.001, 0.025);
        tone(d, t + 0.03, "triangle", 320, 250, 0.12, 0.002, 0.05);
        hiss(d, t + 0.06, "bandpass", 1300, 380, 0.9, 0.5, 0.15, 0.6, 0.45);
        hiss(d, t + 0.06, "lowpass", 500, 250, 1, 0.35, 0.2, 0.55, 0.4);
        for (let i = 0; i < 7; i++) {
          const f = 220 + rand() * 300;
          tone(d, t + 0.35 + rand() * 0.8, "sine", f, f * 2.4, 0.16, 0.004, 0.06);
        }
        tone(d, t + 0.8, "sine", 520, 170, 0.1, 0.05, 0.45);
        return 1.35;
      },
      laugh(d, t) {
        const n = rand() < 0.5 ? 4 : 5, base = 170 + rand() * 70;
        for (let i = 0; i < n; i++) {
          const tt = t + i * 0.16, f = base * (1 - i * 0.045);
          hiss(d, tt, "bandpass", 1400, 0, 1, 0.12, 0.01, 0.03);
          vowel(d, tt + 0.025, f * 1.1, f * 0.94, 760, 1250, 1.5, 0.012, 0.08, 0.035);
        }
        return n * 0.16 + 0.1;
      },
      giggle(d, t) {
        const base = 360 + rand() * 90;
        for (let i = 0; i < 6; i++) {
          const tt = t + i * 0.095, f = base * (i % 2 ? 1.12 : 1) * (1 + i * 0.02);
          hiss(d, tt, "bandpass", 2600, 0, 1.5, 0.08, 0.006, 0.02);
          vowel(d, tt + 0.015, f * 1.05, f * 0.97, 430, 2150, 1.3, 0.008, 0.05, 0.02);
        }
        return 0.65;
      },
      cheer(d, t) {
        hiss(d, t, "bandpass", 750, 1000, 1.2, 0.35, 0.25, 0.55, 0.5);
        hiss(d, t, "bandpass", 1700, 2200, 1.6, 0.2, 0.3, 0.5, 0.45);
        for (let i = 0; i < 4; i++) {
          const f = 190 + rand() * 180;
          vowel(d, t + rand() * 0.2, f, f * 1.35, 360, 850, 0.5, 0.08, 0.45, 0.35 + rand() * 0.25);
        }
        for (let i = 0; i < 8; i++) hiss(d, t + 0.2 + rand(), "bandpass", 1400, 0, 1, 0.08 + rand() * 0.1, 0.001, 0.04);
        return 1.45;
      },
      clap(d, t) {
        for (let i = 0; i < 3; i++) clapHit(d, t + i * 0.19 + rand() * 0.02, 0.9);
        return 0.6;
      },
      splash(d, t) {
        hiss(d, t, "bandpass", 2600, 700, 0.8, 0.6, 0.008, 0.45, 0.03);
        hiss(d, t, "lowpass", 900, 300, 0.7, 0.35, 0.005, 0.25);
        drops(d, t + 0.08, 5, 0.5, 0.12);
        return 0.65;
      },
      cannonball(d, t) {
        tone(d, t, "sine", 150, 40, 0.8, 0.004, 0.35);
        hiss(d, t, "lowpass", 4500, 400, 0.6, 0.75, 0.01, 0.9, 0.08);
        hiss(d, t + 0.02, "bandpass", 1800, 600, 0.6, 0.45, 0.02, 0.7);
        drops(d, t + 0.2, 10, 1, 0.12);
        return 1.3;
      },
      horn(d, t) {
        honk(d, t, 0.13);
        honk(d, t + 0.21, 0.3);
        return 0.6;
      },
      engine(d, t) {
        const s = synth(d, t, "sawtooth", 55, "lowpass", 500, 3, 0.5, 0.05, 0.3, 0.55);
        const sub = osc("square", 27.5, t, s.end, s.fl);
        [[s.o.frequency, 1], [sub.frequency, 0.5]].forEach(([p, k]) => {
          p.linearRampToValueAtTime(hz(150 * k), t + 0.35);
          p.exponentialRampToValueAtTime(hz(95 * k), t + 0.85);
        });
        s.fl.frequency.exponentialRampToValueAtTime(hz(1800), t + 0.35);
        s.fl.frequency.exponentialRampToValueAtTime(hz(700), t + 0.85);
        lfo(s.fl.frequency, t, 18, 300, 0.9);
        return 0.95;
      },
      crash(d, t) {
        hiss(d, t, "lowpass", 6000, 700, 0.5, 0.8, 0.002, 0.5);
        hiss(d, t, "bandpass", 500, 200, 1.5, 0.6, 0.002, 0.35);
        tone(d, t, "sine", 120, 40, 0.7, 0.003, 0.3);
        [187, 263, 311, 419, 587].forEach((f) => tone(d, t, "square", f, f * 0.9, 0.06, 0.002, 0.4));
        for (let i = 0; i < 10; i++) {
          const tt = t + 0.12 + rand() * 0.8;
          if (i % 3) tone(d, tt, "triangle", 2500 + rand() * 3500, 0, 0.09, 0.001, 0.06);
          else tone(d, tt, "square", 260 + rand() * 300, 200, 0.06, 0.001, 0.05);
        }
        return 1.05;
      },
      skid(d, t) {
        const s = synth(d, t, "sawtooth", 1050, "bandpass", 1500, 6, 1, 0.03, 0.25, 0.45);
        s.o.frequency.exponentialRampToValueAtTime(hz(820), s.end);
        lfo(s.o.frequency, t, 13, 35 * pm, 0.75);
        hiss(d, t, "bandpass", 2500, 1800, 2, 0.3, 0.03, 0.25, 0.45);
        return 0.8;
      },
      // the tank's gun going off and the shell landing
      cannon(d, t) {
        tone(d, t, "sine", 110, 32, 1, 0.003, 0.55);
        hiss(d, t, "lowpass", 3000, 180, 0.7, 0.9, 0.002, 0.5);
        hiss(d, t + 0.02, "bandpass", 900, 300, 1, 0.4, 0.002, 0.25);
        return 0.7;
      },
      blast(d, t) {
        tone(d, t, "sine", 80, 28, 1, 0.004, 0.9);
        hiss(d, t, "lowpass", 4000, 120, 0.6, 1, 0.003, 1.1);
        for (let i = 0; i < 8; i++) hiss(d, t + 0.1 + rand() * 0.6, "bandpass", 1500 + rand() * 3000, 0, 3, 0.15, 0.001, 0.02);
        return 1.3;
      },
      // a giant teddy bear's footstep
      stomp(d, t) {
        const k = tone(d, t, "sine", 70, 0, 1, 0.004, 0.45);
        k.frequency.exponentialRampToValueAtTime(30, t + 0.3);
        tone(d, t, "triangle", 150, 60, 0.4, 0.003, 0.18);
        hiss(d, t, "lowpass", 500, 120, 0.7, 0.5, 0.003, 0.3);
        return 0.5;
      },
      bonk(d, t) {
        tone(d, t, "triangle", 440, 120, 0.6, 0.002, 0.2);
        tone(d, t, "sine", 880, 300, 0.25, 0.001, 0.06);
        hiss(d, t, "bandpass", 1500, 0, 1, 0.35, 0.001, 0.02);
        return 0.25;
      },
      pok(d, t) {
        tone(d, t, "sine", 1150, 800, 0.5, 0.001, 0.05);
        tone(d, t, "triangle", 620, 480, 0.25, 0.001, 0.035);
        hiss(d, t, "bandpass", 2400, 0, 1.2, 0.35, 0.001, 0.018);
        return 0.1;
      },
      clack(d, t) {
        ball(d, t, 0.4);
        if (rand() < 0.6) ball(d, t + 0.09 + rand() * 0.1, 0.18);
        return 0.25;
      },
      clink(d, t) {
        glass(d, t, 1, 0.3);
        glass(d, t + 0.065, 1.07, 0.2);
        return 0.85;
      },
      chug(d, t) {
        for (let i = 0; i < 3; i++) {
          const tt = t + i * 0.27;
          vowel(d, tt, 150, 105, 320, 750, 1, 0.01, 0.1, 0.03);
          tone(d, tt, "sine", 280, 110, 0.35, 0.008, 0.1);
          tone(d, tt + 0.13, "sine", 320, 750, 0.1, 0.003, 0.05);
        }
        return 0.9;
      },
      kiss(d, t) {
        tone(d, t, "sine", 210, 240, 0.1, 0.04, 0.08, 0.1);
        tone(d, t + 0.2, "sine", 700, 2600, 0.4, 0.002, 0.05);
        hiss(d, t + 0.2, "bandpass", 3000, 0, 1.5, 0.35, 0.001, 0.03);
        tone(d, t + 0.22, "triangle", 900, 1300, 0.08, 0.005, 0.1);
        return 0.4;
      },
      boing(d, t) {
        const o = tone(d, t, "triangle", 210, 270, 0.5, 0.003, 0.55);
        const w = lfo(o.frequency, t, 13, 0, 0.6);
        w.gain.setValueAtTime(90 * pm, t);
        w.gain.exponentialRampToValueAtTime(4, t + 0.55);
        tone(d, t, "sawtooth", 1500, 1800, 0.03, 0.02, 0.07); // spring creak
        return 0.6;
      },
      pillow(d, t) {
        hiss(d, t, "lowpass", 700, 180, 0.8, 0.9, 0.008, 0.2);
        tone(d, t, "sine", 110, 55, 0.5, 0.004, 0.14);
        hiss(d, t + 0.05, "highpass", 5000, 0, 0.5, 0.05, 0.05, 0.25);
        return 0.35;
      },
      shower(d, t) {
        const fl = hiss(d, t, "highpass", 2400, 0, 0.6, 0.2, 0.25, 0.6, 1.7);
        lfo(fl.frequency, t, 0.8, 500, 2.6);
        hiss(d, t, "bandpass", 5200, 0, 0.8, 0.12, 0.25, 0.6, 1.7);
        hiss(d, t, "lowpass", 700, 0, 0.7, 0.07, 0.3, 0.6, 1.6);
        drops(d, t + 0.2, 12, 2.2, 0.05);
        return 2.6;
      },
      pee(d, t) {
        const fl = hiss(d, t, "bandpass", 2000, 2700, 3, 0.4, 0.15, 0.35, 1.5);
        lfo(fl.frequency, t, 9, 280, 2.05);
        lfo(fl.frequency, t, 13.7, 190, 2.05);
        for (let tt = t + 0.1; tt < t + 1.8; tt += 0.06 + rand() * 0.05) {
          const f = 1300 + rand() * 1300;
          tone(d, tt, "sine", f, f * 1.3, 0.06, 0.002, 0.03);
        }
        return 2.05;
      },
      vomit(d, t) {
        vowel(d, t, 200, 270, 600, 1300, 1, 0.01, 0.08); // "hurk"
        const o = vowel(d, t + 0.16, 150, 80, 650, 1000, 1.9, 0.04, 0.3, 0.45); // "blaaargh"
        lfo(o.frequency, t + 0.16, 17, 35 * pm, 0.8, "square");
        lfo(o.frequency, t + 0.16, 5, 15 * pm, 0.8);
        hiss(d, t + 0.16, "lowpass", 900, 400, 1.5, 0.25, 0.05, 0.3, 0.4);
        hiss(d, t + 0.75, "lowpass", 1500, 300, 1, 0.4, 0.003, 0.25);
        drops(d, t + 0.78, 3, 0.2, 0.08);
        return 1.1;
      },
      zzz(d, t) {
        const s = synth(d, t, "sawtooth", 62, "lowpass", 450, 2, 0.6, 0.35, 0.25, 0.15);
        lfo(s.o.frequency, t, 21, 10 * pm, 0.8, "square");
        hiss(d, t, "lowpass", 900, 600, 1, 0.09, 0.35, 0.25, 0.15);
        tone(d, t + 0.8, "sine", 1150, 800, 0.1, 0.08, 0.35, 0.05); // whistle out
        return 1.3;
      },
      pop(d, t) {
        tone(d, t, "sine", 380, 1500, 0.55, 0.001, 0.06);
        hiss(d, t, "bandpass", 3500, 0, 1, 0.3, 0.0005, 0.015);
        return 0.1;
      },
      whoosh(d, t) {
        const fl = hiss(d, t, "bandpass", 300, 0, 1.8, 0.75, 0.2, 0.32);
        fl.frequency.exponentialRampToValueAtTime(hz(2200), t + 0.2);
        fl.frequency.exponentialRampToValueAtTime(hz(500), t + 0.52);
        return 0.55;
      },
      wave(d, t) {
        tone(d, t, "triangle", 850, 1350, 0.42, 0.005, 0.08);
        tone(d, t + 0.12, "triangle", 1000, 1800, 0.42, 0.005, 0.1);
        return 0.3;
      },
      sparkle(d, t) {
        let k = (rand() * 3) | 0;
        for (let i = 0; i < 6; i++, k += 1 + (rand() < 0.3 ? 1 : 0)) {
          const f = mtof(84 + PENTA[k % 5] + 12 * Math.floor(k / 5));
          tone(d, t + i * 0.055, "sine", f, 0, 0.3, 0.002, 0.35);
          tone(d, t + i * 0.055, "triangle", f * 2, 0, 0.05, 0.001, 0.08);
        }
        return 0.7;
      },
      splat(d, t) {
        hiss(d, t, "lowpass", 1800, 250, 1, 0.85, 0.003, 0.22);
        tone(d, t, "sine", 220, 55, 0.5, 0.003, 0.14);
        drops(d, t + 0.05, 3, 0.2, 0.08);
        return 0.35;
      }
    };

    // ---------- music: instruments play straight into the music bus ----------
    function kick(t, v) {
      const o = tone(musicBus, t, "sine", 160, 0, v, 0.002, 0.3);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
      tone(musicBus, t, "triangle", 1000, 250, v * 0.2, 0.001, 0.025); // click, so phone speakers hear the beat
    }
    function hat(t, v, open) {
      hiss(musicBus, t, "highpass", 7000, 0, 0.8, v, 0.001, open ? 0.14 : 0.03);
    }
    function bass(t, m, len, v, club) {
      const s = synth(musicBus, t, "sawtooth", mtof(m), "lowpass", club ? 1500 : 1000, club ? 6 : 2, v, 0.004, len * 0.6, len * 0.4);
      s.fl.frequency.exponentialRampToValueAtTime(club ? 260 : 400, s.end);
    }
    // Several notes (or a single one) through one filter and envelope; det = detune spread in cents.
    function chord(t, notes, v, type, cutoff, a, h, r, det) {
      const fl = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + a + h + r;
      fl.type = "lowpass";
      fl.frequency.value = cutoff;
      env(g.gain, t, v, a, r, h);
      fl.connect(g); g.connect(musicBus);
      notes.forEach((n) => {
        (det ? [-det, det] : [0]).forEach((c) => { osc(type, mtof(n), t, end, fl).detune.value = c; });
      });
    }
    function stepDur() {
      return 60 / (barNight ? NIGHT_BPM : DAY_BPM) / 4;
    }
    function schedule(s, t) {
      const b = s & 15, ch = CH[(s >> 4) & 3], mel = MEL[s], e = energy;
      if (b === 0) barNight = night || club; // day/night switches on the next bar; the DJ decks are always club
      const sd = stepDur();
      if (barNight) {
        if ((b & 3) === 0) kick(t, 0.75);
        if ((b & 1) === 0) bass(t, ch.r + (b & 2 ? 12 : 0), sd * 1.6, 0.26, true);
        if (b === 0) chord(t, ch.n, 0.05, "sawtooth", 500 + 1600 * e, 0.2, sd * 12, 0.5, 9);
        if (e > 0.2 && (b & 3) === 2) hat(t, 0.11, e > 0.5);
        else if (e > 0.45) hat(t, 0.04, false);
        if (e > 0.3 && (b === 4 || b === 12)) clapHit(musicBus, t, 0.3);
        if (e > 0.4 && (b & 3) === 2) chord(t, ch.hi, 0.035, "square", 1800, 0.002, 0.03, 0.1, 0);
        if (e > 0.55 && mel) chord(t, [mel[0]], 0.07, "sawtooth", 2400, 0.006, mel[1] * sd * 0.7, 0.12, 7);
        if (e > 0.7 && (b & 1)) tone(musicBus, t, "triangle", mtof(ch.n[(b >> 1) % 3] + 24), 0, 0.04, 0.002, 0.09);
        if (e > 0.6 && (s & 63) >= 60) clapHit(musicBus, t, 0.1 + (s & 3) * 0.05); // fill into the next phrase
      } else {
        if (e > 0.12 && (b === 0 || b === 8 || (e > 0.6 && b === 10))) kick(t, 0.5);
        if (DAY_BASS[b] !== null) bass(t, ch.r + DAY_BASS[b], sd * 1.8, 0.22, false);
        if (b === 0) chord(t, ch.n, 0.035, "sawtooth", 900 + 1500 * e, 0.3, sd * 12, 0.5, 7);
        if ((b & 3) === 2) chord(t, ch.hi, 0.05, "triangle", 3000, 0.003, 0.02, 0.14, 0); // sunny offbeat plucks
        if (e > 0.3 && (b === 4 || b === 12)) clapHit(musicBus, t, 0.2);
        if (e > 0.35 && (b & 3) === 2) hat(t, 0.07, false);
        else if (e > 0.75 && (b & 1) === 0) hat(t, 0.03, false);
        if (e > 0.5 && mel) {
          chord(t, [mel[0]], 0.08, "triangle", 4000, 0.004, mel[1] * sd * 0.6, 0.15, 0);
          if (e > 0.75) tone(musicBus, t, "sine", mtof(mel[0] + 12), 0, 0.03, 0.002, 0.25); // bell on top
        }
      }
    }

    // ---------- the DJ's three tracks (all original), taking turns: 80s blues, a German flute Schlager, Swedish disco-pop ----------
    // Each is a style: tempo, steps per bar, bars, and a player for one step. The game says which one (setMusic's style),
    // the same for everyone; a change waits for the top of a bar.
    function snare80(t, v) { // the big gated 80s snare
      hiss(musicBus, t, "bandpass", 1900, 0, 0.7, v, 0.002, 0.07, 0.13);
      tone(musicBus, t, "triangle", 210, 160, v * 0.6, 0.002, 0.1);
    }
    function tamb(t, v) { hiss(musicBus, t, "highpass", 8500, 0, 1, v, 0.001, 0.05); hiss(musicBus, t, "bandpass", 6200, 0, 6, v * 0.6, 0.001, 0.07); }
    function organ(t, notes, len, v) {
      const fl = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + len + 0.06;
      fl.type = "lowpass"; fl.frequency.value = 2400;
      env(g.gain, t, v, 0.01, 0.05, len);
      lfo(g.gain, t, 6.5, v * 0.25, len);
      fl.connect(g); g.connect(musicBus);
      notes.forEach((m) => { osc("square", mtof(m), t, end, fl).detune.value = -5; osc("sine", mtof(m + 12), t, end, fl); });
    }
    // a lead guitar: two saws through a wah-ish filter, bending up into the note
    function guitar(t, m, len, v, bend) {
      const fl = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + len + 0.12;
      fl.type = "lowpass"; fl.Q.value = 5;
      fl.frequency.setValueAtTime(900, t);
      fl.frequency.linearRampToValueAtTime(2600, t + 0.06);
      fl.frequency.exponentialRampToValueAtTime(1400, end);
      env(g.gain, t, v, 0.006, 0.12, len);
      fl.connect(g); g.connect(musicBus);
      [-7, 7].forEach((c) => {
        const o = osc("sawtooth", mtof(m - (bend || 0)), t, end, fl);
        o.detune.value = c;
        if (bend) o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.09);
        if (len > 0.3) lfo(o.detune, t + 0.18, 5.8, 18, len);
      });
    }
    // a flute: a breathy sine with a little vibrato coming in; long notes start with a grace note from above
    function flute(t, m, len, v) {
      const g = ctx.createGain(), end = t + len + 0.1;
      env(g.gain, t, v, 0.04, 0.1, len);
      g.connect(musicBus);
      const o = osc("sine", mtof(m), t, end, g);
      osc("triangle", mtof(m), t, end, g).detune.value = 3;
      if (len > 0.35) { o.frequency.setValueAtTime(mtof(m + 2), t); o.frequency.setValueAtTime(mtof(m), t + 0.05); lfo(o.detune, t + 0.2, 5.5, 14, len); }
      hiss(musicBus, t, "bandpass", mtof(m) * 2, 0, 4, v * 0.12, 0.02, 0.08, len * 0.6); // breath
    }
    function accordion(t, notes, len, v) {
      const fl = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + len + 0.05;
      fl.type = "bandpass"; fl.frequency.value = 1300; fl.Q.value = 0.6;
      env(g.gain, t, v, 0.015, 0.05, len);
      fl.connect(g); g.connect(musicBus);
      notes.forEach((m) => [-9, 9].forEach((c) => { osc("sawtooth", mtof(m), t, end, fl).detune.value = c; }));
    }
    function piano(t, notes, len, v) {
      notes.forEach((m) => {
        tone(musicBus, t, "triangle", mtof(m), 0, v, 0.003, len);
        tone(musicBus, t, "sine", mtof(m + 12), 0, v * 0.35, 0.002, len * 0.6);
      });
    }
    function strings(t, notes, len, v) { chord(t, notes, v, "sawtooth", 1500, 0.25, Math.max(0.05, len - 0.4), 0.45, 10); }
    function synthLead(t, m, len, v) {
      chord(t, [m], v, "square", 2600, 0.01, Math.max(0.02, len * 0.75), 0.12, 6);
      tone(musicBus, t, "sine", mtof(m + 12), 0, v * 0.5, 0.01, len);
    }
    const notesAt = (list, b) => list.filter((n) => n[0] === b);
    const STYLES = [
      { // 80s blues: a shuffle in A, 100 bpm, triplet eighths (12 a bar), twelve bars
        bpm: 100, perBar: 12, bars: 12,
        roots: [45, 45, 45, 45, 50, 50, 45, 45, 52, 50, 45, 52],
        voice: { 45: [55, 61, 64, 67], 50: [57, 60, 62, 66], 52: [56, 59, 62, 64] },
        licks: [
          [[0, 69, 2, 0], [2, 72, 1, 0], [3, 74, 2, 1], [5, 75, 1, 0], [6, 76, 3, 2], [12, 74, 2, 0], [14, 72, 1, 0], [15, 69, 5, 0]],
          [[0, 81, 3, 2], [3, 79, 2, 0], [5, 76, 1, 0], [6, 79, 2, 0], [8, 76, 1, 0], [9, 74, 2, 0], [11, 72, 1, 0], [12, 69, 6, 1]],
          [[0, 74, 2, 0], [2, 77, 1, 0], [3, 78, 3, 1], [6, 74, 2, 0], [8, 72, 1, 0], [9, 69, 3, 0], [15, 72, 2, 0], [17, 74, 4, 2]],
          [[0, 76, 3, 2], [3, 72, 2, 0], [5, 69, 1, 0], [6, 72, 2, 0], [8, 69, 1, 0], [9, 67, 3, 0], [12, 69, 8, 0]],
          [[0, 76, 2, 0], [2, 79, 1, 0], [3, 80, 3, 1], [6, 76, 3, 0], [12, 74, 2, 0], [14, 78, 1, 0], [15, 81, 3, 2], [18, 78, 3, 0]],
          [[0, 81, 1, 0], [1, 79, 1, 0], [2, 76, 1, 0], [3, 75, 1, 0], [4, 74, 1, 0], [5, 72, 1, 0], [6, 69, 3, 0], [12, 68, 3, 0], [15, 71, 3, 0], [18, 76, 6, 1]]
        ],
        play(bar, b, t, sd, e) {
          const r = this.roots[bar], SH = [0, 2, 3, 5, 6, 8, 9, 11], k = SH.indexOf(b);
          if (b === 0 || b === 6) kick(t, 0.7);
          if (b === 3 || b === 9) snare80(t, 0.32);
          if (k >= 0) {
            hat(t, b % 3 === 0 ? 0.09 : 0.05, false);
            bass(t, r + [0, 4, 7, 9, 10, 9, 7, 4][k], sd * 1.7, 0.24, false); // the boogie walk
          }
          if (b === 2 || b === 8) organ(t, this.voice[r], sd * 1.2, 0.035);
          if (bar === 0 && b === 0) chord(t, [57, 61, 64, 69], 0.06, "sawtooth", 2200, 0.005, 0.15, 0.4, 9); // an 80s brass stab at the top
          if (e > 0.3) notesAt(this.licks[bar >> 1], (bar & 1) * 12 + b).forEach(([, m, n, bend]) => guitar(t, m, n * sd * 0.95, 0.06, bend));
        }
      },
      { // a German Schlager with a flute: G major, 126 bpm, four on the floor, sixteen bars
        bpm: 126, perBar: 16, bars: 16,
        roots: [43, 48, 50, 43, 40, 48, 50, 43, 48, 43, 50, 43, 48, 43, 50, 43],
        chords: [[55, 59, 62], [55, 60, 64], [54, 57, 62], [55, 59, 62], [55, 59, 64], [55, 60, 64], [54, 57, 62], [55, 59, 62],
          [55, 60, 64], [55, 59, 62], [54, 57, 62], [55, 59, 62], [55, 60, 64], [55, 59, 62], [54, 57, 60, 62], [55, 59, 62]],
        tune: [
          [[0, 79, 4], [4, 83, 4], [8, 86, 6], [14, 83, 2]], [[0, 84, 4], [4, 83, 2], [6, 81, 2], [8, 79, 8]],
          [[0, 81, 2], [2, 83, 2], [4, 84, 2], [6, 86, 2], [8, 88, 4], [12, 86, 4]], [[0, 83, 6], [6, 79, 2], [8, 74, 8]],
          [[0, 79, 2], [2, 81, 2], [4, 83, 4], [8, 88, 6], [14, 86, 2]], [[0, 84, 4], [4, 88, 4], [8, 91, 6], [14, 88, 2]],
          [[0, 86, 2], [2, 84, 2], [4, 83, 2], [6, 81, 2], [8, 86, 8]], [[0, 91, 2], [2, 86, 2], [4, 83, 2], [6, 79, 2], [8, 79, 8]],
          [[0, 88, 4], [4, 84, 4], [8, 79, 4], [12, 84, 4]], [[0, 83, 2], [2, 86, 2], [4, 91, 4], [8, 86, 8]],
          [[0, 84, 2], [2, 86, 2], [4, 84, 2], [6, 83, 2], [8, 81, 4], [12, 78, 4]], [[0, 79, 8], [8, 83, 4], [12, 86, 4]],
          [[0, 88, 2], [2, 91, 2], [4, 88, 2], [6, 84, 2], [8, 88, 8]], [[0, 86, 2], [2, 83, 2], [4, 79, 4], [8, 83, 4], [12, 86, 4]],
          [[0, 84, 4], [4, 81, 2], [6, 84, 2], [8, 86, 4], [12, 90, 4]], [[0, 91, 6], [6, 86, 2], [8, 79, 4]]
        ],
        play(bar, b, t, sd, e) {
          const r = this.roots[bar];
          if ((b & 3) === 0) kick(t, 0.72);
          if (b === 4 || b === 12) clapHit(musicBus, t, 0.28);
          if ((b & 3) === 2) { hat(t, 0.09, true); accordion(t, this.chords[bar], sd * 1.3, 0.03); }
          else if (b & 1) hat(t, 0.03, false);
          if ((b & 1) === 0) bass(t, r + ((b & 3) === 2 ? 12 : 0), sd * 1.6, 0.24, true); // the octave disco bass
          if (e > 0.3) notesAt(this.tune[bar], b).forEach(([, m, n]) => flute(t, m, n * sd * 0.92, 0.09));
          if (bar === 15 && b === 12) [[125, 0.8], [165, 0.7], [220, 0.6]].forEach(([f, v], i) => vowel(musicBus, t + i * 0.012, f, f * 1.15, 560, 1900, v, 0.012, 0.16, 0.08)); // Hey!
        }
      },
      { // Swedish disco-pop, 70s Stockholm style: D minor, 122 bpm, pumping piano, strings, tambourine, sixteen bars
        bpm: 122, perBar: 16, bars: 16,
        roots: [38, 46, 41, 48, 38, 46, 43, 45, 41, 48, 38, 46, 43, 48, 41, 45],
        chords: [[62, 65, 69], [62, 65, 70], [60, 65, 69], [60, 64, 67], [62, 65, 69], [62, 65, 70], [62, 67, 70], [61, 64, 69],
          [60, 65, 69], [60, 64, 67], [62, 65, 69], [62, 65, 70], [62, 67, 70], [60, 64, 67], [60, 65, 69], [61, 64, 67, 69]],
        tune: [
          [[0, 74, 3], [3, 77, 1], [4, 76, 4], [8, 74, 2], [10, 72, 2], [12, 69, 4]], [[0, 70, 2], [2, 72, 2], [4, 74, 4], [8, 77, 6], [14, 76, 2]],
          [[0, 77, 4], [4, 76, 2], [6, 74, 2], [8, 72, 8]], [[0, 72, 2], [2, 74, 2], [4, 76, 4], [8, 79, 4], [12, 76, 4]],
          [[0, 74, 3], [3, 77, 1], [4, 81, 4], [8, 79, 2], [10, 77, 2], [12, 76, 4]], [[0, 74, 4], [4, 77, 4], [8, 82, 6], [14, 81, 2]],
          [[0, 79, 2], [2, 77, 2], [4, 74, 4], [8, 70, 4], [12, 74, 4]], [[0, 73, 8]],
          [[0, 81, 4], [4, 81, 2], [6, 79, 2], [8, 77, 4], [12, 81, 4]], [[0, 79, 4], [4, 76, 2], [6, 77, 2], [8, 79, 8]],
          [[0, 77, 4], [4, 77, 2], [6, 76, 2], [8, 74, 4], [12, 77, 4]], [[0, 74, 4], [4, 72, 2], [6, 70, 2], [8, 74, 8]],
          [[0, 74, 2], [2, 77, 2], [4, 82, 4], [8, 81, 2], [10, 79, 2], [12, 77, 4]], [[0, 76, 4], [4, 79, 4], [8, 84, 6], [14, 82, 2]],
          [[0, 81, 4], [4, 77, 4], [8, 74, 4], [12, 72, 4]], [[0, 73, 4], [4, 76, 4], [8, 79, 4], [12, 81, 4]]
        ],
        play(bar, b, t, sd, e) {
          const r = this.roots[bar], ch = this.chords[bar];
          if ((b & 3) === 0) kick(t, 0.72);
          if (b === 4 || b === 12) { snare80(t, 0.2); clapHit(musicBus, t, 0.18); }
          tamb(t, (b & 1) ? 0.05 : 0.025);
          if ((b & 3) === 2) hat(t, 0.08, true);
          if ((b & 1) === 0) { bass(t, r + ((b & 3) === 2 ? 12 : 0), sd * 1.6, 0.24, true); piano(t, ch, sd * 1.4, 0.022); }
          if (b === 0) strings(t, ch.map((m) => m + 12), sd * 16, 0.022);
          if (bar >= 8 && b === 0) ch.forEach((m, i) => vowel(musicBus, t + i * 0.02, mtof(m), 0, 760, 1150, 0.18, 0.3, 0.5, sd * 12)); // "aah" in the chorus
          if (bar === 7 && b >= 8) piano(t, [[57, 61, 64, 69], [61, 64, 69, 73], [64, 69, 73, 76], [69, 73, 76, 81]][(b - 8) >> 1].slice((b & 1) * 2, (b & 1) * 2 + 2), sd * 0.9, 0.03); // a glissando up into the chorus
          if (e > 0.3) notesAt(this.tune[bar], b).forEach(([, m, n]) => synthLead(t, m, n * sd * 0.9, 0.05));
        }
      }
    ];
    const dj = { style: 0, want: 0, step: 0 };
    function clubStep(t) {
      let S = STYLES[dj.style];
      if (dj.step % S.perBar === 0 && dj.want !== dj.style) { // a new track, from the top of a bar
        dj.style = dj.want;
        dj.step = 0;
        S = STYLES[dj.style];
        hiss(musicBus, t, "highpass", 4000, 0, 0.6, 0.12, 0.002, 1.2); // with a crash
      }
      const sd = 60 / S.bpm / (S.perBar / 4), bar = Math.floor(dj.step / S.perBar) % S.bars, b = dj.step % S.perBar;
      S.play(bar, b, t, sd, energy);
      dj.step = (dj.step + 1) % (S.perBar * S.bars);
      return sd;
    }

    // ---------- mixing and position ----------
    const zoomQuiet = () => (L.fit > 40 ? Math.max(0.3, 40 / L.fit) : 1);
    // People's sounds fade with distance from the listener (your avatar, once you've joined): clear up close, gone by
    // about 14 m, however far out the camera is.
    function place(x, z) {
      if (!L.me) return 0; // only once you're at the party: people are heard around your avatar
      if (typeof x !== "number" || typeof z !== "number" || !isFinite(x) || !isFinite(z)) return 1;
      const d = Math.sqrt((x - L.x) * (x - L.x) + (z - L.z) * (z - L.z));
      const near = 1.5, far = 13;
      if (d >= far) return 0;
      const u = d <= near ? 0 : (d - near) / (far - near);
      // full right next to you, a lot quieter a few steps away, and softer as the camera pulls out
      return (1 - u) * (1 - u) * Math.max(0.2, Math.min(1, 1 - (L.fit - 16) / 60));
    }
    function musicVol() {
      if (!musicOn) return 0;
      if (musicArea >= 0) return (0.1 + 0.08 * energy) * 1.5 * musicArea; // the game says how much of its area we're in
      const d = Math.sqrt((L.x - spot.x) * (L.x - spot.x) + (L.z - spot.z) * (L.z - spot.z));
      const near = Math.max(0, 1 - d / 15);
      return (0.1 + 0.08 * energy) * (1 + 1.2 * near) * Math.sqrt(zoomQuiet()) * (d > 26 ? 0 : 1);
    }

    // ---------- context lifecycle ----------
    function build() {
      ctx = opts && opts.context ? opts.context : new AC();
      offline = typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext;
      nyq = ctx.sampleRate * 0.49;
      const n = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = rand() * 2 - 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      master = ctx.createGain();
      master.gain.value = 0;
      fxBus = ctx.createGain();
      fxBus.gain.value = 0.9;
      musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      loveBus = ctx.createGain();
      loveBus.gain.value = 0;
      bandBus = ctx.createGain();
      bandBus.gain.value = 0;
      bandBus.connect(comp);
      fireBus = ctx.createGain();
      fireBus.gain.value = 0;
      fireBus.connect(comp);
      fxBus.connect(comp); musicBus.connect(comp); loveBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    }
    const running = () => offline || !ctx.state || ctx.state === "running";
    // iOS Safari needs resume() plus a sound started inside the gesture.
    function unlock() {
      if (offline) return;
      if (!running() && ctx.resume) {
        const p = ctx.resume();
        if (p && p.catch) p.catch(noop);
      }
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination);
      s.start(0);
    }
    function onGesture() {
      try { if (eng.enabled && ctx && !running()) unlock(); } catch (e) { /* ignore */ }
    }
    function pickVoice() {
      try {
        const vs = SS.getVoices() || [];
        voicesSeen = vs.length;
        svVoice = vs.find((v) => /^sv[-_]SE/i.test(v.lang)) || vs.find((v) => /^sv/i.test(v.lang)) || null;
        enVoice = vs.find((v) => /^en[-_](US|GB)/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
      } catch (e) { svVoice = null; }
    }

    function enable() {
      if (!AC && !(opts && opts.context)) return;
      if (!ctx) build();
      unlock();
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.setTargetAtTime(MASTER, t, 0.05);
      // (the synthesised disco loop is retired: the ABBA jukebox at the dance floor plays the music now)
      eng.enabled = true;
      if (!listening && !offline) {
        listening = true;
        ["touchend", "pointerup", "keydown"].forEach((ev) => window.addEventListener(ev, onGesture, { capture: true, passive: true }));
      }
      if (SS && !speechUnlocked) {
        speechUnlocked = true;
        pickVoice();
        if (SS.addEventListener) SS.addEventListener("voiceschanged", pickVoice);
        const u = new SpeechSynthesisUtterance(" "); // silent line inside the gesture unlocks speech on iOS
        u.volume = 0;
        SS.speak(u);
      }
    }
    function disable() {
      eng.enabled = false;
      musicOn = false;
      if (SS && queued > 0) { queued = 0; SS.cancel(); }
      if (!ctx) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.setTargetAtTime(0, t, 0.04);
      if (!offline && ctx.suspend) {
        setTimeout(() => {
          try {
            if (!eng.enabled && ctx.state === "running") { const p = ctx.suspend(); if (p && p.catch) p.catch(noop); }
          } catch (e) { /* ignore */ }
        }, 400);
      }
    }
    function setListener(x, z, fit, me) {
      L.me = !!me;
      if (typeof x === "number" && isFinite(x)) L.x = x;
      if (typeof z === "number" && isFinite(z)) L.z = z;
      if (typeof fit === "number" && isFinite(fit)) L.fit = clamp(fit, 1, 1000);
    }
    function setNight(b) {
      night = !!b;
    }
    function setMusicLevel(v) {
      levelTarget = clamp(+v || 0, 0, 1);
    }

    // Effects are spoken: the synthesised versions didn't sound good enough, so each maps to a voice line (see SPOKEN).
    // (the car's noises stay real sounds: a horn, tyres, a crunch)
    const CAR_FX = { horn: 1, crash: 1, skid: 1, bonk: 1, cannon: 1, blast: 1, whoosh: 1, stomp: 1 };
    function play(name, x, z, o) {
      if (CAR_FX[name]) { playSynth(name, x, z, o); return; }
      if (name === "engine") return; // the running engine is its own sound (setEngine)
      if (Object.prototype.hasOwnProperty.call(SPOKEN, name)) say(SPOKEN[name], x, z);
    }
    // The car you're driving: a low two-oscillator growl that climbs with the speed, fading out when you get out.
    let motor = null;
    function setEngine(on, speed, x, z) {
      if (!ctx || !eng.enabled || !running()) return;
      const t = ctx.currentTime, s = Math.min(12, Math.abs(+speed || 0));
      if (on && !motor) {
        const g = ctx.createGain(), fl = ctx.createBiquadFilter(), a = ctx.createOscillator(), b = ctx.createOscillator(), wob = ctx.createOscillator(), wg = ctx.createGain();
        g.gain.value = 0;
        fl.type = "lowpass";
        fl.frequency.value = 300;
        a.type = "sawtooth";
        b.type = "square";
        wob.frequency.value = 9; // the idle's lumpy throb
        wg.gain.value = 4;
        wob.connect(wg); wg.connect(a.frequency); wg.connect(b.frequency);
        a.connect(fl); b.connect(fl); fl.connect(g); g.connect(fxBus);
        [a, b, wob].forEach((o) => o.start(t));
        motor = { g, fl, a, b, wob };
      }
      if (!motor) return;
      const f = 34 + s * 7;
      motor.a.frequency.setTargetAtTime(f, t, 0.12);
      motor.b.frequency.setTargetAtTime(f * 1.5, t, 0.12);
      motor.fl.frequency.setTargetAtTime(260 + s * 110, t, 0.12);
      motor.g.gain.setTargetAtTime(on ? (0.09 + s * 0.012) * Math.max(0.3, place(x, z)) : 0, t, 0.15);
      if (!on) {
        const m = motor;
        motor = null;
        setTimeout(() => { try { [m.a, m.b, m.wob].forEach((o) => o.stop()); m.g.disconnect(); } catch (e) { /* gone */ } }, 800);
      }
    }
    function playSynth(name, x, z, o) {
      if (!eng.enabled || !ctx || !Object.prototype.hasOwnProperty.call(FX, name)) return;
      if (!running()) return;
      const g = place(x, z) * (o && o.vol != null ? clamp(+o.vol || 0, 0, 1) : 1);
      if (g < 0.01) return;
      const ms = nowMs(), r = recent[name] || (recent[name] = []);
      while (r.length && ms - r[0] > 1000) r.shift();
      if (r.length >= PER_NAME) return;
      const t = ctx.currentTime;
      voices = voices.filter((end) => end > t);
      if (voices.length >= MAX_VOICES) return;
      r.push(ms);
      const out = ctx.createGain();
      out.gain.value = g;
      out.connect(fxBus);
      pm = clamp((o && +o.pitch) || 1, 0.25, 4) * (0.95 + rand() * 0.1);
      let dur = 1;
      try { dur = FX[name](out, t + 0.01) || 1; } finally { pm = 1; }
      voices.push(t + dur);
      if (!offline) setTimeout(() => { try { out.disconnect(); } catch (e) { /* ignore */ } }, (dur + 0.6) * 1000);
    }

    const keySaid = {};
    function say(key, x, z) {
      if (!SS || !eng.enabled || !Object.prototype.hasOwnProperty.call(LINES, key)) return;
      const ms = nowMs();
      if (ms - lastSay < SAY_GAP) return;
      if (ms - (keySaid[key] || -1e9) < 15000) return; // the same kind of line not again for a while
      keySaid[key] = ms;
      if (ms - lastSay > 8000) queued = 0; // a line that never reported its end
      if (queued >= 2) return;
      const g = place(x, z);
      if (g < 0.05) return;
      lastSay = ms;
      if (!svVoice) pickVoice();
      const pickLine = LINES[key][Math.floor(rand() * LINES[key].length)], en = pickLine.indexOf("en:") === 0;
      const u = new SpeechSynthesisUtterance(en ? pickLine.slice(3) : pickLine);
      if (en) { if (enVoice) { u.voice = enVoice; u.lang = enVoice.lang; } else u.lang = "en-US"; }
      else if (svVoice) { u.voice = svVoice; u.lang = svVoice.lang; } else if (!voicesSeen) u.lang = "sv-SE";
      u.volume = clamp(0.2 + 0.8 * g, 0, 1);
      u.rate = 1 + rand() * 0.15;
      u.pitch = 0.7 + rand() * 0.8;
      u.onend = u.onerror = () => { queued = Math.max(0, queued - 1); };
      queued++;
      SS.speak(u);
    }

    // ---------- guests' own recorded lines ----------
    function context() {
      if (!ctx && (AC || (opts && opts.context))) build();
      return ctx;
    }
    // A recorded clip from somewhere in the world. At most three at once and not too close together, so the party
    // doesn't turn into a wall of voices; the karaoke choir (o.choir) sings together on the beat (o.at) regardless.
    function playClip(buf, x, z, o) {
      if (!eng.enabled || !ctx || !buf || !running()) return false;
      const g = place(x, z) * (o && o.vol != null ? clamp(+o.vol || 0, 0, 1.5) : 1);
      if (g < 0.04) return false;
      const t0 = ctx.currentTime, choir = !!(o && o.choir), ms = nowMs();
      clips = clips.filter((end) => end > t0);
      if (!choir && (clips.length >= 3 || ms - lastClip < 700)) return false;
      const s = ctx.createBufferSource(), out = ctx.createGain();
      s.buffer = buf;
      s.playbackRate.value = clamp((o && +o.rate) || 1, 0.5, 2);
      out.gain.value = Math.min(1.4, g * 1.15);
      s.connect(out);
      out.connect(fxBus);
      const at = o && o.at > t0 ? o.at : t0;
      s.start(at);
      clips.push(at + buf.duration / s.playbackRate.value);
      lastClip = ms;
      lastSay = ms; // and no phone voice on top of a real one
      s.onended = () => { try { out.disconnect(); } catch (e) { /* gone */ } };
      return true;
    }
    // The original loop (not anyone's song) as a backing track, e.g. for the karaoke singalong at (x, z).
    function setMusic(on, x, z, asClub, style) {
      club = !!asClub;
      if (typeof style === "number" && STYLES[style]) dj.want = style;
      if (typeof x === "number" && isFinite(x)) spot.x = x;
      if (typeof z === "number" && isFinite(z)) spot.z = z;
      if (!!on === musicOn) return;
      musicOn = !!on;
      if (musicOn && ctx) { step = 0; nextT = ctx.currentTime + 0.1; dj.style = dj.want; dj.step = 0; }
    }
    // An original slow jam for the bedrooms: warm electric-piano chords (Dmaj7, Bm7, Em7, A7) with a tremolo, a soft
    // bass and a gentle rim click, at 66 bpm.
    const LOVE_CH = [[50, [62, 66, 69, 73]], [47, [59, 62, 66, 69]], [52, [64, 67, 71, 74]], [45, [57, 61, 64, 67]]];
    function loveNote(t, m, len, v, type) {
      const g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain(), fl = ctx.createBiquadFilter();
      fl.type = "lowpass";
      fl.frequency.value = 1600;
      env(g.gain, t, v, 0.04, len * 0.5, len * 0.5);
      trem.frequency.value = 4.5;
      tg.gain.value = v * 0.3;
      trem.connect(tg);
      tg.connect(g.gain);
      trem.start(t);
      trem.stop(t + len + 0.1);
      fl.connect(g);
      g.connect(loveBus);
      osc(type || "triangle", mtof(m), t, t + len, fl);
    }
    function loveStep(t) {
      const beat = 60 / 66, s = love.step, ch = LOVE_CH[(s >> 2) & 3], b = s & 3;
      if (b === 0) ch[1].forEach((m, i) => loveNote(t + i * 0.03, m, beat * 3.8, 0.05, "triangle"));
      if (b === 0 || b === 2) loveNote(t, ch[0] - 12, beat * 1.6, 0.14, "sine");
      if (b === 1 || b === 3) tone(loveBus, t, "triangle", 1800, 900, 0.02, 0.001, 0.04);
      if (b === 2 || (b === 3 && s % 8 === 7)) loveNote(t + beat / 2, ch[1][(s * 3) % 4] + 12, beat * 0.9, 0.035, "sine"); // a little sparkle up top
      love.step = (s + 1) & 63;
      return beat;
    }
    function setLove(on, x, z) {
      if (typeof x === "number" && isFinite(x)) love.x = x;
      if (typeof z === "number" && isFinite(z)) love.z = z;
      if (!!on === love.on) return;
      love.on = !!on;
      if (love.on && ctx) { love.step = 0; love.next = ctx.currentTime + 0.1; }
    }
    // An original oompah polka in F, 2/4 at 120 bpm (eighth-note steps, four to a bar): the tuba on the beats, brass
    // "pah" chords and a cymbal off them, the big drum, two trumpets a third apart and, every other time round, the
    // singer on "la". 16 bars, then again with the singer.
    const BAND_CH = { F: [41, 36, [57, 60, 65]], C: [36, 43, [55, 58, 64]], B: [46, 41, [58, 62, 65]] };
    const BAND_BARS = "FFCCCCFFFFBBFCFF";
    const BAND_MEL = [
      [[0, 72, 1], [1, 69, 1], [2, 72, 1], [3, 77, 1]], [[0, 77, 2], [2, 72, 2]],
      [[0, 70, 1], [1, 72, 1], [2, 70, 1], [3, 67, 1]], [[0, 64, 2], [2, 67, 2]],
      [[0, 70, 1], [1, 69, 1], [2, 67, 1], [3, 69, 1]], [[0, 70, 1], [1, 72, 1], [2, 74, 1], [3, 76, 1]],
      [[0, 77, 1], [1, 76, 1], [2, 77, 1], [3, 72, 1]], [[0, 69, 2], [2, 65, 2]],
      [[0, 69, 1], [1, 72, 1], [2, 69, 1], [3, 72, 1]], [[0, 77, 3], [3, 76, 1]],
      [[0, 74, 1], [1, 77, 1], [2, 74, 1], [3, 70, 1]], [[0, 74, 2], [2, 72, 2]],
      [[0, 72, 1], [1, 69, 1], [2, 72, 1], [3, 77, 1]], [[0, 76, 1], [1, 74, 1], [2, 72, 1], [3, 70, 1]],
      [[0, 69, 2], [2, 72, 1], [3, 76, 1]], [[0, 77, 2]]
    ];
    const IN_F = [5, 7, 9, 10, 0, 2, 4];
    const thirdBelow = (m) => { let n = m, k = 0; while (k < 2) { n--; if (IN_F.indexOf(((n % 12) + 12) % 12) >= 0) k++; } return n; };
    function brass(t, m, len, v, cutoff) {
      const fl = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + len + 0.08;
      fl.type = "lowpass";
      fl.frequency.setValueAtTime(cutoff * 0.5, t);
      fl.frequency.linearRampToValueAtTime(cutoff, t + 0.04); // the "blat" as the note speaks
      fl.Q.value = 1.5;
      env(g.gain, t, v, 0.025, 0.08, Math.max(0.01, len - 0.06));
      fl.connect(g); g.connect(bandBus);
      [-6, 6].forEach((c) => {
        const o = osc("sawtooth", mtof(m) * 0.985, t, end, fl);
        o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.05); // a little scoop up into the note
        o.detune.value = c;
        if (len > 0.3) lfo(o.detune, t + 0.15, 5.5, 14, len);
      });
    }
    // the big drum: a deep boom, a punchier body that phone speakers can play, and the felt beater
    function boom(t, v) {
      const k = tone(bandBus, t, "sine", 95, 0, v, 0.004, 0.5);
      k.frequency.exponentialRampToValueAtTime(42, t + 0.28);
      const m = tone(bandBus, t, "triangle", 190, 0, v * 0.5, 0.003, 0.2);
      m.frequency.exponentialRampToValueAtTime(85, t + 0.16);
      hiss(bandBus, t, "lowpass", 900, 200, 0.8, v * 0.35, 0.002, 0.08);
    }
    // the whole band shouting "Hey!": a few voices, low and high, on "eh" sliding up
    function hey(t) {
      [[125, 0.9], [160, 0.8], [210, 0.7], [270, 0.6]].forEach(([f, v], i) => vowel(bandBus, t + i * 0.013, f, f * 1.18, 560, 1900, v, 0.012, 0.16, 0.09));
      hiss(bandBus, t, "bandpass", 2400, 3200, 1, 0.06, 0.005, 0.1); // breath on the "h"
    }
    function bandStep(t, silent) {
      const sd = 60 / 120 / 2, s = band.step, bar = (s >> 2) & 15, b = s & 3, round = (s >> 6) & 1;
      if (silent) { band.step = (s + 1) & 127; return sd; } // out of earshot: keep time, build nothing
      const ch = BAND_CH[BAND_BARS[bar]];
      // tuba: oom on the beats
      if (b === 0 || b === 2) {
        const m = b === 0 ? ch[0] : ch[1];
        const tb = synth(bandBus, t, "sawtooth", mtof(m), "lowpass", 520, 1.2, 0.2, 0.02, 0.1, sd * 0.9);
        tb.fl.frequency.exponentialRampToValueAtTime(260, tb.end);
        tone(bandBus, t, "sine", mtof(m), 0, 0.16, 0.02, 0.1, sd * 0.9);
      }
      // pah: brass chord and cymbal off the beats
      if (b === 1 || b === 3) {
        ch[2].forEach((m) => brass(t, m, sd * 0.45, 0.03, 1400));
        hiss(bandBus, t, "highpass", 6500, 0, 0.7, 0.045, 0.002, 0.12);
      }
      // the big drum: boom on every beat, a crash at the top of each phrase, "Hey!" at the end of one, and a roll into
      // the top of the tune
      if (b === 0 || b === 2) boom(t, b === 0 ? 0.75 : 0.55);
      if (b === 0 && (bar === 0 || bar === 8)) hiss(bandBus, t, "highpass", 4500, 0, 0.6, 0.13, 0.002, 1.3);
      if ((bar === 7 || bar === 15) && b === 2) hey(t);
      if (bar === 15 && b >= 2) for (let i = 0; i < 4; i++) hiss(bandBus, t + (i * sd) / 4, "bandpass", 2600, 0, 1.2, 0.05 + i * 0.012, 0.002, 0.05);
      // trumpets, and the singer the second time round
      BAND_MEL[bar].forEach(([at, m, n]) => {
        if (at !== b) return;
        const len = n * sd * 0.92;
        brass(t, m, len, 0.06, 2600);
        brass(t, thirdBelow(m), len, 0.045, 2200);
        if (round) {
          const o = vowel(bandBus, t + 0.01, mtof(m), 0, n > 1 ? 800 : 620, n > 1 ? 1200 : 1150, 0.55, 0.04, 0.08, Math.max(0.02, len - 0.1));
          if (n > 1) lfo(o.detune, t + 0.12, 5.2, 22, len);
        }
      });
      band.step = (s + 1) & 127;
      return sd;
    }
    function bandVol() {
      if (!band.on) return 0;
      const d = Math.sqrt((L.x - band.x) * (L.x - band.x) + (L.z - band.z) * (L.z - band.z));
      if (d >= 36) return 0;
      const u = d <= 4 ? 0 : (d - 4) / 32;
      return 0.45 * (1 - u) * (1 - u) * Math.sqrt(zoomQuiet());
    }
    // Thunder, heard everywhere (not just near the strike): a crack when it's close, then a long rolling rumble.
    // near: 1 right overhead, 0 far away; it comes after `delay` seconds (light first, then sound).
    function thunder(near, delay) {
      if (!ctx || !eng.enabled || !running()) return;
      near = clamp(+near || 0, 0, 1);
      const t = ctx.currentTime + clamp(+delay || 0, 0, 6), out = ctx.createGain();
      out.gain.value = 0.45 + 0.55 * near;
      out.connect(fxBus);
      if (near > 0.45) { // the crack
        hiss(out, t, "highpass", 1800, 600, 0.5, 0.9 * near, 0.002, 0.25);
        hiss(out, t + 0.03, "bandpass", 900, 300, 0.7, 0.7 * near, 0.003, 0.35);
      }
      // the rumble: low noise swelling and rolling away, with a few booms inside it
      const len = 2.6 + (1 - near) * 2;
      const fl = hiss(out, t + 0.05, "lowpass", 380, 90, 0.9, 1, 0.25 + (1 - near) * 0.4, len);
      lfo(fl.frequency, t, 1.7, 90, len);
      for (let i = 0; i < 4; i++) {
        const tt = t + 0.1 + rand() * len * 0.6, k = tone(out, tt, "sine", 55 + rand() * 25, 0, 0.5 * (1 - i * 0.15), 0.05, 0.9);
        k.frequency.exponentialRampToValueAtTime(30, tt + 0.8);
      }
      if (!offline) setTimeout(() => { try { out.disconnect(); } catch (e) { /* gone */ } }, (delay + len + 2) * 1000);
    }
    // since = seconds the band has been playing, so every phone is on the same bar (and the drummer's arm on the beat)
    function setBand(on, x, z, since) {
      if (typeof x === "number" && isFinite(x)) band.x = x;
      if (typeof z === "number" && isFinite(z)) band.z = z;
      if (!!on === band.on) return;
      band.on = !!on;
      if (!band.on || !ctx) return;
      const e = typeof since === "number" && isFinite(since) && since > 0 ? since : 0;
      band.step = Math.ceil(e / 0.25) & 127;
      band.next = ctx.currentTime + Math.ceil(e / 0.25) * 0.25 - e + 0.02;
    }
    function crackle(t) {
      hiss(fireBus, t, "bandpass", 1500 + rand() * 4500, 0, 2 + rand() * 4, 0.06 + rand() * 0.3, 0.001, 0.006 + rand() * 0.03);
      if (rand() < 0.08) tone(fireBus, t, "square", 70 + rand() * 120, 40, 0.06, 0.001, 0.03); // a pop
    }
    function fireVol() {
      const d = Math.sqrt((L.x - fire.x) * (L.x - fire.x) + (L.z - fire.z) * (L.z - fire.z));
      if (d >= 30) return 0;
      const u = d <= 3 ? 0 : (d - 3) / 27;
      return 0.6 * (1 - u) * (1 - u) * Math.sqrt(zoomQuiet());
    }
    function setFire(on, x, z) {
      fire.on = !!on;
      if (typeof x === "number" && isFinite(x)) fire.x = x;
      if (typeof z === "number" && isFinite(z)) fire.z = z;
    }
    // when the next bar of the loop starts, for singing along on the beat
    function nextBar() {
      if (!ctx) return 0;
      if (!musicOn) return ctx.currentTime + 0.05;
      let s = step, t = nextT;
      while ((s & 15) !== 0) { t += stepDur(); s = (s + 1) & 127; }
      return t;
    }

    function update(dt) {
      if (!ctx || !eng.enabled) return;
      dt = typeof dt === "number" && dt > 0 && isFinite(dt) ? Math.min(dt, 0.25) : 0.016;
      energy += (levelTarget - energy) * Math.min(1, dt * 0.8);
      if (!running()) {
        // The system suspended us (an iOS phone call, say): try again now and then.
        const ms = nowMs();
        if (hadRun && ms - lastRetry > 2000) { lastRetry = ms; unlock(); }
        return;
      }
      hadRun = true;
      const now = ctx.currentTime;
      if (now - lastMix > 0.1 || now < lastMix) {
        lastMix = now;
        musicBus.gain.setTargetAtTime(musicVol(), now, 0.25);
      }
      if (loveBus) {
        loveBus.gain.setTargetAtTime(love.on ? 0.9 * place(love.x, love.z) : 0, now, 0.4);
        if (love.on) {
          if (love.next < now - 0.2) love.next = now + 0.05;
          while (love.next < now + 0.3) love.next += loveStep(love.next);
        }
      }
      if (fireBus) {
        const fv = fire.on ? fireVol() : 0;
        fireBus.gain.setTargetAtTime(fv, now, 0.4);
        if (fv > 0.004) {
          if (!roar) { // the roar: looping noise, low-passed, breathing a little
            const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
            src.buffer = noiseBuf;
            src.loop = true;
            fl.type = "lowpass";
            fl.frequency.value = 420;
            g.gain.value = 0.55;
            src.connect(fl); fl.connect(g); g.connect(fireBus);
            src.start(now);
            const w = lfo(g.gain, now, 0.7, 0.2, 3600);
            roar = { src, w };
          }
          if (fire.next < now - 0.2) fire.next = now + 0.02;
          while (fire.next < now + 0.25) { crackle(fire.next); fire.next += 0.02 + rand() * rand() * 0.25; }
        } else if (roar && !fire.on) {
          try { roar.src.stop(now + 0.6); } catch (e) { /* stopped */ }
          roar = null;
        }
      }
      if (bandBus) {
        const bv = bandVol();
        bandBus.gain.setTargetAtTime(bv, now, 0.3);
        if (band.on) {
          if (band.next < now - 0.2) band.next = now + 0.05;
          while (band.next < now + 0.3) band.next += bandStep(band.next, bv < 0.004);
        }
      }
      if (!musicOn) return;
      if (nextT < now - 0.2) nextT = now + 0.05; // skipped frames: jump ahead instead of a burst
      const ahead = now + clamp(dt * 2 + 0.05, 0.1, 0.35);
      while (nextT < ahead) {
        if (club) { nextT += clubStep(nextT); continue; } // the DJ's tracks
        schedule(step, nextT);
        nextT += stepDur();
        step = (step + 1) & 127;
      }
    }

    // Every public method is fail safe: errors are swallowed, never thrown to the game loop.
    const safe = (fn) => function () { try { return fn.apply(null, arguments); } catch (e) { return undefined; } };
    const eng = {
      enabled: false,
      enable: safe(enable),
      disable: safe(disable),
      setListener: safe(setListener),
      setNight: safe(setNight),
      setMusicLevel: safe(setMusicLevel),
      play: safe(play),
      say: safe(say),
      update: safe(update),
      context: safe(context),
      now: safe(() => (ctx ? ctx.currentTime : 0)),
      playClip: safe(playClip),
      setMusic: safe(setMusic),
      setLove: safe(setLove),
      setBand: safe(setBand),
      setFire: safe(setFire),
      thunder: safe(thunder),
      setEngine: safe(setEngine),
      setMusicArea: safe((g) => { musicArea = typeof g === "number" && isFinite(g) ? clamp(g, -1, 1) : -1; }),
      nextBar: safe(nextBar)
    };
    return eng;
  }

  window.FefeSound = { create: create };
})();
