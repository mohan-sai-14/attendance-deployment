const { exec } = require('child_process');

console.log('Testing npm installation...');

exec('npm -v', (error, stdout, stderr) => {
  if (error) {
    console.error('Error running npm -v:', error);
    return;
  }
  console.log('npm version:', stdout.trim());
  
  // Try to install a package
  console.log('Installing express...');
  exec('npm install express --no-package-lock --no-save', (installError, installStdout, installStderr) => {
    if (installError) {
      console.error('Error installing express:', installError);
      return;
    }
    console.log('Express installed successfully!');
    console.log(installStdout);
  });
});
