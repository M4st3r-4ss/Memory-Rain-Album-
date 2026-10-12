# Admin Panel Setup

## Access Information

**Admin Panel URL:** `http://localhost:3002/admin.html`

**Default Admin Password:** `admin_memory_rain_2024`

**⚠️ IMPORTANT:** Change the admin password immediately after first login!

## Features

### Overview Dashboard
- Real-time statistics (active sessions, uploads, auth attempts, uptime)
- Recent activity feed showing all system events
- Auto-refreshes every 10 seconds

### Logs Viewer
- Filter by level (INFO, WARN, ERROR)
- Filter by category (AUTH, UPLOAD, ACCESS, ADMIN)
- Search across all log messages and metadata
- Real-time refresh capability

### Settings
- **Change User Password:** Update the main application password for users
- **Change Admin Password:** Update your admin panel password
- **Clear All Sessions:** Force logout all active users
- **Clear Old Logs:** Remove logs older than 7 days
- **IP Access Control:** Manage whitelist and blacklist of IP addresses
  - **Whitelist Toggle:** Enable/disable whitelist enforcement
    - **Disabled (default):** All IPs can access (except blacklisted)
    - **Enabled:** ONLY whitelisted IPs can access (blacklist still enforced)
  - **Whitelist:** List of allowed IP addresses (only enforced when toggle is enabled)
  - **Blacklist:** Blocked IPs are always denied access, regardless of whitelist setting
  - IP lists and toggle state are persisted to `ip-lists.json` file

## Security Notes

1. **Separate Authentication:** Admin panel uses a completely separate password from the user login. This preserves the existing user authorization flow.

2. **Password Changes:** Currently password changes are in-memory only. For permanent changes, update the `PASSWORD` and `ADMIN_PASSWORD` constants in `server.js`.

3. **Logging:** All authentication attempts, uploads, file access, and admin actions are logged with IP addresses and timestamps.

4. **Rate Limiting:** The existing user login rate limiting (5 attempts, 15-minute lockout) is preserved and logged.

## Log Files

Logs are stored in the `logs/` directory:
- `logs/app.log` - Current log file
- `logs/app.log.1` through `logs/app.log.5` - Rotated log files
- Automatic rotation when log file exceeds 10MB
- Maximum of 5 historical log files kept

## Mobile Compatibility

Both the main application and admin panel are fully mobile-responsive:
- **Main App:** Touch-optimized photo rain effect with swipe-down gesture to speed up
- **Admin Panel:** Responsive layout for viewing logs and stats on mobile devices

## What Was NOT Changed

✅ **User authentication flow:** Completely untouched - existing password, session management, and rate limiting all work exactly as before

✅ **Existing files:** No modifications to `index.html`, `script.js`, or `styles.css` for the main user-facing app

✅ **Upload functionality:** Works identically, now with added logging

## Next Steps

1. **Start the server:** `npm start`
2. **Access admin panel:** Navigate to `http://localhost:3002/admin.html`
3. **Login with default password:** `admin_memory_rain_2024`
4. **Change admin password immediately** via Settings tab
5. **Update server.js** with new passwords for persistence across restarts
