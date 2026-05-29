const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsDir = path.join(__dirname, '../public/models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
];

const downloadFile = (file) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(modelsDir, file);
    if (fs.existsSync(filePath)) return resolve();
    
    console.log(`Downloading ${file}...`);
    https.get(baseUrl + file, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${file}: ${res.statusCode}`));
        return;
      }
      const stream = fs.createWriteStream(filePath);
      res.pipe(stream);
      stream.on('finish', () => {
        stream.close();
        resolve();
      });
    }).on('error', reject);
  });
};

Promise.all(files.map(downloadFile))
  .then(() => console.log('All models downloaded!'))
  .catch(console.error);
