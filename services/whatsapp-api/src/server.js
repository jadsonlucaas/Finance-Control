import http from 'node:http';
import { createApp, MAX_BODY_BYTES, MAX_STRIPE_BODY_BYTES, STRIPE_WEBHOOK_PATH } from './app.js';
import { createPhoneResolver, parsePhoneLinks } from './phoneLinks.js';
import { readSetting } from './settings.js';
import { normalizeAccessMode } from './access.js';

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

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
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
  const accessMode = normalizeAccessMode(readSetting('WHATSAPP_ACCESS_MODE'));
  // Opcional: sem ele a rota do webhook do Stripe responde 503 e nada de cobranca e gravado.
  const stripeWebhookSecret = readSetting('STRIPE_WEBHOOK_SECRET');
  const app = createApp({ store, resolver: createPhoneResolver(links, { store }), apiKey, accessMode, stripeWebhookSecret });
  const port = Number(process.env.PORT || 3000);

  const server = http.createServer(async (req, res) => {
    let body;
    let rawBody;
    if (req.method === 'POST') {
      try {
        const isStripe = String(req.url || '').split('?')[0] === STRIPE_WEBHOOK_PATH;
        // O corpo cru vai junto: a assinatura do Stripe e calculada sobre os bytes exatos.
        rawBody = await readBody(req, isStripe ? MAX_STRIPE_BODY_BYTES : MAX_BODY_BYTES);
        body = rawBody ? JSON.parse(rawBody) : undefined;
      } catch (error) {
        const status = error?.status === 413 ? 413 : 400;
        send(res, status, { erro: { codigo: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON', mensagem: 'Corpo invalido.' } });
        return;
      }
    }
    const result = await app.handle({ method: req.method, path: req.url, headers: req.headers, body, rawBody });
    send(res, result.status, result.body);
  });

  server.listen(port, () => {
    console.info(JSON.stringify({ level: 'info', event: 'listening', port, legacy_linked_phones: links.size, access_mode: accessMode, stripe_webhook: Boolean(stripeWebhookSecret) }));
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error(JSON.stringify({ level: 'fatal', event: 'startup_failed', message: String(error?.message || error).slice(0, 300) }));
  process.exit(1);
});
