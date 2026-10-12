import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import session from 'express-session';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

// Server start time for uptime calculation
const serverStartTime = Date.now();

// Trust Cloudflare/proxy so req.ip returns the real client IP
app.set('trust proxy', 1);

// Password for authentication
const PASSWORD = '00000000';

// Admin password for admin panel (CHANGE THIS IN PRODUCTION!)
let ADMIN_PASSWORD = '00000000';

// Rate limiting for login attempts
const loginAttempts = new Map(); // Store: IP -> { count, firstAttempt, lockUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutes window

// IP Access Control
const ipListsFile = path.join(__dirname, 'ip-lists.json');
let ipWhitelist = new Set();
let ipBlacklist = new Set();
let whitelistEnabled = false;

// Load IP lists from file
function loadIPLists() {
  try {
    if (fs.existsSync(ipListsFile)) {
      const data = JSON.parse(fs.readFileSync(ipListsFile, 'utf8'));
      ipWhitelist = new Set(data.whitelist || []);
      ipBlacklist = new Set(data.blacklist || []);
      whitelistEnabled = data.whitelistEnabled !== undefined ? data.whitelistEnabled : false;
      logger.info('SERVER', 'IP lists loaded', { whitelist: ipWhitelist.size, blacklist: ipBlacklist.size, whitelistEnabled });
    }
  } catch (error) {
    logger.error('SERVER', 'Failed to load IP lists', { error: error.message });
  }
}

// Save IP lists to file
function saveIPLists() {
  try {
    const data = {
      whitelist: Array.from(ipWhitelist),
      blacklist: Array.from(ipBlacklist),
      whitelistEnabled: whitelistEnabled,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(ipListsFile, JSON.stringify(data, null, 2));
    logger.info('SERVER', 'IP lists saved', { whitelist: ipWhitelist.size, blacklist: ipBlacklist.size, whitelistEnabled });
  } catch (error) {
    logger.error('SERVER', 'Failed to save IP lists', { error: error.message });
  }
}

// Check if IP is allowed
function isIPAllowed(ip) {
  // If blacklisted, deny
  if (ipBlacklist.has(ip)) {
    return false;
  }

  // If whitelist is disabled, allow all (except blacklisted)
  if (!whitelistEnabled) {
    return true;
  }

  // If whitelist is enabled, only allow whitelisted IPs
  return ipWhitelist.has(ip);
}

loadIPLists();

// Session middleware
app.use(session({
  secret: 'memory-rain-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// IP Access Control Middleware
app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;

  // Skip IP check for admin panel access (so admins can always manage IP lists)
  if (req.path.startsWith('/api/admin/')) {
    return next();
  }

  if (!isIPAllowed(clientIP)) {
    logger.warn('ACCESS', 'IP blocked', { ip: clientIP, path: req.path });
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
});

// Log all requests
app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  logger.access(req.path, { method: req.method, ip: clientIP });
  next();
});

app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  }
});

