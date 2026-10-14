
(() => {
  'use strict';
  let C = BlokCore;
  let { SIZE, N } = C;
  const $ = id => document.getElementById(id);
  const el = {
    board: $('board'), grid: $('grid'), layer: $('layer'), pv: $('pv'), fx: $('fx'), tray: $('tray'),
    hint: $('hint'), score: $('score'), best: $('best'), maxv: $('maxv'), bar: $('barfill'),
    over: $('over'), win: $('win'),
    slidebar: $('slidebar'), pips: $('pips'), more: $('more'), slideFill: $('slideFill'), slideProgress: $('slideProgress'), have: $('shave'), cancel: $('slideCancel'),
    dirBtns: Array.from(document.querySelectorAll('.dirbtn')),
  };
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = false;
  const wait = ms => reduced ? Promise.resolve() : new Promise(res => setTimeout(res, ms));
  const numberFormat = new Intl.NumberFormat('tr-TR');
  const fmt = n => numberFormat.format(n);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* kayıt tutulamadı, oyun etkilenmez */ } },
  };
  function applyMotion(value) {
    reduced = value === 'off' || (value === 'system' && motionQuery.matches);
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
    store.set('blok2048.motion', value);
  }
  const savedMotion = store.get('blok2048.motion', 'on');
  const motionInputs = Array.from(document.querySelectorAll('input[name="motion"]'));
  const motionValue = ['on', 'off', 'system'].includes(savedMotion) ? savedMotion : 'on';
  for (const input of motionInputs) {
    input.checked = input.value === motionValue;
    input.addEventListener('change', () => applyMotion(input.value));
  }
  applyMotion(motionValue);
  motionQuery.addEventListener('change', () => {
    if (motionInputs.find(input => input.checked).value === 'system') applyMotion('system');
  });
  const app = document.querySelector('.app');
  let screen = 'lobby';
  let hasSavedGame = false;
  function applyTheme(theme) {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    store.set('blok2048.theme', theme);
  }
  const savedTheme = store.get('blok2048.theme', 'system');
  const themeValue = ['light', 'dark'].includes(savedTheme) ? savedTheme : 'system';
  for (const input of document.querySelectorAll('input[name="theme"]')) {
    input.checked = input.value === themeValue;
    input.addEventListener('change', () => applyTheme(input.value));
  }
  applyTheme(themeValue);
  function updateLobby() {
    $('resumeBtn').hidden = !hasSavedGame;
    $('resumeTitle').textContent = SIZE + '×' + SIZE + (g.over ? ' · Sonucu gör' : ' · Devam et');
    $('resumeInfo').textContent = fmt(g.score) + ' puan · ' + fmt(g.moves) + ' hamle';
    for (const size of [5, 6, 7, 8]) {
      const saved = size === SIZE && hasSavedGame ? g : restoreSizedGame(size);
      $('record' + size).textContent = 'Rekor: ' + fmt(loadBest(size));
      $('status' + size).textContent = saved
        ? (saved.over ? 'Sonucu gör' : 'Devam et') + ' · ' + fmt(saved.score) + ' puan'
        : 'Yeni oyun →';
      $('size' + size).dataset.saved = String(!!saved);
      $('size' + size).dataset.current = String(size === SIZE && hasSavedGame);
    }
  }
  function showScreen(next) {
    if (busy) return;
    endDrag();
    cancelPending();
    swipe = null;
    closeConfirm();
    screen = next;
    app.dataset.screen = next;
    $('lobby').hidden = next !== 'lobby';
    $('gameScreen').hidden = next !== 'game';
    document.querySelector('.help').hidden = next !== 'lobby';
    window.scrollTo(0, 0);
    if (next === 'game') {
      $('gameTitle').textContent = SIZE + '×' + SIZE;
      fitBoard();
      measure();
      renderTray(false);
      if (g.winPending) showWin();
      else if (g.over) showOver();
      else $('gameTitle').focus({ preventScroll: true });
    } else {
      updateLobby();
      (hasSavedGame ? $('resumeBtn') : $('size8')).focus({ preventScroll: true });
    }
  }

  const SAVE_KEY = 'blok2048.game.v1';
  const sizeSaveKey = size => SAVE_KEY + '.' + size;
  function restoreSizedGame(size) {
    const restored = restoreGame(store.get(sizeSaveKey(size), null));
    return restored && restored.size === size ? restored : null;
  }
  function snapshot() {
    return { version: 4, size: SIZE, mode: g.mode, board: g.board, tray: g.tray,
      score: g.score, moves: g.moves, maxTile: g.maxTile, won: g.won,
      winPending: g.winPending, slides: g.slides, slideMark: g.slideMark,
      slidesEarned: g.slidesEarned, slideProgress: g.slideProgress, over: g.over };
  }
  function saveGame() {
    hasSavedGame = true;
    const data = snapshot();
    store.set(sizeSaveKey(SIZE), data);
    store.set(SAVE_KEY, data); // Önceki sürümler için son açık oyun kaydı.
    updateBest();
  }
  function restoreGame(data) {
    const size = data && data.size !== undefined ? data.size : 8;
    if (![5, 6, 7, 8].includes(size)) return null;
    const core = BlokCore.createCore(size);
    const integer = n => Number.isSafeInteger(n) && n >= 0;
    const tile = n => integer(n) && n >= 2 && Number.isInteger(Math.log2(n));
    if (!data || (data.version !== undefined && ![1, 2, 3, 4].includes(data.version)) ||
        !['hard', 'soft'].includes(data.mode) ||
        !Array.isArray(data.board) || data.board.length !== core.N ||
        !data.board.every(v => v === 0 || tile(v)) ||
        !Array.isArray(data.tray) || data.tray.length !== 3 || !data.tray.some(Boolean) ||
        !integer(data.score) || !integer(data.moves) ||
        !(data.maxTile === 0 || tile(data.maxTile)) ||
        !integer(data.slides) || data.slides > 5 || // önceki sürümün 5 haklık kayıtlarını da kabul et
        !integer(data.slidesEarned) ||
        (data.slideProgress !== undefined && (!(data.version === 4 ? integer(data.slideProgress * 2) : integer(data.slideProgress)) || data.slideProgress > ([2, 3].includes(data.version) ? 10 : 5))) ||
        !tile(data.slideMark) || data.slideMark < 32 ||
        typeof data.won !== 'boolean' ||
        (data.winPending !== undefined && typeof data.winPending !== 'boolean')) return null;
    const tray = [];
    for (const p of data.tray) {
      if (p === null) { tray.push(null); continue; }
      const shape = p && core.SHAPES.find(s => s.name === p.name);
      if (!shape || !tile(p.value)) return null;
      tray.push({ ...shape, cells: shape.cells.map(cell => cell.slice()), value: p.value });
    }
    const maxTile = Math.max(data.maxTile, ...data.board);
    const restored = { size, board: data.board.slice(), tray, score: data.score,
      moves: data.moves, maxTile, mode: 'soft', slides: Math.min(data.slides, core.DEFAULT_TUNING.slideCap),
      slideMark: data.slideMark, slidesEarned: data.slidesEarned,
      slideProgress: (data.slideProgress || 0) * ([2, 3].includes(data.version) ? 0.5 : 1), // eski yüzdeyi koru
      won: data.won || maxTile >= core.GOAL,
      winPending: !!data.winPending && maxTile >= core.GOAL,
      rng: Math.random, tune: { ...core.DEFAULT_TUNING } };
    // Eski ya da yarım kalmış bir kayıtta hazır hak varsa depoya aktar.
    if (restored.slideProgress === restored.tune.slideTrayTarget && restored.slides < restored.tune.slideCap) {
      restored.slides++; restored.slidesEarned++; restored.slideProgress = 0;
    }
    restored.over = core.computeOver(restored);
    return restored;
  }

  const IDLE = 'Bir parçayı tahtaya sürükle.';
  const IDLE_SLIDE = 'Bir parçayı sürükle ya da kaydırma hakkını kullan.';
  const STUCK = 'Hiçbir parça sığmıyor. Kaydırma hakkıyla yer aç.';
  const idleHint = () => (g && g.slides > 0 ? IDLE_SLIDE : IDLE);

  let g = null;
  let busy = false;
  let drag = null;
  let M = null;
  let shownScore = 0;
  let confirmFn = null;
  let pending = null; // önizlemesi gösterilen kaydırma yönü
  let swipe = null;
  let best = 0;
  function loadBest(size) {
    const keys = size === 8 ? ['blok2048.best.8', 'blok2048.best', 'blok2048.best.hard', 'blok2048.best.soft'] : ['blok2048.best.' + size];
    return Math.max(0, ...keys.map(key => store.get(key, 0)).filter(v => Number.isSafeInteger(v) && v >= 0));
  }
  function configureBoard(size) {
    C = BlokCore.createCore(size);
    ({ SIZE, N } = C);
    tiles = new Array(N).fill(null);
    el.layer.replaceChildren();
    el.grid.replaceChildren();
    el.board.style.setProperty('--size', SIZE);
    for (let i = 0; i < N; i++) {
      const cell = document.createElement('div'); cell.className = 'cell'; el.grid.appendChild(cell);
    }
    best = loadBest(size);
    for (const button of sizeButtons) button.dataset.current = String(Number(button.dataset.size) === size);
  }
  const sizeButtons = Array.from(document.querySelectorAll('.size-btn'));
  let tiles = new Array(N).fill(null);

  // Görsel efektler oyun durumundan bağımsızdır; azaltılmış harekette üretilmez.
  const effects = new Set();
  let denseAnimation = false;
  const activePulses = new Set();
  function effectNode(cls, lifetime = 650, parent = el.fx) {
    const node = document.createElement('div');
    node.className = cls;
    node.setAttribute('aria-hidden', 'true');
    parent.appendChild(node);
    effects.add(node);
    setTimeout(() => { node.remove(); effects.delete(node); }, lifetime);
    return node;
  }
  function effectPos(node, i) {
    const c = i % SIZE, r = Math.floor(i / SIZE);
    node.style.left = 'calc(' + c + ' * (var(--tile) + var(--gap)) + var(--tile) / 2)';
    node.style.top = 'calc(' + r + ' * (var(--tile) + var(--gap)) + var(--tile) / 2)';
  }
  function burst(i, gold = false) {
    if (reduced || effects.size >= (denseAnimation ? 8 : 20)) return;
    const ring = effectNode('fx-ring');
    effectPos(ring, i);
    if (gold) ring.style.borderColor = 'var(--gold-hi)';
    if (denseAnimation) return;
    for (let k = 0; k < 4; k++) {
      const dot = effectNode('fx-dot');
      effectPos(dot, i);
      const a = k * Math.PI / 2;
      dot.style.setProperty('--dx', Math.cos(a) * 32 + 'px');
      dot.style.setProperty('--dy', Math.sin(a) * 32 + 'px');
      dot.style.setProperty('--spark', gold ? 'var(--gold-hi)' : (k % 2 ? 'var(--mint)' : 'var(--accent)'));
    }
  }
  function lineEffects(res) {
    if (reduced) return;
    for (const ln of res.lines) {
      if (effects.size >= (denseAnimation ? 4 : 8)) break;
      const sweep = effectNode('fx-line ' + ln.kind);
      const offset = 'calc(' + ln.index + ' * (var(--tile) + var(--gap)))';
      if (ln.kind === 'row') {
        sweep.style.left = '0'; sweep.style.top = offset;
        sweep.style.width = '100%'; sweep.style.height = 'var(--tile)';
      } else {
        sweep.style.top = '0'; sweep.style.left = offset;
        sweep.style.height = '100%'; sweep.style.width = 'var(--tile)';
      }
    }
  }
  function combo(text) {
    if (reduced || effects.size >= 48) return;
    effectNode('combo', 1100).textContent = text;
  }
  function celebrate() {
    if (reduced) return;
    for (let k = 0; k < 28; k++) {
      if (effects.size >= 48) break;
      const confetti = effectNode('confetti', 2000, el.board);
      confetti.style.left = (5 + k * 90 / 27) + '%';
      confetti.style.animationDelay = (k % 7) * 45 + 'ms';
      confetti.style.setProperty('--dx', ((k % 5) - 2) * 22 + 'px');
      confetti.style.setProperty('--rot', (k % 2 ? 480 : -360) + 'deg');
      confetti.style.setProperty('--spark', ['var(--mint)', 'var(--gold-hi)', 'var(--accent)', 'var(--t128)'][k % 4]);
    }
  }

  // ---------- taş elemanları ----------
  function paintTile(t, v) {
    t._v = v;
    const face = t._face || t;
    face.dataset.v = v <= 2048 ? String(v) : 'big';
    face.dataset.d = String(Math.min(6, String(v).length));
    face.firstChild.textContent = v;
  }
  function makeTile(v) {
    const t = document.createElement('div');
    t.className = 'tile';
    t.appendChild(document.createElement('span'));
    paintTile(t, v);
    return t;
  }
  function setPos(t, i) {
    if (t._index === i) return;
    t._index = i;
    // Do not mutate inherited custom properties on every move: that restyles the face and text.
    t.style.transform = 'translate3d(calc(' + (i % SIZE) + ' * (100% + var(--gap))), calc(' + Math.floor(i / SIZE) + ' * (100% + var(--gap))), 0)';
  }
  function addTile(i, v, anim) {
    removeTile(i);
    // The outer layer only moves; the inner face owns appearance and the merge pulse.
    const t = document.createElement('div');
    t.className = 'bt';
    t._face = makeTile(v);
    t._v = v;
    t.appendChild(t._face);
    if (anim) t.classList.add(anim);
    setPos(t, i);
    el.layer.appendChild(t);
    tiles[i] = t;
    return t;
  }
  function removeTile(i) {
    const t = tiles[i];
    if (t) { t.remove(); tiles[i] = null; }
  }
  function bump(t) {
    if (reduced) return;
    t.style.animationDelay = '0ms';
    t.classList.remove('bump', 'pop', 'flash', 'keep');
    if (t._bump) t._bump.cancel();
    // A dense move can merge 32 tiles at once. Keep the travel animation for all
    // tiles, but do not create 32 additional scaling layers at the same instant.
    if (activePulses.size >= (denseAnimation ? 4 : 8)) return;
    t._bump = t._face.animate([
      { transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.35 },
      { transform: 'scale(.98)', offset: 0.7 }, { transform: 'scale(1)' },
    ], { duration: 240, easing: 'ease-out' });
    const pulse = t._bump;
    activePulses.add(pulse);
    pulse.finished.then(() => activePulses.delete(pulse), () => activePulses.delete(pulse));
  }
  function moveTile(t, index, duration) {
    if (!t || t._index === index) return Promise.resolve();
    const from = t.style.transform;
    setPos(t, index);
    // Wait for the actual compositor animation, not a timer that can outrun a busy frame.
    const animation = t.animate([{transform:from}, {transform:t.style.transform}], {
      duration, easing:'cubic-bezier(.22,.8,.35,1)',
    });
    return animation.finished.catch(() => {});
  }
  function syncTiles() {
    for (let i = 0; i < N; i++) {
      const v = g.board[i];
      if (!v) removeTile(i);
      else if (!tiles[i]) addTile(i, v);
      else {
        tiles[i].classList.remove('flash', 'keep', 'out');
        tiles[i].style.animationDelay = '0ms';
        if (tiles[i]._v !== v) paintTile(tiles[i], v);
        setPos(tiles[i], i);
      }
    }
  }

  function floatText(i, text, cls) {
    if (reduced || denseAnimation || effects.size >= 24) return;
    const d = effectNode('float' + (cls ? ' ' + cls : ''), 1100);
    d.textContent = text;
    d.style.left = (((i % SIZE) + 0.5) / SIZE * 100) + '%';
    d.style.top = ((Math.floor(i / SIZE) + 0.5) / SIZE * 100) + '%';
  }

  // ---------- parça görünümü ----------
  function pieceView(p, mc, mg) {
    const v = document.createElement('div');
    v.className = 'piece';
    v.style.setProperty('--w', p.w);
    v.style.setProperty('--h', p.h);
    v.style.setProperty('--mc', mc + 'px');
    v.style.setProperty('--mg', mg + 'px');
    for (const [r, c] of p.cells) {
      const t = makeTile(p.value);
      t.style.gridArea = (r + 1) + ' / ' + (c + 1);
      v.appendChild(t);
    }
    return v;
  }

  function renderTray(fresh) {
    const gapPx = 10;
    const slotW = (el.tray.clientWidth - gapPx * 2) / 3;
    const boardCell = M ? M.cell : 36;
    const mc = Math.max(10, Math.min(18, Math.round(boardCell * 0.58), Math.floor((slotW - 18 - 6) / 4)));
    el.tray.style.setProperty('--mc', mc + 'px');
    el.tray.replaceChildren();
    g.tray.forEach((p, slot) => {
      const s = document.createElement('div');
      s.className = 'slot' + (p ? '' : ' empty');
      s.dataset.slot = String(slot);
      if (p) {
        if (!C.fits(g.board, p)) s.classList.add('stuck');
        if (fresh) s.classList.add('fresh');
        s.appendChild(pieceView(p, mc, 2));
        s.addEventListener('pointerdown', onDown);
        s.addEventListener('pointermove', onMove);
        s.addEventListener('pointerup', onUp);
        s.addEventListener('pointercancel', onCancel);
      }
      el.tray.appendChild(s);
    });
  }

  // ---------- ölçü ----------
  function fitBoard() {
    if (screen !== 'game') return;
    const game = $('gameScreen');
    const style = getComputedStyle(game);
    const body = getComputedStyle(document.body);
    const occupied = Array.from(game.children).filter(node => node !== el.board && !node.hidden)
      .reduce((sum, node) => sum + node.getBoundingClientRect().height, 0);
    const safe = parseFloat(body.paddingTop) + parseFloat(body.paddingBottom);
    game.style.setProperty('--board-space', Math.max(180, window.innerHeight - occupied - 5 * parseFloat(style.rowGap) - 16 - safe - 4) + 'px');
  }
  window.addEventListener('resize', () => {
    if (screen === 'game') { endDrag(); fitBoard(); measure(); renderTray(false); }
  });
  function measure() {
    const cells = el.grid.children;
    const a = cells[0].getBoundingClientRect();
    const b = cells[1].getBoundingClientRect();
    M = { x0: a.left, y0: a.top, cell: a.width, pitch: b.left - a.left, gap: b.left - a.right };
  }

  // ---------- sürükle bırak ----------
  function findTarget(p, fr, fc) {
    const r0 = Math.round(fr), c0 = Math.round(fc);
    let best = null, bd = Infinity;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (!C.canPlace(g.board, p, r, c)) continue;
        const d = Math.hypot(r - fr, c - fc);
        if (d < bd) { bd = d; best = { r, c }; }
      }
    }
    return bd <= 1.0 ? best : null;
  }

  function onDown(e) {
    if (busy || g.over || g.winPending || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (pending) cancelPending();
    const slotEl = e.currentTarget;
    const slot = Number(slotEl.dataset.slot);
    const p = g.tray[slot];
    if (!p) return;
    e.preventDefault();
    measure();
    const ghost = pieceView(p, M.cell, M.gap);
    ghost.classList.add('ghost');
    drag = { slot, p, ghost, id: e.pointerId, target: null, touch: e.pointerType !== 'mouse', slotEl, key: '', frame: null, point: null };
    // Position before attaching: layout reads must never expose a ghost at (0, 0).
    moveGhost(e);
    document.body.appendChild(ghost);
    slotEl.classList.add('lifted');
    try { slotEl.setPointerCapture(e.pointerId); } catch (err) { /* yakalama desteklenmiyor */ }
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.point = { clientX: e.clientX, clientY: e.clientY };
    if (drag.frame !== null) return;
    drag.frame = requestAnimationFrame(() => {
      drag.frame = null;
      moveGhost(drag.point);
    });
  }
  function moveGhost(e) {
    // Geometry is measured on pickup; resizing cancels the drag.
    const p = drag.p;
    const w = p.w * M.pitch - M.gap;
    const h = p.h * M.pitch - M.gap;
    const lift = drag.touch ? M.cell * 1.7 : M.cell * 0.5;
    const gx = e.clientX - w / 2;
    const gy = e.clientY - h / 2 - lift;
    drag.ghost.style.transform = 'translate3d(' + gx + 'px, ' + gy + 'px, 0)';
    const t = findTarget(p, (gy - M.y0) / M.pitch, (gx - M.x0) / M.pitch);
    const key = t ? t.r + ',' + t.c : '';
    if (key !== drag.key) {
      drag.key = key;
      drag.target = t;
      renderPreview();
    }
  }
  function endDrag() {
    const d = drag;
    drag = null;
    if (!d) return null;
    if (d.frame !== null) cancelAnimationFrame(d.frame);
    d.ghost.remove();
    d.slotEl.classList.remove('lifted');
    el.pv.replaceChildren();
    return d;
  }
  function onCancel(e) {
    if (!drag || e.pointerId !== drag.id) return;
    endDrag();
    setHint(idleHint());
  }
  async function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    // A release can arrive before the queued frame; use the final pointer position.
    moveGhost(e);
    const d = endDrag();
    if (d.target) await play(d.slot, d.target.r, d.target.c, d.p);
    else setHint('Parça oraya sığmıyor. Başka bir yere bırak.');
  }

  function pvMark(i, cls, extra) {
    const d = document.createElement('div');
    d.className = 'pvm ' + cls;
    setPos(d, i);
    if (extra) d.appendChild(extra);
    el.pv.appendChild(d);
    return d;
  }
  function renderPreview() {
    el.pv.replaceChildren();
    if (!drag.target) { setHint('Parça oraya sığmıyor. Başka bir yere bırak.'); return; }
    const { r, c } = drag.target;
    const res = C.resolve(g.board, drag.p, r, c, g.mode);
    for (const m of res.merges) {
      pvMark(m.gone, 'mergefrom');
      if (res.board[m.at] === m.value) {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = m.value;
        pvMark(m.at, 'merge', b);
      }
    }
    for (const i of res.placed) {
      if (res.board[i] === 0) continue;
      const t = makeTile(res.board[i]);
      t.classList.add('pvm', 'place');
      setPos(t, i);
      el.pv.appendChild(t);
    }
    setHint('Bu hamle +' + fmt(res.gained.total) + ' puan' + noteBits(res) + '.');
  }

  function noteBits(res) {
    const bits = [];
    if (res.merges.length === 1) bits.push('1 birleşme');
    else if (res.merges.length > 1) bits.push('zincir ×' + res.merges.length);
    if (res.lines.length) bits.push(res.lines.length + ' dolu çizgide birleşme');
    return bits.length ? ': ' + bits.join(', ') : '';
  }
  function setHint(t) { el.hint.textContent = t; }

  async function paintMergeResults(items) {
    // Changing 32 textured faces in one frame can stall Android rasterization.
    // Spread only dense result updates across frames; all tile travel stays animated.
    for (let offset = 0; offset < items.length; offset += 8) {
      if (items.length > 8 && !document.hidden) await new Promise(requestAnimationFrame);
      for (const { m, gone, at } of items.slice(offset, offset + 8)) {
        if (gone) gone.remove();
        if (at) { paintTile(at, m.value); bump(at); burst(m.at, m.kind === 'line' || m.value >= 64); }
        floatText(m.at, '+' + fmt(m.points), m.kind === 'line' ? 'gold' : '');
      }
    }
  }

  async function animateMerges(merges) {
    // Disjoint merges can share a frame. Dependent chain steps retain their order.
    const batches = [];
    const lastLevel = new Array(N).fill(-1);
    for (const m of merges) {
      const level = Math.max(lastLevel[m.gone], lastLevel[m.at]) + 1;
      (batches[level] ||= []).push(m);
      lastLevel[m.gone] = lastLevel[m.at] = level;
    }
    const travelMs = Math.min(160, 720 / Math.max(1, batches.length));
    const settleMs = Math.min(40, 120 / Math.max(1, batches.length));
    for (const group of batches) {
      const moving = group.map(m => {
        const gone = tiles[m.gone], at = tiles[m.at];
        if (gone) {
          tiles[m.gone] = null;
          gone.style.zIndex = '3';
          gone.classList.remove('pop', 'bump');
        }
        return { m, gone, at, finished:moveTile(gone, m.at, travelMs) };
      });
      await Promise.all(moving.map(item => item.finished));
      await paintMergeResults(moving);
      await wait(settleMs);
    }
  }

  // ---------- hamle ve animasyon ----------
  async function play(slot, r, c, piece) {
    if (busy || g.winPending) return;
    busy = true;
    const res = C.applyMove(g, slot, r, c);
    if (!res) { busy = false; return; }
    denseAnimation = res.merges.length > 8;
    el.board.classList.toggle('animating', !reduced);
    saveGame();
    syncSlideUI();

    const slotEl = el.tray.children[slot];
    if (slotEl) { slotEl.className = 'slot empty'; slotEl.replaceChildren(); }

    if (reduced) {
      syncTiles();
    } else {
      res.placed.forEach((i, k) => {
        const t = addTile(i, piece.value, 'pop');
        if (!reduced) t.style.animationDelay = Math.min(k * 18, 90) + 'ms';
      });
      await wait(150);

      if (res.lines.length) lineEffects(res);
      await animateMerges(res.merges);
    }

    if (window.__BLOK_TEST) {
      const dom = tiles.map(t => (t ? t._v : 0));
      if (dom.some((v, i) => v !== g.board[i])) window.__BLOK_TEST.mismatches = (window.__BLOK_TEST.mismatches || 0) + 1;
    }
    syncTiles();
    if (res.lines.length > 1) combo(res.lines.length + ' çizgi birden!');
    else if (res.merges.length >= 2) combo('Zincir ×' + res.merges.length);
    setScore(g.score);
    updateBest();
    updateGoal();
    setHint('+' + fmt(res.gained.total) + ' puan' + noteBits(res) + '.' + earnedNote(res));
    renderTray(res.refilled);

    if (res.reachedGoal) showWin();
    else if (res.over) showOver();
    busy = false;
    el.board.classList.remove('animating');
    syncSlideUI(res.slideEarned.length > 0);
    if (!res.over && stuck()) setHint(STUCK);
  }

  // ---------- kaydırma hakkı ----------
  const DIR_TEXT = { left: 'Sola', right: 'Sağa', up: 'Yukarı', down: 'Aşağı' };

  const stuck = () => g.slides > 0 && !g.tray.some(p => p && C.fits(g.board, p));

  function earnedNote(res) {
    if (res.slideEarned && res.slideEarned.length) return res.refilled ? ' Beş tepsi tamamlandı: 1 kaydırma hakkı kazandın.' : ' Bekleyen kaydırma hakkı depoya eklendi.';
    if (res.refilled && g.slideProgress === g.tune.slideTrayTarget) return ' Kaydırma hakkı hazır; depo dolu. Bir hak kullanınca eklenecek.';
    if (res.refilled) return ' Kaydırma göstergesi %' + (g.slideProgress * 100 / g.tune.slideTrayTarget) + '.';
    return '';
  }

  function slideBits(s, past) {
    const bits = [];
    const count = s.merges + s.lineMerges.length;
    if (count) bits.push(count + ' birleşme');
    if (s.lines.length) bits.push(s.lines.length + ' dolu çizgide birleşme');
    return bits.length ? ', ' + bits.join(', ') : '';
  }

  function syncSlideUI(earned) {
    for (const id of ['newBtn', 'lobbyBtn', 'resumeBtn', 'confirmYes', 'againBtn', 'winNewBtn']) $(id).disabled = busy;
    for (const button of sizeButtons) button.disabled = busy;
    const pips = el.pips.children;
    for (let i = 0; i < pips.length; i++) pips[i].className = i < g.slides ? (earned && i === g.slides - 1 ? 'on new' : 'on') : '';
    const percent = g.slideProgress * 100 / g.tune.slideTrayTarget;
    const ready = percent === 100;
    el.more.textContent = ready ? 'Hazır' : '%' + percent;
    el.more.hidden = false;
    el.more.title = ready ? '1 hak bekliyor; depoda yer açınca eklenecek' : 'Her tepsi yenilenmesinde +%20; beş tepside 1 hak';
    el.slideFill.style.transform = 'scaleX(' + percent / 100 + ')';
    el.slideProgress.setAttribute('aria-valuenow', String(percent));
    el.slideProgress.setAttribute('aria-valuetext', ready ? '1 kaydırma hakkı hazır, depoda bekliyor' : '%' + percent + ', ' + g.slideProgress + ' / ' + g.tune.slideTrayTarget + ' tepsi');
    el.slideProgress.classList.toggle('charged', ready);
    el.pips.setAttribute('aria-label', g.slides + ' kaydırma hakkın var, en fazla 2 hak depolanır');
    const can = g.slides > 0 && !busy && !g.over && !g.winPending;
    for (const b of el.dirBtns) {
      b.disabled = !can;
      b.setAttribute('aria-pressed', String(can && pending === b.dataset.dir));
    }
    el.have.hidden = !!pending;
    el.cancel.hidden = !pending;
    el.slidebar.classList.toggle('ready', can);
  }

  function renderSlidePreview(s) {
    el.pv.replaceChildren();
    const mergedAt = new Set();
    for (const m of s.moves) if (m.merged) mergedAt.add(m.to);
    for (const m of s.lineMerges) mergedAt.add(m.at);
    for (let i = 0; i < N; i++) {
      const v = s.board[i];
      if (!v) continue;
      const t = makeTile(v);
      t.classList.add('pvm', 'fin');
      if (mergedAt.has(i)) t.classList.add('merge');
      setPos(t, i);
      el.pv.appendChild(t);
    }
    el.board.classList.add('previewing');
  }

  function cancelPending() {
    if (!pending) return;
    pending = null;
    el.pv.replaceChildren();
    el.board.classList.remove('previewing');
    syncSlideUI();
    setHint(stuck() ? STUCK : idleHint());
  }

  // Aynı yöne ikinci kez basış (ya da ikinci kaydırma) hamleyi uygular
  function selectDir(dir) {
    if (!g || busy || drag || g.over || g.winPending) return;
    if (g.slides <= 0) { setHint('Kaydırma hakkın yok. Oynadıkça kazanırsın.'); return; }
    if (pending === dir) { playSlide(dir); return; }
    const s = C.slide(g.board, dir, g.mode);
    if (!s.changed) {
      if (pending) cancelPending();
      setHint(DIR_TEXT[dir] + ' kaydırınca tahta değişmez.');
      return;
    }
    pending = dir;
    renderSlidePreview(s);
    syncSlideUI();
    setHint(DIR_TEXT[dir] + ': ' + (s.gained.total ? '+' + fmt(s.gained.total) + ' puan' : 'puan yok') + slideBits(s, false) + '. Uygulamak için aynı yöne tekrar bas.');
  }

  async function playSlide(dir) {
    if (!g || busy || drag || g.winPending) return;
    const res = C.applySlide(g, dir);
    if (!res) return;
    denseAnimation = res.merges + res.lineMerges.length > 8;
    el.board.classList.toggle('animating', !reduced);
    saveGame();
    busy = true;
    pending = null;
    el.pv.replaceChildren();
    el.board.classList.remove('previewing');
    syncSlideUI();

    if (reduced) {
      syncTiles();
    } else {
      // Taşlar yeni yerine kayar, birleşenler üst üste biner
      const next = new Array(N).fill(null);
      const gone = [];
      for (const m of res.moves) {
        next[m.to] = tiles[m.from[0]];
        if (m.from.length === 2) gone.push({ t: tiles[m.from[1]], to: m.to });
      }
      el.layer.classList.add('sliding');
      const movement = res.moves.map(m => moveTile(next[m.to], m.to, 200));
      for (const o of gone) if (o.t) {
        o.t.style.zIndex = '1'; movement.push(moveTile(o.t, o.to, 200));
      }
      await Promise.all(movement);
      await paintMergeResults(res.moves.filter(m => m.merged && next[m.to]).map(m => ({
        m:{at:m.to, value:m.value, points:m.value, kind:'slide'}, at:next[m.to],
      })));
      for (const o of gone) if (o.t) o.t.remove();
      tiles.fill(null);
      for (let i = 0; i < N; i++) tiles[i] = next[i];
      el.layer.classList.remove('sliding');
      if (res.merges) await wait(170);

      if (res.lines.length) lineEffects(res);
      await animateMerges(res.lineMerges);
    }

    if (window.__BLOK_TEST) {
      const dom = tiles.map(t => (t ? t._v : 0));
      if (dom.some((v, i) => v !== g.board[i])) window.__BLOK_TEST.mismatches = (window.__BLOK_TEST.mismatches || 0) + 1;
    }
    syncTiles();
    if (res.lines.length > 1) combo(res.lines.length + ' çizgi birden!');
    else if (res.merges >= 2) combo(res.merges + ' birleşme!');
    setScore(g.score);
    updateBest();
    updateGoal();
    setHint(DIR_TEXT[dir] + ' kaydırdın: ' + (res.gained.total ? '+' + fmt(res.gained.total) + ' puan' : 'puan yok') + slideBits(res, true) + '.' + earnedNote(res));
    renderTray(false);

    if (res.reachedGoal) showWin();
    else if (res.over) showOver();
    busy = false;
    el.board.classList.remove('animating');
    syncSlideUI(res.slideEarned.length > 0);
    if (!res.over && stuck()) setHint(STUCK);
  }

  for (const b of el.dirBtns) b.addEventListener('click', () => selectDir(b.dataset.dir));
  el.cancel.addEventListener('click', cancelPending);

  document.addEventListener('keydown', e => {
    if (screen !== 'game' || !g || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[e.key]) {
      if (g.slides <= 0 || g.over) return; // hakkın yokken oklar sayfayı kaydırmaya devam etsin
      e.preventDefault();
      selectDir(map[e.key]);
    } else if (e.key === 'Escape') cancelPending();
  });

  // Tahta üzerinde kaydırma hareketi (parmak ya da fare)
  el.board.addEventListener('pointerdown', e => {
    if (e.target.closest('.overlay') || drag || busy) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  window.addEventListener('pointerup', e => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.hypot(dx, dy) < 30 || !g || busy || drag || g.over) return;
    selectDir(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
  });
  window.addEventListener('pointercancel', () => { swipe = null; });

  // ---------- skor, hedef, katmanlar ----------
  function setScore(to) {
    const from = shownScore;
    shownScore = to;
    if (to > from && !reduced) {
      const card = el.score.parentElement;
      if (card._scoreAnimation) card._scoreAnimation.cancel();
      card._scoreAnimation = el.score.animate(
        [{transform:'scale(1)'}, {transform:'scale(1.06)'}, {transform:'scale(1)'}],
        {duration:300, easing:'ease-out'}
      );
    }
    el.score.textContent = fmt(to);
  }
  function updateBest() {
    best = Math.max(best, g.score);
    store.set('blok2048.best.' + SIZE, best);
    if (SIZE === 8) store.set('blok2048.best', best);
    el.best.textContent = fmt(best);
  }
  function updateGoal() {
    el.maxv.textContent = g.maxTile ? fmt(g.maxTile) : '0';
    const frac = g.maxTile >= 2 ? Math.min(1, (Math.log2(g.maxTile) - 1) / 10) : 0;
    el.bar.style.transform = 'scaleX(' + frac + ')';
  }
  function showOver() {
    $('overText').textContent = 'Hiçbir parça sığmıyor. Skor ' + fmt(g.score) + ', en büyük taş ' + fmt(g.maxTile) + '.';
    el.over.hidden = false;
    $('againBtn').focus({ preventScroll: true });
  }
  function showWin() {
    celebrate();
    $('winText').textContent = 'Skor ' + fmt(g.score) + ', ' + fmt(g.moves) + ' hamlede. İstersen aynı tahtada devam edebilirsin.';
    el.win.hidden = false;
    $('keepBtn').focus({ preventScroll: true });
  }

  // ---------- yeni oyun ----------
  function askConfirm(msg, label, fn) {
    $('confirmMsg').textContent = msg;
    $('confirmYes').textContent = label;
    confirmFn = fn;
    $('confirm').hidden = false;
    $('confirmYes').focus({ preventScroll: true });
  }
  function closeConfirm() { $('confirm').hidden = true; confirmFn = null; }

  function renderAll() {
    for (const effect of effects) effect.remove();
    effects.clear();
    for (let i = 0; i < N; i++) removeTile(i);
    el.fx.replaceChildren();
    el.pv.replaceChildren();
    for (let i = 0; i < N; i++) if (g.board[i]) addTile(i, g.board[i]);
    el.over.hidden = true;
    el.win.hidden = true;
    pending = null;
    el.board.classList.remove('previewing');
    shownScore = g.score;
    el.score.textContent = fmt(g.score);
    updateBest();
    updateGoal();
    measure();
    renderTray(false);
    syncSlideUI();
    setHint(g.over ? 'Oyun bitti.' : (stuck() ? STUCK : idleHint()));
  }
  function startGame(size = SIZE) {
    if (busy) return;
    endDrag();
    swipe = null;
    closeConfirm();
    configureBoard(size);
    g = C.newGame({ start: 4 });
    store.set('blok2048.size', size);
    busy = false;
    drag = null;
    saveGame();
    renderAll();
    showScreen('game');
  }
  function wantNewGame() {
    if (busy) return;
    if (g.moves === 0 || g.over) { startGame(); return; }
    askConfirm(SIZE + '×' + SIZE + ' kaydı sıfırlanır. Yeni oyun başlasın mı?', 'Yeni oyun', () => startGame());
  }

  function openBoard(size) {
    if (busy) return;
    if (size === SIZE && hasSavedGame) { showScreen('game'); return; }
    if (hasSavedGame) saveGame();
    const restored = restoreSizedGame(size);
    if (!restored) { startGame(size); return; }
    endDrag();
    swipe = null;
    closeConfirm();
    configureBoard(size);
    g = restored;
    store.set('blok2048.size', size);
    saveGame();
    renderAll();
    showScreen('game');
  }

  for (const button of sizeButtons) button.addEventListener('click', () => {
    const size = Number(button.dataset.size);
    openBoard(size);
  });

  $('newBtn').addEventListener('click', () => wantNewGame());
  $('lobbyBtn').addEventListener('click', () => showScreen('lobby'));
  $('resumeBtn').addEventListener('click', () => showScreen('game'));
  $('confirmYes').addEventListener('click', () => { const f = confirmFn; closeConfirm(); if (f) f(); });
  $('confirmNo').addEventListener('click', closeConfirm);
  $('againBtn').addEventListener('click', () => startGame());
  $('winNewBtn').addEventListener('click', () => startGame());
  $('keepBtn').addEventListener('click', () => {
    el.win.hidden = true;
    g.winPending = false;
    saveGame();
    syncSlideUI();
    if (g.over) showOver();
  });

  // ---------- başlangıç ----------
  const legend = $('legend');
  for (const v of [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]) legend.appendChild(makeTile(v));

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => { if (screen === 'game' && g && !drag && !busy) { fitBoard(); measure(); renderTray(false); } });
    for (const node of [$('gameScreen'), el.hint, el.slidebar, el.tray, document.querySelector('.stats')]) observer.observe(node);
  }

  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(snapshot);
  function boot(data) {
    const preferred = store.get('blok2048.size', 8);
    const restored = restoreGame(data) || restoreGame(store.get(SAVE_KEY, null)) || restoreSizedGame(preferred);
    hasSavedGame = !!restored;
    configureBoard(restored ? restored.size : ([5, 6, 7, 8].includes(preferred) ? preferred : 8));
    g = restored || C.newGame({ start: 4 });
    if (restored) saveGame(); // Tek kayıt kullanan eski sürümü boyuta özel kayda taşı.
    renderAll();
    showScreen('lobby');
  }
  if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data ? hot.data : {});

  // Yalnızca otomatik test sırasında (test bayrağı varken) kullanılan kanca
  if (window.__BLOK_TEST) {
    Object.defineProperty(window.__BLOK_TEST, 'g', { get: () => g });
    Object.assign(window.__BLOK_TEST, { play, playSlide, selectDir, cancelPending, syncSlideUI, renderAll, measure, showOver, showWin, isBusy: () => busy });
  }
})();
