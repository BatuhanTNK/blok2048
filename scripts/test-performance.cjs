const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const motion of process.env.MOTION ? [process.env.MOTION] : ['off', 'on']) {
      const context = await browser.newContext({ viewport: { width:390, height:844 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(motion => {
        window.__BLOK_TEST = {};
        localStorage.setItem('blok2048.motion', JSON.stringify(motion));
      }, motion);
      await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:8204');
      const size = Number(process.env.BOARD_SIZE || 8);
      await page.click('#size' + size);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Emulation.setCPUThrottlingRate', {rate:Number(process.env.CPU_RATE || 1)});
      for (const scenario of process.env.SCENARIO ? [process.env.SCENARIO] : ['slide', 'chain']) {
        await page.evaluate(scenario => {
          const test = window.__BLOK_TEST, g = test.g;
          g.board.fill(0); g.over = false; g.winPending = false; g.won = true;
          g.slides = 2; g.score = 0;
          if (scenario === 'slide') {
            g.board = Array.from({length:g.size*g.size}, (_,i) => [2,2,4,4,8,8,16,16][i % g.size]);
          } else {
            [2,4,8,16,32,64,128].slice(0,g.size-1).forEach((v,i) => g.board[i+1] = v);
          }
          const dot = BlokCore.SHAPES.find(p => p.name === 'dot');
          g.tray = [0,1,2].map(() => ({...dot,value:2}));
          test.renderAll();
        }, scenario);
        await page.waitForTimeout(350);
        const trace = [];
        const collect = data => trace.push(...data.value);
        if (process.env.TRACE) {
          cdp.on('Tracing.dataCollected', collect);
          await cdp.send('Tracing.start', {categories:'devtools.timeline,disabled-by-default-devtools.timeline,blink.animations'});
        }
        const before = await cdp.send('Performance.getMetrics');
        const result = await page.evaluate(async scenario => {
          const test = window.__BLOK_TEST, g = test.g;
          const core = BlokCore.createCore(g.size);
          const expected = scenario === 'slide' ? core.slide(g.board,'left',g.mode) : core.resolve(g.board,g.tray[0],0,0,g.mode);
          let peakEffects = 0;
          const observer = new MutationObserver(() => {
            peakEffects = Math.max(peakEffects, document.querySelectorAll('.fx-dot,.fx-ring,.fx-line,.float,.combo').length);
          });
          observer.observe(document.querySelector('#board'), {childList:true,subtree:true});
          const frames = [];
          let previous, frameId;
          const sample = now => {
            if (previous !== undefined) frames.push(now-previous);
            previous = now;
            frameId = requestAnimationFrame(sample);
          };
          frameId = requestAnimationFrame(sample);
          await new Promise(requestAnimationFrame);
          const started = performance.now();
          if (scenario === 'slide') await test.playSlide('left');
          else await test.play(0,0,0,g.tray[0]);
          const elapsed = performance.now() - started;
          await new Promise(resolve => setTimeout(resolve,650));
          cancelAnimationFrame(frameId);
          observer.disconnect();
          frames.sort((a,b) => a-b);
          const dom = Array(g.size*g.size).fill(0);
          for (const tile of document.querySelectorAll('#layer .bt')) dom[tile._index] = Number(tile.textContent);
          return {elapsed,peakEffects,dom,animating:document.querySelector('#board').classList.contains('animating'),frames:{count:frames.length,p95:frames[Math.floor(frames.length*.95)],max:frames.at(-1),over25:frames.filter(n=>n>25).length},board:g.board,expected:expected.board,score:g.score,expectedScore:expected.gained.total,busy:test.isBusy(),mismatches:test.mismatches || 0};
        }, scenario);
        const after = await cdp.send('Performance.getMetrics');
        const metric = (r,n) => r.metrics.find(m => m.name === n).value;
        assert.deepEqual(result.board,result.expected);
        assert.deepEqual(result.dom,result.expected);
        assert.equal(result.animating,false);
        assert.equal(result.score,result.expectedScore);
        assert.equal(result.busy,false);
        assert.equal(result.mismatches,0);
        assert(result.peakEffects <= 48, 'Effect budget exceeded');
        if (motion === 'off') {
          assert.equal(result.peakEffects, 0, 'Disabled motion must not create effects');
          assert(result.elapsed < 500, 'Disabled motion must not wait through merge animations');
        }
        assert.deepEqual(errors,[]);
        let traceSummary;
        if (process.env.TRACE) {
          const completed = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
          await cdp.send('Tracing.end'); await completed;
          cdp.off('Tracing.dataCollected', collect);
          traceSummary = {};
          for (const name of ['Paint','Layout','UpdateLayoutTree','RasterTask']) {
            const events = trace.filter(e => e.name === name && e.ph === 'X');
            traceSummary[name] = {count:events.length,ms:Math.round(events.reduce((n,e)=>n+(e.dur||0),0)/1000)};
          }
          const failures = trace.filter(e=>e.args?.data?.compositeFailed);
          traceSummary.failures = {};
          for (const e of failures) {
            const key = JSON.stringify(e.args.data);
            traceSummary.failures[key] = (traceSummary.failures[key] || 0) + 1;
          }
          const paintNodes = new Map();
          for (const e of trace.filter(e=>e.name==='Paint' && e.args?.data?.nodeId)) {
            const id = e.args.data.nodeId;
            paintNodes.set(id,(paintNodes.get(id)||0)+1);
          }
          traceSummary.paintNodes = [];
          for (const [id,count] of [...paintNodes].sort((a,b)=>b[1]-a[1]).slice(0,5)) {
            try {
              const {node} = await cdp.send('DOM.describeNode',{backendNodeId:id});
              traceSummary.paintNodes.push({count,name:node.nodeName,attributes:node.attributes});
            } catch { traceSummary.paintNodes.push({id,count}); }
          }
        }
        console.log(JSON.stringify({size,motion,scenario,elapsedMs:Math.round(result.elapsed),peakEffects:result.peakEffects,frames:result.frames,layouts:metric(after,'LayoutCount')-metric(before,'LayoutCount'),trace:traceSummary}));
        await page.waitForTimeout(1200);
      }
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
