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

  // ─── GET SLOTS FOR DATE ───────────────────────────────────────────────
  function getSlotsForDate(bookings, dateStr) {
    const result = { 'Schedule A': [], 'Schedule B': [] };
    bookings.forEach(b => {
      const raw = b['Preferred Date'];
      if (!raw) return;
      const bookingDate = raw.substring(0, 10);
      if (bookingDate !== dateStr) return;
      const schedule = b['Schedule Set'];
      const time = b['Preferred Time'];
      if (schedule && time && result[schedule] !== undefined) {
        result[schedule].push(time);
      }
    });
    return result;
  }

  // ─── IS DATE FULLY BOOKED ─────────────────────────────────────────────
  function isDateFullyBooked(dateStr) {
    const approved = getSlotsForDate(approvedBookings, dateStr);
    return SCHEDULES.every(s => approved[s].length >= ALL_SLOTS.length);
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
    selectedSchedule = null;
    renderCalendar();
    clearSelection(false);

    const approved = getSlotsForDate(approvedBookings, dateStr);
    const pending  = getSlotsForDate(pendingBookings, dateStr);

    const dateObj = new Date(dateStr + 'T00:00:00');
    const formatted = dateObj.toLocaleDateString('en-PH', {
      weekday:'long', month:'long', day:'numeric', year:'numeric'
    });
    document.getElementById('slots-date-title').textContent = formatted;

    let html = '';
    SCHEDULES.forEach(schedule => {
      const takenSlots   = approved[schedule] || [];
      const pendingSlots = pending[schedule]  || [];
      html += `<div class="schedule-block">`;
      html += `<div class="schedule-label">${schedule}</div>`;

      const allTaken = takenSlots.length >= ALL_SLOTS.length;
      if (allTaken) {
        html += `<div class="slots-grid"><span class="all-taken">All slots for ${schedule} are fully booked.</span></div>`;
      } else {
        html += `<div class="slots-grid">`;
        ALL_SLOTS.forEach(slot => {
          const isTaken   = takenSlots.includes(slot);
          const isPending = pendingSlots.includes(slot);
          if (isTaken) {
            html += `<button class="slot-btn taken" disabled title="Already approved">${slot}</button>`;
          } else if (isPending) {
            html += `<button class="slot-btn pending" onclick="selectSlot('${slot}','${schedule}',this)" title="Someone has a pending request for this slot">${slot} ⏳</button>`;
          } else {
            html += `<button class="slot-btn" onclick="selectSlot('${slot}','${schedule}',this)">${slot}</button>`;
          }
        });
        html += `</div>`;
      }
      html += `</div>`;
    });

    document.getElementById('slots-content').innerHTML = html;
    const s = document.getElementById('slots-section');
    s.classList.add('visible');
    setTimeout(() => s.scrollIntoView({ behavior:'smooth', block:'nearest' }), 100);
    hideForm();
  }

  // ─── SELECT SLOT ──────────────────────────────────────────────────────
  function selectSlot(slot, schedule, btn) {
    selectedSlot = slot;
    selectedSchedule = schedule;
    document.querySelectorAll('.slot-btn:not(.taken)').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const dateObj = new Date(selectedDate + 'T00:00:00');
    const dateFormatted = dateObj.toLocaleDateString('en-PH', {
      weekday: 'long', month:'long', day:'numeric', year:'numeric'
    });

    const summaryText = `${dateFormatted} — ${slot} (${schedule})`;
    document.getElementById('summary-text').textContent = summaryText;
    document.getElementById('selection-summary').classList.add('visible');

    document.getElementById('suggestion-text').textContent = `${dateFormatted}, ${slot} (${schedule})`;

    document.getElementById('step1-indicator').classList.remove('active');
    document.getElementById('step1-indicator').classList.add('done');
    document.getElementById('step2-indicator').classList.add('active');
    showForm();
  }

  // ─── CLEAR / SHOW / HIDE ──────────────────────────────────────────────
  function clearSelection(resetDate = true) {
    selectedSlot = null;
    selectedSchedule = null;
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('selection-summary').classList.remove('visible');
    hideForm();
    if (resetDate) {
      selectedDate = null;
      renderCalendar();
      document.getElementById('step1-indicator').classList.add('active');
      document.getElementById('step1-indicator').classList.remove('done');
      document.getElementById('step2-indicator').classList.remove('active');
    }
  }

  function showForm() {
    const layout = document.getElementById('booking-layout');
    layout.classList.remove('form-hidden');
    const f = document.getElementById('step2');
    f.classList.add('visible');
    if (window.innerWidth <= 768) {
      setTimeout(() => f.scrollIntoView({ behavior:'smooth', block:'start' }), 200);
    }
  }

  function hideForm() {
    const layout = document.getElementById('booking-layout');
    layout.classList.add('form-hidden');
    document.getElementById('step2').classList.remove('visible');
  }

  // ─── INIT ─────────────────────────────────────────────────────────────
  fetchBookings();