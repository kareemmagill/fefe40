/* FEFE40 party actions: what avatars get up to when they stop somewhere, depending on who else is there.
   app.js calls FefeActions.create(ctx) once, then party.update(dt, actors, nowMs) every frame after walking.
   Coordinates here are the design grid in metres (x east, z south); ctx.OX / ctx.OZ shift them into the scene.
   An actor is { key, look: { body, cheeky }, x, y, z, drop, moving, idleT, heading, av }. */
(function () {
  const PI = Math.PI, HALF = PI / 2, TAU = PI * 2;
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }
  const inRect = (x, z, r) => x >= r[0] && x < r[2] + 1 && z >= r[1] && z < r[3] + 1;
  const angleTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz);

  // ---------- poses ----------
  // rig: [x, y, z] offset in metres and [rx, ry, rz] tilt of the whole body around the feet; limbs: [rx, ry, rz].
  // Arms: negative x swings forward and up (-π straight up); z moves the right arm out with negative values, the left with positive.
  function base() {
    return { rig: [0, 0, 0, 0, 0, 0], head: [0, 0, 0], torso: [0, 0, 0], armR: [0, 0, -0.05], armL: [0, 0, 0.05], legR: [0, 0, 0], legL: [0, 0, 0] };
  }
  function sit(seat) {
    const p = base();
    p.rig[1] = seat - 0.825;
    p.sat = true;
    p.legR = [-HALF, 0, 0.05];
    p.legL = [-HALF, 0, -0.05];
    return p;
  }
  function lie(h, faceDown) {
    const p = base();
    p.rig = faceDown ? [0, h + 0.15, -1.1, HALF, 0, 0] : [0, h + 0.15, 1.1, -HALF, 0, 0];
    return p;
  }
  function apply(av, p) {
    const q = av.parts;
    // seated poses keep the hips on the seat whatever the guest's height (0.825 m is the standard hip height)
    av.rig.position.set(p.rig[0], p.rig[1] + (p.sat ? 0.825 * (1 - (av.scale || 1)) : 0), p.rig[2]);
    av.rig.rotation.set(p.rig[3], p.rig[4], p.rig[5]);
    ["head", "torso", "armR", "armL", "legR", "legL"].forEach((k) => q[k].rotation.set(p[k][0], p[k][1], p[k][2]));
  }
  const wave = (T, speed) => Math.sin(T * speed);
  const TREAD = 0.6; // lift for standing in the deep end
  // an arm lifting something to the mouth every `period` seconds
  function toMouth(T, period, offset) {
    const u = ((T + (offset || 0)) % period) / period;
    return u < 0.3 ? ease(u / 0.15) - ease((u - 0.15) / 0.15) : 0;
  }

  // ---------- effects: pixel icons, flying blocks, balls ----------
  const ICONS = {
    heart: ["#FF3B6B", [".##.##..", "#######.", "#######.", ".#####..", "..###...", "...#...."]],
    note: ["#FFFFFF", ["...####.", "...#..#.", "...#..#.", ".###.##.", "####.##.", ".##....."]],
    rednote: ["#FF3B3B", ["...####.", "...#..#.", "..#...#.", ".###.##.", "####.##.", ".##....."]],
    zzz: ["#FFFFFF", ["######..", "....##..", "...##...", "..##....", ".##.....", "######.."]],
    star: ["#FFE14D", ["...#....", "...#....", "#######.", ".#####..", ".##.##..", ".#...#.."]],
    bubble: ["#BFE8FF", ["..###...", ".#...#..", "#..#..#.", "#.....#.", ".#...#..", "..###..."]],
    drop: ["#6EC6FF", ["...#....", "..###...", ".#####..", ".#####..", "..###..."]],
    bang: ["#FF3B3B", ["..##....", "..##....", "..##....", "..##....", "........", "..##...."]],
    dots: ["#FFFFFF", ["........", "........", "##.##.##", "##.##.##", "........"]],
    sock: ["#FFFFFF", [".###....", ".###....", ".###....", ".####...", ".######.", ".######."]],
    blush: ["#FF8FB1", ["........", "##....##", "##....##", "........"]],
    flash: ["#FFFFFF", ["#..#..#.", ".#.#.#..", "..###...", "#######.", "..###...", ".#.#.#..", "#..#..#."]],
    puff: ["#E6E6E6", ["..###...", ".#####..", "#######.", "#######.", ".#####..", "..###..."]]
  };
  function makeFx(T, scene, OX, OZ) {
    const texCache = {}, matCache = {};
    function iconTex(type) {
      if (texCache[type]) return texCache[type];
      const c = document.createElement("canvas");
      let tex;
      if (type === "dnd") {
        c.width = 128;
        c.height = 48;
        const g = c.getContext("2d");
        g.fillStyle = "#C8302C";
        g.fillRect(0, 0, 128, 48);
        g.fillStyle = "#FFFFFF";
        g.font = "bold 17px sans-serif";
        g.textAlign = "center";
        g.fillText("DO NOT", 64, 21);
        g.fillText("DISTURB", 64, 40);
        tex = new T.CanvasTexture(c);
      } else {
        const [color, rows] = ICONS[type];
        c.width = c.height = 32;
        const g = c.getContext("2d");
        const cell = 4, ox = 0, oy = (8 - rows.length) * 2;
        rows.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch !== "#") return;
          g.fillStyle = "rgba(8,40,72,0.9)";
          g.fillRect(ox + x * cell + 1, oy + y * cell + 1, cell, cell);
        }));
        rows.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch !== "#") return;
          g.fillStyle = color;
          g.fillRect(ox + x * cell, oy + y * cell, cell, cell);
        }));
        tex = new T.CanvasTexture(c);
      }
      tex.magFilter = T.NearestFilter;
      texCache[type] = tex;
      return tex;
    }
    function spriteMat(type, overlay) {
      const k = type + (overlay ? "!" : "");
      if (!matCache[k]) matCache[k] = new T.SpriteMaterial({ map: iconTex(type), transparent: true, depthTest: !overlay });
      return matCache[k];
    }
    const boxGeo = new T.BoxGeometry(1, 1, 1);
    const boxMats = {};
    const boxMat = (color) => boxMats[color] || (boxMats[color] = new T.MeshBasicMaterial({ color }));
    const parts = [];
    const sticky = new Map();
    const MAX = 500;
    function add(obj, x, y, z, o) {
      if (parts.length >= MAX) { const old = parts.shift(); scene.remove(old.obj); }
      obj.position.set(x + OX, y, z + OZ);
      scene.add(obj);
      parts.push(Object.assign({ obj, vx: 0, vy: 0, vz: 0, g: 0, life: 1, max: 1, size: 0.4, spin: 0 }, o));
    }
    return {
      // floating pixel icon; overlay icons stay visible through roofs (used for the bedroom)
      icon(type, x, y, z, o) {
        o = o || {};
        const s = new T.Sprite(spriteMat(type, o.overlay));
        const size = o.size || 0.45;
        s.scale.set(type === "dnd" ? size * 2.6 : size, size, 1);
        add(s, x, y, z, Object.assign({ vy: 0.7, life: 1.4, max: 1.4, size }, o));
      },
      block(color, x, y, z, o) {
        o = o || {};
        const m = new T.Mesh(boxGeo, boxMat(color));
        const size = o.size || 0.15;
        m.scale.setScalar(size);
        add(m, x, y, z, Object.assign({ life: 0.8, max: 0.8, size, g: 9 }, o));
      },
      // a ball or thrown thing flying from a to b in `dur` seconds, peaking `h` metres up
      arc(color, a, b, dur, h, size) {
        const m = new T.Mesh(boxGeo, boxMat(color));
        m.scale.setScalar(size || 0.16);
        add(m, a[0], a[1], a[2], { life: dur, max: dur, size: size || 0.16, path: { a, b, h }, g: 0 });
      },
      // a sign or icon that stays while it keeps being refreshed every frame
      keep(key, type, x, y, z, size) {
        let s = sticky.get(key);
        if (!s) {
          s = { sprite: new T.Sprite(spriteMat(type, true)), seen: 0 };
          const sz = size || 0.5;
          s.sprite.scale.set(type === "dnd" ? sz * 2.6 : sz, sz, 1);
          scene.add(s.sprite);
          sticky.set(key, s);
        }
        s.sprite.position.set(x + OX, y, z + OZ);
        s.seen = 0;
      },
      update(dt) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.life -= dt;
          if (p.life <= 0) { scene.remove(p.obj); parts.splice(i, 1); continue; }
          if (p.path) {
            const u = 1 - p.life / p.max, a = p.path.a, b = p.path.b;
            p.obj.position.set(lerp(a[0], b[0], u) + OX, lerp(a[1], b[1], u) + Math.sin(u * PI) * p.path.h, lerp(a[2], b[2], u) + OZ);
            continue;
          }
          p.vy -= p.g * dt;
          p.obj.position.x += p.vx * dt;
          p.obj.position.y += p.vy * dt;
          p.obj.position.z += p.vz * dt;
          const k = Math.min(1, (p.life / p.max) * 3);
          if (p.obj.isSprite) p.obj.scale.set(p.obj.scale.x / Math.max(1e-3, p.obj.scale.y) * p.size * k, p.size * k, 1);
          else p.obj.scale.setScalar(p.size * k);
          if (p.spin) p.obj.rotation.y += p.spin * dt;
        }
        sticky.forEach((s, key) => {
          s.seen += dt;
          if (s.seen > 0.25) { scene.remove(s.sprite); sticky.delete(key); }
        });
      }
    };
  }

  // ---------- places ----------
  const BATH_MAIN = { toilets: [[18.5, 14.5, -HALF]], mirror: [16.0, 13.35, 0], queue: [[11.4, 13.5, HALF], [10.4, 13.5, HALF], [9.4, 13.5, HALF], [10.4, 12.5, HALF]] };
  const BATH_REST = { toilets: [[21.5, 35.4, PI], [23.5, 35.4, PI]], mirror: [22.5, 33.0, PI], queue: [[26.5, 34.5, -HALF], [27.5, 34.5, -HALF], [27.5, 33.5, -HALF], [28.5, 34.5, -HALF]] };
  const BEDROOMS = [
    { rect: [13, 5, 18, 9], beds: [[14.5, 6.7, 0.76], [15.5, 6.7, 0.76], [18.5, 6.8, 0.7]], door: [12.5, 7.5], win: [15.5, 4.0, 0, -1] },
    { rect: [27, 5, 31, 12], beds: [[28.5, 6.7, 0.76], [29.5, 6.7, 0.76]], door: [29.5, 13.9], win: [29.0, 4.0, 0, -1] },
    { rect: [38, 5, 42, 12], beds: [[40.5, 6.7, 0.76], [41.5, 6.7, 0.76]], door: [40.5, 13.9], win: [40.0, 4.0, 0, -1] },
    { rect: [54, 6, 60, 11], beds: [[56.5, 7.6, 0.76], [57.5, 7.6, 0.76], [58.5, 7.6, 0.76]], door: [59.5, 12.9], win: [56.5, 5.0, 0, -1] }
  ];
  const STOOLS = [[37.5, 29.5], [38.5, 29.5], [39.5, 29.5], [40.5, 29.5]];
  const LOUNGERS = [[53.5, 31.0], [56.5, 31.0], [59.5, 31.0]];
  const SOFA_LOUNGE = [[37.5, 35.35], [38.5, 35.35], [39.5, 35.35], [40.5, 35.35]];
  const SOFA_LIVING = [[5.6, 8.5], [5.6, 9.5], [5.6, 10.5], [5.6, 11.5], [5.6, 12.5]];
  const LANAI_SEATS = [[6.5, 18.5], [8.5, 18.5], [12.5, 16.6], [13.5, 16.6], [14.5, 16.6]];
  const LANAI2_SEATS = [[30.5, 14.6], [31.5, 14.6], [32.5, 14.6], [33.5, 14.6], [38.5, 15.5], [40.5, 15.5]];
  const BENCH = [[52.5, 53.55], [53.5, 53.55], [54.5, 53.55], [55.5, 53.55], [60.5, 53.55], [61.5, 53.55], [62.5, 53.55], [63.5, 53.55]];
  const DANCE_C = [47, 30];

  // A plan gives each member an act plus optional placement: spot [x, z], y (absolute floor), heading, or face [x, z].
  // Pick one of a list per actor, changing every `period` seconds.
  const choose = (a, list, t, period, extra) => list[(Math.floor(hashStr(a.key + (extra || "")) * 97 + t / period) >>> 0) % list.length];
  const cheeky = (a) => !!(a.look && a.look.cheeky);
  const male = (a) => !a.look || a.look.body !== "f";
  function centre(ms) {
    let x = 0, z = 0;
    ms.forEach((a) => { x += a.x; z += a.z; });
    return [x / ms.length, z / ms.length];
  }
  // two people facing each other, pulled in close (gap in metres between them)
  function pair(a, b, gap) {
    const [cx, cz] = centre([a, b]);
    let dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < 0.05) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
    return [
      { spot: [cx - dx * gap / 2, cz - dz * gap / 2], heading: Math.atan2(dx, dz) },
      { spot: [cx + dx * gap / 2, cz + dz * gap / 2], heading: Math.atan2(-dx, -dz) }
    ];
  }
  const seat = (list, i, heading) => (i < list.length ? { spot: [list[i][0], list[i][1]], heading } : null);

  function planDance(ms, env) {
    const t = env.t, n = ms.length;
    env.danceCount = n;
    if (n === 1) {
      const a = ms[0];
      const acts = ["disco", "robot", "sprinkler", "airguitar"];
      if (cheeky(a)) acts.push("pole");
      const act = choose(a, acts, t, 12, "dance");
      if (act === "pole") {
        const ang = t * 1.3, px = 43.5 + Math.cos(ang) * 0.75, pz = 34.5 + Math.sin(ang) * 0.75;
        return [{ act, spot: [px, pz], heading: angleTo(px, pz, 43.5, 34.5) + 0.5 }];
      }
      return [{ act }];
    }
    if (n === 2) {
      const [a, b] = ms, pr = pair(a, b, cheeky(a) && cheeky(b) ? 0.55 : 1.4);
      if (cheeky(a) && cheeky(b) && Math.floor(t / 20) % 2 === 0) return pr.map((p) => Object.assign({ act: "slowdance" }, p));
      const spin = Math.floor(t / 8) % 2 === 1;
      return [Object.assign({ act: spin ? "leadspin" : "disco" }, pr[0]), Object.assign({ act: spin ? "spin" : "discomirror" }, pr[1])];
    }
    const modes = ["line", "circle"];
    if (n >= 4) modes.push("conga");
    if (n >= 4 && ms.some(cheeky)) modes.push("surf");
    const mode = modes[Math.floor(t / 16) % modes.length];
    if (mode === "line") return ms.map((a, i) => ({ act: "line", spot: [44.6 + (i % 5) * 1.2, 28 + Math.floor(i / 5) * 1.6], heading: PI / 4 }));
    if (mode === "circle") {
      const mid = Math.floor(t / 5) % n;
      return ms.map((a, i) => {
        if (i === mid) return { act: "wild", spot: DANCE_C.slice() };
        const ang = (i / n) * TAU;
        const x = DANCE_C[0] + Math.cos(ang) * 1.9, z = DANCE_C[1] + Math.sin(ang) * 1.9;
        return { act: "clap", spot: [x, z], heading: angleTo(x, z, DANCE_C[0], DANCE_C[1]) };
      });
    }
    if (mode === "conga") {
      return ms.map((a, i) => {
        const ang = t * 0.55 - i * 0.5;
        const x = DANCE_C[0] + Math.cos(ang) * 1.9, z = DANCE_C[1] + Math.sin(ang) * 2.8;
        return { act: "conga", spot: [x, z], heading: Math.atan2(-Math.sin(ang) * 1.9, Math.cos(ang) * 2.8) };
      });
    }
    const surfer = ms.findIndex(cheeky);
    const ang = t * 0.4, sx = DANCE_C[0] + Math.cos(ang) * 1.2, sz = DANCE_C[1] + Math.sin(ang) * 1.6;
    return ms.map((a, i) => {
      if (i === surfer) return { act: "surf", spot: [sx, sz], heading: ang * 2 };
      const k = (i / n) * TAU;
      const x = sx + Math.cos(k) * 0.9, z = sz + Math.sin(k) * 0.9;
      return { act: "carry", spot: [x, z], heading: angleTo(x, z, sx, sz) };
    });
  }

  function planPool(ms, env) {
    const t = env.t;
    const deep = ms.filter((a) => env.heightAt(Math.floor(a.x), Math.floor(a.z)) < -1);
    // in deep water the floor is 1.85 m down, so standing acts tread water with the head and shoulders out
    return ms.map((a) => {
      if (deep.indexOf(a) < 0) return { act: "paddle" };
      const n = deep.length, i = deep.indexOf(a);
      const skinny = env.night && cheeky(a);
      if (n === 1) return { act: choose(a, ["swim", "float", "swim", "bomb"], t, 9, "pool"), skinny };
      if (n === 2) {
        const pr = pair(deep[0], deep[1], 1.3);
        return Object.assign({ act: "splash", skinny }, pr[i]);
      }
      const big = Math.floor(t / 8) % 3 === 2;
      const [cx, cz] = centre(deep);
      const ang = (i / n) * TAU, x = cx + Math.cos(ang) * 1.3, z = cz + Math.sin(ang) * 1.3;
      return { act: big ? "bomb" : "ball", spot: [x, z], heading: angleTo(x, z, cx, cz), skinny, ring: deep };
    });
  }

  function planDeck(ms, env) {
    const t = env.t, n = ms.length;
    if (n === 1) {
      const a = ms[0], lv = env.drunk(a);
      const l = LOUNGERS[Math.floor(hashStr(a.key) * LOUNGERS.length)];
      const onLounger = { spot: l.slice(), heading: 0 };
      if (cheeky(a) && lv >= 3) return [Object.assign({ act: "facedown" }, onLounger)];
      if (cheeky(a) && lv >= 2) return [Object.assign({ act: "hangover" }, onLounger)];
      const act = choose(a, ["sunbathe", "sunbathe", "nap", "sunscreen"], t, 14, "deck");
      return [act === "sunscreen" ? { act } : Object.assign({ act }, onLounger)];
    }
    if (n === 2) {
      const [a, b] = ms;
      if ((cheeky(a) || cheeky(b)) && Math.floor(t / 12) % 3 === 2 && env.nearestWater(b.x, b.z)) {
        const w = env.nearestWater(b.x, b.z);
        const pr = pair(a, b, 1.0);
        return [Object.assign({ act: "shove" }, pr[0]), Object.assign({ act: "pushed", water: w }, pr[1])];
      }
      return pair(a, b, 1.1).map((p) => Object.assign({ act: "chat", clink: true }, p));
    }
    const [cx, cz] = centre(ms);
    return ms.map((a, i) => ({ act: i === 0 ? "selfie" : "huddle", spot: [cx + (i - (n - 1) / 2) * 0.7, cz], heading: PI / 4 }));
  }

  function planBar(ms, env) {
    const t = env.t, n = ms.length;
    const place = (i) => (i < STOOLS.length ? { spot: STOOLS[i].slice(), heading: PI, seat: 0.87 } : { spot: [37.5 + (i - 4), 30.6], heading: PI });
    if (n === 1) return [Object.assign({ act: choose(ms[0], ["sip", "horn"], t, 10, "bar") }, place(0))];
    if (n === 2 && cheeky(ms[0]) && cheeky(ms[1])) {
      const loser = Math.floor(t / 10) % 2;
      return ms.map((a, i) => Object.assign({ act: "chug", loser: i === loser }, place(i)));
    }
    if (n === 2) return ms.map((a, i) => Object.assign({ act: "skal", toward: i ? -1 : 1 }, place(i)));
    return ms.map((a, i) => Object.assign({ act: "helan" }, place(i)));
  }

  function planKitchen(ms, env) {
    const t = env.t, n = ms.length;
    const STOVE = { spot: [22.5, 27.0], heading: PI }, ISLAND = { spot: [23.0, 29.4], heading: PI }, FRIDGE = { spot: [22.6, 29.5], heading: -HALF };
    if (n === 1) {
      const act = choose(ms[0], ["cook", "cook", "snack"], t, 10, "kitchen");
      return [Object.assign({ act }, act === "snack" ? FRIDGE : STOVE)];
    }
    const smoky = n >= 3 && t % 7 < 2;
    return ms.map((a, i) => {
      if (smoky) return Object.assign({ act: "smokewave" }, i === 0 ? STOVE : i === 1 ? ISLAND : {});
      if (i === 0) return Object.assign({ act: "cook" }, STOVE);
      if (i === 1) return Object.assign({ act: t % 8 < 1 ? "highfive" : "chop" }, ISLAND);
      return { act: "taste", face: [22.5, 26.5] };
    });
  }

  function planLounge(ms, env) {
    const t = env.t, n = ms.length;
    const MIC = [{ spot: [37.4, 33.2], heading: 0 }, { spot: [36.6, 33.5], heading: 0 }];
    const CAKE = { spot: [36.5, 34.6], heading: PI };
    const sofa = (i) => (i < SOFA_LOUNGE.length ? { spot: SOFA_LOUNGE[i].slice(), heading: PI, seat: 0.45 } : { face: [37.4, 33.2] });
    if (n === 1) {
      const a = ms[0];
      if (Math.floor(t / 12) % 3 === 2) return [Object.assign({ act: "blow" }, CAKE)];
      return [Object.assign({ act: "sing", offkey: cheeky(a) && env.drunk(a) >= 1 }, MIC[0])];
    }
    if (n === 2) return ms.map((a, i) => Object.assign({ act: "sing", offkey: cheeky(a) && env.drunk(a) >= 1 }, MIC[i]));
    const birthday = Math.floor(t / 15) % 3 === 2;
    const singer = Math.floor(t / 15) % n;
    let k = 0;
    return ms.map((a, i) => {
      if (birthday) return Object.assign({ act: "bdaysing", cake: i === 0 }, i === 0 ? CAKE : sofa(k++));
      if (i === singer) return Object.assign({ act: "sing", offkey: cheeky(a) && env.drunk(a) >= 1 }, MIC[0]);
      return Object.assign({ act: "sway" }, sofa(k++));
    });
  }

  function planBilliards(ms, env) {
    const t = env.t;
    const S = [{ spot: [27.6, 33.9], heading: HALF }, { spot: [31.4, 33.9], heading: -HALF }];
    if (ms.length === 1) return [Object.assign({ act: "cue" }, S[0])];
    const shooter = Math.floor(t / 4) % 2;
    return ms.map((a, i) => (i < 2 ? Object.assign({ act: i === shooter ? "cue" : "leancue" }, S[i]) : { act: "cheer", face: [29.5, 34] }));
  }

  function planGrazing(ms) {
    return ms.map((a, i) => ({ act: "nibble", spot: [31.5 + (i % 5), 34.45], heading: 0 }));
  }

  function planDining(ms, env) {
    const t = env.t, n = ms.length;
    const chair = (i) => {
      const x = 27.5 + Math.floor(i / 2), north = i % 2 === 0;
      return x <= 35.5 ? { spot: [x, north ? 28.5 : 31.5], heading: north ? 0 : PI, seat: 0.5 } : { face: [31, 29.9] };
    };
    if (ms.every(cheeky) && (n === 2 || n === 4)) {
      const ends = [{ spot: [26.4, 29.6], heading: HALF }, { spot: [36.6, 30.2], heading: -HALF }, { spot: [26.4, 30.4], heading: HALF }, { spot: [36.6, 29.4], heading: -HALF }];
      return ms.map((a, i) => Object.assign({ act: "pong", side: i % 2, far: ends[(i + 1) % 2].spot }, ends[i]));
    }
    const dancer = n >= 3 && Math.floor(t / 20) % 2 === 1 ? ms.findIndex(cheeky) : -1;
    const toaster = Math.floor(t / 12) % n, toasting = t % 12 < 4;
    return ms.map((a, i) => {
      if (i === dancer) return { act: "tabledance", spot: [31.0, 29.9], heading: PI / 4, lift: 0.85 };
      const c = chair(i);
      if (n === 1) return Object.assign({ act: "eat" }, c);
      if (dancer >= 0) return Object.assign({ act: "cheersit" }, c);
      if (n >= 3 && toasting) return Object.assign({ act: i === toaster ? "toast" : "raiseglass" }, c);
      return Object.assign({ act: "eat" }, c);
    });
  }

  function planBath(ms, env, area) {
    const t = env.t, n = ms.length, room = area.room;
    const toilet = (i) => ({ spot: room.toilets[i].slice(0, 2), heading: room.toilets[i][2], seat: 0.45 });
    const mirror = { spot: room.mirror.slice(0, 2), heading: room.mirror[2] };
    const queue = (i) => { const q = room.queue[Math.min(i, room.queue.length - 1)]; return { spot: [q[0], q[1]], heading: q[2] }; };
    if (n === 1) {
      const a = ms[0], u = (t + hashStr(a.key) * 16) % 16, round = Math.floor((t + hashStr(a.key) * 16) / 16);
      if (u > 12) return [Object.assign({ act: "wash" }, mirror)];
      if (male(a)) return [Object.assign({ act: "paper" }, toilet(0))];
      return [round % 2 ? Object.assign({ act: "toilet" }, toilet(0)) : Object.assign({ act: "makeup" }, mirror)];
    }
    if (n === 2 && cheeky(ms[0]) && cheeky(ms[1])) {
      const mx = room.mirror[0], mz = room.mirror[1];
      if (male(ms[0]) && male(ms[1])) {
        const sideways = Math.abs(Math.sin(room.mirror[2])) < 0.5;
        return ms.map((a, i) => ({ act: "snus", spot: sideways ? [mx - 0.45 + i * 0.9, mz] : [mx, mz - 0.45 + i * 0.9], heading: room.mirror[2] }));
      }
      const pr = pair({ x: mx - 0.5, z: mz - 0.4 }, { x: mx + 0.5, z: mz - 0.4 }, 0.5);
      return pr.map((p) => Object.assign({ act: "kiss" }, p));
    }
    let q = 0;
    return ms.map((a, i) => {
      if (i < room.toilets.length) return Object.assign({ act: male(a) ? "paper" : "toilet" }, toilet(i));
      return Object.assign({ act: n >= 3 ? "gottago" : "queue" }, queue(q++));
    });
  }

  function planBed(ms, env, area) {
    const t = env.t, n = ms.length, room = area.room;
    const bed = (i) => { const b = room.beds[i % room.beds.length]; return { spot: [b[0], b[1]], heading: 0, bed: b[2] }; };
    const naughty = ms.filter(cheeky);
    if (naughty.length >= 2) env.scene(room, naughty.length);
    let k = 0;
    const others = ms.filter((a) => !(naughty.length >= 2 && cheeky(a)));
    return ms.map((a) => {
      if (naughty.length >= 2 && cheeky(a)) return Object.assign({ act: "scene" }, bed(0));
      const i = k++;
      if (others.length === 1) return Object.assign({ act: choose(a, ["sleep", "sleep", "jumpbed"], t, 15, "bed") }, bed(i));
      if (others.length === 2) {
        const pr = pair(others[0], others[1], 1.2);
        return Object.assign({ act: "pillow" }, pr[i]);
      }
      return Object.assign({ act: "sleepover" }, bed(i));
    });
  }

  function planLiving(ms) {
    const n = ms.length;
    return ms.map((a, i) => Object.assign({ act: n === 1 ? "tv" : n === 2 ? "gaming" : "movie", pop: i % 2 === 0 }, i < SOFA_LIVING.length ? { spot: SOFA_LIVING[i].slice(), heading: HALF, seat: 0.45 } : { face: [11, 10] }));
  }

  function planLanai(ms, env, area) {
    const n = ms.length;
    return ms.map((a, i) => Object.assign({ act: n === 1 ? "fan" : n === 2 ? "fika" : "cards" }, i < area.seats.length ? { spot: area.seats[i].slice(), heading: 0, seat: 0.5 } : {}));
  }

  function planCourt(ms, env) {
    const t = env.t, n = ms.length;
    if (n === 1) {
      const act = choose(ms[0], ["serve", "hoops"], t, 12, "court");
      return [act === "hoops" ? { act, spot: [48.6, 46.0], heading: -HALF } : { act, spot: [51.5, 45.5], heading: HALF }];
    }
    const rot = Math.floor(t / 60) % n;
    const order = ms.map((a, i) => ms[(i + rot) % n]);
    const players = n >= 4 ? 4 : 2;
    const S = players === 2
      ? [{ spot: [51.5, 45.5], heading: HALF, side: 0 }, { spot: [63.5, 45.5], heading: -HALF, side: 1 }]
      : [{ spot: [51.5, 43.2], heading: HALF, side: 0 }, { spot: [63.5, 43.2], heading: -HALF, side: 1 }, { spot: [51.5, 47.8], heading: HALF, side: 0 }, { spot: [63.5, 47.8], heading: -HALF, side: 1 }];
    return ms.map((a) => {
      const i = order.indexOf(a);
      if (i < players) {
        const opp = S[(i + 1) % 2 === 1 ? i + 1 : i - 1] || S[1 - (i % 2)];
        return Object.assign({ act: "rally", lead: i === 0, target: opp.spot }, S[i]);
      }
      const b = BENCH[(i - players) % BENCH.length];
      return { act: "watch", spot: [b[0], b[1]], heading: PI, seat: 0.5 };
    });
  }

  function planPlay(ms, env) {
    const t = env.t, n = ms.length;
    if (n === 1) return [{ act: "swing", spot: [38.95, 42.45], heading: 0, seat: 1.15 }];
    if (n === 2) return [{ act: "seesaw", spot: [39.1, 49.3], heading: HALF, seat: 0.62 }, { act: "seesaw", spot: [41.9, 49.3], heading: -HALF, seat: 0.62, flip: true }];
    return ms.map((a, i) => {
      const ang = t * 1.2 + (i / n) * TAU;
      return { act: "run", spot: [39.5 + Math.cos(ang) * 2.6, 45.5 + Math.sin(ang) * 2.2], heading: Math.atan2(-Math.sin(ang) * 2.6, Math.cos(ang) * 2.2) };
    });
  }

  function planPhoto(ms) {
    const n = ms.length;
    return ms.map((a, i) => ({ act: i === 0 ? "photo" : "peace", spot: [25.5 + (i - (n - 1) / 2) * 0.8, 41.3], heading: PI / 4 }));
  }

  function planParking(ms, env) {
    const t = env.t;
    const guys = ms.filter(male);
    if (guys.length >= 2) {
      const [cx, cz] = centre(guys);
      return ms.map((a) => {
        if (male(a)) {
          const i = guys.indexOf(a), ang = (i / guys.length) * TAU;
          return { act: "brawl", spot: [cx + Math.cos(ang) * 0.5, cz + Math.sin(ang) * 0.5], heading: angleTo(cx + Math.cos(ang) * 0.5, cz + Math.sin(ang) * 0.5, cx, cz), mid: [cx, cz] };
        }
        return { act: "cheer", face: [cx, cz] };
      });
    }
    if (ms.length === 1) return [{ act: choose(ms[0], ["phone", "fetch"], t, 10, "park") }];
    return ms.map((a, i) => ({ act: "wave", spot: [5.6, 49.5 + i * 0.8], heading: -HALF }));
  }

  function planSmoke(ms) {
    return ms.map((a) => ({ act: cheeky(a) ? "smoke" : "idle" }));
  }

  function planGarden(ms, env) {
    const t = env.t;
    return ms.map((a) => {
      const passer = env.actors.find((b) => b !== a && b.moving && Math.hypot(b.x - a.x, b.z - a.z) < 3);
      if (env.lastDrop && t - env.lastDrop.t < 3 && Math.hypot(env.lastDrop.x - a.x, env.lastDrop.z - a.z) < 14) return { act: "wave", face: [env.lastDrop.x, env.lastDrop.z] };
      if (passer) return { act: "wave", face: [passer.x, passer.z] };
      const buddy = ms.find((b) => b !== a && Math.hypot(b.x - a.x, b.z - a.z) < 3);
      if (buddy) return { act: "chat", face: [buddy.x, buddy.z] };
      const lv = env.drunk(a);
      if (cheeky(a) && lv >= 3 && a.idleT < 6) return { act: "puke" };
      if (a.idleT > 14) return { act: "nap", drunkNap: cheeky(a) && lv >= 2 };
      return { act: choose(a, ["idle", "smell", "selfie", "idle"], t, 9, "garden") };
    });
  }

  const AREAS = [
    { id: "pool", test: (a, env) => { const h = env.heightAt(Math.floor(a.x), Math.floor(a.z)); return h > -50 && h < 1; }, plan: planPool },
    { id: "dance", rect: [44, 26, 49, 33], plan: planDance },
    { id: "smoke", rect: [69, 28, 72, 35], plan: planSmoke },
    { id: "deck", rect: [51, 15, 69, 33], plan: planDeck },
    { id: "bar", rect: [36, 29, 41, 31], plan: planBar },
    { id: "kitchen", rect: [21, 26, 24, 29], plan: planKitchen },
    { id: "lounge", rect: [36, 32, 41, 35], plan: planLounge },
    { id: "billiards", rect: [26, 32, 31, 35], plan: planBilliards },
    { id: "grazing", rect: [32, 32, 35, 34], plan: planGrazing },
    { id: "dining", rect: [26, 25, 35, 31], plan: planDining },
    { id: "bath", rect: [13, 11, 18, 14], room: BATH_MAIN, plan: planBath },
    { id: "restroom", rect: [21, 32, 24, 35], room: BATH_REST, plan: planBath }
  ].concat(BEDROOMS.map((room, i) => ({ id: "bed" + i, rect: room.rect, room, plan: planBed })), [
    { id: "living", rect: [5, 5, 11, 14], plan: planLiving },
    { id: "lanai", rect: [4, 16, 19, 20], seats: LANAI_SEATS, plan: planLanai },
    { id: "lanai2", rect: [26, 14, 43, 18], seats: LANAI2_SEATS, plan: planLanai },
    { id: "court", rect: [46, 38, 69, 53], plan: planCourt },
    { id: "playground", rect: [35, 40, 44, 50], plan: planPlay },
    { id: "photo", rect: [21, 37, 30, 41], plan: planPhoto },
    { id: "parking", rect: [1, 40, 17, 55], plan: planParking },
    { id: "garden", test: () => true, plan: planGarden }
  ]);

  // ---------- acts ----------
  // Each act returns { pose, R, L, head, hide } for this frame and may throw effects with m.fx.
  // m: { a, T (party clock), t (seconds in this act), dt, asg (the plan entry), x, y, z (where the body is), fx, every(period) }
  const ACTS = {
    idle(m) { const p = base(); p.head = [0, Math.sin(m.T * 0.7 + m.seed * 9) * 0.5, 0]; return { pose: p }; },
    disco(m) { return { pose: discoPose(m.T + m.seed, 1) }; },
    discomirror(m) { return { pose: discoPose(m.T, -1) }; },
    robot(m) {
      const p = base(), s = Math.floor(m.T * 3) % 4;
      p.armR = [-HALF + (s % 2 ? 0.5 : 0), 0, 0];
      p.armL = [-HALF + (s % 2 ? 0 : 0.5), 0, 0];
      p.head = [0, [0.5, 0, -0.5, 0][s], 0];
      p.rig[4] = [0.2, 0, -0.2, 0][s];
      return { pose: p };
    },
    sprinkler(m) {
      const p = base(), s = Math.floor(m.T * 5) % 6;
      p.armL = [-2.5, 0, 0.9];
      p.armR = [-HALF, 0, -0.9 + s * 0.3];
      p.rig[4] = -0.5 + s * 0.2;
      p.legR = [-0.2, 0, 0];
      return { pose: p };
    },
    airguitar(m) {
      const p = base();
      p.armL = [-1.2, 0, 0.6];
      p.armR = [-0.6 + wave(m.T, 14) * 0.3, 0, 0.5];
      p.rig[3] = -0.12;
      p.head = [wave(m.T, 7) * 0.25, 0, 0];
      p.legR = [0, 0, -0.3];
      p.legL = [0, 0, 0.3];
      if (m.every(0.5)) m.fx.icon("note", m.x, m.y + 2.6, m.z, {});
      return { pose: p };
    },
    pole(m) {
      const p = base();
      p.armR = [-2.9, 0, 0.3];
      p.armL = [-0.5, 0, 0.9];
      p.legL = [-0.9, 0, 0];
      p.rig[5] = 0.18;
      p.rig[1] = Math.abs(wave(m.T, 2.6)) * 0.3;
      return { pose: p };
    },
    leadspin(m) { const p = discoPose(m.T, 1); p.armR = [-3, 0, -0.1]; return { pose: p }; },
    spin(m) { const p = base(); p.rig[4] = m.T * 7; p.armR = [0, 0, -1.3]; p.armL = [0, 0, 1.3]; return { pose: p }; },
    slowdance(m) {
      const p = base();
      p.armR = [-1.9, 0, 0.35];
      p.armL = [-1.9, 0, -0.35];
      p.rig[5] = wave(m.T, 1.4) * 0.06;
      p.head = [0.15, 0, 0.12];
      if (m.every(1.1)) m.fx.icon("heart", m.x, m.y + 2.6, m.z, {});
      return { pose: p };
    },
    line(m) {
      const step = Math.floor(m.T / 4) % 4;
      if (step === 0) return { pose: discoPose(m.T, 1) };
      if (step === 1) return ACTS.clap(m);
      if (step === 2) return ACTS.robot(m);
      return { pose: bouncePose(m.T) };
    },
    wild(m) { const p = bouncePose(m.T); p.rig[4] = Math.floor(m.T / 2) % 2 ? m.T * 5 : 0; return { pose: p }; },
    clap(m) {
      const p = base(), c = 0.28 + wave(m.T, 16) * 0.22;
      p.armR = [-1.25, 0, c];
      p.armL = [-1.25, 0, -c];
      return { pose: p };
    },
    conga(m) {
      const p = base();
      p.armR = [-1.4, 0, 0.15];
      p.armL = [-1.4, 0, -0.15];
      const k = wave(m.T, 6) > 0;
      p.legR = [0, 0, k ? -0.5 : 0];
      p.legL = [0, 0, k ? 0 : 0.5];
      return { pose: p };
    },
    surf(m) { const p = lie(1.9); p.armR = [0, 0, -1.3]; p.armL = [0, 0, 1.3]; return { pose: p }; },
    carry(m) { const p = base(); p.armR = [-2.95, 0, -0.1]; p.armL = [-2.95, 0, 0.1]; return { pose: p }; },

    // pool: the body's floor is the pool floor; the water surface is 1.85 m above the deep floor
    paddle(m) {
      const p = sit(0);
      p.legR = [-HALF + wave(m.T, 8) * 0.3, 0, 0];
      p.legL = [-HALF - wave(m.T, 8) * 0.3, 0, 0];
      p.armR = [0, 0, -0.5];
      p.armL = [0, 0, 0.5];
      if (m.every(0.8)) m.fx.block("#DDF4FF", m.x, m.y + 0.9, m.z + 0.5, { vy: 1.6, vx: (Math.random() - 0.5) * 1.5, vz: 1, size: 0.12 });
      return { pose: p };
    },
    swim(m) {
      const p = base();
      p.rig = [0, 1.8, -1.1, HALF, 0, 0];
      p.armR = [-(m.T * 5) % TAU, 0, 0];
      p.armL = [-(m.T * 5 + PI) % TAU, 0, 0];
      p.legR = [wave(m.T, 10) * 0.3, 0, 0];
      p.legL = [-wave(m.T, 10) * 0.3, 0, 0];
      if (m.every(0.4)) m.fx.block("#FFFFFF", m.x, m.y + 1.85, m.z, { vy: 1.2, vx: (Math.random() - 0.5), size: 0.1 });
      return { pose: p, head: m.asg.skinny ? null : null, skinny: m.asg.skinny };
    },
    float(m) {
      const p = base();
      p.rig = [0, 1.82 + wave(m.T, 1.5) * 0.03, 1.1, -HALF, 0, 0];
      p.armR = [0, 0, -1.2];
      p.armL = [0, 0, 1.2];
      return { pose: p, head: "shades", skinny: m.asg.skinny };
    },
    bomb(m) {
      const p = base(), u = (m.T % 4) / 1.4;
      p.rig[1] = TREAD + (u < 1 ? Math.sin(u * PI) * 2.4 : 0);
      p.legR = [-1.4, 0, 0];
      p.legL = [-1.4, 0, 0];
      p.armR = [-1.3, 0, 0.4];
      p.armL = [-1.3, 0, -0.4];
      if (u >= 1 && u < 1 + m.dt / 1.4 * 1.01) for (let i = 0; i < 14; i++) m.fx.block(i % 2 ? "#FFFFFF" : "#8ED8F5", m.x, m.y + 1.85, m.z, { vx: (Math.random() - 0.5) * 4, vz: (Math.random() - 0.5) * 4, vy: 3 + Math.random() * 3, size: 0.18 });
      return { pose: p, skinny: m.asg.skinny };
    },
    splash(m) {
      const p = base();
      p.rig[1] = TREAD + wave(m.T, 3) * 0.04;
      p.armR = [-0.9 + wave(m.T, 9) * 0.45, 0, 0.2];
      p.armL = [-0.9 - wave(m.T, 9) * 0.45, 0, -0.2];
      if (m.every(0.25)) m.fx.block("#DDF4FF", m.x + Math.sin(m.h) * 0.6, m.y + 1.85, m.z + Math.cos(m.h) * 0.6, { vx: Math.sin(m.h) * 2.5, vz: Math.cos(m.h) * 2.5, vy: 2.5, size: 0.14 });
      return { pose: p, skinny: m.asg.skinny };
    },
    ball(m) {
      const p = ACTS.float(m).pose;
      const ring = m.asg.ring || [];
      if (ring.length > 1 && m.a === ring[Math.floor(m.T / 1.6) % ring.length] && m.every(1.6)) {
        const next = ring[(ring.indexOf(m.a) + 1) % ring.length];
        m.fx.arc("#FF5A5A", [m.x, m.y + 2.1, m.z], [next.x, m.y + 2.1, next.z], 1.4, 1.5, 0.35);
      }
      p.armR = [-2.6, 0, -0.3];
      return { pose: p, skinny: m.asg.skinny };
    },

    sunbathe(m) { const p = lie(0.42); p.armR = [-2.9, 0, 0.5]; p.armL = [-2.9, 0, -0.5]; return { pose: p, head: "shades" }; },
    nap(m) {
      const p = m.asg.spot ? lie(0.42) : lie(0);
      if (m.every(1.3)) m.fx.icon("zzz", m.x, m.y + 0.9, m.z, { size: 0.35 });
      if (!m.asg.spot && m.every(14) && m.t > 3) {
        m.fx.arc("#6B4A2A", [m.x + 0.2, m.y + 6, m.z - 1], [m.x, m.y + 0.4, m.z - 1], 0.6, 0, 0.3);
        m.fx.icon("star", m.x, m.y + 1.0, m.z - 1, { size: 0.4 });
      }
      if (m.asg.drunkNap) m.a.av.moustache(m.env.actors.some((b) => b !== m.a && Math.hypot(b.x - m.a.x, b.z - m.a.z) < 2.2) || m.s.tache);
      if (m.asg.drunkNap && m.env.actors.some((b) => b !== m.a && Math.hypot(b.x - m.a.x, b.z - m.a.z) < 2.2)) m.s.tache = true;
      return { pose: p };
    },
    sunscreen(m) {
      const p = base();
      p.armR = [-1.0 + wave(m.T, 8) * 0.25, 0, 0.6];
      p.armL = [-0.9, 0, -0.35];
      p.head = [0.3, 0, 0];
      return { pose: p };
    },
    hangover(m) { const p = lie(0.42); p.armL = [-2.6, 0, -0.4]; if (m.every(3)) m.fx.icon("drop", m.x, m.y + 1, m.z, { size: 0.3 }); return { pose: p, head: "icepack", headL: "shades" }; },
    facedown(m) { const p = lie(0.42, true); p.armR = [0, 0, -0.3]; p.armL = [0, 0, 0.3]; if (m.every(1.4)) m.fx.icon("zzz", m.x, m.y + 0.9, m.z, { size: 0.35 }); return { pose: p }; },
    chat(m) {
      const p = base();
      p.armR = [-0.6 + wave(m.T, 3) * 0.3, 0, 0.1];
      p.armL = m.asg.clink && m.T % 6 < 0.8 ? [-2.0, 0, -0.2] : [-0.9, 0, -0.2];
      p.head = [0, 0, wave(m.T, 1.5) * 0.08];
      if (m.every(2.5)) m.fx.icon("dots", m.x, m.y + 2.6, m.z, { size: 0.35 });
      return { pose: p, L: m.asg.clink ? "glass" : null };
    },
    selfie(m) {
      const p = base();
      p.armR = [-2.4, 0, -0.35];
      p.armL = [-2.6, 0, 0.3];
      p.head = [0, 0, 0.15];
      if (m.every(5)) m.fx.icon("flash", m.x, m.y + 2.7, m.z, { size: 0.9, vy: 0, life: 0.35, max: 0.35 });
      return { pose: p, R: "phone" };
    },
    huddle(m) { const p = base(); p.armR = [-2.7, 0, -0.2]; p.head = [0, 0, -0.15]; return { pose: p }; },
    shove(m) {
      const p = base(), u = (m.T % 12) / 12;
      const push = u > 0.1 && u < 0.2;
      p.armR = [push ? -HALF : -0.3, 0, 0];
      p.armL = [push ? -HALF : -0.3, 0, 0];
      p.rig[3] = push ? 0.2 : 0;
      if (u > 0.2 && u < 0.6 && m.every(0.8)) m.fx.icon("bang", m.x, m.y + 2.6, m.z, {});
      return { pose: p };
    },
    pushed(m) {
      const p = base(), u = (m.T % 12) / 12, w = m.asg.water;
      if (!w || u < 0.18) return { pose: p };
      if (u < 0.3) {
        const k = (u - 0.18) / 0.12;
        p.rig[3] = k * 1.2;
        p.armR = [-2.8, 0, -0.5];
        p.armL = [-2.8, 0, 0.5];
        m.offset = [(w[0] - m.a.x) * k, (w[1] - m.a.z) * k, Math.sin(k * PI) * 1.2 + (w[2] - m.y) * k];
        return { pose: p };
      }
      if (u < 0.3 + m.dt / 12 * 1.01) for (let i = 0; i < 12; i++) m.fx.block("#DDF4FF", w[0], w[2] + 1.8, w[1], { vx: (Math.random() - 0.5) * 4, vz: (Math.random() - 0.5) * 4, vy: 3 + Math.random() * 2, size: 0.18 });
      m.offset = [w[0] - m.a.x, w[1] - m.a.z, w[2] - m.y];
      p.armR = [-2.9 + wave(m.T, 10) * 0.4, 0, -0.4];
      p.armL = [-2.9 - wave(m.T, 10) * 0.4, 0, 0.4];
      if (m.every(0.6)) m.fx.icon("bang", w[0], w[2] + 2.8, w[1], { size: 0.35 });
      return { pose: p };
    },

    sip(m) {
      const p = sit(0.87), k = toMouth(m.T, 4, m.seed * 4);
      p.armR = [lerp(-0.5, -2.3, k), 0, lerp(0.1, 0.35, k)];
      p.head = [-0.3 * k, 0, 0];
      return { pose: p, R: "glass" };
    },
    horn(m) {
      const p = sit(0.87), k = toMouth(m.T, 5, m.seed * 5);
      p.armR = [lerp(-0.6, -2.5, k), 0, lerp(0.1, 0.35, k)];
      p.head = [-0.45 * k, 0, 0];
      return { pose: p, R: "horn" };
    },
    skal(m) {
      const p = sit(0.87), u = m.T % 5;
      if (u < 1) p.armR = [-2.0, 0, -0.5 * m.asg.toward];
      else { const k = toMouth(u, 5, 0); p.armR = [lerp(-0.6, -2.3, k), 0, 0.3]; p.head = [-0.3 * k, 0, 0]; }
      if (u < m.dt * 1.01) m.fx.icon("star", m.x, m.y + 2.6, m.z, { size: 0.35 });
      if (m.every(5) && m.a === m.env.lastSkal) m.fx.icon("note", m.x, m.y + 2.8, m.z, {});
      return { pose: p, R: "glass" };
    },
    chug(m) {
      const u = m.T % 10;
      if (m.asg.loser && u > 4 && u < 7.5) {
        const p = sit(0.87), k = Math.min(1, (u - 4) / 0.6);
        p.rig[5] = k * 1.45;
        p.rig[1] = -0.3 * k;
        if (m.every(0.7)) m.fx.icon("star", m.x, m.y + 1.2, m.z, { size: 0.35 });
        return { pose: p, R: "horn" };
      }
      const p = sit(0.87);
      if (u < 4) { p.armR = [-2.6, 0, 0.3]; p.head = [-0.55, 0, 0]; if (m.every(0.4)) m.fx.icon("bubble", m.x, m.y + 2.6, m.z, { size: 0.25 }); }
      else if (!m.asg.loser) { p.armR = [-3, 0, -0.2]; p.armL = [-3, 0, 0.2]; }
      return { pose: p, R: "horn" };
    },
    helan(m) {
      const p = sit(0.87), u = m.T % 8;
      p.rig[5] = wave(m.T, 2.4) * 0.12;
      if (u < 6) { p.armR = [0, 0, -1.35]; p.armL = [0, 0, 1.35]; if (m.every(0.8)) m.fx.icon("note", m.x, m.y + 2.6, m.z, {}); }
      else { const k = toMouth(u - 6, 2, 0); p.armR = [lerp(-0.6, -2.4, k), 0, 0.3]; p.head = [-0.4 * k, 0, 0]; }
      return { pose: p, R: u < 6 ? null : "glass" };
    },

    cook(m) {
      const p = base();
      p.armR = [-1.2 + wave(m.T, 5) * 0.15, 0, 0.3 + Math.cos(m.T * 5) * 0.15];
      p.armL = [-0.8, 0, -0.3];
      if (m.every(0.5)) m.fx.icon("puff", m.x + Math.sin(m.h) * 0.8, m.y + 1.2, m.z + Math.cos(m.h) * 0.8, { size: 0.3, vy: 0.9 });
      return { pose: p };
    },
    snack(m) {
      const p = base(), u = m.T % 5;
      p.armR = u < 2 ? [-1.5, 0, 0] : [lerp(-0.4, -2.2, toMouth(u - 2, 3, 0)), 0, 0.3];
      return { pose: p, R: u < 2 ? null : "bun" };
    },
    chop(m) { const p = base(); p.armR = [-1.1 + (wave(m.T, 14) > 0 ? 0.35 : 0), 0, 0.2]; p.armL = [-1.0, 0, -0.2]; return { pose: p }; },
    highfive(m) { const p = base(); p.armR = [-2.9, 0, -0.2]; if (m.every(1)) m.fx.icon("star", m.x, m.y + 2.8, m.z, {}); return { pose: p }; },
    taste(m) { const p = base(), k = toMouth(m.T, 3, m.seed * 3); p.armR = [lerp(-0.6, -2.2, k), 0, 0.3]; return { pose: p }; },
    smokewave(m) {
      const p = base();
      p.armR = [-2.0 + wave(m.T, 10) * 0.4, 0, 0.5];
      p.armL = [-2.0 - wave(m.T, 10) * 0.4, 0, -0.5];
      if (m.every(0.15)) m.fx.icon("puff", 22.5 + (Math.random() - 0.5), m.y + 1.5, 26.8, { size: 0.6, vy: 1.2, vx: (Math.random() - 0.5) });
      return { pose: p };
    },

    sing(m) {
      const p = base();
      p.armR = [-2.1, 0, 0.45];
      p.armL = [-1.6 + wave(m.T, 1.5) * 0.4, 0, 1.0];
      p.rig[5] = wave(m.T, 2) * 0.06;
      p.head = [-0.1, 0, wave(m.T, 2) * 0.1];
      if (m.every(0.6)) m.fx.icon(m.asg.offkey ? "rednote" : "note", m.x + (Math.random() - 0.5) * 0.5, m.y + 2.4, m.z, { vx: (Math.random() - 0.5) * 0.4 });
      if (m.asg.offkey && m.T % 12 > 11) { p.armR = [-1.2, 0, 0.3]; if (m.every(12)) m.fx.arc("#23252B", [m.x, m.y + 1.4, m.z], [m.x + 0.3, m.y + 0.05, m.z + 0.4], 0.4, 0.2, 0.15); }
      return { pose: p, R: m.asg.offkey && m.T % 12 > 11 ? null : "mic" };
    },
    sway(m) {
      const p = sit(0.45);
      p.armR = [-2.4, 0, -0.2 + wave(m.T, 1.5) * 0.3];
      p.rig[5] = wave(m.T, 1.5) * 0.08;
      return { pose: p, R: "phone" };
    },
    blow(m) {
      const p = base();
      p.rig[3] = 0.3;
      if (m.every(0.2)) m.fx.icon("puff", m.x + Math.sin(m.h) * 0.6, m.y + 1.6, m.z + Math.cos(m.h) * 0.6, { size: 0.2, vy: 0.2, vx: Math.sin(m.h) * 0.8, vz: Math.cos(m.h) * 0.8 });
      return { pose: p };
    },
    bdaysing(m) {
      const p = m.asg.seat ? sit(m.asg.seat) : base();
      p.armR = [-2.6 + wave(m.T, 2) * 0.3, 0, -0.2];
      p.armL = [-2.6 - wave(m.T, 2) * 0.3, 0, 0.2];
      if (m.every(0.7)) m.fx.icon("note", m.x, m.y + 2.5, m.z, {});
      if (m.asg.cake && m.every(2)) for (let i = 0; i < 16; i++) m.fx.block(["#FEFE40", "#006AA7", "#FF6FB5", "#FFFFFF"][i % 4], 36.5, m.y + 1.4, 33.5, { vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 2, g: 5, size: 0.1, life: 1.4, max: 1.4 });
      return { pose: p };
    },

    cue(m) {
      const p = base();
      p.rig[3] = 0.55;
      p.rig[1] = -0.15;
      p.armR = [-1.2 + (m.T % 4 > 3.6 ? -0.3 : wave(m.T, 3) * 0.08), 0, 0.2];
      p.armL = [-1.6, 0, -0.3];
      if (m.T % 4 < m.dt * 1.01 && m.t > 1) m.fx.arc("#FFFFFF", [29.0, m.y + 0.95, 33.7], [30.4, m.y + 0.95, 34.3], 0.8, 0, 0.14);
      return { pose: p, R: "cue" };
    },
    leancue(m) { const p = base(); p.armR = [-0.4, 0, 0.2]; p.rig[5] = 0.05; return { pose: p, R: "cue" }; },
    cheer(m) {
      const p = base();
      p.armR = [-2.8 + wave(m.T, 8) * 0.3, 0, -0.2];
      p.armL = [-2.8 - wave(m.T, 8) * 0.3, 0, 0.2];
      p.rig[1] = Math.abs(wave(m.T, 6)) * 0.12;
      return { pose: p };
    },
    nibble(m) { const p = base(), k = toMouth(m.T, 2.5, m.seed * 2.5); p.armR = [lerp(-0.7, -2.2, k), 0, 0.3]; p.armL = [-1.1, 0, -0.1]; return { pose: p, L: "plate" }; },
    eat(m) { const p = sit(m.asg.seat || 0.5), k = toMouth(m.T, 2.4, m.seed * 2.4); p.armR = [lerp(-1.1, -2.1, k), 0, 0.3]; p.armL = [-1.2, 0, -0.1]; return { pose: p }; },
    toast(m) {
      const p = base();
      p.armR = [-2.7, 0, -0.1];
      if (m.every(1.2)) m.fx.icon("star", m.x, m.y + 3, m.z, { size: 0.35 });
      return { pose: p, R: "glass" };
    },
    raiseglass(m) { const p = sit(m.asg.seat || 0.5); p.armR = [-2.3, 0, 0]; return { pose: p, R: "glass" }; },
    cheersit(m) { const p = sit(m.asg.seat || 0.5); p.armR = [-2.8 + wave(m.T, 8) * 0.3, 0, -0.2]; p.armL = [-2.8 - wave(m.T, 8) * 0.3, 0, 0.2]; return { pose: p }; },
    tabledance(m) { const p = discoPose(m.T, 1); p.rig[1] += m.asg.lift; return { pose: p }; },
    pong(m) {
      const p = base(), u = (m.T + m.asg.side * 1.5) % 3;
      p.armR = u < 0.4 ? [-0.3, 0, 0.2] : u < 0.6 ? [-2.2, 0, 0.2] : [-0.6, 0, 0.1];
      if (u >= 0.5 && u < 0.5 + m.dt * 1.01) m.fx.arc("#FFFFFF", [m.x, m.y + 1.6, m.z], [m.asg.far[0], m.y + 0.95, m.asg.far[1]], 0.9, 0.9, 0.12);
      return { pose: p };
    },

    paper(m) {
      const p = sit(0.45);
      p.armR = [-1.35, 0, 0.35];
      p.armL = [-1.35, 0, -0.35];
      p.legR = [-HALF + wave(m.T, 3) * 0.15, 0, 0.05];
      p.legL = [-HALF - wave(m.T, 3) * 0.15, 0, -0.05];
      return { pose: p, R: "paper" };
    },
    toilet(m) {
      const p = sit(0.45);
      if (m.t > 6) { p.armR = [-2.8, 0, -0.3 + wave(m.T, 6) * 0.1]; p.head = [0, 0, 0.1]; }
      return { pose: p };
    },
    makeup(m) { const p = base(); p.armR = [-2.0 + wave(m.T, 6) * 0.06, 0, 0.45]; p.head = [0, 0, 0.12]; return { pose: p, R: "lipstick" }; },
    wash(m) {
      const p = base();
      p.armR = [-0.9, 0, 0.25 + wave(m.T, 12) * 0.12];
      p.armL = [-0.9, 0, -0.25 - wave(m.T, 12) * 0.12];
      if (m.every(0.4)) m.fx.icon("bubble", m.x + Math.sin(m.h) * 0.5, m.y + 1.4, m.z + Math.cos(m.h) * 0.5, { size: 0.2, vy: 0.4 });
      return { pose: p };
    },
    queue(m) {
      const p = base();
      p.legR = [wave(m.T, 10) > 0 ? -0.25 : 0, 0, 0];
      p.armL = [-1.4, 0, -0.6];
      p.head = [0.25, 0, 0];
      if (m.every(3)) m.fx.icon("drop", m.x, m.y + 2.5, m.z, { size: 0.3 });
      return { pose: p };
    },
    gottago(m) {
      const p = base();
      p.legR = [0, 0, 0.18];
      p.legL = [0, 0, -0.18];
      p.armR = [-0.5, 0, 0.45];
      p.armL = [-0.5, 0, -0.45];
      p.rig[1] = Math.abs(wave(m.T, 9)) * 0.1;
      if (m.every(1.5)) m.fx.icon("drop", m.x, m.y + 2.5, m.z, { size: 0.3 });
      return { pose: p };
    },
    kiss(m) {
      const p = base();
      p.rig[3] = 0.12;
      p.armR = [-1.6, 0, 0.5];
      p.armL = [-1.6, 0, -0.5];
      p.head = [0.1, 0, 0.15];
      if (m.every(0.7)) m.fx.icon("heart", m.x, m.y + 2.5, m.z, {});
      return { pose: p };
    },
    snus(m) {
      const p = base(), u = (m.T + m.seed * 6) % 6;
      p.armL = [-0.9, 0, -0.2];
      if (u < 1) { p.armR = [-2.2, 0, 0.4]; p.head = [-0.15, 0, 0]; }
      else if (u < 3) { p.head = [0, 0, wave(m.T, 4) * 0.1]; if (m.every(3)) m.fx.icon("star", m.x, m.y + 2.6, m.z, { size: 0.3 }); }
      return { pose: p, L: "snus" };
    },

    sleep(m) { const p = lie(m.asg.bed || 0.76); if (m.every(1.3)) m.fx.icon("zzz", m.x, m.y + 1.3, m.z - 0.8, { size: 0.35 }); return { pose: p }; },
    jumpbed(m) {
      const p = base();
      p.rig[1] = (m.asg.bed || 0.76) + Math.abs(wave(m.T, 4)) * 0.7;
      p.armR = [-2.8 + wave(m.T, 8) * 0.4, 0, -0.4];
      p.armL = [-2.8 - wave(m.T, 8) * 0.4, 0, 0.4];
      return { pose: p };
    },
    pillow(m) {
      const p = base(), sw = wave(m.T + m.seed, 6);
      p.armR = [-2.6 + sw * 1.2, 0, 0.2];
      if (sw < -0.9 && m.every(0.5)) for (let i = 0; i < 5; i++) m.fx.block("#FFFFFF", m.x + Math.sin(m.h) * 0.8, m.y + 1.8, m.z + Math.cos(m.h) * 0.8, { vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, vy: 1.5, g: 1.5, size: 0.08, life: 1.6, max: 1.6 });
      return { pose: p, R: "pillow" };
    },
    sleepover(m) { const p = lie(m.asg.bed || 0.76); p.armR = [-2.5, 0, 0.4]; if (m.every(2.5)) m.fx.icon("dots", m.x, m.y + 1.4, m.z - 0.8, { size: 0.3 }); return { pose: p }; },
    scene() { return { pose: base(), hide: true }; },

    tv(m) { const p = sit(0.45); p.head = [Math.floor(m.T / 5) % 3 === 0 ? -0.15 : 0, 0, 0]; return { pose: p }; },
    gaming(m) {
      const p = sit(0.45);
      p.rig[3] = 0.15 + wave(m.T, 3) * 0.05;
      p.armR = [-1.1 + wave(m.T, 18) * 0.05, 0, 0.25];
      p.armL = [-1.1, 0, -0.25];
      return { pose: p, R: "controller" };
    },
    movie(m) {
      const p = sit(0.45);
      if (m.asg.pop) { const k = toMouth(m.T, 2.2, m.seed * 2.2); p.armR = [lerp(-0.9, -2.1, k), 0, 0.3]; p.armL = [-1.0, 0, -0.2]; }
      return { pose: p, L: m.asg.pop ? "popcorn" : null };
    },
    fan(m) { const p = m.asg.seat ? sit(m.asg.seat) : base(); p.armR = [-2.0 + wave(m.T, 10) * 0.25, 0, 0.5]; return { pose: p }; },
    fika(m) {
      const p = m.asg.seat ? sit(m.asg.seat) : base(), k = toMouth(m.T, 4, m.seed * 4);
      p.armR = [lerp(-0.8, -2.2, k), 0, 0.3];
      p.armL = [-1.0, 0, -0.2];
      return { pose: p, R: "cup", L: "bun" };
    },
    cards(m) {
      const p = m.asg.seat ? sit(m.asg.seat) : base();
      p.armR = [-1.1 + (m.T % 5 < 0.3 ? 0.4 : 0), 0, 0.3];
      p.armL = [-1.1, 0, -0.3];
      return { pose: p, R: "cards" };
    },

    serve(m) {
      const p = base(), u = m.T % 3;
      p.armL = u < 0.6 ? [-2.6, 0, 0] : [-0.3, 0, 0.1];
      p.armR = u < 0.6 ? [-0.2, 0, -0.4] : u < 0.9 ? [-2.8, 0, -0.1] : [-1.0, 0, 0.3];
      if (u >= 0.75 && u < 0.75 + m.dt * 1.01) m.fx.arc("#FEFE40", [m.x, m.y + 2.4, m.z], [m.x + 9, m.y + 0.1, m.z], 1.2, 1.2, 0.14);
      return { pose: p, R: "paddle" };
    },
    hoops(m) {
      const p = base(), u = m.T % 3;
      p.armR = u < 0.5 ? [-2.9, 0, -0.1] : [-1.4, 0, 0.1];
      p.armL = u < 0.5 ? [-2.9, 0, 0.1] : [-1.4, 0, -0.1];
      p.rig[1] = u < 0.5 ? Math.sin((u / 0.5) * PI) * 0.35 : 0;
      if (u < m.dt * 1.01) m.fx.arc("#FF7A1A", [m.x, m.y + 2.5, m.z], [47.5, 4.9, 46.0], 1.0, 1.4, 0.3);
      return { pose: p };
    },
    rally(m) {
      const p = base(), cycle = 2.4, u = (m.T + (m.asg.side ? cycle / 2 : 0)) % cycle;
      p.legR = [0, 0, -0.25];
      p.legL = [0, 0, 0.25];
      p.rig[1] = -0.08;
      p.armR = u < 0.25 ? [-1.9, 0.0, -0.9 + u * 5] : [-0.9, 0, 0.2];
      if (u < m.dt * 1.01 && m.asg.target) m.fx.arc("#FEFE40", [m.x, m.y + 1.3, m.z], [m.asg.target[0], m.y + 1.3, m.asg.target[1]], cycle / 2, 1.3, 0.14);
      return { pose: p, R: "paddle" };
    },
    watch(m) {
      const p = sit(m.asg.seat || 0.5);
      if (m.T % 5 < 1.5) { const c = 0.28 + wave(m.T, 16) * 0.22; p.armR = [-1.25, 0, c]; p.armL = [-1.25, 0, -c]; }
      return { pose: p };
    },
    swing(m) {
      const p = sit(m.asg.seat || 1.15), s = wave(m.T, 2.2);
      p.rig[2] = s * 0.9;
      p.rig[1] += (1 - Math.cos(s * 0.5)) * 0.8;
      p.rig[3] = -s * 0.25;
      p.legR = [-HALF - s * 0.4, 0, 0.05];
      p.legL = [-HALF - s * 0.4, 0, -0.05];
      p.armR = [-2.6, 0, 0.1];
      p.armL = [-2.6, 0, -0.1];
      return { pose: p };
    },
    seesaw(m) {
      const p = sit(m.asg.seat || 0.62);
      p.rig[1] += wave(m.T, 2) * 0.35 * (m.asg.flip ? -1 : 1);
      p.armR = [-1.3, 0, 0.2];
      p.armL = [-1.3, 0, -0.2];
      return { pose: p };
    },
    run(m) {
      const p = base(), a = wave(m.T, 14) * 0.9;
      p.legR = [a, 0, 0];
      p.legL = [-a, 0, 0];
      p.armR = [-a, 0, -0.05];
      p.armL = [a, 0, 0.05];
      p.rig[3] = 0.15;
      return { pose: p };
    },
    photo(m) {
      const p = base();
      p.armR = [-2.6, 0, -0.35];
      p.armL = [0.2, 0, 0.8];
      if (m.every(4)) m.fx.icon("flash", m.x + 2, m.y + 1.8, m.z + 2, { size: 1.1, vy: 0, life: 0.3, max: 0.3 });
      return { pose: p };
    },
    peace(m) { const p = base(); p.armR = [-2.6, 0, -0.35]; p.armL = [-2.6, 0, 0.35]; return { pose: p }; },
    phone(m) { const p = base(); p.armR = [-1.9, 0, 0.35]; p.head = [0.25, 0, 0]; return { pose: p, R: "phone" }; },
    fetch(m) {
      const p = base(), u = m.T % 8;
      if (u < 3) { p.rig[3] = 0.6; p.armR = [-1.4, 0, 0]; p.armL = [-1.4, 0, 0]; return { pose: p }; }
      p.armR = [-2.9, 0, -0.1];
      return { pose: p, R: "bottle" };
    },
    wave(m) { const p = base(); p.armR = [-2.8, 0, -0.3 + wave(m.T, 10) * 0.35]; return { pose: p }; },
    brawl(m) {
      const u = m.T % 12, mid = m.asg.mid;
      if (u < 5) {
        if (m.a === m.env.brawlLead(mid) && m.every(0.06)) {
          m.fx.block(Math.random() < 0.5 ? "#B8B2A6" : "#D6D0C4", mid[0] + (Math.random() - 0.5) * 1.4, m.y + 0.4 + Math.random() * 1.6, mid[1] + (Math.random() - 0.5) * 1.4, { g: 0, vy: 0.3, size: 0.5 + Math.random() * 0.4, life: 0.45, max: 0.45 });
          if (Math.random() < 0.2) m.fx.icon(Math.random() < 0.5 ? "star" : "bang", mid[0] + (Math.random() - 0.5) * 1.6, m.y + 1.2 + Math.random(), mid[1] + (Math.random() - 0.5) * 1.6, { size: 0.35, vx: (Math.random() - 0.5) * 2, vy: 2 });
        }
        return { pose: base(), hide: true };
      }
      const p = base();
      if (u < 7) {
        p.rig[5] = wave(m.T, 6) * 0.15;
        if (m.every(0.5)) m.fx.icon("star", m.x + Math.cos(m.T * 5) * 0.4, m.y + 2.5, m.z + Math.sin(m.T * 5) * 0.4, { size: 0.3, vy: 0 });
      } else if (u < 10) {
        p.armR = [-1.6, 0, 0.5];
        p.armL = [-1.6, 0, -0.5];
      }
      return { pose: p };
    },
    smoke(m) {
      const p = base(), k = toMouth(m.T, 5, m.seed * 5);
      p.armR = [lerp(-0.4, -2.1, k), 0, lerp(0.2, 0.4, k)];
      if (k < 0.1 && m.every(1.2)) m.fx.icon("puff", m.x, m.y + 2.3, m.z, { size: 0.35, vy: 0.6 });
      return { pose: p, R: "cig" };
    },
    puke(m) {
      const p = base();
      p.rig[3] = 0.75;
      p.armR = [-0.9, 0, 0.2];
      p.armL = [-0.9, 0, -0.2];
      if (m.every(0.08)) m.fx.block(Math.random() < 0.5 ? "#8BC34A" : "#B5D86A", m.x + Math.sin(m.h) * 1.1, m.y + 1.3, m.z + Math.cos(m.h) * 1.1, { vx: Math.sin(m.h) * 1.5, vz: Math.cos(m.h) * 1.5, vy: -0.5, size: 0.12, life: 0.6, max: 0.6 });
      return { pose: p };
    },
    smell(m) { const p = base(); p.rig[3] = 0.45; p.rig[1] = -0.2; p.legR = [-0.5, 0, 0]; p.legL = [-0.5, 0, 0]; if (m.every(2.5)) m.fx.icon("heart", m.x, m.y + 1.8, m.z, { size: 0.3 }); return { pose: p }; }
  };
  function discoPose(T, side) {
    const p = base(), s = (Math.sin(T * 2.2 * PI) + 1) / 2;
    p.armR = [lerp(-0.6, -2.8, s), 0, lerp(0.7, -0.4, s)];
    p.armL = [-0.3, 0, 0.9];
    if (side < 0) { const r = p.armR; p.armR = [-0.3, 0, -0.9]; p.armL = [r[0], 0, -r[2]]; }
    p.rig[5] = (s - 0.5) * 0.16;
    p.rig[1] = Math.abs(Math.sin(T * 4.4 * PI)) * 0.05;
    p.legR = [0, 0, -0.25 * side];
    p.head = [0, 0, (s - 0.5) * 0.2];
    return p;
  }
  function bouncePose(T) {
    const p = base();
    p.armR = [-2.9 + Math.sin(T * 8) * 0.3, 0, -0.2];
    p.armL = [-2.9 + Math.sin(T * 8 + PI) * 0.3, 0, 0.2];
    p.rig[1] = Math.abs(Math.sin(T * 4)) * 0.25;
    return p;
  }

  function create(ctx) {
    const { T, scene, OX, OZ } = ctx;
    const fx = makeFx(T, scene, OX, OZ);
    const states = new WeakMap();
    const st = (a) => { let s = states.get(a); if (!s) { s = { bar: 0, barAt: 0 }; states.set(a, s); } return s; };
    let lastDrop = null;
    const scenes = [];
    const env = {
      t: 0,
      actors: [],
      heightAt: ctx.heightAt,
      nearestWater: ctx.nearestWater,
      get night() { return ctx.isNight(); },
      get lastDrop() { return lastDrop; },
      drunk(a) { const s = st(a); return Math.max(0, s.bar - Math.floor((env.t - s.barAt) / 150)); },
      scene(room, count) { scenes.push({ room, count }); },
      brawlLead(mid) { let best = null, bd = Infinity; env.actors.forEach((a) => { const d = Math.hypot(a.x - mid[0], a.z - mid[1]); if (d < bd) { bd = d; best = a; } }); return best; }
    };
    function stop(a, s) {
      a.av.hold("R", null);
      a.av.hold("L", null);
      a.av.hold("head", null);
      a.av.root.visible = true;
      a.hiddenAct = false;
      if (s.act === "scene") s.shameUntil = env.t + 25;
      if (s.act === "snus") s.buzzUntil = env.t + 30;
      s.act = null;
      s.vx = undefined;
    }
    function walkingExtras(a, s, dt) {
      const lv = env.drunk(a);
      const shame = s.shameUntil > env.t;
      // fresh out of the bathroom after snus: running faster with both hands in the air
      const buzz = s.buzzUntil > env.t;
      a.speedMul = buzz ? 1.6 : 1;
      if (buzz) {
        a.av.parts.armR.rotation.set(-2.9 + Math.sin(env.t * 14) * 0.25, 0, -0.35);
        a.av.parts.armL.rotation.set(-2.9 - Math.sin(env.t * 14) * 0.25, 0, 0.35);
        if (Math.random() < dt * 1.5) fx.icon(Math.random() < 0.5 ? "star" : "bang", a.x, a.y + 2.8, a.z, { size: 0.3 });
      }
      a.av.hold("L", shame ? "shoes" : null);
      a.av.hold("head", shame ? "messy" : null);
      if (lv >= 2 && a.look && a.look.cheeky) {
        a.av.rig.rotation.z = Math.sin(env.t * 3.2) * 0.06 * lv;
        if (Math.random() < dt * 0.8) fx.icon("bubble", a.x, a.y + 2.5, a.z, { size: 0.25 });
      }
    }
    return {
      fx,
      actOf(a) { const s = states.get(a); return s ? s.act : null; },
      update(dt, actors, nowMs) {
        const t = nowMs / 1000;
        env.t = t;
        env.actors = actors;
        env.danceCount = 0;
        scenes.length = 0;
        const groups = new Map();
        actors.forEach((a) => {
          const s = st(a);
          if (a.drop > 0) {
            if (!s.dropping) { s.dropping = true; s.bar = 0; s.shameUntil = 0; s.buzzUntil = 0; s.tache = false; a.av.moustache(false); lastDrop = { x: a.x, z: a.z, t }; }
          } else s.dropping = false;
          s.on = false;
          if (a.drop > 0 || a.idleT < 0.35) return;
          const area = AREAS.find((ar) => (ar.rect ? inRect(a.x, a.z, ar.rect) : ar.test(a, env)));
          if (!groups.has(area.id)) groups.set(area.id, { area, members: [] });
          groups.get(area.id).members.push(a);
        });
        groups.forEach(({ area, members }) => {
          members.sort((p, q) => (p.key < q.key ? -1 : p.key > q.key ? 1 : 0));
          const plan = area.plan(members, env, area);
          members.forEach((a, i) => run(a, plan[i] || { act: "idle" }, area, dt));
        });
        actors.forEach((a) => {
          const s = st(a);
          if (!s.on && s.act) stop(a, s);
          if (!s.on && a.moving) walkingExtras(a, s, dt);
        });
        scenes.forEach(({ room, count }) => {
          const [bx, bz] = room.beds[0];
          if (Math.random() < dt * (1.5 + count)) fx.icon("heart", bx + (Math.random() - 0.5) * 1.5, 3.4, bz + (Math.random() - 0.5) * 1.5, { overlay: true, vy: 1.3, life: 1.8, max: 1.8, size: 0.4 + count * 0.05 });
          if (Math.random() < dt * 0.4 * count) {
            const [wx, wz, dx, dz] = room.win;
            fx.arc(["#FEFE40", "#006AA7", "#FF6FB5", "#FFFFFF", "#23252B"][Math.floor(Math.random() * 5)], [wx, 4.2, wz], [wx + dx * 3 + (Math.random() - 0.5) * 3, 1.05, wz + dz * 3], 0.9, 1.4, 0.3);
          }
          fx.keep("dnd" + room.door.join(), "dnd", room.door[0], 4.3, room.door[1], 0.4);
          fx.keep("sock" + room.door.join(), "sock", room.door[0] + 0.5, 3.6, room.door[1], 0.35);
        });
        if (ctx.onDance) ctx.onDance(env.danceCount);
        if (ctx.onScenes) ctx.onScenes(scenes.map((sc) => BEDROOMS.indexOf(sc.room)));
        fx.update(dt);
      }
    };
    function run(a, asg, area, dt) {
      const s = st(a);
      s.on = true;
      if (s.act !== asg.act || s.area !== area.id) {
        if (s.act) stop(a, s);
        s.act = asg.act;
        s.area = area.id;
        s.t0 = env.t;
        s.fxAt = {};
        if (area.id === "bar") { s.bar += 1; s.barAt = env.t; }
      }
      if (s.vx === undefined) { s.vx = a.x; s.vz = a.z; s.h = a.heading; }
      const tx = asg.spot ? asg.spot[0] : a.x, tz = asg.spot ? asg.spot[1] : a.z;
      const k = Math.min(1, dt * 6);
      s.vx += (tx - s.vx) * k;
      s.vz += (tz - s.vz) * k;
      let h = asg.heading;
      if (h === undefined && asg.face) h = angleTo(s.vx, s.vz, asg.face[0], asg.face[1]);
      if (h !== undefined) s.h += Math.atan2(Math.sin(h - s.h), Math.cos(h - s.h)) * Math.min(1, dt * 8);
      else s.h = a.heading;
      const m = {
        a, s, asg, env, dt, fx,
        T: env.t, t: env.t - s.t0,
        seed: hashStr(a.key),
        x: s.vx, y: a.y, z: s.vz, h: s.h,
        offset: null,
        every(period) {
          const key = period;
          const next = s.fxAt[key] || 0;
          if (env.t >= next) { s.fxAt[key] = env.t + period * (0.8 + Math.random() * 0.4); return next !== 0 || Math.random() < 0.5; }
          return false;
        }
      };
      const out = (ACTS[asg.act] || ACTS.idle)(m) || {};
      a.av.hold("R", out.R || null);
      a.av.hold("L", out.L || null);
      a.av.hold("head", out.head || out.headL || null);
      if (out.skinny && Math.random() < dt * 0.6) fx.icon("blush", m.x, a.y + 2.6, m.z, { size: 0.35 });
      const off = m.offset || [0, 0, 0];
      a.av.root.position.set(s.vx + off[0] + OX, a.y + off[2], s.vz + off[1] + OZ);
      a.av.root.rotation.y = s.h;
      apply(a.av, out.pose || base());
      a.av.root.visible = !out.hide;
      a.hiddenAct = !!out.hide;
    }
  }

  window.FefeActions = { create };
})();
