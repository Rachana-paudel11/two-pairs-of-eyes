const Jimp = require('jimp');

async function removeWhiteBg() {
  try {
    const image = await Jimp.read('public/technova-logo.png');
    // We iterate through every pixel
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // If pixel is very close to white, make it fully transparent
      if (r > 245 && g > 245 && b > 245) {
        this.bitmap.data[idx + 3] = 0; // Alpha channel
      }
      // If it's somewhat light, make it semi-transparent for smoother edges (anti-aliasing)
      else if (r > 230 && g > 230 && b > 230) {
        this.bitmap.data[idx + 3] = 100;
      }
      else if (r > 215 && g > 215 && b > 215) {
        this.bitmap.data[idx + 3] = 200;
      }
    });
    
    await image.writeAsync('public/technova-logo.png');
    console.log('Background removed successfully!');
  } catch (err) {
    console.error(err);
  }
}

removeWhiteBg();
