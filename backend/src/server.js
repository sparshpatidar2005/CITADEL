// backend/src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

app.use(cors());
app.use(express.json());

// Utility: strip password
function stripUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

// ---------------- AUTH ----------------
app.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, password: hash } });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: stripUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Signup error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: stripUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Login error' });
  }
});

// ---------------- AUTH MIDDLEWARE ----------------
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Missing token' });
  try {
    const token = header.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    console.error('auth error', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// ---------------- PROFILES ----------------
// get current user quickly
app.get('/profiles/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    return res.json(stripUser(user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// get by id (only allowed for same user)
app.get('/profiles/:id', authMiddleware, async (req, res) => {
  try {
    if (req.params.id !== req.userId) return res.status(403).json({ message: 'Forbidden' });
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    res.json(stripUser(user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Update profile (whitelist fields)
app.put('/profiles/:id', authMiddleware, async (req, res) => {
  try {
    if (req.params.id !== req.userId) return res.status(403).json({ message: 'Forbidden' });

    // Whitelist allowed updatable fields:
    const allowed = [
      'name',
      'phone',
      'aadhar',
      'address',
      'destination',
      'emergencyContacts',
      'familyId',
      'isFamilyOwner',
      'kycCompleted',
      'peopleCount',
      'bloodGroup',
      'allergies',
      'notes',
      'lastLocation',
    ];

    const data = {};
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        data[k] = req.body[k];
      }
    }

    // Normalize emergencyContacts to JSON array if provided as string
    if (data.emergencyContacts && typeof data.emergencyContacts === 'string') {
      try {
        data.emergencyContacts = JSON.parse(data.emergencyContacts);
      } catch {
        data.emergencyContacts = data.emergencyContacts
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    // lastLocation should be JSON (object) or null. If string attempt parse.
    if (data.lastLocation && typeof data.lastLocation === 'string') {
      try {
        data.lastLocation = JSON.parse(data.lastLocation);
      } catch {
        // leave as-is (Prisma will error if not valid json)
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });

    res.json(stripUser(updated));
  } catch (e) {
    console.error('profile update error', e);
    res.status(500).json({ message: 'Failed to update profile', detail: e.message });
  }
});

// PUT /profiles/me alias
app.put('/profiles/me', authMiddleware, async (req, res) => {
  try {
    req.params.id = req.userId;
    return app._router.handle(req, res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to update profile (me)' });
  }
});

// ---------------- FAMILY ----------------
app.post('/family/create', authMiddleware, async (req, res) => {
  try {
    const code = `FAM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const family = await prisma.family.create({
      data: {
        code,
        ownerId: req.userId,
      },
    });

    await prisma.user.update({
      where: { id: req.userId },
      data: { familyId: code, isFamilyOwner: true },
    });

    res.json({ success: true, code, family });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create family' });
  }
});

app.post('/family/join/:code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const family = await prisma.family.findUnique({ where: { code } });
    if (!family) return res.status(404).json({ message: 'Family not found' });

    await prisma.user.update({
      where: { id: req.userId },
      data: { familyId: code, isFamilyOwner: false },
    });

    res.json({ success: true, code });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to join family' });
  }
});

app.get('/family/:code/members', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const members = await prisma.user.findMany({
      where: { familyId: code },
      select: {
        id: true,
        name: true,
        phone: true,
        aadhar: true,
        address: true,
        destination: true,
        emergencyContacts: true,
        familyId: true,
        isFamilyOwner: true,
        kycCompleted: true,
        peopleCount: true,
        lastLocation: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(members);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to fetch family members' });
  }
});

// ---------------- LUGGAGE ----------------
app.post('/luggage', authMiddleware, async (req, res) => {
  try {
    const { id, label, qrPayload } = req.body;
    const luggage = await prisma.luggage.create({
      data: { id, label, qrPayload, ownerId: req.userId },
    });
    res.json(luggage);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create luggage' });
  }
});

app.get('/luggage/:id', authMiddleware, async (req, res) => {
  try {
    const luggage = await prisma.luggage.findUnique({ where: { id: req.params.id } });
    res.json(luggage);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to fetch luggage' });
  }
});

// ---------------- SOS ----------------
app.post('/sos', authMiddleware, async (req, res) => {
  try {
    const sos = await prisma.sOSAlert.create({
      data: {
        userId: req.userId,
        reason: req.body.reason || null,
        location: req.body.location || null,
      },
    });
    res.json(sos);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create SOS' });
  }
});

// ---------------- SERVER START ----------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on all network interfaces at port ${PORT}`);
  });
