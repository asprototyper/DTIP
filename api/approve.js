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

function getSlotIndex(slot) {
  return ALL_SLOTS.findIndex(s => s === slot);
}

// Handles both number (90) and string ("90 mins", "90 min", "90")
function parseDuration(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return parseInt(raw);
  return 0;
}

function getSlotsNeeded(durationMinutes) {
  return Math.ceil(durationMinutes / 30);
}

function getConfirmedStartSlot(confirmedDateTime) {
  // Extract time part directly from string "2026-02-27T10:00:00"
  const timePart = confirmedDateTime.split('T')[1]; // "10:00:00"
  const [hours, minutes] = timePart.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const timeStr = `${hour12}:${minutes} ${ampm}`; // "10:00 AM"
  return ALL_SLOTS.find(s => s.startsWith(timeStr)) || null;
}

function getConfirmedDate(confirmedDateTime) {
  return confirmedDateTime.split('T')[0]; // "2026-02-27"
}

async function getRecord(recordId) {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}/${recordId}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
  );
  if (!res.ok) throw new Error(`Failed to fetch record: ${res.status}`);
  return res.json();
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recordId } = req.body;

    if (!recordId) {
      return res.status(400).json({ error: 'Missing recordId' });
    }

    const record = await getRecord(recordId);
    const fields = record.fields;

    const confirmedDateTime = fields['Confirmed Date and Time'];
    const rawDuration = fields['Calculated Duration'];
    const duration = parseDuration(rawDuration);
    const scheduleSet = fields['Schedule Set'];
    const name = fields['Name'];
    const email = fields['Email'];
    const preferredDate = fields['Preferred Date'];

    if (!confirmedDateTime || !rawDuration || !scheduleSet) {
      return res.status(400).json({
        error: 'Missing required fields: Confirmed Date and Time, Calculated Duration, or Schedule Set',
        debug: { confirmedDateTime, rawDuration, scheduleSet }
      });
    }

    const startSlot = getConfirmedStartSlot(confirmedDateTime);
    const slotsNeeded = getSlotsNeeded(duration);
    const startIndex = getSlotIndex(startSlot);

    if (startIndex === -1) {
      return res.status(400).json({
        error: `Could not find slot matching confirmed time`,
        debug: { confirmedDateTime, startSlot, slotsNeeded }
      });
    }

    const blockerSlots = ALL_SLOTS.slice(startIndex + 1, startIndex + slotsNeeded);

    if (blockerSlots.length === 0) {
      return res.status(200).json({
        message: 'No successive slots needed',
        slotsCreated: 0,
        debug: { startSlot, duration, slotsNeeded, startIndex }
      });
    }

    const created = [];
    for (const slot of blockerSlots) {
      const blockerFields = {
        'Name': name,
        'Email': email,
        'Preferred Date': preferredDate,
        'Preferred Time': slot,
        'Confirmed Date and Time': confirmedDateTime,
        'Schedule Set': scheduleSet,
        'Status': 'Approved',
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
