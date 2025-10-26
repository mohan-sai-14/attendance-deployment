// Script to download face-api.js models
// Run this with: node download-models.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'models');

// Create models directory if it doesn't exist
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
  console.log('Created models directory');
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const models = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✓ Downloaded: ${path.basename(dest)}`);
          resolve();
        });
      } else {
        fs.unlink(dest, () => {});
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function downloadAllModels() {
  console.log('Downloading face-api.js models...\n');
  
  for (const model of models) {
    const url = baseUrl + model;
    const dest = path.join(modelsDir, model);
    
    try {
      await downloadFile(url, dest);
    } catch (error) {
      console.error(`✗ Error downloading ${model}:`, error.message);
    }
  }
  
  console.log('\n✓ All models downloaded successfully!');
  console.log(`Models saved to: ${modelsDir}`);
}

downloadAllModels().catch(console.error);
