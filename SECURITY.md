# Security Policy

## 🔒 Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability, please follow responsible disclosure:

1. **DO NOT** open a public issue
2. Email the details to the repository owner
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work on a fix promptly.

## 🛡️ Security Best Practices

### For Deployment

1. **Change Default Passwords**
   - Never use the default `00000000` password
   - Use strong passwords (12+ characters, mixed case, numbers, symbols)
   - Store passwords securely (environment variables, secrets manager)

2. **Use HTTPS**
   - Always use SSL/TLS in production
   - Configure reverse proxy (Nginx, Apache, Caddy)
   - Redirect HTTP to HTTPS

3. **Firewall Configuration**
   - Limit access to necessary ports only
   - Use IP whitelisting when possible
   - Enable fail2ban or similar

4. **Regular Updates**
   - Keep Node.js and dependencies updated
   - Monitor for security advisories
   - Run `npm audit` regularly

5. **Session Security**
   - Change the session secret in production
   - Use secure session cookies (HTTPS only)
   - Set appropriate session timeouts

6. **File Upload Security**
   - Validate file types thoroughly
   - Scan uploads for malware
   - Limit file sizes appropriately
   - Store uploads outside web root if possible

7. **Access Control**
   - Use IP whitelisting for admin panel
   - Implement rate limiting (already included)
   - Monitor logs for suspicious activity
   - Enable account lockout after failed attempts

8. **Backup Strategy**
   - Regular backups of uploads directory
   - Secure backup storage
   - Test restore procedures
   - Encrypt sensitive backups

### Environment Variables

Never commit sensitive data to git:
- Passwords
- API keys
- Session secrets
- Database credentials

Use `.env` files (already in `.gitignore`)

### Code Security

- Input validation on all user inputs
- Parameterized queries (prevent SQL injection)
- Escape HTML output (prevent XSS)
- CSRF protection for state-changing operations
- Proper error handling (don't leak sensitive info)

## ⚠️ Known Security Limitations

1. **Password Storage**
   - Currently stored in plain text in `server.js`
   - **TODO:** Move to environment variables or secure config

2. **In-Memory Password Changes**
   - Admin panel password changes don't persist
   - **TODO:** Implement persistent password storage with hashing

3. **No Password Hashing**
   - Passwords compared in plain text
   - **TODO:** Implement bcrypt or similar

4. **Session Management**
   - Sessions stored in memory only
   - **TODO:** Use Redis or database-backed sessions for production

5. **File Upload Validation**
   - Basic MIME type checking only
   - **TODO:** Add magic number validation, malware scanning

## 🔧 Recommended Hardening

### 1. Add Rate Limiting Middleware

```bash
npm install express-rate-limit
```

### 2. Add Helmet for Security Headers

```bash
npm install helmet
```

### 3. Use Environment Variables

Copy `.env.example` to `.env` and configure properly.

### 4. Hash Passwords

```bash
npm install bcrypt
```

Implement password hashing for all authentication.

### 5. Enable HTTPS

Use Let's Encrypt with Certbot or your hosting provider's SSL.

### 6. Database-Backed Sessions

```bash
npm install connect-redis redis
```

For production deployments with multiple servers.

## 📊 Security Checklist

Before deploying to production:

- [ ] Changed all default passwords
- [ ] Configured HTTPS/SSL
- [ ] Set secure session secret
- [ ] Configured firewall rules
- [ ] Enabled IP whitelisting (if needed)
- [ ] Set up regular backups
- [ ] Configured monitoring/alerting
- [ ] Reviewed and hardened file permissions
- [ ] Tested authentication flows
- [ ] Checked for latest security updates
- [ ] Configured proper logging
- [ ] Set up intrusion detection
- [ ] Documented access procedures
- [ ] Prepared incident response plan

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

## 🔄 Security Update Policy

Security patches will be released as soon as possible after verification. Subscribe to repository releases to stay informed.
