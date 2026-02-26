// ─── CONFIG ───────────────────────────────────────────────────────────
  // Token removed — now handled server-side via /api/bookings
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

  const SCHEDULES = ['Schedule A', 'Schedule B'];

  // ─── STATE ────────────────────────────────────────────────────────────
  let approvedBookings = [];
  let pendingBookings = [];
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let selectedDate = null;
  let selectedSlot = null;
  let selectedSchedule = null;

  // ─── FETCH ────────────────────────────────────────────────────────────
  async function fetchBookings() {
    try {
      approvedBookings = await fetchByStatus('Approved');
      pendingBookings = await fetchByStatus('Pending');
      renderCalendar();
    } catch (e) {
      document.getElementById('dates-grid').innerHTML =
        `<div class="error-state" style="grid-column:1/-1">
          Unable to load availability. Please try refreshing or contact us directly.
        </div>`;
    }
  }

  async function fetchByStatus(status) {
    const res = await fetch(`/api/bookings?status=${encodeURIComponent(status)}`);
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    return data.records;
  }