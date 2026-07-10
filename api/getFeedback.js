const SUPABASE_URL = process.env.SUPABASE_URL || 'https://theiealphlaluuspqvic.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWllYWxwaGxhbHV1c3BxdmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2ODU0NTMsImV4cCI6MjA5OTI2MTQ1M30.s8SNPr5GUS3yFGeEx-aEEMSt5Dh5YRynBHfeKV1eLmI';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  // Basic admin protection
  const { password } = req.query;
  if (password !== process.env.ADMIN_PASSWORD && password !== 'nearbus2024') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/feedbacks?select=*&order=created_at.desc`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      console.error('Supabase error', await response.text());
      return res.status(500).json({ error: 'Failed to fetch feedbacks' });
    }

    const data = await response.json();
    res.status(200).json({ feedbacks: data });
  } catch (err) {
    console.error('getFeedback error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
