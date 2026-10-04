/* FiFi4000 arranger: everyone who signed up, plus the cars, tank, seaplane, teddy bear and band, on a stage to arrange
   for a print (a T-shirt). Not part of the game: open arrange.html. Tap someone to pose them, drag to move them, drag
   the empty stage to turn the view, scroll or pinch to zoom; Save PNG draws what's on screen, big, on a see-through
   background. The stage can be an amphitheater: stone steps sloping up and out from a disco dance floor, a mirror ball
   over it and trees all round, and everyone stands on whatever is under their feet. The arrangement is kept in this
   browser, and scenes can be saved by name, or as a file to open on another phone or computer. The builders for the
   vehicles, the bear and the trees are the game's own (app.js). */
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    // Lit like the game: a strong sun from the side and above, so every block shows its faces, and real shadows on the
    // ground. The ground itself is invisible: only the shadows show (and print, as see-through grey).
    const scene = new T.Scene();
    let dirty = true, shadowsDirty = true; // drawn only when something changed
    scene.add(new T.HemisphereLight(0xffffff, 0x8a7a6a, 0.55));
    scene.add(new T.AmbientLight(0xffffff, 0.16));
    const key = new T.DirectionalLight(0xfff4e6, 0.95), SUN = new T.Vector3(-0.45, 0.8, 0.4).normalize();
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    scene.add(key, key.target);
    const fill = new T.DirectionalLight(0xdfe8ff, 0.22);
    fill.position.set(16, 8, 10);
    scene.add(fill);
    const floor = new T.Mesh(new T.PlaneGeometry(400, 400), new T.ShadowMaterial({ opacity: 0.32 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    // the sun's shadow box, round everything on the stage
    function fitShadows() {
      const bb = new T.Box3();
      items.forEach((it) => bb.expandByObject(it.holder));
      if (stageOn) amGroup.children.forEach((m) => { if (m.visible) bb.expandByObject(m); });
      if (bb.isEmpty()) return;
      const c = bb.getCenter(new T.Vector3()), r = bb.getSize(new T.Vector3()).length() / 2 + 2, cam = key.shadow.camera;
      key.target.position.copy(c);
      key.position.copy(c).addScaledVector(SUN, r + 20);
      Object.assign(cam, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 2 * r + 40 });
      cam.updateProjectionMatrix();
    }
    const grid = new T.GridHelper(120, 120, 0x4a6d9c, 0x2a3f5c);
    grid.position.y = 0.005;
    scene.add(grid);
    const ring = new T.Mesh(new T.RingGeometry(0.75, 0.95, 40), new T.MeshBasicMaterial({ color: 0xfefe40, side: T.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 10;
    ring.visible = false;
    scene.add(ring);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    const VIEWS = { "3d": { az: 0.55, el: 0.55 }, front: { az: 0, el: 0.12 } };
    const view = { az: VIEWS["3d"].az, el: VIEWS["3d"].el, size: 9, target: new T.Vector3(0, 2, 0) };
    function applyCam() {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, a = w / h, d = 120;
      Object.assign(cam, { left: -view.size * a, right: view.size * a, top: view.size, bottom: -view.size });
      cam.position.set(view.target.x + Math.sin(view.az) * Math.cos(view.el) * d, view.target.y + Math.sin(view.el) * d, view.target.z + Math.cos(view.az) * Math.cos(view.el) * d);
      cam.lookAt(view.target);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(); // (fitting the view reads it straight away, before it's drawn)
      cutaway();
      dirty = shadowsDirty = true;
    }
    const barHeight = () => document.documentElement.style.setProperty("--bar", document.querySelector(".bar").offsetHeight + "px"); // the panels open below the buttons, however many rows they take
    function resize() {
      barHeight();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      applyCam();
    }
    window.addEventListener("resize", resize);

    // ---------- the amphitheater ----------
    // Stone steps sloping up and out from a disco dance floor, a mirror ball over it on strings of lights, and a ring of
    // the game's palms and leafy trees round the top. Built the first time it's switched on, in half-metre blocks like
    // the game's world. Where it would hide the people, it's cut away: the trees between the camera and the middle, and
    // in the low front view the near half of the steps too.
    const AM = { floorR: 5, stepW: 1.5, stepH: 0.5, steps: 7, rimR: 21, sectors: 24, ball: 12.5, hub: 14.5 };
    AM.top = AM.steps * AM.stepH; // the grass round the top
    AM.outR = AM.floorR + AM.steps * AM.stepW; // where the steps end
    const GC = { grass: ["#63C04A", "#58B743", "#6FC957", "#4FAA3E"], leaf: ["#2E8B3A", "#3A9E45", "#267A32", "#44A84C"], leafLight: "#5DBE51", leafDark: "#1F6A2B",
      palm: ["#4DB356", "#3FA24A", "#58BF5F"], trunk: "#7A5230", palmTrunk: "#A0804F", palmTrunkDark: "#86683E", coconut: "#6B4A2A", tuft: ["#4AA63F", "#5DB84A"],
      bloom: ["#FF4FA3", "#FF3B6B", "#FF8A1F", "#B15CFF", "#FFD23F", "#FFFFFF"] };
    const TILES = ["#FF4FA3", "#FFD23F", "#4FC3FF", "#B15CFF", "#5CFF8A", "#FF8A1F", "#FFFFFF"];
    const sectorOf = (x, z) => Math.floor(((Math.atan2(x, z) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI / AM.sectors)) % AM.sectors;
    const sectorDir = (s) => ((s + 0.5) * 2 * Math.PI) / AM.sectors;
    const tileIn = (ti, tj) => Math.hypot(Math.abs(ti + 0.5) + 0.5, Math.abs(tj + 0.5) + 0.5) <= AM.floorR - 0.25; // the 1 m light-up tiles
    // the ground, as half-metre columns: h is the top of the blocks, stand is where feet go, sec is which slice of the bowl
    const AN = Math.ceil(AM.rimR * 2) + 2, cells = new Array(4 * AN * AN).fill(null);
    const cellAt = (i, j) => (i < -AN || j < -AN || i >= AN || j >= AN ? null : cells[(i + AN) * 2 * AN + j + AN]);
    for (let i = -AN; i < AN; i++) for (let j = -AN; j < AN; j++) {
      const x = (i + 0.5) / 2, z = (j + 0.5) / 2, r = Math.hypot(x, z), n = hash01(i * 7919 + j * 104729 + 7);
      if (r > AM.rimR - 0.8 * hash01(Math.round(Math.atan2(x, z) * 14) + 5000)) continue; // a ragged edge
      let c;
      if (r < AM.floorR) c = tileIn(Math.floor(i / 2), Math.floor(j / 2)) ? { h: -0.5, cap: "#241C38", body: "#241C38", sec: -1 } : { h: 0, cap: n < 0.3 ? "#C9B894" : "#BFAD88", body: "#8F7C5C", sec: -1 };
      else if (r < AM.outR) { const k = Math.floor((r - AM.floorR) / AM.stepW) + 1; c = { h: k * AM.stepH, cap: k % 2 ? (n < 0.3 ? "#C9B894" : "#BFAD88") : (n < 0.3 ? "#B9A57F" : "#AF9B76"), side: "#8F7C5C", body: "#8F7C5C" }; }
      else c = { h: AM.top, cap: GC.grass[(n * 4) | 0], body: n < 0.5 ? "#8B6B47" : "#7E603F" };
      if (c.sec === undefined) c.sec = sectorOf(x, z);
      c.stand = Math.max(0, c.h);
      cells[(i + AN) * 2 * AN + j + AN] = c;
    }
    const standAt = (x, z) => { const c = cellAt(Math.floor(x * 2), Math.floor(z * 2)); return c ? c.stand : AM.top; };
    // meshes made face by face: only the faces that show
    const rgbs = {};
    const rgb = (hex) => rgbs[hex] || (rgbs[hex] = new T.Color(hex));
    const faces = () => ({ pos: [], nor: [], col: [], idx: [] });
    const FACE = [ // the corners of each face of a block, counter-clockwise seen from outside: +x, -x, +y, -y, +z, -z
      (a, b) => [[b[0], a[1], b[2]], [b[0], a[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]]],
      (a, b) => [[a[0], a[1], a[2]], [a[0], a[1], b[2]], [a[0], b[1], b[2]], [a[0], b[1], a[2]]],
      (a, b) => [[a[0], b[1], a[2]], [a[0], b[1], b[2]], [b[0], b[1], b[2]], [b[0], b[1], a[2]]],
      (a, b) => [[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]]],
      (a, b) => [[a[0], a[1], b[2]], [b[0], a[1], b[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]],
      (a, b) => [[b[0], a[1], a[2]], [a[0], a[1], a[2]], [a[0], b[1], a[2]], [b[0], b[1], a[2]]]
    ];
    const NORMAL = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    function face(f, d, lo, hi, hex) {
      const c = rgb(hex), o = f.pos.length / 3, N = NORMAL[d];
      FACE[d](lo, hi).forEach((p) => { f.pos.push(p[0], p[1], p[2]); f.nor.push(N[0], N[1], N[2]); f.col.push(c.r, c.g, c.b); });
      f.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    function faceMesh(f, sec) {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(f.pos, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(f.nor, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(f.col, 3));
      g.setIndex(f.idx);
      g.computeBoundingBox();
      g.computeBoundingSphere();
      const m = new T.Mesh(g, vcMat("solid"));
      m.castShadow = m.receiveShadow = true;
      m.userData.sec = sec;
      return m;
    }
    // blocks in a map (u, v, w are half-metre steps): every face that isn't against another block
    const vkey = (u, v, w) => ((u + 128) * 256 + (w + 128)) * 128 + (v + 32);
    function blockFaces(map, f) {
      map.forEach(([u, v, w, hex]) => {
        const lo = [u / 2, v / 2, w / 2], hi = [u / 2 + 0.5, v / 2 + 0.5, w / 2 + 0.5];
        [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(([a, b, c], d) => { if (!map.has(vkey(u + a, v + b, w + c))) face(f, d, lo, hi, hex); });
      });
    }
    // The game's trees (app.js), standing on the top of the bowl instead of the game's ground (y = 1)
    function growTree(x, z, kind, rnd) {
      const map = new Map(), lift = (AM.top - 1) * 2;
      const pick = (a) => a[(rnd() * a.length) | 0];
      const setV = (u, v, w, color) => map.set(vkey(u, v + lift, w), [u, v + lift, w, color]);
      const metaV = (u, v, w) => map.has(vkey(u, v + lift, w));
      const dab = (px, py, pz, color) => { const u = Math.floor(px * 2), v = Math.floor(py * 2), w = Math.floor(pz * 2); if (!metaV(u, v, w)) setV(u, v, w, color); };
      const vbox = (bx, by, bz, bw, bh, bd, color) => {
        for (let u = Math.round(bx * 2); u < Math.round((bx + bw) * 2); u++) for (let v = Math.round(by * 2); v < Math.round((by + bh) * 2); v++) for (let w = Math.round(bz * 2); w < Math.round((bz + bd) * 2); w++) setV(u, v, w, color);
      };
      function blob(cx, cy, cz, rx, ry, rz, shade) {
        for (let u = Math.floor((cx - rx) * 2); u <= Math.floor((cx + rx) * 2); u++)
          for (let v = Math.floor((cy - ry) * 2); v <= Math.floor((cy + ry) * 2); v++)
            for (let w = Math.floor((cz - rz) * 2); w <= Math.floor((cz + rz) * 2); w++) {
              const px = (u + 0.5) / 2 - cx, py = (v + 0.5) / 2 - cy, pz = (w + 0.5) / 2 - cz;
              const d = (px / rx) * (px / rx) + (py / ry) * (py / ry) + (pz / rz) * (pz / rz);
              if (d > 1 || (d > 0.7 && rnd() < 0.3) || metaV(u, v, w)) continue;
              setV(u, v, w, shade(py / ry));
            }
      }
      let info;
      if (kind === "palm") { // a thin ringed trunk that curves as it rises, and arching fronds that droop at the tips
        const h = 5.5 + ((rnd() * 5) | 0) * 0.5, ang = rnd() * Math.PI * 2, lean = 0.5 + rnd() * 0.9, lx = Math.cos(ang) * lean, lz = Math.sin(ang) * lean;
        let tx = x + 0.25, tz = z + 0.25;
        for (let v = 2; v < h * 2; v++) {
          const t = (v / 2 - 1) / (h - 1);
          tx = x + 0.25 + lx * t * t;
          tz = z + 0.25 + lz * t * t;
          const u = Math.floor(tx * 2), w = Math.floor(tz * 2), col = v % 3 === 0 ? GC.palmTrunkDark : GC.palmTrunk;
          setV(u, v, w, col);
          if (v < 4) { setV(u + 1, v, w, col); setV(u, v, w + 1, col); setV(u + 1, v, w + 1, col); }
        }
        const cx = (Math.floor(tx * 2) + 0.5) / 2, cz = (Math.floor(tz * 2) + 0.5) / 2, cy = h + 0.25;
        dab(cx, cy, cz, pick(GC.palm));
        dab(cx, cy + 0.5, cz, pick(GC.palm));
        const n = 7 + ((rnd() * 3) | 0);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + rnd() * 0.5, dx = Math.cos(a), dz = Math.sin(a), L = 2.6 + rnd(), col = pick(GC.palm), up = 0.55 + rnd() * 0.3;
          for (let s = 0.3; s <= L; s += 0.25) {
            const y = cy + 0.3 + up * s - 0.33 * s * s, px = cx + dx * s, pz = cz + dz * s;
            dab(px, y, pz, col);
            if (s > 0.7 && s < L - 0.4) { dab(px - dz * 0.5, y - 0.3, pz + dx * 0.5, col); dab(px + dz * 0.5, y - 0.3, pz - dx * 0.5, col); }
          }
        }
        [[-0.5, 0], [0.5, 0], [0, 0.5]].forEach(([ox, oz]) => dab(cx + ox, cy - 0.5, cz + oz, GC.coconut));
        info = { x: cx, y: cy + 0.6 + lift / 2, z: cz }; // the top of the trunk, where a string of lights can be tied
      } else { // a shade tree: a stout trunk with roots and two branches, under a round canopy of three blobs
        const flowering = kind === "bloom", h = 3 + ((rnd() * 3) | 0) * 0.5;
        vbox(x, 1, z, 1, h - 1, 1, GC.trunk);
        [[-0.25, 0.25], [1.25, 0.75], [0.75, -0.25], [0.25, 1.25]].forEach(([ox, oz]) => { if (rnd() < 0.7) dab(x + ox, 1.25, z + oz, GC.trunk); });
        [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => rnd() - 0.5).slice(0, 2).forEach(([dx, dz]) => {
          for (let s = 0.5; s <= 1.5; s += 0.5) dab(x + 0.5 + dx * (0.5 + s), h - 0.5 + s * 0.8, z + 0.5 + dz * (0.5 + s), GC.trunk);
        });
        const shade = (t) => {
          if (flowering && rnd() < 0.32) return pick([GC.bloom[0], GC.bloom[1], GC.bloom[2]]);
          if (t > 0.45) return rnd() < 0.6 ? GC.leafLight : pick(GC.leaf);
          if (t < -0.35) return rnd() < 0.6 ? GC.leafDark : pick(GC.leaf);
          return pick(GC.leaf);
        };
        const rx = 2.1 + rnd() * 0.6, ry = 1.5 + rnd() * 0.4;
        blob(x + 0.5, h + 1.2, z + 0.5, rx, ry, rx * (0.85 + rnd() * 0.3), shade);
        for (let k = 0; k < 2; k++) {
          const a = rnd() * Math.PI * 2;
          blob(x + 0.5 + Math.cos(a) * 1.2, h + 1.0 + rnd() * 0.8, z + 0.5 + Math.sin(a) * 1.2, 1.3, 1.1, 1.3, shade);
        }
      }
      return { map, info };
    }
    let amGroup = null, stageOn = false, amTiles = null, amBall = null, amLight = null;
    const amGround = [], amTrees = [], amSec = [];
    function buildAmphi() {
      amGroup = new T.Group();
      // the ground: each column's top, and its sides where they show (a different slice's side counts as showing, so a
      // cut-away slice leaves a clean edge)
      const bySec = new Map(), F = (s) => bySec.get(s) || bySec.set(s, faces()).get(s), base = -1;
      for (let i = -AN; i < AN; i++) for (let j = -AN; j < AN; j++) {
        const c = cellAt(i, j);
        if (!c) continue;
        const f = F(c.sec), x0 = i / 2, z0 = j / 2, x1 = x0 + 0.5, z1 = z0 + 0.5;
        face(f, 2, [x0, c.h, z0], [x1, c.h, z1], c.cap);
        [[1, 0, 0], [-1, 0, 1], [0, 1, 4], [0, -1, 5]].forEach(([di, dj, d]) => {
          const nb = cellAt(i + di, j + dj), lo = nb && nb.sec === c.sec ? nb.h : base;
          if (lo >= c.h) return;
          const capLo = Math.max(lo, c.h - 0.5);
          face(f, d, [x0, capLo, z0], [x1, c.h, z1], c.side || c.cap);
          if (capLo > lo) face(f, d, [x0, lo, z0], [x1, capLo, z1], c.body);
        });
      }
      // grass tufts and flowers on the top
      let seed = 4100;
      const rnd = () => hash01(seed++);
      for (let k = 0; k < 140; k++) {
        const a = rnd() * Math.PI * 2, r = AM.outR + 0.4 + rnd() * (AM.rimR - AM.outR - 1.4), x = Math.sin(a) * r, z = Math.cos(a) * r, flower = rnd() < 0.35;
        const c = cellAt(Math.floor(x * 2), Math.floor(z * 2));
        if (!c || c.h !== AM.top) continue;
        const s = flower ? 0.2 : 0.25, hex = flower ? GC.bloom[(rnd() * GC.bloom.length) | 0] : GC.tuft[(rnd() * 2) | 0];
        [0, 1, 2, 4, 5].forEach((d) => face(F(c.sec), d, [x - s / 2, AM.top, z - s / 2], [x + s / 2, AM.top + s, z + s / 2], hex));
      }
      bySec.forEach((f, s) => { const m = faceMesh(f, s); amGroup.add(m); amGround.push(m); if (s >= 0) amSec[s] = m; });
      // the dance floor: light-up tiles on a dark base, and the shadows on them
      const slabs = [], tiles = [];
      for (let ti = -6; ti < 6; ti++) for (let tj = -6; tj < 6; tj++) if (tileIn(ti, tj)) {
        slabs.push([ti + 0.5, -0.3, tj + 0.5, 1, 0.4, 1, "#241C38"]);
        tiles.push([ti + 0.5, -0.05, tj + 0.5, 0.9, 0.1, 0.9, TILES[(hash01(ti * 31 + tj * 17 + 77) * TILES.length) | 0]]);
      }
      const slab = mergedBoxes(slabs, vcMat("solid"));
      slab.receiveShadow = true;
      amTiles = mergedBoxes(tiles, vcMat("glow"));
      amTiles.userData.tiles = tiles.length;
      amTiles.userData.orig = amTiles.geometry.attributes.color.array.slice();
      amGroup.add(slab, amTiles);
      const shade = new T.Mesh(new T.CircleGeometry(AM.floorR, 64), new T.ShadowMaterial({ opacity: 0.35 }));
      shade.rotation.x = -Math.PI / 2;
      shade.position.y = 0.004;
      shade.receiveShadow = true;
      amGroup.add(shade);
      // the trees: palms at eight points round the top to tie the lights to, then more, leafy and palm, all round
      const spots = [];
      for (let k = 0; k < 8; k++) { const a = ((k + 0.5) * Math.PI) / 4, r = AM.outR + 1.7; spots.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, kind: "palm", lights: true }); }
      for (let tries = 0; tries < 4000 && spots.length < 40; tries++) {
        const a = rnd() * Math.PI * 2, r = AM.outR + 1.2 + rnd() * (AM.rimR - AM.outR - 2.6), x = Math.sin(a) * r, z = Math.cos(a) * r, t = rnd(), kind = t < 0.35 ? "palm" : t > 0.75 ? "bloom" : "leafy";
        if (spots.some((o) => Math.hypot(o.x - x, o.z - z) < (kind === "palm" || o.kind === "palm" ? 3.4 : 4.4))) continue;
        spots.push({ x, z, kind });
      }
      const treeSec = new Map(), tie = [];
      spots.forEach((o) => {
        const t = growTree(o.x - 0.5, o.z - 0.5, o.kind, rnd), s = sectorOf(o.x, o.z);
        if (!treeSec.has(s)) treeSec.set(s, faces());
        blockFaces(t.map, treeSec.get(s));
        if (o.lights) tie.push({ at: t.info, s });
      });
      treeSec.forEach((f, s) => { const m = faceMesh(f, s); amGroup.add(m); amTrees.push(m); });
      // strings of party lights from the palms to the middle, where the mirror ball hangs
      const BULBS = ["#FFE58A", "#FF6FB5", "#7FD8FF", "#FFD23F", "#B9FF7A"];
      tie.forEach(({ at, s }, k) => {
        const from = new T.Vector3(0, AM.hub, 0), to = new T.Vector3(at.x, at.y, at.z), n = Math.round(from.distanceTo(to) / 0.5), boxes = [];
        for (let b = 1; b < n; b++) {
          const t = b / n, p = from.clone().lerp(to, t);
          p.y -= 1.1 * 4 * t * (1 - t);
          boxes.push([p.x, p.y, p.z, 0.16, 0.2, 0.16, BULBS[(b + k) % BULBS.length]]);
        }
        const m = mergedBoxes(boxes, vcMat("glow"));
        m.userData.sec = s;
        amGroup.add(m);
        amTrees.push(m);
      });
      // the mirror ball: little mirrors in greys and blues, catching the light
      let geo = new T.IcosahedronGeometry(0.95, 2);
      if (geo.index) geo = geo.toNonIndexed();
      const nv = geo.attributes.position.count, col = new Float32Array(nv * 3), MIRRORS = ["#FFFFFF", "#DDEFF8", "#A9C2D2", "#7E93A3", "#F2F7FF", "#C6D9E6", "#5F7383"];
      for (let t = 0; t < nv / 3; t++) { const c = rgb(MIRRORS[(hash01(t + 321) * MIRRORS.length) | 0]); for (let q = 0; q < 3; q++) col.set([c.r, c.g, c.b], (t * 3 + q) * 3); }
      geo.setAttribute("color", new T.BufferAttribute(col, 3));
      const ball = new T.Mesh(geo, new T.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 90, specular: 0xffffff }));
      ball.position.set(0, AM.ball, 0);
      ball.castShadow = true;
      amBall = ball;
      amGroup.add(ball, mergedBoxes([[0, (AM.ball + 0.95 + AM.hub) / 2, 0, 0.05, AM.hub - AM.ball - 0.95, 0.05, "#3A3D44"], [0, AM.ball + 1.0, 0, 0.3, 0.16, 0.3, "#8A9097"], [0, AM.hub, 0, 0.22, 0.22, 0.22, "#3A3D44"]], vcMat("solid")));
      amLight = buildLight();
      scene.add(amGroup);
    }
    // The mirror ball's light: spots thrown on the steps and the floor, a few beams, and a glow round the ball. They
    // turn with the ball; still when paused, so they're in the picture too.
    const SPOTS = 70, BEAMS = 9, SPOT_COLS = ["#FFFFFF", "#FFF09A", "#AEE4FF", "#FFBCE3", "#BDFFD0"];
    function buildLight() {
      const dirs = [];
      for (let k = 0; k < SPOTS; k++) { const m = k % (SPOTS / 7); dirs.push({ t: 0.18 + 0.86 * Math.sqrt(hash01(m * 3 + 901)), a: hash01(m * 7 + 433) * ((2 * Math.PI) / 7) + Math.floor(k / (SPOTS / 7)) * ((2 * Math.PI) / 7) }); } // angle from straight down, and round: a pattern that repeats seven times round
      const spot = new T.InstancedMesh(new T.CircleGeometry(0.24, 14).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }), SPOTS);
      for (let k = 0; k < SPOTS; k++) spot.setColorAt(k, rgb(SPOT_COLS[k % SPOT_COLS.length]));
      spot.renderOrder = 2;
      const beams = [];
      for (let k = 0; k < BEAMS; k++) {
        const m = new T.Mesh(new T.CylinderGeometry(0.03, 0.32, 1, 12, 1, true), new T.MeshBasicMaterial({ color: ["#FFFFFF", "#FFE7F4", "#E3F4FF"][k % 3], transparent: true, opacity: 0.13, depthWrite: false, side: T.DoubleSide }));
        m.renderOrder = 3;
        beams.push(m);
      }
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,0.75)");
      grad.addColorStop(0.35, "rgba(235,245,255,0.3)");
      grad.addColorStop(1, "rgba(235,245,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
      glow.position.set(0, AM.ball, 0);
      glow.scale.setScalar(4.2);
      glow.renderOrder = 4;
      amGroup.add(spot, glow, ...beams);
      return { dirs, spot, beams, glow, angle: 0 };
    }
    const lightTmp = new T.Object3D(), Y_UP = new T.Vector3(0, 1, 0);
    function updateLight() {
      if (!amLight) return;
      const L = amLight, from = new T.Vector3(0, AM.ball, 0), d = new T.Vector3();
      amBall.rotation.y = L.angle;
      let beam = 0;
      L.dirs.forEach((o, k) => {
        const a = o.a + L.angle;
        d.set(Math.sin(o.t) * Math.cos(a), -Math.cos(o.t), Math.sin(o.t) * Math.sin(a));
        let hit = null;
        for (let s = 1; s < 40; s += 0.15) { // along the ray till it meets the ground
          const x = from.x + d.x * s, y = from.y + d.y * s, z = from.z + d.z * s, c = cellAt(Math.floor(x * 2), Math.floor(z * 2));
          if (!c) break;
          if (y <= c.stand) { hit = (c.sec < 0 || amSec[c.sec].visible) ? new T.Vector3(x, c.stand + 0.03, z) : null; break; }
        }
        if (!hit) { lightTmp.scale.setScalar(0); lightTmp.updateMatrix(); L.spot.setMatrixAt(k, lightTmp.matrix); return; }
        lightTmp.position.copy(hit);
        lightTmp.rotation.set(0, -a, 0);
        lightTmp.scale.set(Math.min(2.6, 1 / Math.max(0.2, Math.cos(o.t))), 1, 1); // longer where it comes in low
        lightTmp.updateMatrix();
        L.spot.setMatrixAt(k, lightTmp.matrix);
        if (beam < BEAMS && k % 7 === 0) { // a few of them, as beams
          const m = L.beams[beam++], len = hit.distanceTo(from);
          m.position.copy(from).add(hit).multiplyScalar(0.5);
          m.quaternion.setFromUnitVectors(Y_UP, from.clone().sub(hit).normalize());
          m.scale.set(1, len, 1);
          m.visible = true;
        }
      });
      for (; beam < BEAMS; beam++) L.beams[beam].visible = false;
      L.spot.instanceMatrix.needsUpdate = true;
    }
    // what's cut away: trees between the camera and the middle, and the near half of the steps in the low front view
    function cutaway() {
      if (!amGroup) return;
      amGround.forEach((m) => { const s = m.userData.sec; m.visible = s < 0 || !(view.el < 0.33 && Math.cos(sectorDir(s) - view.az) > 0); });
      amTrees.forEach((m) => { m.visible = !(view.el < 1.2 && Math.cos(sectorDir(m.userData.sec) - view.az) > 0.42); });
      updateLight();
    }
    function setStage(on) {
      if (on && !amGroup) buildAmphi();
      stageOn = !!on;
      if (amGroup) amGroup.visible = stageOn;
      floor.visible = grid.visible = !stageOn;
      $("stage-btn").classList.toggle("on", stageOn);
      cutaway();
      items.forEach(place);
    }
    // where an item's feet go: the highest ground under it
    function groundAt(it) {
      if (!stageOn) return 0;
      const pts = [];
      if (it.av) [[0, 0], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]].forEach((p) => pts.push(p));
      else {
        const b = it.foot, s = it.scale;
        for (let a = 0; a <= 4; a++) for (let c = 0; c <= 4; c++) pts.push([(b.min.x + ((b.max.x - b.min.x) * a) / 4) * s, (b.min.z + ((b.max.z - b.min.z) * c) / 4) * s]);
      }
      const cs = Math.cos(it.rot), sn = Math.sin(it.rot);
      return Math.max(...pts.map(([px, pz]) => standAt(it.x + px * cs + pz * sn, it.z - px * sn + pz * cs)));
    }

    // ---------- what can be on it ----------
    const isBirthdayBoy = (name) => /^(f|ph)(i|ee|e|ie|y|ea)(f|ph)(i|ee|e|ie|y|ea)$/.test(String(name || "").toLowerCase().replace(/[^a-z]/g, ""));
    const THINGS = {
      car0: { label: "Red car", make: () => carModel(0) }, car1: { label: "White car", make: () => carModel(1) }, car2: { label: "Blue car", make: () => carModel(2) },
      car3: { label: "Yellow car", make: () => carModel(4) }, car4: { label: "Black car", make: () => carModel(5) }, jeepney: { label: "Jeepney", make: () => carModel(3) },
      tank: { label: "Tank", make: () => carModel(6) }, plane: { label: "Seaplane", make: () => { const p = buildPlane(); p.g.userData.prop = p.prop; return p.g; } }, bear: { label: "Teddy bear", make: () => bearModel() },
      dj: { label: "DJ desk", make: () => buildDJ() }
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
    // The game's DJ desk (app.js), on its own: a booth between two speakers, two turntables with FIFI 4000 records, a
    // mixer, and the front panel with the party's name in lights over an equaliser. Its front is +z. The records spin
    // and the equaliser jumps while playing. Whoever's put "in" it stands behind it, the DJ.
    function buildDJ() {
      const g = new T.Group(), boxes = [], glows = [];
      const box = (x, y, z, w, h, d, c, glow) => (glow ? glows : boxes).push([x + w / 2, y + h / 2, z + d / 2, w, h, d, c]);
      const X = 47, Y = 1, Z = 25.45; // where the game has it
      box(45 - X, 1 - Y, 25 - Z, 4, 1.1, 0.9, "#1E1F22"); // the booth
      box(45.05 - X, 1.3 - Y, 25.9 - Z, 3.9, 0.12, 0.02, "#006AA7", true); // its blue light
      [44.1, 49.1].forEach((x) => { box(x - X, 1 - Y, 25 - Z, 0.8, 1.9, 0.8, "#1E1F22"); box(x + 0.2 - X, 1.4 - Y, 25.8 - Z, 0.4, 0.4, 0.02, "#B8BCC4"); box(x + 0.25 - X, 2.2 - Y, 25.8 - Z, 0.3, 0.3, 0.02, "#B8BCC4"); }); // speakers
      box(45 - X, 2.1 - Y, 25.05 - Z, 4, 0.06, 0.8, "#4A4D55"); // the metal top
      box(46.62 - X, 2.16 - Y, 25.12 - Z, 0.76, 0.06, 0.66, "#1E1F22"); // the mixer
      [0.72, 0.96].forEach((dx) => box(46.62 + dx - 0.6 - X, 2.22 - Y, 25.46 - Z, 0.05, 0.04, 0.26, "#55585F"));
      [["#2E9BFF", 0.14], ["#FFD21F", 0.34], ["#FF4FB0", 0.54]].forEach(([c, dz]) => [0.2, 0.46].forEach((dx) => box(46.62 + dx - X, 2.22 - Y, 25.12 + dz * 0.6 - Z, 0.08, 0.05, 0.08, c, true)));
      const records = [], faders = [];
      const vinyl = document.createElement("canvas");
      vinyl.width = vinyl.height = 64;
      const v = vinyl.getContext("2d");
      v.fillStyle = "#101014"; v.beginPath(); v.arc(32, 32, 32, 0, Math.PI * 2); v.fill();
      for (let r = 12; r < 31; r += 2) { v.strokeStyle = r % 4 ? "#24242c" : "#1a1a20"; v.beginPath(); v.arc(32, 32, r, 0, Math.PI * 2); v.stroke(); }
      v.fillStyle = "#FEFE40"; v.beginPath(); v.arc(32, 32, 10, 0, Math.PI * 2); v.fill();
      v.fillStyle = "#006AA7"; v.font = "bold 7px sans-serif"; v.textAlign = "center"; v.fillText("FIFI", 32, 30); v.fillText("4000", 32, 38);
      const vinylTex = new T.CanvasTexture(vinyl);
      [45.9, 48.1].forEach((x) => {
        const base = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.05, 28), new T.MeshLambertMaterial({ color: 0xb8bcc4 }));
        base.position.set(x - X, 2.19 - Y, 0);
        const rec = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.04, 28), [new T.MeshLambertMaterial({ color: 0x101014 }), new T.MeshLambertMaterial({ map: vinylTex }), new T.MeshLambertMaterial({ color: 0x101014 })]);
        rec.position.set(x - X, 2.235 - Y, 0);
        g.add(base, rec);
        records.push(rec);
        box(x + 0.28 - X, 2.24 - Y, 25.15 - Z, 0.04, 0.05, 0.42, "#D8DCE4"); // tone arm
        box(x + 0.24 - X, 2.23 - Y, 25.11 - Z, 0.1, 0.08, 0.1, "#2A2A30");
        box(x - 0.34 - X, 2.16 - Y, 25.73 - Z, 0.1, 0.02, 0.08, "#3BE36B", true);
      });
      [0.72, 0.96].forEach((dx) => { const f = new T.Mesh(carBox, new T.MeshLambertMaterial({ color: 0xf4f4f0 })); f.scale.set(0.1, 0.05, 0.07); f.position.set(46.62 + dx - 0.63 + 0.05 - X, 2.265 - Y, 0.135); g.add(f); faders.push(f); });
      g.add(mergedBoxes(boxes, vcMat("solid")), mergedBoxes(glows, vcMat("glow")));
      // the front panel: the name in lights, and the equaliser
      const front = document.createElement("canvas");
      front.width = 256; front.height = 64;
      const fc = front.getContext("2d"), frontTex = new T.CanvasTexture(front);
      function paint(t, moving) {
        fc.fillStyle = "#0d0e12"; fc.fillRect(0, 0, 256, 64);
        for (let x = 4; x < 256; x += 8) for (let y = 4; y < 64; y += 8) { fc.fillStyle = "#1b1d24"; fc.fillRect(x, y, 4, 4); } // grille
        fc.font = "bold 22px 'Pixelify Sans', monospace"; fc.textAlign = "center";
        fc.fillStyle = "#FEFE40"; fc.fillText("FiFi4000", 128, 26);
        for (let i = 0; i < 24; i++) {
          const h = 2 + Math.floor(Math.abs(Math.sin((moving ? t : 0.6) * (3 + (i % 5)) + i * 1.7)) * 12);
          for (let y = 0; y < h; y += 2) { fc.fillStyle = y > 9 ? "#FF2E2E" : y > 5 ? "#FFD21F" : "#3BD16F"; fc.fillRect(8 + i * 10, 60 - y * 2, 8, 2); }
        }
        frontTex.needsUpdate = true;
      }
      paint(0, false);
      if (document.fonts && document.fonts.load) document.fonts.load("bold 22px 'Pixelify Sans'").then(() => { paint(0, false); dirty = true; }).catch(() => {});
      const panel = new T.Mesh(new T.PlaneGeometry(3.9, 0.95), new T.MeshBasicMaterial({ map: frontTex }));
      panel.position.set(0, 0.55, 0.47);
      g.add(panel);
      g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      let next = 0;
      g.userData.seat = { x: 0, y: 0, z: -0.95, stand: true };
      g.userData.dj = {
        update(t) {
          records.forEach((r) => { r.rotation.y = -t * 3.5; });
          faders.forEach((f, i) => { f.position.z = 0.135 + Math.sin(t * (1.3 + i)) * 0.08; });
          if (t > next || t < next - 1) { next = t + 0.1; paint(t, true); }
        }
      };
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
      if (seated === "sit" || (pose === "sit" && seated !== "stand")) { // sitting: in a seat or on the bear, or on the ground with the legs out
        av.rig.position.y = (seated === "sit" ? 0.42 : 0.15) - 0.825 * (av.scale || 1);
        P.legR.rotation.set(-Math.PI / 2, 0, 0.05);
        P.legL.rotation.set(-Math.PI / 2, 0, -0.05);
        if (pose === "sit" || pose === "stand") { P.armR.rotation.set(-1.25, 0, 0.25); P.armL.rotation.set(-1.25, 0, -0.25); }
      }
    }
    // heads turned to the camera, as far as a neck goes, and tipped up to it: every face shows in the picture
    const fwd = new T.Vector3();
    function faceCamera(it) {
      if (!it.av) return;
      const head = it.av.parts.head;
      it.holder.updateWorldMatrix(true, false);
      it.holder.getWorldDirection(fwd);
      const turn = view.az - Math.atan2(fwd.x, fwd.z), yaw = Math.atan2(Math.sin(turn), Math.cos(turn)); // the camera, from where they face
      head.rotation.order = "YXZ";
      head.rotation.y = Math.max(-1.1, Math.min(1.1, yaw));
      head.rotation.x = -Math.max(-0.3, Math.min(0.6, view.el)) * (Math.abs(yaw) > 1.7 ? 0.3 : 0.8) + (it.nod || 0);
    }
    const lookAll = () => items.forEach(faceCamera);
    // everyone's head, from its own size up to twice as big (the slider)
    let headK = 1;
    function sizeHead(av) {
      const h = av.parts.head;
      if (!h.userData.base) h.userData.base = h.scale.clone();
      h.scale.copy(h.userData.base).multiplyScalar(headK);
    }
    // ---------- play: everyone moving in place to their pose, to a beat ----------
    const BEAT = 2; // beats a second: 120 a minute
    const LOOP_BEATS = 8;
    let playing = false, playT = 0, moved = false; // (moved: they've been moving, so pausing leaves them mid-move)
    // still again, in their poses, the floor and the ball as they were built
    function stillAgain() {
      items.forEach((it) => { it.nod = 0; if (it.model.position.y) it.model.position.y = 0; place(it); });
      if (amTiles && amTiles.userData.orig) { amTiles.geometry.attributes.color.array.set(amTiles.userData.orig); amTiles.geometry.attributes.color.needsUpdate = true; tileBeat = -1; }
      if (amLight) { amLight.angle = 0; updateLight(); }
    }
    function movePerson(it, t) {
      const av = it.av, P = av.parts, u = t * BEAT + hash01(it.id * 13 + 5) * 0.35; // (not all on the very same beat)
      const sway = Math.sin(Math.PI * u), hop = Math.abs(sway), beat = Math.sin(2 * Math.PI * u), flip = Math.sin((Math.PI * u) / 2) < 0;
      posePerson(av, it.pose, it.how);
      const sitting = it.how === "sit" || (it.pose === "sit" && it.how !== "stand");
      it.nod = 0.12 * hop;
      if (it.pose === "dance") { // stepping on the spot, arms pumping, turning a little
        av.setPose(Math.PI * u, true);
        P.armR.rotation.set(-1.9 + 0.45 * beat, 0, -0.7);
        P.armL.rotation.set(-0.5 - 0.45 * beat, 0, 0.8);
        av.rig.rotation.y = 0.3 * sway;
        return;
      }
      if (!sitting) av.rig.position.y += 0.05 * hop;
      if (it.pose === "wave") { P.armR.rotation.z = -0.35 + 0.5 * sway; av.rig.rotation.z += 0.04 * sway; }
      else if (it.pose === "waveL") { P.armL.rotation.z = 0.35 - 0.5 * sway; av.rig.rotation.z -= 0.04 * sway; }
      else if (it.pose === "cheer") { P.armR.rotation.x = P.armL.rotation.x = -2.9 + 0.35 * beat; if (!sitting) av.rig.position.y += 0.1 * hop; }
      else if (it.pose === "disco") { // the point, up to one side then the other, every two beats
        if (flip) {
          P.armL.rotation.set(-2.75, 0, 0.55); P.armR.rotation.set(-0.35, 0, -1.1);
          av.rig.rotation.z = 0.12; P.legR.rotation.z = 0; P.legL.rotation.z = 0.18; P.head.rotation.z = -0.15;
        }
      } else if (sitting) { P.armR.rotation.set(-1.3, 0, 0.3 - 0.3 * hop); P.armL.rotation.set(-1.3, 0, -0.3 + 0.3 * hop); } // clapping
      else { P.armR.rotation.x = 0.18 * sway; P.armL.rotation.x = -0.18 * sway; av.rig.rotation.z = 0.04 * sway; } // swaying
    }
    function moveBear(it, t) {
      const b = it.bear, u = t * BEAT + hash01(it.id * 13 + 5) * 0.35, sway = Math.sin(Math.PI * u), hop = Math.abs(sway), beat = Math.sin(2 * Math.PI * u), flip = Math.sin((Math.PI * u) / 2) < 0;
      const [aL, aR] = [b.arms[1], b.arms[0]];
      poseBear(b, it.pose);
      b.head.rotation.z += 0.08 * sway;
      it.model.position.y = it.pose === "cheer" ? 0.45 * hop : 0;
      if (it.pose === "wave") aR.rotation.z = -0.6 + 0.45 * sway;
      else if (it.pose === "cheer") aL.rotation.x = aR.rotation.x = -2.6 + 0.3 * beat;
      else if (it.pose === "disco") { if (flip) { aL.rotation.set(-2.75, 0, 0.55); aR.rotation.set(-0.35, 0, -1.1); b.hip.rotation.z = 0.12; b.head.rotation.z = -0.15; } }
      else if (it.pose === "floss") { aL.rotation.set(0.4 * beat, 0, 0.7 + 0.5 * sway); aR.rotation.set(-0.4 * beat, 0, -0.7 + 0.5 * sway); b.hip.rotation.z = -0.18 * sway; }
      else b.hip.rotation.z = 0.05 * sway;
    }
    let tileBeat = -1;
    function animate(t) {
      items.forEach((it) => {
        if (it.av) movePerson(it, t);
        else if (it.bear) moveBear(it, t);
        else if (it.prop) it.prop.rotation.z = t * 30;
        else if (it.model.userData.dj) it.model.userData.dj.update(t);
      });
      if (!amGroup || !stageOn) return;
      amLight.angle = (t / (LOOP_BEATS / BEAT)) * ((2 * Math.PI) / 7); // the ball turns, and its light with it: one repeat of the pattern every 8 beats
      updateLight();
      const n = ((Math.floor(t * BEAT) % LOOP_BEATS) + LOOP_BEATS) % LOOP_BEATS; // (8 sets of colours, round and round)
      if (n !== tileBeat && amTiles) { // the floor lights up in new colours on every beat
        tileBeat = n;
        const col = amTiles.geometry.attributes.color, per = col.count / amTiles.userData.tiles;
        for (let k = 0; k < amTiles.userData.tiles; k++) {
          const c = rgb(TILES[(hash01(k * 31 + n * 977) * TILES.length) | 0]);
          for (let v = 0; v < per; v++) col.setXYZ(k * per + v, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
      }
    }
    function setPlaying(on) {
      playing = !!on;
      const b = $("play-btn");
      b.textContent = playing ? "❚❚ Pause" : "▶ Play";
      b.classList.toggle("on", playing);
      if (!playing) items.forEach((it) => { if (it.model.position.y) it.model.position.y = 0; });
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
      if (av) sizeHead(av);
      model.traverse((o) => { if (o.isMesh) o.castShadow = !(o.material && o.material.transparent); });
      const foot = av ? null : new T.Box3().setFromObject(holder); // what it stands on (people: just their feet)
      const it = Object.assign({ id: nextId++, kind, ref, holder, model, av, bear, foot, prop: model.userData.prop || null, x: 0, y: 0, z: 0, rot: 0, scale: 1, pose: av ? "wave" : "stand", seat: null }, at || {});
      holder.userData.item = it;
      scene.add(holder);
      items.push(it);
      place(it);
      return it;
    }
    function removeItem(it, keep, quiet) {
      if (it.kind === "guest" && !keep) leftOut.add(it.ref);
      items.filter((o) => o.seat === it.id).forEach((o) => { o.seat = null; place(o); });
      if (it.holder.parent) it.holder.parent.remove(it.holder);
      if (it.av) it.av.dispose();
      items.splice(items.indexOf(it), 1);
      if (selected === it) select(null);
      if (!quiet) save();
    }
    // a new thing goes beside everything already on the stage (the vehicles side-on, so their shape shows)
    const WIDTH = { dj: 6, bear: 6.5, plane: 5, tank: 4.6, jeepney: 6, car0: 4, car1: 4, car2: 4, car3: 4, car4: 4 };
    function spotBeside(kind) {
      const turn = kind === "bear" || !WIDTH[kind] ? 0 : Math.PI / 2;
      if (stageOn) {
        if (kind === "bear") { const a = view.az + Math.PI, r = AM.floorR + 5.5 * AM.stepW; return { x: Math.sin(a) * r, z: Math.cos(a) * r, rot: view.az }; } // a giant: up behind everyone
        if (kind === "dj") return djSpot();
        const side = items.filter((i) => !i.av && !i.bear).length % 2 ? 1 : -1, a = view.az + side * (Math.PI / 2 + 0.2); // at the sides of the dance floor, not in front of anyone
        return { x: Math.sin(a) * 3.4, z: Math.cos(a) * 3.4, rot: view.az + turn };
      }
      let right = -Infinity;
      items.forEach((it) => { if (!it.seat) { const b = new T.Box3().setFromObject(it.holder); if (!b.isEmpty()) right = Math.max(right, b.max.x); } });
      const w = WIDTH[kind] || 1.2, x = (right === -Infinity ? 0 : right + 0.8) + w / 2;
      return { x, z: 0, rot: turn };
    }
    // the DJ desk: front and centre of the dance floor, its front (and the name) to the camera
    const djSpot = () => ({ x: Math.sin(view.az) * 2.2, z: Math.cos(view.az) * 2.2, rot: view.az });
    // where someone new goes: on the dance floor, facing the camera, or in rows out front
    function looseSpot(i) {
      if (stageOn) { const r = 0.95 * Math.sqrt(i + 0.5), a = i * 2.39996; return { x: Math.sin(a) * r, z: Math.cos(a) * r, rot: view.az, pose: "wave" }; }
      return { x: (i % 10 - 4.5) * 1.05, z: 4 + Math.floor(i / 10) * 1.3, pose: "wave" };
    }
    // where an item is drawn: free on the stage, or in a seat (a car's, the tank's hatch, the plane's cockpit, the bear's head)
    function place(it) {
      shadowsDirty = true;
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
        it.how = how;
        if (it.av) posePerson(it.av, it.pose, how);
        return;
      }
      if (it.holder.parent !== scene) scene.add(it.holder);
      if (stageOn) { const r = Math.hypot(it.x, it.z), most = AM.rimR - 1.2; if (r > most) { it.x *= most / r; it.z *= most / r; } } // not off the edge
      it.holder.position.set(it.x, groundAt(it) + it.y, it.z);
      it.holder.rotation.set(0, it.rot, 0);
      it.holder.scale.setScalar(it.scale);
      it.how = null;
      if (it.av) posePerson(it.av, it.pose);
      if (it.bear) poseBear(it.bear, it.pose);
    }

    // ---------- the panels ----------
    const $ = (id) => document.getElementById(id);
    const statusEl = $("status"), addEl = $("add"), selEl = $("sel"), scenesEl = $("scenes");
    function select(it) {
      selected = it;
      dirty = true;
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
      statusEl.textContent = "Now tap a car, the tank, the plane, the teddy bear or the DJ desk";
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
      scenesEl.hidden = true;
      barHeight();
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
        else { leftOut.delete(d.guest); addItem("guest", d.guest, looseSpot((Math.random() * 20) | 0)); }
        renderPeople();
        save();
        return;
      }
      if (d.all !== undefined) { // everyone in, or everyone out
        if (d.all === "1") { const on = new Set(items.filter((i) => i.kind === "guest").map((i) => i.ref)); [...guests.keys()].filter((id) => !on.has(id)).forEach((id, i) => { leftOut.delete(id); addItem("guest", id, looseSpot(i)); }); }
        else items.filter((i) => i.kind === "guest").forEach((i) => removeItem(i, false, true));
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
    $("view-btn").addEventListener("click", () => {
      const to = Math.abs(view.el - VIEWS.front.el) < 0.05 && Math.abs(view.az) < 0.05 ? "3d" : "front";
      view.az = VIEWS[to].az;
      view.el = VIEWS[to].el;
      $("view-btn").textContent = to === "3d" ? "Front view" : "3D view";
      frameAll();
      save();
    });
    $("reset-btn").addEventListener("click", () => { if (confirm("Start again from the group photo? (Anyone you left out stays out.)")) { [...items].forEach((i) => removeItem(i, true, true)); defaultLayout(); frameAll(); save(); } });
    $("stage-btn").addEventListener("click", () => { setStage(!stageOn); frameAll(); save(); });
    $("play-btn").addEventListener("click", () => setPlaying(!playing));
    function setHeads(pc) {
      headK = Math.max(1, Math.min(2, (+pc || 100) / 100));
      $("heads").value = Math.round(headK * 100);
      $("heads-val").textContent = Math.round(headK * 100) + "%";
      items.forEach((it) => { if (it.av) sizeHead(it.av); });
      dirty = shadowsDirty = true;
    }
    $("heads").addEventListener("input", (e) => setHeads(e.target.value));
    $("heads").addEventListener("change", save);
    // ---------- scenes: arrangements saved by name in this browser, or as a file to open anywhere ----------
    const SCENES = "fefe40.scenes";
    function scenesGet() {
      try { const a = JSON.parse(localStorage.getItem(SCENES) || "[]"); return Array.isArray(a) ? a.filter((o) => o && typeof o.name === "string" && o.s && Array.isArray(o.s.items)) : []; } catch (e) { return []; }
    }
    function keepScene(name, st) {
      const a = scenesGet().filter((o) => o.name !== name);
      a.unshift({ name, at: Date.now(), s: st });
      try { localStorage.setItem(SCENES, JSON.stringify(a.slice(0, 40))); return true; } catch (e) { return false; }
    }
    const when = (t) => new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    function renderScenes() {
      const a = scenesGet();
      $("scene-list").innerHTML = a.map((o, i) => '<div class="scene"><button type="button" data-open="' + i + '">' + esc(o.name) + "</button><span>" + esc(when(o.at)) + '</span><button type="button" class="small" data-del="' + i + '" aria-label="Delete">✕</button></div>').join("");
      $("scene-name").placeholder = "Scene " + (a.length + 1);
    }
    $("scenes-btn").addEventListener("click", () => {
      scenesEl.hidden = !scenesEl.hidden;
      addEl.hidden = true;
      barHeight();
      if (!scenesEl.hidden) renderScenes();
    });
    function saveScene() {
      const input = $("scene-name"), name = input.value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40) || input.placeholder;
      statusEl.textContent = keepScene(name, state()) ? "Saved \u201c" + name + "\u201d" : "Couldn't save here (private browsing?): download the scene file instead";
      input.value = "";
      input.blur();
      renderScenes();
    }
    $("scene-save").addEventListener("click", saveScene);
    $("scene-name").addEventListener("keydown", (e) => { if (e.key === "Enter") saveScene(); });
    $("scene-list").addEventListener("click", (e) => {
      const d = e.target.dataset || {}, a = scenesGet();
      if (d.open !== undefined && a[+d.open]) {
        const o = a[+d.open];
        if (!confirm("Open \u201c" + o.name + "\u201d? What's on the stage now is replaced.")) return;
        applyState(o.s);
        save();
        scenesEl.hidden = true;
        statusEl.textContent = "\u201c" + o.name + "\u201d";
      } else if (d.del !== undefined && a[+d.del]) {
        if (!confirm("Delete \u201c" + a[+d.del].name + "\u201d?")) return;
        a.splice(+d.del, 1);
        try { localStorage.setItem(SCENES, JSON.stringify(a)); } catch (err) { /* nothing kept anyway */ }
        renderScenes();
      }
    });
    $("scene-download").addEventListener("click", () => {
      const name = $("scene-name").value.trim() || "FiFi4000 scene", blob = new Blob([JSON.stringify({ fifi4000: "scene", name, at: Date.now(), s: state() })], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    $("scene-open").addEventListener("click", () => $("scene-file").click());
    // ---------- share links: the scene packed into the link itself; it opens as it is, playing ----------
    const r2d = (v) => Math.round((+v || 0) * 100) / 100;
    const packState = (st, name) => ({ v: 1, n: name || "", d: 1, st: st.stage ? 1 : 0, hd: st.heads || 100, lo: st.leftOut,
      vw: [st.view.az, st.view.el, st.view.size, ...st.view.t, (canvas.clientWidth || 1) / (canvas.clientHeight || 1)].map(r2d),
      it: st.items.map((o) => [o.id, o.kind === "guest" ? 0 : o.kind, o.ref || 0, r2d(o.x), r2d(o.z), r2d(o.rot), o.pose, r2d(o.y), r2d(o.scale), o.seat || 0]) });
    function unpackState(p) {
      if (!p || !Array.isArray(p.it)) return null;
      const vw = Array.isArray(p.vw) ? p.vw.map(Number) : [];
      return { stage: !!p.st, dj: !!p.d, heads: +p.hd || 100, leftOut: Array.isArray(p.lo) ? p.lo.filter((x) => typeof x === "string") : [],
        view: vw.length >= 6 && vw.every(Number.isFinite) ? { az: vw[0], el: vw[1], size: vw[2], t: vw.slice(3, 6), a: vw[6] } : null,
        items: p.it.filter(Array.isArray).map((a) => ({ id: a[0], kind: a[1] === 0 ? "guest" : String(a[1]), ref: a[1] === 0 ? String(a[2]) : null, x: +a[3], z: +a[4], rot: +a[5], pose: String(a[6] || "stand"), y: +a[7] || 0, scale: +a[8] || 1, seat: a[9] || null })) };
    }
    const b64u = (bytes) => { let t = ""; for (let i = 0; i < bytes.length; i++) t += String.fromCharCode(bytes[i]); return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
    const unb64u = (t) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const squeeze = async (bytes, how) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(how)).arrayBuffer());
    async function linkCode(st, name) {
      const json = new TextEncoder().encode(JSON.stringify(packState(st, name)));
      return window.CompressionStream ? "z" + b64u(await squeeze(json, new CompressionStream("deflate"))) : "j" + b64u(json);
    }
    async function readLinkCode(code) {
      const bytes = unb64u(code.slice(1));
      return JSON.parse(new TextDecoder().decode(code[0] === "z" ? await squeeze(bytes, new DecompressionStream("deflate")) : bytes));
    }
    $("scene-share").addEventListener("click", async () => {
      const name = $("scene-name").value.trim(), url = location.origin + location.pathname + "#s=" + (await linkCode(state(), name));
      window.fefeShareLink = url;
      try { if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ title: name || "FiFi4000", url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(url); statusEl.textContent = "Link copied: it opens this scene, playing"; } catch (e) { prompt("The link to this scene:", url); }
    });
    // a shared link's scene: as it was, made to fit this screen if it's narrower
    async function openLinked() {
      const m = /[#&]s=([zj][A-Za-z0-9_-]+)/.exec(location.hash || "");
      if (!m) return false;
      let p = null;
      try { p = await readLinkCode(m[1]); } catch (e) { p = null; }
      const st = unpackState(p);
      if (!st) return false;
      showShared(st, p.n);
      return true;
    }
    window.addEventListener("hashchange", () => { openLinked(); });
    function showShared(st, name) {
      applyState(st);
      const a = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
      if (st.view && st.view.a > a) { view.size *= st.view.a / a; applyCam(); }
      setPlaying(true);
      if (name) statusEl.textContent = name;
    }
    $("scene-file").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      let o = null;
      try { o = JSON.parse(await file.text()); } catch (err) { o = null; }
      const st = o && (o.s || o);
      if (!st || !Array.isArray(st.items)) { statusEl.textContent = "That isn't a scene file"; return; }
      const name = String((o && o.name) || file.name.replace(/\.json$/i, "")).slice(0, 40);
      applyState(st);
      save();
      keepScene(name, st);
      renderScenes();
      scenesEl.hidden = true;
      statusEl.textContent = "\u201c" + name + "\u201d";
    });
    $("save-btn").addEventListener("click", savePNG);
    $("gif-btn").addEventListener("click", saveGIF);
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

    // ---------- pointer: tap to pick, drag to move, drag the empty stage to turn the view, pinch or scroll to zoom ----------
    const ray = new T.Raycaster(), ndc = new T.Vector2(), pointers = new Map();
    let drag = null;
    function setRay(e) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
    }
    function hitItem(e) {
      setRay(e);
      const hits = ray.intersectObjects(items.map((i) => i.holder), true);
      for (const h of hits) { let o = h.object; while (o && !(o.userData && o.userData.item)) o = o.parent; if (o) return o.userData.item; }
      return null;
    }
    function groundPoint(e, y) {
      setRay(e);
      const p = new T.Vector3();
      return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -y), p) ? p : null;
    }
    // the amphitheater's ground under the pointer (not the parts cut away): stepping along the ray till it's under the top
    function terrainPoint(e) {
      setRay(e);
      const o = ray.ray.origin, d = ray.ray.direction;
      if (d.y > -0.01) return null;
      const t1 = (-0.01 - o.y) / d.y, dt = Math.min(0.1 / Math.max(Math.hypot(d.x, d.z), 1e-3), 0.05 / -d.y);
      for (let t = Math.max(0, (AM.top + 0.01 - o.y) / d.y); t <= t1; t += dt) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, c = cellAt(Math.floor(x * 2), Math.floor(z * 2));
        if (c && (c.sec < 0 || amSec[c.sec].visible) && y <= c.stand + 0.001) return new T.Vector3(x, c.stand, z);
      }
      return null;
    }
    const dragPoint = (e, it) => (stageOn ? terrainPoint(e) || groundPoint(e, AM.top) : groundPoint(e, it.y));
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      addEl.hidden = scenesEl.hidden = true;
      if (e.pointerType === "mouse" && e.button === 1) { e.preventDefault(); drag = { pan: true, at: [e.clientX, e.clientY], t: view.target.clone() }; return; } // the middle button: pan, and lift
      if (pointers.size === 2) { drag = { pinch: true, d: dist2(), size: view.size, at: mid2(), t: view.target.clone() }; return; } // two fingers: zoom, and pan and lift
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
        const p = dragPoint(e, it);
        drag = p ? { it, dx: it.x - p.x, dz: it.z - p.z, moved: false } : null;
      } else drag = { orbit: true, x: e.clientX, y: e.clientY, az: view.az, el: view.el, moved: false };
    });
    const dist2 = () => { const p = [...pointers.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1; };
    canvas.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!drag) return;
      if (drag.pan) { panBy(drag, e.clientX, e.clientY); return; }
      if (drag.pinch) { if (pointers.size === 2) { view.size = Math.max(2, Math.min(80, drag.size * drag.d / dist2())); const m = mid2(); panBy(drag, m[0], m[1]); } return; }
      if (drag.it) {
        const p = dragPoint(e, drag.it);
        if (!p) return;
        drag.it.x = p.x + drag.dx;
        drag.it.z = p.z + drag.dz;
        drag.moved = true;
        place(drag.it);
      } else if (drag.orbit) {
        view.az = drag.az - (e.clientX - drag.x) * 0.008;
        view.el = Math.max(stageOn ? 0.06 : -0.05, Math.min(1.35, drag.el + (e.clientY - drag.y) * 0.006));
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
        applyCam();
      }
    });
    const mid2 = () => { const p = [...pointers.values()]; return [(p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2]; };
    // sideways along the screen, and up and down (lifting the camera): the stage stays under the pointer
    function panBy(d, x, y) {
      const k = (2 * view.size) / (canvas.clientHeight || 1), right = new T.Vector3(Math.cos(view.az), 0, -Math.sin(view.az));
      view.target.copy(d.t).addScaledVector(right, -(x - d.at[0]) * k);
      view.target.y = d.t.y + ((y - d.at[1]) * k) / Math.max(0.3, Math.cos(view.el));
      d.moved = true;
      applyCam();
    }
    canvas.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); }); // (no scrolling arrows)
    canvas.addEventListener("auxclick", (e) => { if (e.button === 1) e.preventDefault(); });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (drag && (drag.pan || drag.pinch) && drag.moved && pointers.size === 0) save();
      if (drag && drag.orbit && !drag.moved) select(null); // a tap on the empty stage: nothing selected
      if (drag && drag.it && drag.moved) save();
      if (pointers.size === 0) drag = null;
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); view.size = Math.max(2, Math.min(80, view.size * Math.exp(e.deltaY * 0.001))); applyCam(); }, { passive: false });
    window.addEventListener("keydown", (e) => {
      if (!selected || selected.seat || /^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || "")) return;
      const k = e.key.toLowerCase();
      if (k === "q") { selected.rot += Math.PI / 12; place(selected); save(); }
      else if (k === "e") { selected.rot -= Math.PI / 12; place(selected); save(); }
      else if (k === "delete" || k === "backspace") removeItem(selected);
    });

    // ---------- the group photo to start from, and fitting the view round everyone ----------
    function defaultLayout() {
      const list = [...guests.entries()].filter(([id]) => !leftOut.has(id)).map(([id, g]) => ({ id, g })), fifi = list.filter((o) => isBirthdayBoy(o.g.name)), rest = list.filter((o) => !isBirthdayBoy(o.g.name)).sort((a, b) => b.g.look.h - a.g.look.h);
      const pose = (i, r) => ["wave", "waveL", "cheer", "wave"][(i * 7 + r * 3) % 4];
      if (stageOn) { // on the steps across the far side, facing the dance floor (and the camera), the tallest higher up
        rest.reverse();
        const far = view.az + Math.PI, gap = 1.05, span = 2.5, cap = (k) => Math.floor((span * (AM.floorR + (k - 0.5) * AM.stepW)) / gap) + 1;
        let rows = 1, room = cap(1);
        while (room < rest.length && rows < AM.steps) room += cap(++rows);
        const total = Array.from({ length: rows }, (_, k) => cap(k + 1)).reduce((a, b) => a + b, 0), n = Array.from({ length: rows }, (_, k) => Math.floor((rest.length * cap(k + 1)) / total));
        for (let k = rows - 1, left = rest.length - n.reduce((a, b) => a + b, 0); left > 0; k = (k + rows - 1) % rows, left--) n[k]++;
        let at = 0;
        n.forEach((count, k) => {
          const r = AM.floorR + (k + 0.5) * AM.stepW;
          rest.slice(at, at + count).forEach((o, i) => {
            const a = far + ((i - (count - 1) / 2) * gap) / r, x = Math.sin(a) * r, z = Math.cos(a) * r;
            addItem("guest", o.id, { x, z, rot: Math.atan2(-x, -z) + Math.sin(i * 1.7 + k) * 0.1, pose: pose(i, k) });
          });
          at += count;
        });
        fifi.forEach((o, i) => addItem("guest", o.id, { x: (i - (fifi.length - 1) / 2) * 1.1, z: 0, rot: view.az, pose: "disco" })); // the birthday boy, dancing in the middle
        addItem("dj", null, djSpot());
        return;
      }
      const N = list.length, rows = Math.max(1, Math.round(Math.sqrt(N / 1.6))), sizes = Array.from({ length: rows }, (_, r) => Math.floor(N / rows) + (r < N % rows ? 1 : 0));
      let k = 0;
      sizes.forEach((n, r) => {
        const last = r === rows - 1, take = last ? n - fifi.length : n, row = rest.slice(k, k + take);
        k += take;
        const line = last ? row.slice(0, Math.floor(row.length / 2)).concat(fifi, row.slice(Math.floor(row.length / 2))) : row, depth = rows - 1 - r;
        line.forEach((o, i) => addItem("guest", o.id, { x: (i - (line.length - 1) / 2) * 1.05 + (depth % 2 ? 0.52 : 0), y: 0, z: -depth * 1.45, rot: Math.sin(i * 1.7 + r) * 0.12, pose: pose(i, r) }));
      });
    }
    // everything there is, seen from the camera (and the shadows people throw on the ground)
    function contentBox(camera) {
      const bb = new T.Box3(), v = new T.Vector3(), inv = camera.matrixWorldInverse;
      scene.updateMatrixWorld(true);
      const add = (b, shadow) => {
        if (b.isEmpty()) return;
        for (let i = 0; i < 8; i++) {
          v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
          if (shadow) bb.expandByPoint(v.clone().addScaledVector(SUN, -v.y / SUN.y).applyMatrix4(inv)); // where its shadow falls
          bb.expandByPoint(v.applyMatrix4(inv));
        }
      };
      items.forEach((it) => add(new T.Box3().setFromObject(it.holder), !stageOn));
      if (stageOn) amGroup.children.forEach((m) => { if (m.visible) add(new T.Box3().setFromObject(m), false); });
      return bb;
    }
    function frameAll() {
      if (!items.length && !stageOn) return;
      applyCam();
      const bb = contentBox(cam), cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
      const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), upv = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      view.target.addScaledVector(right, cx).addScaledVector(upv, cy);
      const a = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
      view.size = Math.max(2, Math.max((bb.max.y - bb.min.y) / 2, (bb.max.x - bb.min.x) / 2 / a) * 1.08);
      applyCam();
    }

    // ---------- keeping the arrangement (in this browser), and the picture ----------
    const KEY = "fefe40.arrange3"; // (3: the amphitheater; the arrangement from before it is kept as a scene)
    const state = () => ({ stage: stageOn, dj: 1, heads: Math.round(headK * 100), leftOut: [...leftOut], view: { az: view.az, el: view.el, size: view.size, t: view.target.toArray() },
      items: items.map((it) => ({ id: it.id, kind: it.kind, ref: it.ref, x: it.x, y: it.y, z: it.z, rot: it.rot, scale: it.scale, pose: it.pose, seat: it.seat })) });
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(state())); } catch (e) { /* private browsing: it just isn't kept */ }
    }
    // put a kept arrangement on the stage, in place of what's there
    function applyState(s) {
      [...items].forEach((i) => removeItem(i, true, true));
      select(null);
      leftOut.clear();
      if (Array.isArray(s.leftOut)) s.leftOut.forEach((id) => { if (guests.has(id)) leftOut.add(id); });
      setStage(!!s.stage);
      setHeads(s.heads || 100);
      const v = s.view || {};
      view.az = Number.isFinite(+v.az) ? +v.az : VIEWS["3d"].az;
      view.el = Number.isFinite(+v.el) ? +v.el : VIEWS["3d"].el;
      view.size = +v.size || 9;
      if (Array.isArray(v.t) && v.t.length === 3 && v.t.every((n) => Number.isFinite(+n))) view.target.fromArray(v.t.map(Number));
      applyCam();
      const ids = new Map();
      (Array.isArray(s.items) ? s.items : []).forEach((o) => {
        if (!o || (o.kind === "guest" ? !guests.has(o.ref) : !Object.prototype.hasOwnProperty.call(THINGS, o.kind))) return;
        if (o.kind === "guest" && items.some((i) => i.kind === "guest" && i.ref === o.ref)) return;
        const it = addItem(o.kind, o.ref, { x: +o.x || 0, y: Math.max(0, +o.y || 0), z: +o.z || 0, rot: +o.rot || 0, scale: Math.max(0.3, Math.min(6, +o.scale || 1)), pose: typeof o.pose === "string" ? o.pose : "stand" });
        ids.set(o.id, it);
        it.savedSeat = o.seat;
      });
      items.forEach((it) => { if (it.savedSeat && ids.has(it.savedSeat) && ids.get(it.savedSeat) !== it) it.seat = ids.get(it.savedSeat).id; delete it.savedSeat; place(it); });
      if (stageOn && !s.dj && !items.some((i) => i.kind === "dj")) addItem("dj", null, djSpot()); // the DJ desk, the first time
      // anyone who signed up since: out front
      const on = new Set(items.filter((i) => i.kind === "guest").map((i) => i.ref)), fresh = [...guests.keys()].filter((id) => !on.has(id) && !leftOut.has(id));
      fresh.forEach((id, i) => addItem("guest", id, looseSpot(i)));
      if (!s.view) frameAll();
      $("view-btn").textContent = Math.abs(view.el - VIEWS.front.el) < 0.05 && Math.abs(view.az) < 0.05 ? "3D view" : "Front view";
    }
    function restore() {
      const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
      const s = read(KEY);
      if (s && Array.isArray(s.items) && s.items.length) { applyState(s); return true; }
      const old = read("fefe40.arrange2"); // the arrangement from before the amphitheater: kept as a scene
      if (old && Array.isArray(old.items) && old.items.length && !scenesGet().some((o) => o.name === "Before the amphitheater")) keepScene("Before the amphitheater", Object.assign({}, old, { stage: false }));
      if (s && Array.isArray(s.leftOut)) s.leftOut.forEach((id) => { if (guests.has(id)) leftOut.add(id); });
      return false;
    }
    // Drawing off screen, for the PNG and the GIF: what's on screen, trimmed to where the picture is
    async function offscreen(shadowSize) {
      grid.visible = ring.visible = false;
      await Promise.all(items.filter((i) => i.av && i.av.ready).map((i) => i.av.ready));
      applyCam();
      const cam2 = cam.clone(), L = cam2.left, B = cam2.bottom, fw = cam2.right - cam2.left, fh = cam2.top - cam2.bottom;
      const cv = document.createElement("canvas"), r2 = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, preserveDrawingBuffer: true });
      const gl = r2.getContext(), most = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0], 4800);
      const fit = (w, h, long) => (w >= h ? [long, Math.max(1, Math.round((long * h) / w))] : [Math.max(1, Math.round((long * w) / h)), long]);
      r2.setPixelRatio(1);
      r2.setClearColor(0x000000, 0);
      r2.shadowMap.enabled = true;
      r2.shadowMap.type = T.PCFSoftShadowMap;
      fitShadows();
      const freshShadows = () => { if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }; // each renderer makes its own
      freshShadows();
      key.shadow.mapSize.set(shadowSize, shadowSize);
      lookAll();
      // a small one first, to find where the picture is (rows of pixels count up from the bottom, like the camera)
      const [w, h] = fit(fw, fh, 480);
      r2.setSize(w, h, false);
      r2.render(scene, cam2);
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= 0) {
        const pad = 2;
        Object.assign(cam2, { left: L + (Math.max(0, x0 - pad) / w) * fw, right: L + (Math.min(w, x1 + 1 + pad) / w) * fw, bottom: B + (Math.max(0, y0 - pad) / h) * fh, top: B + (Math.min(h, y1 + 1 + pad) / h) * fh });
        cam2.updateProjectionMatrix();
      }
      return {
        r2, gl, cv, cam2, most,
        size: (long) => { const [W, H] = fit(cam2.right - cam2.left, cam2.top - cam2.bottom, long); r2.setSize(W, H, false); return [W, H]; },
        done() {
          r2.dispose();
          freshShadows();
          key.shadow.mapSize.set(2048, 2048);
          grid.visible = !stageOn;
          ring.visible = !!selected;
          dirty = true;
        }
      };
    }
    function download(href, name) {
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    // Save PNG: drawn big on a see-through background
    async function savePNG() {
      statusEl.textContent = "Drawing the picture…";
      const o = await offscreen(4096), [w, h] = o.size(o.most);
      o.r2.render(scene, o.cam2);
      const url = o.cv.toDataURL("image/png");
      o.done();
      download(url, "fifi4000-arrangement.png");
      statusEl.textContent = "Saved: " + w + " × " + h + " pixels, see-through background";
      window.fefeArrange = { W: w, H: h, png: url };
    }
    // Save GIF: the dance, small, as a loop that goes round without a jump (8 beats: every move comes back to where it
    // started, the floor's colours too, and the ball turns one repeat of its pattern of spots)
    const GIF_LONG = 480, GIF_FRAMES = 50, GIF_BG = [11, 42, 85]; // 50 frames, 8/100 s each: the 4 seconds of 8 beats
    let capturing = false;
    async function saveGIF() {
      if (capturing) return;
      capturing = true;
      $("gif-btn").disabled = true;
      statusEl.textContent = "Making the GIF…";
      const wasT = playT, wasMoving = moved;
      try {
        const o = await offscreen(2048), [w, h] = o.size(GIF_LONG), px = new Uint8Array(w * h * 4), frames = [];
        const t0 = Math.floor(playT * BEAT) / BEAT, span = LOOP_BEATS / BEAT;
        for (let f = 0; f < GIF_FRAMES; f++) {
          animate(t0 + (f * span) / GIF_FRAMES);
          lookAll();
          o.r2.render(scene, o.cam2);
          o.gl.readPixels(0, 0, w, h, o.gl.RGBA, o.gl.UNSIGNED_BYTE, px);
          const rgb3 = new Uint8Array(w * h * 3); // the right way up, on the page's blue
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = ((h - 1 - y) * w + x) * 4, j = (y * w + x) * 3, k = 1 - px[i + 3] / 255;
            rgb3[j] = px[i] + GIF_BG[0] * k; rgb3[j + 1] = px[i + 1] + GIF_BG[1] * k; rgb3[j + 2] = px[i + 2] + GIF_BG[2] * k;
          }
          frames.push(rgb3);
          if (f % 5 === 4) { statusEl.textContent = "Making the GIF… " + Math.round(((f + 1) / GIF_FRAMES) * 80) + "%"; await new Promise((r) => setTimeout(r, 0)); }
        }
        o.done();
        statusEl.textContent = "Making the GIF… 85%";
        await new Promise((r) => setTimeout(r, 0));
        const gif = encodeGIF(w, h, frames, 8);
        const url = URL.createObjectURL(new Blob([gif], { type: "image/gif" }));
        download(url, "fifi4000-dance.gif");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        statusEl.textContent = "Saved: a " + w + " × " + h + " GIF, " + Math.max(1, Math.round(gif.length / 1024)) + " KB";
        window.fefeArrange = { W: w, H: h, gif: url, bytes: gif.length };
      } finally {
        // back as it was: still, or moving from where it had got to
        if (wasMoving) animate(wasT); else stillAgain();
        capturing = false;
        $("gif-btn").disabled = false;
        dirty = true;
      }
    }
    // A GIF: one palette for all the frames (median cut), each frame only where it changed (the rest see-through, so
    // the frame before shows), LZW-packed
    function encodeGIF(w, h, frames, delay) {
      // the palette: 255 colours from a sample of the frames; 255 stays free for "unchanged"
      const pick = [0, 12, 25, 37].filter((f) => f < frames.length), S = [];
      pick.forEach((f) => { const fr = frames[f]; for (let i = 0; i < w * h; i += 3) S.push(fr[i * 3], fr[i * 3 + 1], fr[i * 3 + 2]); });
      const samples = Uint8Array.from(S), boxes = [{ ids: Uint32Array.from({ length: samples.length / 3 }, (_, i) => i) }];
      const measure = (b) => { let best = -1; for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (const i of b.ids) { const v = samples[i * 3 + c]; if (v < lo) lo = v; if (v > hi) hi = v; } if (hi - lo > best) { best = hi - lo; b.ch = c; } } b.range = best; return b; };
      measure(boxes[0]);
      while (boxes.length < 255) {
        let bi = -1, score = 0;
        boxes.forEach((b, i) => { const sc = b.range * Math.sqrt(b.ids.length); if (b.ids.length > 1 && sc > score) { score = sc; bi = i; } });
        if (bi < 0) break;
        const b = boxes[bi], ch = b.ch, ids = Array.from(b.ids).sort((p, q) => samples[p * 3 + ch] - samples[q * 3 + ch]), mid = ids.length >> 1;
        boxes.splice(bi, 1, measure({ ids: Uint32Array.from(ids.slice(0, mid)) }), measure({ ids: Uint32Array.from(ids.slice(mid)) }));
      }
      const pal = new Uint8Array(256 * 3);
      boxes.forEach((b, k) => { for (let c = 0; c < 3; c++) { let sum = 0; for (const i of b.ids) sum += samples[i * 3 + c]; pal[k * 3 + c] = Math.round(sum / b.ids.length); } });
      const n = boxes.length, near = new Int16Array(32768).fill(-1);
      const index = (r, g, b) => {
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        if (near[key] >= 0) return near[key];
        let best = 0, bd = Infinity;
        const R = (r & 0xf8) + 4, G = (g & 0xf8) + 4, B = (b & 0xf8) + 4;
        for (let k = 0; k < n; k++) { const dr = pal[k * 3] - R, dg = pal[k * 3 + 1] - G, db = pal[k * 3 + 2] - B, d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (d < bd) { bd = d; best = k; } }
        return (near[key] = best);
      };
      const out = [];
      const bytes = (...a) => a.forEach((v) => out.push(v & 255));
      const word = (v) => bytes(v, v >> 8);
      "GIF89a".split("").forEach((c) => out.push(c.charCodeAt(0)));
      word(w); word(h); bytes(0xf7, 0, 0); // a 256-colour palette for all of it
      for (let i = 0; i < 768; i++) out.push(pal[i]);
      bytes(0x21, 0xff, 11); "NETSCAPE2.0".split("").forEach((c) => out.push(c.charCodeAt(0))); bytes(3, 1, 0, 0, 0); // round and round
      let shown = null;
      frames.forEach((fr, f) => {
        const idx = new Uint8Array(w * h), now = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) { const k = index(fr[i * 3], fr[i * 3 + 1], fr[i * 3 + 2]); now[i] = k; idx[i] = shown && shown[i] === k ? 255 : k; }
        shown = now;
        bytes(0x21, 0xf9, 4, f ? 0x05 : 0x04); word(delay); bytes(255, 0); // keep the frame before; 255 is see-through
        bytes(0x2c); word(0); word(0); word(w); word(h); bytes(0);
        bytes(8);
        const data = lzw(idx, 8);
        for (let i = 0; i < data.length; i += 255) { const part = data.slice(i, i + 255); out.push(part.length); for (const v of part) out.push(v); }
        out.push(0);
      });
      out.push(0x3b);
      return Uint8Array.from(out);
    }
    function lzw(idx, minSize) {
      const clear = 1 << minSize, eoi = clear + 1, out = [];
      let size = minSize + 1, next = eoi + 1, table = new Map(), cur = 0, bits = 0;
      const put = (code) => { cur |= code << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
      put(clear);
      let pre = idx[0];
      for (let i = 1; i < idx.length; i++) {
        const k = idx[i], keyed = (pre << 8) | k, code = table.get(keyed);
        if (code !== undefined) { pre = code; continue; }
        put(pre);
        if (next === 4096) { put(clear); next = eoi + 1; size = minSize + 1; table = new Map(); }
        else { if (next >= 1 << size) size++; table.set(keyed, next++); }
        pre = k;
      }
      put(pre);
      put(eoi);
      if (bits > 0) out.push(cur & 255);
      return out;
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
    const clean = (t) => String(t || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 20);
    async function loadGuests() {
      const pastOnes = [];
      statusEl.textContent = "Loading the guests…";
      const idx = await fetch(DB_URL + "/fefe40/index.json", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      const ids = Object.keys(idx || {}).filter((id) => /^[a-z0-9]{6,24}$/.test(id));
      for (let i = 0; i < ids.length; i += 8) {
        await Promise.all(ids.slice(i, i + 8).map(async (id) => {
          const r = await fetch(DB_URL + "/fefe40/guests/" + id + ".json", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
          if (!r || typeof r.name !== "string") return;
          const name = clean(r.name) || "Guest";
          guests.set(id, { name, look: lookOf(r) });
          // the looks they had before (kept when their face changed): extra people for the picture
          (Array.isArray(r.past) ? r.past : []).slice(0, 4).forEach((o, k) => {
            if (!o || typeof o !== "object" || !faceOk(o.face)) return;
            const was = clean(o.name) || name;
            pastOnes.push([id + "~" + k, { name: was.toLowerCase() === name.toLowerCase() ? name + (k ? " (before " + (k + 1) + ")" : " (before)") : was, look: lookOf(o), past: true }]);
          });
        }));
        statusEl.textContent = "Loading the guests… " + guests.size + " of " + ids.length;
      }
      const faces = new Set([...guests.values()].map((g) => g.look.face).filter(Boolean));
      pastOnes.forEach(([id, g]) => { if (!faces.has(g.look.face)) { faces.add(g.look.face); guests.set(id, g); } }); // (not someone who's here anyway)
    }
    (async function start() {
      resize();
      await loadGuests();
      const linked = await openLinked();
      if (linked) { /* a shared scene */ }
      else if (!restore()) {
        const def = await fetch("arrange-default.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null), st = unpackState(def);
        if (st) showShared(st, "");
        else { setStage(true); defaultLayout(); frameAll(); }
        save();
      }
      const before = [...guests.values()].filter((g) => g.past).length;
      statusEl.textContent = guests.size - before + (guests.size - before === 1 ? " guest" : " guests") + (before ? ", " + before + (before === 1 ? " earlier look" : " earlier looks") : "") + ". Tap someone to pose them; drag to move.";
      setPlaying(true); // it opens dancing
      let last = 0, prev = 0;
      (function loop(now) {
        requestAnimationFrame(loop);
        const dt = Math.min(0.1, (now - prev) / 1000 || 0);
        prev = now;
        if (playing && !capturing) { playT += dt; moved = true; animate(playT); dirty = true; }
        if (capturing) return;
        if (shadowsDirty) { shadowsDirty = false; fitShadows(); dirty = true; }
        if (!dirty && now - last < 500) return; // (and twice a second anyway, for faces that load late)
        dirty = false;
        last = now;
        lookAll();
        if (selected) {
          const p = selected.holder.getWorldPosition(new T.Vector3());
          ring.position.set(p.x, p.y + 0.03, p.z);
          ring.scale.setScalar((selected.bear ? 4 : selected.av ? 1 : 2.6) * (selected.seat ? 1 : selected.scale));
        }
        renderer.render(scene, cam);
      })(0);
      window.fefeArrangeDebug = { items: () => items.map((i) => [i.kind, i.ref && guests.get(i.ref) ? guests.get(i.ref).name : "", +i.x.toFixed(2), +i.z.toFixed(2), i.pose, i.seat]), add: (kind) => select(addItem(kind, null, spotBeside(kind))), select: (n) => select(items[n]), seatIn: (a, b) => { items[a].seat = items[b].id; place(items[a]); }, savePNG, frameAll, play: (on, t) => { setPlaying(on); if (t !== undefined) { playT = t; animate(t); dirty = true; } }, heads: setHeads, stage: (on) => { setStage(on); frameAll(); }, state, applyState, scenes: scenesGet, view: (az, el, size) => { Object.assign(view, { az, el, size: size || view.size }); applyCam(); },
        feet: (n) => +items[n].holder.position.y.toFixed(3), onScreen: (n) => { const p = items[n].holder.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 1, 0)).project(cam), r = canvas.getBoundingClientRect(); return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height]; } };
    })();
  })();
