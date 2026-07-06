export default async function handler(req, res) {
  try {
    const token = process.env.ALERTS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'ALERTS_TOKEN is not configured in Vercel' });
    }

    // UID 4 = Vinnytsia Oblast on alerts.in.ua API
    const response = await fetch('https://api.alerts.in.ua/v1/regions/4/alerts/month_ago.json', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch alerts history from upstream' });
    }

    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
