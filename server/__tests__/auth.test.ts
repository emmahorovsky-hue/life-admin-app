// Authentication Endpoint Tests
// Priority: P0 - CRITICAL

import request from 'supertest';
import app from '../src/index';
import { prisma } from './setup';

describe('POST /api/auth/register', () => {
  it('should register a new user with valid data', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'Test User',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('newuser@example.com');
    expect(res.body.user.name).toBe('Test User');
    expect(res.body.user.password).toBeUndefined(); // Password should not be in response

    // Verify user was created in database
    const user = await prisma.user.findUnique({
      where: { email: 'newuser@example.com' },
    });
    expect(user).toBeTruthy();
    expect(user?.password).not.toBe('password123'); // Should be hashed
  });

  it('should fail with duplicate email', async () => {
    // First registration
    await request(app).post('/api/auth/register').send({
      email: 'duplicate@example.com',
      password: 'password123',
      name: 'User One',
    });

    // Duplicate registration
    const res = await request(app).post('/api/auth/register').send({
      email: 'duplicate@example.com',
      password: 'password456',
      name: 'User Two',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should fail with invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'notanemail',
        password: 'password123',
        name: 'Test User',
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('should fail with short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: '123',
        name: 'Test User',
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('should fail with missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        // Missing password and name
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    // Create a test user before each login test
    await request(app).post('/api/auth/register').send({
      email: 'testuser@example.com',
      password: 'password123',
      name: 'Test User',
    });
  });

  it('should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('testuser@example.com');
    
    // Check that JWT cookie is set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('token=');
  });

  it('should fail with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@example.com',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should fail with non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should fail with missing credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@example.com',
        // Missing password
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('GET /api/auth/me', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    // Register and login to get auth token
    await request(app).post('/api/auth/register').send({
      email: 'authuser@example.com',
      password: 'password123',
      name: 'Auth User',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'authuser@example.com',
      password: 'password123',
    });

    const cookies = loginRes.headers['set-cookie'];
    authToken = cookies[0].split(';')[0].split('=')[1]; // Extract token from cookie
    userId = loginRes.body.user.id;
  });

  it('should return current user when authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`token=${authToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user.email).toBe('authuser@example.com');
    expect(res.body.user.password).toBeUndefined();
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', ['token=invalidtoken']);

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});

describe('POST /api/auth/logout', () => {
  let authToken: string;

  beforeEach(async () => {
    // Register and login
    await request(app).post('/api/auth/register').send({
      email: 'logoutuser@example.com',
      password: 'password123',
      name: 'Logout User',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'logoutuser@example.com',
      password: 'password123',
    });

    const cookies = loginRes.headers['set-cookie'];
    authToken = cookies[0].split(';')[0].split('=')[1];
  });

  it('should clear auth cookie on logout', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`token=${authToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    // Check that cookie is cleared
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('token=;'); // Empty token
  });

  it('should succeed even without auth token', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
  });
});

// TODO: Add rate limiting test (requires waiting 15 minutes or mocking time)
// describe('Rate Limiting', () => {
//   it('should block after 5 failed login attempts', async () => {
//     // Test implementation
//   });
// });
