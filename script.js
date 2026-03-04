// ─── CONFIG ───────────────────────────────────────────────────────────
const ALL_SLOTS = [
  '8:30 AM - 9:30 AM',
  '9:30 AM - 10:30 AM',
  '10:30 AM - 11:30 AM',
  '11:30 AM - 12:30 PM',
  '12:30 PM - 1:30 PM',
  '1:30 PM - 2:30 PM',
  '2:30 PM - 3:30 PM',
  '3:30 PM - 4:30 PM'
];

// ─── STATE ────────────────────────────────────────────────────────────
let approvedBookings = [];
let pendingBookings = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let selectedSlot = null;

// ─── FETCH ────────────────────────────────────────────────────────────
async function fetchBookings() {
  try {
    approvedBookings = await fetchByStatus('Approved');
    pendingBookings = await fetchByStatus('Pending');
    renderCalendar();
    renderSlots(); // render slots after data loads
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

// ─── GET SLOTS FOR DATE ───────────────────────────────────────────────
function getSlotsForDate(bookings, dateStr) {
  const taken = [];
  bookings.forEach(b => {
    const raw = b['Preferred Date'];
    if (!raw) return;
    if (raw.substring(0, 10) !== dateStr) return;
    const time = b['Preferred Time'];
    if (!time) return;
    if (!taken.includes(time)) taken.push(time);
  });
  return taken;
}

// ─── IS DATE FULLY BOOKED ─────────────────────────────────────────────
function isDateFullyBooked(dateStr) {
  return getSlotsForDate(approvedBookings, dateStr).length >= ALL_SLOTS.length;
}

// ─── RENDER SLOTS ─────────────────────────────────────────────────────
// Always shows all slots. If no date selected, all are greyed out.
function renderSlots() {
  const takenSlots   = selectedDate ? getSlotsForDate(approvedBookings, selectedDate) : [];
  const pendingSlots = selectedDate ? getSlotsForDate(pendingBookings, selectedDate) : [];

  // Update date title
  if (selectedDate) {
    const dateObj = new Date(selectedDate + 'T00:00:00');
    document.getElementById('slots-date-title').textContent = dateObj.toLocaleDateString('en-PH', {
      weekday: 'short', month: 'short', day: 'numeric'
    });
  } else {
    document.getElementById('slots-date-title').textContent = '—';
  }

  let html = '';
  ALL_SLOTS.forEach(slot => {
    const isTaken   = takenSlots.includes(slot);
    const isPending = pendingSlots.includes(slot);
    const noDate    = !selectedDate;

    if (noDate) {
      html += `<button class="slot-btn" disabled style="opacity:0.35;cursor:not-allowed;">${slot}</button>`;
    } else if (isTaken) {
      html += `<button class="slot-btn taken" disabled title="Already approved">${slot}</button>`;
    } else if (isPending) {
      html += `<button class="slot-btn pending" onclick="selectSlot('${slot}',this)" title="Pending request may block this slot">${slot} ⏳</button>`;
    } else {
      html += `<button class="slot-btn" onclick="selectSlot('${slot}',this)">${slot}</button>`;
    }
  });

  document.getElementById('slots-content').innerHTML = html;
}

// ─── RENDER CALENDAR ──────────────────────────────────────────────────
function renderCalendar() {
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  document.getElementById('cal-month-label').textContent = `${months[currentMonth]} ${currentYear}`;

  const today = new Date(); today.setHours(0,0,0,0);
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrev = new Date(currentYear, currentMonth, 0).getDate();

  let html = '';
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="date-cell">${daysInPrev - i}</div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(currentYear, currentMonth, d);
    dateObj.setHours(0,0,0,0);
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isPast = dateObj < today;
    const isToday = dateObj.getTime() === today.getTime();
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const isSelected = selectedDate === dateStr;

    let cls = 'date-cell current-month';
    let click = '';

    if (isPast) {
      cls += ' past';
    } else if (isWeekend) {
      cls += ' weekend';
    } else {
      if (isDateFullyBooked(dateStr)) {
        cls += ' fully-booked';
      } else {
        cls += ' available';
        click = `onclick="selectDate('${dateStr}')"`;
      }
      if (isToday) cls += ' today';
    }

    if (isSelected) cls += ' selected';
    html += `<div class="${cls}" ${click}>${d}</div>`;
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="date-cell">${i}</div>`;
  }

  document.getElementById('dates-grid').innerHTML = html;
}

function changeMonth(dir) {
  currentMonth += dir;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
}

// ─── SELECT DATE ──────────────────────────────────────────────────────
function selectDate(dateStr) {
  selectedDate = dateStr;
  selectedSlot = null;
  document.getElementById('selection-summary').classList.remove('visible');
  renderCalendar();
  renderSlots();
}

// ─── SELECT SLOT ──────────────────────────────────────────────────────
function selectSlot(slot, btn) {
  selectedSlot = slot;
  document.querySelectorAll('.slot-btn:not(.taken)').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const dateFormatted = dateObj.toLocaleDateString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  document.getElementById('summary-text').textContent = `${dateFormatted} — ${slot}`;
  document.getElementById('selection-summary').classList.add('visible');

  const banner = document.getElementById('suggestion-banner');
  banner.style.display = 'block';
  document.getElementById('suggestion-text').textContent = `${dateFormatted}, ${slot}`;
}

// ─── CLEAR ────────────────────────────────────────────────────────────
function clearSelection() {
  selectedSlot = null;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('selection-summary').classList.remove('visible');
  document.getElementById('suggestion-banner').style.display = 'none';
}

// ─── INIT ─────────────────────────────────────────────────────────────
// Show greyed slots immediately while data loads
renderSlots();
fetchBookings();