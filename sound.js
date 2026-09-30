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

    // ---------- mixing and position ----------
    const zoomQuiet = () => (L.fit > 40 ? Math.max(0.3, 40 / L.fit) : 1);
    // People's sounds fade with distance from the listener (your avatar, once you've joined): clear up close, gone by
    // about 14 m, however far out the camera is.
    function place(x, z) {
      if (typeof x !== "number" || typeof z !== "number" || !isFinite(x) || !isFinite(z)) return zoomQuiet();
      const d = Math.sqrt((x - L.x) * (x - L.x) + (z - L.z) * (z - L.z));
      const near = 3, far = 14;
      if (d >= far) return 0;
      const u = d <= near ? 0 : (d - near) / (far - near);
      return (1 - u * u * (3 - 2 * u)) * zoomQuiet();
    }
    function musicVol() {
      if (!musicOn) return 0;
      if (musicArea >= 0) return (0.1 + 0.08 * energy) * 2.2 * musicArea; // the game says how much of its area we're in
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
      fxBus.connect(comp); musicBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
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
    function setListener(x, z, fit) {
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
    function play(name, x, z, o) {
      if (Object.prototype.hasOwnProperty.call(SPOKEN, name)) say(SPOKEN[name], x, z);
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

    function say(key, x, z) {
      if (!SS || !eng.enabled || !Object.prototype.hasOwnProperty.call(LINES, key)) return;
      const ms = nowMs();
      if (ms - lastSay < SAY_GAP) return;
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
    function setMusic(on, x, z, asClub) {
      club = !!asClub;
      if (typeof x === "number" && isFinite(x)) spot.x = x;
      if (typeof z === "number" && isFinite(z)) spot.z = z;
      if (!!on === musicOn) return;
      musicOn = !!on;
      if (musicOn && ctx) { step = 0; nextT = ctx.currentTime + 0.1; }
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
      if (!musicOn) return;
      if (nextT < now - 0.2) nextT = now + 0.05; // skipped frames: jump ahead instead of a burst
      const ahead = now + clamp(dt * 2 + 0.05, 0.1, 0.35);
      while (nextT < ahead) {
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
      setMusicArea: safe((g) => { musicArea = typeof g === "number" && isFinite(g) ? clamp(g, -1, 1) : -1; }),
      nextBar: safe(nextBar)
    };
    return eng;
  }

  window.FefeSound = { create: create };
})();
