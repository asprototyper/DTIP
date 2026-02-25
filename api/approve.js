const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = 'Bookings';

const ALL_SLOTS = [
  '8:00 AM - 8:30 AM',
  '8:30 AM - 9:00 AM',
  '9:00 AM - 9:30 AM',
  '9:30 AM - 10:00 AM',
  '10:00 AM - 10:30 AM',
  '10:30 AM - 11:00 AM',
  '11:00 AM - 11:30 AM',
  '11:30 AM - 12:00 PM',
  '12:00 PM - 12:30 PM',
  '12:30 PM - 1:00 PM',
  '1:00 PM - 1:30 PM',
  '1:30 PM - 2:00 PM',
  '2:00 PM - 2:30 PM',
  '2:30 PM - 3:00 PM',
  '3:00 PM - 3:30 PM',
  '3:30 PM - 4:00 PM',
  '4:00 PM - 4:30 PM',
  '4:30 PM - 5:00 PM'
];

// Parse "8:00 AM - 8:30 AM" → starting slot index in ALL_SLOTS
function getSlotIndex(preferredTime) {
  return ALL_SLOTS.findIndex(s => s === preferredTime);
}

// Calculate how many 30-min slots the duration needs
function getSlotsNeeded(durationMinutes) {
  return Math.ceil(durationMinutes / 30);
}

// Get confirmed date as YYYY-MM-DD string (Asia/Manila)
function getConfirmedDate(confirmedDateTime) {
  const date = new Date(confirmedDateTime);
  // Convert to Manila time
  const manilaStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  return manilaStr; // returns YYYY-MM-DD
}

// Get confirmed start time slot string e.g. "8:00 AM - 8:30 AM"
function getConfirmedStartSlot(confirmedDateTime) {
  const date = new Date(confirmedDateTime);
  const timeStr = date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }); // e.g. "8:00 AM"

  // Find matching slot that starts with this time
  return ALL_SLOTS.find(s => s.startsWith(timeStr)) || null;
}

// Fetch a single Airtable record by ID
async function getRecord(recordId) {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}/${recordId}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
  );
  if (!res.ok) throw new Error(`Failed to fetch record: ${res.status}`);
  return res.json();
}

// Create a blocker record in Airtable
async function createBlockerRecord(fields) {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to create record: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recordId } = req.body;

    if (!recordId) {
      return res.status(400).json({ error: 'Missing recordId' });
    }

    // 1. Fetch the approved booking from Airtable
    const record = await getRecord(recordId);
    const fields = record.fields;

    const confirmedDateTime = fields['Confirmed Date and Time'];
    const duration = fields['Calculated Duration'];
    const scheduleSet = fields['Schedule Set'];
    const name = fields['Name'];
    const email = fields['Email'];
    const preferredDate = fields['Preferred Date'];

    if (!confirmedDateTime || !duration || !scheduleSet) {
      return res.status(400).json({
        error: 'Missing required fields: Confirmed Date and Time, Calculated Duration, or Schedule Set'
      });
    }

    // 2. Figure out starting slot and how many slots needed
    const startSlot = getConfirmedStartSlot(confirmedDateTime);
    const confirmedDate = getConfirmedDate(confirmedDateTime);
    const slotsNeeded = getSlotsNeeded(duration);
    const startIndex = getSlotIndex(startSlot);

    if (startIndex === -1) {
      return res.status(400).json({ error: `Could not find slot matching: ${startSlot}` });
    }

    // 3. The first slot is already the main booking — create blockers for the REST
    const blockerSlots = ALL_SLOTS.slice(startIndex + 1, startIndex + slotsNeeded);

    if (blockerSlots.length === 0) {
      return res.status(200).json({ message: 'No successive slots needed', slotsCreated: 0 });
    }

    // 4. Create a blocker record for each successive slot
    const created = [];
    for (const slot of blockerSlots) {
      const blockerFields = {
        'Name': name,
        'Email': email,
        'Preferred Date': preferredDate,
        'Preferred Time': slot,
        'Confirmed Date and Time': confirmedDateTime, // same confirmed datetime as parent
        'Schedule Set': scheduleSet,
        'Status': 'Approved',
        'Admin Notes': `Auto-blocked — successive slot for booking ${recordId}`
      };
      const newRecord = await createBlockerRecord(blockerFields);
      created.push(newRecord.id);
    }

    return res.status(200).json({
      message: `Created ${created.length} blocker records`,
      slotsCreated: created.length,
      recordIds: created
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}