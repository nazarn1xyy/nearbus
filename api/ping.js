export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { visitorId, isNewSession } = req.query;
    if (!visitorId) {
      return res.status(400).json({ error: 'visitorId is required' });
    }

    const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!KV_URL || !KV_TOKEN) {
      return res.status(500).json({ error: 'KV database not configured' });
    }

    const headers = {
      'Authorization': `Bearer ${KV_TOKEN}`
    };

    // 1. Mark user as online with a 65 seconds expiry (we ping every 30s)
    await fetch(`${KV_URL}/set/online_${visitorId}/1/EX/65`, { headers });

    // 2. Increment total visits if it's a new session
    if (isNewSession === 'true') {
      await fetch(`${KV_URL}/incr/total_visits`, { headers });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
