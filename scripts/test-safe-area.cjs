const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const [width,height,top,right,bottom,left] of [[390,844,24,0,0,0],[320,568,32,0,16,0],[844,390,0,32,0,0],[844,390,0,0,0,32]]) {
      const page = await browser.newPage({viewport:{width,height}});
      await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:8204');
      await page.evaluate(({top,right,bottom,left}) => {
        document.documentElement.dataset.theme = 'dark';
        for (const [side,value] of Object.entries({top,right,bottom,left})) {
          document.documentElement.style.setProperty('--safe-area-inset-'+side,value+'px');
        }
        window.dispatchEvent(new Event('resize'));
      }, {top,right,bottom,left});
      const layout = await page.evaluate(() => ({
        bodyTop:document.body.getBoundingClientRect().top,
        rootPadding:getComputedStyle(document.documentElement).paddingTop,
        bodyPadding:getComputedStyle(document.body).paddingTop,
        background:getComputedStyle(document.body).backgroundImage,
        header:document.querySelector('.lobby-header').getBoundingClientRect().top,
      }));
      assert.equal(layout.bodyTop,0);
      assert.equal(layout.rootPadding,'0px');
      assert.equal(layout.bodyPadding,top+'px');
      assert.notEqual(layout.background,'none');
      assert(layout.header>=top);
      if (width===390) await page.screenshot({path:'preview-safe-area.png'});
      for (const size of [5,6,7,8]) {
        await page.click('#size'+size);
        await page.waitForFunction(() => document.querySelector('#tray').getBoundingClientRect().bottom<=innerHeight+1);
        const bounds = await page.locator('#board').boundingBox();
        assert(bounds.x>=left && bounds.x+bounds.width<=width-right+1);
        assert(bounds.y>=top);
        await page.click('#lobbyBtn');
      }
      console.log('PASS safe area',JSON.stringify({width,height,top,right,bottom,left}));
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
