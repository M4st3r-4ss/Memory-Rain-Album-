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

  // Connect WebSocket for real-time heart sync
  connectWebSocket();
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
    this.isSpawning = false;
    this.isAnimating = false;
    this.lastFrameTime = null;
    this.speedMultiplier = 1;
    this.targetSpeed = 1;
    this.isOnline = navigator.onLine;

    window.addEventListener('resize', () => {
      this.maxChekis = this.calculateMaxChekis();
    });

    // Monitor network status changes
    window.addEventListener('online', () => {
      console.log('Network connection restored');
      this.isOnline = true;
      this.showNetworkStatus('Connection restored', true);
      // Retry loading files if we had none
      if (this.files.length === 0) {
        this.loadExistingFiles();
      }
    });

    window.addEventListener('offline', () => {
      console.warn('Network connection lost');
      this.isOnline = false;
      this.showNetworkStatus('Connection lost - using cached images', false);
    });

    // Scroll down to speed up the rain; speed decays back to 1× on its own
    window.addEventListener('wheel', (e) => {
      if (e.deltaY > 0) {
        this.targetSpeed = Math.min(this.targetSpeed + Math.abs(e.deltaY) * 0.008, 8);
      }
    }, { passive: true });

    // Touch: swipe down to speed up (mirrors the scroll-down direction on mobile)
    let lastTouchY = null;
    window.addEventListener('touchstart', (e) => {
      lastTouchY = e.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (lastTouchY === null) return;
      const deltaY = e.touches[0].clientY - lastTouchY; // positive when finger moves down
      if (deltaY > 0) {
        this.targetSpeed = Math.min(this.targetSpeed + deltaY * 0.030, 8);
      }
      lastTouchY = e.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchend', () => { lastTouchY = null; }, { passive: true });
  }

  showNetworkStatus(message, isOnline) {
    // Remove existing notification if present
    const existing = document.querySelector('.network-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'network-notification';
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: ${isOnline ? '#6EE7B7' : '#E9A568'};
      color: #05070C;
      padding: 12px 24px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideDown 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
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
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch('/api/files', {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 401) {
          showLoginScreen();
          return;
        }

        this.files = await response.json();

        if (this.files.length > 0) {
          this.startRain();
        }

        // Success - exit retry loop
        console.log('Memory loaded successfully');
        return;

      } catch (error) {
        console.warn(`Failed to load files (attempt ${attempt + 1}/${maxRetries}):`, error.message);

        // If this was the last attempt, give up
        if (attempt === maxRetries - 1) {
          console.error('Failed to load files after all retries');
          return;
        }

        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  startRain() {
    if (this.isSpawning) return;
    this.isSpawning = true;
    this._startRafLoop();

    const spawnCheki = () => {
      if (this.files.length === 0) {
        this.isSpawning = false;
        return;
      }

      if (!this._paused && this.fallingChekis.length < this.maxChekis) {
        this.createCheki();
      }

      const nextDelay = (Math.random() * 2000 + 1500) / this.speedMultiplier;
      setTimeout(spawnCheki, nextDelay);
    };

    spawnCheki();
  }

  _startRafLoop() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.lastFrameTime = performance.now();
    this._paused = false;

    const tick = (now) => {
      if (this._paused) return; // let the loop die; visibilitychange will restart it

      const dt = Math.min(now - this.lastFrameTime, 64);
      this.lastFrameTime = now;

      // Ease speedMultiplier toward targetSpeed, then decay targetSpeed back to 1
      this.speedMultiplier += (this.targetSpeed - this.speedMultiplier) * 0.15;
      this.targetSpeed = 1 + (this.targetSpeed - 1) * 0.93;
      if (this.targetSpeed < 1.01) this.targetSpeed = 1;

      for (let i = this.fallingChekis.length - 1; i >= 0; i--) {
        const c = this.fallingChekis[i];
        c.y += c.pixelsPerMs * dt * this.speedMultiplier;

        const progress = (c.y - c.startY) / (c.endY - c.startY);
        c.element.style.opacity = Math.min(1, progress * 10);
        c.element.style.transform = `translateY(${c.y}px) rotate(${c.rotation}deg)`;

        if (c.y >= c.endY) {
          c.element.remove();
          this.fallingChekis.splice(i, 1);
        }
      }

      requestAnimationFrame(tick);
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._paused = true;
      } else {
        this._paused = false;
        this.lastFrameTime = performance.now(); // prevent burst on return
        requestAnimationFrame(tick); // explicitly restart since loop may have died
      }
    });

    requestAnimationFrame(tick);
  }

  createCheki() {
    if (this.files.length === 0) return;

    const currentlyDisplayedFiles = this.fallingChekis.map(c => c.fileUrl);
    const availableFiles = this.files.filter(f => !currentlyDisplayedFiles.includes(f.url));
    if (availableFiles.length === 0) return;

    const file = availableFiles[Math.floor(Math.random() * availableFiles.length)];

    const screenHeight = window.innerHeight;
    const baseWidth = window.innerWidth <= 768 ? 100 : 120;
    const startY = -200;
    const endY = screenHeight + 200;
    const durationMs = Math.random() * 10000 + 15000;
    const pixelsPerMs = (endY - startY) / durationMs;
    const rotation = Math.random() * 40 - 20;

    const buildCheki = (aspectRatio, mediaElement) => {
      // Only build if media loaded successfully
      if (!mediaElement) {
        console.error('Media element failed to load, skipping cheki creation');
        return;
      }

      const cheki = document.createElement('div');
      cheki.className = 'cheki';

      cheki.style.width = `${baseWidth}px`;

      const positions = this.findNonOverlappingPosition(baseWidth);
      cheki.style.left = `${positions.x}px`;
      cheki.style.top = '0px';
      cheki.style.opacity = '0';
      cheki.style.transform = `translateY(${startY}px) rotate(${rotation}deg)`;

      const wrapper = document.createElement('div');
      wrapper.className = 'cheki-image-wrapper';
      wrapper.style.height = `${baseWidth / aspectRatio}px`;

      // Use the already-loaded media element
      if (file.type === 'video') {
        mediaElement.className = 'cheki-video';
        mediaElement.muted = true;
        mediaElement.loop = true;
        mediaElement.playsInline = true;
        mediaElement.setAttribute('loading', 'lazy');
        wrapper.appendChild(mediaElement);
        mediaElement.play().catch(() => {});
      } else {
        mediaElement.className = 'cheki-image';
        mediaElement.alt = 'Memory';
        mediaElement.setAttribute('loading', 'lazy');
        mediaElement.setAttribute('decoding', 'async');
        wrapper.appendChild(mediaElement);
      }

      cheki.appendChild(wrapper);

      cheki.addEventListener('click', () => {
        this.viewFile(file);
      });

      this.container.appendChild(cheki);

      this.fallingChekis.push({
        element: cheki,
        x: positions.x,
        y: startY,
        startY,
        endY,
        width: baseWidth,
        height: baseWidth / aspectRatio + 30,
        pixelsPerMs,
        rotation,
        spawnTime: Date.now(),
        fileUrl: file.url
      });
    };

    if (file.type === 'video') {
      this.loadVideoWithRetry(file.url, buildCheki);
    } else {
      this.loadImageWithRetry(file.url, buildCheki);
    }
  }

  loadImageWithRetry(url, callback, attempt = 0, maxRetries = 3) {
    const img = new Image();

    img.onload = () => {
      console.log(`Image loaded successfully: ${url}`);
      callback(img.naturalWidth / img.naturalHeight || 1, img);
    };

    img.onerror = (error) => {
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`Image load failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${url}`, error);
        setTimeout(() => {
          this.loadImageWithRetry(url, callback, attempt + 1, maxRetries);
        }, delay);
      } else {
        console.error(`Image load failed after all retries: ${url}`, error);
        // Log additional debugging info
        console.error('Error details:', {
          url: url,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          connection: navigator.connection ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt
          } : 'not available'
        });
        callback(null, null);
      }
    };

    img.src = url;
  }

  loadVideoWithRetry(url, callback, attempt = 0, maxRetries = 3) {
    const video = document.createElement('video');
    video.src = url;

    video.addEventListener('loadedmetadata', () => {
      console.log(`Video loaded successfully: ${url}`);
      callback(video.videoWidth / video.videoHeight || 1, video);
    });

    video.addEventListener('error', (error) => {
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`Video load failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${url}`, error);
        setTimeout(() => {
          this.loadVideoWithRetry(url, callback, attempt + 1, maxRetries);
        }, delay);
      } else {
        console.error(`Video load failed after all retries: ${url}`, error);
        // Log additional debugging info
        console.error('Error details:', {
          url: url,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          connection: navigator.connection ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt
          } : 'not available'
        });
        callback(null, null);
      }
    });
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

    // Stop any currently playing video before clearing content
    const existingVideo = content.querySelector('video');
    if (existingVideo) {
      existingVideo.pause();
      existingVideo.src = '';
      existingVideo.load();
    }

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