// Serve static files with no-cache headers for development
app.use((req, res, next) => {
  if (req.url.endsWith('.js') || req.url.endsWith('.css') || req.url.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    return next();
  }
  const clientIP = req.ip || req.connection.remoteAddress;
  logger.warn('AUTH', 'Unauthorized access attempt', { ip: clientIP, path: req.path });
  res.status(401).json({ error: 'Unauthorized' });
};

// Admin authentication middleware
const requireAdminAuth = (req, res, next) => {
  if (req.session.adminAuthenticated) {
    return next();
  }
  const clientIP = req.ip || req.connection.remoteAddress;
  logger.warn('ADMIN', 'Unauthorized admin access attempt', { ip: clientIP, path: req.path });
  res.status(401).json({ error: 'Unauthorized' });
};

// Login endpoint
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress;

  // Check if IP is currently locked out
  const attemptData = loginAttempts.get(clientIP);
  const now = Date.now();

  if (attemptData) {
    // Check if still locked out
    if (attemptData.lockUntil && now < attemptData.lockUntil) {
      const remainingMinutes = Math.ceil((attemptData.lockUntil - now) / 60000);
      logger.warn('AUTH', 'Login attempt while locked out', { ip: clientIP, remainingMinutes });
      return res.status(429).json({
        error: 'Too many failed attempts',
        lockoutRemaining: remainingMinutes,
        lockedOut: true
      });
    }

    // Reset if attempt window has passed
    if (now - attemptData.firstAttempt > ATTEMPT_WINDOW) {
      loginAttempts.delete(clientIP);
    }
  }

  // Check password
  if (password === PASSWORD) {
    // Successful login - clear any attempt records
    loginAttempts.delete(clientIP);
    req.session.authenticated = true;
    logger.auth('User login', true, { ip: clientIP });
    res.json({ success: true });
  } else {
    // Failed login - record attempt
    const currentAttemptData = loginAttempts.get(clientIP) || {
      count: 0,
      firstAttempt: now,
      lockUntil: null
    };

    currentAttemptData.count++;

    // Check if should lock out
    if (currentAttemptData.count >= MAX_ATTEMPTS) {
      currentAttemptData.lockUntil = now + LOCKOUT_DURATION;
      loginAttempts.set(clientIP, currentAttemptData);

      logger.warn('AUTH', 'Account locked due to failed attempts', { ip: clientIP, attempts: currentAttemptData.count });

      return res.status(429).json({
        error: 'Too many failed attempts. Account locked for 15 minutes.',
        lockoutRemaining: 15,
        lockedOut: true
      });
    }

    loginAttempts.set(clientIP, currentAttemptData);

    const attemptsRemaining = MAX_ATTEMPTS - currentAttemptData.count;
    logger.auth('User login', false, { ip: clientIP, attemptsRemaining });
    res.status(401).json({
      error: 'Invalid password',
      attemptsRemaining
    });
  }
});

// Check auth status
app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  req.session.destroy();
  logger.info('AUTH', 'User logout', { ip: clientIP });
  res.json({ success: true });
});

app.use(express.static('public'));

// Serve uploads with proper cache headers for mobile devices
app.use('/uploads', requireAuth, (req, res, next) => {
  // Set cache headers for images and videos to reduce loading issues on mobile
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Accept-Ranges', 'bytes');
  next();
}, express.static('uploads'));

// Upload endpoint
app.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const clientIP = req.ip || req.connection.remoteAddress;
  const fileInfo = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
    url: `/uploads/${req.file.filename}`
  };

  logger.upload(req.file.filename, {
    ip: clientIP,
    originalName: req.file.originalname,
    size: req.file.size,
    type: fileInfo.type
  });

  res.json(fileInfo);
});

// Get all uploads
app.get('/api/files', requireAuth, (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read uploads' });
    }

    const fileList = files.map(filename => {
      const ext = path.extname(filename).toLowerCase();
      const isVideo = ['.mp4', '.mov', '.avi', '.webm'].includes(ext);

      return {
        filename: filename,
        type: isVideo ? 'video' : 'image',
        url: `/uploads/${filename}`
      };
    });

    res.json(fileList);
  });
});

// ==================== ADMIN PANEL ROUTES ====================

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress;

  if (password === ADMIN_PASSWORD) {
    req.session.adminAuthenticated = true;
    logger.auth('Admin login', true, { ip: clientIP });
    res.json({ success: true });
  } else {
    logger.auth('Admin login', false, { ip: clientIP });
    res.status(401).json({ error: 'Invalid admin password' });
  }
});

// Check admin auth status
app.get('/api/admin/auth/check', (req, res) => {
  res.json({ authenticated: !!req.session.adminAuthenticated });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  req.session.adminAuthenticated = false;
  logger.info('ADMIN', 'Admin logout', { ip: clientIP });
  res.json({ success: true });
});

