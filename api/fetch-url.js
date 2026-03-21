const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

function stripHtml(html) {
  // Remove script/style blocks entirely
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');

  // Convert block elements to newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|br|tr)[\s>]/gi, '\n');
  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  return text.trim();
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Mangler URL.' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_e) {
    return res.status(400).json({ error: 'Ugyldig URL.' });
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return res.status(400).json({ error: 'Kun HTTP/HTTPS-lenker støttes.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Fagdykk/1.0 (educational tool)',
        'Accept': 'text/html, application/xhtml+xml, text/plain',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({ error: 'Kunne ikke hente siden (HTTP ' + response.status + ').' });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
      return res.status(400).json({ error: 'Lenken peker ikke til en nettside (fant: ' + contentType.split(';')[0] + ').' });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      return res.status(400).json({ error: 'Siden er for stor (maks 5MB).' });
    }

    const html = new TextDecoder().decode(buffer);
    const text = stripHtml(html);

    if (!text || text.length < 50) {
      return res.status(400).json({ error: 'Kunne ikke hente lesbar tekst fra siden. Prøv å lime inn teksten direkte.' });
    }

    res.status(200).json({ text: text });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Tidsavbrudd — siden svarte ikke innen 15 sekunder.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Kunne ikke hente siden. Sjekk at lenken er riktig.' });
  }
}

module.exports = { stripHtml };
module.exports.default = handler;
