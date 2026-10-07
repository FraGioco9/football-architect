import {chromium} from 'playwright';

const base='http://127.0.0.1:2000';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
try{
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  await page.locator('#manager-name').fill('Storage Alignment Test');
  await page.locator('[data-action="start-career"]').click();
  await page.waitForURL('**/dashboard');
  await page.waitForTimeout(400);
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.locator('[data-action="menu-manage"]').click();
  await page.waitForURL('**/careers');

  const metrics=await page.locator('.career-security > summary > span:first-child').evaluate(el=>{
    const svg=el.querySelector('svg');
    const textNode=[...el.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());
    if(!svg||!textNode)return null;
    const range=document.createRange();
    range.selectNodeContents(textNode);
    const sr=svg.getBoundingClientRect(),tr=range.getBoundingClientRect();
    return {
      svgCenter:sr.top+sr.height/2,
      textCenter:tr.top+tr.height/2,
      delta:Math.abs((sr.top+sr.height/2)-(tr.top+tr.height/2)),
      display:getComputedStyle(el).display,
      alignItems:getComputedStyle(el).alignItems
    };
  });
  console.log('STORAGE_SUMMARY_ALIGNMENT',JSON.stringify(metrics));
  if(!metrics)throw new Error('storage protected icon/text not found');
  if(metrics.delta>1.5)throw new Error('storage protected icon is not vertically centered with text');
  if(metrics.display!=='flex'&&metrics.display!=='inline-flex')throw new Error('storage protected icon/text wrapper must use flex alignment');
  if(metrics.alignItems!=='center')throw new Error('storage protected icon/text wrapper must align items center');
  console.log('UX20 18B STORAGE ALIGNMENT PASS');
}finally{
  await browser.close();
}
