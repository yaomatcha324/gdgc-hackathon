const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');

let profileId;
let qrToken;

const uniqueSuffix = Date.now();
const signupPayload = {
  username: `tester_${uniqueSuffix}`,
  password: 'pass1234',
  name: '测试用户',
  photoUrl: 'https://images.example.com/avatar.png'
};

test('signup creates profile', async () => {
  const res = await request(app).post('/api/signup').send(signupPayload);
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.id);
  profileId = res.body.id;
});

test('generate qr returns token', async () => {
  const res = await request(app).post(`/api/profile/${profileId}/qr`).send();
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token);
  qrToken = res.body.token;
});

test('login returns profile', async () => {
  const res = await request(app).post('/api/login').send({
    username: signupPayload.username,
    password: signupPayload.password
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.id, profileId);
});

test('load qr returns profile', async () => {
  const res = await request(app).get(`/api/qr/${qrToken}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.profile.id, profileId);
});

test('submit tags updates profile', async () => {
  const res = await request(app)
    .post(`/api/qr/${qrToken}/tags`)
    .send({ tags: ['Teacher', 'Doctor'] });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.profile.tags.includes('Teacher'));
});
