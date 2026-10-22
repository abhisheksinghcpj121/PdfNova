const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

class AuthService {
  constructor() {
    this.dataDir = path.resolve(config.rootDir, 'data');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.sessionsFile = path.join(this.dataDir, 'sessions.json');
    this.initStorage();
  }

  /**
   * Initialize local JSON storage for user profiles and active sessions
   */
  initStorage() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.usersFile)) {
        // Seed default demo user
        const demoSalt = crypto.randomBytes(16).toString('hex');
        const demoHash = this.hashPassword('Password123!', demoSalt);
        const initialUsers = [
          {
            id: 'usr_demo_pdfnova_001',
            name: 'Demo User',
            email: 'demo@pdfnova.com',
            passwordHash: demoHash,
            salt: demoSalt,
            plan: 'Pro',
            createdAt: new Date().toISOString(),
            lastLoginAt: null
          }
        ];
        fs.writeFileSync(this.usersFile, JSON.stringify(initialUsers, null, 2));
      }

      if (!fs.existsSync(this.sessionsFile)) {
        fs.writeFileSync(this.sessionsFile, JSON.stringify({}, null, 2));
      }

      logger.info('Auth service initialized', { usersFile: this.usersFile });
    } catch (err) {
      logger.error('Failed to initialize auth storage', err);
    }
  }

  /**
   * Secure PBKDF2 Password Hashing (SHA-512, 100k iterations)
   */
  hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  /**
   * Read all users
   */
  getUsers() {
    try {
      if (!fs.existsSync(this.usersFile)) return [];
      const data = fs.readFileSync(this.usersFile, 'utf8');
      return JSON.parse(data || '[]');
    } catch (err) {
      logger.error('Error reading users file', err);
      return [];
    }
  }

  /**
   * Save all users
   */
  saveUsers(users) {
    fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
  }

  /**
   * Read active sessions
   */
  getSessions() {
    try {
      if (!fs.existsSync(this.sessionsFile)) return {};
      const data = fs.readFileSync(this.sessionsFile, 'utf8');
      return JSON.parse(data || '{}');
    } catch {
      return {};
    }
  }

  /**
   * Save active sessions
   */
  saveSessions(sessions) {
    fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2));
  }

  /**
   * Clean expired sessions
   */
  cleanupExpiredSessions() {
    const sessions = this.getSessions();
    const now = Date.now();
    let changed = false;

    for (const [token, session] of Object.entries(sessions)) {
      if (new Date(session.expiresAt).getTime() <= now) {
        delete sessions[token];
        changed = true;
      }
    }

    if (changed) {
      this.saveSessions(sessions);
    }
  }

  /**
   * REGISTER / SIGN UP a new user
   */
  async register({ name, email, password }) {
    if (!name || name.trim().length < 2) {
      throw new Error('Please enter a valid full name (minimum 2 characters).');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please provide a valid email address.');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = this.getUsers();

    const existing = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('An account with this email address already exists. Please sign in instead.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const newUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      salt,
      plan: 'Free',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);

    // Create session token
    const token = this.createSession(newUser);

    logger.info('User registered successfully', { userId, email: cleanEmail });

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        plan: newUser.plan,
        createdAt: newUser.createdAt
      },
      token
    };
  }

  /**
   * LOGIN / SIGN IN an existing user
   */
  async login({ email, password }) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = this.getUsers();

    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    const hash = this.hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();
    this.saveUsers(users);

    const token = this.createSession(user);

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      },
      token
    };
  }

  /**
   * Create active session
   */
  createSession(user) {
    this.cleanupExpiredSessions();
    const sessions = this.getSessions();
    const token = `pnv_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    sessions[token] = {
      userId: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan || 'Free',
      createdAt: new Date().toISOString(),
      expiresAt
    };

    this.saveSessions(sessions);
    return token;
  }

  /**
   * Verify token and return user profile
   */
  verifySession(token) {
    if (!token) return null;
    this.cleanupExpiredSessions();
    const sessions = this.getSessions();
    const session = sessions[token];

    if (!session) return null;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      delete sessions[token];
      this.saveSessions(sessions);
      return null;
    }

    const users = this.getUsers();
    const user = users.find(u => u.id === session.userId);
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan || 'Free',
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };
  }

  /**
   * Invalidate session (LOGOUT)
   */
  logout(token) {
    if (!token) return;
    const sessions = this.getSessions();
    if (sessions[token]) {
      delete sessions[token];
      this.saveSessions(sessions);
    }
  }

  /**
   * Associate processed document job with user
   */
  recordUserJob(userId, jobSummary) {
    try {
      const historyFile = path.join(this.dataDir, `history_${userId}.json`);
      let list = [];
      if (fs.existsSync(historyFile)) {
        list = JSON.parse(fs.readFileSync(historyFile, 'utf8') || '[]');
      }
      list.unshift({
        ...jobSummary,
        timestamp: new Date().toISOString()
      });
      // Keep last 30 jobs
      list = list.slice(0, 30);
      fs.writeFileSync(historyFile, JSON.stringify(list, null, 2));
    } catch (err) {
      logger.warn('Failed to record user job history', { userId, error: err.message });
    }
  }

  /**
   * Get user document processing history
   */
  getUserHistory(userId) {
    try {
      const historyFile = path.join(this.dataDir, `history_${userId}.json`);
      if (!fs.existsSync(historyFile)) return [];
      return JSON.parse(fs.readFileSync(historyFile, 'utf8') || '[]');
    } catch {
      return [];
    }
  }
}

module.exports = new AuthService();
