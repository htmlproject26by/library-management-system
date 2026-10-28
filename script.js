
"use strict";

const $ = id => document.getElementById(id);

const rooms = {
  "Quiet Zone": 12,
  "Reading Hall": 16,
  "Window Bay": 8,
  "Computer Lab": 12,
  "Discussion Room A": 6,
  "Discussion Room B": 6,
  "Group Study Room": 8,
  "Research Room": 8
};

const read = (key, fallback = []) => {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return data ?? fallback;
  } catch {
    return fallback;
  }
};

const user = {
  name: sessionStorage.getItem("name") || "",
  role: sessionStorage.getItem("role") || "student"
};

const userId = user.name.trim().toLowerCase();
const isAdmin = user.role === "admin";

let bookings = read("bookings");
let selectedSeat = null;
let toastTimer;

function refreshBookings() {
  bookings = read("bookings");
}

function saveBookings() {
  localStorage.setItem("bookings", JSON.stringify(bookings));
}

function showToast(message) {
  const toast = $("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("visible");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3000);
}

function notify(owner, message) {
  const key = "notifications_" + owner;
  const notes = read(key);

  notes.unshift({
    id: crypto.randomUUID(),
    message,
    time: new Date().toLocaleString()
  });

  localStorage.setItem(key, JSON.stringify(notes));

  if (owner === userId) {
    renderNotifications();
  }
}

function renderNotifications() {
  const list = $("notificationList");
  if (!list) return;

  const notes = read("notifications_" + userId);
  list.replaceChildren();

  if (!notes.length) {
    list.innerHTML =
      '<p class="empty-state">No notifications yet.</p>';
    return;
  }

  notes.forEach(note => {
    const item = document.createElement("div");
    item.className = "notification-item";

    const content = document.createElement("div");
    content.className = "booking-info";

    const message = document.createElement("p");
    message.textContent = note.message;

    const time = document.createElement("small");
    time.textContent = note.time;

    content.append(message, time);
    item.append(content);
    list.append(item);
  });
}

function getStartMinutes(time) {
  const parts = String(time).split(":").map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function isSeatBusy(room, seatNumber, date, start, duration) {
  // Always check the latest saved bookings.
  refreshBookings();

  const startMinutes = getStartMinutes(start);
  const endMinutes = startMinutes + Number(duration) * 60;

  return bookings.some(booking => {
    if (
      booking.room !== room ||
      Number(booking.seat) !== Number(seatNumber) ||
      booking.date !== date ||
      booking.status !== "Active"
    ) {
      return false;
    }

    const bookingStart = getStartMinutes(booking.start);
    const bookingEnd =
      bookingStart + Number(booking.duration) * 60;

    return overlaps(
      startMinutes,
      endMinutes,
      bookingStart,
      bookingEnd
    );
  });
}

// Prevent one student from holding multiple overlapping bookings.
function isUserBusy(date, start, duration) {
  refreshBookings();

  const startMinutes = getStartMinutes(start);
  const endMinutes = startMinutes + Number(duration) * 60;

  return bookings.some(booking => {
    if (
      booking.owner !== userId ||
      booking.date !== date ||
      booking.status !== "Active"
    ) {
      return false;
    }

    const bookingStart = getStartMinutes(booking.start);
    const bookingEnd =
      bookingStart + Number(booking.duration) * 60;

    return overlaps(
      startMinutes,
      endMinutes,
      bookingStart,
      bookingEnd
    );
  });
}

function getBookingEnd(booking) {
  return getStartMinutes(booking.start) +
    Number(booking.duration) * 60;
}

function populateTimes() {
  const select = $("startHour");
  if (!select) return;

  select.replaceChildren();

  for (let hour = 9; hour <= 21; hour++) {
    const labelHour = hour % 12 || 12;
    const suffix = hour < 12 ? "AM" : "PM";

    select.add(new Option(
      `${labelHour}:00 ${suffix}`,
      `${String(hour).padStart(2, "0")}:00`
    ));
  }
}

function initializeDate() {
  const dateInput = $("bookingDate");
  if (!dateInput) return;

  const now = new Date();

  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");

  dateInput.min = today;

  if (!dateInput.value || dateInput.value < today) {
    dateInput.value = today;
  }
}

function renderAdmin() {
  const panel = $("adminPanel");
  if (!panel || !isAdmin) return;

  panel.classList.remove("hidden");

  const active = bookings.filter(
    booking => booking.status === "Active"
  );

  $("adminTotal").textContent = bookings.length;
  $("adminActive").textContent = active.length;
  $("adminPast").textContent = bookings.length - active.length;

  const list = $("adminBookingList");
  list.replaceChildren();

  if (!bookings.length) {
    list.innerHTML =
      '<p class="empty-state">No bookings yet.</p>';
    return;
  }

  bookings.forEach(booking => {
    const row = document.createElement("div");
    row.className = "booking-row";

    const info = document.createElement("div");
    info.className = "booking-info";

    const title = document.createElement("b");
    title.textContent =
      `${booking.ownerName || booking.owner} · ${booking.room}`;

    const details = document.createElement("small");
    details.textContent =
      `Seat ${booking.seat} · ${booking.date} · ` +
      `${booking.start} · ${booking.duration} hour(s)`;

    const status = document.createElement("span");
    status.textContent = booking.status;

    info.append(title, details, status);
    row.append(info);
    list.append(row);
  });
}

function renderBookingHistory() {
  const list = $("bookingList");
  if (!list) return;

  list.replaceChildren();

  const mine = bookings.filter(
    booking => booking.owner === userId
  );

  if (!mine.length) {
    list.innerHTML =
      '<p class="empty-state">You have no bookings yet.</p>';
    return;
  }

  mine.slice().reverse().forEach(booking => {
    const row = document.createElement("div");
    row.className = "booking-row";

    const seatBox = document.createElement("div");
    seatBox.className = "booking-seat";
    seatBox.textContent = booking.seat;

    const info = document.createElement("div");
    info.className = "booking-info";

    const title = document.createElement("b");
    title.textContent = booking.room;

    const details = document.createElement("small");
    details.textContent =
      `${booking.date} · ${booking.start} · ` +
      `${booking.duration} hour(s)`;

    const status = document.createElement("span");
    status.textContent = booking.status;

    if (booking.status === "Active") {
      status.classList.add("status-active");
    }

    info.append(title, details, status);
    row.append(seatBox, info);

    if (booking.status === "Active") {
      const cancel = document.createElement("button");
      cancel.className = "button secondary cancel-button";
      cancel.textContent = "Cancel";
      cancel.dataset.cancel = booking.id;

      cancel.setAttribute(
        "aria-label",
        `Cancel booking for ${booking.room}, seat ${booking.seat}`
      );

      row.append(cancel);
    }

    list.append(row);
  });
}

function render() {
  const roomSelect = $("roomSelect");
  const map = $("seatMap");

  if (!roomSelect || !map) return;

  refreshBookings();

  const room = roomSelect.value;
  const date = $("bookingDate").value;
  const start = $("startHour").value;
  const duration = Number($("duration").value || 1);
  const totalSeats = rooms[room] || 0;

  $("selectedRoomName").textContent = room;
  $("seatCountLabel").textContent = `${totalSeats} seats`;

  map.replaceChildren();

  for (let number = 1; number <= totalSeats; number++) {
    const busy = date && start &&
      isSeatBusy(room, number, date, start, duration);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "seat";
    button.textContent = number;
    button.dataset.seat = number;

    if (selectedSeat === number && !busy) {
      button.classList.add("chosen");
      button.setAttribute("aria-pressed", "true");
    }

    if (busy) {
      button.disabled = true;
      button.classList.add("unavailable");
      button.title = "Already booked for this time";
    } else if (isAdmin) {
      button.disabled = true;
      button.title = "Administrators cannot book seats";
    } else {
      button.title = `Select seat ${number}`;
    }

    map.append(button);
  }

  if (selectedSeat && selectedSeat > totalSeats) {
    selectedSeat = null;
  }

  const available = [...map.querySelectorAll(".seat")]
    .filter(button => !button.disabled).length;

  $("availableCount").textContent = available;

  const mine = bookings.filter(
    booking =>
      booking.owner === userId &&
      booking.status === "Active"
  );

  $("activeCount").textContent = isAdmin
    ? bookings.filter(
        booking => booking.status === "Active"
      ).length
    : mine.length;

  $("roomCount").textContent = Object.keys(rooms).length;
  $("bookButton").hidden = isAdmin;

  $("seatHint").textContent = isAdmin
    ? "Administrator mode: bookings are view-only."
    : selectedSeat
      ? `Selected seat: ${selectedSeat}`
      : "Select an available seat to continue.";

  renderBookingHistory();
  renderAdmin();
}

function handleBooking() {
  if (isAdmin) return;

  const room = $("roomSelect").value;
  const date = $("bookingDate").value;
  const start = $("startHour").value;
  const duration = Number($("duration").value);

  if (!room || !date || !start || !selectedSeat) {
    showToast("Choose a room, date, time and seat first.");
    return;
  }

  if (!rooms[room]) {
    showToast("Please select a valid room.");
    return;
  }

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    showToast("Choose a valid booking duration.");
    return;
  }

  const startMinutes = getStartMinutes(start);
  const endMinutes = startMinutes + duration * 60;

  if (
    startMinutes < 9 * 60 ||
    endMinutes > 22 * 60
  ) {
    showToast("Bookings must end by 10 PM.");
    return;
  }

  const startDate = new Date(`${date}T${start}:00`);

  if (
    Number.isNaN(startDate.getTime()) ||
    startDate <= new Date()
  ) {
    showToast("Choose a future date and time.");
    return;
  }

  // Refresh saved data immediately before the final checks.
  refreshBookings();

  // Rule 1: A seat cannot be booked twice for overlapping times.
  if (isSeatBusy(room, selectedSeat, date, start, duration)) {
    selectedSeat = null;
    render();
    showToast(
      "This seat is already booked for that time. Choose another seat or time."
    );
    return;
  }

  // Rule 2: A student cannot have overlapping active bookings,
  // even if the bookings are in different rooms.
  if (isUserBusy(date, start, duration)) {
    selectedSeat = null;
    render();
    showToast(
      "You already have a booking during this time. Cancel it or choose another time."
    );
    return;
  }

  const booking = {
    id: crypto.randomUUID(),
    owner: userId,
    ownerName: user.name,
    room,
    seat: selectedSeat,
    date,
    start,
    duration,
    status: "Active",
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);
  saveBookings();

  notify(
    userId,
    `Booking confirmed: ${room}, seat ${booking.seat} on ${date}.`
  );

  const bookedSeat = booking.seat;
  selectedSeat = null;

  render();

  showToast(`Seat ${bookedSeat} booked successfully!`);
}

function cancelBooking(id) {
  refreshBookings();

  const booking = bookings.find(
    item =>
      item.id === id &&
      item.owner === userId &&
      item.status === "Active"
  );

  if (!booking) {
    showToast("This booking is no longer active.");
    render();
    return;
  }

  if (!confirm(
    `Cancel your booking for ${booking.room}, seat ${booking.seat}?`
  )) {
    return;
  }

  booking.status = "Cancelled";
  saveBookings();

  notify(
    userId,
    `Booking cancelled: ${booking.room}, seat ${booking.seat}.`
  );

  selectedSeat = null;
  render();
  showToast("Booking cancelled.");
}

function initializeDashboard() {
  if (!$("seatMap")) return;

  if (!user.name) {
    location.replace("index.html");
    return;
  }

  $("profileName").textContent = user.name;
  $("profileAvatar").textContent =
    user.name.charAt(0).toUpperCase();
  $("profileRole").textContent =
    isAdmin ? "Administrator" : "Student";

  if (isAdmin) {
    $("adminPanel").classList.remove("hidden");
    $("bookButton").hidden = true;
  }

  populateTimes();
  initializeDate();

  [
    "roomSelect",
    "bookingDate",
    "startHour",
    "duration"
  ].forEach(id => {
    $(id).addEventListener("change", () => {
      selectedSeat = null;
      render();
    });
  });

  $("seatMap").addEventListener("click", event => {
    const button = event.target.closest("[data-seat]");

    if (!button || button.disabled || isAdmin) return;

    selectedSeat = Number(button.dataset.seat);
    render();
  });

  $("bookButton").addEventListener("click", handleBooking);

  $("bookingList").addEventListener("click", event => {
    const button = event.target.closest("[data-cancel]");
    if (button) cancelBooking(button.dataset.cancel);
  });

  $("clearHistory").addEventListener("click", () => {
    if (isAdmin) return;

    refreshBookings();

    const hasCancelled = bookings.some(
      booking =>
        booking.owner === userId &&
        booking.status === "Cancelled"
    );

    if (!hasCancelled) {
      showToast("There are no cancelled bookings to clear.");
      return;
    }

    if (!confirm(
      "Remove all your cancelled bookings from history?"
    )) {
      return;
    }

    bookings = bookings.filter(
      booking =>
        booking.owner !== userId ||
        booking.status !== "Cancelled"
    );

    saveBookings();
    render();
    showToast("Cancelled bookings cleared.");
  });

  $("clearNotifications").addEventListener("click", () => {
    if (!confirm("Clear all your notifications?")) return;

    localStorage.removeItem("notifications_" + userId);
    renderNotifications();
    showToast("Notifications cleared.");
  });

  document.querySelectorAll(".resource-card").forEach(button => {
    button.addEventListener("click", () => {
      const room = button.dataset.room;
      if (!rooms[room]) return;

      $("roomSelect").value = room;
      selectedSeat = null;
      render();

      $("booking").scrollIntoView({ behavior: "smooth" });
    });
  });

  $("signOut").addEventListener("click", () => {
    sessionStorage.removeItem("name");
    sessionStorage.removeItem("role");
    location.replace("index.html");
  });

  window.addEventListener("storage", event => {
    if (event.key === "bookings") {
      refreshBookings();
      selectedSeat = null;
      render();
    }

    if (event.key === "notifications_" + userId) {
      renderNotifications();
    }
  });

  render();
  renderNotifications();
}

$("loginForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const name = $("personName").value.trim();

  const role = document.querySelector(
    'input[name="role"]:checked'
  )?.value;

  if (!name || !role) {
    showToast("Enter your name and select an access type.");
    return;
  }

  sessionStorage.setItem("name", name);
  sessionStorage.setItem(
    "role",
    role === "Administrator" ? "admin" : "student"
  );

  location.href = "home.html";
});

initializeDashboard();
