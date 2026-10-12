// Admin authentication state
let adminAuthenticated = false;
let statsInterval = null;
let currentTab = 'overview';
let currentPasswordChangeType = null;

// Check admin authentication on load
async function checkAdminAuth() {
  try {
    const response = await fetch('/api/admin/auth/check');
    const data = await response.json();

    if (data.authenticated) {
      showAdminDashboard();
      startStatsPolling();
    } else {
      showAdminLogin();
    }
  } catch (error) {
    console.error('Admin auth check failed:', error);
    showAdminLogin();
  }
}

function showAdminLogin() {
  document.getElementById('adminLoginScreen').style.display = 'flex';
  document.getElementById('adminDashboard').style.display = 'none';
  adminAuthenticated = false;
  stopStatsPolling();
}

function showAdminDashboard() {
  document.getElementById('adminLoginScreen').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'flex';
  adminAuthenticated = true;
  loadDashboardData();
}

// Admin login handler
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const passwordInput = document.getElementById('adminPasswordInput');
  const loginError = document.getElementById('adminLoginError');
  const loginBtn = document.querySelector('.admin-login-btn');
  const password = passwordInput.value;

  loginError.textContent = '';
  loginBtn.disabled = true;

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showAdminDashboard();
      passwordInput.value = '';
    } else {
      loginError.textContent = data.error || 'Invalid admin password. Please try again.';
      passwordInput.value = '';
      passwordInput.focus();
      loginBtn.disabled = false;
    }
  } catch (error) {
    console.error('Admin login error:', error);
    loginError.textContent = 'Connection error. Please try again.';
    loginBtn.disabled = false;
  }
});

// Admin logout handler
document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
    showAdminLogin();
  } catch (error) {
    console.error('Logout error:', error);
  }
});

// Tab navigation
document.querySelectorAll('.admin-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
  });
});

function switchTab(tab) {
  // Update nav buttons
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Update tab content
  document.querySelectorAll('.admin-tab').forEach(tabContent => {
    tabContent.classList.remove('active');
  });
  document.getElementById(`${tab}Tab`).classList.add('active');

  currentTab = tab;

  // Load tab-specific data
  if (tab === 'logs') {
    loadLogs();
  } else if (tab === 'overview') {
    loadOverview();
  } else if (tab === 'settings') {
    loadIPLists();
  }
}

// Load dashboard data
async function loadDashboardData() {
  if (currentTab === 'overview') {
    await loadOverview();
  } else if (currentTab === 'logs') {
    await loadLogs();
  } else if (currentTab === 'settings') {
    await loadIPLists();
  }
}

// Load overview tab data
async function loadOverview() {
  try {
    const [statsRes, activityRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/activity')
    ]);

    if (statsRes.ok) {
      const stats = await statsRes.json();
      updateStats(stats);
    }

    if (activityRes.ok) {
      const activity = await activityRes.json();
      updateRecentActivity(activity);
    }
  } catch (error) {
    console.error('Error loading overview:', error);
  }
}

function updateStats(stats) {
  document.getElementById('statActiveSessions').textContent = stats.activeSessions || '0';
  document.getElementById('statTotalUploads').textContent = stats.totalUploads || '0';
  document.getElementById('statAuthAttempts').textContent = stats.authAttempts24h || '0';
  document.getElementById('statUptime').textContent = stats.uptime || '-';
}

function updateRecentActivity(activity) {
  const container = document.getElementById('recentActivity');

  if (!activity || activity.length === 0) {
    container.innerHTML = '<div class="activity-placeholder">No recent activity</div>';
    return;
  }

  container.innerHTML = activity.map(item => {
    const badge = getBadgeClass(item.level || item.type);
    const time = new Date(item.timestamp).toLocaleString();

    return `
      <div class="activity-item">
        <div class="activity-info">
          <div class="activity-message">${escapeHtml(item.message)}</div>
          <div class="activity-meta">${time}${item.ip ? ` · ${item.ip}` : ''}</div>
        </div>
        <div class="activity-badge ${badge}">${item.category || item.type || 'INFO'}</div>
      </div>
    `;
  }).join('');
}

function getBadgeClass(level) {
  const levelMap = {
    'INFO': 'info',
    'WARN': 'warning',
    'WARNING': 'warning',
    'ERROR': 'error',
    'SUCCESS': 'success',
    'AUTH': 'info',
    'UPLOAD': 'success',
    'ACCESS': 'info',
    'ADMIN': 'warning'
  };
  return levelMap[level] || 'info';
}

