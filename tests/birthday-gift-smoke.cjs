const finishMeteor = require('../scripts/finish-meteor.cjs');
const BASE_URL=process.env.BIRTHDAY_BASE_URL||'http://127.0.0.1:8765/';
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const unlock=require('./enter-birthday.cjs'),output=path.resolve(__dirname,'../artifacts');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BIRTHDAY_BROWSER_CHANNEL?{channel:process.env.BIRTHDAY_BROWSER_CHANNEL}:{})}),errors=[],requests=[];
 function watch(p){p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.on('request',r=>requests.push(r.url()))}
 const cake=async p=>{await p.locator('#start').click();await p.locator('#enter-cake').click({timeout:12000});await finishMeteor(p);await p.waitForFunction(()=>!document.getElementById('studio-edit').disabled)};
 const wish=async p=>{await p.locator('#studio-confirm').click();await p.keyboard.down('Space');await p.waitForFunction(()=>document.getElementById('studio-wish-progress').value>=100,{},{timeout:45000});await p.keyboard.up('Space');await p.locator('#wish-letter-dialog').waitFor({state:'visible',timeout:30000})};
 try{
  await fs.mkdir(output,{recursive:true});const context=await browser.newContext({viewport:{width:1440,height:960}});const page=await context.newPage();watch(page);await page.goto(BASE_URL+'#birthday=2000.02.01');
  assert.equal(await page.locator('#identity-screen').isVisible(),true);assert.equal(await page.locator('#start').isVisible(),false);await page.keyboard.press('r');assert.equal(await page.locator('.wish-card').count(),0);assert.equal(await page.locator('#identity-screen :is(input,select,textarea)').count(),0);
  assert.equal(await page.locator('#identity-screen button').count(),1);
  assert.equal((await page.locator('#identity-screen').innerText()).trim(),'打开属于你的惊喜');
  await page.screenshot({path:path.join(output,'birthday-entry.png')});
  const age=20;
  await unlock(page);
  assert.equal(await page.locator('#intro-description').innerText(),'给悠悠的20岁生日惊喜');
  await page.locator('#start').click();await page.locator('#enter-cake').waitFor({state:'visible',timeout:12000});assert.equal(await page.locator('.wish-card').count(),64);assert.ok((await page.locator('#recipient-greeting').textContent()).includes('悠悠'));assert.ok((await page.locator('.card-message').allTextContents()).some(text=>text.includes('悠悠')));await page.screenshot({path:path.join(output,'birthday-named-heart.png')});
  await page.locator('#enter-cake').click();await finishMeteor(page);await page.waitForFunction(()=>!document.getElementById('studio-edit').disabled);assert.ok((await page.locator('.lab-title').textContent()).includes('你喜欢什么样的蛋糕？'));
  assert.equal(await page.locator('[data-option="candles"] [data-value="number"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#studio-age').inputValue(),String(age));assert.ok((await page.locator('#studio-message').inputValue()).includes('悠悠'));assert.ok((await page.locator('#cake-recipient-line').textContent()).includes(`${age}岁`));
  await page.screenshot({path:path.join(output,'birthday-personal-cake.png')});await wish(page);
  assert.ok((await page.locator('#wish-letter-title').textContent()).includes(`悠悠，${age}岁生日快乐`));assert.ok((await page.locator('#wish-letter-copy').textContent()).includes('悠悠'));await page.screenshot({path:path.join(output,'birthday-final-letter.png')});
  await page.locator('#wish-letter-close').click();assert.equal(await page.locator('#cake-screen').isVisible(),true);await page.locator('#studio-letter').click();await page.locator('#wish-letter-again').click();assert.equal(await page.locator('#studio-wish').isVisible(),true);assert.equal(await page.locator('#studio-wish-progress').getAttribute('value'),'0');
  const values=await page.evaluate(()=>Object.values(localStorage));assert.ok(values.every(v=>!v.includes('2000.02.01')));
  const storageState=await context.storageState();
  await context.close();
  const mobile=await browser.newContext({viewport:{width:360,height:760},isMobile:true,hasTouch:true,storageState});const phone=await mobile.newPage();watch(phone);await phone.goto(BASE_URL);await phone.screenshot({path:path.join(output,'birthday-entry-mobile.png')});
  await unlock(phone);await cake(phone);assert.equal(await phone.locator('#studio-age').inputValue(),String(age));assert.ok((await phone.locator('#studio-message').inputValue()).includes('悠悠'));assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const header=await phone.evaluate(()=>({entry:document.getElementById('studio-edit').getBoundingClientRect().right,back:document.getElementById('back-heart').getBoundingClientRect().left}));assert.ok(header.entry<header.back);
  await wish(phone);assert.ok((await phone.locator('#wish-letter-title').textContent()).includes(`悠悠，${age}岁`));await phone.screenshot({path:path.join(output,'birthday-letter-mobile.png')});await phone.keyboard.press('Escape');assert.equal(await phone.locator('#cake-screen').isVisible(),true);
  await phone.reload();assert.equal(await phone.locator('#identity-screen').isVisible(),true);assert.equal(await phone.locator('#identity-screen input').count(),0);
  assert.ok(requests.every(url=>url.startsWith(BASE_URL)||url.startsWith('data:')));assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,singleButtonEntry:true,personalizedCards:true,numericAge:true,finalLetter:true,rawBirthdayStored:false,mobileHeader:header,errors:0}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
