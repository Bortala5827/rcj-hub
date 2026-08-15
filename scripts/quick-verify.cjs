const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ channel:'chrome', headless:true, args:['--no-sandbox'] });
  
  // 1) 主页 Speak Series 色彩
  const p1 = await b.newPage({ viewport:{width:1280,height:800} });
  await p1.goto('http://127.0.0.1:4173/', { waitUntil:'networkidle', timeout:20000 });
  await p1.waitForTimeout(2500);
  await p1.evaluate(() => { if(window.ScrollTrigger) ScrollTrigger.refresh(); window.scrollTo(0, document.body.scrollHeight*0.42); });
  await p1.waitForTimeout(1000);
  await p1.screenshot({ path:'/tmp/rcj-shots/speak-colors.png', fullPage:false });

  // 2) SoloSpeak AI 设置（折叠态）
  const p2 = await b.newPage({ viewport:{width:390,height:844} });
  await p2.goto('http://127.0.0.1:4173/solospeak/', { waitUntil:'networkidle', timeout:20000 });
  await p2.waitForTimeout(1500);
  await p2.click('#aiSettingsBtn');
  await p2.waitForTimeout(600);
  await p2.screenshot({ path:'/tmp/rcj-shots/solospeak-ai-collapsed.png', fullPage:false });
  
  // 3) 展开态
  const toggle = await p2.$('#aiDetailToggle');
  if (toggle) { await toggle.click(); await p2.waitForTimeout(400); }
  await p2.screenshot({ path:'/tmp/rcj-shots/solospeak-ai-expanded.png', fullPage:false });

  await b.close();
  console.log('screenshots done');
})();