// Load logs
async function loadLogs() {
  const level = document.getElementById('logLevelFilter').value;
  const category = document.getElementById('logCategoryFilter').value;
  const search = document.getElementById('logSearchInput').value;

  try {
    const params = new URLSearchParams();
    if (level) params.append('level', level);
    if (category) params.append('category', category);
    if (search) params.append('search', search);

    const response = await fetch(`/api/admin/logs?${params}`);
    if (!response.ok) {
      throw new Error('Failed to load logs');
    }

    const logs = await response.json();
    displayLogs(logs);
  } catch (error) {
    console.error('Error loading logs:', error);
    document.getElementById('logsContainer').innerHTML =
      '<div class="logs-placeholder">Failed to load logs</div>';
  }
}

function displayLogs(logs) {
  const container = document.getElementById('logsContainer');

  if (!logs || logs.length === 0) {
    container.innerHTML = '<div class="logs-placeholder">No logs found</div>';
    return;
  }

  container.innerHTML = logs.map(log => {
    const timestamp = new Date(log.timestamp).toLocaleString();
    const metadata = log.metadata && Object.keys(log.metadata).length > 0
      ? ` ${JSON.stringify(log.metadata)}`
      : '';

    return `
      <div class="log-entry">
        <span class="log-timestamp">${timestamp}</span>
        <span class="log-level ${log.level}">${log.level}</span>
        <span class="log-category">[${log.category}]</span>
        <span class="log-message">${escapeHtml(log.message)}${escapeHtml(metadata)}</span>
      </div>
    `;
  }).join('');
}

// Log filters
document.getElementById('logLevelFilter').addEventListener('change', loadLogs);
document.getElementById('logCategoryFilter').addEventListener('change', loadLogs);
document.getElementById('logSearchInput').addEventListener('input', debounce(loadLogs, 500));
document.getElementById('refreshLogsBtn').addEventListener('click', loadLogs);

// Stats polling
function startStatsPolling() {
  if (statsInterval) return;
  statsInterval = setInterval(() => {
    if (adminAuthenticated && currentTab === 'overview') {
      loadOverview();
    }
  }, 10000); // Poll every 10 seconds
}

function stopStatsPolling() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
}

// Settings handlers
document.getElementById('changeUserPasswordBtn').addEventListener('click', () => {
  currentPasswordChangeType = 'user';
  document.getElementById('passwordModalTitle').textContent = 'Change User Password';
  showPasswordModal();
});

document.getElementById('changeAdminPasswordBtn').addEventListener('click', () => {
  currentPasswordChangeType = 'admin';
  document.getElementById('passwordModalTitle').textContent = 'Change Admin Password';
  showPasswordModal();
});

document.getElementById('clearSessionsBtn').addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear all active user sessions? All users will need to log in again.')) {
    return;
  }

  try {
    const response = await fetch('/api/admin/clear-sessions', { method: 'POST' });
    const data = await response.json();

    if (response.ok) {
      alert(data.message || 'All sessions cleared successfully');
    } else {
      alert(data.error || 'Failed to clear sessions');
    }
  } catch (error) {
    console.error('Error clearing sessions:', error);
    alert('Failed to clear sessions');
  }
});

document.getElementById('clearLogsBtn').addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear old logs? This will remove logs older than 7 days.')) {
    return;
  }

  try {
    const response = await fetch('/api/admin/clear-logs', { method: 'POST' });
    const data = await response.json();

    if (response.ok) {
      alert(data.message || 'Old logs cleared successfully');
      if (currentTab === 'logs') {
        loadLogs();
      }
    } else {
      alert(data.error || 'Failed to clear logs');
    }
  } catch (error) {
    console.error('Error clearing logs:', error);
    alert('Failed to clear logs');
  }
});

// Toggle whitelist enabled/disabled
document.getElementById('toggleWhitelistBtn').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/admin/ip-lists');
    const data = await response.json();
    const currentStatus = data.whitelistEnabled;
    const newStatus = !currentStatus;

    const action = newStatus ? 'enable' : 'disable';
    const message = newStatus
      ? 'Enable whitelist mode? Only whitelisted IPs will be able to access the site.'
      : 'Disable whitelist mode? All IPs (except blacklisted) will be able to access the site.';

    if (!confirm(message)) {
      return;
    }

    const toggleResponse = await fetch('/api/admin/whitelist/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: newStatus })
    });

    const toggleData = await toggleResponse.json();

    if (toggleResponse.ok) {
      alert(toggleData.message || `Whitelist ${action}d successfully`);
      updateWhitelistStatus(newStatus);
    } else {
      alert(toggleData.error || `Failed to ${action} whitelist`);
    }
  } catch (error) {
    console.error('Error toggling whitelist:', error);
    alert('Failed to toggle whitelist');
  }
});

// Password modal
function showPasswordModal() {
  const modal = document.getElementById('passwordModal');
  modal.classList.add('active');
  document.getElementById('newPasswordInput').value = '';
  document.getElementById('confirmPasswordInput').value = '';
  document.getElementById('passwordError').textContent = '';
  document.getElementById('passwordError').classList.remove('show');
}

