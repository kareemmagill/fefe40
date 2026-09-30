/* FEFE40 avatars: Minecraft-style blocky people with a pixel face from the guest's photo and 20 Swedish-themed outfits.
   Exposes window.FefeAvatar = { OUTFITS, build(THREE, look), P }.
   look = { body: "m" | "f", outfit: 0..19, skin: "#rrggbb", hair: "#rrggbb", face: Uint8Array(n*n*3) | null } (n = 32, or 16 for early guests) */
(function () {
  const P = 2.2 / 32; // metres per skin pixel: avatars stand 2.2 m tall
  const S = 4; // atlas texels per skin pixel, so the head front holds a 32×32 photo face
  const ATLAS = 64 * S;

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

  // Minecraft skin layout (64×64 at 1 unit per skin pixel): [u, v, w, h, d] per part.
  function regions(slim) {
    const aw = slim ? 3 : 4;
    return {
      head: [0, 0, 8, 8, 8],
      body: [16, 16, 8, 12, 4],
      armR: [40, 16, aw, 12, 4],
      armL: [32, 48, aw, 12, 4],
      legR: [0, 16, 4, 12, 4],
      legL: [16, 48, 4, 12, 4]
    };
  }
  function faceRects(u, v, w, h, d) {
    return {
      top: [u + d, v, w, d],
      bottom: [u + d + w, v, w, d],
      right: [u, v + d, d, h],
      front: [u + d, v + d, w, h],
      left: [u + d + w, v + d, d, h],
      back: [u + 2 * d + w, v + d, w, h]
    };
  }

  function paintAtlas(look, outfit) {
    const slim = look.body === "f";
    const R = regions(slim);
    const c = document.createElement("canvas");
    c.width = c.height = ATLAS;
    const g = c.getContext("2d");
    const part = (reg, fn) => {
      const rects = faceRects(reg[0], reg[1], reg[2], reg[3], reg[4]);
      Object.keys(rects).forEach((side) => {
        const [x0, y0, fw, fh] = rects[side];
        for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
          g.fillStyle = fn(x, y, side, fw, fh) || look.skin;
          g.fillRect((x0 + x) * S, (y0 + y) * S, S, S);
        }
      });
    };
    const long = slim;
    part(R.head, (x, y, side) => {
      if (side === "top" || side === "back") return look.hair;
      if (side === "bottom") return look.skin;
      if (side === "left" || side === "right") return y < (long ? 8 : 2) || (!long && y < 5 && ((side === "right" && x === 0) || (side === "left" && x === 7))) ? look.hair : look.skin;
      return look.skin;
    });
    // photo face on the head front (32×32 texels), or a simple drawn face when there is no photo
    const [fx, fy] = faceRects(0, 0, 8, 8, 8).front;
    const n = look.face ? Math.round(Math.sqrt(look.face.length / 3)) : 0;
    if (n >= 8 && n * n * 3 === look.face.length) {
      const tmp = document.createElement("canvas");
      tmp.width = tmp.height = n;
      const tg = tmp.getContext("2d");
      const img = tg.createImageData(n, n);
      for (let i = 0; i < n * n; i++) {
        img.data[i * 4] = look.face[i * 3];
        img.data[i * 4 + 1] = look.face[i * 3 + 1];
        img.data[i * 4 + 2] = look.face[i * 3 + 2];
        img.data[i * 4 + 3] = 255;
      }
      tg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = false;
      g.drawImage(tmp, fx * S, fy * S, 8 * S, 8 * S);
    } else {
      const px = (x, y, col) => { g.fillStyle = col; g.fillRect((fx + x) * S, (fy + y) * S, S, S); };
      for (let x = 0; x < 8; x++) { px(x, 0, look.hair); px(x, 1, look.hair); }
      if (long) for (let y = 2; y < 7; y++) { px(0, y, look.hair); px(7, y, look.hair); }
      px(1, 4, WHITE); px(2, 4, "#3A2A20"); px(5, 4, "#3A2A20"); px(6, 4, WHITE);
      px(3, 6, "#9E4A3A"); px(4, 6, "#9E4A3A");
    }
    part(R.body, (x, y, side) => outfit.shirt(x, y, side));
    part(R.armR, (x, y, side, w) => outfit.sleeve(x, y, side, 0, w));
    part(R.armL, (x, y, side, w) => outfit.sleeve(x, y, side, 1, w));
    part(R.legR, (x, y, side) => outfit.leg(x, y, side, 0));
    part(R.legL, (x, y, side) => outfit.leg(x, y, side, 1));
    return c;
  }

  function boxUV(T, w, h, d, reg) {
    const geo = new T.BoxGeometry(w * P, h * P, d * P);
    const rects = faceRects(reg[0], reg[1], w, h, d);
    const order = ["left", "right", "top", "bottom", "front", "back"]; // BoxGeometry faces: +x, -x, +y, -y, +z, -z
    const uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const [x0, y0, fw, fh] = rects[order[f]];
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        const su = uv.getX(i), sv = uv.getY(i);
        uv.setXY(i, ((x0 + su * fw) * S) / ATLAS, 1 - ((y0 + (1 - sv) * fh) * S) / ATLAS);
      }
    }
    uv.needsUpdate = true;
    return geo;
  }

  const matCache = new Map();
  function colorMat(T, color, glow) {
    const k = color + (glow ? "g" : "");
    if (!matCache.has(k)) matCache.set(k, glow ? new T.MeshBasicMaterial({ color }) : new T.MeshLambertMaterial({ color }));
    return matCache.get(k);
  }

  function build(T, look) {
    const outfit = OUTFITS[((look.outfit % OUTFITS.length) + OUTFITS.length) % OUTFITS.length];
    const slim = look.body === "f";
    const R = regions(slim);
    const aw = slim ? 3 : 4;
    const tex = new T.CanvasTexture(paintAtlas(look, outfit));
    tex.magFilter = T.NearestFilter;
    tex.minFilter = T.NearestFilter;
    tex.generateMipmaps = false;
    const mat = new T.MeshLambertMaterial({ map: tex });
    const owned = [tex, mat];
    const root = new T.Group();
    const pivot = (parent, x, y, z) => {
      const g = new T.Group();
      g.position.set(x * P, y * P, z * P);
      parent.add(g);
      return g;
    };
    const mesh = (parent, w, h, d, reg, ox, oy, oz) => {
      const geo = boxUV(T, w, h, d, reg);
      owned.push(geo);
      const m = new T.Mesh(geo, mat);
      m.position.set(ox * P, oy * P, oz * P);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    // add(parent)(x, y, z, w, h, d, color, glow): a coloured block by its min corner, in skin pixels
    const adder = (parent) => (x, y, z, w, h, d, color, glow) => {
      const geo = new T.BoxGeometry(w * P, h * P, d * P);
      owned.push(geo);
      const m = new T.Mesh(geo, colorMat(T, color, glow));
      m.position.set((x + w / 2) * P, (y + h / 2) * P, (z + d / 2) * P);
      m.castShadow = !glow;
      parent.add(m);
    };

    const legR = pivot(root, -2, 12, 0);
    mesh(legR, 4, 12, 4, R.legR, 0, -6, 0);
    const legL = pivot(root, 2, 12, 0);
    mesh(legL, 4, 12, 4, R.legL, 0, -6, 0);
    const torso = pivot(root, 0, 12, 0);
    mesh(torso, 8, 12, 4, R.body, 0, 6, 0);
    const armR = pivot(root, -(4 + aw / 2), 22, 0);
    mesh(armR, aw, 12, 4, R.armR, 0, -4, 0);
    const armL = pivot(root, 4 + aw / 2, 22, 0);
    mesh(armL, aw, 12, 4, R.armL, 0, -4, 0);
    const head = pivot(root, 0, 24, 0);
    mesh(head, 8, 8, 8, R.head, 0, 4, 0);
    if (slim) adder(head)(-4, -3, -4.6, 8, 11, 0.8, look.hair);
    if (outfit.hat) outfit.hat(adder(head));
    if (outfit.extras) outfit.extras(adder(root));
    if (outfit.held) outfit.held(adder(armR));
    if (outfit.skirt) {
      const sk = outfit.skirt, f = sk.flare;
      const c = document.createElement("canvas");
      c.width = 8;
      c.height = sk.len;
      const g = c.getContext("2d");
      for (let y = 0; y < sk.len; y++) for (let x = 0; x < 8; x++) { g.fillStyle = sk.fn(x, y); g.fillRect(x, y, 1, 1); }
      const st = new T.CanvasTexture(c);
      st.magFilter = T.NearestFilter;
      st.minFilter = T.NearestFilter;
      st.generateMipmaps = false;
      const sm = new T.MeshLambertMaterial({ map: st });
      const geo = new T.BoxGeometry((8 + 2 * f) * P, sk.len * P, (4 + 2 * f) * P);
      owned.push(st, sm, geo);
      const m = new T.Mesh(geo, sm);
      m.position.set(0, (12 - sk.len / 2) * P, 0);
      m.castShadow = true;
      root.add(m);
    }

    let bob = 0;
    return {
      root,
      height: 32 * P,
      // phase advances with distance walked; moving blends between walking and standing
      setPose(phase, moving) {
        const a = moving ? Math.sin(phase) * 0.75 : 0;
        legR.rotation.x = a;
        legL.rotation.x = -a;
        armR.rotation.x = -a * 0.8;
        armL.rotation.x = a * 0.8;
        armR.rotation.z = -0.05;
        armL.rotation.z = 0.05;
        bob = moving ? Math.abs(Math.cos(phase)) * P * 0.8 : 0;
        torso.position.y = 12 * P + bob;
        head.position.y = 24 * P + bob;
        armR.position.y = armL.position.y = 22 * P + bob;
      },
      dispose() {
        owned.forEach((o) => o.dispose());
      }
    };
  }

  window.FefeAvatar = { OUTFITS, build, P };
})();
