const loginPanel = document.getElementById('loginPanel');
const loginForm = document.getElementById('loginForm');
const nameInput = document.getElementById('nameInput');
const colorInput = document.getElementById('colorInput');
const loginStatus = document.getElementById('loginStatus');
const appLayout = document.getElementById('appLayout');
const roomInput = document.getElementById('roomInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomStatus = document.getElementById('roomStatus');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatLog = document.getElementById('chatLog');
const legendList = document.getElementById('legendList');
const cyclistSelect = document.getElementById('cyclistSelect');
const destinationInput = document.getElementById('destinationInput');
const rerouteBtn = document.getElementById('rerouteBtn');

const socket = io();
let map = null;
let me = null;
let activeRoom = null;
let watchId = null;
let markers = new Map();
let users = [];
let rerouteLines = [];

function initMap() {
  map = L.map('map').setView([20, 78], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}

function addChatMessage(payload) {
  const li = document.createElement('li');
  li.innerHTML = `<strong style="color:${payload.color}">${payload.userName}</strong>: ${payload.text}`;
  chatLog.appendChild(li);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderLegend() {
  legendList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="legend-dot" style="background:${user.color}"></span>${user.name}`;
    legendList.appendChild(li);
  });
}

function renderCyclistSelect() {
  cyclistSelect.innerHTML = '';
  users
    .filter((u) => u.id !== me.id)
    .forEach((u) => {
      const option = document.createElement('option');
      option.value = u.id;
      option.textContent = u.name;
      cyclistSelect.appendChild(option);
    });
}

function updateMarkers(payloadUsers) {
  users = payloadUsers;

  payloadUsers.forEach((u) => {
    if (typeof u.lat !== 'number' || typeof u.lng !== 'number') {
      return;
    }

    let marker = markers.get(u.id);
    if (!marker) {
      marker = L.circleMarker([u.lat, u.lng], {
        radius: 8,
        color: u.color,
        fillColor: u.color,
        fillOpacity: 0.8
      }).addTo(map);
      markers.set(u.id, marker);
    } else {
      marker.setLatLng([u.lat, u.lng]);
      marker.setStyle({ color: u.color, fillColor: u.color });
    }

    marker.bindTooltip(`${u.name}`, { permanent: false });
  });

  const activeIds = new Set(payloadUsers.map((u) => u.id));
  Array.from(markers.keys()).forEach((id) => {
    if (!activeIds.has(id)) {
      map.removeLayer(markers.get(id));
      markers.delete(id);
    }
  });

  renderLegend();
  renderCyclistSelect();
}

function parseDestination() {
  const raw = destinationInput.value.trim();
  const [latText, lngText] = raw.split(',');
  const lat = Number(latText);
  const lng = Number(lngText);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return [lat, lng];
}

function clearRerouteLines() {
  rerouteLines.forEach((line) => map.removeLayer(line));
  rerouteLines = [];
}

rerouteBtn.addEventListener('click', () => {
  const targetId = Number(cyclistSelect.value);
  const destination = parseDestination();
  const meState = users.find((u) => u.id === me.id);
  const otherState = users.find((u) => u.id === targetId);

  if (!destination || !meState || !otherState || meState.lat === null || otherState.lat === null) {
    roomStatus.textContent = 'Need valid destination and live locations for both cyclists.';
    return;
  }

  clearRerouteLines();

  const toCyclist = L.polyline([
    [meState.lat, meState.lng],
    [otherState.lat, otherState.lng]
  ], { color: otherState.color, dashArray: '8,4' }).addTo(map);

  const toDestination = L.polyline([
    [otherState.lat, otherState.lng],
    destination
  ], { color: '#111111' }).addTo(map);

  rerouteLines.push(toCyclist, toDestination);
  map.fitBounds(L.featureGroup(rerouteLines).getBounds().pad(0.2));
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = 'Saving login...';

  const body = {
    name: nameInput.value.trim(),
    color: colorInput.value
  };

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    loginStatus.textContent = 'Login failed. Try another name.';
    return;
  }

  const payload = await response.json();
  me = payload.user;
  localStorage.setItem('cycleconnectUser', JSON.stringify(me));

  loginPanel.classList.add('hidden');
  appLayout.classList.remove('hidden');
  initMap();

  if (payload.persistedColor) {
    loginStatus.textContent = `Welcome back ${me.name}. Your saved color ${me.color} is fixed.`;
  }
});

joinRoomBtn.addEventListener('click', () => {
  if (!me) {
    roomStatus.textContent = 'Please login first.';
    return;
  }

  activeRoom = roomInput.value.trim();
  if (!activeRoom) {
    roomStatus.textContent = 'Please enter a room name.';
    return;
  }

  socket.emit('join-room', { roomName: activeRoom, user: me });
  roomStatus.textContent = `Joined room: ${activeRoom}`;

  if ('geolocation' in navigator) {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    watchId = navigator.geolocation.watchPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const speed = position.coords.speed ? position.coords.speed * 3.6 : 0;

      socket.emit('location-update', { lat, lng, speed });

      if (map) {
        map.setView([lat, lng], Math.max(map.getZoom(), 14));
      }
    }, () => {
      roomStatus.textContent = 'Failed to read your location.';
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
    });
  }
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!activeRoom) {
    roomStatus.textContent = 'Join a room to chat.';
    return;
  }

  const text = chatInput.value.trim();
  if (!text) {
    return;
  }

  socket.emit('chat-message', { text });
  chatInput.value = '';
});

socket.on('room-users', (payloadUsers) => {
  updateMarkers(payloadUsers);
});

socket.on('locations', (payloadUsers) => {
  updateMarkers(payloadUsers);
});

socket.on('chat-message', (message) => {
  addChatMessage(message);
});

const stored = localStorage.getItem('cycleconnectUser');
if (stored) {
  try {
    me = JSON.parse(stored);
    nameInput.value = me.name;
    colorInput.value = me.color;
  } catch (_error) {
    localStorage.removeItem('cycleconnectUser');
  }
}
