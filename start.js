const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\n======================================================');
console.log('🚀 Starting Smart Employee Attendance System (Option B)');
console.log('======================================================\n');

// Check if a virtual environment exists and use its python executable
let pythonCmd = 'python';
const venvPythonWin = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
const venvPythonUnix = path.join(__dirname, 'venv', 'bin', 'python');

if (fs.existsSync(venvPythonWin)) {
  pythonCmd = venvPythonWin;
  console.log(`🔍 Detected virtual environment (Windows). Running: ${pythonCmd}`);
} else if (fs.existsSync(venvPythonUnix)) {
  pythonCmd = venvPythonUnix;
  console.log(`🔍 Detected virtual environment (Unix). Running: ${pythonCmd}`);
} else {
  console.log('⚠️ Virtual environment not detected. Falling back to system global "python"...');
}

// Start Flask backend (port 5000)
console.log('📦 Starting Flask backend (MTCNN + FaceNet + SVM) on port 5000...');
const backend = spawn(pythonCmd, ['backend/app.py'], { 
  stdio: 'inherit', 
  shell: true 
});

// Start React frontend (port 5173)
console.log('💻 Starting Vite React frontend dev server (port 5173)...');
const frontend = spawn('npm', ['run', 'dev'], { 
  cwd: path.join(__dirname, 'frontend'), 
  stdio: 'inherit', 
  shell: true 
});

// Handle termination signals
const cleanup = () => {
  console.log('\n🛑 Stopping servers...');
  backend.kill();
  frontend.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