const photoRain = new PhotoRain();

const uploadBtn = document.getElementById('uploadBtn');
const uploadModal = document.getElementById('uploadModal');
const closeModal = document.getElementById('closeModal');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const viewerModal = document.getElementById('viewerModal');
const closeViewer = document.getElementById('closeViewer');

uploadBtn.addEventListener('click', () => {
  uploadModal.classList.add('active');
});

closeModal.addEventListener('click', () => {
  uploadModal.classList.remove('active');
});

closeViewer.addEventListener('click', () => {
  // Stop video playback when closing viewer
  const video = document.querySelector('#viewerContent video');
  if (video) {
    video.pause();
    video.src = '';
    video.load();
  }
  viewerModal.classList.remove('active');
});

uploadModal.addEventListener('click', (e) => {
  if (e.target === uploadModal) {
    uploadModal.classList.remove('active');
  }
});

viewerModal.addEventListener('click', (e) => {
  if (e.target === viewerModal) {
    // Stop video playback when clicking outside modal
    const video = document.querySelector('#viewerContent video');
    if (video) {
      video.pause();
      video.src = '';
      video.load();
    }
    viewerModal.classList.remove('active');
  }
});

// Stop video on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && viewerModal.classList.contains('active')) {
    const video = document.querySelector('#viewerContent video');
    if (video) {
      video.pause();
      video.src = '';
      video.load();
    }
    viewerModal.classList.remove('active');
  }
});

