const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1366,height:768}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname,'../copywriting.html')).href);
    await page.evaluate(()=>goToSlide(6));
    assert.equal(await page.locator('#quizContainer > .card:visible').count(),1,'Show one quiz question at a time');
    for (let q=0;q<4;q++) {
      const answer = await page.evaluate(q=>quizData[q].answer,q);
      await page.locator(`#qOptions-${q} .quiz-opt`).nth(answer).click();
      if(q<3) await page.locator('#nextQuizBtn').click();
    }
    assert.equal(await page.locator('#quizScore').textContent(),'4/4');
    await page.evaluate(()=>goToSlide(7));
    for (const id of await page.locator('.drag-item').evaluateAll(items=>items.map(i=>i.dataset.id))) {
      const item=page.locator(`.drag-item[data-id="${id}"]`);
      const stage=await item.getAttribute('data-stage');
      if(id === '1') { await item.focus(); await page.keyboard.press('Enter'); await page.locator(`.drop-zone[data-stage="${stage}"]`).focus(); await page.keyboard.press('Enter'); }
      else { await item.click(); await page.locator(`.drop-zone[data-stage="${stage}"] > p`).click(); }
    }
    await page.locator('#checkDragBtn').click();
    assert.match(await page.locator('#dragFeedback').textContent(),/8\/8/);
    await page.locator('#resetDragBtn').click();
    assert.equal(await page.locator('#dragItemsPool .drag-item').count(),8);
    for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      for(let i=0;i<10;i++) {
        await page.evaluate(i=>goToSlide(i),i);
        assert.equal(await page.locator('.slide.active').count(),1);
        const layout=await page.locator('.slide.active').evaluate(s=>({width:s.clientWidth,scroll:s.scrollWidth}));
        assert.ok(layout.scroll<=layout.width+1,`Slide ${i+1} horizontal overflow at ${viewport.width}px`);
        for(const img of await page.locator('.slide.active img').all()) assert.ok(await img.evaluate(i=>i.complete&&i.naturalWidth>0),'Local image loads');
      }
    }
    await page.evaluate(()=>goToSlide(0));
    await page.locator('.slide.active button').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#curSlide').textContent(),'2','Arrow navigation works after a button has focus');
    assert.equal(await page.locator('.slide[inert]').count(),9,'Inactive slides cannot receive focus');
    assert.deepEqual(errors,[],'No JavaScript runtime errors');
    console.log('PASS: quiz, AIDA activity, reset, navigation, images and layouts at 1366 / 1024 / 390px');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
