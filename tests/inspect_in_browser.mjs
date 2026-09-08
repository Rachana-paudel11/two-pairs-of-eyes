import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__app?.characters, { timeout: 20000 }).catch(() => {});

  await new Promise(r => setTimeout(r, 4000));

  const results = await page.evaluate(() => {
    const chars = window.__app.characters;

    function quatToEulerDeg(x, y, z, w) {
      // Roll (X), Pitch (Y), Yaw (Z) in degrees
      const sinr_cosp = 2 * (w * x + y * z);
      const cosr_cosp = 1 - 2 * (x * x + y * y);
      const ex = Math.atan2(sinr_cosp, cosr_cosp) * 180 / Math.PI;

      const sinp = 2 * (w * y - z * x);
      let ey;
      if (Math.abs(sinp) >= 1) {
        ey = Math.sign(sinp) * (Math.PI / 2) * 180 / Math.PI;
      } else {
        ey = Math.asin(sinp) * 180 / Math.PI;
      }

      const siny_cosp = 2 * (w * z + x * y);
      const cosy_cosp = 1 - 2 * (y * y + z * z);
      const ez = Math.atan2(siny_cosp, cosy_cosp) * 180 / Math.PI;

      return { x: ex, y: ey, z: ez };
    }

    const inspectMixerActions = (charName, actionsObj) => {
      const list = [];
      for (const [name, action] of Object.entries(actionsObj)) {
        const clip = action.getClip();
        const hipsQuat = clip.tracks.find(t => t.name.includes('Hips') && t.name.endsWith('.quaternion'));
        const hipsPos = clip.tracks.find(t => t.name.includes('Hips') && t.name.endsWith('.position'));

        let quatDetails = null;
        if (hipsQuat) {
          let maxX = 0, maxY = 0, maxZ = 0;
          let endEuler = null;

          for (let i = 0; i < hipsQuat.times.length; i++) {
            const e = quatToEulerDeg(
              hipsQuat.values[i * 4],
              hipsQuat.values[i * 4 + 1],
              hipsQuat.values[i * 4 + 2],
              hipsQuat.values[i * 4 + 3]
            );
            const ex = Math.abs(e.x);
            const ey = Math.abs(e.y);
            const ez = Math.abs(e.z);

            if (ex > maxX) maxX = ex;
            if (ey > maxY) maxY = ey;
            if (ez > maxZ) maxZ = ez;

            if (i === hipsQuat.times.length - 1) {
              endEuler = {
                x: e.x.toFixed(1),
                y: e.y.toFixed(1),
                z: e.z.toFixed(1)
              };
            }
          }
          quatDetails = { maxX: maxX.toFixed(1), maxY: maxY.toFixed(1), maxZ: maxZ.toFixed(1), finalEuler: endEuler };
        }

        list.push({
          char: charName,
          actionName: name,
          clipName: clip.name,
          duration: clip.duration.toFixed(2),
          hasHipsPosTrack: !!hipsPos,
          hasHipsQuatTrack: !!hipsQuat,
          quatDetails
        });
      }
      return list;
    };

    return [
      ...inspectMixerActions('Alex', chars._alexActions),
      ...inspectMixerActions('Dave', chars._daveActions)
    ];
  });

  console.log('App Loaded Gesture Clips Analysis:\n', JSON.stringify(results, null, 2));
  await browser.close();
})();
