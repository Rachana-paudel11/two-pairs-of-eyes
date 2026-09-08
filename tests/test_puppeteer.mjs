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
  await new Promise(r => setTimeout(r, 2000));

  console.log('At Stop 1.');

  // Click "Cordon Off" action button (button[data-action="cordon_off"] or first action button)
  const cordonBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button.action-btn'));
    const found = btns.find(b => b.textContent.includes('Cordon') || b.getAttribute('data-action') === 'cordon_off');
    if (found) { found.click(); return true; }
    return false;
  });

  if (cordonBtn) {
    console.log('Clicked Cordon Off button!');
    // Wait 3 seconds for cordon resolution & placement animation
    await new Promise(r => setTimeout(r, 3500));

    await page.screenshot({ path: 'C:/Users/admin/.gemini/antigravity/brain/0ecab382-5571-4816-aea8-5c32cf5495a3/after_cordon.png' });
    console.log('Saved after_cordon.png');

    const status = await page.evaluate(() => {
      const chars = window.__app?.characters;
      if (!chars) return null;
      const getRot = (obj) => {
        if (!obj) return null;
        const e = new THREE.Euler().setFromQuaternion(obj.quaternion);
        return {
          pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
          eulerDeg: { x: (e.x * 180 / Math.PI).toFixed(1), y: (e.y * 180 / Math.PI).toFixed(1), z: (e.z * 180 / Math.PI).toFixed(1) },
          quat: { x: obj.quaternion.x.toFixed(3), y: obj.quaternion.y.toFixed(3), z: obj.quaternion.z.toFixed(3), w: obj.quaternion.w.toFixed(3) }
        };
      };
      return {
        alex: getRot(chars.alex),
        dave: getRot(chars.dave)
      };
    });
    console.log('Character status after cordon:', JSON.stringify(status, null, 2));
  } else {
    console.log('Cordon button not found!');
  }

  await browser.close();
})();