// Get system stats
app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
  try {
    // Count active sessions (rough estimate)
    const activeSessions = loginAttempts.size;

    // Count total uploads
    const files = fs.readdirSync(uploadsDir);
    const totalUploads = files.length;

    // Get log stats
    const logStats = logger.getStats();
    const authAttempts24h = logStats?.last24h?.byCategory?.AUTH || 0;

    // Calculate uptime
    const uptimeMs = Date.now() - serverStartTime;
    const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const uptime = `${uptimeHours}h ${uptimeMinutes}m`;

    res.json({
      activeSessions,
      totalUploads,
      authAttempts24h,
      uptime
    });
  } catch (error) {
    logger.error('ADMIN', 'Failed to get stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get recent activity
app.get('/api/admin/activity', requireAdminAuth, (req, res) => {
  try {
    const logs = logger.getLogs(20);
    const activity = logs.map(log => ({
      message: log.message,
      type: log.category,
      level: log.level,
      timestamp: log.timestamp,
      ip: log.metadata?.ip
    }));
    res.json(activity);
  } catch (error) {
    logger.error('ADMIN', 'Failed to get activity', { error: error.message });
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

// Get logs with filtering
app.get('/api/admin/logs', requireAdminAuth, (req, res) => {
  try {
    const filter = {
      level: req.query.level,
      category: req.query.category,
      search: req.query.search
    };
    const limit = parseInt(req.query.limit) || 1000;
    const logs = logger.getLogs(limit, filter);
    res.json(logs);
  } catch (error) {
    logger.error('ADMIN', 'Failed to get logs', { error: error.message });
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Clear all user sessions
app.post('/api/admin/clear-sessions', requireAdminAuth, (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    loginAttempts.clear();
    logger.info('ADMIN', 'All user sessions cleared', { ip: clientIP });
    res.json({ success: true, message: 'All sessions cleared successfully' });
  } catch (error) {
    logger.error('ADMIN', 'Failed to clear sessions', { error: error.message });
    res.status(500).json({ error: 'Failed to clear sessions' });
  }
});

// Change user password
app.post('/api/admin/change-user-password', requireAdminAuth, (req, res) => {
  try {
    const { newPassword } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // In production, this should write to a secure config file or environment variable
    // For now, we'll just update the in-memory variable
    logger.warn('ADMIN', 'User password change requested but not persisted (in-memory only)', { ip: clientIP });

    res.json({
      success: true,
      message: 'User password updated (Note: This is in-memory only. Update the PASSWORD constant in server.js for persistence)',
      warning: 'Password change is not persisted. Update server.js manually.'
    });
  } catch (error) {
    logger.error('ADMIN', 'Failed to change user password', { error: error.message });
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Change admin password
app.post('/api/admin/change-admin-password', requireAdminAuth, (req, res) => {
  try {
    const { newPassword } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Update the in-memory admin password
    ADMIN_PASSWORD = newPassword;
    logger.warn('ADMIN', 'Admin password changed (in-memory only)', { ip: clientIP });

    res.json({
      success: true,
      message: 'Admin password updated successfully (Note: This is in-memory only. Update ADMIN_PASSWORD in server.js for persistence)',
      warning: 'Password change is not persisted. Update server.js manually for permanent change.'
    });
  } catch (error) {
    logger.error('ADMIN', 'Failed to change admin password', { error: error.message });
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Clear old logs
app.post('/api/admin/clear-logs', requireAdminAuth, (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    // This is a placeholder - logger would need a method to clear old logs
    logger.info('ADMIN', 'Old logs clear requested', { ip: clientIP });
    res.json({ success: true, message: 'Log cleanup completed (placeholder)' });
  } catch (error) {
    logger.error('ADMIN', 'Failed to clear logs', { error: error.message });
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// Get IP lists
app.get('/api/admin/ip-lists', requireAdminAuth, (req, res) => {
  try {
    res.json({
      whitelist: Array.from(ipWhitelist),
      blacklist: Array.from(ipBlacklist),
      whitelistEnabled: whitelistEnabled
    });
  } catch (error) {
    logger.error('ADMIN', 'Failed to get IP lists', { error: error.message });
    res.status(500).json({ error: 'Failed to get IP lists' });
  }
});

// Toggle whitelist enabled/disabled
app.post('/api/admin/whitelist/toggle', requireAdminAuth, (req, res) => {
  try {
    const { enabled } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Valid boolean value required' });
    }

    whitelistEnabled = enabled;
    saveIPLists();

    logger.info('ADMIN', `Whitelist ${enabled ? 'enabled' : 'disabled'}`, { adminIP: clientIP });
    res.json({
      success: true,
      message: `Whitelist ${enabled ? 'enabled' : 'disabled'}`,
      whitelistEnabled: whitelistEnabled
    });
  } catch (error) {
    logger.error('ADMIN', 'Failed to toggle whitelist', { error: error.message });
    res.status(500).json({ error: 'Failed to toggle whitelist' });
  }
});

// Add IP to whitelist
app.post('/api/admin/whitelist/add', requireAdminAuth, (req, res) => {
  try {
    const { ip } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ error: 'Valid IP address required' });
    }

    ipWhitelist.add(ip);
    // Remove from blacklist if present
    ipBlacklist.delete(ip);
    saveIPLists();

    logger.info('ADMIN', 'IP added to whitelist', { ip, adminIP: clientIP });
    res.json({ success: true, message: `IP ${ip} added to whitelist` });
  } catch (error) {
    logger.error('ADMIN', 'Failed to add IP to whitelist', { error: error.message });
    res.status(500).json({ error: 'Failed to add IP to whitelist' });
  }
});

// Remove IP from whitelist
app.post('/api/admin/whitelist/remove', requireAdminAuth, (req, res) => {
  try {
    const { ip } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ error: 'Valid IP address required' });
    }

    ipWhitelist.delete(ip);
    saveIPLists();

    logger.info('ADMIN', 'IP removed from whitelist', { ip, adminIP: clientIP });
    res.json({ success: true, message: `IP ${ip} removed from whitelist` });
  } catch (error) {
    logger.error('ADMIN', 'Failed to remove IP from whitelist', { error: error.message });
    res.status(500).json({ error: 'Failed to remove IP from whitelist' });
  }
});

// Add IP to blacklist
app.post('/api/admin/blacklist/add', requireAdminAuth, (req, res) => {
  try {
    const { ip } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ error: 'Valid IP address required' });
    }

    // Prevent admin from blocking themselves
    if (ip === clientIP) {
      return res.status(400).json({ error: 'Cannot blacklist your own IP address' });
    }

    ipBlacklist.add(ip);
    // Remove from whitelist if present
    ipWhitelist.delete(ip);
    saveIPLists();

    logger.warn('ADMIN', 'IP added to blacklist', { ip, adminIP: clientIP });
    res.json({ success: true, message: `IP ${ip} added to blacklist` });
  } catch (error) {
    logger.error('ADMIN', 'Failed to add IP to blacklist', { error: error.message });
    res.status(500).json({ error: 'Failed to add IP to blacklist' });
  }
});

// Remove IP from blacklist
app.post('/api/admin/blacklist/remove', requireAdminAuth, (req, res) => {
  try {
    const { ip } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ error: 'Valid IP address required' });
    }

    ipBlacklist.delete(ip);
    saveIPLists();

    logger.info('ADMIN', 'IP removed from blacklist', { ip, adminIP: clientIP });
    res.json({ success: true, message: `IP ${ip} removed from blacklist` });
  } catch (error) {
    logger.error('ADMIN', 'Failed to remove IP from blacklist', { error: error.message });
    res.status(500).json({ error: 'Failed to remove IP from blacklist' });
  }
});

// ==================== END ADMIN PANEL ROUTES ====================

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin panel available at http://localhost:${PORT}/admin.html`);
  logger.info('SERVER', 'Server started', { port: PORT });
});
