const { exec } = require('child_process');
const path = require('path');

// Change to the frontend directory
const frontendDir = path.join(__dirname, 'frontend');

// Run the build command
exec('npm run build', { cwd: frontendDir }, (error, stdout, stderr) => {
  if (error) {
    console.error(`Build error: ${error}`);
    return;
  }
  
  console.log('Build output:');
  console.log(stdout);
  
  if (stderr) {
    console.error('Build stderr:');
    console.error(stderr);
  }
  
  console.log('Build completed successfully!');
});
