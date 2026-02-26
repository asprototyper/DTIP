const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = 'Bookings';

export default async function handler(req, res) {
  // Allow requests from your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { status } = req.query;
  if (!status) return res.status(400).json({ error: 'Missing status parameter' });

  try {
    const filter = encodeURIComponent(`{Status} = '${status}'`);
    let url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?filterByFormula=${filter}`;
    let allRecords = [];

    while (url) {
      const airtableRes = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
      });
      if (!airtableRes.ok) throw new Error(`Airtable error: ${airtableRes.status}`);
      const data = await airtableRes.json();
      allRecords = allRecords.concat(data.records.map(r => r.fields));
      url = data.offset
        ? `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?filterByFormula=${filter}&offset=${data.offset}`
        : null;
    }

    return res.status(200).json({ records: allRecords });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}