uploadArea.addEventListener('click', () => {
  fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = 'var(--accent)';
  uploadArea.style.background = 'var(--bg-deep)';
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.style.borderColor = 'var(--accent-muted)';
  uploadArea.style.background = 'var(--bg-mid)';
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = 'var(--accent-muted)';
  uploadArea.style.background = 'var(--bg-mid)';

  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    uploadFiles(files);
  }
});

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    uploadFiles(files);
  }
});

async function uploadFiles(files) {
  uploadArea.style.display = 'none';
  uploadProgress.style.display = 'block';

  let completed = 0;
  const total = files.length;

  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const filePercentage = (e.loaded / e.total) * 100;
            const totalPercentage = ((completed + (filePercentage / 100)) / total) * 100;
            progressFill.style.width = `${totalPercentage}%`;
            progressText.textContent = `Uploading ${completed + 1}/${total}... ${Math.round(filePercentage)}%`;
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const fileInfo = JSON.parse(xhr.responseText);
            photoRain.addFile(fileInfo);
            completed++;
            resolve();
          } else if (xhr.status === 401) {
            reject(new Error('Unauthorized'));
            showLoginScreen();
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('POST', '/upload');
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Upload error:', error);
      if (error.message === 'Unauthorized') {
        alert('Session expired. Please login again.');
        uploadModal.classList.remove('active');
        return;
      }
      alert(`Upload failed for file ${completed + 1}. Continuing with remaining files.`);
      completed++;
    }
  }

  progressText.textContent = 'All uploads complete!';
  progressFill.style.width = '100%';

  setTimeout(() => {
    uploadModal.classList.remove('active');
    uploadProgress.style.display = 'none';
    uploadArea.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Uploading...';
    fileInput.value = '';
  }, 1000);
}

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch(error => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// ==================== REAL-TIME HEART SYNC ====================

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    reconnectAttempts = 0;
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'heart') {
        createSyncedHeart(data.x, data.y);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');

    // Attempt reconnection
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... (attempt ${reconnectAttempts})`);
        connectWebSocket();
      }, 2000 * reconnectAttempts);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function createSyncedHeart(x, y) {
  const heart = document.createElement('div');
  heart.className = 'synced-heart';
  heart.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  `;

  heart.style.left = `${x}px`;
  heart.style.top = `${y}px`;

  document.body.appendChild(heart);

  // Remove after animation completes
  setTimeout(() => {
    heart.remove();
  }, 2000);
}

// Handle tap/click on the main app
document.addEventListener('click', (e) => {
  // Only send hearts when user is authenticated and viewing main app
  const mainApp = document.getElementById('mainApp');
  if (!mainApp || mainApp.style.display === 'none') return;

  // Don't send hearts when clicking on UI elements
  if (e.target.closest('button') || e.target.closest('.modal') || e.target.closest('.cheki')) {
    return;
  }

  const x = e.clientX;
  const y = e.clientY;

  // Create local heart immediately
  createSyncedHeart(x, y);

  // Send to other users via WebSocket
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'heart',
      x: x,
      y: y
    }));
  }
});

// Initialize auth check on page load
checkAuth();
