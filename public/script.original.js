// Authentication check
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/check');
    const data = await response.json();

    if (data.authenticated) {
      showMainApp();
    } else {
      showLoginScreen();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showLoginScreen();
  }
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  photoRain.loadExistingFiles();
}

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const passwordInput = document.getElementById('passwordInput');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.querySelector('.login-btn');
  const password = passwordInput.value;

  loginError.textContent = '';
  loginBtn.disabled = true;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showMainApp();
      passwordInput.value = '';
    } else if (response.status === 429 && data.lockedOut) {
      // Account locked out
      loginError.textContent = `Too many failed attempts. Locked out for ${data.lockoutRemaining} minute(s). Please try again later.`;
      passwordInput.disabled = true;
      loginBtn.disabled = true;

      // Re-enable after lockout period
      setTimeout(() => {
        passwordInput.disabled = false;
        loginBtn.disabled = false;
        loginError.textContent = 'Lockout period expired. You may try again.';
      }, data.lockoutRemaining * 60 * 1000);
    } else {
      // Invalid password
      const attemptsMsg = data.attemptsRemaining
        ? ` (${data.attemptsRemaining} attempt${data.attemptsRemaining !== 1 ? 's' : ''} remaining)`
        : '';
      loginError.textContent = `Invalid password. Please try again.${attemptsMsg}`;
      passwordInput.value = '';
      passwordInput.focus();
      loginBtn.disabled = false;
    }
  } catch (error) {
    console.error('Login error:', error);
    loginError.textContent = 'Connection error. Please try again.';
    loginBtn.disabled = false;
  }
});

class PhotoRain {
  constructor() {
    this.container = document.getElementById('rainContainer');
    this.files = [];
    this.fallingChekis = [];
    this.maxChekis = this.calculateMaxChekis();
    this.spawnInterval = 3000;
    this.isSpawning = false;

    window.addEventListener('resize', () => {
      this.maxChekis = this.calculateMaxChekis();
    });
  }

  calculateMaxChekis() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const chekiWidth = window.innerWidth <= 768 ? 100 : 120;
    const chekiHeight = window.innerWidth <= 768 ? 140 : 160;

    const columns = Math.floor(screenWidth / (chekiWidth * 1.5));
    const rows = Math.floor(screenHeight / (chekiHeight * 1.2));

    return Math.max(8, Math.min(columns * rows, 30));
  }

  async loadExistingFiles() {
    try {
      const response = await fetch('/api/files');
      if (response.status === 401) {
        // Not authenticated, redirect to login
        showLoginScreen();
        return;
      }
      this.files = await response.json();

      if (this.files.length > 0) {
        this.startRain();
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  }

  startRain() {
    if (this.isSpawning) return;
    this.isSpawning = true;

    const spawnCheki = () => {
      if (this.files.length === 0) {
        this.isSpawning = false;
        return;
      }

      if (this.fallingChekis.length < this.maxChekis) {
        this.createCheki();
      }

      const nextDelay = Math.random() * 2000 + 1500;
      setTimeout(spawnCheki, nextDelay);
    };

    spawnCheki();
  }

  createCheki() {
    if (this.files.length === 0) return;

    // Get files that are not currently on screen
    const currentlyDisplayedFiles = this.fallingChekis.map(c => c.fileUrl);
    const availableFiles = this.files.filter(f => !currentlyDisplayedFiles.includes(f.url));

    // If all files are on screen, skip spawning
    if (availableFiles.length === 0) return;

    const file = availableFiles[Math.floor(Math.random() * availableFiles.length)];
    const cheki = document.createElement('div');
    cheki.className = 'cheki';

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const baseWidth = window.innerWidth <= 768 ? 100 : 120;

    const buildCheki = (aspectRatio) => {
      const chekiWidth = baseWidth;
      const chekiHeight = baseWidth / aspectRatio + 30; // +30 for polaroid bottom margin

      cheki.style.width = `${chekiWidth}px`;

      const positions = this.findNonOverlappingPosition(chekiWidth);
      const startX = positions.x;
      const startY = -200;
      const endY = screenHeight + 200;
      const duration = Math.random() * 10000 + 15000;
      const rotation = Math.random() * 40 - 20;

      cheki.style.left = `${startX}px`;
      cheki.style.setProperty('--start-y', startY);
      cheki.style.setProperty('--end-y', endY);
      cheki.style.setProperty('--fall-duration', `${duration}ms`);
      cheki.style.setProperty('--rotation', `${rotation}deg`);

      const wrapper = document.createElement('div');
      wrapper.className = 'cheki-image-wrapper';
      wrapper.style.height = `${baseWidth / aspectRatio}px`;

      if (file.type === 'video') {
        const video = document.createElement('video');
        video.className = 'cheki-video';
        video.src = file.url;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;

        const icon = document.createElement('div');
        icon.className = 'cheki-video-icon';

        wrapper.appendChild(video);
        // Removed icon overlay to not block the view

        video.play().catch(() => {});
      } else {
        const imgElement = document.createElement('img');
        imgElement.className = 'cheki-image';
        imgElement.src = file.url;
        imgElement.alt = 'Memory';
        wrapper.appendChild(imgElement);
      }

      cheki.appendChild(wrapper);

      cheki.addEventListener('click', () => {
        this.viewFile(file);
      });

      this.container.appendChild(cheki);

      const chekiData = {
        element: cheki,
        x: startX,
        y: startY,
        width: chekiWidth,
        height: chekiHeight,
        spawnTime: Date.now(),
        fileUrl: file.url
      };
      this.fallingChekis.push(chekiData);

      setTimeout(() => {
        if (cheki.parentNode) {
          cheki.parentNode.removeChild(cheki);
        }
        this.fallingChekis = this.fallingChekis.filter(c => c.element !== cheki);
      }, duration);
    };

    // Load media to get its aspect ratio
    if (file.type === 'video') {
      const video = document.createElement('video');
      video.src = file.url;
      video.addEventListener('loadedmetadata', () => {
        const aspectRatio = video.videoWidth / video.videoHeight;
        buildCheki(aspectRatio || 1);
      });
      video.addEventListener('error', () => {
        buildCheki(1); // Default to square if error
      });
    } else {
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        buildCheki(aspectRatio || 1);
      };
      img.onerror = () => {
        buildCheki(1); // Default to square if error
      };
      img.src = file.url;
    }
  }

  findNonOverlappingPosition(chekiWidth) {
    const screenWidth = window.innerWidth;
    const maxAttempts = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Math.random() * (screenWidth - chekiWidth);

      const recentChekis = this.fallingChekis.filter(c => {
        return Date.now() - c.spawnTime < 2000;
      });

      let overlaps = false;
      for (const existing of recentChekis) {
        const dx = Math.abs(x - existing.x);
        if (dx < chekiWidth * 1.3) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        return { x };
      }
    }

    return { x: Math.random() * (screenWidth - chekiWidth) };
  }

  addFile(fileInfo) {
    this.files.push(fileInfo);

    if (!this.isSpawning) {
      this.startRain();
    }
  }

  viewFile(file) {
    const modal = document.getElementById('viewerModal');
    const content = document.getElementById('viewerContent');
    const downloadBtn = document.getElementById('downloadBtn');

    content.innerHTML = '';

    if (file.type === 'video') {
      const video = document.createElement('video');
      video.src = file.url;
      video.controls = true;
      video.autoplay = true;
      content.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = file.url;
      img.alt = 'Memory';
      content.appendChild(img);
    }

    downloadBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.filename || 'memory';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    modal.classList.add('active');
  }
}
