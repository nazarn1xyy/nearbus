export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!KV_URL || !KV_TOKEN) {
      return res.status(500).json({ error: 'KV database not configured' });
    }

    const password = req.query.password;
    if (password !== 'nearbus2024') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const headers = {
      'Authorization': `Bearer ${KV_TOKEN}`
    };

    // 1. Get total visits
    const totalResp = await fetch(`${KV_URL}/get/total_visits`, { headers });
    const totalData = await totalResp.json();
    const totalVisits = totalData.result || 0;

    // 2. Get online users using SCAN
    const scanResp = await fetch(`${KV_URL}/scan/0/MATCH/online_*/COUNT/1000`, { headers });
    const scanData = await scanResp.json();
    // scanData.result is an array: [cursor, [key1, key2, ...]]
    let onlineUsers = 0;
    if (scanData.result && scanData.result.length > 1 && Array.isArray(scanData.result[1])) {
      onlineUsers = scanData.result[1].length;
    }

    res.status(200).json({ 
      online: onlineUsers, 
      total: parseInt(totalVisits, 10) || 0 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
