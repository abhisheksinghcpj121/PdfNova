const request = require('supertest');
const app = require('../src/app');
const authService = require('../src/services/authService');

describe('PDFNova User Authentication Suite', () => {
  const testUser = {
    name: 'Sarah Connor',
    email: `sarah_${Date.now()}@test.com`,
    password: 'CyberdynePassword99!'
  };

  let authToken = null;

  test('1. POST /api/auth/signup creates a new user account', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.name).toBe(testUser.name);
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.token).toBeDefined();
    expect(res.body.token.startsWith('pnv_')).toBe(true);

    authToken = res.body.token;
  });

  test('2. POST /api/auth/signup rejects duplicate email registration', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(testUser);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('REGISTRATION_FAILED');
  });

  test('3. POST /api/auth/login succeeds with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.token).toBeDefined();

    authToken = res.body.token;
  });

  test('4. POST /api/auth/login rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword123'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
  });

  test('5. GET /api/auth/me returns current user profile with valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.user.name).toBe(testUser.name);
  });

  test('6. GET /api/auth/me rejects unauthorized request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('7. POST /api/auth/logout invalidates session token', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Subsequent access with the same token must now be rejected
    const checkRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(checkRes.status).toBe(401);
  });
});
