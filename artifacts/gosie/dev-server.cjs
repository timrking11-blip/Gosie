const { spawn } = require('node:child_process');
const path = require('node:path');

const apiPort = process.env.API_PORT || '8791';
const env = {
  ...process.env,
  API_PORT: apiPort,
  NODE_ENV: 'development',
};
const apiPath = path.resolve(__dirname, '../api-server/server.js');
const api = spawn(process.execPath, [apiPath], { env, stdio: 'inherit' });
const vitePath = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const vite = spawn(process.execPath, [vitePath, '--config', path.join(__dirname, 'vite.config.ts')], { env, stdio: 'inherit' });
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill('SIGTERM');
  vite.kill('SIGTERM');
  setTimeout(() => process.exit(code), 250).unref();
}

api.on('error', (error) => {
  console.error(`Gosie API failed to start: ${error.message}`);
  stop(1);
});
vite.on('error', (error) => {
  console.error(`Gosie web server failed to start: ${error.message}`);
  stop(1);
});
api.on('exit', (code) => {
  if (!stopping && code !== 0) stop(code || 1);
});
vite.on('exit', (code) => {
  if (!stopping && code !== 0) stop(code || 1);
});
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
