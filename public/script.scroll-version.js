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
    this.scrollSpeedMultiplier = 1;
    this.lastScrollY = 0;
    this.isAnimating = false;

    window.addEventListener('resize', () => {
      this.maxChekis = this.calculateMaxChekis();
    });

    // Track scroll events to speed up rain
    let scrollTimeout;
    window.addEventListener('wheel', (e) => {
      const deltaY = Math.abs(e.deltaY);

      // Boost factor based on wheel delta (1x to 5x)
      this.scrollSpeedMultiplier = 1 + Math.min(deltaY / 30, 4);

      // Reset boost after scroll stops
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.scrollSpeedMultiplier = 1;
      }, 150);
    }, { passive: true });

    // For touch devices, track touch scroll
    let lastTouchY = 0;
    let lastTouchTime = 0;
    let touchScrollTimeout;

    window.addEventListener('touchmove', (e) => {
      const currentTouchY = e.touches[0].clientY;
      const currentTime = Date.now();
      const deltaY = Math.abs(lastTouchY - currentTouchY);
      const deltaTime = currentTime - lastTouchTime;

      if (deltaTime > 0) {
        const velocity = deltaY / deltaTime;
        this.scrollSpeedMultiplier = 1 + Math.min(velocity * 2, 4);
      }

      lastTouchY = currentTouchY;
      lastTouchTime = currentTime;

      clearTimeout(touchScrollTimeout);
      touchScrollTimeout = setTimeout(() => {
        this.scrollSpeedMultiplier = 1;
      }, 150);
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      lastTouchY = e.touches[0].clientY;
      lastTouchTime = Date.now();
    }, { passive: true });

    // Start animation loop
    this.startAnimationLoop();
  }

  startAnimationLoop() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    const animate = () => {
      this.updateChekiPositions();
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  updateChekiPositions() {
    const now = Date.now();

    this.fallingChekis.forEach(chekiData => {
      if (!chekiData.element) return;

      const elapsed = now - chekiData.startTime;
      const progress = elapsed / chekiData.baseDuration;

      // Apply scroll speed multiplier to progress
      const boostedProgress = Math.min(progress * this.scrollSpeedMultiplier, 1);

      // Calculate current Y position
      const currentY = chekiData.startY + (chekiData.endY - chekiData.startY) * boostedProgress;

      // Update position
      chekiData.element.style.transform = `translateY(${currentY}px) rotate(${chekiData.rotation}deg)`;
      chekiData.element.style.opacity = boostedProgress < 0.1 ? boostedProgress * 10 : 1;

      // Update internal tracking
      chekiData.currentProgress = boostedProgress;
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
        fileUrl: file.url,
        startY: startY,
        endY: endY,
        startTime: Date.now(),
        baseDuration: duration,
        rotation: rotation,
        currentProgress: 0
      };
      this.fallingChekis.push(chekiData);

      // Remove cheki after duration completes
      setTimeout(() => {
        if (cheki.parentNode) {
          cheki.parentNode.removeChild(cheki);
        }
        this.fallingChekis = this.fallingChekis.filter(c => c.element !== cheki);
      }, duration * 1.5); // Give extra time for boosted speeds
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
  viewerModal.classList.remove('active');
});

uploadModal.addEventListener('click', (e) => {
  if (e.target === uploadModal) {
    uploadModal.classList.remove('active');
  }
});

viewerModal.addEventListener('click', (e) => {
  if (e.target === viewerModal) {
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

// Initialize auth check on page load
checkAuth();
