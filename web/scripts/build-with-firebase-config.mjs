import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
const firebaseBin = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runFirebaseJson(args) {
  const result = spawnSync(firebaseBin, [...args, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.error) {
    throw new Error(`Unable to run Firebase CLI: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const message = result.stderr?.trim();
    throw new Error(message || `Firebase CLI failed: firebase ${args.join(' ')}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Firebase CLI returned invalid JSON for: firebase ${args.join(' ')}`);
  }
}

function requireValue(name, value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`Firebase SDK config is missing ${name}.`);
  return normalized;
}

const projectId =
  process.env.FIREBASE_DEPLOY_PROJECT?.trim() ||
  requireValue('active project', runFirebaseJson(['use']).result);

const appsResponse = runFirebaseJson(['apps:list', 'WEB', '--project', projectId]);
const apps = Array.isArray(appsResponse.result)
  ? appsResponse.result.filter((app) => app.state === 'ACTIVE')
  : [];

const requestedAppId = process.env.FIREBASE_WEB_APP_ID?.trim();
const selectedApp = requestedAppId
  ? apps.find((app) => app.appId === requestedAppId)
  : apps.length === 1
    ? apps[0]
    : undefined;

if (!selectedApp) {
  const hint = apps.length > 1
    ? 'Set FIREBASE_WEB_APP_ID to select one of the active Web Apps.'
    : 'Register a Firebase Web App before building.';
  throw new Error(`Unable to select a Firebase Web App. ${hint}`);
}

const configResponse = runFirebaseJson([
  'apps:sdkconfig',
  'WEB',
  selectedApp.appId,
  '--project',
  projectId,
]);
const sdkConfig = configResponse.result?.sdkConfig;

if (!sdkConfig) throw new Error('Firebase CLI did not return a Web SDK config.');

const firebaseBuildEnv = {
  VITE_FIREBASE_API_KEY: requireValue('apiKey', sdkConfig.apiKey),
  VITE_FIREBASE_AUTH_DOMAIN: requireValue('authDomain', sdkConfig.authDomain),
  VITE_FIREBASE_PROJECT_ID: requireValue('projectId', sdkConfig.projectId),
  VITE_FIREBASE_STORAGE_BUCKET: requireValue('storageBucket', sdkConfig.storageBucket),
  VITE_FIREBASE_MESSAGING_SENDER_ID: requireValue(
    'messagingSenderId',
    sdkConfig.messagingSenderId
  ),
  VITE_FIREBASE_APP_ID: requireValue('appId', sdkConfig.appId),
  VITE_FIREBASE_MEASUREMENT_ID: requireValue('measurementId', sdkConfig.measurementId),
};

console.log(`[Config] Building Web App from Firebase project ${projectId}.`);
const build = spawnSync(npmBin, ['run', 'build'], {
  cwd: webRoot,
  env: { ...process.env, ...firebaseBuildEnv },
  stdio: 'inherit',
});

if (build.error) throw build.error;
process.exit(build.status ?? 1);
