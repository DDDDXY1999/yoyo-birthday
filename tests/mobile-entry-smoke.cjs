const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const BASE_URL=process.env.BIRTHDAY_BASE_URL||'http://127.0.0.1:8765/';
const isWebKit=process.env.BIRTHDAY_BROWSER_ENGINE==='webkit';
(async()=>{
 const browser=await (isWebKit?webkit:chromium).launch({headless:true,...(!isWebKit&&process.env.BIRTHDAY_BROWSER_CHANNEL?{channel:process.env.BIRTHDAY_BROWSER_CHANNEL}:{})});
 try{
  for(const missingStylesheet of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   let blockStyle=missingStylesheet;
   if(missingStylesheet)await page.route('**/style.css*',route=>blockStyle?route.abort():route.continue());
   await page.goto(BASE_URL);
   if(missingStylesheet){
    const retry=page.locator('#asset-loading-retry');
    await retry.waitFor({state:'visible'});
    assert.equal(await page.locator('#identity-submit').isVisible(),false);
    blockStyle=false;
    await retry.tap();
   }
   await page.locator('#identity-submit').waitFor({state:'visible'});
   assert.equal(await page.locator('#identity-screen input').count(),0);
   await page.getByRole('button',{name:'打开属于你的惊喜',exact:true}).tap();
   await page.waitForFunction(()=>!document.getElementById('intro-screen').hidden);
   assert.equal(await page.locator('#identity-screen').isVisible(),false);
   assert.equal(await page.locator('#start').isVisible(),true);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log(JSON.stringify({passed:true,engine:isWebKit?'webkit':'chromium',mobileEntry:true,stylesheetFailureRecovered:true}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
