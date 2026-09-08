import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-gpu'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 20000 }).catch(() => {});

  const basePath = 'C:/Users/admin/.gemini/antigravity/brain/0ecab382-5571-4816-aea8-5c32cf5495a3';

  for (let stopNum = 1; stopNum <= 5; stopNum++) {
    console.log(`\n=== Testing Stop ${stopNum} ===`);

    // Wait for dialogue line to settle (Phase 1)
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: `${basePath}/stop${stopNum}_phase1_dialogue.png` });
    console.log(`Saved stop${stopNum}_phase1_dialogue.png`);

    // Wait for action menu / post-dialogue (Phase 2)
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${basePath}/stop${stopNum}_phase2_inspection.png` });
    console.log(`Saved stop${stopNum}_phase2_inspection.png`);

    if (stopNum < 5) {
      // Click first action button
      const clickedAction = await page.evaluate(() => {
        const btn = document.querySelector('button.action-btn');
        if (btn) { btn.click(); return true; }
        return false;
      });

      if (clickedAction) {
        console.log(`Clicked action for Stop ${stopNum}`);
        await new Promise(r => setTimeout(r, 2500));

        // Click Continue to Next Stop
        const clickedNext = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const found = btns.find(b => b.textContent.includes('Continue'));
          if (found) { found.click(); return true; }
          return false;
        });

        if (clickedNext) {
          console.log(`Clicked Continue to Stop ${stopNum + 1}`);
          await new Promise(r => setTimeout(r, 3500));
        }
      }
    }
  }

  console.log('Finished capturing all stop screenshots!');
  await browser.close();
})();
