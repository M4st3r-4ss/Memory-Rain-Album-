# Memory Rain 🌧️

A beautiful photo and video sharing application with an animated rain effect. Watch your memories cascade down the screen like falling polaroids!

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

## ✨ Features

- 📸 **Upload photos and videos** - Support for JPEG, PNG, GIF, MP4, MOV, AVI, WebM
- 🌧️ **Animated rain effect** - Your memories fall like polaroid photos
- 🔐 **Password protection** - Secure access with user authentication
- 👨‍💼 **Admin panel** - Comprehensive dashboard for monitoring and management
- 📊 **Activity logging** - Track uploads, logins, and system events
- 🚫 **IP filtering** - Whitelist/blacklist support for access control
- 📱 **PWA support** - Install as a mobile app with offline capabilities
- 💾 **Download media** - Save any photo or video with one click
- 📱 **Responsive design** - Works seamlessly on mobile and desktop

## 🚀 Quick Start

### Prerequisites

- Node.js >= 14.0.0
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/M4st3r-4ss/girlfriend-opensource.git
cd girlfriend-opensource
```

2. Install dependencies:
```bash
npm install
```

3. **⚠️ IMPORTANT: Change default passwords** (see Security section below)

4. Start the server:
```bash
npm start
```

5. Open your browser:
```
http://localhost:8080
```

## 🔐 Security Setup

**CRITICAL:** Before deploying, you MUST change the default passwords!

The default passwords are set to `00000000` for both user and admin access.

### Method 1: Edit server.js directly

Open `server.js` and change these lines:

```javascript
// Line 22 - User password
const PASSWORD = 'your-secure-password-here';

// Line 25 - Admin password
let ADMIN_PASSWORD = 'your-secure-admin-password-here';
```

### Method 2: Use environment variables (recommended)

Create a `.env` file in the project root:

```env
USER_PASSWORD=your-secure-password
ADMIN_PASSWORD=your-secure-admin-password
PORT=8080
```

Then modify `server.js` to read from environment variables.

## 📖 Usage

### User Access

1. Navigate to `http://localhost:8080`
2. Enter the user password (default: `00000000`)
3. Upload photos/videos using the "Upload Memory" button
4. Click on any falling memory to view it full-size
5. Download or share your memories

### Admin Panel

1. Navigate to `http://localhost:8080/admin.html`
2. Enter the admin password (default: `00000000`)
3. Access features:
   - 📊 **Dashboard** - View system stats and uptime
   - 📝 **Activity Logs** - Monitor all system events
   - 👥 **Session Management** - Clear user sessions
   - 🔒 **IP Control** - Manage whitelist/blacklist
   - 🔑 **Password Management** - Change user/admin passwords

## 🛠️ Configuration

### Port

Change the port in `server.js`:

```javascript
const PORT = 8080; // Change to your preferred port
```

### File Upload Limits

Modify upload settings in `server.js`:

```javascript
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  // ...
});
```

### Allowed File Types

Edit the file filter in `server.js`:

```javascript
const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm/;
```

## 📁 Project Structure

```
girlfriend-opensource/
├── server.js              # Main Express server
├── logger.js              # Logging system
├── package.json           # Dependencies
├── public/               # Frontend files
│   ├── index.html        # Main user interface
│   ├── admin.html        # Admin panel
│   ├── styles.css        # User interface styles
│   ├── admin.css         # Admin panel styles
│   ├── script.js         # Rain animation & UI logic
│   ├── admin.js          # Admin panel logic
│   ├── manifest.json     # PWA manifest
│   └── service-worker.js # PWA service worker
├── uploads/              # Uploaded files (auto-created)
└── logs/                 # Server logs (auto-created)
```

## 🎨 Features in Detail

### Rain Animation

The signature feature - uploaded photos and videos fall down the screen like polaroids:
- Adaptive density based on screen size
- Smooth CSS animations
- Click to expand and view
- Continuous loop of your memories

### PWA Support

Install Memory Rain as a standalone app:
- Add to home screen on mobile devices
- Offline support with service worker
- Native app-like experience

### Logging System

Comprehensive logging with categories:
- 📥 **ACCESS** - All HTTP requests
- 🔐 **AUTH** - Login attempts and sessions
- 📤 **UPLOAD** - File uploads
- ⚙️ **SERVER** - System events
- ⚠️ **ERROR** - Errors and warnings

### IP Access Control

Flexible IP filtering:
- **Whitelist mode** - Only allow specific IPs
- **Blacklist mode** - Block specific IPs
- Admin panel interface for easy management
- Prevents admin from blocking themselves

## 🚀 Deployment

### Production Checklist

- [ ] Change default passwords
- [ ] Set up HTTPS (use reverse proxy like Nginx)
- [ ] Configure firewall rules
- [ ] Set up regular backups of `uploads/` directory
- [ ] Review and configure IP access controls
- [ ] Set secure session secret in `server.js`
- [ ] Enable appropriate logging levels
- [ ] Test admin panel access

### Reverse Proxy Example (Nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Using PM2 for Process Management

```bash
npm install -g pm2
pm2 start server.js --name memory-rain
pm2 save
pm2 startup
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Known Issues

- Password changes via admin panel are in-memory only (see `ADMIN_SETUP.md`)
- Large video files may take time to process on mobile devices
- Ensure adequate disk space for uploads

## 💡 Tips

- Regularly backup your `uploads/` directory
- Monitor `logs/` for suspicious activity
- Use strong, unique passwords
- Enable whitelist mode for private deployments
- Check admin panel regularly for system health

## 📧 Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the documentation files in the repository

## 🙏 Acknowledgments

Built with love for preserving and sharing memories in a beautiful way.

---

Made with ❤️ by [M4st3r-4ss](https://github.com/M4st3r-4ss)
