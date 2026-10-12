
// Blok 2048 — oyun çekirdeği (arayüzden bağımsız, saf mantık)
//
// Kurallar:
//  1) Seçilebilir 5x5, 6x6, 7x7, 8x8 tahta, her turda 3 parça. Parçanın tüm hücreleri aynı sayıyı taşır.
//  2) Yerleştirmede tamamen dolan çizgilerde uzak eşler birleştirilir. Ardından komşu birleşmeleri: yan yana iki EŞİT sayı (farklı kaynaktan) birleşip 2 katı olur.
//     Aynı parçanın hücreleri birbiriyle birleşmez. Birleşen taş, eski taşın yerinde kalır.
//     Yeni oluşan taş komşusuyla eşitse zincirleme devam eder.
//  3) Çizgi birleşmesi yalnızca dolu çizgide olur; eşi olmayan taşlar kalır, toplam değer korunur.
//  4) Hiçbir parça sığmazsa oyun biter (kaydırma hakkı yer açabiliyorsa bitmez). 2048 taşı hedeftir.
//  5) Kaydırma hakkı: başlangıç 0, depo sınırı 2. Her 5 tepsi yenilenmesinde 1 hak kesin kazanılır.
//     Depo doluysa ilerleme %100'de bekler; hak kullanınca hazır hak eklenir. Toplam kazanma sınırı yok.
//     Hak, tüm tahtayı seçilen yöne 2048 gibi kaydırır (eş çiftler birleşir), sonra dolu çizgilerdeki eşit sayılar birleşir.
function createBlokCore(size) {
  'use strict';

  if (size === undefined) size = 8;
  if (![5, 6, 7, 8].includes(size)) throw new RangeError('Geçersiz tahta boyutu');
  const SIZE = size;
  const N = SIZE * SIZE;
  const GOAL = 2048;

  const SHAPE_DEFS = [
    ['dot', 3, ['#']],
    ['h2', 5, ['##']],
    ['v2', 5, ['#', '#']],
    ['h3', 5, ['###']],
    ['v3', 5, ['#', '#', '#']],
    ['h4', 2, ['####']],
    ['v4', 2, ['#', '#', '#', '#']],
    ['sq2', 4, ['##', '##']],
    ['l-a', 3, ['#.', '##']],
    ['l-b', 3, ['.#', '##']],
    ['l-c', 3, ['##', '#.']],
    ['l-d', 3, ['##', '.#']],
    ['t-a', 2, ['###', '.#.']],
    ['t-b', 2, ['.#.', '###']],
    ['t-c', 2, ['#.', '##', '#.']],
    ['t-d', 2, ['.#', '##', '.#']],
    ['s-a', 2, ['.##', '##.']],
    ['s-b', 2, ['##.', '.##']],
    ['s-c', 2, ['#.', '##', '.#']],
    ['s-d', 2, ['.#', '##', '#.']],
    ['r23', 1.5, ['###', '###']],
    ['r32', 1.5, ['##', '##', '##']],
    ['big-a', 1, ['#..', '#..', '###']],
    ['big-b', 1, ['..#', '..#', '###']],
    ['big-c', 1, ['###', '#..', '#..']],
    ['big-d', 1, ['###', '..#', '..#']],
    ['sq3', 0.6, ['###', '###', '###']],
  ];

  const SHAPES = SHAPE_DEFS.map(([name, weight, rows]) => {
    const cells = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
    return { name, weight, cells, h: rows.length, w: rows[0].length };
  });

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickWeighted(items, weights, rng) {
    let total = 0;
    for (const w of weights) total += w;
    let x = rng() * total;
    for (let i = 0; i < items.length; i++) {
      x -= weights[i];
      if (x <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  const emptyBoard = () => new Array(N).fill(0);

  function canPlace(board, piece, r0, c0) {
    for (const [dr, dc] of piece.cells) {
      const r = r0 + dr, c = c0 + dc;
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return false;
      if (board[r * SIZE + c]) return false;
    }
    return true;
  }

  function fits(board, piece) {
    for (let r = 0; r <= SIZE - piece.h; r++)
      for (let c = 0; c <= SIZE - piece.w; c++)
        if (canPlace(board, piece, r, c)) return true;
    return false;
  }

  function placements(board, piece) {
    const out = [];
    for (let r = 0; r <= SIZE - piece.h; r++)
      for (let c = 0; c <= SIZE - piece.w; c++)
        if (canPlace(board, piece, r, c)) out.push([r, c]);
    return out;
  }

  // ---------- parça üretimi ----------

  let pieceSeq = 1;
  const makePiece = (shape, value) => ({
    id: pieceSeq++, name: shape.name, cells: shape.cells, w: shape.w, h: shape.h, value,
  });

  // Tahtadaki en büyük taşa göre üretilebilecek en büyük parça değeri
  function valueCap(maxTile, shift = 3) {
    const lg = Math.floor(Math.log2(Math.max(2, maxTile)));
    return Math.max(4, 1 << Math.max(1, lg - shift));
  }

  function pickValue(board, rng, maxTile, tune) {
    const matchChance = tune.matchChance;
    const cap = valueCap(maxTile, tune.capShift);
    const levels = [];
    for (let v = 2; v <= cap; v *= 2) levels.push(v);
    const present = {};
    for (const v of board) if (v && v <= cap) present[v] = (present[v] || 0) + 1;
    const presentVals = Object.keys(present).map(Number);
    if (presentVals.length && rng() < matchChance) {
      return pickWeighted(presentVals, presentVals.map(v => Math.sqrt(present[v])), rng);
    }
    return pickWeighted(levels, levels.map((v, i) => Math.pow(tune.levelDecay, i)), rng);
  }

  const DEFAULT_TUNING = {
    matchChance: 0.45,   // parça değerinin tahtada zaten var olan bir sayıdan seçilme olasılığı
    capShift: 2,         // en büyük parça değeri = en büyük taş / 2^capShift
    levelDecay: 0.85,   // her üst değer seviyesinin göreli olasılığı
    sizePenalty: 0.6,    // tahta doldukça büyük parçaları azaltma gücü
    guarantee: true,     // tepsideki 3 parça da sırayla yerleştirilebilmeli
    slideCap: 2,         // depolama: en fazla kaç kaydırma hakkı biriktirilebilir
    slideTrayTarget: 5, // her 5 tepsi yenilenmesinde kesin olarak 1 hak
  };

  function genPiece(board, rng, maxTile, occ, tune, extraPenalty = 0) {
    const pen = Math.min(0.97, tune.sizePenalty + extraPenalty);
    // Büyük şekiller mümkün kalır; küçük şekillere göre daha seyrek seçilir.
    const w = SHAPES.map(s => {
      const sizeWeight = s.cells.length >= 5 ? 0.25 : s.cells.length === 4 ? 0.45 : 1;
      return s.weight * sizeWeight * Math.pow(1 - pen * occ, Math.max(0, s.cells.length - 2));
    });
    const shape = pickWeighted(SHAPES, w, rng);
    return makePiece(shape, pickValue(board, rng, maxTile, tune));
  }

  // 3 parçanın hepsi bir sırayla yerleştirilebilir mi? Gerçek resolve ile tam benzetim (kesin sonuç).
  function solvable(board, pieces, mode, budget = 2500) {
    const list = pieces.filter(Boolean);
    if (list.some(p => !fits(board, p))) return false;
    let nodes = 0;
    function dfs(bd, remaining) {
      for (let k = 0; k < remaining.length; k++) {
        const p = remaining[k];
        const rest = remaining.filter((_, j) => j !== k);
        for (const [r, c] of placements(bd, p)) {
          if (++nodes > budget) return false;
          if (rest.length === 0) return true;
          const res = resolve(bd, p, r, c, mode);
          if (rest.every(q => fits(res.board, q)) && dfs(res.board, rest)) return true;
        }
      }
      return false;
    }
    return dfs(board, list);
  }

  function genTray(board, rng, maxTile, tune = DEFAULT_TUNING, mode = 'hard') {
    const occ = board.filter(Boolean).length / N;
    const draw = extra => [0, 1, 2].map(() => genPiece(board, rng, maxTile, occ, tune, extra));
    if (tune.guarantee) {
      for (let t = 0; t < 40; t++) { const tray = draw(0); if (solvable(board, tray, mode)) return tray; }
      for (let t = 0; t < 40; t++) { const tray = draw(0.5); if (solvable(board, tray, mode)) return tray; }
    }
    for (let t = 0; t < 30; t++) {
      const tray = draw(0.5);
      if (tray.some(p => fits(board, p))) return tray;
    }
    // Yedek: en küçük parçalar
    const small = SHAPES.filter(s => s.cells.length <= 2);
    const tray = [];
    for (let i = 0; i < 3; i++) {
      const shape = small[Math.floor(rng() * small.length)];
      tray.push(makePiece(shape, pickValue(board, rng, maxTile, tune)));
    }
    return tray;
  }

  // ---------- bir hamlenin çözümü (saf: tahtayı değiştirmez) ----------

  function resolve(board, piece, r0, c0, mode) {
    const b = board.slice();
    const src = new Array(N).fill(0); // 0: eski taş, 1: bu hamlenin parçası, >=2: bu turdaki birleşme sonuçları
    const placed = [];
    for (const [dr, dc] of piece.cells) {
      const i = (r0 + dr) * SIZE + (c0 + dc);
      b[i] = piece.value;
      src[i] = 1;
      placed.push(i);
    }
    const afterPlace = b.slice();

    // Doluluk yerleştirme anında saptanır; komşu birleşmesi çizgi bonusunu iptal etmez.
    const lc = mergeFullLines(b);
    const merges = lc.merges.slice();
    let step = merges.length;
    let nextSrc = 2;
    for (const m of merges) { src[m.gone] = 0; src[m.at] = nextSrc++; }
    // Dolu olmayan çizgilerde mevcut komşu birleşmesi kuralı sürer.
    for (;;) {
      let a = -1, d = -1;
      for (let i = 0; i < N; i++) {
        const v = b[i];
        if (!v) continue;
        if (i % SIZE < SIZE - 1 && b[i + 1] === v && src[i + 1] !== src[i]) { a = i; d = i + 1; break; }
        if (i + SIZE < N && b[i + SIZE] === v && src[i + SIZE] !== src[i]) { a = i; d = i + SIZE; break; }
      }
      if (a < 0) break;
      step++;
      let at = a, gone = d;
      if (src[a] !== 0 && src[d] === 0) { at = d; gone = a; } // eski taşın yerinde kal
      const nv = b[a] * 2;
      b[at] = nv; b[gone] = 0;
      src[at] = nextSrc++; src[gone] = 0;
      merges.push({ a, b: d, at, gone, value: nv, step, points: nv * step, kind: 'neighbor' });
    }
    let mergeScore = 0;
    for (const m of merges) if (m.kind === 'neighbor') mergeScore += m.points;

    const afterMerge = b.slice();
    const maxTile = Math.max(0, ...afterMerge);
    const filled = b.filter(Boolean).length;

    const placeScore = piece.cells.length;
    return {
      board: b,
      afterPlace,
      afterMerge,
      placed,
      lines: lc.lines,
      lineMerges: lc.merges,
      merges,
      maxTile,
      filled,
      gained: { place: placeScore, lines: lc.score, merge: mergeScore, total: placeScore + lc.score + mergeScore },
    };
  }

  // ---------- kaydırma (2048 hamlesi) ----------

  const DIRS = ['left', 'right', 'up', 'down'];

  // Her satır ya da sütunun hücreleri, kaydırmanın gittiği kenardan başlayarak sıralı
  function slideLines(dir) {
    const lines = [];
    for (let k = 0; k < SIZE; k++) {
      const cells = [];
      for (let j = 0; j < SIZE; j++) {
        if (dir === 'left') cells.push(k * SIZE + j);
        else if (dir === 'right') cells.push(k * SIZE + (SIZE - 1 - j));
        else if (dir === 'up') cells.push(j * SIZE + k);
        else cells.push((SIZE - 1 - j) * SIZE + k);
      }
      lines.push(cells);
    }
    return lines;
  }

  // Yalnızca başlangıçta tamamen dolu çizgilerde, aradaki boşluk/mesafeden bağımsız eşleştirme.
  // Kesişimler deterministik olarak önce satır, sonra sütun işlenir; güncel taş değerleri kullanılır.
  function mergeFullLines(b) {
    const full = [];
    for (const kind of ['row', 'col']) for (let k = 0; k < SIZE; k++) {
      const cells = Array.from({ length: SIZE }, (_, j) => kind === 'row' ? k * SIZE + j : j * SIZE + k);
      if (cells.every(i => b[i])) full.push({ kind, index: k, cells });
    }
    const merges = [], lines = [];
    let score = 0;
    for (const ln of full) {
      const before = merges.length;
      const middle = (SIZE - 1) / 2;
      const priority = i => Math.abs(ln.cells.indexOf(i) - middle);
      for (;;) {
        // Küçük değerlerden başlayarak 2+2 -> 4, 4+4 -> 8 zinciri kurulur.
        const values = [...new Set(ln.cells.map(i => b[i]).filter(Boolean))].sort((a, z) => a - z);
        let pair = null;
        for (const value of values) {
          const matches = ln.cells.filter(i => b[i] === value);
          if (matches.length < 2) continue;
          matches.sort((a, z) => priority(a) - priority(z) || a - z);
          pair = matches; break;
        }
        if (!pair) break;
        const [at, gone] = pair;
        const value = b[at] * 2;
        b[at] = value; b[gone] = 0;
        merges.push({ at, gone, value, points: value, kind: 'line', step: merges.length + 1 });
        score += value;
      }
      if (merges.length > before) lines.push(ln);
    }
    return { lines, merges, score };
  }

  // 2048 kuralı: taşlar yöne doğru toplanır, ardışık eşit çiftler birleşir (her taş en çok bir kez).
  // Sonra dolu çizgilerdeki eşit sayılar birleşir. Saf fonksiyon: tahtayı değiştirmez.
  function slide(board, dir, mode) {
    const b = new Array(N).fill(0);
    const moves = []; // { from: [i] veya [i, j], to, value, merged }
    let mergeScore = 0, merges = 0, changed = false;
    for (const cells of slideLines(dir)) {
      const tiles = [];
      for (const i of cells) if (board[i]) tiles.push(i);
      let pos = 0;
      for (let t = 0; t < tiles.length; t++) {
        const i = tiles[t];
        const v = board[i];
        const to = cells[pos++];
        if (t + 1 < tiles.length && board[tiles[t + 1]] === v) {
          const j = tiles[t + 1];
          b[to] = v * 2;
          mergeScore += v * 2;
          merges++;
          moves.push({ from: [i, j], to, value: v * 2, merged: true });
          changed = true;
          t++;
        } else {
          b[to] = v;
          moves.push({ from: [i], to, value: v, merged: false });
          if (to !== i) changed = true;
        }
      }
    }
    const afterSlide = b.slice();
    const lc = mergeFullLines(b);
    if (lc.merges.length) changed = true;
    const maxTile = Math.max(0, ...b);
    return {
      dir, board: b, afterSlide, moves, merges, changed,
      lines: lc.lines, lineMerges: lc.merges, maxTile,
      gained: { merge: mergeScore, lines: lc.score, total: mergeScore + lc.score },
    };
  }

  // Hiçbir parça sığmıyorsa oyun biter, ama kaydırma hakkı yer açabiliyorsa bitmez.
  function computeOver(g) {
    const pieces = g.tray.filter(Boolean);
    if (pieces.some(p => fits(g.board, p))) return false;
    if (g.slides > 0) {
      for (const d of DIRS) {
        const s = slide(g.board, d, g.mode);
        if (s.changed && pieces.some(p => fits(s.board, p))) return false;
      }
    }
    return true;
  }

  // Dolu depo bir hazır hakkı tutar; harcanan hakkın yerine hemen ekler.
  function claimSlide(g, res) {
    if (g.slideProgress < g.tune.slideTrayTarget || g.slides >= g.tune.slideCap) return false;
    g.slideProgress = 0;
    g.slides++;
    g.slidesEarned++;
    res.slideEarned.push('tray');
    return true;
  }
  function advanceSlide(g, res) {
    g.slideProgress = Math.min(g.tune.slideTrayTarget, g.slideProgress + 1);
    claimSlide(g, res);
  }

  // ---------- oyun durumu ----------

  function newGame(opts = {}) {
    const g = {
      size: SIZE,
      board: emptyBoard(),
      tray: [],
      score: 0,
      moves: 0,
      maxTile: 0,
      mode: 'soft', // Eski kayıtlarla uyumluluk; artık tek korumalı kural var.
      slides: opts.slides === undefined ? 0 : Math.max(0, Math.min(2, Math.floor(opts.slides))), // başlangıç: 0 hak; depolama sınırı: 2 hak
      slideMark: 32,       // yalnızca eski kayıtlarla uyumluluk için
      slidesEarned: 0,     // kazanılan toplam hak; üst sınır yok
      slideProgress: 0,    // tamamlanan tepsi sayısı, 0..5; 5 ise hak hazır
      over: false,
      won: false,
      winPending: false,
      rng: opts.rng || Math.random,
      tune: Object.assign({}, DEFAULT_TUNING, opts.tune || {}),
    };
    // İsteğe bağlı başlangıç taşları (ilk hamlede birleşme görülebilsin diye)
    for (let k = 0; k < (opts.start || 0); k++) {
      let i;
      do { i = Math.floor(g.rng() * N); } while (g.board[i]);
      g.board[i] = g.rng() < 0.65 ? 2 : 4;
    }
    g.maxTile = Math.max(0, ...g.board);
    g.tray = genTray(g.board, g.rng, g.maxTile, g.tune, g.mode);
    g.over = computeOver(g);
    return g;
  }

  function applyMove(g, slot, r, c) {
    const piece = g.tray[slot];
    if (g.over || !piece || !canPlace(g.board, piece, r, c)) return null;
    const res = resolve(g.board, piece, r, c, g.mode);
    g.board = res.board;
    g.score += res.gained.total;
    g.moves++;
    g.maxTile = Math.max(g.maxTile, res.maxTile);
    g.tray[slot] = null;
    res.reachedGoal = false;
    if (!g.won && g.maxTile >= GOAL) { g.won = true; g.winPending = true; res.reachedGoal = true; }
    res.slideEarned = [];
    res.refilled = false;
    if (g.tray.every(p => !p)) {
      g.tray = genTray(g.board, g.rng, g.maxTile, g.tune, g.mode);
      res.refilled = true;
      advanceSlide(g, res);
    }
    g.over = computeOver(g);
    res.over = g.over;
    return res;
  }

  // Kaydırma hakkını kullanır. Tahtayı değiştirmeyen kaydırma hak harcamaz (null döner).
  function applySlide(g, dir) {
    if (g.over || g.slides <= 0 || !DIRS.includes(dir)) return null;
    const res = slide(g.board, dir, g.mode);
    if (!res.changed) return null;
    g.board = res.board;
    g.slides--;
    g.score += res.gained.total;
    g.maxTile = Math.max(g.maxTile, res.maxTile);
    res.reachedGoal = false;
    if (!g.won && g.maxTile >= GOAL) { g.won = true; g.winPending = true; res.reachedGoal = true; }
    res.slideEarned = [];
    claimSlide(g, res);
    g.over = computeOver(g);
    res.over = g.over;
    return res;
  }

  return {
    SIZE, N, GOAL, SHAPES, DEFAULT_TUNING, mergeFullLines,
    DIRS, mulberry32, emptyBoard, canPlace, fits, placements, resolve, slide, computeOver, solvable, genTray, newGame, applyMove, applySlide, valueCap,
  };
}
const BlokCore = Object.assign(createBlokCore(8), { createCore: createBlokCore });

if (typeof module !== 'undefined' && module.exports) module.exports = BlokCore;

