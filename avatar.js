/* FEFE40 avatars, prototype B "chunky human": the same blocky party people rebuilt at twice the voxel resolution on every
   axis (64 voxels tall instead of 32 skin pixels, so 8x the voxels), with a neck, shoulders, hands and shoes, slimmer
   limbs, a rounded voxel head with ears and a nose, and a sharp photo face of up to 96x96 texels.

   Drop-in for avatar.js: window.FefeAvatar = { OUTFITS, build(THREE, look), P, bodyShape, HEIGHT, WEIGHT, reshape }.
   Pivots, pose semantics, props (hold R/L/head/body), hats, moustache() and setPose() are unchanged; hats, props and poses
   still use old skin pixels (P metres), a voxel is half of one.
   Extras: faceFromImage(img, box, opts), decodeFace(str), FACE_N, FACE_MAX, V (metres per voxel).

   look = { body: "m" | "f", outfit, skin: "#rrggbb", hair: "#rrggbb", face, faceL, faceR, faceT, h, wt }
   face / faceL / faceR / faceT may each be
     - a face string from faceFromImage(): "J:" + base64 JPEG or "W:" + base64 WebP (<= 4200 characters), decoded
       asynchronously (the head shows skin with a drawn face for the few milliseconds until it is ready),
     - an old raw RGB Uint8Array (32x32 or 16x16, as avatar.js takes), used as is,
     - null (NPCs): a drawn pixel face. */
