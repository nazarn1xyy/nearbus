const SUPABASE_URL = 'https://theiealphlaluuspqvic.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWllYWxwaGxhbHV1c3BxdmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2ODU0NTMsImV4cCI6MjA5OTI2MTQ1M30.s8SNPr5GUS3yFGeEx-aEEMSt5Dh5YRynBHfeKV1eLmI';

const sbHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Password check
  if (req.query.password !== 'nearbus2024') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const onlineThreshold = new Date(Date.now() - 65 * 1000).toISOString();

    // Get online users (last seen within 65 seconds)
    const onlineResp = await fetch(
      `${SUPABASE_URL}/rest/v1/visitors?last_seen=gte.${onlineThreshold}&select=ip`,
      { headers: sbHeaders }
    );
    const onlineData = await onlineResp.json();

    // Get total unique visitors count
    const totalResp = await fetch(
      `${SUPABASE_URL}/rest/v1/visitors?select=visitor_id`,
      {
        headers: {
          ...sbHeaders,
          'Prefer': 'count=exact'
        }
      }
    );
    const totalCount = parseInt(totalResp.headers.get('content-range')?.split('/')[1] || '0', 10);

    const ips = Array.isArray(onlineData) ? [...new Set(onlineData.map(r => r.ip).filter(Boolean))] : [];

    res.status(200).json({
      online: ips.length,
      total: totalCount,
      ips
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
}
