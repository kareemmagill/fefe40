/* FiFi4000 arranger: everyone who signed up, plus the cars, tank, seaplane, teddy bear and band, on a stage to arrange
   for a print (a T-shirt). Not part of the game: open arrange.html. Tap someone to pose them, drag to move them, drag
   the empty stage to turn the view, scroll or pinch to zoom; Save PNG draws it big on a see-through background. The
   arrangement is kept in this browser. The builders for the vehicles and the bear are the game's own (app.js). */
(function () {
  const T = THREE;
  const DB_URL = "https://fefe40-a3dae-default-rtdb.asia-southeast1.firebasedatabase.app";

    // ---------- the game's builders (copied from app.js) ----------
    const hash01 = (n) => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
    const C = { blue: "#006AA7", yellow: "#FECC02", red: "#E23D3D", bulb: "#FFE58A", car: ["#E23D3D", "#F4F4F4", "#2F6FD1", "#FECC02", "#23252B"], glassCar: "#27435E", tire: "#1E1F22", chrome: "#D6DADF" };
    const glow = { kind: "glow", j: false };
    const carMats = {};
    const carMat = (c, kind) => carMats[c + kind] || (carMats[c + kind] = kind === "glow" ? new T.MeshBasicMaterial({ color: c })
      : new T.MeshLambertMaterial({ color: c, transparent: kind === "clear", opacity: kind === "clear" ? 0.5 : 1 }));
    const carBox = new T.BoxGeometry(1, 1, 1);
    // Boxes that never move against each other, as one mesh with the colours in its vertices: one draw call (and one
    // shadow) instead of one each. boxes: [centre x, y, z, width, height, depth, colour]
    const vcMats = {};
    const vcMat = (kind, map) => vcMats[kind + (map ? "m" : "")] || (vcMats[kind + (map ? "m" : "")] = kind === "glow" ? new T.MeshBasicMaterial({ vertexColors: true }) : new T.MeshLambertMaterial({ vertexColors: true, map: map || null }));
    function mergedBoxes(boxes, mat) {
      const bp = carBox.attributes.position.array, bn = carBox.attributes.normal.array, bu = carBox.attributes.uv.array, bi = carBox.index.array, nv = bp.length / 3;
      const pos = new Float32Array(boxes.length * nv * 3), nor = new Float32Array(pos.length), col = new Float32Array(pos.length), uv = new Float32Array(boxes.length * nv * 2);
      const idx = new (boxes.length * nv > 65535 ? Uint32Array : Uint16Array)(boxes.length * bi.length), c = new T.Color();
      boxes.forEach(([x, y, z, w, h, d, color], k) => {
        c.set(color);
        for (let i = 0; i < nv; i++) {
          const o = (k * nv + i) * 3;
          pos[o] = bp[i * 3] * w + x; pos[o + 1] = bp[i * 3 + 1] * h + y; pos[o + 2] = bp[i * 3 + 2] * d + z;
          nor[o] = bn[i * 3]; nor[o + 1] = bn[i * 3 + 1]; nor[o + 2] = bn[i * 3 + 2];
          col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
          uv[(k * nv + i) * 2] = bu[i * 2]; uv[(k * nv + i) * 2 + 1] = bu[i * 2 + 1];
        }
        for (let i = 0; i < bi.length; i++) idx[k * bi.length + i] = bi[i] + k * nv;
      });
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(pos, 3));
      geo.setAttribute("normal", new T.BufferAttribute(nor, 3));
      geo.setAttribute("color", new T.BufferAttribute(col, 3));
      geo.setAttribute("uv", new T.BufferAttribute(uv, 2));
      geo.setIndex(new T.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      const m = new T.Mesh(geo, mat);
      m.castShadow = !mat.isMeshBasicMaterial;
      return m;
    }
    const CAR_SPECS = [];
    function carParts(x, z, w, l, color) {
      const spec = { x: x + w / 2, z: z + l / 2, w, l, color, parts: [] };
      CAR_SPECS.push(spec);
      return (bx, by, bz, bw, bh, bd, c, o) => spec.parts.push([bx - spec.x, by - 1, bz - spec.z, bw, bh, bd, c, (o && o.kind) || "solid"]);
    }
    function car(x, z, color) {
      const box = carParts(x, z, 2, 4, color);
      box(x + 0.15, 1.25, z + 0.1, 1.7, 0.75, 3.8, color);
      box(x + 0.25, 2.0, z + 1.0, 1.5, 0.6, 1.9, C.glassCar, { kind: "clear", j: false });
      box(x + 0.25, 2.6, z + 1.0, 1.5, 0.1, 1.9, color);
      [[x + 0.05, z + 0.5], [x + 1.65, z + 0.5], [x + 0.05, z + 2.8], [x + 1.65, z + 2.8]].forEach(([px, pz]) => box(px, 1, pz, 0.3, 0.55, 0.7, C.tire));
      box(x + 0.3, 1.55, z + 3.88, 0.35, 0.2, 0.05, C.bulb, glow);
      box(x + 1.35, 1.55, z + 3.88, 0.35, 0.2, 0.05, C.bulb, glow);
    }
    // the German flag: black, red and gold bands, top to bottom
    const DE = ["#151515", "#DD0000", "#FFCE00"];
    // The tank (the game's): tracks, hull, a turret with a German flag, a long gun
    function tank(x, z) {
      const box = carParts(x, z, 2.4, 4.4, "#4B5B2E"), G = "#4B5B2E", G2 = "#5C6E38", DK = "#2E3820", TR = "#23252B";
      CAR_SPECS[CAR_SPECS.length - 1].tank = true;
      box(x, 1, z, 0.62, 0.72, 4.4, TR);
      box(x + 1.78, 1, z, 0.62, 0.72, 4.4, TR);
      for (let i = 0; i < 8; i++) { box(x - 0.02, 1.08, z + 0.2 + i * 0.52, 0.04, 0.5, 0.3, "#3A3D44"); box(x + 2.38, 1.08, z + 0.2 + i * 0.52, 0.04, 0.5, 0.3, "#3A3D44"); }
      box(x + 0.45, 1.25, z + 0.15, 1.5, 0.62, 4.1, G);
      box(x + 0.5, 1.6, z + 3.9, 1.4, 0.2, 0.4, G2);
      box(x + 0.6, 1.87, z + 1.3, 1.2, 0.58, 1.6, G2);
      box(x + 1.1, 2.06, z + 2.9, 0.2, 0.2, 2.3, DK);
      box(x + 1.05, 2.01, z + 5.1, 0.3, 0.3, 0.2, DK);
      box(x + 0.85, 2.45, z + 1.55, 0.7, 0.08, 0.7, DK);
      [x + 0.58, x + 1.8].forEach((sx) => DE.forEach((c, i) => box(sx, 2.3 - i * 0.11, z + 1.7, 0.04, 0.11, 0.6, c)));
    }
    function jeepney(x, z) {
      const box = carParts(x, z, 2, 6, C.chrome);
      box(x + 0.15, 1.25, z + 0.1, 1.7, 1.45, 5.0, C.chrome);
      box(x + 0.2, 1.25, z + 5.1, 1.6, 0.8, 0.8, C.chrome);
      box(x + 0.12, 1.95, z + 0.3, 1.76, 0.4, 4.6, C.glassCar, { kind: "clear", j: false });
      box(x + 0.1, 1.45, z + 0.2, 1.8, 0.14, 4.8, C.red);
      box(x + 0.1, 1.65, z + 0.2, 1.8, 0.1, 4.8, C.yellow);
      box(x + 0.05, 2.7, z + 0.05, 1.9, 0.15, 5.2, C.blue);
      box(x + 0.85, 2.05, z + 5.75, 0.3, 0.45, 0.1, C.chrome);
      [[x + 0.05, z + 0.6], [x + 1.65, z + 0.6], [x + 0.05, z + 4.4], [x + 1.65, z + 4.4]].forEach(([px, pz]) => box(px, 1, pz, 0.3, 0.55, 0.7, C.tire));
      box(x + 0.3, 1.6, z + 5.88, 0.3, 0.2, 0.05, C.bulb, glow);
      box(x + 1.4, 1.6, z + 5.88, 0.3, 0.2, 0.05, C.bulb, glow);
    }
    function buildPlane() {
      const g = new T.Group(), boxes = [];
      const part = (x, y, z, w, h, d, color) => { boxes.push([x, y, z, w, h, d, color]); };
      // +z is the nose, y = 0 is where the floats touch the water. The Red Baron's red Fokker triplane, on floats.
      const RED = "#B5121B", DARK = "#7E0C12", WOOD = "#8A5A2B", STRUT = "#4A3324";
      part(0, 0.95, 0.6, 0.82, 0.8, 1.7, RED); // fuselage
      part(0, 0.95, -0.85, 0.6, 0.6, 1.3, RED); // tapering to the tail
      part(0, 0.95, 1.55, 0.86, 0.84, 0.22, DARK); // engine cowling
      part(0, 0.95, 1.67, 0.5, 0.5, 0.04, "#2A2D33"); // its open front
      part(0, 1.37, 0.28, 0.6, 0.06, 0.5, "#2A2D33"); // the open cockpit
      [-0.13, 0.13].forEach((x) => part(x, 1.43, 0.85, 0.07, 0.07, 0.6, "#1E1F22")); // twin guns
      [[0.6, 3.4], [1.33, 3.9], [2.02, 4.5]].forEach(([y, span]) => part(0, y, 1.0, span, 0.08, 0.62, RED)); // three wings
      [-1.55, 1.55].forEach((x) => part(x, 1.31, 1.0, 0.06, 1.42, 0.06, STRUT)); // the struts between them
      [-0.28, 0.28].forEach((x) => part(x, 1.68, 1.0, 0.05, 0.62, 0.05, STRUT));
      [-1.65, 1.65].forEach((x) => DE.forEach((c, i) => part(x, 2.07, 1.21 - i * 0.2, 0.62, 0.02, 0.2, c))); // German flags on the top wing
      part(0, 1.05, -1.38, 1.5, 0.06, 0.48, RED); // tailplane
      DE.forEach((c, i) => part(0, 1.69 - i * 0.2, -1.4, 0.08, 0.2, 0.56, c)); // the rudder: a German flag
      [-0.75, 0.75].forEach((x) => { // floats, and the struts holding them
        part(x, 0.1, 0.35, 0.34, 0.28, 2.6, DARK);
        part(x, 0.12, 1.6, 0.26, 0.2, 0.2, RED);
        part(x * 0.85, 0.37, 1.0, 0.05, 0.42, 0.05, STRUT);
        part(x * 0.85, 0.37, 0.0, 0.05, 0.42, 0.05, STRUT);
      });
      g.add(mergedBoxes(boxes, vcMat("solid")));
      const prop = new T.Mesh(carBox, carMat(WOOD, "solid"));
      prop.scale.set(1.6, 0.14, 0.05);
      prop.position.set(0, 0.95, 1.73);
      prop.castShadow = true;
      g.add(prop);
      return { g, prop };
    }
    const furTex = (() => { // a speckled fur, tinted per colour by the material
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      const g = c.getContext("2d");
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = 205 + Math.floor(hash01(x * 31 + y * 17) * 50);
        g.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
        g.fillRect(x, y, 1, 1);
      }
      const t = new T.CanvasTexture(c);
      t.magFilter = T.NearestFilter;
      t.minFilter = T.NearestFilter;
      return t;
    })();
    function buildBear() {
      const FUR = "#A8693B", LIGHT = "#EBC594", DARK = "#2B1D14", PINK = "#FF6FB5";
      const grp = (parent, x, y, z) => { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; };
      const pending = new Map(); // part -> { fur: [], plain: [] }, merged at the end
      const blk = (parent, x, y, z, w, h, d, col, plain) => {
        if (!pending.has(parent)) pending.set(parent, { fur: [], plain: [] });
        pending.get(parent)[plain ? "plain" : "fur"].push([x, y, z, w, h, d, col]);
      };
      // a box with its edges rounded off: three overlapping boxes
      const round = (parent, x, y, z, w, h, d, col, r) => {
        r = r || Math.min(w, h, d) * 0.18;
        blk(parent, x, y, z, w - 2 * r, h, d - 2 * r, col);
        blk(parent, x, y, z, w, h - 2 * r, d - 2 * r, col);
        blk(parent, x, y, z, w - 2 * r, h - 2 * r, d, col);
      };
      const g = new T.Group();
      const hip = grp(g, 0, 3.2, 0);
      round(hip, 0, 2.5, 0, 5.4, 5.2, 4.4, FUR); // body
      round(hip, 0, 2.2, 1.9, 3.8, 3.8, 1.0, LIGHT, 0.5); // tummy
      blk(hip, -0.35, 2.6, 2.42, 0.6, 0.5, 0.06, PINK, true); // a little heart on it
      blk(hip, 0.35, 2.6, 2.42, 0.6, 0.5, 0.06, PINK, true);
      blk(hip, 0, 2.25, 2.42, 0.7, 0.5, 0.06, PINK, true);
      blk(hip, 0, 4.85, 2.3, 0.9, 0.9, 0.5, PINK, true); // a bow at the neck
      [-1, 1].forEach((s) => { blk(hip, s * 1.0, 4.85, 2.25, 1.3, 1.2, 0.4, PINK, true); blk(hip, s * 0.45, 4.15, 2.27, 0.4, 0.9, 0.3, PINK, true); });
      const legs = [-1, 1].map((s) => {
        const leg = grp(g, s * 1.5, 3.2, 0);
        round(leg, 0, -1.5, 0, 2.3, 3.1, 2.5, FUR);
        round(leg, 0, -2.85, 0.45, 2.4, 0.7, 3.1, FUR, 0.25); // foot
        blk(leg, 0, -2.75, 2.02, 1.5, 0.7, 0.06, LIGHT); // the paw pad
        return leg;
      });
      const arms = [-1, 1].map((s) => {
        const arm = grp(hip, s * 3.1, 4.2, 0);
        round(arm, s * 0.1, -1.9, 0, 1.8, 4.2, 1.9, FUR);
        blk(arm, s * 0.1, -3.55, 0.97, 1.1, 0.9, 0.06, LIGHT);
        arm.rotation.z = s * 0.22;
        return arm;
      });
      const head = grp(hip, 0, 5.2, 0);
      round(head, 0, 2.2, 0.1, 5.6, 4.6, 4.8, FUR);
      round(head, 0, 1.25, 2.6, 2.5, 1.8, 1.3, LIGHT, 0.3); // muzzle
      blk(head, 0, 1.75, 3.27, 0.95, 0.6, 0.12, DARK, true); // nose
      blk(head, 0, 1.05, 3.27, 0.14, 0.55, 0.08, DARK, true); // mouth
      blk(head, -0.35, 0.8, 3.26, 0.6, 0.14, 0.08, DARK, true);
      blk(head, 0.35, 0.8, 3.26, 0.6, 0.14, 0.08, DARK, true);
      [-1, 1].forEach((s) => {
        blk(head, s * 1.2, 2.85, 2.53, 0.62, 0.78, 0.12, DARK, true); // eyes, with a glint
        blk(head, s * 1.2 - 0.12, 3.05, 2.6, 0.2, 0.2, 0.04, "#FFFFFF", true);
        blk(head, s * 1.95, 1.55, 2.52, 0.85, 0.42, 0.06, "#F28CA8", true); // blushing cheeks
        round(head, s * 2.35, 4.55, 0, 1.8, 1.8, 1.1, FUR, 0.3); // ears
        blk(head, s * 2.35, 4.5, 0.57, 1.0, 1.0, 0.06, LIGHT);
      });
      pending.forEach((l, parent) => {
        if (l.fur.length) parent.add(mergedBoxes(l.fur, vcMat("solid", furTex)));
        if (l.plain.length) parent.add(mergedBoxes(l.plain, vcMat("solid")));
      });
      return { g, hip, head, legs, arms };
    }
    const BAND = [
      { kit: "flag", s: 0, side: 0, look: { body: "f", outfit: FefeAvatar.dirndl("#1C1C1C", "#B3202A", "#F2C230"), skin: "#F0C8A8", hair: "#D9B060", h: 168 } },
      { kit: "trumpet", s: 1.7, side: -0.55, look: { body: "m", outfit: FefeAvatar.lederhosen("#C8302C"), skin: "#E8C4A0", hair: "#6B4A2E" } },
      { kit: "trumpet", s: 1.7, side: 0.55, look: { body: "m", outfit: FefeAvatar.lederhosen("#2F6FB5"), skin: "#D9A57E", hair: "#2B1B12" } },
      { kit: "accordion", s: 3.4, side: -0.55, look: { body: "f", outfit: FefeAvatar.dirndl("#2F5233", "#1F3C66", "#9FC5E8"), skin: "#E8C4A0", hair: "#7A4A22" } },
      { kit: "tuba", s: 3.4, side: 0.55, look: { body: "m", outfit: FefeAvatar.lederhosen("#3E8E41"), skin: "#E8C4A0", hair: "#B5651D", wt: 112 } },
      { kit: "drum", s: 5.1, side: -0.55, look: { body: "m", outfit: FefeAvatar.lederhosen("#C8302C"), skin: "#B97A56", hair: "#1A1A1A", wt: 95 } },
      { kit: "beer", s: 5.1, side: 0.55, look: { body: "f", outfit: FefeAvatar.dirndl("#B3202A", "#2B2B2B", "#F4F4F0"), skin: "#F0C8A8", hair: "#E3C16F" } }
    ];
    const KIT = { flag: { R: "deflag" }, trumpet: { head: "trumpet" }, accordion: { body: "accordion" }, tuba: { body: "tuba" }, drum: { body: "bassdrum", R: "mallet" }, beer: { body: "steins" } };

    // ---------- the stage ----------
    const canvas = document.getElementById("view");
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xffffff, 0x8a7a6a, 0.95));
    scene.add(new T.AmbientLight(0xffffff, 0.25));
    const key = new T.DirectionalLight(0xffffff, 0.55);
    key.position.set(6, 14, 16);
    scene.add(key);
    const grid = new T.GridHelper(120, 120, 0x4a6d9c, 0x2a3f5c);
    scene.add(grid);
    const ring = new T.Mesh(new T.RingGeometry(0.75, 0.95, 40), new T.MeshBasicMaterial({ color: 0xfefe40, side: T.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 10;
    ring.visible = false;
    scene.add(ring);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    const view = { az: 0, el: 0.22, size: 9, target: new T.Vector3(0, 2, 0) };
    function applyCam() {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, a = w / h, d = 120;
      Object.assign(cam, { left: -view.size * a, right: view.size * a, top: view.size, bottom: -view.size });
      cam.position.set(view.target.x + Math.sin(view.az) * Math.cos(view.el) * d, view.target.y + Math.sin(view.el) * d, view.target.z + Math.cos(view.az) * Math.cos(view.el) * d);
      cam.lookAt(view.target);
      cam.updateProjectionMatrix();
    }
    function resize() {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      applyCam();
    }
    window.addEventListener("resize", resize);

    // ---------- what can be on it ----------
    const isBirthdayBoy = (name) => /^(f|ph)(i|ee|e|ie|y|ea)(f|ph)(i|ee|e|ie|y|ea)$/.test(String(name || "").toLowerCase().replace(/[^a-z]/g, ""));
    const THINGS = {
      car0: { label: "Red car", make: () => carModel(0) }, car1: { label: "White car", make: () => carModel(1) }, car2: { label: "Blue car", make: () => carModel(2) },
      car3: { label: "Yellow car", make: () => carModel(4) }, car4: { label: "Black car", make: () => carModel(5) }, jeepney: { label: "Jeepney", make: () => carModel(3) },
      tank: { label: "Tank", make: () => carModel(6) }, plane: { label: "Seaplane", make: () => buildPlane().g }, bear: { label: "Teddy bear", make: () => bearModel() }
    };
    BAND.forEach((m, i) => { THINGS["band" + i] = { label: ["Flag singer", "Trumpet", "Trumpet", "Accordion", "Tuba", "Big drum", "Beer maid"][i], band: i }; });
    // the cars, as the game parks them: the specs come out of the same builders
    car(3, 41, C.car[0]); car(7, 41, C.car[1]); car(11, 41, C.car[2]); jeepney(3, 48); car(8, 49, C.car[3]); car(12, 49, C.car[4]); tank(13.8, 44.3);
    function carModel(i) {
      const sp = CAR_SPECS[i], g = new T.Group(), lists = { solid: [], glow: [] };
      sp.parts.forEach(([x, y, z, w, h, d, color, kind]) => {
        if (kind === "clear") {
          const m = new T.Mesh(carBox, carMat(color, kind));
          m.scale.set(w, h, d);
          m.position.set(x + w / 2, y + h / 2, z + d / 2);
          g.add(m);
          return;
        }
        lists[kind === "glow" ? "glow" : "solid"].push([x + w / 2, y + h / 2, z + d / 2, w, h, d, color]);
      });
      Object.keys(lists).forEach((k) => { if (lists[k].length) g.add(mergedBoxes(lists[k], vcMat(k))); });
      g.userData.seat = sp.tank ? { x: 0, y: 0.62, z: -0.05, stand: true } : { x: -0.42, y: 0, z: sp.l > 5 ? 1.6 : 0.2 };
      return g;
    }
    function bearModel() {
      const b = buildBear();
      b.g.userData.bear = b;
      return b.g;
    }

    // ---------- poses ----------
    const PEOPLE_POSES = [["stand", "Stand"], ["wave", "Wave"], ["waveL", "Wave left"], ["cheer", "Cheer"], ["disco", "Disco"], ["dance", "Dance"], ["sit", "Sit"]];
    const BEAR_POSES = [["stand", "Stand"], ["wave", "Wave"], ["cheer", "Cheer"], ["disco", "Disco"], ["floss", "Floss"]];
    function posePerson(av, pose, seated) {
      const P = av.parts;
      av.setPose(pose === "dance" ? 1.1 : 0, pose === "dance");
      if (pose === "wave") P.armR.rotation.set(-2.75, 0, -0.35);
      else if (pose === "waveL") P.armL.rotation.set(-2.75, 0, 0.35);
      else if (pose === "cheer") { P.armR.rotation.set(-2.9, 0, -0.45); P.armL.rotation.set(-2.9, 0, 0.45); }
      else if (pose === "disco") { P.armR.rotation.set(-2.75, 0, -0.55); P.armL.rotation.set(-0.35, 0, 1.1); av.rig.rotation.z = -0.12; P.legR.rotation.z = -0.18; P.head.rotation.z = 0.15; }
      else if (pose === "dance") { P.armR.rotation.set(-1.9, 0, -0.7); P.armL.rotation.set(-0.5, 0, 0.8); av.rig.rotation.z = 0.08; }
      if (seated === "sit" || (pose === "sit" && seated !== "stand")) { // sitting: in a seat, on the bear, or on the ground
        av.rig.position.y = 0.42 - 0.825 * (av.scale || 1);
        P.legR.rotation.set(-Math.PI / 2, 0, 0.05);
        P.legL.rotation.set(-Math.PI / 2, 0, -0.05);
        if (pose === "sit" || pose === "stand") { P.armR.rotation.set(-1.25, 0, 0.25); P.armL.rotation.set(-1.25, 0, -0.25); }
      }
    }
    function poseBear(b, pose) {
      const [lL, lR] = [b.legs[1], b.legs[0]], [aL, aR] = [b.arms[1], b.arms[0]];
      [lL, lR, b.head, b.hip].forEach((o) => o.rotation.set(0, 0, 0));
      aL.rotation.set(0, 0, 0.22); aR.rotation.set(0, 0, -0.22);
      if (pose === "wave") { aR.rotation.set(-2.7, 0, -0.6); aL.rotation.set(-2.7, 0, 0.1); b.hip.rotation.z = 0.08; b.head.rotation.z = 0.1; }
      else if (pose === "cheer") { aL.rotation.set(-2.6, 0, 0.5); aR.rotation.set(-2.6, 0, -0.5); }
      else if (pose === "disco") { aR.rotation.set(-2.75, 0, -0.55); aL.rotation.set(-0.35, 0, 1.1); b.hip.rotation.z = -0.12; b.head.rotation.z = 0.15; lR.rotation.z = -0.18; }
      else if (pose === "floss") { aL.rotation.set(0.35, 0, 1.0); aR.rotation.set(-0.35, 0, 0.4); b.hip.rotation.z = -0.14; }
    }

    // ---------- items on the stage ----------
    const items = [];
    let selected = null, seating = null, guests = new Map(), nextId = 1;
    const leftOut = new Set(); // guests not to include: they stay off the stage until they're ticked again
    function addItem(kind, ref, at) {
      const holder = new T.Group();
      let model, av = null, bear = null;
      if (kind === "guest") { av = FefeAvatar.build(T, guests.get(ref).look); model = av.root; }
      else if (THINGS[kind] && THINGS[kind].band !== undefined) {
        const m = BAND[THINGS[kind].band];
        av = FefeAvatar.build(T, m.look);
        Object.entries(KIT[m.kit]).forEach(([slot, k]) => av.hold(slot, k));
        model = av.root;
      } else { model = THINGS[kind].make(); bear = model.userData.bear || null; }
      holder.add(model);
      const it = Object.assign({ id: nextId++, kind, ref, holder, model, av, bear, x: 0, y: 0, z: 0, rot: 0, scale: 1, pose: av ? "wave" : "stand", seat: null }, at || {});
      holder.userData.item = it;
      scene.add(holder);
      items.push(it);
      place(it);
      return it;
    }
    function removeItem(it, keep) {
      if (it.kind === "guest" && !keep) leftOut.add(it.ref);
      items.filter((o) => o.seat === it.id).forEach((o) => { o.seat = null; place(o); });
      if (it.holder.parent) it.holder.parent.remove(it.holder);
      if (it.av) it.av.dispose();
      items.splice(items.indexOf(it), 1);
      if (selected === it) select(null);
      save();
    }
    // a new thing goes beside everything already on the stage (the vehicles side-on, so their shape shows)
    const WIDTH = { bear: 6.5, plane: 5, tank: 4.6, jeepney: 6, car0: 4, car1: 4, car2: 4, car3: 4, car4: 4 };
    function spotBeside(kind) {
      let right = -Infinity;
      items.forEach((it) => { if (!it.seat) { const b = new T.Box3().setFromObject(it.holder); if (!b.isEmpty()) right = Math.max(right, b.max.x); } });
      const w = WIDTH[kind] || 1.2, x = (right === -Infinity ? 0 : right + 0.8) + w / 2;
      return { x, z: 0, rot: kind === "bear" || !WIDTH[kind] ? 0 : Math.PI / 2 };
    }
    // where an item is drawn: free on the stage, or in a seat (a car's, the tank's hatch, the plane's cockpit, the bear's head)
    function place(it) {
      const host = it.seat ? items.find((o) => o.id === it.seat) : null;
      if (it.seat && !host) it.seat = null;
      if (host) {
        let parent = host.holder, s = { x: 0, y: 0, z: 0 }, how = "sit";
        if (host.bear) { parent = host.bear.head; s = { x: 0, y: 4.65, z: -0.3 }; }
        else if (host.kind === "plane") s = { x: 0, y: 0.45, z: 0.25 };
        else if (host.model.userData.seat) { s = host.model.userData.seat; if (s.stand) how = "stand"; }
        if (it.holder.parent !== parent) parent.add(it.holder);
        it.holder.position.set(s.x, s.y, s.z);
        it.holder.rotation.set(0, 0, 0);
        it.holder.scale.setScalar(1);
        if (it.av) posePerson(it.av, it.pose, how);
        return;
      }
      if (it.holder.parent !== scene) scene.add(it.holder);
      it.holder.position.set(it.x, it.y, it.z);
      it.holder.rotation.set(0, it.rot, 0);
      it.holder.scale.setScalar(it.scale);
      if (it.av) posePerson(it.av, it.pose);
      if (it.bear) poseBear(it.bear, it.pose);
    }

    // ---------- the panels ----------
    const $ = (id) => document.getElementById(id);
    const statusEl = $("status"), addEl = $("add"), selEl = $("sel");
    function select(it) {
      selected = it;
      ring.visible = !!it;
      selEl.hidden = !it;
      if (!it) return;
      $("sel-name").textContent = it.kind === "guest" ? guests.get(it.ref).name : THINGS[it.kind].label;
      const poses = it.av ? PEOPLE_POSES : it.bear ? BEAR_POSES : [];
      $("sel-poses").innerHTML = poses.map(([k, l]) => '<button type="button" data-pose="' + k + '"' + (k === it.pose ? ' class="on"' : "") + ">" + l + "</button>").join("");
      $("sel-seat").hidden = !it.av;
      $("sel-seat").textContent = it.seat ? "Get out" : "Put in a seat…";
      ["sel-move"].forEach((id) => { $(id).hidden = !!it.seat; });
    }
    $("sel-poses").addEventListener("click", (e) => {
      const p = e.target.dataset && e.target.dataset.pose;
      if (!p || !selected) return;
      selected.pose = p;
      place(selected);
      select(selected);
      save();
    });
    $("sel-seat").addEventListener("click", () => {
      if (!selected) return;
      if (selected.seat) { const host = items.find((o) => o.id === selected.seat); selected.seat = null; if (host) { selected.x = host.x + 2; selected.z = host.z + 1; } place(selected); select(selected); save(); return; }
      seating = selected;
      statusEl.textContent = "Now tap a car, the tank, the plane or the teddy bear";
    });
    const nudge = { "sel-left": ["rot", Math.PI / 12], "sel-right": ["rot", -Math.PI / 12], "sel-bigger": ["scale", 1.1], "sel-smaller": ["scale", 1 / 1.1], "sel-up": ["y", 0.5], "sel-down": ["y", -0.5] };
    Object.keys(nudge).forEach((id) => $(id).addEventListener("click", () => {
      if (!selected || selected.seat) return;
      const [k, v] = nudge[id];
      if (k === "scale") selected.scale = Math.max(0.3, Math.min(6, selected.scale * v));
      else if (k === "y") selected.y = Math.max(0, selected.y + v);
      else selected[k] += v;
      place(selected);
      save();
    }));
    $("sel-remove").addEventListener("click", () => { if (selected) removeItem(selected); });
    $("add-btn").addEventListener("click", () => {
      addEl.hidden = !addEl.hidden;
      if (addEl.hidden) return;
      renderPeople();
      $("add-things").innerHTML = Object.keys(THINGS).map((k) => '<button type="button" data-thing="' + k + '">' + THINGS[k].label + "</button>").join("");
    });
    // everyone, ticked if they're in the picture: tap to leave someone out, or to bring them back
    function renderPeople() {
      const on = new Set(items.filter((i) => i.kind === "guest").map((i) => i.ref));
      $("add-count").textContent = on.size + " of " + guests.size + " in the picture";
      $("add-guests").innerHTML = [...guests.keys()].sort((a, b) => guests.get(a).name.localeCompare(guests.get(b).name))
        .map((id) => '<button type="button" data-guest="' + id + '"' + (on.has(id) ? ' class="on"' : "") + ">" + esc(guests.get(id).name) + "</button>").join("");
    }
    addEl.addEventListener("click", (e) => {
      const d = e.target.dataset || {};
      if (d.guest) {
        const it = items.find((i) => i.kind === "guest" && i.ref === d.guest);
        if (it) removeItem(it);
        else { leftOut.delete(d.guest); const t = view.target; addItem("guest", d.guest, { x: t.x + (Math.random() - 0.5) * 4, z: t.z + 4 }); }
        renderPeople();
        save();
        return;
      }
      if (d.all !== undefined) { // everyone in, or everyone out
        if (d.all === "1") { const on = new Set(items.filter((i) => i.kind === "guest").map((i) => i.ref)); [...guests.keys()].filter((id) => !on.has(id)).forEach((id, i) => { leftOut.delete(id); addItem("guest", id, { x: (i % 10 - 4.5) * 1.05, z: 4 + Math.floor(i / 10) * 1.3, pose: "wave" }); }); }
        else items.filter((i) => i.kind === "guest").forEach((i) => removeItem(i));
        renderPeople();
        save();
        return;
      }
      if (!d.thing) return;
      const it = addItem(d.thing, null, spotBeside(d.thing));
      addEl.hidden = true;
      select(it);
      save();
    });
    $("frame-btn").addEventListener("click", frameAll);
    $("reset-btn").addEventListener("click", () => { if (confirm("Start again from the group photo? (Anyone you left out stays out.)")) { [...items].forEach((i) => removeItem(i, true)); defaultLayout(); frameAll(); save(); } });
    $("save-btn").addEventListener("click", savePNG);
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

    // ---------- pointer: tap to pick, drag to move, drag the empty stage to turn the view, pinch or scroll to zoom ----------
    const ray = new T.Raycaster(), ndc = new T.Vector2(), pointers = new Map();
    let drag = null;
    function hitItem(e) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const hits = ray.intersectObjects(items.map((i) => i.holder), true);
      for (const h of hits) { let o = h.object; while (o && !(o.userData && o.userData.item)) o = o.parent; if (o) return o.userData.item; }
      return null;
    }
    function groundPoint(e, y) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const p = new T.Vector3();
      return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -y), p) ? p : null;
    }
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      addEl.hidden = true;
      if (pointers.size === 2) { drag = { pinch: true, d: dist2(), size: view.size }; return; }
      let it = hitItem(e);
      if (seating) {
        const host = it && (it.bear || it.kind === "plane" || it.model.userData.seat) ? it : null;
        if (host && host !== seating) { items.filter((o) => o.seat === host.id).forEach((o) => { o.seat = null; o.x = host.x + 2; place(o); }); seating.seat = host.id; place(seating); select(seating); save(); }
        seating = null;
        statusEl.textContent = "";
        drag = null;
        return;
      }
      if (it && it.seat) it = items.find((o) => o.id === it.seat) || it; // dragging someone in a seat moves what they sit in
      if (it) {
        select(it);
        const p = groundPoint(e, it.y);
        drag = p ? { it, dx: it.x - p.x, dz: it.z - p.z, moved: false } : null;
      } else drag = { orbit: true, x: e.clientX, y: e.clientY, az: view.az, el: view.el, moved: false };
    });
    const dist2 = () => { const p = [...pointers.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1; };
    canvas.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!drag) return;
      if (drag.pinch) { if (pointers.size === 2) { view.size = Math.max(2, Math.min(60, drag.size * drag.d / dist2())); applyCam(); } return; }
      if (drag.it) {
        const p = groundPoint(e, drag.it.y);
        if (!p) return;
        drag.it.x = p.x + drag.dx;
        drag.it.z = p.z + drag.dz;
        drag.moved = true;
        place(drag.it);
      } else if (drag.orbit) {
        view.az = drag.az - (e.clientX - drag.x) * 0.008;
        view.el = Math.max(-0.05, Math.min(1.35, drag.el + (e.clientY - drag.y) * 0.006));
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
        applyCam();
      }
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (drag && drag.orbit && !drag.moved) select(null); // a tap on the empty stage: nothing selected
      if (drag && drag.it && drag.moved) save();
      if (pointers.size === 0) drag = null;
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); view.size = Math.max(2, Math.min(60, view.size * Math.exp(e.deltaY * 0.001))); applyCam(); }, { passive: false });
    window.addEventListener("keydown", (e) => {
      if (!selected || selected.seat) return;
      const k = e.key.toLowerCase();
      if (k === "q") { selected.rot += Math.PI / 12; place(selected); save(); }
      else if (k === "e") { selected.rot -= Math.PI / 12; place(selected); save(); }
      else if (k === "delete" || k === "backspace") removeItem(selected);
    });

    // ---------- the group photo to start from, and fitting the view round everyone ----------
    function defaultLayout() {
      const list = [...guests.entries()].filter(([id]) => !leftOut.has(id)).map(([id, g]) => ({ id, g })), fifi = list.filter((o) => isBirthdayBoy(o.g.name)), rest = list.filter((o) => !isBirthdayBoy(o.g.name)).sort((a, b) => b.g.look.h - a.g.look.h);
      const N = list.length, rows = Math.max(1, Math.round(Math.sqrt(N / 1.6))), sizes = Array.from({ length: rows }, (_, r) => Math.floor(N / rows) + (r < N % rows ? 1 : 0));
      let k = 0;
      sizes.forEach((n, r) => {
        const last = r === rows - 1, take = last ? n - fifi.length : n, row = rest.slice(k, k + take);
        k += take;
        const line = last ? row.slice(0, Math.floor(row.length / 2)).concat(fifi, row.slice(Math.floor(row.length / 2))) : row, depth = rows - 1 - r;
        line.forEach((o, i) => addItem("guest", o.id, { x: (i - (line.length - 1) / 2) * 1.05 + (depth % 2 ? 0.52 : 0), y: depth * 0.95, z: -depth * 1.3, rot: Math.sin(i * 1.7 + r) * 0.12, pose: ["wave", "waveL", "cheer", "wave"][(i * 7 + r * 3) % 4] }));
      });
    }
    function contentBox(camera) {
      const bb = new T.Box3(), v = new T.Vector3(), inv = camera.matrixWorldInverse;
      scene.updateMatrixWorld(true);
      items.forEach((it) => {
        const b = new T.Box3().setFromObject(it.holder);
        if (b.isEmpty()) return;
        for (let i = 0; i < 8; i++) bb.expandByPoint(v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(inv));
      });
      return bb;
    }
    function frameAll() {
      if (!items.length) return;
      applyCam();
      const bb = contentBox(cam), cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
      const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), upv = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      view.target.addScaledVector(right, cx).addScaledVector(upv, cy);
      const a = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
      view.size = Math.max(2, Math.max((bb.max.y - bb.min.y) / 2, (bb.max.x - bb.min.x) / 2 / a) * 1.12);
      applyCam();
    }

    // ---------- saving the arrangement (in this browser) and the picture ----------
    const KEY = "fefe40.arrange";
    function save() {
      try {
        localStorage.setItem(KEY, JSON.stringify({ leftOut: [...leftOut], view: { az: view.az, el: view.el, size: view.size, t: view.target.toArray() },
          items: items.map((it) => ({ id: it.id, kind: it.kind, ref: it.ref, x: it.x, y: it.y, z: it.z, rot: it.rot, scale: it.scale, pose: it.pose, seat: it.seat })) }));
      } catch (e) { /* private browsing: it just isn't kept */ }
    }
    function restore() {
      let s = null;
      try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
      if (s && Array.isArray(s.leftOut)) s.leftOut.forEach((id) => { if (guests.has(id)) leftOut.add(id); });
      if (!s || !Array.isArray(s.items) || !s.items.length) return false;
      const ids = new Map();
      s.items.forEach((o) => {
        if (o.kind === "guest" ? !guests.has(o.ref) : !THINGS[o.kind]) return;
        const it = addItem(o.kind, o.ref, { x: +o.x || 0, y: +o.y || 0, z: +o.z || 0, rot: +o.rot || 0, scale: +o.scale || 1, pose: o.pose || "stand" });
        ids.set(o.id, it);
        it.savedSeat = o.seat;
      });
      items.forEach((it) => { if (it.savedSeat && ids.has(it.savedSeat)) it.seat = ids.get(it.savedSeat).id; delete it.savedSeat; place(it); });
      // anyone who signed up since: in a row out front
      const on = new Set(items.filter((i) => i.kind === "guest").map((i) => i.ref)), fresh = [...guests.keys()].filter((id) => !on.has(id) && !leftOut.has(id));
      fresh.forEach((id, i) => addItem("guest", id, { x: (i - (fresh.length - 1) / 2) * 1.05, z: 4, pose: "wave" }));
      if (s.view) { view.az = +s.view.az || 0; view.el = +s.view.el || 0.22; view.size = +s.view.size || 9; if (Array.isArray(s.view.t)) view.target.fromArray(s.view.t); }
      applyCam();
      return true;
    }
    async function savePNG() {
      statusEl.textContent = "Drawing the picture…";
      grid.visible = ring.visible = false;
      await Promise.all(items.filter((i) => i.av).map((i) => i.av.ready));
      // cropped round everything, seen the way the stage is seen now
      applyCam();
      const bb = contentBox(cam), pad = (bb.max.y - bb.min.y) * 0.03 + 0.2, cam2 = cam.clone();
      Object.assign(cam2, { left: bb.min.x - pad, right: bb.max.x + pad, top: bb.max.y + pad, bottom: bb.min.y - pad });
      cam2.updateProjectionMatrix();
      const aspect = (cam2.right - cam2.left) / (cam2.top - cam2.bottom);
      const cv = document.createElement("canvas"), r2 = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, preserveDrawingBuffer: true });
      const gl = r2.getContext(), most = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0], 4800);
      const W = aspect >= 1 ? most : Math.round(most * aspect), H = Math.round(W / aspect);
      r2.setPixelRatio(1);
      r2.setSize(W, H, false);
      r2.setClearColor(0x000000, 0);
      r2.render(scene, cam2);
      const url = cv.toDataURL("image/png");
      r2.dispose();
      grid.visible = true;
      ring.visible = !!selected;
      const a = document.createElement("a");
      a.href = url;
      a.download = "fifi4000-arrangement.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      statusEl.textContent = "Saved: " + W + " × " + H + " pixels, see-through background";
      window.fefeArrange = { W, H, png: url };
    }

    // ---------- the guests, from the party database ----------
    const hex = (c, d) => (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : d);
    const faceOk = (v) => (FefeAvatar.isFaceString && FefeAvatar.isFaceString(v) ? v : null);
    function lookOf(r) {
      const look = { body: r.body === "f" ? "f" : "m", outfit: Math.max(0, Math.min(FefeAvatar.OUTFITS.length - 1, r.outfit | 0)), skin: hex(r.skin, "#D9A57E"), hair: hex(r.hair, "#4A3020"), face: faceOk(r.face), faceL: faceOk(r.faceL), faceR: faceOk(r.faceR), faceT: faceOk(r.faceT) };
      const sh = FefeAvatar.bodyShape({ body: look.body, h: +r.h || 0, wt: +r.wt || 0 });
      look.h = sh.h;
      look.wt = sh.wt;
      return look;
    }
    async function loadGuests() {
      statusEl.textContent = "Loading the guests…";
      const idx = await fetch(DB_URL + "/fefe40/index.json", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      const ids = Object.keys(idx || {}).filter((id) => /^[a-z0-9]{6,24}$/.test(id));
      for (let i = 0; i < ids.length; i += 8) {
        await Promise.all(ids.slice(i, i + 8).map(async (id) => {
          const r = await fetch(DB_URL + "/fefe40/guests/" + id + ".json", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
          if (r && typeof r.name === "string") guests.set(id, { name: r.name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 20) || "Guest", look: lookOf(r) });
        }));
        statusEl.textContent = "Loading the guests… " + guests.size + " of " + ids.length;
      }
    }
    (async function start() {
      resize();
      await loadGuests();
      if (!restore()) { defaultLayout(); frameAll(); save(); }
      statusEl.textContent = guests.size + " guests. Tap someone to pose them; drag to move.";
      (function loop() {
        if (selected) {
          const p = selected.holder.getWorldPosition(new T.Vector3());
          ring.position.set(p.x, (selected.seat ? p.y : selected.y) + 0.03, p.z);
          ring.scale.setScalar(selected.bear ? 4 : selected.av ? 1 : 2.6);
        }
        renderer.render(scene, cam);
        requestAnimationFrame(loop);
      })();
      window.fefeArrangeDebug = { items: () => items.map((i) => [i.kind, i.ref && guests.get(i.ref) ? guests.get(i.ref).name : "", +i.x.toFixed(2), +i.z.toFixed(2), i.pose, i.seat]), add: (kind) => select(addItem(kind, null, spotBeside(kind))), select: (n) => select(items[n]), seatIn: (a, b) => { items[a].seat = items[b].id; place(items[a]); }, savePNG, frameAll };
    })();
  })();
