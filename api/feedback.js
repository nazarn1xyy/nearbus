const SUPABASE_URL = process.env.SUPABASE_URL || 'https://theiealphlaluuspqvic.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWllYWxwaGxhbHV1c3BxdmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2ODU0NTMsImV4cCI6MjA5OTI2MTQ1M30.s8SNPr5GUS3yFGeEx-aEEMSt5Dh5YRynBHfeKV1eLmI';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();

    const response = await fetch(`${SUPABASE_URL}/rest/v1/feedbacks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: text,
        ip: ip
      })
    });

    if (!response.ok) {
      console.error('Supabase error', await response.text());
      return res.status(500).json({ error: 'Failed to save feedback' });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
