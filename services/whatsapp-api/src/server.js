import http from 'node:http';
import { createApp, MAX_BODY_BYTES } from './app.js';
import { createPhoneResolver, parsePhoneLinks } from './phoneLinks.js';
import { readSetting } from './settings.js';

function required(name) {
  const value = readSetting(name);
  if (!value) {
    console.error(JSON.stringify({ level: 'fatal', event: 'missing_env', name }));
    process.exit(1);
  }
  return value;
}

async function createStore() {
  if (process.env.WHATSAPP_API_STORE === 'memory') {
    const { createMemoryStore } = await import('./memoryStore.js');
    console.warn(JSON.stringify({ level: 'warn', event: 'memory_store_enabled' }));
    return createMemoryStore();
  }
  const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const credentialJson = readSetting('FIREBASE_SERVICE_ACCOUNT_JSON');
  initializeApp({
    credential: credentialJson ? cert(JSON.parse(credentialJson)) : applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined
  });
  const { createFirestoreStore } = await import('./firestoreStore.js');
  return createFirestoreStore(getFirestore());
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(payload);
}

async function main() {
  const apiKey = required('WHATSAPP_API_KEY');
  // Reserva legada (opcional): vinculos manuais enquanto os usuarios migram para o vinculo pelo app.
  const links = parsePhoneLinks(readSetting('WHATSAPP_PHONE_LINKS'));
  const store = await createStore();
  const app = createApp({ store, resolver: createPhoneResolver(links, { store }), apiKey });
  const port = Number(process.env.PORT || 3000);

  const server = http.createServer(async (req, res) => {
    let body;
    if (req.method === 'POST') {
      try {
        const raw = await readBody(req);
        body = raw ? JSON.parse(raw) : undefined;
      } catch (error) {
        const status = error?.status === 413 ? 413 : 400;
        send(res, status, { erro: { codigo: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON', mensagem: 'Corpo invalido.' } });
        return;
      }
    }
    const result = await app.handle({ method: req.method, path: req.url, headers: req.headers, body });
    send(res, result.status, result.body);
  });

  server.listen(port, () => {
    console.info(JSON.stringify({ level: 'info', event: 'listening', port, legacy_linked_phones: links.size }));
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error(JSON.stringify({ level: 'fatal', event: 'startup_failed', message: String(error?.message || error).slice(0, 300) }));
  process.exit(1);
});
