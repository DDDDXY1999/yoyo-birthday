const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const finishMeteor = require('../scripts/finish-meteor.cjs');

const base = process.env.BIRTHDAY_BASE_URL || 'http://127.0.0.1:8765/';

async function waitForDownload(promise, label) {
  let timer;
  try {
    await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out waiting for '+label)), 20000);
    })]);
  } finally { clearTimeout(timer); }
}

(async () => {
  const firstVideo = Promise.withResolvers(), failVideo = Promise.withResolvers();
  const partialVideo = Promise.withResolvers(), finishVideo = Promise.withResolvers();
  const mobileFilm = '/meteor-mobile-v1.mp4';
  const desktopFilm = '/meteor-shower.mp4';
  const piano = '/audio/birthday-piano-v2.m4a';
  let videoAttempts = 0;
  const mediaRequests = [];
  // Keep the browser and its media on one origin. The second video response
  // deliberately stops in the middle of its body, after the 200 and byte count.
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL('.' + req.url, base);
      const video = url.pathname === mobileFilm;
      if (/\.(mp3|m4a|mp4|ogg|wav)$/i.test(url.pathname)) mediaRequests.push(url.pathname);
      if (video && ++videoAttempts === 1) {
        firstVideo.resolve();
        await failVideo.promise;
        res.writeHead(503).end('Temporarily unavailable');
        return;
      }
      const upstream = await fetch(url);
      const bytes = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': bytes.length
      });
      if (video) {
        const cut = Math.floor(bytes.length / 2);
        res.write(bytes.subarray(0, cut));
        partialVideo.resolve();
        await finishVideo.promise;
        res.end(bytes.subarray(cut));
      } else {
        res.end(bytes);
      }
    } catch (error) {
      res.destroy(error);
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.BIRTHDAY_BROWSER_CHANNEL
      ? {channel:process.env.BIRTHDAY_BROWSER_CHANNEL} : {})});
    const page = await browser.newPage({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
    await page.addInitScript(() => {
      const NativeAudio = window.Audio;
      window.__preloadAudio = [];
      window.Audio = class extends NativeAudio {
        constructor(...args) { super(...args); window.__preloadAudio.push(this); }
      };
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/', {waitUntil:'domcontentloaded'});
    const loading = page.locator('#asset-loading-screen'), retry = page.locator('#asset-loading-retry');
    const invitation = page.locator('#identity-submit'), progress = page.locator('#asset-loading-progress');
    await loading.waitFor({state:'visible'});
    await waitForDownload(firstVideo.promise,'the initial video request');
    assert.equal(await invitation.isVisible(),false);
    assert.equal(await retry.isVisible(),false);
    assert.equal(await progress.getAttribute('max'),'100');
    await page.keyboard.press('r');
    assert.equal(await page.locator('#start').isVisible(),false);
    failVideo.resolve();
    await retry.waitFor({state:'visible'});
    assert.ok((await page.locator('#asset-loading-status').innerText()).trim());
    assert.equal(await invitation.isVisible(),false);

    await retry.tap();
    await waitForDownload(partialVideo.promise,'the retried video stream');
    await page.waitForFunction(() => document.getElementById('asset-loading-progress').value > 0);
    assert.ok(await progress.evaluate(p => p.value < 100));
    assert.ok((await page.locator('#asset-loading-percent').innerText()).includes('%'));
    assert.equal(await invitation.isVisible(),false);
    assert.equal(await loading.isVisible(),true);
    finishVideo.resolve();
    await invitation.waitFor({state:'visible'});
    assert.equal(await loading.isVisible(),false);
    assert.equal(await invitation.isEnabled(),true);
    assert.equal(await progress.evaluate(p => p.value),100);
    assert.equal(videoAttempts,2);
    const downloadsAtReady = mediaRequests.slice();
    assert.deepEqual(downloadsAtReady.toSorted(), [mobileFilm, mobileFilm, piano].toSorted());
    await page.context().setOffline(true);
    await invitation.tap();
    await page.waitForFunction(() => window.__preloadAudio.some(a => a.currentSrc.startsWith('blob:') && !a.paused));
    await page.locator('#start').tap();
    await page.locator('#enter-cake').tap({timeout:15000});
    await page.waitForFunction(() => {
      const video = document.getElementById('meteor-film');
      return video.currentSrc.startsWith('blob:') && video.currentTime > 0 && !video.paused;
    });
    await finishMeteor(page);
    await page.waitForFunction(() => !document.getElementById('studio-edit').disabled);
    assert.equal(await page.locator('#workshop-canvas canvas').isVisible(),true);
    assert.deepEqual(mediaRequests,downloadsAtReady);
    const desktop = await browser.newPage({viewport:{width:1440,height:900}});
    await desktop.goto('http://127.0.0.1:' + server.address().port + '/');
    await desktop.locator('#identity-submit').waitFor({state:'visible'});
    assert.deepEqual(mediaRequests.slice(downloadsAtReady.length).toSorted(), [desktopFilm, piano].toSorted());
    console.log(JSON.stringify({passed:true,mobile:true,partialDownloadBlocksEntry:true,retry:true,videoAttempts,mediaPlayedFromBlobs:true,offlineWorkshop:true,oneFilmPerDevice:true}));
  } finally {
    failVideo.resolve(); finishVideo.resolve();
    if (browser) await browser.close();
    server.closeAllConnections(); server.close();
  }
})().catch(error => { console.error(error); process.exitCode=1; });
