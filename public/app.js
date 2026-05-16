const appRoot = document.getElementById('app');
const scanNav = document.getElementById('scanNav');

const templates = {
  auth: document.getElementById('authTemplate'),
  profile: document.getElementById('profileTemplate'),
  scan: document.getElementById('scanTemplate')
};

const state = {
  profile: null,
  tags: [],
  qrToken: null,
  qrExpiresAt: null,
  selectedTags: new Set()
};

const TAG_LABELS = {
  老师: 'Teacher',
  工程师: 'Engineer',
  医生: 'Doctor',
  Nothing: 'Nothing'
};

const api = {
  async getTags() {
    const res = await fetch('/api/tags');
    return res.json();
  },
  async signup(payload) {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Signup failed');
    return res.json();
  },
  async login(payload) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },
  async fetchProfile(id) {
    const res = await fetch(`/api/profile/${id}`);
    if (!res.ok) throw new Error('Profile not found');
    return res.json();
  },
  async generateQr(id) {
    const res = await fetch(`/api/profile/${id}/qr`, { method: 'POST' });
    if (!res.ok) throw new Error('QR generation failed');
    return res.json();
  },
  async loadQr(token) {
    const res = await fetch(`/api/qr/${token}`);
    if (!res.ok) throw new Error('QR invalid or expired');
    return res.json();
  },
  async submitTags(token, tags) {
    const res = await fetch(`/api/qr/${token}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags })
    });
    if (!res.ok) throw new Error('Submit failed');
    return res.json();
  }
};

function clearRoot() {
  appRoot.innerHTML = '';
}

function render(template) {
  clearRoot();
  appRoot.appendChild(template.content.cloneNode(true));
}

function setProfileTags(tags) {
  const container = document.getElementById('profileTags');
  container.innerHTML = '';
  if (!tags.length) {
    container.innerHTML = '<span class="muted">No tags yet.</span>';
    return;
  }
  tags.forEach((tag) => {
    const el = document.createElement('span');
    el.className = 'tag';
    el.textContent = TAG_LABELS[tag] || tag;
    container.appendChild(el);
  });
}

function updateQrStatus() {
  const statusEl = document.getElementById('qrStatus');
  if (!state.qrExpiresAt) {
    statusEl.textContent = 'Click to generate a new QR code.';
    return;
  }
  const remaining = Math.max(0, state.qrExpiresAt - Date.now());
  if (remaining <= 0) {
    statusEl.textContent = 'QR code expired. Please generate a new one.';
    return;
  }
  const seconds = Math.ceil(remaining / 1000);
  statusEl.textContent = `QR code expires in ${seconds}s`;
}

function startQrCountdown() {
  updateQrStatus();
  if (state.qrTimer) {
    clearInterval(state.qrTimer);
  }
  state.qrTimer = setInterval(updateQrStatus, 1000);
}

function applyProfile(profile) {
  const photo = document.getElementById('profilePhoto');
  const name = document.getElementById('profileName');
  photo.style.backgroundImage = `url(${profile.photoUrl})`;
  name.textContent = profile.name;
  setProfileTags(profile.tags || []);
}

async function showProfileView() {
  render(templates.profile);
  if (!state.profile) {
    const id = localStorage.getItem('profileId');
    if (!id) {
      showAuthView('signup');
      return;
    }
    state.profile = await api.fetchProfile(id);
  }
  applyProfile(state.profile);

  const switchAccount = document.getElementById('switchAccount');
  switchAccount.addEventListener('click', () => {
    localStorage.removeItem('profileId');
    state.profile = null;
    showAuthView('login');
  });

  const generateBtn = document.getElementById('generateQr');
  const qrImage = document.getElementById('qrImage');
  const tokenText = document.getElementById('qrTokenText');
  const copyBtn = document.getElementById('copyToken');

  tokenText.textContent = '-';

  copyBtn.addEventListener('click', async () => {
    if (!state.qrToken) return;
    try {
      await navigator.clipboard.writeText(state.qrToken);
      copyBtn.textContent = 'Copied';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 1500);
    } catch (error) {
      alert('Copy failed');
    }
  });

  generateBtn.addEventListener('click', async () => {
    try {
      const data = await api.generateQr(state.profile.id);
      state.qrToken = data.token;
      state.qrExpiresAt = data.expiresAt;
      qrImage.src = data.qrDataUrl;
      tokenText.textContent = data.token;
      startQrCountdown();
    } catch (error) {
      alert('Failed to generate QR code');
    }
  });

  startQrCountdown();
}

function bindAuthForms() {
  const signupForm = document.getElementById('signupForm');
  const loginForm = document.getElementById('loginForm');
  const message = document.getElementById('authMessage');

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const payload = {
      username: formData.get('username'),
      password: formData.get('password'),
      name: formData.get('name'),
      photoUrl: formData.get('photoUrl')
    };
    try {
      const profile = await api.signup(payload);
      localStorage.setItem('profileId', profile.id);
      state.profile = profile;
      showProfileView();
    } catch (error) {
      message.textContent = 'Sign up failed. Username may already exist.';
    }
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const payload = {
      username: formData.get('username'),
      password: formData.get('password')
    };
    try {
      const profile = await api.login(payload);
      localStorage.setItem('profileId', profile.id);
      state.profile = profile;
      showProfileView();
    } catch (error) {
      message.textContent = 'Login failed. Check your username or password.';
    }
  });
}

function showAuthView(mode = 'signup') {
  render(templates.auth);
  const signupForm = document.getElementById('signupForm');
  const loginForm = document.getElementById('loginForm');
  const title = document.getElementById('authTitle');
  const hint = document.getElementById('authHint');
  const showSignup = document.getElementById('showSignup');
  const showLogin = document.getElementById('showLogin');

  const setMode = (nextMode) => {
    if (nextMode === 'login') {
      signupForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      title.textContent = 'Log In';
      hint.textContent = 'Enter your username and password to access your profile.';
    } else {
      signupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      title.textContent = 'Create Your Profile';
      hint.textContent = 'Sign up to generate a QR Code so others can add fixed tags for you.';
    }
  };

  showSignup.addEventListener('click', () => setMode('signup'));
  showLogin.addEventListener('click', () => setMode('login'));

  setMode(mode);
  bindAuthForms();
}

function renderTagChoices(tags) {
  const container = document.getElementById('availableTags');
  container.innerHTML = '';
  tags.forEach((tag) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tag';
    el.textContent = tag;
    el.addEventListener('click', () => {
      if (state.selectedTags.has(tag)) {
        state.selectedTags.delete(tag);
        el.classList.remove('selected');
      } else {
        state.selectedTags.add(tag);
        el.classList.add('selected');
      }
    });
    container.appendChild(el);
  });
}

async function showScanView() {
  render(templates.scan);
  state.selectedTags.clear();

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const scanInput = document.getElementById('scanInput');
  const tagSelector = document.getElementById('tagSelector');
  const owner = document.getElementById('scanOwner');
  const message = document.getElementById('tagMessage');
  const scannerView = document.getElementById('qrScanner');
  const startScanner = document.getElementById('startScanner');
  const scannerMessage = document.getElementById('scannerMessage');

  const tagsData = await api.getTags();
  state.tags = tagsData.tags || [];
  renderTagChoices(state.tags);

  async function loadToken(targetToken) {
    try {
      const data = await api.loadQr(targetToken);
      state.qrToken = targetToken;
      owner.innerHTML = `
        <div class="profile-photo" style="background-image:url(${data.profile.photoUrl})"></div>
        <div class="profile-name">${data.profile.name}</div>
      `;
      scanInput.classList.add('hidden');
      tagSelector.classList.remove('hidden');
      message.textContent = '';
    } catch (error) {
      message.textContent = 'QR code is invalid or expired.';
    }
  }

  async function startCameraScan() {
    if (!window.Html5Qrcode) {
      scannerMessage.textContent = 'Scanner component not loaded. Please refresh.';
      return;
    }
    scannerMessage.textContent = 'Starting camera...';
    const html5QrCode = new Html5Qrcode('qrScanner');
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices.length) {
        scannerMessage.textContent = 'No available camera detected.';
        return;
      }
      const cameraId = devices[0].id;
      await html5QrCode.start(
        cameraId,
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          if (!decodedText) return;
          scannerMessage.textContent = 'QR code detected. Loading...';
          await html5QrCode.stop();
          const url = new URL(decodedText);
          const tokenFromUrl = url.searchParams.get('token');
          if (tokenFromUrl) {
            await loadToken(tokenFromUrl);
            return;
          }
          await loadToken(decodedText.trim());
        },
        () => {}
      );
      scannerMessage.textContent = 'Please align the QR code within the frame.';
    } catch (error) {
      scannerMessage.textContent = 'Camera start failed. Check permissions.';
    }
  }

  if (token) {
    await loadToken(token);
  }

  startScanner.addEventListener('click', () => {
    startCameraScan();
  });

  const loadBtn = document.getElementById('loadToken');
  loadBtn.addEventListener('click', () => {
    const input = document.getElementById('tokenInput');
    if (input.value.trim()) {
      loadToken(input.value.trim());
    }
  });

  const confirmBtn = document.getElementById('confirmTags');
  confirmBtn.addEventListener('click', async () => {
    if (!state.qrToken) return;
    try {
      await api.submitTags(state.qrToken, Array.from(state.selectedTags));
      message.textContent = 'Submitted! Thanks for adding tags.';
    } catch (error) {
      message.textContent = 'Submit failed. Please try again.';
    }
  });
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');

  if (mode === 'scan') {
    await showScanView();
  } else {
    const id = localStorage.getItem('profileId');
    if (id) {
      try {
        state.profile = await api.fetchProfile(id);
        await showProfileView();
      } catch (error) {
        showAuthView('login');
      }
    } else {
      showAuthView('signup');
    }
  }
}

scanNav.addEventListener('click', () => {
  window.open('/?mode=scan', '_blank');
});

init();
