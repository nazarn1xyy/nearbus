const SUPABASE_URL = 'https://theiealphlaluuspqvic.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWllYWxwaGxhbHV1c3BxdmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2ODU0NTMsImV4cCI6MjA5OTI2MTQ1M30.s8SNPr5GUS3yFGeEx-aEEMSt5Dh5YRynBHfeKV1eLmI';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { visitorId, isNewSession } = req.query;
    if (!visitorId) return res.status(400).json({ error: 'visitorId required' });

    const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown')
      .split(',')[0].trim();

    const now = new Date().toISOString();

    // Upsert visitor (insert or update last_seen + ip)
    await fetch(`${SUPABASE_URL}/rest/v1/visitors`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        visitor_id: visitorId,
        ip,
        last_seen: now,
        ...(isNewSession === 'true' ? { created_at: now } : {})
      })
    });

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
}
