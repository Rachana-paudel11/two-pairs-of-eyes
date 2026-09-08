import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.ProgressEvent = dom.window.ProgressEvent;
global.FileReader = dom.window.FileReader;

const charDir = './public/assets/models/characters';
const fbxFiles = [
  'dave_Dismissing Gesture.fbx',
  'dave_Shrugging.fbx',
  'dave_point.fbx',
  'dave_Sarcastic Head Nod.fbx',
  'alex_place.fbx',
  'alex_report.fbx'
];

const loader = new FBXLoader();

for (const file of fbxFiles) {
  const filePath = path.join(charDir, file);
  const buffer = fs.readFileSync(filePath);
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  
  try {
    const fbx = loader.parse(ab, charDir);
    console.log(`\n================ ${file} ================`);
    if (!fbx.animations || fbx.animations.length === 0) {
      console.log('No animations found!');
      continue;
    }
    const clip = fbx.animations[0];
    console.log(`Clip name: "${clip.name}", duration: ${clip.duration.toFixed(2)}s, tracks: ${clip.tracks.length}`);
    
    const hipsQuatTrack = clip.tracks.find(t => t.name.includes('Hips') && t.name.endsWith('.quaternion'));
    const hipsPosTrack = clip.tracks.find(t => t.name.includes('Hips') && t.name.endsWith('.position'));
    
    console.log('Hips.position track present:', !!hipsPosTrack);
    console.log('Hips.quaternion track present:', !!hipsQuatTrack);

    if (hipsQuatTrack) {
      const times = hipsQuatTrack.times;
      const values = hipsQuatTrack.values;
      let maxX = 0, maxY = 0, maxZ = 0;
      let endEuler = null;

      for (let i = 0; i < times.length; i++) {
        const q = new THREE.Quaternion(
          values[i * 4],
          values[i * 4 + 1],
          values[i * 4 + 2],
          values[i * 4 + 3]
        );
        const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
        const ex = Math.abs(e.x * 180 / Math.PI);
        const ey = Math.abs(e.y * 180 / Math.PI);
        const ez = Math.abs(e.z * 180 / Math.PI);

        if (ex > maxX) maxX = ex;
        if (ey > maxY) maxY = ey;
        if (ez > maxZ) maxZ = ez;

        if (i === times.length - 1) {
          endEuler = {
            x: (e.x * 180 / Math.PI).toFixed(1),
            y: (e.y * 180 / Math.PI).toFixed(1),
            z: (e.z * 180 / Math.PI).toFixed(1)
          };
        }
      }
      console.log(`  Max Pitch (X): ${maxX.toFixed(1)}°, Max Yaw (Y): ${maxY.toFixed(1)}°, Max Roll (Z): ${maxZ.toFixed(1)}°`);
      console.log(`  Final Frame Euler (deg): X=${endEuler.x}°, Y=${endEuler.y}°, Z=${endEuler.z}°`);
    }
  } catch (err) {
    console.error(`Error parsing ${file}:`, err.message);
  }
}