(function () {
  const P = 2.2 / 32; // metres per old skin pixel: avatars stand 2.2 m tall
  const V = P / 2; // metres per voxel: twice the resolution on every axis
  const TX = 2; // atlas texels per voxel face (enough for per-corner shading and for 32x32 head scans on 16 voxels)
  const AW = 256; // atlas width in texels
  const FACE_N = 96; // photo face texels across the 16-voxel head front (6 per voxel)
  const FACE_MAX = 4200; // longest face string the Firebase rule allows

  const SB = "#006AA7", SY = "#FECC02", FE = "#FEFE40", WHITE = "#F4F4F0", BLACK = "#1E1F24", NAVY = "#17325E";
  const RED = "#C8302C", GOLD = "#E8C547", BROWN = "#6B4423", GREEN = "#2E8B3A", GREY = "#8A8F96", PINK = "#FF6FB5";

  function noise(x, y, s) {
    let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  // tiny pixel stamps
  const CROWN = ["#.#", "###"];
  const DIGIT = { 4: ["#.#", "#.#", "###", "..#", "..#"], 0: ["###", "#.#", "#.#", "#.#", "###"] };
  const stamp = (x, y, x0, y0, pat) => (pat[y - y0] || "")[x - x0] === "#";
  const number40 = (x, y) => stamp(x, y, 1, 3, DIGIT[4]) || stamp(x, y, 4, 3, DIGIT[0]);

  // Each outfit paints the torso (shirt), arms (sleeve) and legs (leg) pixel by pixel; null means bare skin.
  // side is front | back | left | right | top | bottom; x, y count skin pixels from the face's top-left.
  // hat(add) and extras(add) place small blocks on the head or the body; skirt adds a skirt around the legs.
  const OUTFITS = [
    {
      name: "Tre Kronor jersey",
      shirt: (x, y, side) => {
        if (side === "top" || side === "bottom") return SB;
        if (y >= 10) return SB;
        if (side === "front") {
          if (y === 0 && (x === 3 || x === 4)) return SB;
          if (stamp(x, y, 0, 3, CROWN) || stamp(x, y, 5, 3, CROWN) || stamp(x, y, 2, 6, CROWN)) return SB;
        }
        if (side === "back" && number40(x, y)) return SB;
        return SY;
      },
      sleeve: (x, y, side) => (side === "top" ? SB : y >= 9 ? null : y === 6 || y === 7 ? SB : SY),
      leg: (x, y, side) => (side === "bottom" || y >= 11 ? BLACK : SB)
    },
    {
      name: "Blågult football kit",
      shirt: (x, y, side) => {
        if (side === "top" || side === "bottom") return SY;
        if (side === "front" && y === 0 && x >= 2 && x <= 5) return SB;
        if (side === "back" && number40(x, y)) return SB;
        return SY;
      },
      sleeve: (x, y, side) => (side === "top" ? SY : y <= 3 ? (y === 3 ? SB : SY) : null),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? BLACK : y <= 4 ? SB : y <= 6 ? null : SY)
    },
    {
      name: "Viking raider",
      shirt: (x, y, side) => {
        if (y === 9) return side === "front" && (x === 3 || x === 4) ? GOLD : "#3B2616";
        const fur = noise(x, y, 7) < 0.5 ? "#C8B38A" : "#A8906A";
        if (side === "front") return x <= 1 || x >= 6 ? (x === 1 || x === 6 ? BROWN : fur) : "#7A2A1E";
        if (side === "back") return y < 9 ? fur : "#7A2A1E";
        return side === "top" ? fur : BROWN;
      },
      sleeve: (x, y, side) => (side === "top" || y <= 1 ? "#7A2A1E" : y >= 6 && y <= 8 ? "#4A3020" : null),
      leg: (x, y, side) => (side === "bottom" || y >= 11 ? "#2E2016" : y >= 6 && (x + y) % 2 === 0 ? "#8C7A5E" : "#5A4632"),
      hat: (add) => {
        add(-4.5, 5, -4.5, 9, 3.5, 9, "#8E949C");
        add(-4.7, 5, -4.7, 9.4, 1, 9.4, "#6C7178");
        add(-0.5, 2.6, 4.2, 1, 2.8, 0.6, "#8E949C");
        [1, -1].forEach((s) => {
          const x = (v, w) => (s > 0 ? v : -v - w);
          add(x(4.5, 2), 6, -1, 2, 1.5, 2, "#EDE3C8");
          add(x(6, 1.5), 7, -0.8, 1.5, 3, 1.5, "#EDE3C8");
          add(x(6.3, 1), 10, -0.5, 1, 1.5, 1, "#EDE3C8");
        });
      }
    },
    {
      name: "Midsommar dress",
      shirt: (x, y, side) => (noise(x, y, side.length) < 0.16 ? [PINK, SY, SB][(noise(y, x, 3) * 3) | 0] : WHITE),
      sleeve: (x, y, side) => (side === "top" || y <= 3 ? WHITE : null),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? WHITE : null),
      skirt: { len: 7, flare: 1, fn: (x, y) => (noise(x, y, 11) < 0.18 ? [PINK, SY, SB][(noise(y, x, 5) * 3) | 0] : WHITE) },
      hat: (add) => {
        add(-4.6, 6.5, -4.6, 9.2, 1, 9.2, GREEN);
        const cols = [PINK, SY, WHITE, SB, RED];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          add(Math.cos(a) * 4.6 - 0.7, 7.2, Math.sin(a) * 4.6 - 0.7, 1.4, 1.2, 1.4, cols[i % cols.length]);
        }
      }
    },
    {
      name: "Lucia gown",
      shirt: (x, y, side) => (y === 8 || y === 9 ? RED : WHITE),
      sleeve: (x, y, side) => (side !== "top" && y >= 10 ? null : WHITE),
      leg: () => WHITE,
      skirt: { len: 11, flare: 1, fn: (x, y) => (y === 0 ? RED : WHITE) },
      hat: (add) => {
        add(-4.8, 7, -4.8, 9.6, 1.5, 9.6, GREEN);
        [[-3, -3], [0, -3.4], [3, -3], [-3.4, 1], [3.4, 1], [0, 3]].forEach(([x, z]) => {
          add(x - 0.5, 8.5, z - 0.5, 1, 3, 1, WHITE);
          add(x - 0.4, 11.5, z - 0.4, 0.8, 1.2, 0.8, "#FFD95A", true);
        });
      }
    },
    {
      name: "Kräftskiva bib",
      shirt: (x, y, side) => {
        if (side === "front" && x >= 1 && x <= 6 && y >= 1 && y <= 10) {
          const craw = stamp(x, y, 2, 3, ["#..#", "####", ".##.", "####", ".##."]);
          return craw ? RED : WHITE;
        }
        return SB;
      },
      sleeve: (x, y, side) => (side !== "top" && y >= 10 ? null : SB),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? BROWN : "#C8B48A"),
      hat: (add) => {
        add(-3, 8, -3, 6, 1.5, 6, SY);
        add(-2.2, 9.5, -2.2, 4.4, 1.5, 4.4, SB);
        add(-1.4, 11, -1.4, 2.8, 1.5, 2.8, SY);
        add(-0.6, 12.5, -0.6, 1.2, 1.5, 1.2, SB);
      }
    },
    {
      name: "Dala horse sweater",
      shirt: (x, y, side) => {
        if (side === "front" || side === "back") {
          if (y === 2 || y === 9) return SY;
          if (y >= 4 && y <= 7) return [SY, SB, GREEN, WHITE][(x + (y % 2) * 2) % 4];
        }
        return RED;
      },
      sleeve: (x, y, side) => (side !== "top" && y >= 10 ? null : y === 9 ? SY : RED),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? BLACK : NAVY)
    },
    {
      name: "Folkdräkt",
      shirt: (x, y, side) => {
        if (side === "front" && x >= 1 && x <= 6 && y >= 2) return (x === 3 || x === 4) && y % 2 === 0 ? BLACK : RED;
        if (side === "back" && y >= 2) return RED;
        return WHITE;
      },
      sleeve: (x, y, side) => (side !== "top" && y >= 10 ? null : WHITE),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? BLACK : WHITE),
      skirt: { len: 9, flare: 1, fn: (x, y) => (x >= 3 && x <= 6 ? (y % 3 === 0 ? SB : SY) : SB) },
      hat: (add) => {
        add(-4.5, 5, -4.6, 9, 3.6, 7.6, WHITE);
        add(-4.7, 2.5, 1.5, 0.4, 2.5, 1, RED);
        add(4.3, 2.5, 1.5, 0.4, 2.5, 1, RED);
      }
    },
    {
      name: "Flag cape",
      shirt: (x, y, side) => (side === "front" && (x === 2 || x === 3 || y === 5 || y === 6) ? SY : SB),
      sleeve: (x, y, side) => (side !== "top" && y >= 10 ? null : SB),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? WHITE : noise(x, y, 2) < 0.2 ? "#4A6D9C" : "#3B5D8C"),
      extras: (add) => {
        add(-4, 10.5, -2.8, 8, 13.5, 0.6, SB);
        add(-4, 16.5, -2.95, 8, 1.8, 0.16, SY);
        add(-1.8, 10.5, -2.95, 1.8, 13.5, 0.16, SY);
      }
    },
    {
      name: "Eurovision glam",
      shirt: (x, y) => (noise(x, y, 21) < 0.25 ? "#FFF6C8" : GOLD),
      sleeve: (x, y, side) => (side !== "top" && y >= 11 ? null : noise(x, y, 22) < 0.25 ? "#FFF6C8" : GOLD),
      leg: (x, y, side) => (side === "bottom" || y >= 10 ? "#C9CED6" : noise(x, y, 23) < 0.25 ? "#FFF6C8" : GOLD),
      extras: (add) => {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          add(Math.cos(a) * 3.8 - 1, 22.6, Math.sin(a) * 2.4 - 1, 2, 1.8, 2, i % 2 ? PINK : "#FF9BD0");
        }
      }
    },
    {
      name: "Fika barista",
      shirt: (x, y, side) => {
        if (side === "front" && x >= 1 && x <= 6 && y >= 3) return y === 7 && x >= 2 && x <= 5 ? "#0B4F82" : SB;
        if (side === "back" && (x === 1 || x === 6) && y <= 6) return SB;
        return WHITE;
      },
      sleeve: (x, y, side) => (side === "top" || y <= 5 ? WHITE : null),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? BROWN : BLACK),
      held: (add) => {
        add(-1.6, -12.2, 1.2, 3.2, 1.6, 3.2, "#B8743A");
        add(-1, -10.8, 1.8, 2, 0.4, 2, "#E8C9A0");
      }
    },
    {
      name: "Archipelago sailor",
      shirt: (x, y, side) => (side === "top" ? SB : side === "front" && y <= 1 && x >= 2 && x <= 5 ? SB : y % 2 === 1 ? SB : WHITE),
      sleeve: (x, y, side) => (side !== "top" && y >= 10 ? null : side === "top" ? SB : y % 2 === 1 ? SB : WHITE),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? NAVY : WHITE),
      hat: (add) => {
        add(-4.4, 7.6, -4.4, 8.8, 1.3, 8.8, WHITE);
        add(-4.5, 7.4, -4.5, 9, 0.6, 9, SB);
        add(-2.6, 7.4, 4.2, 5.2, 0.4, 1.4, BLACK);
      }
    },
    {
      name: "Lapland parka",
      shirt: (x, y, side) => {
        if (y === 11 || side === "top") return WHITE;
        if (side === "front" && (x === 3 || x === 4)) return SY;
        return SB;
      },
      sleeve: (x, y, side) => (side !== "top" && y >= 11 ? null : y === 10 ? WHITE : SB),
      leg: (x, y, side) => (side === "bottom" || y >= 9 ? "#6B4A2A" : "#3A3F4A"),
      hat: (add) => {
        add(-4.5, 5.5, -4.5, 9, 3, 9, SY);
        add(-4.6, 5.5, -4.6, 9.2, 1, 9.2, SB);
        add(-1, 8.5, -1, 2, 2, 2, WHITE);
      }
    },
    {
      name: "Odd socks",
      shirt: (x, y, side) => (noise(x >> 1, y >> 1, 31) < 0.2 ? [RED, GREEN, SB][(noise(y, x, 9) * 3) | 0] : SY),
      sleeve: (x, y, side) => (side !== "top" && y >= 9 ? null : SY),
      leg: (x, y, side, i) => (side === "bottom" || y === 11 ? BLACK : y <= 1 ? null : i ? (y % 2 ? BLACK : WHITE) : "#8B5A2B"),
      skirt: { len: 4, flare: 1, fn: () => SB },
      hat: (add) => {
        [1, -1].forEach((s) => {
          add(s > 0 ? 4 : -8, 2.5, -1, 4, 1.4, 1.4, "#C4541C");
          add(s > 0 ? 7.2 : -8.4, 2.3, -1.2, 1.2, 1.8, 1.8, GREEN);
        });
      }
    },
    {
      name: "Nobel gala",
      shirt: (x, y, side) => {
        if (side === "front") {
          if (y === 1 && x >= 2 && x <= 5) return BLACK;
          if ((x === 3 || x === 4) && y >= 1) return y % 3 === 0 && y > 1 ? BLACK : WHITE;
          if (x - y === 1 || x - y === 2) return y % 4 === 0 ? SY : SB;
        }
        return BLACK;
      },
      sleeve: (x, y, side) => (side !== "top" && y >= 10 ? (y === 10 ? WHITE : null) : BLACK),
      leg: () => BLACK
    },
    {
      name: "Moose hoodie",
      shirt: (x, y, side) => {
        if (side === "front" && y >= 7 && y <= 10 && x >= 1 && x <= 6) return "#5E3F26";
        if (side === "front" && y <= 3 && (x === 3 || x === 4)) return WHITE;
        return "#7A5334";
      },
      sleeve: (x, y, side) => (side !== "top" && y >= 11 ? null : "#7A5334"),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? WHITE : GREY),
      hat: (add) => {
        add(-4.5, 0, -4.9, 9, 8.6, 1, "#7A5334");
        [1, -1].forEach((s) => {
          const x = (v, w) => (s > 0 ? v : -v - w);
          const tan = "#C9A66B";
          add(x(3, 1), 8, -0.5, 1, 1, 1, tan);
          add(x(3.5, 4), 9, -0.5, 4, 1, 1, tan);
          add(x(5, 1), 10, -0.5, 1, 2, 1, tan);
          add(x(6.5, 1), 10, -0.5, 1, 3, 1, tan);
        });
      }
    },
    {
      name: "Tennis legend",
      shirt: (x, y, side) => (side !== "top" && y === 3 ? SB : side !== "top" && y === 4 ? SY : WHITE),
      sleeve: (x, y, side) => (side === "top" || y <= 3 ? WHITE : null),
      leg: (x, y, side) => (side === "bottom" || y >= 10 ? WHITE : y <= 4 ? WHITE : null),
      hat: (add) => {
        add(-4.3, 5.5, -4.3, 8.6, 1, 8.6, SB);
        add(-4.35, 6.0, -4.35, 8.7, 0.35, 8.7, SY);
      }
    },
    {
      name: "Smörgåsbord chef",
      shirt: (x, y, side) => {
        if (side === "front" && y <= 1 && x >= 2 && x <= 5) return RED;
        if (side === "front" && (x === 2 || x === 5) && y >= 3 && y % 2 === 1) return BLACK;
        return WHITE;
      },
      sleeve: (x, y, side) => (side !== "top" && y >= 10 ? null : WHITE),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? BLACK : (x + y) % 2 ? BLACK : WHITE),
      hat: (add) => {
        add(-3.5, 8, -3.5, 7, 5, 7, WHITE);
        add(-4.5, 12, -4.5, 9, 2.5, 9, WHITE);
      }
    },
    {
      name: "Princess cake",
      shirt: (x, y, side) => {
        if (side === "front" && stamp(x, y, 3, 2, [".#.", "###", ".#."])) return PINK;
        if (side === "front" && x === 4 && y === 5) return GREEN;
        return noise(x, y, 41) < 0.12 ? WHITE : "#9BD48A";
      },
      sleeve: (x, y, side) => (side !== "top" && y >= 10 ? null : "#9BD48A"),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? PINK : WHITE),
      skirt: { len: 5, flare: 1, fn: (x, y) => (y === 4 ? WHITE : "#9BD48A") },
      hat: (add) => {
        add(-3, 8, 2, 6, 0.8, 0.8, GOLD);
        add(-0.5, 8.8, 2.1, 1, 1.2, 0.6, GOLD);
        add(-2.5, 8.8, 2.1, 0.8, 0.8, 0.6, GOLD);
        add(1.7, 8.8, 2.1, 0.8, 0.8, 0.6, GOLD);
        add(-0.3, 9.2, 2.6, 0.6, 0.6, 0.3, PINK, true);
      }
    },
    {
      name: "Blue & yellow tracksuit",
      shirt: (x, y, side) => (side === "front" && (x === 3 || x === 4) ? (y <= 1 ? SY : WHITE) : SB),
      sleeve: (x, y, side, arm, w) => (side !== "top" && y >= 11 ? null : (side === "left" || side === "right") && x === 1 ? SY : SB),
      leg: (x, y, side) => (side === "bottom" || y === 11 ? WHITE : (side === "left" || side === "right") && x === 1 ? SY : SB)
    }
  ];

  // Props for hands (arm-local: the hand is around y = -10, front is +z) and heads (head-local: face at z = +4, eyes near y = 4.5).
  const PROPS = {
    glass: (add) => { add(-1, -13.5, 1, 2, 3, 2, "#E8F6FF"); add(-0.8, -13.3, 1.2, 1.6, 2.2, 1.6, "#F2B233"); add(-0.8, -11.1, 1.2, 1.6, 0.5, 1.6, "#FFFFFF"); },
    horn: (add) => { add(-0.9, -14, 1, 1.8, 4, 1.8, "#EDE3C8"); add(-0.6, -16, 1.2, 1.2, 2, 1.2, "#EDE3C8"); add(-1, -10.4, 0.9, 2, 0.5, 2, GOLD); },
    mic: (add) => { add(-0.5, -14, 1.5, 1, 4, 1, "#23252B"); add(-0.9, -15.5, 1.1, 1.8, 1.6, 1.8, "#A9B0B8"); },
    paddle: (add) => { add(-0.4, -13, 0.6, 0.8, 3, 0.8, "#6B4423"); add(-2, -19, 0.2, 4, 6, 1, SB); },
    paper: (add) => { add(-5, -16, 2.6, 10, 7, 0.3, "#EDEDE8"); for (let i = 0; i < 4; i++) add(-4, -14.5 - i * 1.3, 2.95, 8, 0.4, 0.05, "#6A6A6A"); },
    phone: (add) => { add(-0.8, -13.6, 1.6, 1.6, 2.8, 0.4, "#23252B"); add(-0.6, -13.4, 2.05, 1.2, 2.4, 0.1, "#7FD8FF", true); },
    plate: (add) => { add(-2.5, -10.6, -0.5, 5, 0.4, 5, "#F7F7F4"); add(-1.2, -10.2, 0.7, 2.4, 0.9, 2.4, "#F2A33A"); },
    snus: (add) => { add(-1.1, -11.4, 0.9, 2.2, 0.9, 2.2, "#1F3C88"); add(-1.2, -10.6, 0.8, 2.4, 0.3, 2.4, "#E8E8E8"); },
    // after the shower: a towel round the waist (on the torso) and one wrapped round the head
    towel: (add) => { add(-4.7, -3.6, -2.7, 9.4, 6, 5.4, "#FFFFFF"); add(-4.8, -1.8, -2.8, 9.6, 0.8, 5.6, "#2F6FD1"); add(-4.8, 0.2, -2.8, 9.6, 0.5, 5.6, "#FEFE40"); },
    turban: (add) => { add(-4.5, 6.2, -4.5, 9, 3.2, 9, "#FFFFFF"); add(-1.6, 9.3, -1.6, 3.2, 1.6, 3.2, "#F4F4F4"); },
    pouch: (add) => { add(-0.6, -11.3, 0.4, 1.2, 0.4, 1.8, "#F4F4F0"); },
    cig: (add) => { add(-0.2, -10.6, 2, 0.4, 0.4, 3, "#FFFFFF"); add(-0.25, -10.65, 5, 0.5, 0.5, 0.5, "#FF5A36", true); },
    pillow: (add) => { add(-3, -16, 0, 6, 4, 3, "#FFFFFF"); },
    cue: (add) => { add(-0.3, -11, -10, 0.6, 0.6, 22, "#C79560"); add(-0.35, -11.05, 11.5, 0.7, 0.7, 0.6, "#E8F6FF"); },
    lipstick: (add) => { add(-0.3, -12.5, 1.5, 0.6, 2.2, 0.6, "#C8302C"); },
    controller: (add) => { add(-1.6, -11.2, 1.2, 3.2, 1, 2, "#23252B"); add(-1, -10.4, 1.6, 0.5, 0.3, 0.5, RED, true); },
    popcorn: (add) => { add(-1.5, -13.4, 0.5, 3, 3, 3, RED); add(-1.3, -10.6, 0.7, 2.6, 0.9, 2.6, "#FFF6E0"); },
    shoes: (add) => { add(-1.2, -12.6, 0, 1.2, 1.2, 3, "#23252B"); add(0.2, -12.6, 0, 1.2, 1.2, 3, "#23252B"); },
    bottle: (add) => { add(-0.8, -15, 0.8, 1.6, 4.4, 1.6, "#2E7D32"); add(-0.4, -16.6, 1.2, 0.8, 1.6, 0.8, "#2E7D32"); },
    cup: (add) => { add(-1, -12.2, 1, 2, 2, 2, "#FFFFFF"); add(-0.8, -10.3, 1.2, 1.6, 0.2, 1.6, "#6B4423"); },
    bun: (add) => { add(-1.3, -11.8, 1.1, 2.6, 1.2, 2.6, "#B8743A"); add(-0.8, -10.7, 1.6, 1.6, 0.3, 1.6, "#E8C9A0"); },
    cards: (add) => { add(-1.6, -11, 1.6, 3.2, 0.3, 2.2, "#FFFFFF"); add(-1, -10.8, 2, 0.8, 0.2, 1, RED); },
    shades: (add) => { add(-4.3, 4.1, 4.05, 8.6, 1.5, 0.6, "#111114"); add(-4.4, 4.9, -2, 0.4, 0.4, 6, "#111114"); add(4, 4.9, -2, 0.4, 0.4, 6, "#111114"); },
    icepack: (add) => { add(-2.6, 8, -2.2, 5.2, 1.3, 4.4, "#9FD3F0"); },
    messy: (add, look) => { add(-3.5, 8, -2, 2, 2, 2, look.hair); add(1, 8, 0.5, 2.5, 1.5, 2, look.hair); add(3.5, 6, -3, 1.5, 2, 2, look.hair); add(-4.8, 5.5, 1, 1.5, 1.5, 1.5, look.hair); }
  };

  // ---------- colours ----------
  const hexCache = new Map();
  function hexInt(c, d) {
    if (typeof c === "number") return c;
    if (typeof c !== "string") return d;
    let v = hexCache.get(c);
    if (v === undefined) {
      v = /^#[0-9a-fA-F]{6}$/.test(c) ? parseInt(c.slice(1), 16) : d;
      hexCache.set(c, v);
    }
    return v === undefined ? d : v;
  }
  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
  const shade = (c, k) => (clamp255(((c >> 16) & 255) * k) << 16) | (clamp255(((c >> 8) & 255) * k) << 8) | clamp255((c & 255) * k);
  const mix = (a, b, t) =>
    (clamp255(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t) << 16) |
    (clamp255(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t) << 8) |
    clamp255((a & 255) * (1 - t) + (b & 255) * t);
  const toHex = (c) => "#" + (c & 0xffffff).toString(16).padStart(6, "0");

  // ---------- voxel grids ----------
  // Voxel kinds. What colour a face gets is up to the part's painter; the kind says what the voxel is made of.
  const SKIN = 1, CLOTH = 2, SHOE = 3, SOLE = 4, HAIR = 5, EAR = 6, NOSE = 7, NECK = 8, HAND = 9, SKIRT = 10;
  const DIRS = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]; // +x -x +y -y +z -z
  const SIDES = ["left", "right", "top", "bottom", "front", "back"]; // the old skin's names for those faces

  // A part's voxels: a box from (x0, y0, z0) to (x1, y1, z1), in voxels from the part's pivot.
  function Grid(x0, y0, z0, x1, y1, z1) {
    this.o = [x0, y0, z0];
    this.n = [Math.round(x1 - x0), Math.round(y1 - y0), Math.round(z1 - z0)];
    this.k = new Uint8Array(this.n[0] * this.n[1] * this.n[2]);
  }
  Grid.prototype.at = function (i, j, k) {
    const n = this.n;
    return i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2] ? 0 : this.k[(k * n[1] + j) * n[0] + i];
  };
  Grid.prototype.box = function (x0, y0, z0, x1, y1, z1, kind, only) {
    const o = this.o, n = this.n;
    for (let k = Math.max(0, Math.round(z0 - o[2])); k < Math.min(n[2], Math.round(z1 - o[2])); k++)
      for (let j = Math.max(0, Math.round(y0 - o[1])); j < Math.min(n[1], Math.round(y1 - o[1])); j++)
        for (let i = Math.max(0, Math.round(x0 - o[0])); i < Math.min(n[0], Math.round(x1 - o[0])); i++) {
          const at = (k * n[1] + j) * n[0] + i;
          if (!only || only(this.k[at], i + o[0] + 0.5, j + o[1] + 0.5, k + o[2] + 0.5)) this.k[at] = kind;
        }
  };

  // Greedy meshing: exposed faces merge into rectangles per direction and slice, whatever their colour, because colour
  // comes from the atlas. Photo faces (the head front) merge separately and get projected UVs instead of atlas patches.
  function greedy(g, photo) {
    const n = g.n, out = [], c3 = [0, 0, 0], ctr = [0, 0, 0];
    for (let d = 0; d < 6; d++) {
      const a = DIRS[d][0], s = DIRS[d][1], u = (a + 1) % 3, v = (a + 2) % 3;
      const nu = n[u], nv = n[v], mask = new Uint8Array(nu * nv);
      for (let c = 0; c < n[a]; c++) {
        let any = false;
        for (let q = 0; q < nv; q++) for (let p = 0; p < nu; p++) {
          c3[a] = c; c3[u] = p; c3[v] = q;
          const kind = g.at(c3[0], c3[1], c3[2]);
          let m = 0;
          if (kind) {
            c3[a] = c + s;
            if (!g.at(c3[0], c3[1], c3[2])) {
              c3[a] = c;
              for (let t = 0; t < 3; t++) ctr[t] = g.o[t] + c3[t] + 0.5;
              m = photo && photo(kind, ctr, d) ? 2 : 1;
              any = true;
            }
          }
          mask[q * nu + p] = m;
        }
        if (!any) continue;
        for (let q = 0; q < nv; q++) for (let p = 0; p < nu; ) {
          const m = mask[q * nu + p];
          if (!m) { p++; continue; }
          let w = 1;
          while (p + w < nu && mask[q * nu + p + w] === m) w++;
          let h = 1;
          grow: while (q + h < nv) {
            for (let t = 0; t < w; t++) if (mask[(q + h) * nu + p + t] !== m) break grow;
            h++;
          }
          for (let y = 0; y < h; y++) mask.fill(0, (q + y) * nu + p, (q + y) * nu + p + w);
          out.push({ g, d, a, s, u, v, c, p, q, w, h, photo: m === 2 });
          p += w;
        }
      }
    }
    return out;
  }

  // Ambient occlusion per face corner, Minecraft style: 3 = open, 0 = tucked into a corner.
  const AO = [0.66, 0.79, 0.9, 1];
  function cornerAO(g, air, a, u, v, su, sv) {
    const x = air.slice();
    x[u] += su;
    const s1 = g.at(x[0], x[1], x[2]) ? 1 : 0;
    x[u] -= su; x[v] += sv;
    const s2 = g.at(x[0], x[1], x[2]) ? 1 : 0;
    x[u] += su;
    const cn = g.at(x[0], x[1], x[2]) ? 1 : 0;
    return s1 && s2 ? 0 : 3 - s1 - s2 - cn;
  }

  // Which side of the old skin a voxel face shows. Faces on steps (a chest wider than the waist, the top of a toe cap)
  // take the side the voxel sits nearest to, so they match the faces around them.
  function sideOf(d, c, b) {
    if ((d === 2 && c[1] + 0.5 < b[3] - 0.01) || (d === 3 && c[1] - 0.5 > b[2] + 0.01)) {
      const nx = (c[0] - (b[0] + b[1]) / 2) / ((b[1] - b[0]) / 2), nz = (c[2] - (b[4] + b[5]) / 2) / ((b[5] - b[4]) / 2);
      return Math.abs(nx) > Math.abs(nz) ? (nx > 0 ? "left" : "right") : nz > 0 ? "front" : "back";
    }
    return SIDES[d];
  }
  // The old skin pixel under a voxel centre: the part's nominal box b = [x0, x1, y0, y1, z0, z1] (voxels) stands for the old
  // box of ow x oh x od skin pixels, so each old pixel covers about 2x2 voxel faces. Returns [x, y, face width].
  const cl = (v, n) => (v <= 0 ? 0 : v >= 1 ? n - 1 : Math.floor(v * n));
  function oldPx(side, c, b, ow, oh, od) {
    const fx = (c[0] - b[0]) / (b[1] - b[0]), fy = (b[3] - c[1]) / (b[3] - b[2]), fz = (c[2] - b[4]) / (b[5] - b[4]);
    switch (side) {
      case "front": return [cl(fx, ow), cl(fy, oh), ow];
      case "back": return [cl(1 - fx, ow), cl(fy, oh), ow];
      case "left": return [cl(1 - fz, od), cl(fy, oh), od];
      case "right": return [cl(fz, od), cl(fy, oh), od];
      case "top": return [cl(fx, ow), cl(fz, od), ow];
      default: return [cl(fx, ow), cl(1 - fz, od), ow];
    }
  }
  const HEM = 0.84; // cloth just above bare skin (sleeve ends, shorts) and the shirt's hem get a little darker

  // ---------- body parts ----------
  // Every part keeps the old pivot: legs at the hips (y 24 voxels), arms at the shoulders (44), head at the neck (48).
  function legSpec(outfit, i, sk) {
    const g = new Grid(-3, -24, -3, 3, 2, 5);
    g.box(-3, -22, -3, 3, 2, 3, CLOTH); // slimmer legs, running up into the hips
    g.box(-3, -23, -3, 3, -22, 5, SHOE); // shoes with a toe cap
    g.box(-3, -24, -3, 3, -23, 5, SOLE);
    g.box(-3, -23, 4, 3, -22, 5, 0);
    const b = [-3, 3, -24, 0, -3, 3];
    const colAt = (c, side) => {
      if (outfit.legHD) { const [x, y] = oldPx(side, c, b, 6, 24, 6); return outfit.legHD(x, y, side, i); } // full voxel detail
      const [x, y] = oldPx(side, c, b, 4, 12, 4);
      return outfit.leg(x, y, side, i);
    };
    return {
      g,
      paint(kind, c, d) {
        const side = sideOf(d, c, b);
        const col = hexInt(colAt(c, side), sk);
        if (kind === SOLE) return shade(col, 0.7);
        if (kind === CLOTH && d !== 2 && d !== 3 && c[1] > -22 && colAt(c, side) && !colAt([c[0], c[1] - 1, c[2]], side)) return shade(col, HEM);
        return col;
      }
    };
  }

  function armSpec(outfit, i, slim, sk) {
    const hw = slim ? 2.5 : 3, hh = slim ? 1.5 : 2, ow = slim ? 3 : 4;
    const g = new Grid(-hw - 1, -20, -3, hw + 1, 2, 3);
    g.box(-hw, -16, -3, hw, 1, 3, CLOTH);
    g.box(-hw + 1, 1, -2, hw - 1, 2, 2, CLOTH); // rounded shoulder
    if (i === 0) g.box(hw, -3, -2, hw + 1, 1, 2, CLOTH); // the top of the arm meets the shoulder, so arms don't float
    else g.box(-hw - 1, -3, -2, -hw, 1, 2, CLOTH);
    g.box(-hh, -20, -2, hh, -16, 2, HAND);
    if (i === 0) g.box(hh, -19, 0, hh + 1, -17, 2, HAND); // thumbs on the inside, pointing forward
    else g.box(-hh - 1, -19, 0, -hh, -17, 2, HAND);
    const b = [-hw, hw, -20, 2, -3, 3];
    // the sleeve's 11 old rows run from the shoulder to the wrist, the old bottom row is the hand
    const colAt = (c, side, hand) => {
      if (outfit.sleeveHD) { // full voxel detail: rows 0 (shoulder) to 21, the hand in rows 18 to 21
        const [x, , w] = oldPx(side, c, b, 2 * hw, 22, 6);
        const y = side === "top" ? 0 : side === "bottom" ? 21 : Math.max(0, Math.min(21, Math.floor(2 - c[1])));
        return outfit.sleeveHD(x, y, side, i, w, !!hand, slim);
      }
      const [x, , w] = oldPx(side, c, b, ow, 12, 4);
      const y = hand ? 11 : side === "top" ? 0 : side === "bottom" ? 3 : Math.max(0, Math.min(10, Math.floor(((2 - c[1]) / 18) * 11)));
      return outfit.sleeve(x, y, side, i, w);
    };
    return {
      g,
      paint(kind, c, d) {
        let side = sideOf(d, c, b);
        if (kind === HAND && (side === "top" || side === "bottom")) side = d === 3 ? "bottom" : c[2] > 1 ? "front" : "left";
        const raw = colAt(c, side, kind === HAND);
        const col = hexInt(raw, sk);
        if (kind === CLOTH && raw && d !== 2 && d !== 3 && (c[1] < -15 || !colAt([c[0], c[1] - 1, c[2]], side, false))) return shade(col, HEM);
        return col;
      }
    };
  }

  function torsoSpec(outfit, slim, sk) {
    const g = new Grid(-8, -2, -4, 8, 28, 4);
    if (slim) {
      g.box(-7, -2, -4, 7, 6, 4, CLOTH); // hips
      g.box(-6, 6, -4, 6, 12, 4, CLOTH); // waist
      g.box(-7, 12, -4, 7, 21, 4, CLOTH); // chest
      g.box(-6, 21, -3, 6, 22, 3, CLOTH); // shoulders
      g.box(-2, 22, -3, 2, 28, 1, NECK);
    } else {
      g.box(-7, -2, -4, 7, 9, 4, CLOTH);
      g.box(-8, 9, -4, 8, 21, 4, CLOTH);
      g.box(-7, 21, -3, 7, 22, 3, CLOTH);
      g.box(-3, 22, -3, 3, 28, 2, NECK);
    }
    const b = [-8, 8, -2, 22, -4, 4];
    return {
      g,
      paint(kind, c, d) {
        if (kind === NECK) return shade(sk, 1.02 - Math.max(0, c[1] - 22) * 0.05);
        const side = sideOf(d, c, b);
        const hd = outfit.shirtHD; // full voxel detail: 16 x 24 on the front and back, 8 x 24 on the sides
        const [x, y, w] = hd ? oldPx(side, c, b, 16, 24, 8) : oldPx(side, c, b, 8, 12, 4);
        const raw = hd ? hd(x, y, side, w, slim) : outfit.shirt(x, y, side);
        const col = hexInt(raw, sk);
        return raw && c[1] < -1 && d !== 2 && d !== 3 ? shade(col, HEM) : col;
      }
    };
  }

  // A skirt flares out from the hips as a voxel A-line; its pattern is the old 8-column skirt texture on every side.
  function skirtSpec(sk) {
    const rows = sk.len * 2, g = new Grid(-10, 24 - rows, -6, 10, 24, 6);
    for (let r = 0; r < rows; r++) {
      const t = rows > 1 ? r / (rows - 1) : 1, hw = 8 + Math.round(2 * t), hd = 5 + Math.round(t);
      g.box(-hw, 23 - r, -hd, hw, 24 - r, hd, SKIRT);
    }
    return {
      g,
      paint(kind, c, d) {
        if (sk.fnHD) { // full voxel detail: 20 columns round the front, one row per voxel
          const x = d === 0 || d === 1 ? cl((c[2] + 6) / 12, 12) : cl((c[0] + 10) / 20, 20);
          return hexInt(sk.fnHD(x, d === 2 ? 0 : Math.max(0, Math.floor(24 - c[1])), SIDES[d]), 0xffffff);
        }
        const row = Math.max(0, Math.min(sk.len - 1, Math.floor((24 - c[1]) / 2)));
        const x = d === 0 || d === 1 ? cl((c[2] + 6) / 12, 8) : cl((c[0] + 10) / 20, 8);
        return hexInt(sk.fn(x, d === 2 ? 0 : row), 0xffffff);
      }
    };
  }

  // The head: a 16-voxel rounded block (the old 8x8x8 box) with a chin, jaw, ears and a nose, and short or long hair.
  // Its front shows the photo, projected straight on, so the nose's front carries the photo's nose.
  function headSpec(slim, sk, hr, scans) {
    const g = new Grid(-9, -6, -8, 9, 16, 9);
    for (let y = 0; y < 16; y++) for (let z = -8; z < 8; z++) for (let x = -8; x < 8; x++) {
      const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5, ax = Math.abs(cx), az = Math.abs(cz);
      if (ax === 7.5 && cz === 7.5) continue; // front corners
      if (cz < 0 && ax + az > 13.5) continue; // the back is rounder
      if (cy === 15.5 && (ax > 6.5 || az > 6.5 || ax + az > 12.5)) continue; // crown
      if (cy === 14.5 && ((ax === 7.5 && az >= 6.5) || (az === 7.5 && ax >= 6.5) || (cz < 0 && ax + az > 12.5))) continue;
      if (cy === 0.5 && (ax > 4.5 || cz < -1.5)) continue; // chin
      if (cy === 1.5 && (ax > 5.5 || cz < -2.5)) continue; // jaw
      if (cy === 2.5 && ax > 6.5) continue;
      if (cy === 3.5 && ax === 7.5 && cz > 3) continue;
      if (cy < 3 && cz < -2) continue; // the skull's base sits higher at the back: the nape of the neck shows
      g.box(x, y, z, x + 1, y + 1, z + 1, SKIN);
    }
    g.box(-1, 5, 8, 1, 8, 9, NOSE);
    if (slim) {
      // long hair down the back to the shoulder blades, and framing the face
      g.box(-7, -6, -8, 7, 3, -5, HAIR, (k, x, y, z) => Math.abs(x) + Math.abs(z) <= 13.5 && !(y < -5 && Math.abs(x) > 5.5));
      g.box(-8, 3, 6, -7, 15, 8, HAIR);
      g.box(7, 3, 6, 8, 15, 8, HAIR);
      g.box(-8, 14, 5, 8, 15, 8, HAIR, (k) => k === SKIN); // a fringe line under the crown
    } else {
      [-9, 8].forEach((x0) => {
        g.box(x0, 5, -2, x0 + 1, 9, 1, EAR);
        g.box(x0, 8, -2, x0 + 1, 9, -1, 0);
      });
    }
    const hairAt = (c) => shade(hr, 0.9 + 0.16 * noise(Math.floor(c[0]) + 20, Math.floor(c[1]) + 20, Math.floor(c[2]) + 20));
    // short hair on the sides: above and behind the ears; long hair covers the sides except round the jaw
    const sideHair = slim ? (c) => !(c[2] > 1 && c[1] < 7) : (c) => c[1] > 12 || (c[2] < -2 && c[1] > 3) || (c[1] > 9 && c[2] < 2);
    const scan = (img, u, v) => {
      const n = img.n, x = cl(u, n), y = cl(v, n), o = (y * n + x) * 4;
      return (img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2];
    };
    return {
      g,
      // the whole nose takes the photo too (its sides and underside stretch the pixels at its edges), so the bump reads as
      // shape rather than a seam, even when the photo's nose isn't quite where the block's nose is
      photo: (kind, c, d) => (d === 4 && kind === SKIN) || kind === NOSE,
      paint(kind, c, d, t) {
        if (kind === HAIR) return hairAt(c);
        if (kind === EAR) return (d === 0 || d === 1) && c[1] > 5.5 && c[1] < 8.5 && c[2] > -1.5 && c[2] < 0.5 ? shade(sk, 0.78) : shade(sk, 0.95);
        if (kind === NOSE) return d === 3 ? shade(sk, 0.7) : d === 2 ? sk : shade(sk, 0.94);
        if (d === 2) return scans.T ? scan(scans.T, (t[0] + 8) / 16, (t[2] + 8) / 16) : hairAt(c);
        if (d === 3) return shade(sk, 0.82);
        if (d === 0 || d === 1) {
          const s = d === 0 ? scans.L : scans.R;
          if (s) return scan(s, d === 0 ? (8 - t[2]) / 16 : (t[2] + 8) / 16, (16 - t[1]) / 16);
          return sideHair(c) ? hairAt(c) : sk;
        }
        if (d === 5) return c[1] > 3 || slim ? hairAt(c) : sk;
        return sk;
      }
    };
  }

  // ---------- atlas ----------
  // Every non-photo quad gets its own patch (TX texels per voxel face plus a 1-texel border), shelf-packed into a
  // 256-wide atlas; the photo gets one square patch that all front faces of the head share.
  function layout(specs, faceN) {
    const items = [];
    specs.forEach((sp) => {
      sp.quads = greedy(sp.g, sp.photo);
      sp.quads.forEach((q) => { if (!q.photo) items.push({ q, sp, w: q.w * TX + 2, h: q.h * TX + 2 }); });
    });
    const photo = { photo: true, w: faceN + 2, h: faceN + 2 };
    items.push(photo);
    items.sort((a, b) => b.h - a.h || b.w - a.w);
    let x = 0, y = 0, rowH = 0;
    items.forEach((it) => {
      if (x + it.w > AW) { x = 0; y += rowH; rowH = 0; }
      it.x = x; it.y = y;
      x += it.w;
      rowH = Math.max(rowH, it.h);
    });
    let AH = 32;
    while (AH < y + rowH) AH *= 2;
    return { items, photo, AH, faceN };
  }

  function paintQuads(lay, data) {
    const AH = lay.AH, air = [0, 0, 0], vc = [0, 0, 0], ctr = [0, 0, 0], tc = [0, 0, 0];
    lay.items.forEach((it) => {
      if (it.photo) return;
      const q = it.q, g = q.g, paint = it.sp.paint;
      for (let bq = 0; bq < q.h; bq++) for (let bp = 0; bp < q.w; bp++) {
        vc[q.a] = q.c; vc[q.u] = q.p + bp; vc[q.v] = q.q + bq;
        const kind = g.at(vc[0], vc[1], vc[2]);
        for (let t = 0; t < 3; t++) { air[t] = vc[t]; ctr[t] = g.o[t] + vc[t] + 0.5; }
        air[q.a] += q.s;
        for (let sy = 0; sy < TX; sy++) for (let sx = 0; sx < TX; sx++) {
          tc[0] = ctr[0]; tc[1] = ctr[1]; tc[2] = ctr[2];
          tc[q.a] += q.s * 0.5;
          tc[q.u] += (sx + 0.5) / TX - 0.5;
          tc[q.v] += (sy + 0.5) / TX - 0.5;
          const col = paint(kind, ctr, q.d, tc);
          const k = AO[cornerAO(g, air, q.a, q.u, q.v, sx < TX / 2 ? -1 : 1, sy < TX / 2 ? -1 : 1)];
          const o = ((it.y + 1 + bq * TX + sy) * AW + it.x + 1 + bp * TX + sx) * 4;
          data[o] = clamp255(((col >> 16) & 255) * k);
          data[o + 1] = clamp255(((col >> 8) & 255) * k);
          data[o + 2] = clamp255((col & 255) * k);
          data[o + 3] = 255;
        }
      }
      pad(data, it.x, it.y, it.w, it.h);
    });
  }
  // copy each patch's edge texels into its 1-texel border so filtering never picks up a neighbour
  function pad(data, x, y, w, h) {
    const cp = (fx, fy, tx, ty) => { const f = (fy * AW + fx) * 4, t = (ty * AW + tx) * 4; data[t] = data[f]; data[t + 1] = data[f + 1]; data[t + 2] = data[f + 2]; data[t + 3] = 255; };
    for (let i = 1; i < w - 1; i++) { cp(x + i, y + 1, x + i, y); cp(x + i, y + h - 2, x + i, y + h - 1); }
    for (let j = 0; j < h; j++) { cp(x + 1, y + j, x, y + j); cp(x + w - 2, y + j, x + w - 1, y + j); }
  }

  function geometryFor(T, sp, lay) {
    const pos = [], nor = [], uv = [], idx = [], AH = lay.AH, ph = lay.photo, fN = lay.faceN;
    const byQuad = new Map();
    lay.items.forEach((it) => { if (!it.photo) byQuad.set(it.q, it); });
    const corner = [0, 0, 0];
    sp.quads.forEach((q) => {
      const g = q.g, base = pos.length / 3, plane = q.c + (q.s > 0 ? 1 : 0);
      const it = byQuad.get(q);
      [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([du, dv]) => {
        corner[q.a] = plane; corner[q.u] = q.p + du * q.w; corner[q.v] = q.q + dv * q.h;
        const x = g.o[0] + corner[0], y = g.o[1] + corner[1], z = g.o[2] + corner[2];
        pos.push(x * V, y * V, z * V);
        const nn = [0, 0, 0];
        nn[q.a] = q.s;
        nor.push(nn[0], nn[1], nn[2]);
        if (q.photo) {
          // projected straight on; faces that don't point forward sample just inside their own edge
          const px = q.d === 0 || q.d === 1 ? x - q.s * 0.05 : x, py = q.d === 2 || q.d === 3 ? y - q.s * 0.05 : y;
          uv.push((ph.x + 1 + ((px + 8) / 16) * fN) / AW, (ph.y + 1 + ((16 - py) / 16) * fN) / AH);
        }
        else uv.push((it.x + 1 + du * q.w * TX) / AW, (it.y + 1 + dv * q.h * TX) / AH);
      });
      if (q.s > 0) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  }

  // ---------- faces: photo strings, old raw pixels, or a drawn face ----------
  const FACE_RE = /^[JW]:[A-Za-z0-9+/]+={0,2}$/;
  const isFaceString = (s) => typeof s === "string" && s.length <= FACE_MAX && FACE_RE.test(s);
  const decoded = new Map(); // "n|string" -> { p: Promise, v: { n, data } | null }
  // A face string (from faceFromImage) to n x n RGBA pixels. Asynchronous: the browser decodes the JPEG/WebP.
  function decodeFace(str, n) {
    n = n || FACE_N;
    const key = n + "|" + str;
    let e = decoded.get(key);
    if (e) return e.p;
    if (!isFaceString(str)) return Promise.reject(new Error("not a face string"));
    e = { v: null, p: null };
    e.p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = n;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = "high";
        g.drawImage(img, 0, 0, n, n);
        e.v = { n, data: g.getImageData(0, 0, n, n).data };
        resolve(e.v);
      };
      img.onerror = () => { decoded.delete(key); reject(new Error("face did not decode")); };
      img.src = "data:image/" + (str[0] === "W" ? "webp" : "jpeg") + ";base64," + str.slice(2);
    });
    decoded.set(key, e);
    if (decoded.size > 200) decoded.delete(decoded.keys().next().value);
    return e.p;
  }
  // -> { n, data } now, { n, pending: Promise } for a string still decoding, or null
  function faceSource(v, n) {
    if (isFaceString(v)) {
      const e = decoded.get(n + "|" + v);
      if (e && e.v) return e.v;
      return { n, pending: decodeFace(v, n) };
    }
    const m = v && v.length ? Math.round(Math.sqrt(v.length / 3)) : 0;
    if (m >= 8 && m * m * 3 === v.length) {
      const data = new Uint8ClampedArray(m * m * 4);
      for (let i = 0; i < m * m; i++) { data[i * 4] = v[i * 3]; data[i * 4 + 1] = v[i * 3 + 1]; data[i * 4 + 2] = v[i * 3 + 2]; data[i * 4 + 3] = 255; }
      return { n: m, data };
    }
    return null;
  }

  // A pixel-art face on the 16x16 voxel grid, for guests without a photo and NPCs (and while a photo decodes).
  function drawnFace(sk, hr, slim) {
    const f = new Uint8ClampedArray(16 * 16 * 4), px = (x, y, c) => { const o = (y * 16 + x) * 4; f[o] = c >> 16; f[o + 1] = (c >> 8) & 255; f[o + 2] = c & 255; f[o + 3] = 255; };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, sk);
    for (let x = 0; x < 16; x++) { px(x, 0, hr); px(x, 1, hr); if (x < 4 || x > 11 || x === 6 || x === 7) px(x, 2, hr); }
    if (slim) for (let y = 3; y < 11; y++) { px(0, y, hr); px(15, y, hr); }
    const brow = hr, white = 0xf4f4f0, iris = 0x2a2320, lip = 0xa3503f;
    [3, 4, 11, 12].forEach((x) => px(x, 4, brow));
    px(5, 5, brow); px(10, 5, brow);
    px(3, 6, white); px(4, 6, iris); px(3, 7, white); px(4, 7, iris);
    px(11, 6, iris); px(12, 6, white); px(11, 7, iris); px(12, 7, white);
    for (let y = 8; y < 11; y++) { px(7, y, shade(sk, 0.96)); px(8, y, shade(sk, 0.96)); }
    const blush = mix(sk, 0xff8fa0, 0.22);
    [2, 3, 12, 13].forEach((x) => px(x, 10, blush));
    px(5, 11, lip); px(10, 11, lip);
    for (let x = 6; x < 10; x++) px(x, 12, lip);
    return { n: 16, data: f };
  }

  // ---------- merged coloured blocks for hats, capes and props ----------
  const blockMats = new Map();
  function blockMat(T, glow) {
    const k = glow ? "g" : "l";
    if (!blockMats.has(k)) blockMats.set(k, glow ? new T.MeshBasicMaterial({ vertexColors: true }) : new T.MeshLambertMaterial({ vertexColors: true }));
    return blockMats.get(k);
  }
  let unitBox = null;
  // blocks: [x, y, z, w, h, d, colour, glow] by min corner in old skin pixels -> one mesh (two when some glow)
  function blockMeshes(T, blocks) {
    if (!unitBox) unitBox = new T.BoxGeometry(1, 1, 1);
    const bp = unitBox.attributes.position.array, bn = unitBox.attributes.normal.array, bi = unitBox.index.array;
    const out = [];
    [false, true].forEach((glow) => {
      const list = blocks.filter((b) => !!b[7] === glow);
      if (!list.length) return;
      const pos = [], nor = [], col = [], idx = [];
      list.forEach(([x, y, z, w, h, d, c]) => {
        const o = pos.length / 3, cc = hexInt(c, 0xffffff);
        for (let i = 0; i < bp.length; i += 3) {
          pos.push((x + w / 2 + bp[i] * w) * P, (y + h / 2 + bp[i + 1] * h) * P, (z + d / 2 + bp[i + 2] * d) * P);
          nor.push(bn[i], bn[i + 1], bn[i + 2]);
          col.push(((cc >> 16) & 255) / 255, ((cc >> 8) & 255) / 255, (cc & 255) / 255);
        }
        for (let i = 0; i < bi.length; i++) idx.push(o + bi[i]);
      });
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
      geo.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const m = new T.Mesh(geo, blockMat(T, glow));
      m.castShadow = !glow;
      out.push(m);
    });
    return out;
  }

  // ---------- build ----------
  function build(T, look) {
    const outfit = OUTFITS[((look.outfit % OUTFITS.length) + OUTFITS.length) % OUTFITS.length];
    const slim = look.body === "f";
    const aw = slim ? 3 : 4;
    const sk = hexInt(look.skin, 0xd9a57e), hr = hexInt(look.hair, 0x4a3020);
    const shape = bodyShape(look);
    const root = new T.Group();
    const rig = new T.Group();
    root.add(rig);
    const pivot = (parent, x, y, z) => { const g = new T.Group(); g.position.set(x * P, y * P, z * P); parent.add(g); return g; };
    const legR = pivot(rig, -2, 12, 0), legL = pivot(rig, 2, 12, 0), torso = pivot(rig, 0, 12, 0);
    const armR = pivot(rig, -(4 + aw / 2), 22, 0), armL = pivot(rig, 4 + aw / 2, 22, 0), head = pivot(rig, 0, 24, 0);

    // the face: a photo string (decoded now if cached, else soon), old raw pixels, or a drawn face
    let face = faceSource(look.face, FACE_N);
    const drawn = drawnFace(sk, hr, slim);
    const faceN = face ? face.n : 16;
    const scans = { L: null, R: null, T: null };
    const pending = [];
    [["L", look.faceL], ["R", look.faceR], ["T", look.faceT]].forEach(([k, v]) => {
      const s = faceSource(v, 32);
      if (s && s.pending) pending.push(s.pending.then((d) => { scans[k] = d; }));
      else scans[k] = s;
    });
    if (face && face.pending) pending.push(face.pending.then((d) => { face = d; }));

    const specs = [
      Object.assign(legSpec(outfit, 0, sk), { parent: legR }),
      Object.assign(legSpec(outfit, 1, sk), { parent: legL }),
      Object.assign(torsoSpec(outfit, slim, sk), { parent: torso }),
      Object.assign(armSpec(outfit, 0, slim, sk), { parent: armR }),
      Object.assign(armSpec(outfit, 1, slim, sk), { parent: armL }),
      Object.assign(headSpec(slim, sk, hr, scans), { parent: head })
    ];
    if (outfit.skirt) specs.push(Object.assign(skirtSpec(outfit.skirt), { parent: rig }));
    const lay = layout(specs, faceN);
    const AH = lay.AH;
    const data = new Uint8Array(AW * AH * 4);
    const tex = new T.DataTexture(data, AW, AH, T.RGBAFormat);
    tex.magFilter = T.NearestFilter;
    tex.minFilter = T.NearestFilter;
    tex.generateMipmaps = false;
    const mat = new T.MeshLambertMaterial({ map: tex });
    const owned = [tex, mat];
    specs.forEach((sp) => {
      const geo = geometryFor(T, sp, lay);
      owned.push(geo);
      const m = new T.Mesh(geo, mat);
      m.castShadow = true;
      sp.parent.add(m);
    });

    // photo patch: the face pixels (resampled to the patch), plus the sharpie moustache when it's on
    let tache = false;
    const ph = lay.photo;
    function paintFace() {
      const src = face && face.data ? face : drawn;
      const n = faceN, sn = src.n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const so = (Math.floor(((y + 0.5) * sn) / n) * sn + Math.floor(((x + 0.5) * sn) / n)) * 4;
        const o = ((ph.y + 1 + y) * AW + ph.x + 1 + x) * 4;
        data[o] = src.data[so]; data[o + 1] = src.data[so + 1]; data[o + 2] = src.data[so + 2]; data[o + 3] = 255;
      }
      if (tache) {
        // drawn in whole voxels between the nose and the mouth, curling up at the ends
        const u = n / 16, fill = (x0, y0, w, h) => {
          for (let y = Math.round(y0 * u); y < Math.round((y0 + h) * u); y++) for (let x = Math.round(x0 * u); x < Math.round((x0 + w) * u); x++) {
            const o = ((ph.y + 1 + y) * AW + ph.x + 1 + x) * 4;
            data[o] = 0x15; data[o + 1] = 0x15; data[o + 2] = 0x1a;
          }
        };
        fill(5, 11, 6, 0.8);
        fill(4, 10.4, 1, 1);
        fill(11, 10.4, 1, 1);
      }
      pad(data, ph.x, ph.y, ph.w, ph.h);
    }
    function repaint() {
      paintQuads(lay, data);
      paintFace();
      tex.needsUpdate = true;
    }
    repaint();
    let alive = true;
    if (pending.length) Promise.all(pending.map((p) => p.catch(() => {}))).then(() => { if (alive) repaint(); });

    // hats, capes and held things from the outfit: merged blocks in old skin pixels
    const blocksOn = (parent, fn) => {
      if (!fn) return;
      const list = [];
      fn((x, y, z, w, h, d, color, glow) => list.push([x, y, z, w, h, d, color, glow]));
      blockMeshes(T, list).forEach((m) => { owned.push(m.geometry); parent.add(m); });
    };
    blocksOn(head, outfit.hatHD || outfit.hat);
    blocksOn(rig, outfit.extrasHD || outfit.extras);
    blocksOn(armR, outfit.heldHD || outfit.held);
    fitShape(rig, head, shape);

    // Things held in a hand ("R", "L"), worn on the head ("head") or round the waist ("body"), swapped by the party.
    const held = {};
    function hold(slot, kind) {
      const cur = held[slot];
      if ((cur ? cur.kind : null) === (kind || null)) return;
      if (cur) {
        cur.group.parent.remove(cur.group);
        cur.own.forEach((o) => o.dispose());
        delete held[slot];
      }
      if (!kind || !PROPS[kind]) return;
      const group = new T.Group(), list = [];
      PROPS[kind]((x, y, z, w, h, d, color, glow) => list.push([x, y, z, w, h, d, color, glow]), look);
      const own = [];
      blockMeshes(T, list).forEach((m) => { own.push(m.geometry); group.add(m); });
      (slot === "head" ? head : slot === "R" ? armR : slot === "body" ? torso : armL).add(group);
      held[slot] = { kind, group, own };
    }
    function moustache(on) {
      if (tache === !!on) return;
      tache = !!on;
      paintFace();
      tex.needsUpdate = true;
    }

    let bob = 0;
    return {
      root,
      rig,
      parts: { legR, legL, torso, armR, armL, head },
      height: (32 + 8 * (HEAD - 1)) * P * shape.s,
      scale: shape.s,
      hold,
      holding: () => Object.fromEntries(Object.entries(held).map(([k, v]) => [k, v.kind])),
      moustache,
      // phase advances with distance walked; moving blends between walking and standing
      setPose(phase, moving) {
        const a = moving ? Math.sin(phase) * 0.75 : 0;
        rig.position.set(0, 0, 0);
        rig.rotation.set(0, 0, 0);
        legR.rotation.set(a, 0, 0);
        legL.rotation.set(-a, 0, 0);
        armR.rotation.set(-a * 0.8, 0, -0.05);
        armL.rotation.set(a * 0.8, 0, 0.05);
        head.rotation.set(0, 0, 0);
        torso.rotation.set(0, 0, 0);
        bob = moving ? Math.abs(Math.cos(phase)) * P * 0.8 : 0;
        torso.position.y = 12 * P + bob;
        head.position.y = 24 * P + bob;
        armR.position.y = armL.position.y = 22 * P + bob;
      },
      // for tests and tuning: atlas size and triangles
      stats: () => ({ atlas: [AW, AH], faceN, tris: specs.reduce((s, sp) => s + sp.quads.length * 2, 0) }),
      dispose() {
        alive = false;
        ["R", "L", "head", "body"].forEach((s) => hold(s, null));
        owned.forEach((o) => o.dispose());
      }
    };
  }

  // Height and weight: the body scales up from the feet with height, and gets wider (not taller) with weight.
  // Heads keep their width so faces don't stretch. The standard avatar is a 178 cm, 80 kg guest.
  const HEIGHT = { m: 178, f: 165 }, WEIGHT = { m: 80, f: 62 };
  function bodyShape(look) {
    const f = look && look.body === "f" ? "f" : "m";
    const h = Math.max(140, Math.min(210, +(look && look.h) || HEIGHT[f]));
    const wt = Math.max(40, Math.min(160, +(look && look.wt) || WEIGHT[f]));
    const bmi = wt / ((h / 100) * (h / 100));
    return { h, wt, s: h / 178, w: Math.max(0.8, Math.min(1.5, Math.sqrt(bmi / 25))) };
  }
  // Heads are drawn a little bigger than Minecraft's so faces read at party distance.
  const HEAD = 1.15;
  function fitShape(rig, head, shape) {
    rig.scale.set(shape.w, shape.s, shape.w);
    head.scale.set(HEAD / shape.w, HEAD, HEAD / shape.w);
  }

  // ---------- the face pipeline ----------
  // Photo + face box (face-api's detection box, or null for "the middle of the photo") -> a face string of at most
  // FACE_MAX characters: "J:" + base64 JPEG (or "W:" + base64 WebP where the browser can encode it), FACE_N x FACE_N
  // when that fits at a decent quality, else 72 or 64. Also measures skin and hair colours like analyse() did.
  // opts: { flip, dx, dy (nudges, in crop sizes), roll (radians, to level the eyes), size (fixed size, e.g. 32 for
  //         head-scan sides), blend (false: keep the crop's edges), max (characters), formats (["webp", "jpeg"]) }
  // Canvas encoders embed an sRGB colour profile (about 460 bytes, 15% of the budget). Browsers treat untagged images as
  // sRGB anyway, so it goes: WebP keeps just its VP8 image chunk, JPEG drops its APP1-APP15 segments.
  const le32 = (n) => String.fromCharCode(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255);
  function stripProfile(fmt, b64) {
    const b = atob(b64);
    if (fmt === "webp") {
      for (let i = 12; i + 8 <= b.length; ) {
        const id = b.slice(i, i + 4), n = (b.charCodeAt(i + 4) | (b.charCodeAt(i + 5) << 8) | (b.charCodeAt(i + 6) << 16) | (b.charCodeAt(i + 7) << 24)) >>> 0;
        const chunk = b.slice(i, i + 8 + n + (n & 1));
        if (id === "VP8 ") return btoa("RIFF" + le32(4 + chunk.length) + "WEBP" + chunk);
        i += chunk.length;
      }
      return b64;
    }
    let out = b.slice(0, 2);
    for (let i = 2; i < b.length - 1 && b.charCodeAt(i) === 0xff; ) {
      const m = b.charCodeAt(i + 1);
      if (m === 0xda) return btoa(out + b.slice(i));
      const n = (b.charCodeAt(i + 2) << 8) | b.charCodeAt(i + 3);
      if (m < 0xe1 || m > 0xef) out += b.slice(i, i + 2 + n);
      i += 2 + n;
    }
    return b64;
  }

  function faceFromImage(img, box, opts) {
    opts = opts || {};
    const W = img.naturalWidth || img.videoWidth || img.width, H = img.naturalHeight || img.videoHeight || img.height;
    // same framing as the old analyse(): from just above the brows to the chin, the face filling the head's front
    let size = Math.min(W, H) * 0.56, cx = W / 2, cy = H * 0.46;
    if (box) { size = Math.max(box.width, box.height) * (opts.zoom || 1.18); cx = box.x + box.width / 2; cy = box.y + box.height * 0.4; }
    size = Math.min(size, W, H);
    cx = Math.max(size / 2, Math.min(W - size / 2, cx)) + (opts.dx || 0) * size;
    cy = Math.max(size / 2, Math.min(H - size / 2, cy)) + (opts.dy || 0) * size;
    const sizes = opts.size ? [opts.size] : [FACE_N, 80, 72, 64];
    const N = sizes[0], K = 4, BN = N * K;
    // 1. crop at 4x with the browser's smoothing, then an exact 4x4 box filter down: even and sharp everywhere
    const big = document.createElement("canvas");
    big.width = big.height = BN;
    const bg = big.getContext("2d", { willReadFrequently: true });
    bg.imageSmoothingEnabled = true;
    bg.imageSmoothingQuality = "high";
    bg.fillStyle = "#808080";
    bg.fillRect(0, 0, BN, BN);
    bg.save();
    bg.translate(BN / 2, BN / 2);
    if (opts.flip) bg.scale(-1, 1);
    if (opts.roll) bg.rotate(-opts.roll);
    bg.scale(BN / size, BN / size);
    bg.drawImage(img, -cx, -cy);
    bg.restore();
    const sd = bg.getImageData(0, 0, BN, BN).data;
    const px = new Float32Array(N * N * 3);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let k = 0; k < 3; k++) {
      let s = 0;
      for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) s += sd[((y * K + j) * BN + x * K + i) * 4 + k];
      px[(y * N + x) * 3 + k] = s / (K * K);
    }
    const lum = (i) => 0.3 * px[i * 3] + 0.59 * px[i * 3 + 1] + 0.11 * px[i * 3 + 2];
    const inFace = (x, y) => ((x + 0.5) / N - 0.5) ** 2 / 0.12 + ((y + 0.5) / N - 0.55) ** 2 / 0.16 < 1;
    // 2. levels on the face itself (party selfies are dim), a touch more colour, a light unsharp mask
    const Ls = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inFace(x, y)) Ls.push(lum(y * N + x));
    Ls.sort((a, b) => a - b);
    const lo = Ls[Math.floor(Ls.length * 0.03)] || 0, hi = Ls[Math.floor(Ls.length * 0.97)] || 255;
    const black = lo * 0.7, gain = Math.max(1, Math.min(1.6, 215 / Math.max(30, hi - black)));
    for (let i = 0; i < N * N; i++) {
      const L = lum(i), L2 = L + (Math.max(0, black + (L - lo) * gain) - L) * 0.8, sat = 1.12 * Math.min(1.5, (L2 + 20) / (L + 20));
      for (let k = 0; k < 3; k++) px[i * 3 + k] = L2 + (px[i * 3 + k] - L) * sat; // brighter keeps its colour
    }
    if (opts.sharpen !== false) {
      const src = px.slice();
      for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) for (let k = 0; k < 3; k++) {
        const i = (y * N + x) * 3 + k;
        const blur = (src[i - 3] + src[i + 3] + src[i - N * 3] + src[i + N * 3] + src[i] * 4) / 8;
        px[i] = src[i] + (src[i] - blur) * 0.45;
      }
    }
    const rgbAt = (i) => (clamp255(px[i * 3]) << 16) | (clamp255(px[i * 3 + 1]) << 8) | clamp255(px[i * 3 + 2]);
    // 3. skin from the cheeks, hair from the top band (pixels that aren't skin-coloured)
    const avg = (list) => {
      const s = [0, 0, 0];
      list.forEach((c) => { s[0] += (c >> 16) & 255; s[1] += (c >> 8) & 255; s[2] += c & 255; });
      return list.length ? (Math.round(s[0] / list.length) << 16) | (Math.round(s[1] / list.length) << 8) | Math.round(s[2] / list.length) : 0;
    };
    const region = (u0, u1, v0, v1) => {
      const out = [];
      for (let y = Math.floor(v0 * N); y < Math.ceil(v1 * N); y++) for (let x = Math.floor(u0 * N); x < Math.ceil(u1 * N); x++) out.push(rgbAt(y * N + x));
      return out;
    };
    const skin = avg(region(0.2, 0.36, 0.56, 0.7).concat(region(0.64, 0.8, 0.56, 0.7)));
    const dist = (a, b) => Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) + Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) + Math.abs((a & 255) - (b & 255));
    const top = region(0.12, 0.88, 0, 0.1), notSkin = top.filter((c) => dist(c, skin) > 90);
    const hair = typeof opts.hair === "number" ? opts.hair : avg(notSkin.length > top.length * 0.25 ? notSkin : top); // app.js may know better
    // 4. soften the corners into hair (above the eyes) and skin (below), so no background shows round the face
    if (opts.blend !== false) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const u = (x + 0.5) / N, v = (y + 0.5) / N;
        const d = Math.sqrt(((u - 0.5) / 0.5) ** 2 + ((v - 0.5) / 0.6) ** 2);
        const t = Math.max(0, Math.min(1, (d - 0.88) / 0.16));
        if (!t) continue;
        const target = mix(hair, skin, Math.max(0, Math.min(1, (v - 0.3) / 0.25))), i = (y * N + x) * 3;
        px[i] += (((target >> 16) & 255) - px[i]) * t;
        px[i + 1] += (((target >> 8) & 255) - px[i + 1]) * t;
        px[i + 2] += ((target & 255) - px[i + 2]) * t;
      }
    }
    const out = document.createElement("canvas");
    out.width = out.height = N;
    const og = out.getContext("2d", { alpha: false }); // opaque, so WebP carries no alpha channel
    const im = og.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { im.data[i * 4] = clamp255(px[i * 3]); im.data[i * 4 + 1] = clamp255(px[i * 3 + 1]); im.data[i * 4 + 2] = clamp255(px[i * 3 + 2]); im.data[i * 4 + 3] = 255; }
    og.putImageData(im, 0, 0);
    // 5. encode: the biggest size and best quality that fits the limit (WebP where the browser writes it, else JPEG)
    const max = opts.max || FACE_MAX;
    const formats = opts.formats || ["webp", "jpeg"];
    const enc = (c, fmt, q) => {
      const url = c.toDataURL("image/" + fmt, q), pre = "data:image/" + fmt + ";base64,";
      return url.startsWith(pre) ? (fmt === "webp" ? "W:" : "J:") + stripProfile(fmt, url.slice(pre.length)) : null;
    };
    let best = null;
    for (const n of sizes) {
      let c = out;
      if (n !== N) {
        c = document.createElement("canvas");
        c.width = c.height = n;
        const cg = c.getContext("2d", { alpha: false });
        cg.imageSmoothingEnabled = true;
        cg.imageSmoothingQuality = "high";
        cg.drawImage(out, 0, 0, n, n);
      }
      let got = null;
      for (const fmt of formats) {
        if (!enc(c, fmt, 0.5)) continue; // this browser can't write that format
        let lo2 = 0.3, hi2 = 0.95;
        const s0 = enc(c, fmt, hi2);
        if (s0.length <= max) got = { face: s0, q: hi2, n, format: fmt };
        else for (let it = 0; it < 7; it++) {
          const q = (lo2 + hi2) / 2, s = enc(c, fmt, q);
          if (s.length <= max) { got = { face: s, q, n, format: fmt }; lo2 = q; } else hi2 = q;
        }
        break; // the first format this browser writes is the one used
      }
      if (got && (!best || got.q > best.q)) best = got;
      if (best && best.q >= 0.6) break; // good enough at this size; otherwise try a smaller face
    }
    if (!best) return null;
    return { face: best.face, n: best.n, quality: +best.q.toFixed(2), format: best.format, chars: best.face.length, skin: toHex(skin), hair: toHex(hair), canvas: out };
  }

  window.FefeAvatar = {
    OUTFITS, build, P, V, bodyShape, HEIGHT, WEIGHT, faceFromImage, decodeFace, isFaceString, FACE_N, FACE_MAX,
    reshape: (av, look) => { const sh = bodyShape(look); fitShape(av.rig, av.parts.head, sh); av.height = (32 + 8 * (HEAD - 1)) * P * sh.s; av.scale = sh.s; }
  };
})();
