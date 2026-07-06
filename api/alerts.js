export default async function handler(req, res) {
  try {
    const token = process.env.ALERTS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'ALERTS_TOKEN is not configured in Vercel' });
    }

    const response = await fetch('https://api.alerts.in.ua/v1/alerts/active.json', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch alerts from upstream' });
    }

    const data = await response.json();
    
    // Add CORS headers so frontend can call it if needed from another domain, 
    // though on Vercel they will be on the same domain.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