function hidePasswordModal() {
  const modal = document.getElementById('passwordModal');
  modal.classList.remove('active');
}

document.getElementById('closePasswordModal').addEventListener('click', hidePasswordModal);

document.getElementById('passwordModal').addEventListener('click', (e) => {
  if (e.target.id === 'passwordModal') {
    hidePasswordModal();
  }
});

document.getElementById('passwordChangeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const newPassword = document.getElementById('newPasswordInput').value;
  const confirmPassword = document.getElementById('confirmPasswordInput').value;
  const errorDiv = document.getElementById('passwordError');

  errorDiv.classList.remove('show');
  errorDiv.textContent = '';

  if (newPassword.length < 8) {
    errorDiv.textContent = 'Password must be at least 8 characters long';
    errorDiv.classList.add('show');
    return;
  }

  if (newPassword !== confirmPassword) {
    errorDiv.textContent = 'Passwords do not match';
    errorDiv.classList.add('show');
    return;
  }

  try {
    const endpoint = currentPasswordChangeType === 'admin'
      ? '/api/admin/change-admin-password'
      : '/api/admin/change-user-password';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newPassword })
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message || 'Password changed successfully');
      hidePasswordModal();
    } else {
      errorDiv.textContent = data.error || 'Failed to change password';
      errorDiv.classList.add('show');
    }
  } catch (error) {
    console.error('Error changing password:', error);
    errorDiv.textContent = 'Failed to change password';
    errorDiv.classList.add('show');
  }
});

// IP Access Control
async function loadIPLists() {
  try {
    const response = await fetch('/api/admin/ip-lists');
    if (!response.ok) {
      throw new Error('Failed to load IP lists');
    }

    const data = await response.json();
    displayIPList('whitelist', data.whitelist);
    displayIPList('blacklist', data.blacklist);
    updateWhitelistStatus(data.whitelistEnabled);
  } catch (error) {
    console.error('Error loading IP lists:', error);
  }
}

function updateWhitelistStatus(enabled) {
  const statusBadge = document.getElementById('whitelistStatus');
  const toggleBtn = document.getElementById('toggleWhitelistBtn');

  if (enabled) {
    statusBadge.textContent = 'Enabled';
    statusBadge.className = 'status-badge enabled';
    toggleBtn.textContent = 'Disable Whitelist';
    toggleBtn.classList.remove('warning');
  } else {
    statusBadge.textContent = 'Disabled';
    statusBadge.className = 'status-badge disabled';
    toggleBtn.textContent = 'Enable Whitelist';
    toggleBtn.classList.add('warning');
  }
}

function displayIPList(type, ips) {
  const container = document.getElementById(`${type}Container`);

  if (!ips || ips.length === 0) {
    container.innerHTML = `<div class="ip-list-placeholder">No ${type}ed IPs</div>`;
    return;
  }

  container.innerHTML = ips.map(ip => `
    <div class="ip-item">
      <span class="ip-address">${escapeHtml(ip)}</span>
      <button class="ip-remove-btn" onclick="removeIP('${type}', '${escapeHtml(ip)}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        Remove
      </button>
    </div>
  `).join('');
}

async function addIP(type, ip) {
  try {
    const response = await fetch(`/api/admin/${type}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ip })
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message || `IP added to ${type}`);
      await loadIPLists();
    } else {
      alert(data.error || `Failed to add IP to ${type}`);
    }
  } catch (error) {
    console.error(`Error adding IP to ${type}:`, error);
    alert(`Failed to add IP to ${type}`);
  }
}

async function removeIP(type, ip) {
  if (!confirm(`Remove ${ip} from ${type}?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/${type}/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ip })
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message || `IP removed from ${type}`);
      await loadIPLists();
    } else {
      alert(data.error || `Failed to remove IP from ${type}`);
    }
  } catch (error) {
    console.error(`Error removing IP from ${type}:`, error);
    alert(`Failed to remove IP from ${type}`);
  }
}

// IP input handlers
document.getElementById('addWhitelistBtn').addEventListener('click', () => {
  const input = document.getElementById('whitelistInput');
  const ip = input.value.trim();

  if (!ip) {
    alert('Please enter an IP address');
    return;
  }

  addIP('whitelist', ip);
  input.value = '';
});

document.getElementById('addBlacklistBtn').addEventListener('click', () => {
  const input = document.getElementById('blacklistInput');
  const ip = input.value.trim();

  if (!ip) {
    alert('Please enter an IP address');
    return;
  }

  addIP('blacklist', ip);
  input.value = '';
});

// Allow Enter key to add IP
document.getElementById('whitelistInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addWhitelistBtn').click();
  }
});

document.getElementById('blacklistInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addBlacklistBtn').click();
  }
});

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize on page load
checkAdminAuth();
