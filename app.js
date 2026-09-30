/* FEFE40: the block map of Casa Anahao, the party avatars and their recorded walks. */
(() => {
  const app = document.getElementById("app");
  const canvas = document.getElementById("scene");

  function webglOK() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }
  if (!window.THREE || !webglOK()) {
    document.getElementById("fallback").hidden = false;
    document.getElementById("hint").hidden = true;
    return;
  }
  const T = window.THREE;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  // Building ~100k voxels takes a moment, so let the page paint its HUD first.
  const hintEl = document.getElementById("hint");
  const readyHint = hintEl.textContent;
  hintEl.textContent = "Stacking blocks…";
  requestAnimationFrame(() => setTimeout(main, 20));

  function main() {

    // ---------- small utilities ----------
    function mulberry(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const rnd = mulberry(40);
    const pick = (a) => a[(rnd() * a.length) | 0];
    function hash(x, z) {
      let h = (x * 374761393 + z * 668265263) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    const C = {
      grass: ["#63C04A", "#58B743", "#6FC957", "#4FAA3E"],
      dirt: "#8B5E3C", dirtDark: "#6E4A2F", bedrock: "#7C7F86",
      hedge: ["#2F8A3A", "#277A33", "#379642"], hedgeTop: "#4FAE4A",
      stone: "#DCCFB4", stone2: "#CFC0A2",
      deck: "#E8D8B4", deck2: "#DCCAA2", coping: "#F4EEDF",
      gravel: "#B3AEA4", gravel2: "#A39E94",
      poolTile: "#1D86C6", tileDeep: "#1A74B0", tileLight: "#58C6E8",
      water: "#3CC3EA", waterKids: "#7ADDF2",
      floorWood: "#B98552", floorWood2: "#AD7A48", deckWood: "#9C6B3F",
      wood: "#8B5A2B", woodDark: "#5C3A1C", woodLight: "#C79560",
      stoneWall: "#CDBB98", plaster: "#F4EAD3", capiz: "#FFFFFF",
      roof: ["#C9562E", "#B64A27"], roofRidge: "#8E3A1E", thatch: ["#D6AE62", "#C79D52"], thatchRidge: "#9C7A3A",
      terra: "#C88A5C", terra2: "#BC7F52",
      tileW: "#F2F5F7", tileB: "#9FD3F0",
      white: "#F7F7F4", black: "#23252B", metal: "#A9B0B8", metalLight: "#DCE1E6",
      blue: "#006AA7", yellow: "#FECC02", fefe: "#FEFE40",
      bedBlue: "#2F6FD1", bedWhite: "#F4F1EA", pillow: "#FFFFFF",
      leaf: ["#2E8B3A", "#3A9E45", "#267A32", "#44A84C"], leafLight: "#5DBE51", leafDark: "#1F6A2B", palm: ["#4DB356", "#3FA24A", "#58BF5F"],
      trunk: "#7A5230", palmTrunk: "#A0804F", palmTrunkDark: "#86683E", coconut: "#6B4A2A", tuft: ["#4AA63F", "#5DB84A"],
      bloom: ["#FF4FA3", "#FF3B6B", "#FF8A1F", "#B15CFF", "#FFD23F", "#FFFFFF"],
      court: "#2D6FB8", courtOut: "#3E9A5E", line: "#FFFFFF", orange: "#FF7A1A", red: "#E23D3D", green: "#3FAE4F",
      sand: "#EAD49B", sand2: "#E2CA8C",
      felt: "#1F8A55", screen: "#7FD8FF", screenPink: "#FF6FB5", bulb: "#FFE58A", mirror: "#CBEAF7",
      car: ["#E23D3D", "#F4F4F4", "#2F6FD1", "#FECC02", "#23252B"], glassCar: "#27435E", tire: "#1E1F22", chrome: "#D6DADF",
      food: ["#FFF6E0", "#C0622B", "#6DBE45", "#F2A33A", "#E0463C", "#8C4FB0", "#F7D46B"],
      clearGlass: "#CFEFFF", pot: "#B5653A"
    };

    // ---------- the voxel world ----------
    // Design coordinates are metres: x runs east, z runs south, y up, y = 0 is the ground layer.
    // Voxels are half a metre, so every one-metre block is 2 × 2 × 2 = 8 voxels. Voxel coords (u, v, w) = 2 × metres.
    const GX0 = -8, GX1 = 151, GY0 = -8, GY1 = 40, GZ0 = -8, GZ1 = 119;
    const NX = GX1 - GX0 + 1, NY = GY1 - GY0 + 1, NZ = GZ1 - GZ0 + 1;
    const vCol = new Uint32Array(NX * NY * NZ);
    const vMeta = new Uint8Array(NX * NY * NZ); // bits 0-2 kind (0 = empty), bits 3-6 group, bit 7 grass
    const vi = (u, v, w) => ((v - GY0) * NZ + (w - GZ0)) * NX + (u - GX0);
    const inGrid = (u, v, w) => u >= GX0 && u <= GX1 && v >= GY0 && v <= GY1 && w >= GZ0 && w <= GZ1;
    const GROUPS = ["base"];
    function gid(g) {
      let i = GROUPS.indexOf(g);
      if (i < 0) { i = GROUPS.length; GROUPS.push(g); }
      return i;
    }
    const KIND = { solid: 1, glass: 2 };
    const hexCache = {};
    const rgbOf = (hex) => (hexCache[hex] !== undefined ? hexCache[hex] : (hexCache[hex] = parseInt(hex.slice(1), 16)));
    const jr = mulberry(9);
    function tint(c, j) {
      if (!j) return c;
      const f = 0.93 + jr() * 0.12;
      return (Math.min(255, ((c >> 16) & 255) * f) << 16) | (Math.min(255, ((c >> 8) & 255) * f) << 8) | Math.min(255, (c & 255) * f);
    }
    function setV(u, v, w, color, o) {
      if (!inGrid(u, v, w)) return;
      o = o || {};
      const i = vi(u, v, w);
      vCol[i] = tint(rgbOf(color), o.j !== false);
      vMeta[i] = KIND[o.kind || "solid"] | (gid(o.group || "base") << 3) | (o.tag === "g" ? 128 : 0);
    }
    const metaV = (u, v, w) => (inGrid(u, v, w) ? vMeta[vi(u, v, w)] : 0);
    function clearV(u, v, w) { if (inGrid(u, v, w)) vMeta[vi(u, v, w)] = 0; }
    // One metre block. A colour function is called per voxel with voxel coordinates, so patterns come out at half-metre detail.
    function put(x, y, z, color, o) {
      for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) {
        const u = 2 * x + dx, v = 2 * y + dy, w = 2 * z + dz;
        setV(u, v, w, typeof color === "function" ? color(u, v, w) : color, o);
      }
    }
    function del(x, y, z) {
      for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) clearV(2 * x + dx, 2 * y + dy, 2 * z + dz);
    }
    function isEmpty(x, y, z) {
      for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) if (metaV(2 * x + dx, 2 * y + dy, 2 * z + dz)) return false;
      return true;
    }
    function isGrass(x, z) {
      for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) if (!(metaV(2 * x + dx, 1, 2 * z + dz) & 128)) return false;
      return true;
    }
    function fill(x0, y0, z0, x1, y1, z1, color, o) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
          for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) put(x, y, z, color, o);
    }
    // Voxel box on the half-metre grid (min corner + size in metres).
    function vbox(x, y, z, w, h, d, color, o) {
      const u0 = Math.round(x * 2), u1 = Math.round((x + w) * 2), v0 = Math.round(y * 2), v1 = Math.round((y + h) * 2);
      const w0 = Math.round(z * 2), w1 = Math.round((z + d) * 2);
      for (let v = v0; v < v1; v++) for (let ww = w0; ww < w1; ww++) for (let u = u0; u < u1; u++)
        setV(u, v, ww, typeof color === "function" ? color(u, v, ww) : color, o);
    }
    // Free-sized detail box (furniture, strings, bulbs) drawn outside the voxel grid.
    const props = [];
    function box(x, y, z, w, h, d, color, o) {
      o = o || {};
      props.push({ x, y, z, w, h, d, color, kind: o.kind || "solid", group: o.group || "base", j: o.j !== false });
    }
    const glow = { kind: "glow", j: false };

    function cellSet(list) { return new Set((list || []).map((p) => p[0] + "," + p[1])); }
    // Walls: the first row always stays; everything above it lives in "<id>:upper" so it can fade for a cutaway view.
    // spec.plinth paints a stone skirting, spec.beam a dark timber band along the top, and windows get sills and lintels.
    function walls(id, x0, z0, x1, z1, y0, h, color, spec) {
      spec = spec || {};
      const doors = cellSet(spec.doors), wins = cellSet(spec.windows), hatch = cellSet(spec.hatch);
      const line = x0 === x1 || z0 === z1;
      const up = { group: id + ":upper" };
      const low = { group: spec.allUpper ? id + ":upper" : "base" };
      const trim = spec.trim || C.woodDark;
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          if (!line && x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
          const k = x + "," + z;
          const corner = !line && (x === x0 || x === x1) && (z === z0 || z === z1);
          for (let dy = 0; dy < h; dy++) {
            const y = y0 + dy;
            const group = dy === 0 && !spec.allUpper ? "base" : id + ":upper";
            if (doors.has(k) && dy < 3) continue;
            if (hatch.has(k) && (dy === 1 || dy === 2)) continue;
            if (!corner && wins.has(k) && (dy === 1 || dy === 2)) {
              put(x, y, z, C.capiz, { kind: "glass", group, j: false });
              continue;
            }
            put(x, y, z, corner && spec.corner ? spec.corner : color, { group });
          }
          if (corner) continue;
          const u0 = 2 * x, w0 = 2 * z;
          if (spec.plinth && !doors.has(k)) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) setV(u0 + a, 2 * y0, w0 + b, spec.plinth, low);
          if (spec.beam) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) setV(u0 + a, 2 * (y0 + h) - 1, w0 + b, spec.beam, up);
          if (!line && wins.has(k)) {
            const nx = x === x0 ? -1 : x === x1 ? 1 : 0, nz = z === z0 ? -1 : z === z1 ? 1 : 0;
            const outs = nx
              ? [[nx < 0 ? u0 - 1 : u0 + 2, w0], [nx < 0 ? u0 - 1 : u0 + 2, w0 + 1]]
              : [[u0, nz < 0 ? w0 - 1 : w0 + 2], [u0 + 1, nz < 0 ? w0 - 1 : w0 + 2]];
            outs.forEach(([ou, ow]) => {
              setV(ou, 2 * (y0 + 1) - 1, ow, trim, low);
              if (!spec.allUpper) setV(ou, 2 * (y0 + 3), ow, trim, up);
            });
          }
        }
      }
    }
    // Stepped hip roof of half-metre slabs, with a dark eave fascia or a shaggy thatch fringe and a ridge cap.
    function hipRoof(id, x0, z0, x1, z1, y, colors, opt) {
      opt = opt || {};
      const g = { group: id + ":roof" };
      for (let i = 0; ; i++) {
        const a = x0 + i, b = x1 - i, c = z0 + i, d = z1 - i;
        if (a > b || c > d) break;
        const last = a + 1 > b - 1 || c + 1 > d - 1;
        for (let x = a; x <= b; x++) {
          for (let z = c; z <= d; z++) {
            if (!last && x > a && x < b && z > c && z < d) continue;
            vbox(x, y + i * 0.5, z, 1, 0.5, 1, last ? opt.ridge || colors[1] : colors[i % colors.length], g);
          }
        }
        if (last) break;
      }
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
          for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
            const u = 2 * x + a, w = 2 * z + b;
            const outer = (x === x0 && a === 0) || (x === x1 && a === 1) || (z === z0 && b === 0) || (z === z1 && b === 1);
            if (opt.shaggy) { if (outer && rnd() < 0.6) setV(u, 2 * y - 1, w, colors[i2(u, w)], g); }
            else setV(u, 2 * y - 1, w, C.woodDark, g);
          }
        }
      }
      function i2(u, w) { return (u + w) & 1; }
    }

    // ---------- furniture ----------
    function bed(x, z, w, l, fy, blanket) {
      box(x + 0.05, fy, z + 0.05, w - 0.1, 0.45, l - 0.1, C.woodDark);
      box(x + 0.1, fy + 0.45, z + 0.1, w - 0.2, 0.25, l - 0.2, C.bedWhite);
      box(x + 0.08, fy + 0.62, z + 0.95, w - 0.16, 0.14, l - 1.05, blanket);
      for (let i = 0; i < w; i++) box(x + i + 0.15, fy + 0.7, z + 0.2, 0.7, 0.18, 0.5, C.pillow);
      box(x + 0.02, fy, z, w - 0.04, 1.3, 0.15, C.woodDark);
    }
    function bunk(x, z, l, fy) {
      [[x, z], [x + 0.85, z], [x, z + l - 0.15], [x + 0.85, z + l - 0.15]].forEach(([px, pz]) => box(px, fy, pz, 0.15, 2.7, 0.15, C.wood));
      [0.3, 1.7].forEach((lv, i) => {
        box(x + 0.05, fy + lv, z + 0.1, 0.9, 0.18, l - 0.2, C.wood);
        box(x + 0.1, fy + lv + 0.18, z + 0.15, 0.8, 0.2, l - 0.3, C.bedWhite);
        box(x + 0.08, fy + lv + 0.34, z + 0.9, 0.84, 0.1, l - 1.05, i ? C.blue : C.yellow);
        box(x + 0.2, fy + lv + 0.38, z + 0.25, 0.6, 0.15, 0.45, C.pillow);
      });
    }
    function sofa(x, z, w, d, fy, color, back) {
      box(x + 0.05, fy, z + 0.05, w - 0.1, 0.45, d - 0.1, color);
      const t = 0.3;
      if (back === "N") box(x + 0.05, fy, z + 0.05, w - 0.1, 0.95, t, color);
      if (back === "S") box(x + 0.05, fy, z + d - 0.05 - t, w - 0.1, 0.95, t, color);
      if (back === "W") box(x + 0.05, fy, z + 0.05, t, 0.95, d - 0.1, color);
      if (back === "E") box(x + w - 0.05 - t, fy, z + 0.05, t, 0.95, d - 0.1, color);
    }
    function chair(x, z, fy, color, back) {
      box(x + 0.22, fy, z + 0.22, 0.56, 0.5, 0.56, color);
      if (back === "N") box(x + 0.22, fy + 0.5, z + 0.22, 0.56, 0.6, 0.1, color);
      if (back === "S") box(x + 0.22, fy + 0.5, z + 0.68, 0.56, 0.6, 0.1, color);
      if (back === "W") box(x + 0.22, fy + 0.5, z + 0.22, 0.1, 0.6, 0.56, color);
      if (back === "E") box(x + 0.68, fy + 0.5, z + 0.22, 0.1, 0.6, 0.56, color);
    }
    function table(x, z, w, d, fy, color, h) {
      h = h || 0.85;
      box(x + 0.05, fy + h - 0.12, z + 0.05, w - 0.1, 0.12, d - 0.1, color);
      [[x + 0.12, z + 0.12], [x + w - 0.27, z + 0.12], [x + 0.12, z + d - 0.27], [x + w - 0.27, z + d - 0.27]]
        .forEach(([px, pz]) => box(px, fy, pz, 0.15, h - 0.12, 0.15, color));
    }
    function toilet(x, z, fy, tank) {
      box(x + 0.3, fy, z + 0.3, 0.4, 0.45, 0.4, C.white);
      const t = { N: [0.25, 0.05, 0.5, 0.25], S: [0.25, 0.7, 0.5, 0.25], W: [0.05, 0.25, 0.25, 0.5], E: [0.7, 0.25, 0.25, 0.5] }[tank];
      box(x + t[0], fy, z + t[1], t[2], 0.85, t[3], C.white);
    }
    function pot(x, z, fy) {
      box(x + 0.25, fy, z + 0.25, 0.5, 0.5, 0.5, C.pot);
      box(x + 0.12, fy + 0.5, z + 0.12, 0.76, 0.7, 0.76, pick(C.leaf));
      if (rnd() < 0.6) box(x + 0.35, fy + 1.2, z + 0.35, 0.3, 0.2, 0.3, pick(C.bloom), { j: false });
    }
    function lamp(x, z) {
      box(x + 0.4, 1, z + 0.4, 0.2, 2.6, 0.2, C.black);
      box(x + 0.3, 3.55, z + 0.3, 0.4, 0.45, 0.4, C.bulb, glow);
      box(x + 0.25, 4, z + 0.25, 0.5, 0.1, 0.5, C.black);
    }
    // Cars can be driven, so their boxes aren't baked into the world: each car keeps its parts relative to its centre
    // on the ground (front towards +z) and becomes its own movable group later on.
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
    // a rubber duck keeping watch in the corner of a shower
    function rubberDuck(x, y, z) {
      box(x, y, z, 0.24, 0.14, 0.3, "#FFD21A", { j: false });
      box(x + 0.04, y + 0.12, z, 0.16, 0.14, 0.14, "#FFD21A", { j: false });
      box(x + 0.09, y + 0.15, z - 0.06, 0.06, 0.04, 0.07, "#FF8A1F", { j: false });
      box(x + 0.05, y + 0.2, z - 0.01, 0.03, 0.03, 0.03, "#23252B", { j: false });
      box(x + 0.16, y + 0.2, z - 0.01, 0.03, 0.03, 0.03, "#23252B", { j: false });
    }
    function lounger(x, z, cushion) {
      box(x + 0.1, 1, z + 0.05, 0.8, 0.3, 1.9, C.white);
      box(x + 0.15, 1.3, z + 0.6, 0.7, 0.1, 1.3, cushion);
      box(x + 0.15, 1.3, z + 0.1, 0.7, 0.45, 0.5, cushion);
    }
    function umbrella(x, z) {
      box(x + 0.45, 1, z + 0.45, 0.1, 2.7, 0.1, C.white);
      for (let i = 0; i < 3; i++) box(x - 1 + i, 3.6, z - 1, 1, 0.18, 3, i % 2 ? C.fefe : C.blue);
      box(x + 0.2, 3.78, z + 0.2, 0.6, 0.15, 0.6, C.white);
    }
    function balloons(x, z) {
      const cols = [C.fefe, C.blue, C.white, C.fefe, C.blue];
      [[0, 0, 4.2], [0.6, 0.3, 4.8], [-0.5, 0.4, 4.6], [0.2, -0.6, 5.2], [-0.3, -0.3, 5.6]].forEach(([dx, dz, h], i) => {
        box(x + 0.48 + dx, 1, z + 0.48 + dz, 0.04, h - 1, 0.04, C.white, { j: false });
        box(x + 0.15 + dx, h, z + 0.15 + dz, 0.7, 0.85, 0.7, cols[i], { j: false });
      });
      box(x + 0.3, 1, z + 0.3, 0.4, 0.2, 0.4, C.fefe);
    }
    function swedishFlag(px, pz) {
      box(px + 0.45, 1, pz + 0.45, 0.1, 6.2, 0.1, C.white);
      const u = 0.25, top = 7.1, fz = pz + 0.47, x0 = px + 0.55;
      const f = (c0, r0, cw, rh, col) => box(x0 + c0 * u, top - (r0 + rh) * u, fz, cw * u, rh * u, 0.06, col, { j: false });
      f(0, 0, 5, 4, C.blue); f(7, 0, 9, 4, C.blue); f(0, 6, 5, 4, C.blue); f(7, 6, 9, 4, C.blue);
      f(0, 4, 16, 2, C.yellow); f(5, 0, 2, 4, C.yellow); f(5, 6, 2, 4, C.yellow);
    }

    // ---------- ground, hedge and island base ----------
    const X0 = -4, X1 = 75, Z0 = -4, Z1 = 59;
    for (let u = 2 * X0; u <= 2 * X1 + 1; u++) {
      for (let w = 2 * Z0; w <= 2 * Z1 + 1; w++) {
        const n = hash(u, w);
        setV(u, 1, w, n < 0.45 ? C.grass[0] : n < 0.75 ? C.grass[1] : n < 0.93 ? C.grass[2] : C.grass[3], { tag: "g" });
        setV(u, 0, w, C.dirt);
        const edge = u <= 2 * X0 + 1 || u >= 2 * X1 || w <= 2 * Z0 + 1 || w >= 2 * Z1;
        if (!edge) continue;
        // layered soil under the island, ragged at the bottom
        const depth = 6 + (hash(u * 7, w * 3) < 0.35 ? 1 : 0);
        for (let v = -1; v >= -depth; v--) {
          const r = hash(u + v * 131, w - v * 71);
          setV(u, v, w, v >= -2 ? (r < 0.12 ? C.stone2 : C.dirt) : v >= -4 ? (r < 0.2 ? C.bedrock : C.dirtDark) : r < 0.5 ? C.bedrock : "#666A71");
        }
        // a bumpy hedge all the way round, open at the gate
        const gate = w >= 2 * Z1 && u >= 58 && u <= 65;
        if (gate) continue;
        const hv = 3 + (hash(u * 3, w * 5) < 0.5 ? 1 : 0);
        for (let v = 2; v < 2 + hv; v++) setV(u, v, w, v === 1 + hv ? C.hedgeTop : pick(C.hedge));
      }
    }

    // ---------- paths and surfaces ----------
    // Stepping stones two blocks long with a grass joint between them; their corners are nibbled off at random.
    function stonePath(x0, z0, x1, z1, alongX) {
      const aMin = alongX ? x0 : z0, aMax = alongX ? x1 : z1, cMin = alongX ? z0 : x0, cMax = alongX ? z1 : x1;
      for (let a = aMin; a <= aMax; a++) {
        const k = a - aMin;
        if (k % 3 === 2) continue;
        const s0 = a - (k % 3), s1 = Math.min(s0 + 1, aMax);
        for (let c = cMin; c <= cMax; c++) {
          for (let sa = 0; sa < 2; sa++) for (let sc = 0; sc < 2; sc++) {
            const A = 2 * a + sa, Cc = 2 * c + sc;
            const endA = A === 2 * s0 || A === 2 * s1 + 1, endC = Cc === 2 * cMin || Cc === 2 * cMax + 1;
            if (endA && endC && rnd() < 0.7) continue;
            const u = alongX ? A : Cc, w = alongX ? Cc : A;
            setV(u, 1, w, hash(u, w) < 0.5 ? C.stone : C.stone2);
            setV(u, 0, w, C.stone2);
          }
        }
      }
    }
    stonePath(30, 37, 31, 54, false);   // gate to pavilion
    stonePath(3, 22, 50, 23, true);     // the promenade linking villas, pavilion and pool
    stonePath(8, 21, 9, 21, false);
    stonePath(34, 19, 35, 21, false);
    stonePath(30, 24, 31, 24, false);
    stonePath(42, 29, 43, 30, true);
    stonePath(58, 34, 59, 37, false);
    stonePath(32, 45, 34, 46, true);
    stonePath(59, 13, 60, 14, false);

    // parking lot and driveway, with half-metre painted bay lines
    const gravel = (u, v, w) => (hash(u, w) < 0.5 ? C.gravel : C.gravel2);
    fill(1, 0, 40, 17, 0, 55, gravel);
    fill(18, 0, 55, 33, 0, 58, gravel);
    fill(29, 0, 59, 32, 0, 59, gravel);
    for (let w = 82; w <= 93; w++) [12, 20, 28].forEach((u) => setV(u, 1, w, C.line, { j: false }));

    // ---------- entrance ----------
    fill(28, 1, 59, 28, 4, 59, C.stoneWall);
    fill(33, 1, 59, 33, 4, 59, C.stoneWall);
    box(27.8, 5, 58.8, 6.4, 0.6, 1.4, C.woodDark);
    box(29.5, 5.6, 59.1, 3, 0.35, 0.8, C.fefe);
    swedishFlag(26, 57);
    swedishFlag(35, 57);

    // ---------- Main Villa: stone ground floor, wooden loft with capiz windows ----------
    (function mainVilla() {
      const id = "mainVilla", fy = 2;
      fill(4, 1, 4, 19, 1, 15, (x) => (x % 2 ? C.floorWood : C.floorWood2));
      fill(4, 1, 16, 19, 1, 20, C.deckWood);
      walls(id, 4, 4, 19, 15, 2, 4, C.stoneWall, {
        corner: C.woodDark,
        beam: C.woodDark,
        doors: [[8, 15], [9, 15]],
        windows: [[6, 4], [7, 4], [9, 4], [10, 4], [14, 4], [15, 4], [17, 4], [4, 7], [4, 8], [4, 11], [4, 12], [19, 6], [19, 7], [19, 12], [5, 15], [6, 15], [16, 15], [17, 15]]
      });
      walls(id, 12, 5, 12, 14, 2, 4, C.plaster, { doors: [[12, 7], [12, 13]] });
      walls(id, 13, 10, 18, 10, 2, 4, C.plaster);
      // loft storey
      fill(3, 6, 3, 20, 6, 16, C.woodDark, { group: id + ":upper" });
      const loftWins = [];
      for (let x = 4; x <= 19; x++) if (x % 4 !== 3) { loftWins.push([x, 3]); loftWins.push([x, 16]); }
      for (let z = 4; z <= 15; z++) if (z % 4 !== 1) { loftWins.push([3, z]); loftWins.push([20, z]); }
      walls(id, 3, 3, 20, 16, 7, 3, C.wood, { allUpper: true, corner: C.woodDark, beam: C.woodDark, windows: loftWins });
      hipRoof(id, 2, 2, 21, 17, 10, C.roof, { ridge: C.roofRidge });
      // media agua canopy over the lanai
      [[17, 6.5], [18, 6.0], [19, 5.5], [20, 5.0], [21, 4.5]].forEach(([z, y], i) => {
        vbox(3, y, z, 18, 0.5, 1, C.roof[i % 2], { group: id + ":roof" });
      });
      [4, 9, 14, 19].forEach((x) => fill(x, 2, 20, x, 4, 20, C.woodDark));

      // living room
      box(6, fy, 8, 5, 0.05, 5, C.blue, { j: false });
      box(8, fy + 0.01, 8, 1, 0.05, 5, C.yellow, { j: false });
      box(6, fy + 0.01, 10, 5, 0.05, 1, C.yellow, { j: false });
      sofa(5, 8, 1, 5, fy, C.woodLight, "W");
      box(7.2, fy, 9.3, 1.6, 0.45, 1.4, C.woodDark);
      // a bowl of Swedish pick-and-mix (lösgodis) on the coffee table: tap it for a sugar high
      box(7.7, fy + 0.45, 9.7, 0.6, 0.14, 0.6, C.white, { j: false });
      ["#FF3B6B", "#FEFE40", "#3BE36B", "#FF8A1F", "#2F6FD1", "#FF6FB5", "#FFFFFF", "#E23D3D", "#7A2BC2", "#FEFE40", "#3BE36B", "#FF3B6B"].forEach((c, i) => {
        box(7.74 + (i % 4) * 0.12, fy + 0.59 + ((i * 7) % 3) * 0.035, 9.76 + (i >> 2) * 0.15, 0.1, 0.07, 0.1, c, { j: false });
      });
      box(10.6, fy, 8.8, 0.8, 0.5, 2.4, C.woodDark);
      box(11.4, fy + 0.5, 8.9, 0.15, 1.2, 2.2, C.black);
      box(11.33, fy + 0.6, 9.0, 0.05, 1.0, 2.0, C.screen, glow);
      table(6, 5, 3, 1, fy, C.woodLight);
      [6, 7, 8].forEach((x) => chair(x, 6, fy, C.wood, "S"));
      box(5.05, fy, 14.1, 0.12, 4, 0.12, C.wood);
      box(5.05, fy, 14.78, 0.12, 4, 0.12, C.wood);
      for (let i = 0; i < 6; i++) box(5.05, fy + 0.35 + i * 0.6, 14.1, 0.12, 0.08, 0.8, C.wood);
      pot(11, 5, fy);
      pot(11, 14, fy);

      // bedroom: queen bed and bunk bed
      bed(14, 5, 2, 3, fy, C.bedBlue);
      bunk(18, 5, 3, fy);
      box(13.1, fy, 5.1, 0.8, 0.7, 0.8, C.woodLight);
      box(13.35, fy + 0.7, 5.35, 0.3, 0.35, 0.3, C.bulb, glow);
      box(16.05, fy, 9.1, 1.9, 2.6, 0.8, C.woodDark);
      box(13.8, fy, 8.1, 2.4, 0.05, 1.4, C.yellow, { j: false });

      // bathroom
      fill(13, 1, 11, 18, 1, 14, (x, y, z) => ((x + z) % 2 ? C.tileW : C.tileB), { j: false });
      toilet(18, 14, fy, "E");
      box(15.1, fy, 14.25, 1.8, 0.9, 0.7, C.woodLight);
      box(15.5, fy + 0.9, 14.35, 1, 0.12, 0.5, C.white);
      // a tin of snus on the counter
      box(15.16, fy + 0.9, 14.3, 0.22, 0.07, 0.22, "#1F3C88", { j: false });
      box(15.15, fy + 0.97, 14.29, 0.24, 0.03, 0.24, "#E8E8E8", { j: false });
      box(15.3, fy + 1.35, 14.93, 1.4, 1, 0.05, C.mirror, glow);
      box(13, fy, 12.95, 2, 2.2, 0.08, C.clearGlass, { kind: "clear", j: false });
      box(14.95, fy, 11, 0.08, 2.2, 2, C.clearGlass, { kind: "clear", j: false });
      box(13.3, fy + 2.1, 11.2, 0.35, 0.1, 0.35, C.metal);
      rubberDuck(13.15, fy, 12.55);
      box(18.9, fy + 1.2, 11.3, 0.08, 0.9, 1.2, C.yellow);

      // lanai
      chair(6, 18, fy, C.woodLight, "N");
      chair(8, 18, fy, C.woodLight, "N");
      table(7, 18, 1, 1, fy, C.woodDark, 0.6);
      box(12, fy, 16.2, 4, 0.5, 0.8, C.woodLight);
      pot(5, 19, fy);
      pot(18, 19, fy);
    })();

    // ---------- Lanai Villa: two bedrooms and a shared bathroom opening onto a big lanai ----------
    (function lanaiVilla() {
      const id = "lanaiVilla", fy = 2;
      fill(26, 1, 4, 43, 1, 13, (x) => (x % 2 ? C.floorWood : C.floorWood2));
      fill(26, 1, 14, 43, 1, 18, C.deckWood);
      walls(id, 26, 4, 43, 13, 2, 4, C.plaster, {
        corner: C.woodDark,
        plinth: C.stoneWall,
        beam: C.woodDark,
        doors: [[29, 13], [35, 13], [40, 13]],
        windows: [[28, 4], [29, 4], [30, 4], [34, 4], [35, 4], [39, 4], [40, 4], [41, 4], [26, 7], [26, 8], [26, 10], [43, 7], [43, 8], [43, 10], [27, 13], [31, 13], [38, 13], [42, 13]]
      });
      walls(id, 32, 5, 32, 12, 2, 4, C.plaster);
      walls(id, 37, 5, 37, 12, 2, 4, C.plaster);
      hipRoof(id, 25, 3, 44, 14, 6, C.roof, { ridge: C.roofRidge });
      [[15, 6.0], [16, 5.5], [17, 5.5], [18, 5.0], [19, 4.5]].forEach(([z, y], i) => {
        vbox(25, y, z, 20, 0.5, 1, (u, v, w) => C.thatch[(u + i) & 1], { group: id + ":roof" });
      });
      for (let u = 50; u <= 89; u++) if (rnd() < 0.6) setV(u, 8, 39, C.thatch[u & 1], { group: id + ":roof" });
      [26, 32, 37, 43].forEach((x) => fill(x, 2, 18, x, 4, 18, C.woodDark));

      bed(28, 5, 2, 3, fy, C.fefe);
      box(27.1, fy, 5.1, 0.8, 0.7, 0.8, C.woodLight);
      box(30.1, fy, 5.1, 0.8, 0.7, 0.8, C.woodLight);
      box(27.35, fy + 0.7, 5.35, 0.3, 0.35, 0.3, C.bulb, glow);
      box(30.35, fy + 0.7, 5.35, 0.3, 0.35, 0.3, C.bulb, glow);
      box(27.5, fy, 9, 3, 0.05, 2, C.blue, { j: false });
      chair(30, 11, fy, C.woodLight, "S");

      fill(33, 1, 5, 36, 1, 12, (x, y, z) => ((x + z) % 2 ? C.tileW : C.tileB), { j: false });
      box(33, fy, 6.95, 2, 2.2, 0.08, C.clearGlass, { kind: "clear", j: false });
      box(34.95, fy, 5, 0.08, 2.2, 2, C.clearGlass, { kind: "clear", j: false });
      box(33.3, fy + 2.1, 5.2, 0.35, 0.1, 0.35, C.metal);
      rubberDuck(33.15, fy, 6.55);
      toilet(36, 5, fy, "N");
      box(33.1, fy, 10.2, 0.7, 0.9, 2, C.woodLight);
      box(33.2, fy + 0.9, 10.6, 0.5, 0.12, 1.2, C.white);
      box(33.02, fy + 1.3, 10.4, 0.05, 1, 1.6, C.mirror, glow);

      bed(40, 5, 2, 3, fy, C.bedBlue);
      box(38.1, fy, 5.05, 0.8, 2.6, 1.9, C.woodDark);
      table(41, 10, 2, 1, fy, C.woodLight);
      box(42.4, fy + 0.85, 10.3, 0.3, 0.35, 0.3, C.bulb, glow);
      chair(41, 11, fy, C.wood, "S");
      box(38.5, fy, 9, 2, 0.05, 2, C.yellow, { j: false });

      sofa(30, 14, 4, 1, fy, C.blue, "N"); // clear of the bedroom door at x 29
      box(31, fy, 15.4, 2, 0.45, 1, C.woodLight);
      chair(38, 15, fy, C.white, "N");
      chair(40, 15, fy, C.white, "N");
      table(39, 15, 1, 1, fy, C.woodDark, 0.6);
      pot(27, 17, fy);
      pot(42, 17, fy);
    })();

    // ---------- Poolside Villa ----------
    (function poolVilla() {
      const id = "poolVilla", fy = 2;
      fill(53, 1, 5, 66, 1, 12, (x) => (x % 2 ? C.floorWood : C.floorWood2));
      walls(id, 53, 5, 66, 12, 2, 4, C.plaster, {
        corner: C.woodDark,
        plinth: C.stoneWall,
        beam: C.woodDark,
        doors: [[59, 12], [60, 12]],
        windows: [[55, 5], [56, 5], [58, 5], [63, 5], [64, 5], [53, 7], [53, 8], [53, 10], [66, 7], [66, 8], [66, 10], [55, 12], [56, 12], [57, 12], [63, 12], [64, 12]]
      });
      walls(id, 61, 6, 61, 11, 2, 4, C.plaster, { doors: [[61, 9]] });
      hipRoof(id, 52, 4, 67, 13, 6, C.roof, { ridge: C.roofRidge });
      bed(56, 6, 3, 3, fy, C.white);
      box(56.1, fy + 0.7, 7.3, 2.8, 0.1, 0.5, C.fefe, { j: false });
      box(55.1, fy, 6.1, 0.8, 0.7, 0.8, C.woodLight);
      box(59.1, fy, 6.1, 0.8, 0.7, 0.8, C.woodLight);
      box(55.35, fy + 0.7, 6.35, 0.3, 0.35, 0.3, C.bulb, glow);
      box(59.35, fy + 0.7, 6.35, 0.3, 0.35, 0.3, C.bulb, glow);
      sofa(54, 10, 1, 2, fy, C.blue, "W");
      fill(62, 1, 6, 65, 1, 11, (x, y, z) => ((x + z) % 2 ? C.tileW : C.tileB), { j: false });
      box(62.2, fy, 6.2, 2.6, 0.7, 1.4, C.white);
      box(62.35, fy + 0.45, 6.35, 2.3, 0.22, 1.1, C.water, { kind: "clear", j: false });
      toilet(65, 11, fy, "E");
      box(62.2, fy, 10.3, 1.6, 0.9, 0.6, C.woodLight);
      box(62.4, fy + 0.9, 10.4, 1.2, 0.12, 0.4, C.white);
    })();

    // ---------- Dining Pavilion: kitchen, restrooms, buffet, banquet table, bar and karaoke lounge ----------
    (function pavilion() {
      const id = "pavilion", fy = 2;
      fill(20, 1, 25, 41, 1, 36, (x, y, z) => ((x + z) % 2 ? C.terra : C.terra2));
      fill(20, 1, 25, 25, 1, 30, (x, y, z) => ((x + z) % 2 ? C.tileW : C.tileB), { j: false });
      fill(20, 1, 32, 25, 1, 36, (x, y, z) => ((x + z) % 2 ? C.tileW : C.tileB), { j: false });
      walls(id, 20, 25, 25, 30, 2, 4, C.plaster, { corner: C.woodDark, plinth: C.stoneWall, beam: C.woodDark, doors: [[25, 29]], hatch: [[25, 26], [25, 27]], windows: [[22, 25], [23, 25], [20, 27], [20, 28]] });
      walls(id, 20, 32, 25, 36, 2, 4, C.plaster, { corner: C.woodDark, plinth: C.stoneWall, beam: C.woodDark, doors: [[25, 34]], windows: [[20, 34], [22, 36], [23, 36]] });
      [[26, 25], [31, 25], [36, 25], [41, 25], [41, 30], [41, 36], [36, 36], [31, 36], [26, 36], [26, 31]].forEach(([x, z]) => fill(x, 2, z, x, 5, z, C.woodDark));
      hipRoof(id, 19, 24, 42, 37, 6, C.thatch, { ridge: C.thatchRidge, shaggy: true });
      // bunting under the eaves
      let n = 0;
      const flagAt = (x, z, alongX) => box(alongX ? x - 0.18 : x - 0.03, 5.05, alongX ? z - 0.03 : z - 0.18, alongX ? 0.36 : 0.06, 0.42, alongX ? 0.06 : 0.36, n++ % 2 ? C.fefe : C.blue, { group: id + ":roof", j: false });
      for (let x = 19.5; x <= 42.5; x += 1) { flagAt(x, 24, true); flagAt(x, 38, true); }
      for (let z = 24.5; z <= 37.5; z += 1) { flagAt(19, z, false); flagAt(43, z, false); }

      // kitchen
      box(21, fy, 26, 4, 0.95, 0.9, C.white);
      box(21, fy + 0.95, 26, 4, 0.12, 0.9, C.black);
      box(22.2, fy + 1.08, 26.2, 0.25, 0.03, 0.25, "#FF5A36", glow);
      box(22.6, fy + 1.08, 26.5, 0.25, 0.03, 0.25, "#FF5A36", glow);
      box(23.4, fy + 1.07, 26.2, 0.6, 0.06, 0.5, C.metal);
      box(21.05, fy, 29.05, 0.9, 2.3, 0.9, C.metalLight);
      box(22.1, fy, 27.9, 1.8, 0.95, 0.9, C.woodLight);
      box(22.3, fy + 0.95, 28.1, 0.4, 0.2, 0.4, C.food[2]);
      box(23.1, fy + 0.95, 28.2, 0.5, 0.15, 0.4, C.food[3]);

      // restrooms
      box(21.1, fy, 32.1, 3.8, 0.9, 0.6, C.white);
      box(21.1, fy + 1.3, 32.1, 3.8, 0.9, 0.05, C.mirror, glow);
      box(22.4, fy + 0.9, 32.35, 0.22, 0.07, 0.22, "#1F3C88", { j: false }); // snus tin
      box(22.39, fy + 0.97, 32.34, 0.24, 0.03, 0.24, "#E8E8E8", { j: false });
      toilet(21, 35, fy, "S");
      toilet(23, 35, fy, "S");
      box(22.45, fy, 34.2, 0.1, 2, 1.8, C.woodLight);

      // buffet (13:00 Whine and Dine)
      box(27, fy, 26, 8, 0.95, 1, C.woodDark);
      box(27, fy + 0.95, 26, 8, 0.08, 1, C.white, { j: false });
      for (let i = 0; i < 7; i++) {
        box(27.2 + i * 1.1, fy + 1.03, 26.2, 0.8, 0.28, 0.6, C.metal);
        box(27.25 + i * 1.1, fy + 1.31, 26.25, 0.7, 0.06, 0.5, C.food[i % C.food.length], { j: false });
      }
      box(34.3, fy + 1.03, 26.15, 0.55, 0.45, 0.7, "#B5652B");

      // banquet table with a Swedish-blue runner
      table(27, 29, 9, 2, fy, C.woodLight);
      box(27.1, fy + 0.86, 29.7, 8.8, 0.03, 0.6, C.blue, { j: false });
      for (let x = 27; x <= 35; x++) {
        chair(x, 28, fy, C.wood, "N");
        chair(x, 31, fy, C.wood, "S");
        box(x + 0.3, fy + 0.86, 29.15, 0.4, 0.03, 0.4, C.white, { j: false });
        box(x + 0.3, fy + 0.86, 30.45, 0.4, 0.03, 0.4, C.white, { j: false });
        if (x % 3 === 1) box(x + 0.35, fy + 0.89, 29.85, 0.3, 0.35, 0.3, C.fefe, { j: false });
      }

      // pendant lamps over the table, lit at night
      [28.8, 34.2].forEach((x) => {
        box(x - 0.02, fy + 2.2, 29.98, 0.04, 1.8, 0.04, C.black, { j: false });
        box(x - 0.35, fy + 1.95, 29.65, 0.7, 0.25, 0.7, C.woodDark, { j: false });
        box(x - 0.18, fy + 1.78, 29.82, 0.36, 0.2, 0.36, C.bulb, glow);
      });
      // fairy lights along the eaves, swagged every 4 m below the bunting
      const eave = [[19, 24], [43, 24], [43, 38], [19, 38], [19, 24]];
      for (let i = 0; i + 1 < eave.length; i++) {
        const [ax, az] = eave[i], [bx, bz] = eave[i + 1], len = Math.hypot(bx - ax, bz - az);
        for (let d = 0.5; d < len; d += 0.5) {
          const t = d / len, sag = Math.sin(((d % 4) / 4) * Math.PI) * 0.35;
          box(ax + (bx - ax) * t - 0.06, 4.95 - sag, az + (bz - az) * t - 0.06, 0.12, 0.14, 0.12, (d * 2) % 2 ? C.bulb : C.fefe, glow);
        }
      }

      // Viking bar
      box(37, fy, 26.05, 4, 1.9, 0.6, C.wood);
      for (let i = 0; i < 10; i++) box(37.15 + i * 0.38, fy + 1.9, 26.2, 0.2, 0.5, 0.2, pick(["#2E7D32", "#8D5524", "#E6E6E6", "#1565C0", "#C62828"]));
      box(37, fy, 28, 4, 1.05, 0.9, C.blue);
      box(36.95, fy + 1.05, 27.95, 4.1, 0.1, 1.0, C.fefe, { j: false });
      for (let x = 37; x <= 40; x++) {
        box(x + 0.4, fy, 29.3, 0.2, 0.75, 0.2, C.metal);
        box(x + 0.2, fy + 0.75, 29.1, 0.6, 0.12, 0.6, C.blue);
      }
      box(36.15, fy, 27.15, 0.7, 0.9, 0.7, C.wood);
      box(36.12, fy + 0.2, 27.12, 0.76, 0.08, 0.76, C.woodDark);
      box(36.12, fy + 0.65, 27.12, 0.76, 0.08, 0.76, C.woodDark);

      // billiards
      box(28, fy, 33, 3, 0.8, 2, C.woodDark);
      box(28.1, fy + 0.8, 33.1, 2.8, 0.1, 1.8, C.felt);
      [["#FFFFFF", 28.5, 33.9], ["#E23D3D", 29.6, 33.6], ["#FECC02", 29.8, 34.1], ["#2F6FD1", 30.1, 33.8]].forEach(([c, x, z]) => box(x, fy + 0.9, z, 0.14, 0.14, 0.14, c, { j: false }));

      // grazing table (16:00 to 20:00)
      box(31, fy, 35.1, 5, 0.85, 0.8, C.woodLight);
      for (let i = 0; i < 16; i++) box(31.15 + (i % 8) * 0.6, fy + 0.85, 35.2 + ((i / 8) | 0) * 0.3, 0.35, 0.12 + rnd() * 0.15, 0.25, C.food[(i + 2) % C.food.length], { j: false });

      // birthday cake
      box(36.1, fy, 33.1, 0.8, 0.8, 0.8, C.white);
      box(36.2, fy + 0.8, 33.2, 0.6, 0.3, 0.6, C.blue, { j: false });
      box(36.3, fy + 1.1, 33.3, 0.4, 0.25, 0.4, C.fefe, { j: false });
      box(36.45, fy + 1.35, 33.45, 0.1, 0.15, 0.1, C.bulb, glow);

      // karaoke lounge
      box(37.5, fy, 32.1, 3, 0.6, 0.5, C.woodDark);
      box(37.6, fy + 0.6, 32.2, 2.8, 1.5, 0.12, C.black);
      box(37.7, fy + 0.7, 32.33, 2.6, 1.3, 0.02, C.screenPink, glow);
      sofa(37, 35, 4, 1, fy, C.fefe, "S");
      box(38, fy, 33.8, 2, 0.4, 0.8, C.woodLight);
      box(38.9, fy + 0.4, 34.0, 0.1, 0.3, 0.1, C.black);
    })();

    // big "40" out front, built from the same 17 + 23 candle pattern as the cake
    (function sign40() {
      const FOUR = ["#..#.", "#..#.", "#..#.", "#..#.", "#####", "...#.", "...#.", "...#.", "...#."];
      const ZERO = [".###.", "#...#", "#...#", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."];
      const u = 0.5, x = 23, z = 39;
      vbox(x - 0.5, 1, z - 0.5, 11 * u + 1, 0.5, 1.5, C.white);
      [[FOUR, 0, C.fefe], [ZERO, 6, C.blue]].forEach(([rows, off, col]) => {
        rows.forEach((row, r) => [...row].forEach((ch, c) => {
          if (ch === "#") vbox(x + (off + c) * u, 1.5 + (8 - r) * u, z, u, u, u, col, { j: false });
        }));
      });
    })();
    balloons(29, 38);
    balloons(32, 38);

    // ---------- Dance floor ----------
    const DANCE_CENTER = [47, 30];
    (function dance() {
      for (let x = 44; x <= 49; x++) for (let z = 26; z <= 33; z++) {
        del(x, 0, z);
        vbox(x, 0, z, 1, 0.5, 1, C.black);
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) box(x + a * 0.5, 0.5, z + b * 0.5, 0.5, 0.5, 0.5, C.white, { kind: "dance", j: false });
      }
      [[43, 24], [50, 24], [43, 34], [50, 34]].forEach(([x, z]) => fill(x, 1, z, x, 6, z, "#3A3F4A"));
      box(43, 7, 24.35, 8, 0.3, 0.3, "#3A3F4A");
      box(43, 7, 34.35, 8, 0.3, 0.3, "#3A3F4A");
      box(43.35, 7, 24, 0.3, 0.3, 11, "#3A3F4A");
      box(50.35, 7, 24, 0.3, 0.3, 11, "#3A3F4A");
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, sag = Math.sin(t * Math.PI) * 0.7;
        box(43.4 + t * 7.2, 6.65 - sag, 24.4 + t * 10.2, 0.2, 0.26, 0.2, i % 2 ? C.bulb : C.fefe, glow);
        box(50.4 - t * 7.2, 6.65 - sag, 24.4 + t * 10.2, 0.2, 0.26, 0.2, i % 2 ? C.fefe : C.bulb, glow);
      }
      box(46.95, 5.3, 29.95, 0.05, 1.7, 0.05, C.metal);
      box(45, 1, 25, 4, 1.1, 0.9, C.black);
      box(45.05, 1.3, 25.9, 3.9, 0.12, 0.02, C.blue, glow);
      box(45.4, 2.1, 25.15, 1, 0.1, 0.6, C.metal);
      box(47.6, 2.1, 25.15, 1, 0.1, 0.6, C.metal);
      box(46.6, 2.1, 25.2, 0.8, 0.35, 0.05, C.screen, glow);
      box(44.1, 1, 25, 0.8, 1.9, 0.8, C.black);
      box(49.1, 1, 25, 0.8, 1.9, 0.8, C.black);
      box(44.3, 1.4, 25.8, 0.4, 0.4, 0.02, C.metal);
      box(49.3, 1.4, 25.8, 0.4, 0.4, 0.02, C.metal);
    })();

    // ---------- Pool with kids' corner, loungers and a thatched cabana ----------
    const WATER_REGIONS = [[53, 18, 14, 6, 0.85], [58, 24, 9, 4, 0.85], [53, 24, 5, 4, 0.85]];
    (function pool() {
      for (let x = 51; x <= 69; x++) for (let z = 15; z <= 33; z++) put(x, 0, z, ((x >> 1) + (z >> 1)) % 2 ? C.deck : C.deck2);
      for (let x = 52; x <= 67; x++) for (let z = 17; z <= 28; z++) {
        const ring = x === 52 || x === 67 || z === 17 || z === 28;
        if (ring) {
          put(x, 0, z, C.coping);
          put(x, -1, z, C.poolTile);
          put(x, -2, z, C.poolTile);
          continue;
        }
        del(x, 0, z);
        const kids = x <= 57 && z >= 24;
        if (kids) put(x, -1, z, C.tileLight, { j: false });
        else put(x, -2, z, (u, v, w) => ((u + w) & 1 ? C.tileDeep : C.poolTile), { j: false });
      }
      box(53, -1, 18, 14, 1.85, 6, C.water, { kind: "water", j: false });
      box(58, -1, 24, 9, 1.85, 4, C.water, { kind: "water", j: false });
      box(53, 0, 24, 5, 0.85, 4, C.waterKids, { kind: "water", j: false });
      [56, 59, 62].forEach((x) => {
        box(x + 0.3, 1, 16.3, 0.4, 0.7, 0.4, C.stone2);
        box(x + 0.42, 1.55, 16.7, 0.16, 0.12, 0.5, C.waterKids, { kind: "clear", j: false });
        box(x + 0.42, 1.2, 17.2, 0.16, 0.3, 0.3, C.waterKids, { kind: "clear", j: false });
      });
      lounger(53, 30, C.blue);
      lounger(56, 30, C.fefe);
      lounger(59, 30, C.blue);
      umbrella(54, 31);
      umbrella(57, 31);
      box(61.1, 1, 31.8, 0.9, 0.8, 0.6, C.woodLight);
      [C.fefe, C.blue, C.white].forEach((c, i) => box(61.2, 1.8 + i * 0.15, 31.9, 0.7, 0.15, 0.4, c, { j: false }));
      // cabana
      fill(63, 1, 29, 68, 1, 33, C.deckWood);
      [[63, 29], [68, 29], [63, 33], [68, 33]].forEach(([x, z]) => fill(x, 2, z, x, 3, z, C.woodDark));
      hipRoof("cabana", 62, 28, 69, 34, 4, C.thatch, { ridge: C.thatchRidge, shaggy: true });
      box(64.2, 2, 30.1, 3.6, 0.5, 2.6, C.white);
      [C.fefe, C.blue, C.fefe].forEach((c, i) => box(64.5 + i * 1.1, 2.5, 30.2, 0.8, 0.3, 0.4, c, { j: false }));
    })();

    // ---------- Pickleball / basketball court ----------
    (function court() {
      for (let x = 46; x <= 69; x++) for (let z = 38; z <= 53; z++) {
        put(x, 0, z, x >= 47 && x <= 68 && z >= 39 && z <= 52 ? C.court : C.courtOut);
      }
      // half-metre court lines: boundary, centre line under the net, and the two non-volley "kitchen" lines
      for (let w = 78; w <= 105; w++) [94, 108, 114, 120, 137].forEach((u) => setV(u, 1, w, C.line, { j: false }));
      for (let u = 94; u <= 137; u++) [78, 105].forEach((w) => setV(u, 1, w, C.line, { j: false }));
      box(57.2, 1, 40, 0.1, 0.8, 12, C.white, { kind: "clear", j: false });
      box(57.15, 1.8, 40, 0.2, 0.1, 12, C.white);
      box(57.15, 1, 39.7, 0.2, 1.05, 0.2, C.metal);
      box(57.15, 1, 52.1, 0.2, 1.05, 0.2, C.metal);
      [[46.3, 46.95, 47.1], [69.3, 68.9, 68.1]].forEach(([post, board, rim]) => {
        box(post, 1, 45.8, 0.4, 4.6, 0.4, C.metal);
        box(board, 4.6, 44.8, 0.15, 1.4, 2.4, C.white);
        box(rim, 4.75, 45.6, 0.8, 0.08, 0.8, C.orange);
      });
      [[50.2, 43.4], [53.7, 48.6], [62.3, 42.2], [65.1, 50.3]].forEach(([x, z]) => box(x, 1, z, 0.2, 0.2, 0.2, C.fefe, { j: false }));
      box(51, 1.02, 46, 0.5, 0.05, 0.8, C.blue, { j: false });
      box(63.4, 1.02, 45.2, 0.5, 0.05, 0.8, C.fefe, { j: false });
      box(52, 1, 53.2, 4, 0.5, 0.6, C.woodLight);
      box(60, 1, 53.2, 4, 0.5, 0.6, C.woodLight);
    })();

    // ---------- Playground ----------
    (function playground() {
      for (let x = 35; x <= 44; x++) for (let z = 40; z <= 50; z++) put(x, 0, z, hash(x, z) < 0.5 ? C.sand : C.sand2);
      box(37.3, 1, 42.3, 0.3, 4, 0.3, C.red);
      box(42.4, 1, 42.3, 0.3, 4, 0.3, C.red);
      box(37.3, 5, 42.3, 5.4, 0.3, 0.3, C.red);
      [38.4, 40.6].forEach((x) => {
        box(x, 2.2, 42.4, 0.05, 2.8, 0.05, C.metal);
        box(x + 0.8, 2.2, 42.4, 0.05, 2.8, 0.05, C.metal);
        box(x - 0.05, 2.1, 42.2, 0.95, 0.12, 0.5, C.fefe);
      });
      box(37, 1, 46, 2, 2, 2, C.blue);
      [[37, 46], [38.8, 46], [37, 47.8], [38.8, 47.8]].forEach(([x, z]) => box(x, 3, z, 0.2, 1.6, 0.2, C.red));
      box(36.9, 4.6, 45.9, 2.2, 0.3, 2.2, C.red);
      for (let i = 0; i < 4; i++) box(36.6, 1.3 + i * 0.5, 46.4, 0.4, 0.1, 1.2, C.fefe);
      for (let i = 0; i < 8; i++) box(39 + i * 0.5, 2.85 - i * 0.24, 46.4, 0.5, 0.15, 1.2, C.fefe);
      box(40.3, 1, 49.1, 0.4, 0.6, 0.4, C.metal);
      box(38.8, 1.55, 49.15, 3.4, 0.12, 0.3, C.green);
    })();

    // ---------- Parking for 15 vehicles ----------
    car(3, 41, C.car[0]);
    car(7, 41, C.car[1]);
    car(11, 41, C.car[2]);
    jeepney(3, 48);
    car(8, 49, C.car[3]);
    car(12, 49, C.car[4]);

    // lamps
    [[6, 24], [14, 24], [29, 40], [32, 46], [29, 52], [51, 35], [69, 35]].forEach(([x, z]) => lamp(x, z));

    // ---------- Garden: palms, shade trees, flowering trees, bushes and grass tufts ----------
    const OCC = [[2, 2, 21, 21], [24, 2, 45, 20], [2, 21, 51, 24], [18, 23, 51, 38], [50, 3, 70, 35], [45, 37, 70, 54], [34, 39, 45, 51], [0, 39, 18, 56], [17, 54, 36, 59], [28, 36, 33, 56], [21, 37, 30, 41]];
    function rectDist(x, z, r) {
      const dx = Math.max(r[0] - x, 0, x - r[2]);
      const dz = Math.max(r[1] - z, 0, z - r[3]);
      return Math.hypot(dx, dz);
    }
    const isFree = (x, z, m) => OCC.every((r) => rectDist(x, z, r) > m);
    const trees = [];
    const farFromTrees = (x, z, d) => trees.every((t) => Math.hypot(t[0] - x, t[1] - z) >= d);

    // One voxel at a point given in metres, unless something is already there.
    const soft = { tag: "g" }; // leaves and tufts: drawn like any voxel, but people can walk through them
    function dab(px, py, pz, color, o) {
      const u = Math.floor(px * 2), v = Math.floor(py * 2), w = Math.floor(pz * 2);
      if (!metaV(u, v, w)) setV(u, v, w, color, o);
    }
    // Ellipsoid of voxels with a ragged surface. shade(t) picks a colour from the height t, -1 (bottom) to 1 (top).
    function blob(cx, cy, cz, rx, ry, rz, shade, o) {
      for (let u = Math.floor((cx - rx) * 2); u <= Math.floor((cx + rx) * 2); u++)
        for (let v = Math.floor((cy - ry) * 2); v <= Math.floor((cy + ry) * 2); v++)
          for (let w = Math.floor((cz - rz) * 2); w <= Math.floor((cz + rz) * 2); w++) {
            const px = (u + 0.5) / 2 - cx, py = (v + 0.5) / 2 - cy, pz = (w + 0.5) / 2 - cz;
            const d = (px / rx) * (px / rx) + (py / ry) * (py / ry) + (pz / rz) * (pz / rz);
            if (d > 1 || (d > 0.7 && rnd() < 0.3) || metaV(u, v, w)) continue;
            setV(u, v, w, shade(py / ry), o);
          }
    }
    // Coconut palm: a thin ringed trunk that curves as it rises, and 7-9 arching fronds with leaflets that droop at the tips.
    function palm(x, z) {
      const h = 5.5 + ((rnd() * 5) | 0) * 0.5;
      const ang = rnd() * Math.PI * 2, lean = 0.5 + rnd() * 0.9;
      const lx = Math.cos(ang) * lean, lz = Math.sin(ang) * lean;
      let tx = x + 0.25, tz = z + 0.25;
      for (let v = 2; v < h * 2; v++) {
        const t = (v / 2 - 1) / (h - 1);
        tx = x + 0.25 + lx * t * t;
        tz = z + 0.25 + lz * t * t;
        const u = Math.floor(tx * 2), w = Math.floor(tz * 2);
        const col = v % 3 === 0 ? C.palmTrunkDark : C.palmTrunk;
        setV(u, v, w, col);
        if (v < 4) { setV(u + 1, v, w, col); setV(u, v, w + 1, col); setV(u + 1, v, w + 1, col); }
      }
      const cx = (Math.floor(tx * 2) + 0.5) / 2, cz = (Math.floor(tz * 2) + 0.5) / 2, cy = h + 0.25;
      dab(cx, cy, cz, pick(C.palm));
      dab(cx, cy + 0.5, cz, pick(C.palm));
      const n = 7 + ((rnd() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rnd() * 0.5, dx = Math.cos(a), dz = Math.sin(a);
        const L = 2.6 + rnd(), col = pick(C.palm), lift = 0.55 + rnd() * 0.3;
        for (let s = 0.3; s <= L; s += 0.25) {
          const y = cy + 0.3 + lift * s - 0.33 * s * s;
          const px = cx + dx * s, pz = cz + dz * s;
          dab(px, y, pz, col, soft);
          if (s > 0.7 && s < L - 0.4) {
            dab(px - dz * 0.5, y - 0.3, pz + dx * 0.5, col, soft);
            dab(px + dz * 0.5, y - 0.3, pz - dx * 0.5, col, soft);
          }
        }
      }
      [[-0.5, 0], [0.5, 0], [0, 0.5]].forEach(([ox, oz]) => dab(cx + ox, cy - 0.5, cz + oz, C.coconut));
      return { palm: true, h, top: cy + 0.75, tx: cx, tz: cz };
    }
    // Shade tree: stout trunk with roots and two branches, under a round canopy made of three overlapping blobs.
    function broadleaf(x, z, flowering) {
      const h = 3 + ((rnd() * 3) | 0) * 0.5;
      vbox(x, 1, z, 1, h - 1, 1, C.trunk);
      [[-0.25, 0.25], [1.25, 0.75], [0.75, -0.25], [0.25, 1.25]].forEach(([ox, oz]) => { if (rnd() < 0.7) dab(x + ox, 1.25, z + oz, C.trunk); });
      [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => rnd() - 0.5).slice(0, 2).forEach(([dx, dz]) => {
        for (let s = 0.5; s <= 1.5; s += 0.5) dab(x + 0.5 + dx * (0.5 + s), h - 0.5 + s * 0.8, z + 0.5 + dz * (0.5 + s), C.trunk);
      });
      const shade = (t) => {
        if (flowering && rnd() < 0.32) return pick([C.bloom[0], C.bloom[1], C.bloom[2]]);
        if (t > 0.45) return rnd() < 0.6 ? C.leafLight : pick(C.leaf);
        if (t < -0.35) return rnd() < 0.6 ? C.leafDark : pick(C.leaf);
        return pick(C.leaf);
      };
      const rx = 2.1 + rnd() * 0.6, ry = 1.5 + rnd() * 0.4;
      blob(x + 0.5, h + 1.2, z + 0.5, rx, ry, rx * (0.85 + rnd() * 0.3), shade, soft);
      for (let k = 0; k < 2; k++) {
        const a = rnd() * Math.PI * 2;
        blob(x + 0.5 + Math.cos(a) * 1.2, h + 1.0 + rnd() * 0.8, z + 0.5 + Math.sin(a) * 1.2, 1.3, 1.1, 1.3, shade, soft);
      }
      return { palm: false, h, top: h + 1.2 + ry, tx: x + 0.5, tz: z + 0.5 };
    }
    // each tree: [x, z, { palm, h (trunk top), top (where a climber stands), tx, tz (top of the trunk) }]
    [[51, 15], [69, 15], [70, 33], [28, 45], [33, 41], [33, 53], [19, 42], [24, 21]].forEach(([x, z]) => { const t = [x, z]; trees.push(t); t.push(palm(x, z)); });
    for (let tries = 0; tries < 6000 && trees.length < 80; tries++) {
      const x = -2 + ((rnd() * 76) | 0), z = -2 + ((rnd() * 60) | 0);
      const type = rnd(), isPalm = type < 0.35;
      if (!isFree(x, z, isPalm ? 2.2 : 2.9) || !farFromTrees(x, z, isPalm ? 3.6 : 4.8)) continue;
      const t = [x, z];
      trees.push(t);
      t.push(isPalm ? palm(x, z) : broadleaf(x, z, type > 0.78));
    }
    let bushes = 0;
    for (let tries = 0; tries < 4000 && bushes < 90; tries++) {
      const x = -3 + ((rnd() * 78) | 0), z = -3 + ((rnd() * 62) | 0);
      if (!isGrass(x, z) || !isEmpty(x, 1, z) || !isFree(x, z, 0.6) || !farFromTrees(x, z, 1.5)) continue;
      const r = 0.6 + rnd() * 0.4, flowering = rnd() < 0.7, bloom = pick(C.bloom);
      blob(x + 0.5, 1.1, z + 0.5, r, 0.6 + rnd() * 0.3, r, (t) => (flowering && t > -0.1 && rnd() < 0.3 ? bloom : t > 0.3 ? C.leafLight : pick(C.leaf)));
      bushes++;
    }
    // grass tufts poking up out of the lawn
    for (let u = 2 * X0 + 2; u <= 2 * X1 - 1; u++) for (let w = 2 * Z0 + 2; w <= 2 * Z1 - 1; w++) {
      if ((metaV(u, 1, w) & 128) && !metaV(u, 2, w) && hash(u * 13, w * 17) < 0.025) setV(u, 2, w, pick(C.tuft), soft);
    }

    // ---------- places ----------
    // rect is [x0, z0, x1, z1] in the design grid; at is the label anchor [x, y, z]; b is the building whose roof lifts.
    const ZONES = [
      { id: "pool", name: "Pool", level: 1, rect: [51, 15, 69, 33], at: [60, 3, 23], fit: 30, time: "From 13:00", text: "Socials, pool and garden party. Bring your swimsuit and towel; towels are also available at the resort. The corner nearest the loungers is shallow for kids, and the pool is not heated." },
      { id: "dance", name: "Dance floor", level: 1, rect: [43, 24, 50, 34], at: [47, 8.5, 29], fit: 20, time: "All day", text: "Blue and yellow light-up floor with a DJ booth and a disco ball, right between the pavilion and the pool. Tap the DJ decks to start the music. Karaoke is in the pavilion lounge." },
      { id: "kitchen", name: "Kitchen", level: 2, b: "pavilion", rect: [20, 25, 25, 30], at: [22.5, 4.5, 27.5], fit: 14, time: "13:00", text: "Whine and Dine: a full lunch buffet drops at 13:00, served from the counter next to the kitchen hatch." },
      { id: "bedroom", name: "Bedroom", level: 2, b: "mainVilla", rect: [13, 5, 18, 9], at: [15.5, 4.5, 7], fit: 14, text: "Main Villa bedroom with a queen bed and a bunk bed, sleeping 5. The loft upstairs sleeps 4 more." },
      { id: "bathroom", name: "Bathroom", level: 2, b: "mainVilla", rect: [13, 11, 18, 14], at: [15.5, 4.5, 12.5], fit: 14, text: "Main Villa bathroom with a walk-in shower. Guest restrooms are also next to the pavilion kitchen." },
      { id: "bar", name: "Viking Bar", level: 2, b: "pavilion", rect: [36, 26, 40, 29], at: [38.5, 4.8, 27], fit: 14, time: "12:00–23:00", text: "Drink like a Viking. The bar is open 12:00 to 23:00 on 10 October. Bring your favorite bottle; it doubles as your gift to Filip." },
      { id: "restroom", name: "Restrooms", level: 2, b: "pavilion", rect: [20, 32, 25, 36], at: [22.5, 4.5, 34], fit: 14, text: "Guest restrooms beside the kitchen, closest to the party." },
      { id: "lounge", name: "Karaoke lounge", level: 2, b: "pavilion", rect: [36, 32, 40, 35], at: [38.5, 4.8, 33.5], fit: 14, time: "16:00", text: "Karaoke, sofa and the birthday cake. The birthday greeting is at 16:00, and the grazing table next to it runs from 16:00 until 20:00." },
      { id: "pavilion", name: "Dining Pavilion", level: 1, b: "pavilion", rect: [19, 24, 42, 37], at: [30.5, 10.5, 30.5], fit: 26, time: "13:00 · 16:00", text: "The heart of the party: lunch buffet at 13:00, a long banquet table, billiards, the Viking bar and karaoke. Birthday greeting at 16:00, grazing table until 20:00 or until it's cleaned out." },
      { id: "court", name: "Pickleball court", level: 1, rect: [46, 38, 69, 53], at: [57.5, 4, 45.5], fit: 30, time: "Open play", text: "Pickleball open play, all for fun and open to everyone. Bring your own paddle. It doubles as a basketball court." },
      { id: "mainVilla", name: "Main Villa", level: 1, b: "mainVilla", rect: [2, 2, 21, 21], at: [11.5, 14.5, 9.5], fit: 26, text: "Living room, main bedroom, bathroom and a loft upstairs, in old Filipino style with wood, earth tones and capiz shell windows. Villa hosts staying 9 to 11 October get brunch and dinner." },
      { id: "lanaiVilla", name: "Lanai Villa", level: 1, b: "lanaiVilla", rect: [25, 3, 44, 19], at: [34.5, 9.5, 8.5], fit: 26, text: "Two bedrooms with queen beds and a shared bathroom, all opening onto a spacious lanai for lounging." },
      { id: "poolVilla", name: "Poolside Villa", level: 1, b: "poolVilla", rect: [52, 4, 67, 13], at: [59.5, 9, 8.5], fit: 24, text: "An extra villa by the pool that the resort opens for bigger groups." },
      { id: "playground", name: "Playground", level: 1, rect: [35, 40, 44, 50], at: [39.5, 6, 45], fit: 22, text: "Swings, a slide and a seesaw for the kids." },
      { id: "parking", name: "Parking", level: 1, rect: [1, 40, 17, 55], at: [9, 3.5, 47], fit: 26, text: "Parking for 15 vehicles. Overnight rooms are limited, and the invite lists hotels 10 to 40 minutes away." },
      { id: "gate", name: "Entrance", level: 1, rect: [18, 55, 35, 59], at: [30.5, 7, 58.5], fit: 24, time: "10 Oct · 13:00", text: "Casa Anahao, Tanauan, Batangas. The party starts at 13:00; come any time after that. Theme: wear Swedish blue and yellow." }
    ];
    const byId = {};
    ZONES.forEach((z) => { byId[z.id] = z; });
    const CHIP_ORDER = ["pool", "dance", "kitchen", "bedroom", "bathroom", "bar", "pavilion", "lounge", "court", "mainVilla", "lanaiVilla", "poolVilla", "playground", "restroom", "parking", "gate"];

    // ---------- three.js scene ----------
    const OX = -36, OZ = -28;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const hemi = new T.HemisphereLight(0xe3f4ff, 0x5f8a45, 0.72);
    const amb = new T.AmbientLight(0xffffff, 0.18);
    const sun = new T.DirectionalLight(0xfff1d6, 0.8);
    sun.position.set(38, 70, 30);
    sun.castShadow = true;
    const shadowSize = Math.min(window.innerWidth, window.innerHeight) < 600 ? 1024 : 2048;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 1, far: 220 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    scene.add(hemi, amb, sun, sun.target);

    function canvasTex(size, draw) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      draw(c.getContext("2d"), size);
      const t = new T.CanvasTexture(c);
      t.magFilter = T.NearestFilter;
      return t;
    }
    const blockTex = canvasTex(16, (g) => {
      const r = mulberry(7);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let v = 240 + ((r() * 16) | 0);
        if (x === 0 || y === 0 || x === 15 || y === 15) v = 214;
        else if (x === 1 || y === 1) v = 255;
        else if (x === 14 || y === 14) v -= 10;
        g.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
        g.fillRect(x, y, 1, 1);
      }
    });
    const capizTex = canvasTex(32, (g) => {
      const r = mulberry(3);
      for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) {
        const v = 238 + ((r() * 17) | 0);
        g.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 18) + ")";
        g.fillRect(px * 8, py * 8, 8, 8);
      }
      g.fillStyle = "#8a5a2b";
      for (let i = 0; i <= 32; i += 8) { g.fillRect(i - 1, 0, 2, 32); g.fillRect(0, i - 1, 32, 2); }
    });
    const rippleTex = canvasTex(128, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        for (let x = 0; x <= s; x += 4) {
          const y = k * (s / 6) + 10 + Math.sin((x / s) * Math.PI * 4 + k) * 6;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
    });
    rippleTex.wrapS = rippleTex.wrapT = T.RepeatWrapping;
    rippleTex.magFilter = T.LinearFilter;

    const baseMat = {
      solid: new T.MeshLambertMaterial({ map: blockTex }),
      glass: new T.MeshLambertMaterial({ map: capizTex, transparent: true, opacity: 0.88 }),
      clear: new T.MeshLambertMaterial({ transparent: true, opacity: 0.5, depthWrite: false }),
      water: new T.MeshPhongMaterial({ transparent: true, opacity: 0.8, shininess: 90, specular: 0x88ccff }),
      glow: new T.MeshBasicMaterial(),
      dance: new T.MeshBasicMaterial()
    };
    const voxMat = {
      solid: new T.MeshLambertMaterial({ map: blockTex, vertexColors: true }),
      glass: new T.MeshLambertMaterial({ map: capizTex, vertexColors: true, transparent: true, opacity: 0.88 })
    };
    const baseOpacity = { solid: 1, glass: 0.88, clear: 0.5, water: 0.8, glow: 1, dance: 1 };
    const meshes = [];
    const buildings = new Map();
    const groupMats = new Map();
    const isHideable = (group) => group !== "base";
    // roofs of structures that aren't a place of their own still lift away when you're under them
    const CUT_RECTS = { cabana: [62, 28, 69, 34] };
    function register(mesh, kind, group) {
      mesh.userData = { kind, group };
      mesh.castShadow = kind === "solid" || kind === "glass";
      mesh.receiveShadow = kind !== "glow" && kind !== "dance";
      scene.add(mesh);
      meshes.push(mesh);
      if (!isHideable(group)) return;
      const [bid, part] = group.split(":");
      if (!buildings.has(bid)) buildings.set(bid, { roof: [], upper: [], fade: 0 });
      buildings.get(bid)[part].push(mesh);
      mesh.userData.building = bid;
    }
    function materialFor(set, kind, group) {
      if (!isHideable(group)) return set[kind];
      const k = (set === voxMat ? "v|" : "p|") + kind + "|" + group;
      if (!groupMats.has(k)) groupMats.set(k, set[kind].clone());
      return groupMats.get(k);
    }

    // Voxels become one mesh per kind, group and 16 m chunk. Only faces that touch air (or a see-through or
    // hideable neighbour) are drawn, and each corner is darkened by the voxels around it for soft Minecraft-style shading.
    const FACES = [
      { n: [1, 0, 0], t1: [0, 1, 0], t2: [0, 0, 1] },
      { n: [-1, 0, 0], t1: [0, 0, 1], t2: [0, 1, 0] },
      { n: [0, 1, 0], t1: [0, 0, 1], t2: [1, 0, 0] },
      { n: [0, -1, 0], t1: [1, 0, 0], t2: [0, 0, 1] },
      { n: [0, 0, 1], t1: [1, 0, 0], t2: [0, 1, 0] },
      { n: [0, 0, -1], t1: [0, 1, 0], t2: [1, 0, 0] }
    ];
    const AO = [0.5, 0.68, 0.84, 1];
    const KIND_NAME = ["", "solid", "glass"];
    function occ(u, v, w, g) {
      const m = metaV(u, v, w);
      if ((m & 7) !== 1) return 0;
      const mg = (m >> 3) & 15;
      return mg === g || mg === 0 ? 1 : 0;
    }
    // ---------- build-in: every block drops from the sky and lands with a jiggle ----------
    // Each vertex carries its block's landing time in 1/64 s steps and a shader patch moves it, so the GPU does the work.
    // Blocks land from the ground up, sweeping across the site, with a little randomness.
    const DROP_STEP = 64;
    let dropMax = 0;
    function dropAt(x, y, z, seed) {
      const sweep = (x - X0 + (z - Z0)) / (X1 - X0 + Z1 - Z0 + 2);
      const r = (((seed * 2654435761) >>> 0) % 1000) / 1000;
      const t = Math.max(0, y + 3) * 0.12 + sweep * 0.8 + r * 0.3;
      if (t > dropMax) dropMax = t;
      return Math.min(255, Math.round(t * DROP_STEP));
    }
    let voxelCount = 0, faceCount = 0;
    (function meshVoxels() {
      const CH = 32;
      const bins = new Map();
      for (let v = GY0; v <= GY1; v++) {
        for (let w = GZ0; w <= GZ1; w++) {
          let i = vi(GX0, v, w);
          for (let u = GX0; u <= GX1; u++, i++) {
            const m = vMeta[i];
            if (!m) continue;
            voxelCount++;
            const kind = m & 7, g = (m >> 3) & 15, c = vCol[i];
            const cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;
            let dq = -1;
            for (let f = 0; f < 6; f++) {
              const F = FACES[f], n = F.n, t1 = F.t1, t2 = F.t2;
              const nm = metaV(u + n[0], v + n[1], w + n[2]);
              if (nm) {
                const nk = nm & 7, ng = (nm >> 3) & 15;
                if ((nk === 1 || nk === kind) && (ng === g || ng === 0)) continue;
              }
              const key = kind * 100000 + g * 1000 + (((u - GX0) / CH) | 0) * 10 + (((w - GZ0) / CH) | 0);
              let b = bins.get(key);
              if (!b) { b = { kind, g, pos: [], nor: [], col: [], uv: [], idx: [], drop: [] }; bins.set(key, b); }
              if (dq < 0) { const bu = u >> 1, bv = v >> 1, bw = w >> 1; dq = dropAt(bu, bv, bw, bu * 7919 + bv * 104729 + bw * 31); } // whole 1 m blocks fall together
              b.drop.push(dq, dq, dq, dq);
              const base = b.pos.length / 3;
              const ou = u + (n[0] > 0 ? 1 : 0), ov = v + (n[1] > 0 ? 1 : 0), ow = w + (n[2] > 0 ? 1 : 0);
              const qu = u + n[0], qv = v + n[1], qw = w + n[2];
              let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
              for (let k = 0; k < 4; k++) {
                const A = k === 1 || k === 2 ? 1 : 0, B = k >= 2 ? 1 : 0;
                const s1u = A ? t1[0] : -t1[0], s1v = A ? t1[1] : -t1[1], s1w = A ? t1[2] : -t1[2];
                const s2u = B ? t2[0] : -t2[0], s2v = B ? t2[1] : -t2[1], s2w = B ? t2[2] : -t2[2];
                const e1 = occ(qu + s1u, qv + s1v, qw + s1w, g);
                const e2 = occ(qu + s2u, qv + s2v, qw + s2w, g);
                const ec = occ(qu + s1u + s2u, qv + s1v + s2v, qw + s1w + s2w, g);
                const ao = e1 && e2 ? 0 : 3 - e1 - e2 - ec;
                if (k === 0) a0 = ao; else if (k === 1) a1 = ao; else if (k === 2) a2 = ao; else a3 = ao;
                b.pos.push((ou + A * t1[0] + B * t2[0]) * 0.5 + OX, (ov + A * t1[1] + B * t2[1]) * 0.5, (ow + A * t1[2] + B * t2[2]) * 0.5 + OZ);
                b.nor.push(n[0] * 127, n[1] * 127, n[2] * 127);
                const s = AO[ao];
                b.col.push(cr * s, cg * s, cb * s);
                b.uv.push(A, B);
              }
              if (a0 + a2 > a1 + a3) b.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
              else b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
              faceCount++;
            }
          }
        }
      }
      bins.forEach((b) => {
        const geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.Float32BufferAttribute(b.pos, 3));
        geo.setAttribute("normal", new T.BufferAttribute(new Int8Array(b.nor), 3, true));
        geo.setAttribute("color", new T.BufferAttribute(new Uint8Array(b.col), 3, true));
        geo.setAttribute("uv", new T.BufferAttribute(new Uint8Array(b.uv), 2));
        geo.setAttribute("aDrop", new T.BufferAttribute(new Uint8Array(b.drop), 1));
        geo.setIndex(b.idx);
        geo.computeBoundingSphere();
        const kind = KIND_NAME[b.kind], group = GROUPS[b.g];
        register(new T.Mesh(geo, materialFor(voxMat, kind, group)), kind, group);
      });
    })();
    canvas.dataset.voxels = String(voxelCount);
    canvas.dataset.faces = String(faceCount);

    // Free-sized details (furniture, water, bulbs, strings) stay as instanced boxes.
    const buckets = new Map();
    props.forEach((p) => {
      const k = p.kind + "|" + p.group;
      if (!buckets.has(k)) buckets.set(k, { kind: p.kind, group: p.group, items: [] });
      buckets.get(k).items.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, z: p.z + p.d / 2, sx: p.w, sy: p.h, sz: p.d, color: p.color, j: p.j });
    });
    const unit = new T.BoxGeometry(1, 1, 1);
    let danceMesh = null;
    let danceCells = [];
    const m4 = new T.Matrix4();
    const col = new T.Color();
    buckets.forEach((bk) => {
      const geo = unit.clone(), drops = new Uint8Array(bk.items.length);
      bk.items.forEach((it, i) => { drops[i] = Math.min(255, dropAt(it.x, it.y - it.sy / 2 + 0.5, it.z, i * 131 + it.sx * 977) + 10); });
      geo.setAttribute("aDrop", new T.InstancedBufferAttribute(drops, 1));
      const mesh = new T.InstancedMesh(geo, materialFor(baseMat, bk.kind, bk.group), bk.items.length);
      bk.items.forEach((it, i) => {
        m4.makeScale(it.sx, it.sy, it.sz);
        m4.setPosition(it.x + OX, it.y, it.z + OZ);
        mesh.setMatrixAt(i, m4);
        col.set(it.color);
        if (it.j) {
          const f = 0.92 + jr() * 0.14;
          col.setRGB(Math.min(1, col.r * f), Math.min(1, col.g * f), Math.min(1, col.b * f));
        }
        mesh.setColorAt(i, col);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      register(mesh, bk.kind, bk.group);
      if (bk.kind === "dance") {
        danceMesh = mesh;
        danceCells = bk.items.map((it) => [Math.floor(it.x * 2), Math.floor(it.z * 2)]);
      }
    });

    // water shimmer layers
    const waterPlanes = WATER_REGIONS.map(([x, z, w, d, top]) => {
      const t = rippleTex.clone();
      t.needsUpdate = true;
      t.repeat.set(w / 4, d / 4);
      const geo = new T.PlaneGeometry(w, d);
      geo.setAttribute("aDrop", new T.BufferAttribute(new Uint8Array(4).fill(dropAt(x + w / 2, top + 0.5, z + d / 2, x * 13 + z) + 12), 1));
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.5, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x + w / 2 + OX, top + 0.02, z + d / 2 + OZ);
      scene.add(m);
      return m;
    });

    // disco ball
    const discoGeo = new T.IcosahedronGeometry(0.55, 1);
    discoGeo.setAttribute("aDrop", new T.BufferAttribute(new Uint8Array(discoGeo.attributes.position.count).fill(dropAt(DANCE_CENTER[0], 7.5, DANCE_CENTER[1], 7) + 8), 1));
    const disco = new T.Mesh(discoGeo, new T.MeshPhongMaterial({ color: 0xdfe6ee, flatShading: true, shininess: 120, specular: 0xffffff }));
    disco.position.set(DANCE_CENTER[0] + OX, 4.85, DANCE_CENTER[1] + OZ);
    scene.add(disco);

    // The drop is applied in world space after instancing, in the shadow pass too, so shadows fall with the blocks.
    const buildClock = { value: reduceMotion ? 1e4 : -1 };
    const DROP_GLSL = [
      "attribute float aDrop;",
      "uniform float uBuild;",
      "float dropOffset() {",
      "  float t = uBuild - aDrop / " + DROP_STEP.toFixed(1) + ";",
      "  if (t < 0.0) return 400.0;",
      "  if (t < 0.5) { float k = 1.0 - t / 0.5; return 16.0 * k * k; }",
      "  t -= 0.5;",
      "  return 0.3 * exp(-7.0 * t) * sin(20.0 * t);",
      "}",
      ""
    ].join("\n");
    const DROP_PROJECT = [
      "vec4 mvPosition = vec4( transformed, 1.0 );",
      "#ifdef USE_INSTANCING",
      "  mvPosition = instanceMatrix * mvPosition;",
      "#endif",
      "mvPosition = modelMatrix * mvPosition;",
      "mvPosition.y += dropOffset();",
      "mvPosition = viewMatrix * mvPosition;",
      "gl_Position = projectionMatrix * mvPosition;"
    ].join("\n");
    const DROP_WORLDPOS = [
      "#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )",
      "  vec4 worldPosition = vec4( transformed, 1.0 );",
      "  #ifdef USE_INSTANCING",
      "    worldPosition = instanceMatrix * worldPosition;",
      "  #endif",
      "  worldPosition = modelMatrix * worldPosition;",
      "  worldPosition.y += dropOffset();",
      "#endif"
    ].join("\n");
    function patchDrop(mat) {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uBuild = buildClock;
        sh.vertexShader = DROP_GLSL + sh.vertexShader.replace("#include <project_vertex>", DROP_PROJECT).replace("#include <worldpos_vertex>", DROP_WORLDPOS);
      };
    }
    const dropDepth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
    new Set([dropDepth, disco.material].concat(meshes.map((m) => m.material), waterPlanes.map((m) => m.material))).forEach(patchDrop);
    // Close-up slice: zoomed right in, the world above head height is clipped away (avatars and effects never are),
    // so roofs, beams, umbrellas and tree tops stop hiding people. The plane always exists, it just sits high up.
    const clipPlane = new T.Plane(new T.Vector3(0, -1, 0), 1000);
    new Set([disco.material].concat(meshes.map((m) => m.material), waterPlanes.map((m) => m.material))).forEach((mat) => { mat.clippingPlanes = [clipPlane]; });
    meshes.forEach((m) => { m.customDepthMaterial = dropDepth; });
    const BUILD_END = dropMax + 0.5 + 0.6;
    let building = !reduceMotion, buildFrames = 0, buildLast = 0;

    // ---------- night lights ----------
    // Every point light exists from the start and is only brightened at night, so switching never recompiles shaders.
    const nightLights = [];
    function nightLight(x, y, z, color, power, dist) {
      const l = new T.PointLight(color, 0, dist, 2);
      l.position.set(x + OX, y, z + OZ);
      l.userData.power = power;
      scene.add(l);
      nightLights.push(l);
      return l;
    }
    [28.8, 34.2].forEach((x) => nightLight(x, 3.5, 30, 0xffc46b, 2.4, 8)); // pendants over the banquet table
    nightLight(38.5, 4.3, 28.6, 0xffb35c, 1.2, 6.5); // Viking bar
    const BED_WARM = new T.Color(0xffb070), BED_PINK = new T.Color(0xff3d8b);
    const bedLights = [[15.5, 7.5], [29, 8.5], [40, 8.5], [57, 8.5]].map(([x, z]) => nightLight(x, 4.4, z, 0xffb070, 1.7, 6.5));
    const discoLights = [0x2f7bff, 0xffd21a].map((c) => nightLight(DANCE_CENTER[0], 3.2, DANCE_CENTER[1], c, 2.4, 8.5));
    let loveRooms = [];

    // Mirror-ball dots: fixed directions off the ball, turned with it and landed on the ground plane.
    const discoFx = new T.Group();
    discoFx.visible = false;
    scene.add(discoFx);
    const BALL = [DANCE_CENTER[0], 4.85, DANCE_CENTER[1]], DOT_Y = 1.03;
    const dotRnd = mulberry(40);
    const dotDirs = [];
    for (let i = 0; i < 180; i++) {
      const el = 0.4 + dotRnd() * 1.05, az = dotRnd() * Math.PI * 2;
      dotDirs.push([Math.cos(el) * Math.cos(az), -Math.sin(el), Math.cos(el) * Math.sin(az)]);
    }
    const dotGeo = new T.PlaneGeometry(1, 1);
    dotGeo.rotateX(-Math.PI / 2);
    const dots = new T.InstancedMesh(dotGeo, new T.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }), dotDirs.length);
    const DOT_COLORS = [new T.Color(0xffffff), new T.Color(0xfff2a0), new T.Color(0xa8ceff)];
    dotDirs.forEach((d, i) => dots.setColorAt(i, DOT_COLORS[i % 3]));
    dots.frustumCulled = false;
    discoFx.add(dots);
    // light beams: open cones with their tip at the ball
    const beamGeo = new T.ConeGeometry(0.22, 1, 10, 1, true);
    beamGeo.translate(0, -0.5, 0);
    const beams = [0x2f7bff, 0xffd21a, 0xffffff, 0x2f7bff, 0xffd21a, 0xffffff, 0x2f7bff, 0xffd21a].map((c, i) => {
      const el = 0.65 + (i % 3) * 0.2, az = (i / 8) * Math.PI * 2;
      const m = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, clippingPlanes: [clipPlane] }));
      m.userData.dir = [Math.cos(el) * Math.cos(az), -Math.sin(el), Math.cos(el) * Math.sin(az)];
      m.frustumCulled = false;
      discoFx.add(m);
      return m;
    });
    const dotM = new T.Matrix4(), dotQ = new T.Quaternion(), dotP = new T.Vector3(), dotS = new T.Vector3(), DOWN = new T.Vector3(0, -1, 0), beamDir = new T.Vector3();
    function spin(d, a) { const c = Math.cos(a), s = Math.sin(a); return [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c]; }
    function updateNightLights(dt, t) {
      // someone getting busy in a bedroom turns its light pink, day or night
      bedLights.forEach((l, i) => {
        const love = loveRooms.indexOf(i) >= 0;
        l.color.copy(love ? BED_PINK : BED_WARM);
        l.intensity = love ? 2.4 + Math.sin(t * 5) * 0.7 : night ? l.userData.power : 0;
      });
      if (!night) return;
      discoLights.forEach((l, i) => {
        const a = t * (danceCrowd ? 1.9 : 1.1) + i * Math.PI;
        l.position.set(BALL[0] + Math.cos(a) * 2.6 + OX, 3.2, BALL[2] + Math.sin(a) * 3.2 + OZ);
        l.intensity = l.userData.power * (0.75 + 0.25 * Math.sin(t * 7 + i));
      });
      const turn = disco.rotation.y;
      dotDirs.forEach((d0, i) => {
        const d = spin(d0, turn), k = (DOT_Y - BALL[1]) / d[1];
        dotP.set(BALL[0] + d[0] * k + OX, DOT_Y, BALL[2] + d[2] * k + OZ);
        dotS.setScalar(0.1 + k * 0.022);
        dotM.compose(dotP, dotQ.set(0, 0, 0, 1), dotS);
        dots.setMatrixAt(i, dotM);
      });
      dots.instanceMatrix.needsUpdate = true;
      beams.forEach((m) => {
        const d = spin(m.userData.dir, turn * 0.6), k = (DOT_Y - BALL[1]) / d[1];
        beamDir.set(d[0], d[1], d[2]);
        m.position.set(BALL[0] + OX, BALL[1], BALL[2] + OZ);
        m.quaternion.setFromUnitVectors(DOWN, beamDir);
        m.scale.set(1 + k * 0.12, k, 1 + k * 0.12);
      });
    }

    // ---------- camera ----------
    const EL = 0.62;
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 1, 500);
    const HOME = { az: Math.PI / 4, fit: 64, x: 0, z: -1 };
    const view = { az: HOME.az, fit: HOME.fit, target: new T.Vector3(HOME.x, 1, HOME.z) };
    const goal = { az: HOME.az, fit: HOME.fit, target: new T.Vector3(HOME.x, 1, HOME.z) };
    // Zoom runs from the whole site down to about 2.5 m across, close enough to see faces side by side.
    const clampFit = (f) => Math.max(2.5, Math.min(110, f));
    function clampTarget(v) {
      v.x = Math.max(-40, Math.min(40, v.x));
      v.z = Math.max(-32, Math.min(32, v.z));
    }
    function applyCamera() {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      const aspect = w / h;
      const vh = aspect < 1 ? view.fit / aspect : view.fit;
      cam.left = (-vh * aspect) / 2;
      cam.right = (vh * aspect) / 2;
      cam.top = vh / 2;
      cam.bottom = -vh / 2;
      cam.updateProjectionMatrix();
      const d = 160, ce = Math.cos(EL);
      cam.position.set(view.target.x + Math.sin(view.az) * ce * d, view.target.y + Math.sin(EL) * d, view.target.z + Math.cos(view.az) * ce * d);
      cam.lookAt(view.target);
    }
    // The sun's shadow map only needs to cover what's on screen, so it tightens as you zoom in and close-ups get crisp
    // shadows. Its size steps through a ladder and its centre snaps to whole shadow texels, so shadows don't shimmer.
    const SUN_OFF = sun.position.clone();
    const sunZ = SUN_OFF.clone().normalize(), sunX = new T.Vector3(0, 1, 0).cross(sunZ).normalize(), sunY = sunZ.clone().cross(sunX);
    const SHADOW_LADDER = [7, 9, 12, 16, 21, 28, 37, 48, 62];
    const shadowAt = new T.Vector3();
    let shadowHalf = 62;
    function updateShadowView() {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
      const vh = aspect < 1 ? view.fit / aspect : view.fit, vw = vh * aspect;
      const need = vw / 2 + vh * 0.86 + 5;
      const half = SHADOW_LADDER.find((s) => s >= need) || 62;
      if (half !== shadowHalf) {
        shadowHalf = half;
        const c = sun.shadow.camera;
        c.left = c.bottom = -half;
        c.right = c.top = half;
        c.updateProjectionMatrix();
      }
      if (half >= 62) shadowAt.set(0, 0, 0);
      else {
        const texel = (2 * half) / sun.shadow.mapSize.x, t = view.target;
        const a = t.dot(sunX), b = t.dot(sunY);
        shadowAt.copy(t).addScaledVector(sunX, Math.round(a / texel) * texel - a).addScaledVector(sunY, Math.round(b / texel) * texel - b);
      }
      sun.target.position.copy(shadowAt);
      sun.position.copy(shadowAt).add(SUN_OFF);
    }
    // The slice starts below a view about 8 m across and drops to 2.4 m above the floor you're looking at by about 4 m.
    let sliceFloor = 1;
    function updateSlice(dt) {
      if (view.fit >= 8) { clipPlane.constant = 1000; return; }
      const cx = Math.floor(view.target.x - OX), cz = Math.floor(view.target.z - OZ);
      let floor = -Infinity;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const st = heightAt(cx + dx, cz + dz); if (st !== NONE) floor = Math.max(floor, (st + 1) / 2); }
      if (floor === -Infinity) floor = sliceFloor;
      sliceFloor += (floor - sliceFloor) * Math.min(1, dt * 6);
      clipPlane.constant = sliceFloor + 2.4 + Math.max(0, view.fit - 4) * 3;
    }
    function resize() {
      renderer.setSize(app.clientWidth, app.clientHeight, false);
      applyCamera();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(app);
    else window.addEventListener("resize", resize);
    resize();

    // ---------- state + UI ----------
    let selected = null;
    let seeInside = false;
    let night = false;
    const hint = document.getElementById("hint");
    const insideBtn = document.getElementById("inside");
    const nightBtn = document.getElementById("night");
    const chipsEl = document.getElementById("chips");
    const labelsEl = document.getElementById("labels");

    let hintTimer = setTimeout(dismissHint, 9000);
    function dismissHint() {
      clearTimeout(hintTimer);
      hint.classList.add("gone");
    }
    hint.textContent = readyHint;
    if (!coarse) hint.textContent = "Drag to explore · Scroll to zoom · Q / E to rotate · Click a place";

    CHIP_ORDER.forEach((id) => {
      const z = byId[id];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = z.name;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => (selected === z ? clearSelection() : selectZone(id, true)));
      chipsEl.appendChild(b);
      z.chip = b;
    });

    // tapped: a real tap on a place button or the scene. Only those make sounds or start music; a deep link or a
    // restored view just goes there (phones only allow sound after a tap, and nobody asked for it yet).
    function selectZone(id, tapped) {
      const z = byId[id];
      if (!z) return;
      if (tapped) zoneSound(id);
      // on tall screens the place buttons cover the bottom edge, so aim a little past the place
      const shift = canvas.clientHeight > canvas.clientWidth ? z.fit * 0.12 : 0;
      goal.target.set(z.at[0] + OX + Math.sin(goal.az) * shift, 1, z.at[2] + OZ + Math.cos(goal.az) * shift);
      clampTarget(goal.target);
      goal.fit = z.fit;
      if (me && z.spot) { walkTo(z.spot[0], z.spot[1]); follow = false; }
      markSelected(z);
    }
    function markSelected(z) {
      selected = z;
      ZONES.forEach((o) => o.chip.setAttribute("aria-pressed", String(o === z)));
      z.chip.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", inline: "center", block: "nearest" });
      dismissHint();
    }
    function clearSelection() {
      selected = null;
      ZONES.forEach((o) => o.chip.setAttribute("aria-pressed", "false"));
    }

    function setInside(on) {
      seeInside = on;
      insideBtn.setAttribute("aria-pressed", String(on));
    }
    insideBtn.addEventListener("click", () => setInside(!seeInside));

    function setNight(on) {
      night = on;
      app.classList.toggle("night", on);
      nightBtn.setAttribute("aria-pressed", String(on));
      hemi.intensity = on ? 0.34 : 0.72;
      hemi.color.set(on ? 0x8190ff : 0xe3f4ff);
      hemi.groundColor.set(on ? 0x1d2a4a : 0x5f8a45);
      sun.intensity = on ? 0.3 : 0.8;
      sun.color.set(on ? 0x9db2ff : 0xfff1d6);
      amb.intensity = on ? 0.14 : 0.18;
      baseMat.water.emissive.set(on ? 0x0b6d9f : 0x000000);
      disco.material.emissive.set(on ? 0x39414f : 0x000000);
      nightLights.forEach((l) => { l.intensity = on ? l.userData.power : 0; });
      discoFx.visible = on;
      nightChanged();
      if (typeof snd !== "undefined" && snd && snd.enabled) snd.setNight(on);
      meshes.forEach((m) => {
        if (m.userData.kind === "glass") m.material.emissive.set(on ? 0x7a5520 : 0x000000);
      });
    }
    nightBtn.addEventListener("click", () => setNight(!night));

    function rotate(dir) {
      goal.az += dir * (Math.PI / 2);
      dismissHint();
    }
    document.getElementById("rot-left").addEventListener("click", () => rotate(1));
    document.getElementById("rot-right").addEventListener("click", () => rotate(-1));
    function goHome() {
      clearSelection();
      goal.fit = HOME.fit;
      goal.target.set(HOME.x, 1, HOME.z);
    }
    document.getElementById("home").addEventListener("click", goHome);

    // ---------- picking ----------
    const raycaster = new T.Raycaster();
    const ndc = new T.Vector2();
    const ground = new T.Plane(new T.Vector3(0, 1, 0), -1);
    function setRay(cx, cy) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, cam);
    }
    function groundAt(cx, cy, out) {
      setRay(cx, cy);
      return raycaster.ray.intersectPlane(ground, out);
    }
    function zoneAtCell(x, z) {
      let best = null, area = Infinity;
      ZONES.forEach((zn) => {
        const r = zn.rect;
        if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) {
          const a = (r[2] - r[0] + 1) * (r[3] - r[1] + 1);
          if (a < area) { area = a; best = zn; }
        }
      });
      return best;
    }
    // Walk the tap ray through the voxel grid (3D DDA) to the first voxel that is currently shown.
    function pickVoxel(cx, cy) {
      setRay(cx, cy);
      const o = raycaster.ray.origin, d = raycaster.ray.direction;
      const P = [(o.x - OX) * 2, o.y * 2, (o.z - OZ) * 2], D = [d.x, d.y, d.z];
      const lo = [GX0, GY0, GZ0], hi = [GX1 + 1, GY1 + 1, GZ1 + 1];
      let t0 = 0, t1 = Infinity;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(D[a]) < 1e-9) { if (P[a] < lo[a] || P[a] > hi[a]) return null; continue; }
        let ta = (lo[a] - P[a]) / D[a], tb = (hi[a] - P[a]) / D[a];
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
      }
      if (t0 > t1) return null;
      const cell = [0, 0, 0], step = [0, 0, 0], next = [0, 0, 0], delta = [0, 0, 0];
      for (let a = 0; a < 3; a++) {
        const p = P[a] + D[a] * (t0 + 1e-6);
        cell[a] = Math.floor(p);
        step[a] = D[a] > 0 ? 1 : D[a] < 0 ? -1 : 0;
        delta[a] = step[a] ? Math.abs(1 / D[a]) : Infinity;
        next[a] = step[a] > 0 ? (cell[a] + 1 - p) * delta[a] : step[a] < 0 ? (p - cell[a]) * delta[a] : Infinity;
      }
      for (let s = 0; s < 1500; s++) {
        const [u, v, w] = cell;
        if (!inGrid(u, v, w)) return null;
        const m = vMeta[vi(u, v, w)];
        if (m && v * 0.5 < clipPlane.constant) {
          const group = GROUPS[(m >> 3) & 15];
          const b = isHideable(group) ? buildings.get(group.split(":")[0]) : null;
          if (!b || b.fade < 0.5) return { u, v, w, group };
        }
        const a = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : next[1] < next[2] ? 1 : 2;
        cell[a] += step[a];
        next[a] += delta[a];
      }
      return null;
    }
    function handleTap(cx, cy) {
      if (me && me.inCar) return; // driving: the pedals do the work
      if (me && me.drop === 0) {
        const c = carFromTap(cx, cy);
        if (c) { goToCar(c); clearSelection(); return; }
      }
      pendingCar = null;
      if (tapTV(cx, cy)) return; // the karaoke TV while its video plays
      if (tapDecks(cx, cy)) return; // the DJ decks: music on or off
      const hit = pickVoxel(cx, cy);
      if (me) {
        if (!hit) return;
        // the candy bowl: tapping the coffee table walks you round to it
        const tx = hit.u / 2, tz = hit.w / 2;
        if (tx >= 7 && tx < 9 && tz >= 9 && tz < 11 && hit.v / 2 < 3.5) {
          const ring = CANDY_RING.slice().sort((p, q) => Math.hypot(p[0] - me.x, p[1] - me.z) - Math.hypot(q[0] - me.x, q[1] - me.z));
          if (walkTo(ring[0][0], ring[0][1])) follow = true;
          clearSelection();
          return;
        }
        const tree = treeAtHit(hit);
        if (tree && Math.hypot(tree.x - me.x, tree.z - me.z) > 1.7) { // go and stand right by the trunk: actions.js takes it from there (climb, or pee in Cheeky mode)
          const at = nearestReachable(Math.floor(tree.x), Math.floor(tree.z));
          if (at && walkTo(at[0], at[1])) follow = true;
          clearSelection();
          return;
        }
        const x = Math.floor(hit.u / 2), z = Math.floor(hit.w / 2);
        const bid = hit.group.split(":")[0];
        const roof = isHideable(hit.group) && byId[bid];
        const zone = roof ? byId[bid] : zoneAtCell(x, z);
        const dest = roof && zone.spot ? zone.spot : [x, z];
        if (walkTo(dest[0], dest[1])) follow = true;
        if (zone) markSelected(zone);
        else clearSelection();
        return;
      }
      if (!hit) { clearSelection(); return; }
      const bid = hit.group.split(":")[0];
      if (isHideable(hit.group) && byId[bid]) { selectZone(bid, true); return; }
      const z = zoneAtCell(Math.floor(hit.u / 2), Math.floor(hit.w / 2));
      if (z) selectZone(z.id, true);
      else clearSelection();
    }

    // ---------- gestures ----------
    const pointers = new Map();
    let pinch = null;
    let tap = null;
    const pa = new T.Vector3(), pb = new T.Vector3();
    function panBy(x0, y0, x1, y1) {
      follow = false;
      if (!groundAt(x0, y0, pa) || !groundAt(x1, y1, pb)) return;
      goal.target.add(pa.sub(pb));
      clampTarget(goal.target);
      view.target.copy(goal.target);
      applyCamera();
    }
    function resetPinch() {
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, fit: goal.fit, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      } else {
        pinch = null;
      }
    }
    canvas.addEventListener("pointerdown", (e) => {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      tap = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
      resetPinch();
    });
    canvas.addEventListener("pointermove", (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (tap && Math.hypot(cur.x - tap.x, cur.y - tap.y) > 8) { tap = null; dismissHint(); }
      if (pointers.size === 1) {
        if (!tap) panBy(prev.x, prev.y, cur.x, cur.y);
      } else if (pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        goal.fit = view.fit = clampFit((pinch.fit * pinch.d) / d);
        applyCamera();
        panBy(pinch.mx, pinch.my, mx, my);
        pinch.mx = mx;
        pinch.my = my;
      }
    });
    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (tap && pointers.size === 0 && e.type === "pointerup" && performance.now() - tap.t < 500) handleTap(e.clientX, e.clientY);
      tap = null;
      resetPinch();
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      goal.fit = clampFit(goal.fit * Math.exp(e.deltaY * 0.0012));
      dismissHint();
    }, { passive: false });
    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (typeof driveKeys === "function" && driveKeys(e, true)) return;
      const k = e.key.toLowerCase();
      const step = goal.fit * 0.12;
      const fx = -Math.sin(view.az), fz = -Math.cos(view.az);
      const rx = Math.cos(view.az), rz = -Math.sin(view.az);
      let used = true;
      if (k === "arrowup" || k === "w") goal.target.add(new T.Vector3(fx * step, 0, fz * step));
      else if (k === "arrowdown" || k === "s") goal.target.add(new T.Vector3(-fx * step, 0, -fz * step));
      else if (k === "arrowleft" || k === "a") goal.target.add(new T.Vector3(-rx * step, 0, -rz * step));
      else if (k === "arrowright" || k === "d") goal.target.add(new T.Vector3(rx * step, 0, rz * step));
      else if (k === "q") rotate(1);
      else if (k === "e") rotate(-1);
      else if (k === "+" || k === "=") goal.fit = clampFit(goal.fit / 1.25);
      else if (k === "-" || k === "_") goal.fit = clampFit(goal.fit * 1.25);
      else if (k === "r") setInside(!seeInside);
      else if (k === "n") setNight(!night);
      else if (k === "m") soundBtn.click();
      else if (k === "h") goHome();
      else if (k === "f") findMe();
      else if (k === "escape") clearSelection();
      else used = false;
      if (used) { clampTarget(goal.target); dismissHint(); }
    });

    // ---------- party: avatars, walking and recorded tracks ----------
    // Guests are shared through a Firebase Realtime Database over its REST API: no keys, only the database URL,
    // with rules that let anyone read and each guest write their own record. While DB_URL is empty the party runs solo.
    const DB_URL = "https://fefe40-a3dae-default-rtdb.asia-southeast1.firebasedatabase.app";
    const FACEAPI = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15";
    const ID_RE = /^[a-z0-9]{6,24}$/;
    const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private browsing */ } };
    let myId = lsGet("fefe40.me");
    if (!myId || !ID_RE.test(myId)) {
      myId = (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).slice(0, 16);
      lsSet("fefe40.me", myId);
    }

    // Walkable ground: for each one-metre cell, the voxel people stand on, or NONE.
    // A cell needs 2 m of headroom; leaves and grass tufts are soft and don't block.
    const NONE = -100;
    const WW = X1 - X0 + 1, WD = Z1 - Z0 + 1;
    const stand = new Int16Array(WW * WD).fill(NONE);
    const cellIdx = (x, z) => (z - Z0) * WW + (x - X0);
    const inMap = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1;
    const heightAt = (x, z) => (inMap(x, z) ? stand[cellIdx(x, z)] : NONE);
    const hard = (u, v, w) => { const m = metaV(u, v, w); return m !== 0 && !(v >= 2 && (m & 128)); };
    for (let x = X0; x <= X1; x++) {
      for (let z = Z0; z <= Z1; z++) {
        let hi = NONE, lo = 999;
        for (let k = 0; k < 4 && lo !== NONE; k++) {
          const u = 2 * x + (k & 1), w = 2 * z + (k >> 1);
          let top = NONE;
          for (let v = 5; v >= -6; v--) {
            if (!hard(u, v, w)) continue;
            if (!hard(u, v + 1, w) && !hard(u, v + 2, w) && !hard(u, v + 3, w) && !hard(u, v + 4, w)) { top = v; break; }
          }
          if (top === NONE) lo = NONE;
          else { hi = Math.max(hi, top); lo = Math.min(lo, top); }
        }
        if (lo !== NONE && hi - lo <= 1) stand[cellIdx(x, z)] = hi;
      }
    }
    for (let x = 44; x <= 49; x++) for (let z = 26; z <= 33; z++) stand[cellIdx(x, z)] = 1; // the light-up floor sits flush with the lawn
    // furniture, cars and other detail boxes at body height block their cells
    props.forEach((p) => {
      if (p.kind === "water" || p.kind === "dance" || p.kind === "glow" || p.w < 0.12 || p.d < 0.12) return;
      for (let x = Math.floor(p.x); x < Math.ceil(p.x + p.w); x++) {
        for (let z = Math.floor(p.z); z < Math.ceil(p.z + p.d); z++) {
          const s = heightAt(x, z);
          if (s === NONE) continue;
          const fy = (s + 1) / 2;
          if (p.y < fy + 1.6 && p.y + p.h > fy + 0.35) stand[cellIdx(x, z)] = NONE;
        }
      }
    });

    // Cars move, so they block walking dynamically rather than in the baked grid (carList fills in once they're built).
    let carList = [];
    function carAt(x, z) {
      for (let i = 0; i < carList.length; i++) {
        const c = carList[i], dx = x + 0.5 - c.x, dz = z + 0.5 - c.z, cs = Math.cos(c.h), sn = Math.sin(c.h);
        const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
        if (Math.abs(lx) < c.w / 2 + 0.25 && Math.abs(lz) < c.l / 2 + 0.25) return c;
      }
      return null;
    }
    const SPAWN = [[29, 56], [30, 56], [31, 56], [32, 56], [29, 57], [30, 57], [31, 57], [32, 57]];
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    // one step may go up or down at most one metre; diagonal steps need both side cells open too
    function canStep(x, z, nx, nz) {
      const a = heightAt(x, z), b = heightAt(nx, nz);
      if (a === NONE || b === NONE || Math.abs(a - b) > 2 || (carList.length && carAt(nx, nz))) return false;
      if (nx !== x && nz !== z) {
        const c = heightAt(nx, z), d = heightAt(x, nz);
        if (c === NONE || d === NONE || Math.abs(c - a) > 2 || Math.abs(d - a) > 2 || Math.abs(c - b) > 2 || Math.abs(d - b) > 2) return false;
      }
      return true;
    }
    const reach = new Uint8Array(WW * WD);
    (function flood() {
      const q = [];
      SPAWN.forEach(([x, z]) => { if (heightAt(x, z) !== NONE) { reach[cellIdx(x, z)] = 1; q.push([x, z]); } });
      for (let i = 0; i < q.length; i++) {
        const [x, z] = q[i];
        DIRS.forEach(([dx, dz]) => {
          const nx = x + dx, nz = z + dz;
          if (!inMap(nx, nz) || reach[cellIdx(nx, nz)] || !canStep(x, z, nx, nz)) return;
          reach[cellIdx(nx, nz)] = 1;
          q.push([nx, nz]);
        });
      }
    })();
    function nearestReachable(x, z) {
      for (let r = 0; r <= 8; r++) {
        let best = null, bd = Infinity;
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const nx = x + dx, nz = z + dz, d = dx * dx + dz * dz;
            if (inMap(nx, nz) && reach[cellIdx(nx, nz)] && d < bd && !(carList.length && carAt(nx, nz))) { bd = d; best = [nx, nz]; }
          }
        }
        if (best) return best;
      }
      return null;
    }
    // A* over the one-metre grid, 8 directions, with a small cost for climbing
    function findPath(sx, sz, tx, tz) {
      const start = cellIdx(sx, sz), goalI = cellIdx(tx, tz);
      if (start === goalI) return [[sx, sz]];
      const N = WW * WD;
      const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), done = new Uint8Array(N);
      const heap = [];
      const push = (f, i) => {
        heap.push([f, i]);
        for (let c = heap.length - 1; c > 0;) {
          const p = (c - 1) >> 1;
          if (heap[p][0] <= heap[c][0]) break;
          [heap[p], heap[c]] = [heap[c], heap[p]];
          c = p;
        }
      };
      const pop = () => {
        const top = heap[0], end = heap.pop();
        if (heap.length) {
          heap[0] = end;
          for (let c = 0; ;) {
            const l = 2 * c + 1, r = l + 1;
            let m = c;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === c) break;
            [heap[m], heap[c]] = [heap[c], heap[m]];
            c = m;
          }
        }
        return top;
      };
      const est = (x, z) => { const dx = Math.abs(x - tx), dz = Math.abs(z - tz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
      g[start] = 0;
      push(est(sx, sz), start);
      while (heap.length) {
        const i = pop()[1];
        if (done[i]) continue;
        if (i === goalI) break;
        done[i] = 1;
        const x = X0 + (i % WW), z = Z0 + ((i / WW) | 0);
        for (let d = 0; d < 8; d++) {
          const dx = DIRS[d][0], dz = DIRS[d][1], nx = x + dx, nz = z + dz;
          if (!inMap(nx, nz) || !canStep(x, z, nx, nz)) continue;
          const j = cellIdx(nx, nz);
          const c = g[i] + (dx && dz ? 1.414 : 1) + Math.abs(stand[j] - stand[i]) * 0.25;
          if (c < g[j]) { g[j] = c; came[j] = i; push(c + est(nx, nz), j); }
        }
      }
      if (came[goalI] < 0) return null;
      const path = [];
      for (let i = goalI; i !== start; i = came[i]) path.push([X0 + (i % WW), Z0 + ((i / WW) | 0)]);
      path.push([sx, sz]);
      return path.reverse();
    }
    const SPOTS = {
      pool: [60, 22], dance: [46, 29], kitchen: [24, 28], bedroom: [16, 7], bathroom: [16, 12], bar: [38, 30],
      restroom: [24, 33], lounge: [37, 34], pavilion: [33, 33], court: [55, 45], mainVilla: [9, 18], lanaiVilla: [34, 16],
      poolVilla: [58, 9], playground: [40, 44], parking: [9, 47], gate: [30, 56]
    };
    Object.keys(SPOTS).forEach((id) => { if (byId[id]) byId[id].spot = SPOTS[id]; });

    // ---------- avatars in the scene ----------
    const puffGeo = new T.BoxGeometry(0.28, 0.28, 0.28);
    const puffMat = new T.MeshBasicMaterial({ color: 0xffffff });
    const puffs = [];
    function poof(x, y, z) {
      for (let i = 0; i < 10; i++) {
        const m = new T.Mesh(puffGeo, puffMat);
        const a = (i / 10) * Math.PI * 2;
        m.position.set(x + OX, y + 0.2, z + OZ);
        m.userData = { vx: Math.cos(a) * 2.2, vz: Math.sin(a) * 2.2, vy: 1 + (i % 3) * 0.6, life: 0.55 };
        scene.add(m);
        puffs.push(m);
      }
    }
    function updatePuffs(dt) {
      for (let i = puffs.length - 1; i >= 0; i--) {
        const m = puffs[i], d = m.userData;
        d.life -= dt;
        if (d.life <= 0) { scene.remove(m); puffs.splice(i, 1); continue; }
        m.position.set(m.position.x + d.vx * dt, m.position.y + d.vy * dt, m.position.z + d.vz * dt);
        m.scale.setScalar(Math.max(0.01, d.life / 0.55));
      }
    }
    const worldY = (x, z) => { const s = heightAt(x, z); return s === NONE ? 1 : (s + 1) / 2; };
    function makeActor(name, look, isMe, key) {
      const av = FefeAvatar.build(T, look);
      av.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(av.root);
      const tag = document.createElement("span");
      tag.className = "tag" + (isMe ? " me" : "");
      tag.textContent = name;
      tag.hidden = true;
      labelsEl.appendChild(tag);
      return { name, key: key || name, look, av, tag, x: 30.5, y: 1, z: 56.5, heading: Math.PI / 4, phase: 0, drop: 0, dropV: 0, moving: false, idleT: 0 };
    }
    function removeActor(a) {
      scene.remove(a.av.root);
      a.av.dispose();
      a.tag.remove();
    }
    function poseActor(a, dt, moving, heading) {
      if (a.drop > 0) {
        a.dropV += 30 * dt;
        a.drop -= a.dropV * dt;
        if (a.drop <= 0) { a.drop = 0; a.dropV = 0; poof(a.x, a.y, a.z); if (typeof sfx === "function") sfx("pop", a.x, a.z); voiceSay(a, ["birthday", "greet"], a.x, a.z, 0.45); }
      }
      if (moving) a.phase += dt * 10;
      a.moving = !!moving && a.drop === 0;
      a.idleT = a.moving || a.drop > 0 ? 0 : a.idleT + dt;
      if (heading !== undefined) {
        const d = Math.atan2(Math.sin(heading - a.heading), Math.cos(heading - a.heading));
        a.heading += d * Math.min(1, dt * 12);
      }
      a.y += (worldY(Math.floor(a.x), Math.floor(a.z)) - a.y) * Math.min(1, dt * 14);
      // after an act drew someone away from their cell, ease them back over a fraction of a second
      if (a.blendX || a.blendZ) {
        const f = Math.exp(-dt * 7);
        a.blendX = Math.abs(a.blendX * f) < 0.01 ? 0 : a.blendX * f;
        a.blendZ = Math.abs(a.blendZ * f) < 0.01 ? 0 : a.blendZ * f;
      }
      a.av.root.position.set(a.x + OX + (a.blendX || 0), a.y + a.drop, a.z + OZ + (a.blendZ || 0));
      a.av.root.rotation.y = a.heading;
      a.av.setPose(a.phase, moving && a.drop === 0);
    }

    // ---------- me: walking and recording ----------
    // rec is the walk being recorded now: recs.day while it's daytime, recs.night once the night switch is on.
    let me = null, myPath = [], follow = false, rec = null, recs = null, myName = "", myLook = null, pendingWalk = null;
    const SPEED = 3.4;
    function walkTo(tx, tz) {
      if (!me) return false;
      if (me.drop > 0) { pendingWalk = [tx, tz]; return true; } // still falling in: go once landed
      const target = inMap(tx, tz) && reach[cellIdx(tx, tz)] ? [tx, tz] : nearestReachable(tx, tz);
      if (!target) return false;
      let sx = Math.floor(me.x), sz = Math.floor(me.z);
      if (!inMap(sx, sz) || !reach[cellIdx(sx, sz)]) {
        const n = nearestReachable(sx, sz);
        if (!n) return false;
        [sx, sz] = n;
      }
      const path = findPath(sx, sz, target[0], target[1]);
      if (!path) return false;
      if (!myPath.length) recNode(sx, sz); // marks the end of a standstill
      myPath = path;
      return true;
    }
    // Walk an actor along a path of cells at walking speed; onNode fires as each cell centre is reached.
    function stepAlong(a, path, dt, onNode) {
      let budget = SPEED * (a.speedMul || 1) * dt, moving = false, heading; // actions can speed someone up
      while (budget > 1e-6 && path.length) {
        const [cx, cz] = path[0];
        const dx = cx + 0.5 - a.x, dz = cz + 0.5 - a.z, dist = Math.hypot(dx, dz);
        if (dist > 1e-4) heading = Math.atan2(dx, dz);
        moving = true;
        if (dist <= budget) {
          a.x = cx + 0.5;
          a.z = cz + 0.5;
          budget -= dist;
          path.shift();
          if (onNode) onNode(cx, cz, path.length === 0);
        } else {
          a.x += (dx / dist) * budget;
          a.z += (dz / dist) * budget;
          budget = 0;
        }
      }
      return { moving, heading };
    }
    function updateMe(dt) {
      if (!me) return;
      if (me.inCar) { // driving: the car moves, the guest rides along
        const c = me.inCar;
        me.x = c.x;
        me.z = c.z;
        me.y = c.y;
        me.moving = false;
        me.idleT = 0;
        placeDriver(me, c, drive.steer);
        const moving = Math.abs(c.speed) > 0.2;
        tickRecording(dt, moving);
        // the drive goes into the loop too: a node every few metres, and wherever the car comes to a stop
        const last = rec && rec.nodes[rec.nodes.length - 1], cx = Math.floor(c.x), cz = Math.floor(c.z);
        if (last && (Math.abs(cx - last[1]) + Math.abs(cz - last[2]) >= 3 || (!moving && (cx !== last[1] || cz !== last[2] || last[4] !== hdg64(c.h))))) recHere();
        if (follow) { goal.target.set(c.x + OX, c.y + 1, c.z + OZ); clampTarget(goal.target); }
        heartbeat(performance.now());
        updateWardrobe();
        return;
      }
      if (pendingCar && !myPath.length && me.drop === 0) {
        if (Math.hypot(pendingCar.x - me.x, pendingCar.z - me.z) < pendingCar.l / 2 + 1.8) enterCar(pendingCar);
        else pendingCar = null;
      }
      if (me.drop === 0 && pendingWalk) {
        const [px, pz] = pendingWalk;
        pendingWalk = null;
        walkTo(px, pz);
      }
      const step = me.drop === 0 ? stepAlong(me, myPath, dt, (cx, cz, last) => { recNode(cx, cz); if (last) scheduleSave(1200); }) : { moving: false };
      tickRecording(dt, step.moving);
      poseActor(me, dt, step.moving, step.heading);
      if (follow && (step.moving || me.drop > 0)) {
        goal.target.set(me.x + OX, me.y + 0.9, me.z + OZ);
        clampTarget(goal.target);
      }
      heartbeat(performance.now());
      updateWardrobe();
    }
    // The recording clock runs while walking and for at most 20 s of each standstill: long enough for the replayed
    // loop to show what they got up to there, short enough to keep it lively.
    const IDLE_MAX = 20;
    const newRec = (x, z) => ({ clock: 0, idle: 0, nodes: [[0, x, z]] });
    // Each loop is 4 minutes long. A new one only replaces the loop you saved last time (on this phone) once it's a
    // full 4 minutes; until then your old loop is what everyone sees. Same phone, same guest (fefe40.me).
    const LOOP_S = 240;
    const keptTrack = { day: lsGet("fefe40.loopDay") || "", night: lsGet("fefe40.loopNight") || "" };
    let loopDoneShown = { day: false, night: false };
    function loopTrack(mode) {
      const r = recs && recs[mode];
      if (r && r.clock >= LOOP_S) {
        const tr = trackOf(r);
        if (tr !== keptTrack[mode]) { keptTrack[mode] = tr; lsSet(mode === "day" ? "fefe40.loopDay" : "fefe40.loopNight", tr); }
        return tr;
      }
      return keptTrack[mode] || (r ? trackOf(r) : "");
    }
    function startRecording(x, z) {
      recs = { day: null, night: null };
      recs[night ? "night" : "day"] = rec = newRec(x, z);
    }
    // Day and night are separate loops: flipping the switch closes one track where you stand and carries on
    // in the other (starting it if new), and everyone else's replays swap to that time of day.
    function nightChanged() {
      if (me && recs) {
        const x = Math.floor(me.x), z = Math.floor(me.z), mode = night ? "night" : "day";
        recHere();
        if (!recs[mode]) recs[mode] = newRec(x, z);
        rec = recs[mode];
        rec.idle = 0;
        recHere();
        scheduleSave(800);
        lastBeat = 0; // tell everyone straight away which time of day we're live in
      }
      ghosts.forEach((g) => setGhostTrack(g, true));
      updateGuestCount();
    }
    function tickRecording(dt, moving) {
      if (!rec) return;
      if (rec.clock >= LOOP_S) { // this loop is full: say so once, and save it
        const mode = recs.night === rec ? "night" : "day";
        if (!loopDoneShown[mode]) {
          loopDoneShown[mode] = true;
          scheduleSave(300);
          hint.textContent = "Your 4-minute " + mode + " loop is recorded! Everyone now sees it" + (mode === "day" ? ". Try the night switch for a night loop." : ".");
          hint.classList.remove("gone");
          clearTimeout(hintTimer);
          hintTimer = setTimeout(dismissHint, 6000);
        }
        return;
      }
      if (moving) { rec.idle = 0; rec.clock += dt; }
      else if (rec.idle < IDLE_MAX) {
        const s = Math.min(dt, IDLE_MAX - rec.idle);
        rec.idle += s;
        rec.clock += s;
        if (rec.idle >= IDLE_MAX) scheduleSave(500); // keep the whole standstill in the shared loop
      }
    }
    // A node is [time, x, z], or [time, x, z, car, heading] while driving: car is its number from 1 and heading
    // is in 64ths of a turn.
    function recNode(x, z, car, h) {
      if (!rec || rec.nodes.length >= 1500 || rec.clock >= LOOP_S) return;
      const last = rec.nodes[rec.nodes.length - 1];
      const t = Math.max(last[0], Math.round(rec.clock * 10));
      if (last[0] === t && last[1] === x && last[2] === z && (last[3] || 0) === (car || 0) && (last[4] || 0) === (h || 0)) return;
      rec.nodes.push(car ? [t, x, z, car, h] : [t, x, z]);
    }
    const hdg64 = (h) => ((Math.round((h / (2 * Math.PI)) * 64) % 64) + 64) % 64;
    // where I am right now: in my car if I'm driving
    function recHere() {
      const c = me.inCar;
      if (c) recNode(Math.floor(c.x), Math.floor(c.z), c.idx + 1, hdg64(c.h));
      else recNode(Math.floor(me.x), Math.floor(me.z));
    }

    // ---------- sharing ----------
    const store = DB_URL
      ? {
          shared: true,
          async index() {
            const r = await fetch(DB_URL + "/fefe40/index.json", { cache: "no-store" });
            if (!r.ok) throw new Error("index " + r.status);
            return (await r.json()) || {};
          },
          async get(id) {
            const r = await fetch(DB_URL + "/fefe40/guests/" + id + ".json", { cache: "no-store" });
            if (!r.ok) throw new Error("guest " + r.status);
            return r.json();
          },
          async live() {
            const r = await fetch(DB_URL + "/fefe40/live.json", { cache: "no-store" });
            if (!r.ok) throw new Error("live " + r.status);
            return (await r.json()) || {};
          },
          beat(id, data) {
            return fetch(DB_URL + "/fefe40/live/" + id + ".json", { method: "PUT", body: JSON.stringify(data) });
          },
          leave(id) {
            return fetch(DB_URL + "/fefe40/live/" + id + ".json", { method: "DELETE", keepalive: true });
          },
          async djGet() {
            const r = await fetch(DB_URL + "/fefe40/dj.json", { cache: "no-store" });
            if (!r.ok) throw new Error("dj " + r.status);
            return r.json();
          },
          djSet(on) {
            return fetch(DB_URL + "/fefe40/dj.json", { method: "PUT", body: JSON.stringify({ on: !!on, t: Date.now() }) });
          },
          voicePut(id, clip, str) {
            return fetch(DB_URL + "/fefe40/voices/" + id + "/" + clip + ".json", { method: "PUT", body: JSON.stringify(str) });
          },
          async voiceGet(id, clip) {
            const r = await fetch(DB_URL + "/fefe40/voices/" + id + "/" + clip + ".json");
            if (!r.ok) throw new Error("voice " + r.status);
            return r.json();
          },
          voiceDrop(id) {
            return fetch(DB_URL + "/fefe40/voices/" + id + ".json", { method: "DELETE" });
          },
          put(id, record, keepalive) {
            const req = (body) => ({ method: "PUT", body: JSON.stringify(body), keepalive: !!keepalive });
            return Promise.all([
              fetch(DB_URL + "/fefe40/guests/" + id + ".json", req(record)),
              fetch(DB_URL + "/fefe40/index/" + id + ".json", req(record.at))
            ]);
          }
        }
      : {
          shared: false,
          async index() { return {}; },
          async get() { return null; },
          async live() { return {}; },
          async beat() {},
          async leave() {},
          async djGet() { return null; },
          async djSet() {},
          async voicePut() { return { ok: true }; },
          async voiceGet() { throw new Error("not shared"); },
          async voiceDrop() {},
          async put(id, record) { lsSet("fefe40.mine", JSON.stringify(record)); }
        };
    let saveTimer = 0;
    function scheduleSave(ms) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveMe(false), ms);
    }
    function toB64(bytes) {
      let s = "";
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s);
    }
    // the recorded nodes, plus the time spent standing at the last one so the loop lingers there too
    function trackOf(r) {
      const nodes = r.nodes.slice(), end = nodes[nodes.length - 1], t = Math.round(r.clock * 10);
      if (!myPath.length && t > end[0]) nodes.push([t].concat(end.slice(1)));
      return nodes.map((n) => n.join(",")).join(";");
    }
    function saveMe(leaving) {
      if (!me) return;
      const record = {
        name: myName,
        body: myLook.body,
        outfit: myLook.outfit,
        skin: myLook.skin,
        hair: myLook.hair,
        face: typeof myLook.face === "string" ? myLook.face : myLook.face ? toB64(myLook.face) : "",
        cheeky: myLook.cheeky ? 1 : 0,
        h: FefeAvatar.bodyShape(myLook).h,
        wt: FefeAvatar.bodyShape(myLook).wt,
        track: loopTrack("day"),
        trackN: loopTrack("night"),
        voice: [...myVoiceUp].join(","),
        at: Date.now()
      };
      Promise.resolve(store.put(myId, record, leaving)).catch(() => { /* try again after the next walk */ });
    }
    function leaving() {
      saveMe(true);
      if (me) { store.leave(myId).catch(() => {}); lastBeat = 0; lastBeatCell = ""; }
    }
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") leaving(); });
    window.addEventListener("pagehide", leaving);

    // Other guests' records are untrusted input: clean every field before use.
    function sanitize(r) {
      if (!r || typeof r !== "object") return null;
      const hex = (c, d) => (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : d);
      const photo = (str) => {
        if (typeof str !== "string" || !str || str.length > 4200) return null;
        try {
          const b = atob(str);
          if (b.length !== 768 && b.length !== 3072) return null;
          const px = new Uint8Array(b.length);
          for (let i = 0; i < b.length; i++) px[i] = b.charCodeAt(i);
          return px;
        } catch (e) { return null; }
      };
      // faces come as a small image string (current) or raw pixels (older records)
      const faceStr = (v) => (FefeAvatar.isFaceString && FefeAvatar.isFaceString(v) ? v : photo(v));
      const face = faceStr(r.face), faceL = faceStr(r.faceL), faceR = faceStr(r.faceR), faceT = faceStr(r.faceT);
      const parse = (track) => {
        const nodes = [];
        if (typeof track !== "string" || track.length > 30000) return nodes;
        track.split(";").slice(0, 1500).forEach((part) => {
          const [t, x, z, c, h] = part.split(",").map(Number);
          const car = Number.isInteger(c) && c >= 1 && c <= carList.length ? c : 0;
          if (![t, x, z].every(Number.isFinite) || !inMap(x, z) || (!car && heightAt(x, z) === NONE)) return;
          if (nodes.length && t < nodes[nodes.length - 1][0]) return;
          nodes.push(car ? [t, x | 0, z | 0, car, Number.isFinite(h) ? (((h | 0) % 64) + 64) % 64 : 0] : [t, x | 0, z | 0]);
        });
        return nodes;
      };
      const nodes = parse(r.track), nodesN = parse(r.trackN);
      const voice = typeof r.voice === "string" && VOICE ? r.voice.slice(0, 1200).split(",").filter((id) => CLIP_ID.test(id) && VOICE.byId.has(id)).slice(0, 240) : [];
      const name = String(r.name || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 20) || "Guest";
      const look = { body: r.body === "f" ? "f" : "m", outfit: Math.max(0, Math.min(FefeAvatar.OUTFITS.length - 1, r.outfit | 0)), skin: hex(r.skin, "#D9A57E"), hair: hex(r.hair, "#4A3020"), face, faceL, faceR, faceT, cheeky: r.cheeky === 1 };
      const sh = FefeAvatar.bodyShape({ body: look.body, h: +r.h || 0, wt: +r.wt || 0 }); // clamps to sensible sizes
      look.h = sh.h;
      look.wt = sh.wt;
      return { name, look, nodes, nodesN, voice, key: [name, look.body, look.outfit, look.skin, look.hair, look.h, look.wt, look.cheeky ? 1 : 0, typeof r.face === "string" ? r.face : "", faceL ? r.faceL : "", faceR ? r.faceR : "", faceT ? r.faceT : ""].join("|") };
    }
    const ghosts = new Map();
    const MAX_GHOSTS = 60;
    function dropGhost(id, g) {
      leaveCar(g);
      removeActor(g.actor);
      ghosts.delete(id);
    }
    function upsertGhost(id, clean, at) {
      let g = ghosts.get(id);
      if (g && g.key !== clean.key) { dropGhost(id, g); g = null; }
      const day = clean.nodes.length ? clean.nodes : clean.nodesN.length ? clean.nodesN : [[0, SPAWN[0][0], SPAWN[0][1]]];
      if (!g) {
        const actor = makeActor(clean.name, clean.look, false, id);
        g = { actor, key: clean.key, t: -1, i: 0 };
        ghosts.set(id, g);
      }
      g.at = at;
      g.voice = clean.voice;
      g.day = day;
      g.night = clean.nodesN.length ? clean.nodesN : null;
      setGhostTrack(g, false);
    }
    // At night a guest replays their night walk if they made one, otherwise their day walk.
    function setGhostTrack(g, swapped) {
      const nodes = night && g.night ? g.night : g.day;
      const changed = g.nodes !== nodes;
      g.nodes = nodes;
      g.dur = nodes[nodes.length - 1][0] / 10 + 4;
      g.i = 0;
      const a = g.actor;
      if (g.npc) { // test crowd: everyone shares one clock so the group scenes line up
        g.t = (Date.now() / 1000) % g.dur;
        if (swapped && changed) { a.drop = 12; a.dropV = 0; }
      } else if (g.t < 0) { // new guest: join somewhere along their loop
        g.t = Math.random() * g.dur;
        a.x = nodes[0][1] + 0.5;
        a.z = nodes[0][2] + 0.5;
        a.y = worldY(nodes[0][1], nodes[0][2]);
      } else if (swapped && changed && !g.live) { // other time of day: start their other loop with a fresh drop-in
        g.t = 0;
        a.drop = 12;
        a.dropV = 0;
      }
      if (g.t > g.dur) g.t = 0;
    }
    // Guests who are online right now walk live to where they really are; everyone else loops their recorded walk,
    // dropping back in at their start each time round.
    function updateGhost(g, id, dt) {
      const a = g.actor, now = liveMap[id];
      if (liveHere(id)) {
        const cell = now.x + "," + now.z;
        if (now.c) { // driving right now: their car heads for the latest spot they sent
          if (!g.live) { g.live = true; a.tag.classList.add("live"); a.drop = 0; }
          const c = rideCar(g, now.c - 1, now.x + 0.5, now.z + 0.5, now.h);
          if (!c) return;
          const dx = now.x + 0.5 - c.x, dz = now.z + 0.5 - c.z, d = Math.hypot(dx, dz);
          const step = Math.min(d, Math.min(12, 2 + d * 0.9) * dt);
          const h = d > 1.5 ? Math.atan2(dx, dz) : (now.h / 64) * 2 * Math.PI;
          if (d > 1e-3) { c.x += (dx / d) * step; c.z += (dz / d) * step; }
          c.h += Math.atan2(Math.sin(h - c.h), Math.cos(h - c.h)) * Math.min(1, dt * 4);
          seatDriver(g, c, dt, d > 0.3);
          g.cell = "";
          return;
        }
        if (g.car) { // out of the car again: they climb out where they are now
          leaveCar(g);
          a.x = now.x + 0.5;
          a.z = now.z + 0.5;
          a.y = worldY(now.x, now.z);
          g.path = [];
          g.cell = cell;
        }
        if (!g.live) {
          g.live = true;
          a.tag.classList.add("live");
          a.x = now.x + 0.5;
          a.z = now.z + 0.5;
          a.y = worldY(now.x, now.z);
          a.drop = 12;
          a.dropV = 0;
          g.path = [];
          g.cell = cell;
        } else if (g.cell !== cell) {
          g.cell = cell;
          let sx = Math.floor(a.x), sz = Math.floor(a.z);
          if (!inMap(sx, sz) || !reach[cellIdx(sx, sz)]) [sx, sz] = nearestReachable(sx, sz) || [now.x, now.z];
          const path = reach[cellIdx(now.x, now.z)] ? findPath(sx, sz, now.x, now.z) : null;
          if (path) g.path = path;
          else { g.path = []; a.x = now.x + 0.5; a.z = now.z + 0.5; }
        }
        const step = a.drop === 0 ? stepAlong(a, g.path, dt) : { moving: false };
        poseActor(a, dt, step.moving, step.heading);
        return;
      }
      if (g.live) {
        g.live = false;
        a.tag.classList.remove("live");
        g.t = 0;
        g.i = 0;
        leaveCar(g);
        a.drop = 12;
        a.dropV = 0;
      }
      const n = g.nodes;
      g.t += dt;
      if (g.t >= g.dur) { g.t = 0; g.i = 0; leaveCar(g); a.drop = 12; a.dropV = 0; }
      const t10 = g.t * 10;
      if (g.i >= n.length || n[g.i][0] > t10) g.i = 0;
      while (g.i < n.length - 1 && n[g.i + 1][0] <= t10) {
        g.i++;
        // a jump in the track (they flipped day and night somewhere else) replays as a fresh drop-in; getting
        // into a car or out of one doesn't
        const p0 = n[g.i - 1], p1 = n[g.i];
        if (!p0[3] && !p1[3] && (Math.abs(p1[1] - p0[1]) > 1 || Math.abs(p1[2] - p0[2]) > 1)) { a.drop = 12; a.dropV = 0; }
      }
      const p = n[g.i], q = n[Math.min(g.i + 1, n.length - 1)];
      if (p[3]) { // driving: the car follows the recorded route, turning the way they turned
        const f = q !== p && q[3] === p[3] ? Math.min(1, Math.max(0, (t10 - p[0]) / Math.max(1, q[0] - p[0]))) : 0;
        const h0 = (p[4] / 64) * 2 * Math.PI, h1 = f ? (q[4] / 64) * 2 * Math.PI : h0;
        const x = p[1] + 0.5 + (f ? (q[1] - p[1]) * f : 0), z = p[2] + 0.5 + (f ? (q[2] - p[2]) * f : 0);
        const c = rideCar(g, p[3] - 1, x, z, p[4]);
        if (c) {
          c.x = x;
          c.z = z;
          c.h = h0 + Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)) * f;
          seatDriver(g, c, dt, f > 0 && f < 1 && (q[1] !== p[1] || q[2] !== p[2]));
          return;
        }
      } else if (g.car) {
        const c = g.car;
        leaveCar(g);
        poof(c.x, c.y, c.z);
      }
      let moving = false, heading;
      if (q !== p && (q[1] !== p[1] || q[2] !== p[2])) {
        const f = Math.min(1, Math.max(0, (t10 - p[0]) / Math.max(1, q[0] - p[0])));
        a.x = p[1] + 0.5 + (q[1] - p[1]) * f;
        a.z = p[2] + 0.5 + (q[2] - p[2]) * f;
        moving = f < 1;
        heading = Math.atan2(q[1] - p[1], q[2] - p[2]);
      } else {
        a.x = p[1] + 0.5;
        a.z = p[2] + 0.5;
      }
      poseActor(a, dt, moving, heading);
    }
    // A replay (or a live guest) driving takes the real car if nobody else has it, so the car ends up wherever they
    // leave it; otherwise they get a copy of it that only exists for the ride.
    function rideCar(g, idx, x, z, h64) {
      const real = carList[idx];
      if (!real || !real.g.visible) return null; // cars haven't been built in yet
      let c = g.car;
      if (c && c.idx === idx && (c.clone || drive.car !== real)) return c;
      leaveCar(g);
      if (drive.car !== real && !real.rider) {
        c = real;
        c.rider = g;
        c.speed = c.vx = c.vz = 0;
        if (Math.hypot(c.x - x, c.z - z) > 2.5) { // it's somewhere else: drop it in at their route
          c.x = x;
          c.z = z;
          c.h = (h64 / 64) * 2 * Math.PI;
          c.drop = 8;
          c.dropV = 0;
        }
      } else {
        c = buildCar(CAR_SPECS[idx], idx);
        c.clone = true;
        c.x = x;
        c.z = z;
        c.h = (h64 / 64) * 2 * Math.PI;
        const gy = carGround(x, z);
        c.y = gy === null ? 1 : gy;
      }
      c.top.forEach((m) => { m.visible = false; });
      g.car = c;
      g.actor.inCar = c;
      g.actor.blendX = g.actor.blendZ = 0;
      return c;
    }
    function leaveCar(g) {
      const c = g.car;
      if (!c) return;
      g.car = null;
      g.actor.inCar = null;
      if (c.clone) scene.remove(c.g);
      else {
        c.rider = null;
        c.speed = c.vx = c.vz = 0;
        c.top.forEach((m) => { m.visible = true; });
      }
    }
    // the car where the ride has put it, and the guest at the wheel
    function seatDriver(g, c, dt, moving) {
      const a = g.actor, gy = carGround(c.x, c.z);
      if (gy !== null) c.y += (gy - c.y) * Math.min(1, dt * 10);
      if (c.clone) carDrop(c, dt);
      const lastH = c.lastH === undefined ? c.h : c.lastH, turn = Math.atan2(Math.sin(c.h - lastH), Math.cos(c.h - lastH)) / Math.max(dt, 1e-3);
      c.lastH = c.h;
      c.steer = (c.steer || 0) + (Math.max(-1, Math.min(1, turn)) - (c.steer || 0)) * Math.min(1, dt * 6);
      const bump = moving ? Math.sin(performance.now() / 1000 * 23) * 0.015 : 0;
      c.g.position.set(c.x + OX, c.y + c.drop + bump, c.z + OZ);
      c.g.rotation.set(0, c.h, (c.dmg % 2 ? 1 : -1) * c.dmg * 0.012);
      a.x = c.x;
      a.z = c.z;
      a.y = c.y;
      a.drop = 0;
      a.moving = false;
      a.idleT = 0;
      placeDriver(a, c, c.steer);
      if (moving && Math.random() < dt * 0.1) sfx("engine", c.x, c.z, { pitch: 1.1 });
    }
    // Live guests send a heartbeat with their current cell: every couple of seconds while moving, every 8 s when still.
    const LIVE_MS = 20000;
    let liveMap = {}, lastBeat = 0, lastBeatCell = "";
    const isLive = (id) => !!(liveMap[id] && Date.now() - liveMap[id].t < LIVE_MS);
    // Live is per time of day: someone playing at night is live for night viewers, while day viewers see their day loop.
    const liveHere = (id) => isLive(id) && liveMap[id].n === (night ? 1 : 0);
    function heartbeat(now) {
      if (!me || !store.shared || me.drop > 0 || document.visibilityState === "hidden") return;
      const x = Math.floor(me.x), z = Math.floor(me.z), cell = x + "," + z;
      if (now - lastBeat < 1500 || (cell === lastBeatCell && now - lastBeat < 8000)) return;
      lastBeat = now;
      lastBeatCell = cell;
      const beat = { t: Date.now(), x, z, n: night ? 1 : 0 };
      if (me.inCar) { beat.c = me.inCar.idx + 1; beat.h = hdg64(me.inCar.h); } // which car they're driving, and which way
      Promise.resolve(store.beat(myId, beat)).catch(() => {});
    }
    let polling = false;
    async function pollLive() {
      if (polling || !store.shared) return;
      polling = true;
      try {
        store.djGet().then(djFromServer).catch(() => { /* keep what we have */ });
        const data = await store.live();
        const clean = {};
        Object.keys(data).forEach((id) => {
          const l = data[id];
          if (!ID_RE.test(id) || !l || typeof l !== "object") return;
          const t = +l.t, x = Math.floor(+l.x), z = Math.floor(+l.z);
          const c = l.c | 0;
          if (Number.isFinite(t) && inMap(x, z)) clean[id] = { t, x, z, n: l.n === 1 ? 1 : 0, c: c >= 1 && c <= carList.length ? c : 0, h: (((l.h | 0) % 64) + 64) % 64 };
        });
        liveMap = clean;
        if (Object.keys(clean).some((id) => id !== myId && liveHere(id) && !ghosts.has(id))) syncGuests();
      } catch (e) { /* keep the last known positions */ }
      polling = false;
      updateGuestCount();
    }
    const guestsBtn = document.getElementById("guests"), guestList = document.getElementById("guest-list");
    function guestRows() {
      const rows = [];
      if (me) rows.push({ name: myName, live: true, actor: me, me: true });
      ghosts.forEach((g, id) => rows.push({ name: g.actor.name, live: liveHere(id), actor: g.actor }));
      return rows.sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0) || (b.live ? 1 : 0) - (a.live ? 1 : 0) || a.name.localeCompare(b.name));
    }
    function updateGuestCount() {
      const rows = guestRows(), live = rows.filter((r) => r.live).length;
      guestsBtn.hidden = rows.length === 0;
      guestsBtn.textContent = (rows.length === 1 ? "1 guest" : rows.length + " guests") + (store.shared && live ? " · " + live + " live" : "");
      if (!guestList.hidden) renderGuestList(rows);
    }
    function renderGuestList(rows) {
      guestList.textContent = "";
      rows.forEach((r) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "guest";
        const name = document.createElement("span");
        name.textContent = r.me ? r.name + " (you)" : r.name;
        const badge = document.createElement("span");
        badge.className = r.live ? "badge live" : "badge";
        badge.textContent = r.live ? "Live" : "Replay";
        b.append(name, badge);
        b.addEventListener("click", () => {
          follow = !!r.me;
          goal.fit = Math.min(goal.fit, 20);
          goal.target.set(r.actor.x + OX, r.actor.y + 0.9, r.actor.z + OZ);
          clampTarget(goal.target);
          guestList.hidden = true;
          guestsBtn.setAttribute("aria-expanded", "false");
        });
        guestList.appendChild(b);
      });
    }
    guestsBtn.addEventListener("click", () => {
      guestList.hidden = !guestList.hidden;
      guestsBtn.setAttribute("aria-expanded", String(!guestList.hidden));
      if (!guestList.hidden) renderGuestList(guestRows());
    });
    let syncing = false;
    async function syncGuests() {
      if (syncing || !store.shared) return;
      syncing = true;
      try {
        const idx = await store.index();
        const at = (id) => +idx[id] || 0;
        const ids = Object.keys(idx).filter((id) => ID_RE.test(id) && id !== myId).sort((a, b) => at(b) - at(a)).slice(0, MAX_GHOSTS);
        const keep = new Set(ids);
        ghosts.forEach((g, id) => { if (!keep.has(id) && !g.npc) dropGhost(id, g); });
        const stale = ids.filter((id) => !ghosts.has(id) || ghosts.get(id).at !== at(id));
        for (let i = 0; i < stale.length; i += 6) {
          await Promise.all(stale.slice(i, i + 6).map(async (id) => {
            try {
              const clean = sanitize(await store.get(id));
              if (clean) upsertGhost(id, clean, at(id));
            } catch (e) { /* try again next round */ }
          }));
        }
      } catch (e) { /* offline: keep who we have */ }
      syncing = false;
      updateGuestCount();
    }

    // ---------- test crowd ----------
    // Opening the site with ?npc adds 20 made-up guests on this phone only: nothing is saved or shared, so there is
    // nothing to clean up. Their loops are choreographed in 45 s rounds (four by day, two by night) so the group
    // scenes actually happen: kisses, brawls, doubles, karaoke, bedroom scenes, pool games and so on.
    const NPCS = [
      ["Astrid", "f", 1], ["Björn", "m", 1], ["Linnea", "f", 1], ["Oskar", "m", 0], ["Freja", "f", 0],
      ["Nils", "m", 1], ["Saga", "f", 1], ["Erik", "m", 1], ["Maja", "f", 0], ["Viktor", "m", 1],
      ["Elsa", "f", 1], ["Gustav", "m", 0], ["Ebba", "f", 0], ["Hugo", "m", 1], ["Alva", "f", 1],
      ["Lukas", "m", 0], ["Tilda", "f", 0], ["Anton", "m", 1], ["Wilma", "f", 1], ["Axel", "m", 0]
    ];
    const ROUND = 45;
    // each round: [cell x, cell z, ...names standing there]
    const DAY_ROUNDS = [
      [[16, 12, "Astrid", "Linnea"], [8, 47, "Oskar", "Gustav"], [9, 47, "Lukas"], [9, 48, "Tilda"], [55, 45, "Freja"], [58, 45, "Axel"], [56, 50, "Maja"],
        [45, 28, "Saga", "Erik"], [47, 30, "Elsa", "Björn"], [38, 30, "Viktor"], [39, 30, "Hugo"], [16, 7, "Nils", "Alva"], [15, 8, "Anton"], [60, 20, "Wilma"], [61, 21, "Ebba"]],
      [[27, 27, "Astrid", "Oskar"], [29, 27, "Freja", "Björn"], [22, 29, "Linnea"], [23, 29, "Gustav"], [24, 28, "Maja"], [37, 33, "Saga"], [36, 34, "Lukas", "Tilda"],
        [27, 33, "Erik"], [31, 33, "Axel"], [35, 21, "Viktor"], [56, 29, "Elsa"], [16, 12, "Hugo", "Anton"], [28, 8, "Nils"], [30, 8, "Wilma"], [39, 48, "Alva"], [41, 48, "Ebba"]],
      [[24, 40, "Astrid"], [25, 39, "Linnea"], [26, 40, "Saga"], [52, 44, "Oskar"], [62, 44, "Gustav"], [52, 47, "Axel"], [62, 47, "Lukas"], [55, 51, "Freja", "Maja"],
        [6, 12, "Tilda"], [7, 12, "Ebba"], [7, 17, "Björn"], [8, 17, "Erik"], [22, 34, "Viktor"], [23, 34, "Elsa", "Alva"], [70, 30, "Hugo"], [38, 30, "Nils"], [39, 30, "Anton", "Wilma"]],
      [[13, 12, "Saga"], [14, 11, "Erik"], [7, 8, "Maja"], [9, 9, "Lukas"], [27, 45, "Björn"], [1, 28, "Linnea"], [64, 29, "Freja"], [67, 29, "Oskar"],
        [38, 30, "Viktor"], [39, 30, "Hugo"], [27, 33, "Gustav"], [31, 33, "Axel"], [6, 46, "Astrid"], [7, 46, "Nils"], [45, 28, "Tilda"], [46, 29, "Ebba"],
        [47, 30, "Wilma"], [48, 31, "Anton"], [37, 33, "Alva"], [60, 20, "Elsa"]]
    ];
    const NIGHT_ROUNDS = [
      [[45, 28, "Astrid", "Björn"], [47, 30, "Saga", "Erik"], [48, 31, "Elsa", "Viktor"], [60, 20, "Linnea", "Nils"], [61, 21, "Alva"], [40, 8, "Hugo", "Wilma"], [39, 8, "Anton"],
        [38, 30, "Oskar", "Gustav"], [39, 30, "Lukas", "Axel"], [37, 33, "Freja"], [36, 34, "Maja", "Tilda"], [40, 34, "Ebba"]],
      [[57, 9, "Astrid", "Björn"], [16, 12, "Saga", "Elsa"], [8, 47, "Erik", "Viktor"], [9, 47, "Nils"], [55, 29, "Linnea"], [35, 21, "Alva"], [27, 27, "Oskar", "Gustav"],
        [29, 27, "Lukas", "Axel"], [22, 29, "Freja"], [45, 28, "Maja", "Tilda"], [47, 30, "Ebba", "Wilma"], [46, 31, "Anton"], [70, 30, "Hugo"]]
    ];
    function npcTrack(rounds, name) {
      const stops = rounds.map((round) => {
        const spot = round.find((e) => e.indexOf(name, 2) >= 2) || [30, 50];
        const c = inMap(spot[0], spot[1]) && reach[cellIdx(spot[0], spot[1])] ? [spot[0], spot[1]] : nearestReachable(spot[0], spot[1]) || SPAWN[0];
        return c;
      });
      const nodes = [[0, stops[0][0], stops[0][1]]];
      let pos = stops[0];
      for (let k = 1; k < stops.length; k++) {
        let t = k * ROUND;
        nodes.push([Math.round(t * 10), pos[0], pos[1]]);
        const path = findPath(pos[0], pos[1], stops[k][0], stops[k][1]) || [pos, stops[k]];
        for (let i = 1; i < path.length; i++) {
          t += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]) / SPEED;
          nodes.push([Math.round(t * 10), path[i][0], path[i][1]]);
        }
        pos = stops[k];
      }
      nodes.push([Math.round(stops.length * ROUND * 10), pos[0], pos[1]]);
      return nodes.map((n) => n.join(",")).join(";");
    }
    function addTestCrowd() {
      NPCS.forEach(([name, body, cheeky], i) => {
        const id = "npc" + String(i).padStart(4, "0");
        const record = { name, body, outfit: (i * 7) % FefeAvatar.OUTFITS.length, skin: ["#E8C4A0", "#D9A57E", "#B97A56", "#8D5A3B"][i % 4], hair: ["#E3C16F", "#4A3020", "#2B1B12", "#B5651D", "#1A1A1A"][i % 5], face: "", cheeky, track: npcTrack(DAY_ROUNDS, name), trackN: npcTrack(NIGHT_ROUNDS, name), at: 1 };
        const clean = sanitize(record);
        if (!clean) return;
        upsertGhost(id, clean, 1);
        const g = ghosts.get(id);
        g.npc = true;
        setGhostTrack(g, false);
      });
      updateGuestCount();
      document.getElementById("test-faces").hidden = false;
      hint.textContent = "Test crowd: 20 made-up guests, on this phone only. Tap Test faces to give them photos.";
      hint.classList.remove("gone");
      clearTimeout(hintTimer);
      hintTimer = setTimeout(dismissHint, 6000);
    }

    // Test faces: photos picked from this phone go onto the made-up guests (the same face processing a real guest
    // gets), round-robin. Nothing is uploaded: the test crowd only lives on this phone.
    document.getElementById("test-face-files").addEventListener("change", async (e) => {
      const files = [...(e.target.files || [])].slice(0, 20);
      e.target.value = "";
      if (!files.length) return;
      hint.textContent = "Making faces from " + files.length + " photo" + (files.length > 1 ? "s" : "") + "…";
      hint.classList.remove("gone");
      const looks = [];
      for (const f of files) {
        const img = await new Promise((resolve) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => resolve(null);
          im.src = URL.createObjectURL(f);
        });
        if (!img) continue;
        const res = await analyse(img);
        URL.revokeObjectURL(img.src);
        if (res.face) looks.push(res);
      }
      if (!looks.length) { hint.textContent = "Couldn't read those photos"; return; }
      NPCS.forEach(([name, body, cheeky], i) => {
        const id = "npc" + String(i).padStart(4, "0"), g = ghosts.get(id), look = looks[i % looks.length];
        if (!g) return;
        const record = { name, body: look.body || body, outfit: (i * 7) % FefeAvatar.OUTFITS.length, skin: look.skin, hair: look.hair,
          face: typeof look.face === "string" ? look.face : toB64(look.face), cheeky, track: npcTrack(DAY_ROUNDS, name), trackN: npcTrack(NIGHT_ROUNDS, name), at: 1 };
        const clean = sanitize(record);
        if (!clean) return;
        upsertGhost(id, clean, 1);
        const g2 = ghosts.get(id);
        g2.npc = true;
        setGhostTrack(g2, false);
      });
      hint.textContent = looks.length + " face" + (looks.length > 1 ? "s" : "") + " on the test crowd";
      clearTimeout(hintTimer);
      hintTimer = setTimeout(dismissHint, 5000);
    });

    const tagV = new T.Vector3();
    function placeTag(a, w, h) {
      const r = a.av.root.position; // where the body is drawn, which an action may have nudged off its cell
      tagV.set(r.x, r.y + a.av.height + 0.5, r.z).project(cam);
      const x = ((tagV.x + 1) / 2) * w, y = ((1 - tagV.y) / 2) * h;
      const show = !a.hiddenAct && view.fit < 70 && x > -60 && x < w + 60 && y > -20 && y < h + 30;
      if (a.tag.hidden === show) a.tag.hidden = !show;
      if (show) a.tag.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%, -100%)";
    }
    // ---------- what people get up to once they stop somewhere (actions.js) ----------
    // The party clock counts from a fixed date, so every phone plays the same routine at the same moment.
    const PARTY_EPOCH = Date.UTC(2026, 0, 1);
    const deepCells = [];
    for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) if (heightAt(x, z) < -1 && reach[cellIdx(x, z)]) deepCells.push([x, z]);
    let danceCrowd = 0;
    // ---------- sound (sound.js): synthesised effects, a disco loop and Swedish voice lines ----------
    // Off until the speaker button is tapped (phones only allow sound after a tap); the choice is remembered.
    const snd = window.FefeSound ? FefeSound.create() : null;
    const soundBtn = document.getElementById("sound");
    const sfx = (name, x, z, o) => { if (snd && snd.enabled) snd.play(name, x, z, o); };
    function setSound(on) {
      if (!snd) return;
      if (!on) stopJukebox(); // the speaker button is for sound and music alike
      if (on) snd.enable(); else snd.disable();
      if (on) snd.setNight(night);
      soundBtn.setAttribute("aria-pressed", String(!!snd.enabled));
      lsSet("fefe40.sound", snd.enabled ? "1" : "0");
    }
    soundBtn.hidden = !snd;
    soundBtn.addEventListener("click", () => setSound(!(snd && snd.enabled)));
    // on by default (phones only allow sound after a tap, so it starts at the first tap anywhere), unless they've
    // turned it off with the speaker button before
    if (snd && lsGet("fefe40.sound") !== "0") {
      const wake = () => {
        ["touchend", "click"].forEach((ev) => window.removeEventListener(ev, wake, true));
        if (!snd.enabled) setSound(true);
      };
      ["touchend", "click"].forEach((ev) => window.addEventListener(ev, wake, true));
    }
    const CANDY_RING = [[7, 8], [8, 8], [9, 9], [9, 10], [7, 11], [8, 11]];
    const TREES = trees.map(([x, z, t]) => ({ x: x + 0.5, z: z + 0.5, palm: t.palm, h: t.h, top: t.top, tx: t.tx, tz: t.tz }));
    // a tapped leaf high up, or any tapped bit of trunk, means that tree
    function treeAtHit(hit) {
      const hx = hit.u / 2 + 0.25, hy = hit.v / 2, hz = hit.w / 2 + 0.25, leaf = (vMeta[vi(hit.u, hit.v, hit.w)] & 128) !== 0;
      let best = null, bd = Infinity;
      TREES.forEach((t) => {
        const k = Math.max(0, Math.min(1, (hy - 1) / Math.max(1, t.h - 1))) ** 2;
        const d = Math.hypot(t.x + (t.tx - t.x) * k - hx, t.z + (t.tz - t.z) * k - hz);
        if (((leaf && hy > 2.2 && d < 3.6) || (hy >= 1 && d < 0.9)) && d < bd) { bd = d; best = t; }
      });
      return best;
    }
    const party = window.FefeActions
      ? FefeActions.create({
          T, scene, OX, OZ, heightAt, trees: TREES, candy: CANDY_RING,
          isNight: () => night,
          isMusic: () => dj.on,
          // the middle of the nearest deep-water cell and its floor height, for pushing someone in
          nearestWater(x, z) {
            let best = null, bd = 36;
            deepCells.forEach(([cx, cz]) => {
              const d = (cx + 0.5 - x) ** 2 + (cz + 0.5 - z) ** 2;
              if (d < bd && d > 1) { bd = d; best = [cx + 0.5, cz + 0.5, worldY(cx, cz)]; }
            });
            return best;
          },
          onDance(n) { danceCrowd = n; },
          sound(name, x, z, a) { if (!(a && voiceSay(a, EFFECT_VOICE[name], x, z, 0.5))) sfx(name, x, z); },
          say(key, x, z, a) { if (!(a && voiceSay(a, LINE_VOICE[key], x, z, 0.6)) && snd && snd.enabled) snd.say(key, x, z); },
          voice(a, act, x, z) { return voiceAct(a, act, x, z); },
          onScenes(rooms) { loveRooms = rooms; },
          nearestCar: nearestParkedCar,
          onSteamy(cars) { steamyCars = cars.slice(); }
        })
      : null;
    const actorList = [];

    // ---------- voices: guests' own recorded lines (voice.js) ----------
    // My clips live on this phone and go up to the shared database one by one; other guests' clips are fetched the
    // first time their avatar wants to say one. The made-up test crowd borrows my clips, pitched up or down.
    const VOICE = window.FefeVoice && window.FefeVoice.lines.length ? window.FefeVoice : null;
    const CLIP_ID = /^[a-z][a-z0-9]{0,3}$/;
    let myVoice = {}, myVoiceUp = new Set();
    try {
      const saved = JSON.parse(lsGet("fefe40.voice") || "{}") || {};
      Object.keys(saved).forEach((id) => { if (VOICE && VOICE.byId.has(id) && typeof saved[id] === "string" && saved[id].length < 60000) myVoice[id] = saved[id]; });
      (lsGet("fefe40.voiceUp") || "").split(",").forEach((id) => { if (myVoice[id]) myVoiceUp.add(id); });
    } catch (e) { myVoice = {}; }
    function keepMyVoice() {
      lsSet("fefe40.voice", JSON.stringify(myVoice));
      lsSet("fefe40.voiceUp", [...myVoiceUp].join(","));
    }
    // up they go, a few at a time; my record only lists the ones that made it, so nobody asks for a missing clip
    let voiceUploading = false, voiceRetry = 0;
    async function uploadVoice() {
      if (voiceUploading || !store.shared) return;
      voiceUploading = true;
      clearTimeout(voiceRetry);
      const todo = Object.keys(myVoice).filter((id) => !myVoiceUp.has(id));
      let sent = 0, failed = false;
      for (let i = 0; i < todo.length && !failed; i += 3) {
        await Promise.all(todo.slice(i, i + 3).map(async (id) => {
          try {
            const r = await store.voicePut(myId, id, myVoice[id]);
            if (r && r.ok === false) throw new Error("voice " + r.status);
            myVoiceUp.add(id);
            sent++;
          } catch (e) { failed = true; }
        }));
      }
      keepMyVoice();
      voiceUploading = false;
      if (sent && me) scheduleSave(300);
      if (failed) voiceRetry = setTimeout(uploadVoice, 60000); // offline, or the database doesn't take voices yet
    }
    // AudioBuffers by "guest/line": null while loading or if it can't be had
    const clipBufs = new Map();
    function clipBuffer(owner, id) {
      const k = owner + "/" + id, have = clipBufs.get(k);
      if (have !== undefined) return have === "wait" ? null : have;
      const ac = snd && snd.context();
      if (!ac || !VOICE) return null;
      clipBufs.set(k, "wait");
      Promise.resolve(owner === myId ? myVoice[id] : store.voiceGet(owner, id))
        .then((str) => clipBufs.set(k, VOICE.toBuffer(ac, str) || null))
        .catch(() => clipBufs.set(k, null));
      return null;
    }
    // whose clips an actor says, which lines they have, and how fast to play them
    function voiceOf(a) {
      if (!VOICE) return null;
      if (a === me) return { owner: myId, ids: Object.keys(myVoice), rate: 1 };
      const g = ghosts.get(a.key);
      if (!g) return null;
      if (g.npc) { const ids = Object.keys(myVoice); return ids.length ? { owner: myId, ids, rate: 0.78 + (parseInt(a.key.slice(3), 10) % 10) * 0.055 } : null; }
      return g.voice && g.voice.length ? { owner: a.key, ids: g.voice, rate: 1 } : null;
    }
    const linesIn = (v, cats) => v.ids.filter((id) => { const l = VOICE.byId.get(id); return l && cats.indexOf(l.cat) >= 0; });
    let heardMine = false;
    // one of their own lines from these categories, if they recorded any (and one is loaded); false otherwise, so
    // the phone's voice can say something instead
    function voiceSay(a, cats, x, z, chance) {
      if (!cats || !VOICE || !snd || !snd.enabled || Math.random() > chance) return false;
      const v = voiceOf(a);
      if (!v) return false;
      const ids = linesIn(v, typeof cats === "string" ? [cats] : cats);
      for (let n = ids.length; n > 0; n--) {
        const id = ids.splice((Math.random() * n) | 0, 1)[0], buf = clipBuffer(v.owner, id);
        if (!buf) continue;
        if (!snd.playClip(buf, x, z, { rate: v.rate })) return false;
        if (party) party.fx.icon(VOICE.byId.get(id).kind === "sing" ? "note" : "bubble", x, a.y + 2.7, z, { size: 0.3, vy: 0.8 });
        if (a === me && !heardMine) { // the first time: point out whose voice that was
          heardMine = true;
          hint.textContent = "That was your voice! Record more lines with the microphone button.";
          hint.classList.remove("gone");
          clearTimeout(hintTimer);
          hintTimer = setTimeout(dismissHint, 5000);
        }
        return true;
      }
      return false;
    }
    // what people say in their own voice while they're at it
    const ACT_VOICE = {
      disco: ["dance"], discomirror: ["dance"], line: ["dance"], wild: ["dance", "react"], pole: ["dance", "cheeky"], airguitar: ["dance"], robot: ["dance"], clap: ["dance"],
      slowdance: ["kiss"], kiss: ["kiss"], makeup: ["kiss"], scene: ["cheeky", "kiss", "laugh"], steamy: ["cheeky", "kiss"],
      conga: ["laugh", "dance"], surf: ["react", "laugh"], carry: ["react"], shove: ["react"], brawl: ["react", "drunk"],
      paddle: ["swim"], swim: ["swim"], float: ["swim", "hot"], bomb: ["swim", "react"], splash: ["swim", "laugh"], ball: ["swim", "sport"],
      chat: ["birthday", "greet", "laugh", "yum"], selfie: ["birthday", "laugh"], huddle: ["birthday", "cheers", "laugh"], cards: ["laugh", "react"],
      sip: ["cheers"], horn: ["cheers", "drunk"], skal: ["cheers"], chug: ["cheers", "drunk"], helan: ["cheers", "sing"], toast: ["cheers", "birthday"], raiseglass: ["cheers", "birthday"],
      cook: ["yum", "eat"], snack: ["eat", "yum"], taste: ["yum", "eat"], nibble: ["eat"], eat: ["eat", "yum"], fika: ["yum", "eat"], candy: ["candy", "eat"],
      blow: ["birthday"], bdaysing: ["birthday", "sing"], cheer: ["sport", "react"], cheersit: ["sport", "cheers"], tabledance: ["dance", "drunk"], pong: ["sport"], cue: ["sport"],
      paper: ["fart"], toilet: ["fart", "react"], puke: ["drunk"], toiletpuke: ["drunk"], hangover: ["drunk"],
      jumpbed: ["laugh", "react"], pillow: ["laugh"], sleepover: ["laugh"], tv: ["laugh"], movie: ["laugh", "react"], gaming: ["react"],
      serve: ["sport"], hoops: ["sport"], rally: ["sport"], watch: ["sport", "react"], swing: ["laugh"], seesaw: ["laugh"], run: ["laugh"],
      photo: ["birthday", "greet"], peace: ["birthday", "laugh"], wave: ["greet", "birthday"], climb: ["react"], shower: ["hot", "sing"], smoke: ["react"], snus: ["react"]
    };
    // the phone voice's lines and the game's sounds, as categories of recorded lines
    const LINE_VOICE = {
      skal: ["cheers"], grattis: ["birthday"], helan: ["cheers", "sing"], leva: ["birthday"], hej: ["greet"], valkommen: ["greet"], tack: ["greet"],
      oj: ["react"], nej: ["react"], kul: ["react", "laugh"], aj: ["react"], jaa: ["react"], lek: ["laugh"], heja: ["sport"], hockey: ["sport"],
      fika: ["yum"], jattebra: ["yum"], kott: ["yum", "eat"], puss: ["kiss"], alskar: ["kiss"], godis: ["candy"], haha: ["laugh"], hihi: ["laugh"],
      hick: ["drunk"], blah: ["drunk"], rap: ["eat"], prutt: ["fart"], plopp: ["fart"], plask: ["swim"], tut: ["drive"], brum: ["drive"], krasch: ["drive"],
      dansa: ["dance"], sjung: ["sing"], aah: ["hot"], chatter: ["birthday", "greet", "yum", "laugh"]
    };
    const EFFECT_VOICE = {
      laugh: ["laugh"], giggle: ["laugh"], cheer: ["react"], hiccup: ["drunk"], burp: ["eat"], babble: ["drunk"], vomit: ["drunk"], fart: ["fart"],
      splash: ["swim"], cannonball: ["swim"], kiss: ["kiss"], chug: ["cheers"], clink: ["cheers"], horn: ["drive"], crash: ["drive"], bonk: ["react"],
      wave: ["greet"], sparkle: ["candy"], shower: ["hot", "sing"], pillow: ["laugh"]
    };
    function voiceAct(a, act, x, z) {
      // karaoke singers with sung lines sing with the choir on the beat instead (see updateChoir)
      if ((act === "sing" || act === "sway") && VOICE) { const v = voiceOf(a); return !!(v && linesIn(v, ["sing"]).length); }
      return voiceSay(a, ACT_VOICE[act], x, z, 0.55);
    }
    // The karaoke choir: everyone at the lounge who recorded sung lines sings together every couple of bars, the same
    // line if they share one, over the original backing loop (unless the TV's music is on).
    const LOUNGE = [38.5, 33.5];
    const choir = { on: false, next: 0 };
    function updateChoir() {
      if (!party || !snd || !VOICE) return;
      const voiced = [];
      if (snd.enabled) actorList.forEach((a) => {
        const act = party.actOf(a);
        if (act !== "sing" && act !== "sway") return;
        const v = voiceOf(a), sung = v ? linesIn(v, ["sing"]) : [];
        if (sung.length) voiced.push({ a, v, sung });
      });
      const near = Math.hypot(view.target.x - OX - LOUNGE[0], view.target.z - OZ - LOUNGE[1]) < 24;
      const music = voiced.length > 0 && near && !(jb && jb.playing) && !dj.on; // the DJ's music wins
      if (music !== choir.on) { choir.on = music; if (!dj.on) snd.setMusic(music, LOUNGE[0], LOUNGE[1]); choir.next = 0; }
      if (!voiced.length || !near) return;
      const t = snd.now();
      if (t < choir.next) return;
      const at = music ? snd.nextBar() : t + 0.05;
      choir.next = at + (music ? 4.2 : 5);
      const count = new Map();
      voiced.forEach((s) => s.sung.forEach((id) => count.set(id, (count.get(id) || 0) + 1)));
      const top = [...count.entries()].sort((p, q) => q[1] - p[1] || (Math.random() < 0.5 ? -1 : 1))[0][0];
      voiced.forEach(({ a, v, sung }) => {
        const id = sung.indexOf(top) >= 0 ? top : sung[(Math.random() * sung.length) | 0], buf = clipBuffer(v.owner, id);
        if (buf && snd.playClip(buf, a.x, a.z, { rate: v.rate, choir: true, at, vol: 1.2 })) party.fx.icon("note", a.x, a.y + 2.8, a.z, { size: 0.35, vy: 1 });
      });
    }

    // ---------- cars: tap one to get in, drive it about, crash it ----------
    const carMats = {};
    const carMat = (c, kind) => carMats[c + kind] || (carMats[c + kind] = kind === "glow" ? new T.MeshBasicMaterial({ color: c })
      : new T.MeshLambertMaterial({ color: c, transparent: kind === "clear", opacity: kind === "clear" ? 0.5 : 1 }));
    const carBox = new T.BoxGeometry(1, 1, 1);
    function buildCar(sp, idx) {
      const g = new T.Group(), top = [], glass = [];
      sp.parts.forEach(([x, y, z, w, h, d, color, kind]) => {
        const m = new T.Mesh(carBox, carMat(color, kind));
        m.scale.set(w, h, d);
        m.position.set(x + w / 2, y + h / 2, z + d / 2);
        m.castShadow = kind === "solid";
        g.add(m);
        if (y >= 0.95) top.push(m); // cabin glass and roof: hidden while someone drives, so it's a convertible
        if (kind === "clear") glass.push(m);
      });
      scene.add(g);
      return { g, top, glass, idx, x: sp.x, z: sp.z, h: 0, y: 1, speed: 0, vx: 0, vz: 0, w: sp.w, l: sp.l, color: sp.color, dmg: 0, drop: 0, smokeAt: 0 };
    }
    carList = CAR_SPECS.map((sp, i) => { const c = buildCar(sp, i); c.g.visible = false; return c; });
    // steamy car: fogged windows and a rocking body while Cheeky guests are inside (see actions.js)
    const fogGlass = new T.MeshLambertMaterial({ color: 0xf2f5f8, transparent: true, opacity: 0.92 });
    let steamyCars = [];
    function nearestParkedCar(x, z) {
      let best = null, bd = 7;
      carList.forEach((c) => {
        if (c === drive.car || c.rider || c.drop > 0 || !c.g.visible || Math.abs(c.speed) > 0.2) return;
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < bd) { bd = d; best = c; }
      });
      return best;
    }
    function showCars() { carList.forEach((c) => { c.g.visible = true; c.drop = 10 + Math.random() * 3; }); }
    const drive = { car: null, gas: 0, steer: 0, keys: {}, shake: 0 };
    let pendingCar = null;
    const carGround = (x, z) => { const st = heightAt(Math.floor(x), Math.floor(z)); return st === NONE ? null : (st + 1) / 2; };
    // what the car would hit with its outline at (x, z, h): walls, furniture, trees, steps, other cars or people
    function carHit(c, x, z, h) {
      const cs = Math.cos(h), sn = Math.sin(h), hw = c.w / 2 - 0.05, hl = c.l / 2 - 0.05;
      const pts = [[-hw, hl], [0, hl], [hw, hl], [-hw, -hl], [0, -hl], [hw, -hl], [-hw, 0], [hw, 0], [-hw, hl / 2], [hw, hl / 2], [-hw, -hl / 2], [hw, -hl / 2]];
      for (let i = 0; i < pts.length; i++) {
        const [lx, lz] = pts[i], px = x + lx * cs + lz * sn, pz = z - lx * sn + lz * cs;
        const cx = Math.floor(px), cz = Math.floor(pz);
        if (!inMap(cx, cz)) return { what: "wall", px, pz };
        const gy = carGround(px, pz);
        if (gy === null || Math.abs(gy - c.y) > 0.55) {
          const tree = TREES.find((t) => Math.hypot(t.x - px, t.z - pz) < 1.3);
          return { what: tree ? "tree" : "wall", px, pz, tree };
        }
        for (let j = 0; j < carList.length; j++) {
          const o = carList[j];
          if (o === c || o.drop > 0) continue;
          const dx = px - o.x, dz = pz - o.z, oc = Math.cos(o.h), os = Math.sin(o.h);
          if (Math.abs(dx * oc - dz * os) < o.w / 2 && Math.abs(dx * os + dz * oc) < o.l / 2) return { what: "car", px, pz, other: o };
        }
        for (let j = 0; j < actorList.length; j++) {
          const a = actorList[j];
          if (a === me || a.inCar || a.drop > 0 || a.hiddenAct) continue;
          if (Math.hypot(a.x - px, a.z - pz) < 0.45) return { what: "person", px, pz };
        }
      }
      return null;
    }
    function crash(c, hit, speed) {
      const fx = party && party.fx, hard = Math.abs(speed), y = c.y + 0.9;
      c.speed = -speed * 0.3;
      if (!(c === drive.car && me && hard > 2.5 && voiceSay(me, ["drive", "react"], hit.px, hit.pz, 0.8))) sfx(hit.what === "person" ? "horn" : hard < 2.5 ? "bonk" : "crash", hit.px, hit.pz, { vol: Math.min(1, 0.4 + hard / 10) });
      if (!fx) return;
      if (hit.what === "person") { fx.icon("bang", hit.px, y + 1.6, hit.pz, { size: 0.45 }); c.speed = 0; return; }
      if (hard < 2.5) { fx.icon("bang", hit.px, y + 1, hit.pz, { size: 0.3 }); return; }
      c.dmg = Math.min(8, c.dmg + (hard > 7 ? 2 : 1));
      drive.shake = Math.min(0.7, hard * 0.07);
      for (let i = 0; i < 8 + hard * 2; i++) {
        fx.block(i % 3 ? c.color : "#9AA0A8", hit.px, y, hit.pz, { vx: (Math.random() - 0.5) * 5, vz: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 3, g: 9, size: 0.1 + Math.random() * 0.15, life: 1, max: 1 });
      }
      fx.icon("bang", hit.px, y + 1.4, hit.pz, { size: 0.7 });
      for (let i = 0; i < 3; i++) fx.icon("star", hit.px + (Math.random() - 0.5), y + 1.2, hit.pz + (Math.random() - 0.5), { size: 0.4, vx: (Math.random() - 0.5) * 2, vy: 2 });
      for (let i = 0; i < 4; i++) fx.icon("puff", hit.px + (Math.random() - 0.5), y + 0.5, hit.pz + (Math.random() - 0.5), { size: 0.7, vy: 0.8, life: 1.5, max: 1.5 });
      if (hit.what === "tree" && hit.tree) { // shake the leaves (and a coconut) loose
        const t = hit.tree;
        for (let i = 0; i < 26; i++) fx.block(i % 4 ? "#3F9A3A" : "#6CC24A", t.tx + (Math.random() - 0.5) * 3, t.top - Math.random(), t.tz + (Math.random() - 0.5) * 3, { vy: 0, g: 3, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5), size: 0.16, life: 2.2, max: 2.2 });
        if (t.palm) fx.arc("#6B4A2A", [t.tx, t.top - 0.5, t.tz], [hit.px, c.y + 1.8, hit.pz], 0.6, 0.3, 0.35);
      }
      if (hit.what === "car" && hit.other) { // shunt the other car
        const o = hit.other;
        o.vx += Math.sin(c.h) * speed * 0.6;
        o.vz += Math.cos(c.h) * speed * 0.6;
        o.dmg = Math.min(8, o.dmg + 1);
      }
    }
    function carDrop(c, dt) {
      if (!(c.drop > 0)) return;
      c.dropV = (c.dropV || 0) + 30 * dt;
      c.drop = Math.max(0, c.drop - c.dropV * dt);
      if (c.drop === 0) { c.dropV = 0; poof(c.x, c.y, c.z); }
    }
    function updateCars(dt, t) {
      carList.forEach((c) => {
        if (!c.g.visible) return;
        carDrop(c, dt);
        if (c.rider) return; // a guest's replay is driving it (see rideCar)
        const driving = c === drive.car;
        let acc = 0;
        if (driving) {
          if (drive.gas > 0) acc = c.speed < -0.2 ? 16 : 7;
          else if (drive.gas < 0) acc = c.speed > 0.2 ? -16 : -5;
        }
        c.speed += acc * dt;
        if (driving && acc > 0 && t > (c.revAt || 0)) { c.revAt = t + 5; sfx("engine", c.x, c.z, { pitch: 0.8 + Math.abs(c.speed) / 10 }); }
        if (driving && drive.steer && Math.abs(c.speed) > 6 && t > (c.skidAt || 0)) { c.skidAt = t + 0.7; sfx("skid", c.x, c.z); }
        const friction = driving && drive.gas ? 0.5 : 4;
        c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), friction * dt);
        c.speed = Math.max(-5, Math.min(11, c.speed));
        const k = Math.exp(-dt * 3);
        c.vx *= k;
        c.vz *= k;
        const turn = driving ? drive.steer * dt * 2.1 * Math.max(-1, Math.min(1, c.speed / 3.5)) : 0;
        if (Math.abs(c.speed) > 0.01 || Math.abs(c.vx) + Math.abs(c.vz) > 0.02) {
          const nh = c.h + turn, nx = c.x + Math.sin(nh) * c.speed * dt + c.vx * dt, nz = c.z + Math.cos(nh) * c.speed * dt + c.vz * dt;
          const hit = carHit(c, nx, nz, nh);
          if (hit) { crash(c, hit, c.speed); c.vx = c.vz = 0; }
          else { c.x = nx; c.z = nz; c.h = nh; }
        }
        const gy = carGround(c.x, c.z);
        if (gy !== null) c.y += (gy - c.y) * Math.min(1, dt * 10);
        const bump = driving && Math.abs(c.speed) > 1 ? Math.sin(t * 23) * 0.015 : 0;
        const steamy = !driving && steamyCars.indexOf(c) >= 0, n = steamy ? c.steamyCount || 2 : 0;
        const rock = steamy ? Math.abs(Math.sin(t * (8 + n))) * 0.07 : 0;
        c.g.position.set(c.x + OX, c.y + c.drop + bump + rock, c.z + OZ);
        c.g.rotation.set(-c.speed * 0.004 * (acc ? Math.sign(acc) : 0) + (steamy ? Math.sin(t * (8 + n)) * 0.035 : 0), c.h,
          (c.dmg % 2 ? 1 : -1) * c.dmg * 0.012 + (steamy ? Math.sin(t * (5.5 + n)) * 0.05 : 0));
        if (steamy !== !!c.fogged) { // steam the windows up, or clear them again
          c.fogged = steamy;
          c.glass.forEach((m) => { m.material = steamy ? fogGlass : carMat(C.glassCar, "clear"); });
        }
        if (c.dmg >= 3 && party && t > c.smokeAt) { // a bashed-up car smokes from the bonnet
          c.smokeAt = t + (c.dmg >= 6 ? 0.15 : 0.4);
          party.fx.icon("puff", c.x + Math.sin(c.h) * (c.l / 2 - 0.5), c.y + 1.3, c.z + Math.cos(c.h) * (c.l / 2 - 0.5), { size: 0.5, vy: 0.9, life: 1.6, max: 1.6 });
        }
      });
      drive.shake = Math.max(0, drive.shake - dt * 1.6);
    }
    // the driver sits behind the wheel, hands on it
    function placeDriver(a, c, steer) {
      const av = a.av, cs = Math.cos(c.h), sn = Math.sin(c.h), lx = -0.42, lz = c.l > 5 ? 1.6 : 0.2;
      av.setPose(0, false);
      av.root.position.set(c.x + lx * cs + lz * sn + OX, c.y + c.drop, c.z - lx * sn + lz * cs + OZ);
      av.root.rotation.y = c.h;
      av.rig.position.y = 0.42 - 0.825 * (av.scale || 1);
      av.parts.legR.rotation.set(-Math.PI / 2, 0, 0.05);
      av.parts.legL.rotation.set(-Math.PI / 2, 0, -0.05);
      av.parts.armR.rotation.set(-1.25, 0, 0.25 + steer * 0.15);
      av.parts.armL.rotation.set(-1.25, 0, -0.25 + steer * 0.15);
    }
    function carFromTap(cx, cy) {
      setRay(cx, cy);
      const hits = raycaster.intersectObjects(carList.filter((c) => c.g.visible).map((c) => c.g), true);
      return hits.length ? carList.find((c) => c.g === hits[0].object.parent) : null;
    }
    function goToCar(c) {
      const side = [c.x - Math.cos(c.h) * (c.w / 2 + 0.7), c.z + Math.sin(c.h) * (c.w / 2 + 0.7)];
      const at = nearestReachable(Math.floor(side[0]), Math.floor(side[1]));
      pendingCar = c;
      if (at && walkTo(at[0], at[1])) follow = true;
    }
    const driveEl = document.getElementById("drive");
    function enterCar(c) {
      pendingCar = null;
      myPath = [];
      if (c.rider) leaveCar(c.rider); // take it off a guest's replay: they carry on in a copy
      recNode(Math.floor(me.x), Math.floor(me.z));
      me.inCar = c;
      recHere(); // the replay hops in here
      lastBeat = 0;
      me.blendX = me.blendZ = 0;
      drive.car = c;
      drive.gas = drive.steer = 0;
      c.top.forEach((m) => { m.visible = false; });
      driveEl.hidden = false;
      document.body.classList.add("driving");
      follow = true;
      goal.fit = Math.min(goal.fit, 24);
    }
    function getOut() {
      const c = drive.car;
      if (!c || !me) return;
      recHere(); // where the car was left
      c.top.forEach((m) => { m.visible = true; });
      drive.car = null;
      drive.gas = drive.steer = 0;
      me.inCar = null;
      lastBeat = 0;
      const side = [c.x - Math.cos(c.h) * (c.w / 2 + 0.6), c.z + Math.sin(c.h) * (c.w / 2 + 0.6)];
      const at = nearestReachable(Math.floor(side[0]), Math.floor(side[1])) || nearestReachable(Math.floor(c.x), Math.floor(c.z)) || SPAWN[0];
      me.x = at[0] + 0.5;
      me.z = at[1] + 0.5;
      me.y = worldY(at[0], at[1]);
      me.blendX = me.blendZ = 0;
      poof(me.x, me.y, me.z);
      recNode(at[0], at[1]); // and the replay climbs out here
      scheduleSave(800);
      driveEl.hidden = true;
      document.body.classList.remove("driving");
    }
    // on-screen pedals and wheel for phones; arrows or WASD, and E to get out, on a keyboard
    [["steer-l", "steer", 1], ["steer-r", "steer", -1], ["gas", "gas", 1], ["brake", "gas", -1]].forEach(([id, key, val]) => {
      const b = document.getElementById(id);
      const on = (e) => { e.preventDefault(); drive[key] = val; b.classList.add("down"); };
      const off = () => { if (drive[key] === val) drive[key] = 0; b.classList.remove("down"); };
      b.addEventListener("pointerdown", on);
      ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => b.addEventListener(ev, off));
    });
    document.getElementById("get-out").addEventListener("click", getOut);
    function driveKeys(e, down) {
      if (!drive.car) return false;
      const k = e.key.toLowerCase();
      if (down && (k === "e" || k === "escape")) { getOut(); return true; }
      const map = { arrowup: ["gas", 1], w: ["gas", 1], arrowdown: ["gas", -1], s: ["gas", -1], arrowleft: ["steer", 1], a: ["steer", 1], arrowright: ["steer", -1], d: ["steer", -1] }[k];
      if (!map) return false;
      drive.keys[k] = down;
      const held = (keys, v) => keys.some((q) => drive.keys[q]) ? v : 0;
      drive.gas = held(["arrowup", "w"], 1) || held(["arrowdown", "s"], -1);
      drive.steer = held(["arrowleft", "a"], 1) || held(["arrowright", "d"], -1);
      e.preventDefault();
      return true;
    }
    window.addEventListener("keyup", (e) => driveKeys(e, false));

    // ---------- the sound of a place: tapping a place (joined or not) plays what it sounds like ----------
    // Dance floor and karaoke switch on the music (it plays on the karaoke TV while that's in view); everywhere else a
    // line or two in Swedish. The first tap switches sound on, unless the speaker button was used to turn it off.
    const ZONE_SOUNDS = {
      pool: ["plask", "jaa"], dance: ["dansa"], kitchen: ["bork", "kott"], bedroom: ["oj", "puss"], bathroom: ["prutt", "plopp"],
      bar: ["helan", "skal"], pavilion: ["skal", "grattis"], lounge: ["sjung"], court: ["heja", "hockey"], mainVilla: ["hej", "chatter"],
      lanaiVilla: ["fika", "chatter"], poolVilla: ["plask", "hej"], playground: ["lek", "haha"], restroom: ["prutt", "aah"],
      parking: ["tut", "brum"], gate: ["valkommen", "grattis"]
    };
    let zoneLineTimer = 0;
    function zoneSound(id) {
      if (!snd) return;
      if (!snd.enabled && lsGet("fefe40.sound") !== "0") setSound(true);
      if (!snd.enabled) return;
      if (id === "lounge") startJukebox();
      const keys = ZONE_SOUNDS[id] || [], cx = view.target.x - OX, cz = view.target.z - OZ;
      clearTimeout(zoneLineTimer);
      if (keys[0]) snd.say(keys[0], cx, cz);
      if (keys[1]) zoneLineTimer = setTimeout(() => { if (snd.enabled) snd.say(keys[1], view.target.x - OX, view.target.z - OZ); }, 2500);
    }

    // ---------- ABBA jukebox ----------
    // ABBA's own official videos, embedded from YouTube (nothing loads from YouTube until someone taps Play ABBA),
    // playing on the karaoke TV. The player sits in a layer under the canvas and is moved onto the TV screen every
    // frame; while it plays, the screen is drawn as a see-through hole in the canvas, so people and things in front of
    // the TV still cover it. YouTube only allows playing while the player can be seen, so it plays only while the TV is
    // on screen, facing us, big enough to see, with the pavilion roof off, clear of the close-up slice and not under a
    // panel; otherwise it pauses and the painted karaoke screen comes back. It's louder the closer you are to the TV
    // (iPhones ignore volume changes from web pages, so there it's just on or off).
    const ABBA_VIDEOS = ["xFrGuyw1V8s", "unfzfe8f9NI", "XEjLoHdbVeE", "Sj_9CiNkkn4"]; // Dancing Queen, Mamma Mia, Gimme! Gimme! Gimme!, Waterloo
    // after dark the party turns club: Swedish House Mafia's official videos
    const SHM_VIDEOS = ["1y6smkh6c-0", "BXpdmKELE1k", "PkQ5rEJaTmk", "u9n7Cw-4_HQ"]; // Don't You Worry Child, Save the World, One (Your Name), Moth to a Flame
    const jbList = () => (night ? SHM_VIDEOS : ABBA_VIDEOS);
    // the TV screen with its thin pink rim, in metres (the painted screen is 2.56 x 1.26), and the player's size in pixels
    const TV = { x: 39, y: 3.35, z: 32.365, w: 2.6, h: 1.3, pw: 406, ph: 200 };
    const tvLayer = document.getElementById("tv-layer"), tvVideo = document.getElementById("tv-video");
    const jb = { player: null, ready: false, on: false, playing: false, blocked: false, next: 0, loading: false, night: false, asked: 0, stuck: 0, vol: -1 };
    const tv = { view: false, shown: false, m: "", clip: "" };
    // the hole: transparent black written straight into the canvas (no blending), so the player underneath shows
    const holeMat = new T.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: T.NoBlending, clippingPlanes: [clipPlane] });
    function musicDistance() {
      const px = me ? me.x : view.target.x - OX, pz = me ? me.z : view.target.z - OZ;
      return Math.hypot(px - TV.x, pz - TV.z);
    }
    function loadYouTube(then) {
      if (window.YT && window.YT.Player) { then(); return; }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); then(); };
      if (jb.loading) return;
      jb.loading = true;
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => { jb.loading = false; jb.on = false; }; // offline: the Play button comes back to try again
      document.head.appendChild(tag);
    }
    function startJukebox() {
      jb.on = true;
      if (jb.player) return; // updateTV plays it whenever the TV is in view
      loadYouTube(() => {
        if (jb.player) return;
        jb.night = night;
        jb.player = new YT.Player("jb-player", {
          width: TV.pw,
          height: TV.ph,
          videoId: jbList()[0],
          host: "https://www.youtube-nocookie.com",
          playerVars: { playlist: jbList().join(","), loop: 1, playsinline: 1, rel: 0, modestbranding: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3 },
          events: {
            onReady: () => { jb.ready = true; jb.next = 0; },
            onStateChange: (e) => { jb.playing = e.data === 1; if (jb.playing) jb.blocked = false; },
            onAutoplayBlocked: () => { jb.blocked = true; }, // this phone only starts it from a tap on the video (see updateJukebox)
            onError: () => { if (jb.ready) jb.player.nextVideo(); } // a video that won't play here: skip it
          }
        });
      });
    }
    function stopJukebox() {
      jb.on = false;
      if (jb.ready) jb.player.pauseVideo();
    }
    // The DJ decks on the dance floor: a tap starts the club music (our own house loop, nobody else's song) and gets
    // the dance floor dancing; another tap stops it and everyone goes back to chatting.
    const dj = { on: false, mine: 0 };
    // The decks are shared: whoever taps them switches the music on or off for the whole party (fefe40/dj).
    function setDj(on) {
      if (on === dj.on) return;
      dj.on = on;
      if (snd) snd.setMusic(on, DANCE_CENTER[0], DANCE_CENTER[1], true);
      if (party) party.fx.icon(on ? "note" : "bang", 47, 3, 25.5, { size: 0.5, vy: 1 });
    }
    // Music left on for three hours with nobody touching the decks goes off by itself.
    function djFromServer(d) {
      if (Date.now() - dj.mine < 4000) return;
      const on = !!(d && d.on === true && Number.isFinite(+d.t) && Date.now() - +d.t < 3 * 3600 * 1000);
      setDj(on);
    }
    // The club music carries over the dance floor, the pool and the pickleball court, fading out a few metres beyond.
    const DJ_AREA = [[43, 24, 50, 34], [51, 15, 69, 33], [46, 38, 69, 53]];
    function djArea(x, z) {
      let d = Infinity;
      DJ_AREA.forEach(([x0, z0, x1, z1]) => { d = Math.min(d, Math.hypot(Math.max(x0 - x, 0, x - x1 - 1), Math.max(z0 - z, 0, z - z1 - 1))); });
      return Math.max(0, 1 - d / 6);
    }
    // the booth with its speakers, as a box to hit (it's made of props, which voxel picking doesn't see)
    const deckBox = new T.Box3(new T.Vector3(44 + OX, 1, 24.9 + OZ), new T.Vector3(50 + OX, 2.6, 26.1 + OZ)), deckHit = new T.Vector3();
    function tapDecks(cx, cy) {
      setRay(cx, cy);
      if (!raycaster.ray.intersectBox(deckBox, deckHit)) return false;
      if (snd && !snd.enabled) setSound(true);
      setDj(!dj.on);
      dj.mine = Date.now(); // our tap wins over a poll that was already on its way
      Promise.resolve(store.djSet(dj.on)).catch(() => {});
      hint.textContent = dj.on ? "The DJ's on! Everyone on the dance floor is dancing, and everyone at the party can hear it." : "Music off. Tap the decks to start it again.";
      hint.classList.remove("gone");
      clearTimeout(hintTimer);
      hintTimer = setTimeout(dismissHint, 4000);
      clearSelection();
      return true;
    }
    // a page in the background hides the video as well
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && jb.ready) jb.player.pauseVideo(); });
    // Tapping the TV while its video shows skips to the next song; a joined guest who isn't in the lounge walks over.
    function tapTV(cx, cy) {
      if (!tv.view) return false;
      setRay(cx, cy);
      if (!raycaster.intersectObject(karaoke.mesh).length) return false;
      if (snd && !snd.enabled) setSound(true);
      if (!jb.on || !jb.ready) startJukebox(); // the first tap on the TV starts the music
      else if (jb.playing) jb.player.nextVideo();
      else jb.player.playVideo();
      const lounge = byId.lounge, r = lounge.rect;
      if (me && !(me.x >= r[0] && me.x < r[2] + 1 && me.z >= r[1] && me.z < r[3] + 1)) {
        if (walkTo(lounge.spot[0], lounge.spot[1])) follow = true;
        markSelected(lounge);
      }
      return true;
    }
    const tvP = new T.Vector3();
    // where a point of the TV screen lands on the canvas, in CSS pixels (fx and fy run from -1 to 1 across the screen)
    function tvPoint(fx, fy, w, h) {
      tvP.set(TV.x + (fx * TV.w) / 2 + OX, TV.y + (fy * TV.h) / 2, TV.z + OZ).project(cam);
      return [((tvP.x + 1) / 2) * w, ((1 - tvP.y) / 2) * h];
    }
    // the join sheet, or the guest list over the TV's patch of screen
    function tvCovered(box) {
      if (!joinEl.hidden) return true;
      if (guestList.hidden) return false;
      const r = guestList.getBoundingClientRect(), c = canvas.getBoundingClientRect();
      return r.right > c.left + box[0] && r.left < c.left + box[2] && r.bottom > c.top + box[1] && r.top < c.top + box[3];
    }
    // Every frame, after the camera has moved and before the render: decide whether the video can be seen, and pin the
    // player onto the TV screen. The camera is orthographic, so the affine map from the player's rectangle through
    // three projected corners of the screen is exact.
    function updateTV(t) {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      cam.updateMatrixWorld();
      const tl = tvPoint(-1, 1, w, h), tr = tvPoint(1, 1, w, h), bl = tvPoint(-1, -1, w, h);
      const ux = tr[0] - tl[0], uy = tr[1] - tl[1], vx = bl[0] - tl[0], vy = bl[1] - tl[1];
      const mx = tl[0] + (ux + vx) / 2, my = tl[1] + (uy + vy) / 2;
      const xs = [tl[0], tr[0], bl[0], tr[0] + vx], ys = [tl[1], tr[1], bl[1], tr[1] + vy];
      const roof = buildings.get("pavilion");
      const cut = Math.max(0, Math.min(1, (TV.y + TV.h / 2 - clipPlane.constant) / TV.h)); // share of the screen above the close-up slice
      tv.view = ux * vy - uy * vx > 0 && // facing us
        Math.hypot(ux, uy) >= (tv.view ? 110 : 120) && // big enough to watch properly (a little slack once on, so it doesn't flicker)
        mx > 0 && mx < w && my > 0 && my < h && // on screen
        !!roof && roof.fade > 0.5 && // the pavilion roof is off
        buildClock.value > karaoke.land && // the TV has landed after the build-in
        cut < 0.5 && !tvCovered([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
      const show = tv.view && jb.on && jb.ready;
      if (show !== tv.shown) {
        tv.shown = show;
        karaoke.mesh.material = show ? holeMat : karaoke.mat;
        tvVideo.style.visibility = show ? "visible" : "hidden";
        karaoke.next = 0; // the painted screen is fresh again the moment the video goes
        jb.next = 0; // and the video plays or pauses right away
      }
      if (show) {
        const m = "matrix(" + [ux / TV.pw, uy / TV.pw, vx / TV.ph, vy / TV.ph].map((v) => v.toFixed(5)).join(",") + "," + tl[0].toFixed(2) + "," + tl[1].toFixed(2) + ")";
        if (m !== tv.m) { tv.m = m; tvVideo.style.transform = m; }
        // the slice takes the same share off the top of the video (the hole in the canvas is sliced with the rest)
        const clip = cut > 0 ? "inset(" + (cut * 100).toFixed(2) + "% 0 0 0)" : "none";
        if (clip !== tv.clip) { tv.clip = clip; tvVideo.style.clipPath = clip; tvVideo.style.webkitClipPath = clip; }
      }
      updateJukebox(t);
    }
    function updateJukebox(t) {
      if (t < jb.next) return;
      jb.next = t + 0.25;
      if (!jb.ready) return;
      if (!tv.shown) { // out of sight: YouTube mustn't play hidden
        if (jb.playing || jb.player.getPlayerState() === 3) jb.player.pauseVideo();
        jb.asked = jb.stuck = 0;
        tvTapMode(false);
        return;
      }
      if (jb.night !== night) { // day and night have their own music
        jb.night = night;
        jb.player.loadPlaylist(jbList(), 0);
        jb.player.setLoop(true);
      }
      // at 70% tops, full across most of the pavilion, fading out beyond it
      const vol = Math.round(70 * Math.max(0.15, Math.min(1, 1 - (musicDistance() - 12) / 18)));
      if (vol !== jb.vol) { jb.vol = vol; jb.player.setVolume(vol); }
      if (jb.playing) jb.stuck = 0;
      else if (!jb.blocked) {
        // not playing: ask again now and then; if it never starts (and isn't just loading), the phone wants a tap on it
        const st = jb.player.getPlayerState();
        if (st !== 3) jb.stuck += 0.25;
        if (jb.stuck > 4) jb.blocked = true;
        else if (st !== 3 && t - jb.asked > 1.5) { jb.asked = t; jb.player.playVideo(); }
      }
      tvTapMode(jb.blocked && !jb.playing);
    }
    // Some phones (iPhones) only start YouTube from a tap on the video itself: until it plays, the player sits over
    // the canvas and takes taps on the TV.
    function tvTapMode(on) {
      if (tvLayer.classList.contains("tap") === on) return;
      tvLayer.classList.toggle("tap", on);
      if (on) toast(coarse ? "Tap the TV to start the music" : "Click the TV to start the music", 6000);
    }
    // for tests (window.fefeDebug.tv): the screen's corners on the canvas (TL, TR, BL, BR) and what the video is doing
    function tvState() {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, r = canvas.getBoundingClientRect();
      return { view: tv.view, shown: tv.shown, hole: karaoke.mesh.material === holeMat, on: jb.on, ready: jb.ready, playing: jb.playing, blocked: jb.blocked,
        tap: tvLayer.classList.contains("tap"), m: tv.m, clip: tv.clip, fade: buildings.get("pavilion").fade, slice: clipPlane.constant, left: r.left, top: r.top,
        fit: view.fit, az: view.az, build: buildClock.value, land: karaoke.land, corners: [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([fx, fy]) => tvPoint(fx, fy, w, h)) };
    }

    // ---------- karaoke screen: an ABBA night (song titles only, no lyrics) ----------
    const ABBA = ["Dancing Queen", "Mamma Mia", "Waterloo", "Gimme! Gimme! Gimme!", "Take a Chance on Me", "Super Trouper", "Voulez-Vous", "Fernando", "Money, Money, Money", "Chiquitita"];
    const karaoke = (() => {
      const c = document.createElement("canvas");
      c.width = 192;
      c.height = 96;
      const tex = new T.CanvasTexture(c);
      tex.magFilter = T.NearestFilter;
      tex.minFilter = T.LinearFilter;
      tex.generateMipmaps = false;
      const geo = new T.PlaneGeometry(2.56, 1.26);
      const drop = dropAt(39, 3.4, 32.3, 5) + 14;
      geo.setAttribute("aDrop", new T.BufferAttribute(new Uint8Array(4).fill(drop), 1));
      const mat = new T.MeshBasicMaterial({ map: tex, clippingPlanes: [clipPlane] }); // sliced along with its frame
      patchDrop(mat);
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(39.0 + OX, 3.35, 32.365 + OZ);
      scene.add(mesh);
      // land: build clock time by which it has dropped in and stopped jiggling (the YouTube video waits for that)
      return { c, g: c.getContext("2d"), tex, mat, mesh, land: drop / DROP_STEP + 1.1, next: 0 };
    })();
    // the four pixel performers in glam outfits
    const GLAM = [["#FFFFFF", "#F2D16B"], ["#2F6FD1", "#6B3F1F"], ["#FEFE40", "#C9A35A"], ["#E23D9B", "#8A4B2A"]];
    function paintKaraoke(t) {
      const { g, c } = karaoke, W = c.width, H = c.height;
      const song = ABBA[Math.floor(t / 20) % ABBA.length], u = (t % 20) / 20;
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#2A0B4F");
      grad.addColorStop(1, "#C2185B");
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      // sparkles
      for (let i = 0; i < 18; i++) {
        const x = (i * 53 + Math.floor(t * 7) * (i % 3 + 1)) % W, y = (i * 29) % 44 + 18;
        g.fillStyle = (Math.floor(t * 4) + i) % 3 ? "rgba(255,255,255,0.25)" : "#FFFFFF";
        g.fillRect(x, y, 2, 2);
      }
      g.textAlign = "center";
      g.textBaseline = "top";
      g.fillStyle = "#FEFE40";
      g.font = "bold 15px 'Pixelify Sans', 'Courier New', monospace";
      g.fillText("\u266A ABBA \u266A", W / 2, 4);
      g.fillStyle = "#FFFFFF";
      g.font = "bold 12px 'Pixelify Sans', 'Courier New', monospace";
      g.fillText(song, W / 2, 21);
      // performers
      GLAM.forEach(([suit, hair], i) => {
        const x = 40 + i * 37, hop = Math.abs(Math.sin(t * 5 + i)) * 4, y = 40 - hop;
        g.fillStyle = hair;
        g.fillRect(x, y, 8, 4);
        g.fillStyle = "#F0C9A0";
        g.fillRect(x + 1, y + 3, 6, 5);
        g.fillStyle = suit;
        g.fillRect(x, y + 8, 8, 9);
        const arm = Math.sin(t * 5 + i) > 0 ? -5 : 2;
        g.fillRect(x - 3, y + 8 + arm, 3, 7);
        g.fillRect(x + 8, y + 8 - arm, 3, 7);
        g.fillRect(x + 1, y + 17, 2, 7);
        g.fillRect(x + 5, y + 17, 2, 7);
      });
      // lyric bar with the bouncing ball, or who's on the mic
      g.fillStyle = "rgba(0,0,0,0.45)";
      g.fillRect(8, 70, W - 16, 20);
      let singer = null;
      if (party) actorList.forEach((a) => { if (!singer && party.actOf(a) === "sing") singer = a.name; });
      g.font = "bold 11px 'Pixelify Sans', 'Courier New', monospace";
      if (singer) {
        g.fillStyle = "#FEFE40";
        g.fillText("Now singing: " + singer, W / 2, 75);
      } else {
        const words = ["la", "la", "la", "\u266A", "la", "la", "la", "\u266A"], x0 = 24, step = (W - 48) / (words.length - 1);
        const k = Math.floor(u * words.length * 2) % words.length;
        words.forEach((w, i) => { g.fillStyle = i <= k ? "#FEFE40" : "#FFFFFF"; g.fillText(w, x0 + i * step, 76); });
        g.fillStyle = "#FF6FB5";
        g.fillRect(x0 + k * step - 2, 70 - Math.abs(Math.sin(t * 6)) * 5, 4, 4);
      }
      karaoke.tex.needsUpdate = true;
    }
    // ---------- living room TV: a live feed from the bedroom next door ----------
    // A small camera in the corner of the main villa bedroom renders onto the TV, about 15 times a second, but only
    // while the living room is on screen (roof cut away and zoomed in near it).
    const feed = (() => {
      const W = 192, H = 96;
      const rt = new T.WebGLRenderTarget(W, H, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
      const cam2 = new T.PerspectiveCamera(62, W / H, 0.1, 40);
      // low in the south-west corner, clear of the wardrobe, looking across at the beds
      cam2.position.set(13.35 + OX, 3.85, 9.65 + OZ);
      cam2.lookAt(15.8 + OX, 2.55, 6.3 + OZ);
      const drop = (geo) => geo.setAttribute("aDrop", new T.BufferAttribute(new Uint8Array(geo.attributes.position.count).fill(dropAt(11.3, 3.2, 10, 3) + 14), 1));
      const geo = new T.PlaneGeometry(1.94, 0.94);
      drop(geo);
      const mat = new T.MeshBasicMaterial({ map: rt.texture, color: 0xdddddd });
      patchDrop(mat);
      const screen = new T.Mesh(geo, mat);
      screen.rotation.y = -Math.PI / 2;
      screen.position.set(11.3 + OX, 3.1, 10.0 + OZ);
      scene.add(screen);
      // "REC" overlay with scanlines
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const otex = new T.CanvasTexture(c);
      const ogeo = new T.PlaneGeometry(1.94, 0.94);
      drop(ogeo);
      const omat = new T.MeshBasicMaterial({ map: otex, transparent: true, depthWrite: false });
      patchDrop(omat);
      const over = new T.Mesh(ogeo, omat);
      over.rotation.y = -Math.PI / 2;
      over.position.set(11.29 + OX, 3.1, 10.0 + OZ);
      scene.add(over);
      return { rt, cam2, c, g: c.getContext("2d"), otex, next: 0, blink: -1 };
    })();
    function updateFeed(t) {
      if (t < feed.next) return;
      feed.next = t + 1 / 15;
      const villa = buildings.get("mainVilla");
      const dx = view.target.x - (9 + OX), dz = view.target.z - (9 + OZ);
      if (!villa || villa.fade < 0.3 || view.fit > 32 || dx * dx + dz * dz > 16 * 16) return;
      const blink = Math.floor(t * 2) % 2;
      if (blink !== feed.blink) {
        feed.blink = blink;
        const g = feed.g, W = feed.c.width, H = feed.c.height;
        g.clearRect(0, 0, W, H);
        g.fillStyle = "rgba(0,0,0,0.12)";
        for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
        g.font = "bold 12px 'Pixelify Sans', 'Courier New', monospace";
        g.textBaseline = "top";
        if (blink) { g.fillStyle = "#FF2A2A"; g.beginPath(); g.arc(12, 11, 5, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#FFFFFF";
        g.fillText("REC  BEDROOM CAM", 22, 5);
        feed.otex.needsUpdate = true;
      }
      // render the bedroom without redrawing shadows or the close-up slice
      const auto = renderer.shadowMap.autoUpdate, clip = clipPlane.constant;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = false;
      clipPlane.constant = 1000;
      renderer.setRenderTarget(feed.rt);
      renderer.render(scene, feed.cam2);
      renderer.setRenderTarget(null);
      renderer.shadowMap.autoUpdate = auto;
      clipPlane.constant = clip;
    }

    // repainted a few times a second, and only when the lounge is close enough to see
    function updateKaraoke(t) {
      if (t < karaoke.next || tv.shown) return; // not while the video is on it
      karaoke.next = t + 0.16;
      const dx = view.target.x - (39 + OX), dz = view.target.z - (33 + OZ);
      if (karaoke.painted && (view.fit > 45 || dx * dx + dz * dz > 30 * 30)) return;
      karaoke.painted = true;
      paintKaraoke(t);
    }
    function updateParty(dt) {
      updateCars(dt, performance.now() / 1000);
      updateMe(dt);
      ghosts.forEach((g, id) => updateGhost(g, id, dt));
      updatePuffs(dt);
      if (!party) return;
      actorList.length = 0;
      if (me) actorList.push(me);
      ghosts.forEach((g) => actorList.push(g.actor));
      party.update(dt, actorList, Date.now() - PARTY_EPOCH);
      updateChoir();
      separate(dt);
      actorList.forEach((a) => faceCamera(a, dt));
    }
    // Nobody stands inside anybody else: bodies closer than 0.7 m are eased apart (on screen only, so walking and
    // recording are untouched), unless they're in an act that's meant to be that close.
    const SEP = 0.7;
    function separate(dt) {
      const n = actorList.length;
      for (let i = 0; i < n; i++) { const a = actorList[i]; a.sepWx = 0; a.sepWz = 0; }
      for (let i = 0; i < n; i++) {
        const a = actorList[i], ra = a.av.root;
        if (!ra.visible || a.drop > 0 || a.inCar || party.close(a)) continue;
        for (let j = i + 1; j < n; j++) {
          const b = actorList[j], rb = b.av.root;
          if (!rb.visible || b.drop > 0 || b.inCar || party.close(b) || Math.abs(ra.position.y - rb.position.y) > 1.2) continue;
          let dx = rb.position.x - ra.position.x, dz = rb.position.z - ra.position.z, d = Math.hypot(dx, dz);
          if (d >= SEP) continue;
          const push = (SEP - d) / 2;
          if (d < 1e-3) { const k = ((i * 7 + j * 13) % 8) * (Math.PI / 4); dx = Math.cos(k); dz = Math.sin(k); } else { dx /= d; dz /= d; }
          a.sepWx -= dx * push; a.sepWz -= dz * push;
          b.sepWx += dx * push; b.sepWz += dz * push;
        }
      }
      const k = Math.min(1, dt * 6);
      for (let i = 0; i < n; i++) {
        const a = actorList[i];
        a.sepX = (a.sepX || 0) + (a.sepWx - (a.sepX || 0)) * k;
        a.sepZ = (a.sepZ || 0) + (a.sepWz - (a.sepZ || 0)) * k;
        a.av.root.position.x += a.sepX;
        a.av.root.position.z += a.sepZ;
      }
    }
    // Heads turn towards the viewer (up to 90°) and tip up a little, so faces show from most angles. Not when we're
    // looking at someone's back, when they're lying or tumbling, or when their act aims the head itself.
    function faceCamera(a, dt) {
      const r = a.av.rig.rotation;
      let want = 0;
      if (a.av.root.visible && !a.headLocked && Math.abs(r.x) < 0.5 && Math.abs(r.z) < 0.5) {
        const body = a.av.root.rotation.y + r.y, rel = Math.atan2(Math.sin(view.az - body), Math.cos(view.az - body));
        if (Math.abs(rel) < 2.1) want = Math.max(-1.5, Math.min(1.5, rel));
      }
      a.headYaw = (a.headYaw || 0) + (want - (a.headYaw || 0)) * Math.min(1, dt * 7);
      const head = a.av.parts.head.rotation;
      head.y += a.headYaw;
      if (want !== 0) head.x -= 0.28 * Math.min(1, 1.6 - Math.abs(a.headYaw));
    }
    function updateTags() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (me) placeTag(me, w, h);
      ghosts.forEach((g) => placeTag(g.actor, w, h));
    }

    // ---------- joining: photo, name, avatar, outfit ----------
    const $ = (id) => document.getElementById(id);
    const enterBtn = $("enter"), findBtn = $("find-me"), joinEl = $("join");
    const stepPhoto = $("step-photo"), stepWait = $("step-wait"), stepDress = $("step-dress");
    const video = $("cam"), shot = $("shot"), camMsg = $("cam-msg"), guide = $("guide");
    const snapBtn = $("snap"), retakeBtn = $("retake"), fileIn = $("file"), nameIn = $("guest-name"), makeBtn = $("make");
    const previewCanvas = $("preview");
    // Phones take the photo with the camera; picking a file is for computers (or when the camera won't open), since on
    // a phone it only muddles things.
    const fileBtn = $("file-btn"), onPhone = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches && matchMedia("(hover: none)").matches);
    const outfitName = $("outfit-name"), outfitCount = $("outfit-count"), waitMsg = $("wait-msg");
    let stream = null, photo = null, draft = null;
    nameIn.value = lsGet("fefe40.name") || "";
    $("solo-note").hidden = store.shared;

    const stepVoice = $("step-voice");
    function showStep(which) {
      stepPhoto.hidden = which !== "photo";
      stepVoice.hidden = which !== "voice";
      stepWait.hidden = which !== "wait";
      stepDress.hidden = which !== "dress";
    }
    function updateMake() { makeBtn.disabled = !nameIn.value.trim(); }
    function openJoin() {
      joinEl.hidden = false;
      setDressMode("join");
      showStep("photo");
      updateMake();
      if (!photo) startCamera();
      loadFaceApi().catch(() => { /* the avatar still works without it */ });
      clearSelection();
      dismissHint();
    }
    function closeJoin() {
      joinEl.hidden = true;
      stopCamera();
      stopPreview();
      if (voiceUI) voiceUI.close();
      if (voiceDone) voiceDone();
    }
    enterBtn.addEventListener("click", openJoin);
    $("join-cancel").addEventListener("click", closeJoin);
    joinEl.addEventListener("keydown", (e) => { if (e.key === "Escape") closeJoin(); });
    nameIn.addEventListener("input", updateMake);
    nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter" && !makeBtn.disabled) makeBtn.click(); });

    function noCamera(msg) {
      fileBtn.hidden = false;
      camMsg.textContent = msg;
      camMsg.hidden = false;
      video.hidden = true;
      guide.hidden = true;
      snapBtn.hidden = true;
    }
    async function startCamera() {
      endFraming();
      camMsg.hidden = true;
      shot.hidden = true;
      retakeBtn.hidden = true;
      snapBtn.hidden = false;
      snapBtn.disabled = true;
      fileBtn.hidden = onPhone;
      guide.hidden = false;
      video.hidden = false;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        noCamera("This browser can't open the camera here. Use a photo instead, or skip the photo.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
        if (joinEl.hidden || photo) { stopCamera(); return; }
        video.srcObject = stream;
        await video.play().catch(() => {});
        snapBtn.disabled = false;
      } catch (e) {
        noCamera("The camera isn't available. Use a photo instead, or skip the photo.");
      }
    }
    function stopCamera() {
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      video.srcObject = null;
    }
    // The photo can be moved and zoomed under the oval before it's used. The whole photo is kept (at most 1600 px a
    // side) and the frame shows a square of it: zoom 1 fits its short side, and (cx, cy) is the photo point at the
    // frame's centre. It starts framed on the face the face finder spots; after that the guest's framing wins.
    const zoomRow = $("zoom-row"), zoomIn = $("zoom"), frameTip = $("frame-tip"), frameEl = shot.parentElement;
    const ZMIN = 0.6, ZMAX = 5, SHOT = 480;
    // the face box the oval stands for, in frame pixels: the same crop the face finder's box gives (see analyse)
    const OVAL_BOX = { x: 126.1, y: 129.7, width: 227.8, height: 227.8 };
    let framing = null;
    function setPhoto(src, sw, sh, mirror) {
      const k = Math.min(1, 1600 / Math.max(sw, sh)), c = document.createElement("canvas");
      c.width = Math.round(sw * k);
      c.height = Math.round(sh * k);
      const g = c.getContext("2d");
      if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
      g.drawImage(src, 0, 0, c.width, c.height);
      framing = { img: c, w: c.width, h: c.height, zoom: 1, cx: c.width / 2, cy: c.height / 2, touched: false, body: null };
      photo = shot;
      drawShot();
      shot.hidden = false;
      video.hidden = true;
      guide.hidden = false;
      camMsg.hidden = true;
      snapBtn.hidden = true;
      retakeBtn.hidden = false;
      zoomRow.hidden = false;
      frameTip.hidden = false;
      frameTip.textContent = "Finding your face…";
      frameEl.classList.add("framing");
      syncZoom();
      stopCamera();
      updateMake();
      autoFrame(framing);
    }
    function endFraming() {
      framing = null;
      zoomRow.hidden = true;
      frameTip.hidden = true;
      frameEl.classList.remove("framing", "grabbing");
    }
    const frameScale = (fr) => SHOT / (Math.min(fr.w, fr.h) / fr.zoom); // frame pixels per photo pixel
    function drawShot() {
      const fr = framing;
      if (!fr) return;
      const g = shot.getContext("2d"), k = frameScale(fr);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#0B2A4A";
      g.fillRect(0, 0, SHOT, SHOT);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.setTransform(k, 0, 0, k, SHOT / 2 - fr.cx * k, SHOT / 2 - fr.cy * k);
      g.drawImage(fr.img, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    // keep the photo under the middle of the frame
    function clampFraming(fr) {
      fr.zoom = Math.max(ZMIN, Math.min(ZMAX, fr.zoom));
      fr.cx = Math.max(0, Math.min(fr.w, fr.cx));
      fr.cy = Math.max(0, Math.min(fr.h, fr.cy));
    }
    // zoom by a factor, keeping the photo point under frame pixel (fx, fy) where it is
    function zoomAt(fx, fy, factor) {
      const fr = framing, k0 = frameScale(fr);
      const px = fr.cx + (fx - SHOT / 2) / k0, py = fr.cy + (fy - SHOT / 2) / k0;
      fr.zoom = Math.max(ZMIN, Math.min(ZMAX, fr.zoom * factor));
      const k1 = frameScale(fr);
      fr.cx = px - (fx - SHOT / 2) / k1;
      fr.cy = py - (fy - SHOT / 2) / k1;
      clampFraming(fr);
    }
    function framePan(dx, dy) { // in frame pixels
      const fr = framing, k = frameScale(fr);
      fr.cx -= dx / k;
      fr.cy -= dy / k;
      clampFraming(fr);
    }
    const zoomToSlider = (z) => Math.log(z / ZMIN) / Math.log(ZMAX / ZMIN);
    function syncZoom() { if (framing) zoomIn.value = String(zoomToSlider(framing.zoom)); }
    function touchFraming() {
      if (!framing) return;
      framing.touched = true;
      frameTip.textContent = "Drag to move and pinch to zoom: fit your face in the oval.";
      drawShot();
      syncZoom();
    }
    // Put the face the face finder spots where the oval is, the same size as the oval's face box.
    async function autoFrame(fr) {
      try {
        const api = await withTimeout(loadFaceApi(), 12000);
        if (framing !== fr || fr.touched) return;
        const det = await withTimeout(api.detectSingleFace(fr.img, new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 })).withAgeAndGender(), 8000);
        if (framing !== fr) return;
        if (det) {
          fr.body = det.gender === "female" ? "f" : "m";
          if (!fr.touched) {
            const b = det.detection.box;
            fr.zoom = Math.max(ZMIN, Math.min(ZMAX, ((OVAL_BOX.width / Math.max(b.width, b.height)) * Math.min(fr.w, fr.h)) / SHOT));
            // the face's reference point (centre across, 40% down its box) goes to the oval box's
            const k = frameScale(fr);
            fr.cx = b.x + b.width / 2 - (OVAL_BOX.x + OVAL_BOX.width / 2 - SHOT / 2) / k;
            fr.cy = b.y + b.height * 0.4 - (OVAL_BOX.y + OVAL_BOX.height * 0.4 - SHOT / 2) / k;
            clampFraming(fr);
            drawShot();
            syncZoom();
          }
        }
      } catch (e) { /* no face finder: the guest frames it by hand */ }
      if (framing === fr && !fr.touched) frameTip.textContent = "Drag to move and pinch to zoom: fit your face in the oval.";
    }
    // the oval's face box, in the kept photo's pixels
    function framedBox(fr) {
      const k = frameScale(fr);
      return { x: fr.cx + (OVAL_BOX.x - SHOT / 2) / k, y: fr.cy + (OVAL_BOX.y - SHOT / 2) / k, width: OVAL_BOX.width / k, height: OVAL_BOX.height / k };
    }
    // one finger drags, two pinch (and drag), a mouse wheel zooms
    const grips = new Map();
    let framePinch = null;
    const toFrame = (e) => { const r = shot.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * SHOT, ((e.clientY - r.top) / r.height) * SHOT]; };
    frameEl.addEventListener("pointerdown", (e) => {
      if (!framing) return;
      e.preventDefault();
      frameEl.setPointerCapture(e.pointerId);
      grips.set(e.pointerId, toFrame(e));
      frameEl.classList.add("grabbing");
      framePinch = null;
    });
    frameEl.addEventListener("pointermove", (e) => {
      if (!framing || !grips.has(e.pointerId)) return;
      const prev = grips.get(e.pointerId), now = toFrame(e);
      if (grips.size === 1) framePan(now[0] - prev[0], now[1] - prev[1]);
      grips.set(e.pointerId, now);
      if (grips.size >= 2) {
        const [a, b] = [...grips.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (framePinch && framePinch.d > 10) {
          framePan(mid[0] - framePinch.mid[0], mid[1] - framePinch.mid[1]);
          zoomAt(mid[0], mid[1], d / framePinch.d);
        }
        framePinch = { mid, d };
      }
      touchFraming();
    });
    const letGo = (e) => {
      grips.delete(e.pointerId);
      framePinch = null;
      if (!grips.size) frameEl.classList.remove("grabbing");
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => frameEl.addEventListener(ev, letGo));
    frameEl.addEventListener("wheel", (e) => {
      if (!framing) return;
      e.preventDefault();
      const [fx, fy] = toFrame(e);
      zoomAt(fx, fy, Math.exp(-e.deltaY * 0.0015));
      touchFraming();
    }, { passive: false });
    zoomIn.addEventListener("input", () => {
      if (!framing) return;
      const want = ZMIN * Math.pow(ZMAX / ZMIN, +zoomIn.value);
      zoomAt(OVAL_BOX.x + OVAL_BOX.width / 2, OVAL_BOX.y + OVAL_BOX.height * 0.4, want / framing.zoom);
      touchFraming();
    });
    [["zoom-in", 1.2], ["zoom-out", 1 / 1.2]].forEach(([id, f]) => $(id).addEventListener("click", () => {
      if (!framing) return;
      zoomAt(OVAL_BOX.x + OVAL_BOX.width / 2, OVAL_BOX.y + OVAL_BOX.height * 0.4, f);
      touchFraming();
    }));
    snapBtn.addEventListener("click", () => { if (video.videoWidth) setPhoto(video, video.videoWidth, video.videoHeight, true); });
    retakeBtn.addEventListener("click", () => { photo = null; startCamera(); });
    fileIn.addEventListener("change", () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => { setPhoto(img, img.naturalWidth, img.naturalHeight, false); URL.revokeObjectURL(img.src); };
      img.onerror = () => noCamera("That photo couldn't be opened. Try another one.");
      img.src = URL.createObjectURL(f);
      fileIn.value = "";
    });

    let faceApi = null;
    function loadFaceApi() {
      if (!faceApi) {
        faceApi = new Promise((resolve, reject) => {
          if (window.faceapi) { resolve(window.faceapi); return; }
          const s = document.createElement("script");
          s.src = FACEAPI + "/dist/face-api.js";
          s.onload = () => (window.faceapi ? resolve(window.faceapi) : reject(new Error("face-api missing")));
          s.onerror = () => reject(new Error("face-api failed to load"));
          document.head.appendChild(s);
        }).then(async (api) => {
          if (api.tf && api.tf.ready) await api.tf.ready();
          await api.nets.tinyFaceDetector.loadFromUri(FACEAPI + "/model");
          await api.nets.ageGenderNet.loadFromUri(FACEAPI + "/model");
          return api;
        });
        faceApi.catch(() => { faceApi = null; });
      }
      return faceApi;
    }
    const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);
    // Photo → 32×32 pixel face, skin and hair colours, and a male/female guess for the starting look.
    const FACE = 32;
    // framed: the guest's framing of a photo (see setPhoto), whose oval says where the face is
    async function analyse(src, framed) {
      const out = { face: null, skin: "#D9A57E", hair: "#4A3020", body: null };
      if (framed) { out.body = framed.body; src = framed.img; }
      if (!src) return out;
      let box = framed ? framedBox(framed) : null;
      if (!out.body) {
        try {
          waitMsg.textContent = "Loading the face finder…";
          const api = await withTimeout(loadFaceApi(), 12000);
          waitMsg.textContent = "Finding your face…";
          // for a framed photo, look at just what's in the frame: that's the face they picked
          const det = await withTimeout(api.detectSingleFace(framed ? shot : src, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 })).withAgeAndGender(), 6000);
          if (det) { if (!box) box = det.detection.box; out.body = det.gender === "female" ? "f" : "m"; }
        } catch (e) { /* no model or no face found: use the middle of the photo */ }
      }
      const W = src.width, H = src.height;
      // the head's front is the face from just above the brows to the chin, so the face fills it
      let size = Math.min(W, H) * 0.56, cx = W / 2, cy = H * 0.46;
      if (box) { size = Math.max(box.width, box.height) * 1.18; cx = box.x + box.width / 2; cy = box.y + box.height * 0.4; }
      size = Math.min(size, W, H);
      cx = Math.max(size / 2, Math.min(W - size / 2, cx));
      cy = Math.max(size / 2, Math.min(H - size / 2, cy));
      // crop a square to FACE×FACE head pixels: a little more colour and contrast, lightly posterised for the blocky look
      const pixels = (img, x0, y0, flip) => {
        const c = document.createElement("canvas");
        c.width = c.height = FACE;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = "high";
        if (flip) { g.translate(FACE, 0); g.scale(-1, 1); }
        g.drawImage(img, x0, y0, size, size, 0, 0, FACE, FACE);
        const d = g.getImageData(0, 0, FACE, FACE).data, px = new Uint8Array(FACE * FACE * 3);
        for (let i = 0; i < FACE * FACE; i++) {
          const r = d[i * 4], gr = d[i * 4 + 1], b = d[i * 4 + 2];
          const L = 0.3 * r + 0.59 * gr + 0.11 * b;
          [r, gr, b].forEach((v, k) => { px[i * 3 + k] = Math.max(0, Math.min(255, Math.round(((L + (v - L) * 1.25 - 128) * 1.12 + 128) / 10) * 10)); });
        }
        return px;
      };
      const face = pixels(src, cx - size / 2, cy - size / 2, false);
      const avg = (x0, y0, x1, y1) => {
        const s = [0, 0, 0];
        let n = 0;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { for (let k = 0; k < 3; k++) s[k] += face[(y * FACE + x) * 3 + k]; n++; }
        return "#" + s.map((v) => Math.round(v / n).toString(16).padStart(2, "0")).join("");
      };
      out.face = face;
      // skin tone for the neck, arms and legs: the cheeks of the photo (skipping hair, shadows and shine), coloured the
      // same way as the face so they match
      const skinTone = () => {
        const n = 64, c = document.createElement("canvas");
        c.width = c.height = n;
        const g = c.getContext("2d");
        g.drawImage(src, cx - size / 2, cy - size / 2, size, size, 0, 0, n, n);
        const d = g.getImageData(0, 0, n, n).data, px = [];
        [[0.3, 0.56], [0.7, 0.56]].forEach(([fx, fy]) => {
          for (let y = Math.round((fy - 0.06) * n); y <= Math.round((fy + 0.06) * n); y++) {
            for (let x = Math.round((fx - 0.06) * n); x <= Math.round((fx + 0.06) * n); x++) {
              const i = (y * n + x) * 4, r = d[i], gr = d[i + 1], b = d[i + 2], L = 0.3 * r + 0.59 * gr + 0.11 * b;
              if (L > 45 && L < 235 && r >= b) px.push([r, gr, b]);
            }
          }
        });
        if (px.length < 8) return null;
        const med = [0, 1, 2].map((k) => px.map((p) => p[k]).sort((p, q) => p - q)[px.length >> 1]);
        const L = 0.3 * med[0] + 0.59 * med[1] + 0.11 * med[2];
        return "#" + med.map((v) => Math.max(0, Math.min(255, Math.round((L + (v - L) * 1.25 - 128) * 1.12 + 128))).toString(16).padStart(2, "0")).join("");
      };
      // only take it if it looks like skin (not a dark background when no face was found)
      const skinLike = (hex) => {
        if (!hex) return false;
        const v = parseInt(hex.slice(1), 16), r = v >> 16, gr = (v >> 8) & 255, b = v & 255, L = 0.3 * r + 0.59 * gr + 0.11 * b;
        return L > 70 && L < 240 && r >= gr && gr >= b * 0.75 && r - b > 12;
      };
      out.skin = [skinTone(), avg(10, 18, 21, 23)].find(skinLike) || "#C98F6B";
      out.hair = avg(4, 0, 27, 3);
      const hair = hairTone(src, cx, cy, size, out.skin);
      // the sharp face: a small JPEG/WebP string of up to 96 x 96 pixels that fits the shared record (avatar.js)
      if (FefeAvatar.faceFromImage) {
        try {
          const hd = FefeAvatar.faceFromImage(src, box, hair ? { hair: parseInt(hair.slice(1), 16) } : undefined);
          if (hd && hd.face) { out.face = hd.face; out.hair = hd.hair || out.hair; }
        } catch (e) { /* keep the pixel face */ }
      }
      if (hair) out.hair = hair;
      return out;
    }

    // The hair colour, from around the head rather than inside the face crop: above the brows up to the crown and down
    // beside the face, leaving out anything skin-coloured (forehead, ears) or the colour of the background (sampled
    // further out, past the head). What's left is grouped into colours and the biggest group is the hair. Null when
    // there isn't enough to go on (then the face crop's own guess stands).
    function hairTone(src, cx, cy, size, skinHex) {
      const W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
      // back to a face box: brows to chin, the way the face finder draws it
      const fw = size / 1.18, fx = cx - fw / 2, fy = cy - 0.4 * fw;
      const U0 = -0.9, U1 = 1.9, V0 = -1, V1 = 0.9, GW = 84, GH = Math.round((GW * (V1 - V0)) / (U1 - U0));
      const c = document.createElement("canvas");
      c.width = GW;
      c.height = GH;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.imageSmoothingEnabled = true;
      g.drawImage(src, fx + U0 * fw, fy + V0 * fw, (U1 - U0) * fw, (V1 - V0) * fw, 0, 0, GW, GH);
      const d = g.getImageData(0, 0, GW, GH).data;
      // sRGB to CIE Lab, so "close colours" means close to the eye
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const lab = (r, gr, b) => {
        const R = lin(r), G = lin(gr), B = lin(b);
        const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
        return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
      };
      const dE = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      const sv = parseInt(skinHex.slice(1), 16), skin = lab(sv >> 16, (sv >> 8) & 255, sv & 255);
      const top = [], side = [], ring = [];
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const u = U0 + ((x + 0.5) / GW) * (U1 - U0), v = V0 + ((y + 0.5) / GH) * (V1 - V0);
        const sx = fx + u * fw, sy = fy + v * fw;
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue; // off the photo (drawn as nothing)
        const i = (y * GW + x) * 4;
        if (d[i + 3] < 250) continue;
        const p = { rgb: [d[i], d[i + 1], d[i + 2]], lab: lab(d[i], d[i + 1], d[i + 2]) };
        if (u > -0.05 && u < 1.05 && v > -0.75 && v < -0.12) top.push(p);
        else if (((u > -0.3 && u < 0.02) || (u > 0.98 && u < 1.3)) && v > -0.2 && v < 0.55) side.push(p);
        else if ((u < -0.6 || u > 1.6) && v < 0.3) ring.push(p);
      }
      // a few rounds of k-means over Lab colours; returns the groups biggest first
      const groups = (pts, k) => {
        if (!pts.length) return [];
        let cs = [];
        for (let j = 0; j < k; j++) cs.push(pts[Math.floor(((j + 0.5) / k) * pts.length)].lab.slice());
        let sets = [];
        for (let it = 0; it < 8; it++) {
          sets = cs.map(() => []);
          pts.forEach((p) => { let best = 0, bd = Infinity; cs.forEach((c2, j) => { const dd = dE(p.lab, c2); if (dd < bd) { bd = dd; best = j; } }); sets[best].push(p); });
          cs = sets.map((s, j) => (s.length ? [0, 1, 2].map((q) => s.reduce((a, p) => a + p.lab[q], 0) / s.length) : cs[j]));
        }
        return sets.map((s, j) => ({ lab: cs[j], pts: s, share: s.length / pts.length })).filter((s2) => s2.pts.length).sort((a, b) => b.pts.length - a.pts.length);
      };
      const bg = groups(ring, 4).filter((s2) => s2.share > 0.1).map((s2) => s2.lab);
      const around = top.concat(top, side); // the top counts double: that's where the hair nearly always is
      if (around.length < 40) return null;
      const notSkin = around.filter((p) => dE(p.lab, skin) > 16);
      let pick = notSkin.filter((p) => bg.every((b) => dE(p.lab, b) > 14));
      if (pick.length < around.length * 0.12) {
        // hair the colour of the background, or not much hair: the non-skin colours above the brows, if there's plenty
        pick = notSkin.filter((p) => top.indexOf(p) >= 0);
        if (pick.length < top.length * 0.6) return null;
      }
      const best = groups(pick, 3)[0];
      if (!best) return null;
      const rgb = [0, 1, 2].map((q) => Math.round(best.pts.reduce((a, p) => a + p.rgb[q], 0) / best.pts.length));
      return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
    }

    makeBtn.addEventListener("click", async () => {
      myName = nameIn.value.trim().slice(0, 20);
      if (!myName) return;
      lsSet("fefe40.name", myName);
      stopCamera();
      const job = analyse(photo, framing); // works out the face while they record their voice
      if (voiceUI) {
        await askVoice("join");
        if (joinEl.hidden) return;
      }
      waitMsg.textContent = "Finding your face and picking your pixels.";
      showStep("wait");
      const res = await job;
      if (joinEl.hidden) return;
      draft = { body: res.body || "m", outfit: res.body === "f" ? 3 : 0, skin: res.skin, hair: res.hair, face: res.face, cheeky: lsGet("fefe40.cheeky") === "1" };
      // height and weight come back from last time, otherwise they follow the body until moved
      sizeSet = !!lsGet("fefe40.h");
      draft.h = +lsGet("fefe40.h") || FefeAvatar.HEIGHT[draft.body];
      draft.wt = +lsGet("fefe40.wt") || FefeAvatar.WEIGHT[draft.body];
      setDressMode("join");
      showStep("dress");
      startPreview();
      refreshDress();
    });
    // ---------- your voice: a fresh set of lines each time, read in one go (voice.js) ----------
    const voiceBtn = $("voice-btn");
    let voiceDone = null;
    const voiceUI = VOICE && (window.AudioContext || window.webkitAudioContext) && navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ? VOICE.createStep({
          intro: $("voice-intro"), live: $("voice-live"), review: $("voice-review"), peek: $("voice-peek"), error: $("voice-error"),
          go: $("voice-go"), skip: $("voice-skip"), stop: $("voice-stop"), again: $("voice-again"), redo: $("voice-redo"), done: $("voice-done"),
          list: $("voice-list"), summary: $("voice-summary"), count: $("voice-countdown"), card: $("voice-card"), line: $("voice-line"),
          en: $("voice-en"), hint: $("voice-hint"), fill: $("voice-fill"), level: $("voice-level"), progress: $("voice-progress"), pass: $("voice-pass")
        }, {
          onDone(clips) {
            Object.keys(clips).forEach((id) => { myVoice[id] = clips[id]; myVoiceUp.delete(id); clipBufs.delete(myId + "/" + id); });
            lsSet("fefe40.voiceRound", String(+(lsGet("fefe40.voiceRound") || 0) + 1));
            keepMyVoice();
            uploadVoice();
            if (voiceDone) voiceDone();
          },
          onSkip() { if (voiceDone) voiceDone(); }
        })
      : null;
    // Shows the voice step and resolves once they've recorded, skipped or closed it. mode "join" is step 2 of joining;
    // "more" is from the microphone button at the party.
    function askVoice(mode) {
      return new Promise((resolve) => {
        const have = new Set(Object.keys(myVoice)), cheeky = lsGet("fefe40.cheeky") === "1" || !!(myLook && myLook.cheeky);
        const lines = VOICE.pickSet(myId + ":" + (lsGet("fefe40.voiceRound") || "0"), have, cheeky, 20);
        if (!lines.length) { resolve(); return; } // they've recorded every line there is
        voiceDone = () => { voiceDone = null; resolve(); };
        voiceUI.open({ lines });
        $("voice-step").hidden = mode !== "join";
        $("voice-title").textContent = have.size ? "Record " + lines.length + " more lines?" : "Now lend us your voice!";
        $("voice-forget").hidden = !have.size;
        $("voice-skip").textContent = mode === "join" ? (have.size ? "Keep my voice" : "Skip") : "Close";
        $("voice-done").textContent = mode === "join" ? "Save and pick my outfit" : "Save my voice";
        showStep("voice");
      });
    }
    $("voice-forget").addEventListener("click", () => {
      Promise.resolve(store.voiceDrop(myId)).catch(() => {});
      [...clipBufs.keys()].forEach((k) => { if (k.indexOf(myId + "/") === 0) clipBufs.delete(k); });
      myVoice = {};
      myVoiceUp.clear();
      keepMyVoice();
      if (me) scheduleSave(200);
      $("voice-forget").hidden = true;
      $("voice-title").textContent = "Now lend us your voice!";
      if ($("voice-skip").textContent === "Keep my voice") $("voice-skip").textContent = "Skip";
    });
    voiceBtn.addEventListener("click", async () => {
      if (!me || !voiceUI || !joinEl.hidden) return;
      joinEl.hidden = false;
      await askVoice("more");
      if (voiceUI) voiceUI.close();
      joinEl.hidden = true;
    });
    // The outfit screen doubles as the bedroom wardrobe once you're at the party.
    let dressMode = "join";
    function setDressMode(mode) {
      dressMode = mode;
      $("dress-step").textContent = mode === "join" ? "Step 3 of 3 · Outfit" : "Wardrobe";
      $("back").textContent = mode === "join" ? "Back" : "Cancel";
      $("drop").textContent = mode === "join" ? "OK, drop me in" : "Wear it";
    }
    function openWardrobe() {
      if (!me) return;
      draft = Object.assign({}, myLook);
      sizeSet = true;
      joinEl.hidden = false;
      setDressMode("change");
      showStep("dress");
      startPreview();
      refreshDress();
    }
    function wearDraft() {
      myLook = Object.assign({}, draft);
      me.look = myLook; // the acts read Cheeky from here
      scene.remove(me.av.root);
      me.av.dispose();
      me.av = FefeAvatar.build(T, myLook);
      me.av.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(me.av.root);
      poof(me.x, me.y, me.z);
      saveMe(false);
    }
    const BEDROOMS = [[13, 5, 18, 9], [27, 5, 31, 12], [38, 5, 42, 12], [54, 6, 60, 11]];
    const wardrobeBtn = $("wardrobe");
    function updateWardrobe() {
      const show = !!me && me.drop === 0 && !myPath.length && joinEl.hidden &&
        BEDROOMS.some((r) => me.x >= r[0] && me.x < r[2] + 1 && me.z >= r[1] && me.z < r[3] + 1);
      if (wardrobeBtn.hidden === show) wardrobeBtn.hidden = !show;
    }
    wardrobeBtn.addEventListener("click", openWardrobe);
    // Cheeky mode is opt-in per guest: only avatars whose owner switched it on join the adults-only gags.
    const cheekyIn = $("cheeky");
    cheekyIn.addEventListener("change", () => {
      if (draft) draft.cheeky = cheekyIn.checked;
      lsSet("fefe40.cheeky", cheekyIn.checked ? "1" : "0");
    });

    function refreshDress() {
      showSizes();
      outfitName.textContent = FefeAvatar.OUTFITS[draft.outfit].name;
      outfitCount.textContent = draft.outfit + 1 + " / " + FefeAvatar.OUTFITS.length;
      cheekyIn.checked = !!draft.cheeky;
      rebuildPreview();
    }
    let sizeSet = false;
    const hIn = $("h-in"), wtIn = $("wt-in"), hOut = $("h-out"), wtOut = $("wt-out");
    function showSizes() {
      const sh = FefeAvatar.bodyShape(draft);
      hIn.value = sh.h;
      wtIn.value = sh.wt;
      hOut.textContent = sh.h + " cm";
      wtOut.textContent = sh.wt + " kg";
    }
    [[hIn, "h"], [wtIn, "wt"]].forEach(([input, key]) => input.addEventListener("input", () => {
      if (!draft) return;
      draft[key] = +input.value;
      sizeSet = true;
      lsSet("fefe40.h", String(draft.h));
      lsSet("fefe40.wt", String(draft.wt));
      showSizes();
      if (pv && pv.av) FefeAvatar.reshape(pv.av, draft);
    }));
    const cycle = (n) => { const len = FefeAvatar.OUTFITS.length; draft.outfit = (draft.outfit + n + len) % len; refreshDress(); };
    $("prev").addEventListener("click", () => cycle(-1));
    $("next").addEventListener("click", () => cycle(1));
    $("back").addEventListener("click", () => {
      if (dressMode === "change") { closeJoin(); return; }
      stopPreview();
      showStep("photo");
      if (!photo) startCamera();
    });
    $("drop").addEventListener("click", () => {
      closeJoin();
      if (dressMode === "change") wearDraft();
      else enterParty();
    });

    let pv = null;
    function startPreview() {
      if (!pv) {
        const r = new T.WebGLRenderer({ canvas: previewCanvas, antialias: true, alpha: true });
        r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        const sc = new T.Scene();
        sc.add(new T.HemisphereLight(0xffffff, 0x51607a, 0.95));
        const dl = new T.DirectionalLight(0xffffff, 0.55);
        dl.position.set(2, 3, 4);
        sc.add(dl);
        const c = new T.PerspectiveCamera(28, 1, 0.1, 50);
        c.position.set(0, 1.5, 6.4);
        c.lookAt(0, 1.15, 0);
        pv = { r, sc, c, av: null, raf: 0, spin: 0 };
      }
      const size = previewCanvas.clientWidth || 240;
      pv.r.setSize(size, size, false);
      cancelAnimationFrame(pv.raf);
      let lastT = performance.now();
      const loop = (t) => {
        pv.spin += Math.min(0.05, (t - lastT) / 1000) * 0.9;
        lastT = t;
        if (pv.av) pv.av.root.rotation.y = reduceMotion ? 0 : Math.sin(pv.spin) * 0.9;
        pv.r.render(pv.sc, pv.c);
        pv.raf = requestAnimationFrame(loop);
      };
      pv.raf = requestAnimationFrame(loop);
    }
    function rebuildPreview() {
      if (!pv || !draft) return;
      if (pv.av) { pv.sc.remove(pv.av.root); pv.av.dispose(); }
      pv.av = FefeAvatar.build(T, draft);
      pv.av.setPose(0, false);
      pv.sc.add(pv.av.root);
    }
    function stopPreview() { if (pv) cancelAnimationFrame(pv.raf); }

    function enterParty() {
      if (me) removeActor(me);
      const open = SPAWN.filter(([x, z]) => reach[cellIdx(x, z)]);
      const [sx, sz] = open.length ? open[(Math.random() * open.length) | 0] : SPAWN[0];
      myLook = Object.assign({}, draft);
      me = makeActor(myName, myLook, true, myId);
      me.x = sx + 0.5;
      me.z = sz + 0.5;
      me.y = worldY(sx, sz);
      me.drop = 14;
      myPath = [];
      pendingWalk = null;
      startRecording(sx, sz);
      enterBtn.hidden = true;
      findBtn.hidden = false;
      voiceBtn.hidden = !voiceUI;
      uploadVoice(); // anything recorded that didn't make it up last time
      exitBtn.hidden = false;
      clearSelection();
      follow = true;
      goal.fit = 22;
      goal.target.set(me.x + OX, me.y + 0.9, me.z + OZ);
      clampTarget(goal.target);
      hint.textContent = coarse ? "Tap anywhere to walk there" : "Click anywhere to walk there";
      hint.classList.remove("gone");
      clearTimeout(hintTimer);
      hintTimer = setTimeout(dismissHint, 7000);
      updateGuestCount();
      saveMe(false); // replaces this device's earlier record, so the recorded walk starts over
    }
    // Leaving: your walk is saved and keeps looping for everyone else; tap Enter the party to come back as someone new.
    const exitBtn = $("exit");
    function exitParty() {
      if (!me) return;
      if (me.inCar) getOut();
      saveMe(false);
      store.leave(myId).catch(() => {});
      lastBeat = 0;
      lastBeatCell = "";
      poof(me.x, me.y, me.z);
      removeActor(me);
      me = null;
      myPath = [];
      pendingWalk = null;
      pendingCar = null;
      follow = false;
      enterBtn.hidden = false;
      findBtn.hidden = true;
      voiceBtn.hidden = true;
      exitBtn.hidden = true;
      wardrobeBtn.hidden = true;
      hint.textContent = coarse ? "Drag to explore · Pinch to zoom · Tap a place" : "Drag to explore · Scroll to zoom · Q / E to rotate · Click a place";
      updateGuestCount();
    }
    exitBtn.addEventListener("click", exitParty);
    // Invite: copy the party's link (never the ?npc test link) so it can be pasted to friends
    const INVITE_URL = "https://kareemmagill.github.io/fefe40/";
    function toast(msg, ms) {
      hint.textContent = msg;
      hint.classList.remove("gone");
      clearTimeout(hintTimer);
      hintTimer = setTimeout(dismissHint, ms || 6000);
    }
    function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
      return new Promise((resolve, reject) => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        ta.remove();
        if (ok) resolve(); else reject(new Error("copy"));
      });
    }
    $("invite").addEventListener("click", () => {
      copyText(INVITE_URL)
        .then(() => toast("Link copied! Paste it to whoever you want to invite to the party."))
        .catch(() => toast("Copy this link and send it to whoever you want to invite: " + INVITE_URL, 12000));
    });
    function findMe() {
      if (!me) return;
      follow = true;
      goal.fit = Math.min(goal.fit, 22);
      goal.target.set(me.x + OX, me.y + 0.9, me.z + OZ);
      clampTarget(goal.target);
    }
    findBtn.addEventListener("click", findMe);
    window.fefeDebug = { me: () => me && { x: me.x, z: me.z, y: me.y, drop: me.drop, walking: myPath.length > 0, nodes: rec ? rec.nodes.length : 0, dayNodes: recs && recs.day ? recs.day.nodes.length : 0, nightNodes: recs && recs.night ? recs.night.nodes.length : 0, outfit: myLook.outfit }, ghosts: () => ghosts.size, ghostPos: () => [...ghosts.values()].map((g) => [+g.actor.x.toFixed(2), +g.actor.z.toFixed(2), g.nodes.length, !!g.live, g.car ? (g.car.clone ? "copy" : "car") + g.car.idx : ""]), height: heightAt, reach: (x, z) => !!reach[cellIdx(x, z)],
      acts: () => actorList.map((a) => [a.name, party ? party.actOf(a) : null]),
      pick: (x, y) => { const h = pickVoxel(x, y); return h && [h.u / 2, h.v / 2, h.w / 2, h.group]; },
      dj: () => dj.on,
      screenOf: (x, y, z) => { const v = new T.Vector3(x + OX, y, z + OZ).project(cam), r = canvas.getBoundingClientRect(); return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]; },
      trees: () => TREES.map((t) => [t.x, t.z, t.palm, nearestReachable(Math.floor(t.x), Math.floor(t.z))]),
      speeds: () => actorList.map((a) => [a.name, a.speedMul || 1]),
      cars: () => carList.map((c) => [+c.x.toFixed(2), +c.z.toFixed(2), +c.h.toFixed(2), +c.speed.toFixed(2), c.dmg, c === drive.car, !!c.fogged, +c.g.rotation.z.toFixed(3), +c.g.position.y.toFixed(3)]),
      holds: () => actorList.map((a) => [a.name, a.av.holding(), !!a.hiddenAct]),
      goCar: (i) => goToCar(carList[i]),
      voice: () => ({ mine: Object.keys(myVoice).length, up: myVoiceUp.size, choir: choir.on, bufs: [...clipBufs.values()].filter((b) => b && b !== "wait").length }),
      sayAs: (i, cats) => { const a = [...ghosts.values()][i]; return !!a && voiceSay(a.actor, cats, a.actor.x, a.actor.z, 1); },
      carScreen: (i) => { const c = carList[i], v = new T.Vector3(c.x + OX, c.y + 1, c.z + OZ).project(cam), r = canvas.getBoundingClientRect(); return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]; },
      roots: () => actorList.map((a) => [a.name, +(a.av.root.position.x - OX).toFixed(2), +(a.av.root.position.z - OZ).toFixed(2), +(a.sepX || 0).toFixed(2)]),
      look(x, z, fit, y, az) { follow = false; goal.target.set(x + OX, y || 1, z + OZ); goal.fit = fit || 14; if (az !== undefined) goal.az = az; } };
    window.fefeDebug.tv = tvState;

    // ---------- per-frame updates ----------
    function updateCutaway(dt) {
      const tx = view.target.x - OX, tz = view.target.z - OZ;
      buildings.forEach((b, bid) => {
        const r = byId[bid] ? byId[bid].rect : CUT_RECTS[bid];
        const over = tx >= r[0] && tx <= r[2] + 1 && tz >= r[1] && tz <= r[3] + 1;
        const mine = me && me.drop === 0 && me.x >= r[0] && me.x <= r[2] + 1 && me.z >= r[1] && me.z <= r[3] + 1;
        const want = seeInside || mine || (selected && selected.b === bid) || (over && view.fit <= 30) ? 1 : 0;
        if (b.fade === want) return;
        b.fade = reduceMotion ? want : b.fade + Math.sign(want - b.fade) * Math.min(Math.abs(want - b.fade), dt * 3.2);
        const f = b.fade, vis = f < 0.999;
        b.roof.concat(b.upper).forEach((m) => {
          const kind = m.userData.kind;
          m.visible = vis;
          m.material.opacity = baseOpacity[kind] * (1 - f);
          m.material.transparent = kind !== "solid" || f > 0.001;
          m.castShadow = vis && f < 0.5 && (kind === "solid" || kind === "glass");
        });
        b.roof.forEach((m) => { m.position.y = f * 5; });
      });
    }

    const DANCE_COLORS = [C.blue, C.fefe, "#FFFFFF", "#2E9BFF"].map((c) => new T.Color(c));
    function paintDance(s) {
      if (!danceMesh) return;
      const rings = ((s / 16) | 0) % 2 === 1;
      danceCells.forEach(([x, z], i) => {
        const k = rings
          ? Math.max(Math.abs(x + 0.5 - DANCE_CENTER[0] * 2), Math.abs(z + 0.5 - DANCE_CENTER[1] * 2)) + s
          : x + z + s;
        danceMesh.setColorAt(i, DANCE_COLORS[((Math.floor(k) % 4) + 4) % 4]);
      });
      danceMesh.instanceColor.needsUpdate = true;
    }
    paintDance(0);

    let last = performance.now();
    let danceClock = 0;
    let danceStep = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // the build clock starts after the first frame (shader compiling) and never jumps more than 1/15 s per frame,
      // so a slow phone sees the whole show rather than skipping to the end
      if (building) {
        buildClock.value = buildFrames++ ? Math.max(0, buildClock.value) + Math.min(1 / 15, (now - buildLast) / 1000) : -1;
        buildLast = now;
        if (buildClock.value > BUILD_END) finishBuild();
      }
      updateParty(dt);
      const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 8);
      view.az += (goal.az - view.az) * k;
      view.fit = Math.exp(Math.log(view.fit) + (Math.log(goal.fit) - Math.log(view.fit)) * k);
      view.target.lerp(goal.target, k);
      if (drive.shake > 0) view.target.add(new T.Vector3((Math.random() - 0.5) * drive.shake, 0, (Math.random() - 0.5) * drive.shake));
      applyCamera();
      updateShadowView();
      updateSlice(dt);
      updateCutaway(dt);
      updateNightLights(dt, now / 1000);
      updateKaraoke(now / 1000);
      updateTV(now / 1000);
      if (snd && snd.enabled) {
        snd.setListener(me ? me.x : view.target.x - OX, me ? me.z : view.target.z - OZ, view.fit); // you hear from where your avatar is
        snd.setMusicArea(dj.on ? djArea(me ? me.x : view.target.x - OX, me ? me.z : view.target.z - OZ) : -1);
        snd.setMusicLevel(choir.on ? 0.45 : dj.on ? Math.max(0.65, Math.min(1, danceCrowd / 6)) : Math.min(1, danceCrowd / 6)); // under a singalong: the loop without its tune
        snd.update(dt);
      }
      updateFeed(now / 1000);
      if (!reduceMotion) {
        waterPlanes.forEach((m, i) => {
          m.material.map.offset.x += dt * (0.03 + i * 0.01);
          m.material.map.offset.y += dt * 0.018;
        });
        if (dj.on) disco.rotation.y += dt * (danceCrowd ? 2.4 : 1.6); // the ball spins while the DJ plays
      }
      danceClock += dt;
      const beat = reduceMotion ? 1.5 : danceCrowd ? 0.2 : 0.28;
      if (dj.on && danceClock > beat) { // and the floor lights up with it
        danceClock = 0;
        paintDance(++danceStep);
      }
      updateTags();
      renderer.render(scene, cam);
      requestAnimationFrame(frame);
    }

    function start(data) {
      data = data || {};
      if (typeof data.az === "number") {
        finishBuild();
        goal.az = view.az = data.az;
        goal.fit = view.fit = clampFit(data.fit || HOME.fit);
        goal.target.set(data.tx || 0, 1, data.tz || 0);
        view.target.copy(goal.target);
        if (data.night) setNight(true);
        if (data.inside) setInside(true);
        if (data.sel && byId[data.sel]) selectZone(data.sel);
        dismissHint();
      } else {
        const deep = (location.hash || "").slice(1);
        if (byId[deep]) selectZone(deep);
      }
      applyCamera();
      requestAnimationFrame(frame);
    }
    // Once the villa has landed: show the way in and start fetching the other guests, who then drop in too.
    let opened = false;
    function openParty() {
      if (opened) return;
      opened = true;
      showCars();
      enterBtn.hidden = false;
      if (/[?&]npc\b/.test(location.search)) addTestCrowd();
      if (store.shared) {
        syncGuests();
        setInterval(syncGuests, 15000);
        pollLive();
        setInterval(pollLive, 2000);
      }
    }
    function finishBuild() {
      building = false;
      buildClock.value = 1e4;
      openParty();
    }
    // tap, click or any key skips the build
    canvas.addEventListener("pointerdown", () => { if (building) finishBuild(); });
    window.addEventListener("keydown", () => { if (building) finishBuild(); });
    if (!building) openParty();
    const hot = window.claude && window.claude.hot;
    if (hot && typeof hot.snapshot === "function") {
      hot.snapshot(() => ({ az: goal.az, fit: goal.fit, tx: goal.target.x, tz: goal.target.z, night, inside: seeInside, sel: selected ? selected.id : null }));
    }
    if (hot && typeof hot.ready === "function") hot.ready(start);
    else start((hot && hot.data) || {});
  }
})();
