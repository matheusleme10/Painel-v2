/**
 * api/storage.js — Vercel Serverless Function (Vite project, Node.js runtime)
 *
 * GET    /api/storage  → retorna o índice (lista de chunks) ou { hasData: false }
 * POST   /api/storage  → salva um chunk de dados (requer x-admin-hash)
 * DELETE /api/storage  → apaga todos os dados (requer x-admin-hash)
 */

import { put, del, list } from '@vercel/blob';

/** Valida o hash de admin enviado no header. */
function isAuthorized(req) {
  const hash    = (req.headers['x-admin-hash'] || '').trim();
  const correct = (process.env.VITE_ADMIN_HASH  || '').trim();
  return hash && correct && hash === correct;
}

/** Lê o body JSON da request manualmente (compatível com Vite + Vercel). */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error('Body inválido')); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-hash');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const PREFIX    = 'ital-dashboard/';
  const INDEX_KEY = `${PREFIX}index.json`;

  try {
    // ── GET: retorna índice ────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: INDEX_KEY });
      if (!blobs.length) return res.status(200).json({ hasData: false });

      const r = await fetch(blobs[0].url);
      const index = await r.json();
      return res.status(200).json({ hasData: true, ...index });
    }

    // ── Operações protegidas ────────────────────────────────────────────────
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    const body = await readBody(req);

    // ── POST ───────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { action } = body;

      // Limpar dados antigos antes de iniciar novo upload
      if (action === 'start') {
        const { blobs } = await list({ prefix: PREFIX });
        if (blobs.length) await Promise.all(blobs.map(b => del(b.url)));
        return res.status(200).json({ success: true });
      }

      // Salvar um chunk de linhas
      if (action === 'chunk') {
        const { chunkIndex, rows } = body;
        const blob = await put(
          `${PREFIX}chunk-${String(chunkIndex).padStart(3, '0')}.json`,
          JSON.stringify(rows),
          { access: 'public', contentType: 'application/json', addRandomSuffix: false }
        );
        return res.status(200).json({ url: blob.url });
      }

      // Registrar upload completo (salva índice)
      if (action === 'complete') {
        const { chunkUrls, totalRows, uploadedAt } = body;
        await put(
          INDEX_KEY,
          JSON.stringify({ chunkUrls, totalRows, uploadedAt }),
          { access: 'public', contentType: 'application/json', addRandomSuffix: false }
        );
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Ação inválida.' });
    }

    // ── DELETE: apagar tudo ────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { blobs } = await list({ prefix: PREFIX });
      if (blobs.length) await Promise.all(blobs.map(b => del(b.url)));
      return res.status(200).json({ success: true });
    }

    res.status(405).end();

  } catch (err) {
    console.error('[api/storage]', err);
    res.status(500).json({ error: err.message });
  }
}
