import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5;

class Logger {
  constructor() {
    this.logFile = path.join(logsDir, 'app.log');
    this.ensureLogFile();
  }

  ensureLogFile() {
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, '');
    }
  }

  rotateIfNeeded() {
    try {
      const stats = fs.statSync(this.logFile);
      if (stats.size > MAX_LOG_SIZE) {
        for (let i = MAX_LOG_FILES - 1; i > 0; i--) {
          const oldPath = path.join(logsDir, `app.log.${i}`);
          const newPath = path.join(logsDir, `app.log.${i + 1}`);
          if (fs.existsSync(oldPath)) {
            if (i === MAX_LOG_FILES - 1) {
              fs.unlinkSync(oldPath);
            } else {
              fs.renameSync(oldPath, newPath);
            }
          }
        }
        fs.renameSync(this.logFile, path.join(logsDir, 'app.log.1'));
        fs.writeFileSync(this.logFile, '');
      }
    } catch (error) {
      console.error('Log rotation error:', error);
    }
  }

  formatMessage(level, category, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const meta = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : '';
    return `[${timestamp}] [${level}] [${category}] ${message} ${meta}\n`;
  }

  write(level, category, message, metadata = {}) {
    this.rotateIfNeeded();
    const logMessage = this.formatMessage(level, category, message, metadata);
    fs.appendFileSync(this.logFile, logMessage);

    // Also log to console for development
    if (level === 'ERROR') {
      console.error(logMessage.trim());
    } else {
      console.log(logMessage.trim());
    }
  }

  info(category, message, metadata = {}) {
    this.write('INFO', category, message, metadata);
  }

  warn(category, message, metadata = {}) {
    this.write('WARN', category, message, metadata);
  }

  error(category, message, metadata = {}) {
    this.write('ERROR', category, message, metadata);
  }

  auth(action, success, metadata = {}) {
    const level = success ? 'INFO' : 'WARN';
    this.write(level, 'AUTH', `${action}: ${success ? 'SUCCESS' : 'FAILED'}`, metadata);
  }

  upload(filename, metadata = {}) {
    this.write('INFO', 'UPLOAD', `File uploaded: ${filename}`, metadata);
  }

  access(resource, metadata = {}) {
    this.write('INFO', 'ACCESS', `Resource accessed: ${resource}`, metadata);
  }

  getLogs(limit = 1000, filter = {}) {
    try {
      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      let logs = lines.map(line => {
        const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)$/);
        if (match) {
          const [, timestamp, level, category, rest] = match;
          const metaMatch = rest.match(/^(.+?)(\{.+\})?$/);
          let message = rest;
          let metadata = {};

          if (metaMatch && metaMatch[2]) {
            message = metaMatch[1].trim();
            try {
              metadata = JSON.parse(metaMatch[2]);
            } catch (e) {
              // Failed to parse metadata
            }
          }

          return { timestamp, level, category, message, metadata };
        }
        return null;
      }).filter(log => log !== null);

      // Apply filters
      if (filter.level) {
        logs = logs.filter(log => log.level === filter.level);
      }
      if (filter.category) {
        logs = logs.filter(log => log.category === filter.category);
      }
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        logs = logs.filter(log =>
          log.message.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
        );
      }

      // Return most recent first
      return logs.reverse().slice(0, limit);
    } catch (error) {
      console.error('Error reading logs:', error);
      return [];
    }
  }

  getStats() {
    try {
      const logs = this.getLogs(10000); // Last 10k logs for stats

      const now = Date.now();
      const last24h = logs.filter(log =>
        (now - new Date(log.timestamp).getTime()) < 24 * 60 * 60 * 1000
      );

      return {
        totalLogs: logs.length,
        last24h: {
          total: last24h.length,
          byLevel: {
            INFO: last24h.filter(l => l.level === 'INFO').length,
            WARN: last24h.filter(l => l.level === 'WARN').length,
            ERROR: last24h.filter(l => l.level === 'ERROR').length
          },
          byCategory: {
            AUTH: last24h.filter(l => l.category === 'AUTH').length,
            UPLOAD: last24h.filter(l => l.category === 'UPLOAD').length,
            ACCESS: last24h.filter(l => l.category === 'ACCESS').length,
            ADMIN: last24h.filter(l => l.category === 'ADMIN').length
          }
        }
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }
}

export default new Logger();
