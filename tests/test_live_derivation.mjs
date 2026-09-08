import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__app?.warehouse?._stop1SpillGroup, { timeout: 20000 }).catch(() => {});

  await new Promise(r => setTimeout(r, 2000));

  console.log('--- LIVE MESH DERIVATION TEST ---');

  const testResults = await page.evaluate(() => {
    const warehouse = window.__app.warehouse;
    const chars = window.__app.characters;

    const getEulerYDeg = (q) => {
      if (!q) return 0;
      return Math.atan2(2 * (q.w * q.y + q.z * q.x), 1 - 2 * (q.y * q.y + q.z * q.z)) * 180 / Math.PI;
    };

    // 1. Initial hazard anchor from real spill mesh group geometry
    const initialAnchor = warehouse.getHazardAnchor('stop_01');
    const initialAlexFacing = getEulerYDeg(chars._alexTargetQuat);

    // 2. Shift the ACTUAL SPILL MESH GEOMETRY group position in the scene by -3.0m on X
    warehouse._stop1SpillGroup.position.x -= 3.0;

    // Re-evaluate hazard anchor after moving mesh
    const shiftedAnchor = warehouse.getHazardAnchor('stop_01');

    // Trigger look-at using the dynamic anchor getter
    chars.lookAlexAtPosition(shiftedAnchor);
    const shiftedAlexFacing = getEulerYDeg(chars._alexTargetQuat);

    // 3. Revert mesh position
    warehouse._stop1SpillGroup.position.x += 3.0;
    const revertedAnchor = warehouse.getHazardAnchor('stop_01');
    chars.lookAlexAtPosition(revertedAnchor);

    return {
      initialAnchor: { x: initialAnchor.x.toFixed(2), z: initialAnchor.z.toFixed(2) },
      shiftedAnchor: { x: shiftedAnchor.x.toFixed(2), z: shiftedAnchor.z.toFixed(2) },
      revertedAnchor: { x: revertedAnchor.x.toFixed(2), z: revertedAnchor.z.toFixed(2) },
      initialFacingDeg: initialAlexFacing.toFixed(1),
      shiftedFacingDeg: shiftedAlexFacing.toFixed(1),
      facingShiftDeg: (shiftedAlexFacing - initialAlexFacing).toFixed(1),
      facingFollowsMeshGeometry: Math.abs(shiftedAlexFacing - initialAlexFacing) > 10.0
    };
  });

  console.log('Derivation Test Results:\n', JSON.stringify(testResults, null, 2));
  await browser.close();
})();
