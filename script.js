const els = {
  mode: document.getElementById('mode'),
  alwaysOn: document.getElementById('alwaysOn'),
  startBtn: document.getElementById('startBtn'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  speakBtn: document.getElementById('speakBtn'),
  preview: document.getElementById('preview'),
  status: document.getElementById('status'),
  result: document.getElementById('result'),
  apiUrl: document.getElementById('apiUrl'),
  apiKey: document.getElementById('apiKey')
};

let stream;
let lastNarration = 'No analysis yet.';

function loadConfig() {
  els.mode.value = localStorage.getItem('mode') || 'normal';
  els.alwaysOn.checked = localStorage.getItem('alwaysOn') === 'true';
  els.apiUrl.value = localStorage.getItem('apiUrl') || '';
  els.apiKey.value = localStorage.getItem('apiKey') || '';
  applyMode();
}

function saveConfig() {
  localStorage.setItem('mode', els.mode.value);
  localStorage.setItem('alwaysOn', String(els.alwaysOn.checked));
  localStorage.setItem('apiUrl', els.apiUrl.value.trim());
  localStorage.setItem('apiKey', els.apiKey.value.trim());
}

function applyMode() {
  document.body.classList.toggle('blind', els.mode.value === 'blind');
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    els.status.textContent = 'Camera unsupported on this device/browser.';
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    els.preview.srcObject = stream;
    els.status.textContent = 'Camera active. Ready for analysis.';
  } catch (err) {
    els.status.textContent = `Camera error: ${err.message}`;
  }
}

async function analyzeScene() {
  const endpoint = els.apiUrl.value.trim();
  const apiKey = els.apiKey.value.trim();

  if (!endpoint || !apiKey) {
    lastNarration = 'Set AlphaBrain API endpoint and key first.';
    renderNarration();
    return;
  }

  els.status.textContent = 'Analyzing scene...';

  try {
    // Fallback-friendly payload for low-powered devices.
    const payload = {
      timestamp: new Date().toISOString(),
      mode: els.mode.value,
      app: 'Vision IQ'
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API request failed with ${response.status}`);
    }

    const data = await response.json();
    lastNarration = data.narration || 'Scene analyzed, but no narration returned.';
    renderNarration();
    els.status.textContent = 'Analysis complete.';

    if (els.alwaysOn.checked) {
      speak(lastNarration);
    }
  } catch (err) {
    lastNarration = `Unable to analyze scene: ${err.message}`;
    renderNarration();
    els.status.textContent = 'Analysis failed.';
  }
}

function renderNarration() {
  els.result.textContent = lastNarration;
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    els.status.textContent = 'Speech synthesis unsupported on this device.';
    return;
  }

  const msg = new SpeechSynthesisUtterance(text);
  msg.rate = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(msg);
}

els.mode.addEventListener('change', () => {
  applyMode();
  saveConfig();
});
els.alwaysOn.addEventListener('change', saveConfig);
els.apiUrl.addEventListener('change', saveConfig);
els.apiKey.addEventListener('change', saveConfig);
els.startBtn.addEventListener('click', startCamera);
els.analyzeBtn.addEventListener('click', analyzeScene);
els.speakBtn.addEventListener('click', () => speak(lastNarration));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

loadConfig();
