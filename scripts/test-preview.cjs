const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
function assertSave(actual, expected) {
  const normalize = text => {
    const data = JSON.parse(text);
    data.tray = data.tray.map(p => p && ({name:p.name,cells:p.cells,w:p.w,h:p.h,value:p.value}));
    return data;
  };
  assert.deepEqual(normalize(actual),normalize(expected));
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[320,568],[360,640],[390,844],[430,932],[844,390],[1280,800]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { window.__BLOK_TEST = {}; });
      await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:2048');
      assert(await page.locator('#lobby').isVisible());
      assert(!await page.locator('#resumeBtn').isVisible());
      assert.equal(await page.locator('html').getAttribute('data-motion'), 'full');
      if (!await page.locator('#settings').getAttribute('open').then(v => v !== null)) await page.click('#settings summary');
      assert.equal(await page.locator('select').count(), 0);
      await page.locator('input[name="motion"][value="system"]').check();
      assert.equal(await page.locator('html').getAttribute('data-motion'), 'reduced');
      await page.locator('input[name="motion"][value="on"]').check();
      assert.equal(await page.locator('html').getAttribute('data-motion'), 'full');
      await page.locator('input[name="motion"][value="off"]').check();
      for (const size of [5,6,7,8]) {
        await page.click('#size' + size);
        assert(await page.locator('#gameScreen').isVisible());
        assert.equal(await page.locator('.cell').count(), size * size);
        await page.waitForFunction(() => document.querySelector('#tray').getBoundingClientRect().bottom <= innerHeight + 1);
        if (width === 390) await page.waitForFunction(() => document.querySelector('#board').getBoundingClientRect().width >= 370);
        const bounds = await page.evaluate(() => {
          const b = document.querySelector('#board').getBoundingClientRect();
          const t = document.querySelector('#tray').getBoundingClientRect();
          return { w:b.width, h:b.height, right:b.right, bottom:t.bottom, scroll:document.documentElement.scrollWidth };
        });
        assert(Math.abs(bounds.w - bounds.h) < 1);
        assert(bounds.right <= width && bounds.scroll <= width);
        assert(bounds.bottom <= height + 1, JSON.stringify({ width,height,size,bounds }));
        if (width === 390) assert(bounds.w >= 370);
        await page.click('#lobbyBtn');
        assert(await page.locator('#resumeBtn').isVisible());
      }
      await page.click('#resumeBtn');
      // Exercise real pointer placement with an empty board and a known piece.
      const target = await page.evaluate(() => {
        const g = window.__BLOK_TEST.g;
        g.board.fill(0); g.over = false; g.winPending = false;
        const shape = BlokCore.createCore(g.size).SHAPES.find(p => p.name === 'dot');
        g.tray[0] = { ...shape, value:2 };
        window.__BLOK_TEST.renderAll();
        const a = document.querySelector('.cell').getBoundingClientRect();
        const s = document.querySelector('.slot').getBoundingClientRect();
        return { x:a.left+a.width/2,y:a.top+a.height,sx:s.left+s.width/2,sy:s.top+s.height/2,moves:g.moves };
      });
      await page.mouse.move(target.sx,target.sy);
      await page.mouse.down();
      await page.mouse.move(target.x,target.y,{steps:10});
      await page.mouse.up();
      await page.waitForFunction(() => !window.__BLOK_TEST.isBusy());
      assert.equal(await page.evaluate(() => window.__BLOK_TEST.g.moves), target.moves+1);
      if (width === 390) {
        const touchTarget = await page.evaluate(() => {
          const g = window.__BLOK_TEST.g; g.board.fill(0); g.over = false;
          g.tray[0] = { ...BlokCore.createCore(8).SHAPES.find(p => p.name === 'dot'), value:2 };
          window.__BLOK_TEST.renderAll();
          const a = document.querySelector('.cell').getBoundingClientRect();
          const s = document.querySelector('.slot').getBoundingClientRect();
          return { x:a.left+a.width/2, y:a.top+a.width*2.2, sx:s.left+s.width/2, sy:s.top+s.height/2, moves:g.moves };
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchTarget.sx,y:touchTarget.sy}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchTarget.x,y:touchTarget.y}]});
        // Holding a touch must keep exactly one visible ghost at a stable position.
        const held = await page.evaluate(async () => {
          const samples = [];
          for (let i = 0; i < 20; i++) {
            await new Promise(requestAnimationFrame);
            const ghost = document.querySelector('.ghost');
            const rect = ghost.getBoundingClientRect();
            const css = getComputedStyle(ghost);
            samples.push({x:rect.x,y:rect.y,count:document.querySelectorAll('.ghost').length,filter:css.filter,opacity:css.opacity});
          }
          return samples;
        });
        for (const sample of held) {
          assert.deepEqual(sample, held[0]);
          assert.equal(sample.count, 1);
          assert.equal(sample.filter, 'none');
          assert.equal(sample.opacity, '1');
          assert(sample.x > 0 && sample.y > 0);
        }
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.equal(await page.locator('.ghost').count(), 0);
        await page.waitForFunction(() => !window.__BLOK_TEST.isBusy());
        assert.equal(await page.evaluate(() => window.__BLOK_TEST.g.moves),touchTarget.moves+1);
        console.log('PASS touch drag');
      }
      const saved = await page.evaluate(() => localStorage.getItem('blok2048.game.v1'));
      await page.click('#lobbyBtn');
      if (!await page.locator('#settings').getAttribute('open').then(v => v !== null)) await page.click('#settings summary');
      await page.locator('input[name="theme"][value="dark"]').check();
      await page.click('#size5');
      assert(!await page.locator('#confirm').isVisible());
      assert.equal(await page.locator('.cell').count(),25);
      await page.evaluate(async () => {
        const g = window.__BLOK_TEST.g; g.board.fill(0); g.over = false;
        const p = { ...BlokCore.createCore(5).SHAPES.find(p => p.name === 'dot'), value:2 };
        g.tray[0] = p; window.__BLOK_TEST.renderAll();
        await window.__BLOK_TEST.play(0,0,0,p);
      });
      const saved5 = await page.evaluate(() => localStorage.getItem('blok2048.game.v1.5'));
      for (const size of [6,7,8,5]) {
        await page.click('#lobbyBtn');
        await page.click('#size' + size);
        assert.equal(await page.locator('.cell').count(),size*size);
        assert(await page.locator('#gameScreen').isVisible());
        assert(!await page.locator('#confirm').isVisible());
      }
      assertSave(await page.evaluate(() => localStorage.getItem('blok2048.game.v1')), saved5);
      await page.click('#lobbyBtn');
      await page.click('#size8');
      assertSave(await page.evaluate(() => localStorage.getItem('blok2048.game.v1')), saved);
      await page.reload();
      assert(await page.locator('#lobby').isVisible());
      assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
      assert.equal(await page.locator('input[name=motion]:checked').inputValue(), 'off');
      await page.click('#resumeBtn');
      assert.equal(await page.locator('.cell').count(),64);
      assertSave(await page.evaluate(() => localStorage.getItem('blok2048.game.v1')),saved);
      await page.click('#newBtn');
      assert(await page.locator('#confirm').isVisible());
      await page.click('#confirmNo');
      assertSave(await page.evaluate(() => localStorage.getItem('blok2048.game.v1')),saved);
      await page.click('#newBtn');
      await page.click('#confirmYes');
      assert.equal(await page.locator('.cell').count(),64);
      assert.equal(await page.evaluate(() => window.__BLOK_TEST.g.moves),0);
      assertSave(await page.evaluate(() => localStorage.getItem('blok2048.game.v1.5')),saved5);
      await page.click('#lobbyBtn');
      await page.click('#size5');
      assert.equal(await page.locator('.cell').count(),25);
      assertSave(await page.evaluate(() => localStorage.getItem('blok2048.game.v1')),saved5);
      assert(await page.locator('#gameScreen').isVisible());
      // Old single-slot saves migrate without changing the board or score.
      await page.evaluate(() => localStorage.removeItem('blok2048.game.v1.5'));
      await page.reload();
      assertSave(await page.evaluate(() => localStorage.getItem('blok2048.game.v1.5')),saved5);
      await page.click('#resumeBtn');
      assert.deepEqual(errors,[]);
      if (width === 390) {
        await page.screenshot({path:'preview-game.png'});
        await page.click('#lobbyBtn');
        await page.screenshot({path:'preview-lobby.png',fullPage:true});
      }
      console.log('PASS',width+'×'+height,'all sizes, separate saves, migration, drag, resume, reset, theme');
      await context.close();
    }
    const page = await browser.newPage();
    await page.goto('file:///' + require('path').resolve('Blok 2048 - tek dosya.html').replace(/\\/g,'/'));
    await page.click('#size8');
    assert.equal(await page.locator('.cell').count(),64);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.bt')).transitionDuration), '0.16s');
    console.log('PASS standalone HTML');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
