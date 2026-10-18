import { createServer } from 'vite';

const port = Number(process.env.E2E_LOCAL_PORT || 5178);
const requiredEnvironment = {
  VITE_FINANCE_ENV: 'local-e2e',
  VITE_FINANCE_USE_FIREBASE_EMULATORS: 'true',
  VITE_FIREBASE_PROJECT_ID: 'demo-finance-control-local-e2e',
  VITE_FIREBASE_API_KEY: 'demo-key',
  VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
  VITE_FIRESTORE_EMULATOR_PORT: '8080'
};
for (const [key, value] of Object.entries(requiredEnvironment)) {
  if (process.env[key] && process.env[key] !== value) throw new Error(`E2E_LOCAL_ENV_MISMATCH:${key}`);
  process.env[key] = value;
}
const server = await createServer({
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true
  }
});

await server.listen();
server.printUrls();

async function shutdown() {
  await server.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await new Promise(() => {});
