console.log('Hello from test1.js');
console.log('Current directory:', process.cwd());
try {
  const fs = require('fs');
  fs.writeFileSync('test-output.txt', 'This is a test file');
  console.log('Successfully wrote test file');
} catch (error) {
  console.error('Error writing file:', error.message);
}
