import request from 'supertest';
import { app } from '../src/app.js';
import { EphemeralLink } from '../src/models/EphemeralLink.js';

async function registerAndLogin(email: string, password: string) {
  await request(app).post('/api/auth/register').send({ email, password });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body.token as string;
}

describe('Ephemeral Zero-Knowledge Share Links & Burn-on-Read', () => {
  it('creates an ephemeral link, allows public anonymous download, and burns on read', async () => {
    const token = await registerAndLogin('alice-ephemeral@example.com', 'mypassword123');

    // 1. Upload a file
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('TOP SECRET EPHEMERAL CONTENT'), 'classified.txt');
    expect(uploadRes.status).toBe(201);
    const fileId = uploadRes.body.id;

    // 2. Generate a burn-on-read ephemeral link (maxDownloads: 1)
    const linkRes = await request(app)
      .post(`/api/files/${fileId}/ephemeral-link`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expiresInHours: 24, maxDownloads: 1 });

    expect(linkRes.status).toBe(201);
    expect(linkRes.body.token).toBeDefined();
    expect(linkRes.body.maxDownloads).toBe(1);
    const linkToken = linkRes.body.token;

    // 3. Anonymous public user retrieves metadata without authentication
    const publicMetaRes = await request(app).get(`/api/public/share/${linkToken}`);
    expect(publicMetaRes.status).toBe(200);
    expect(publicMetaRes.body.filename).toBe('classified.txt');
    expect(publicMetaRes.body.aesIv).toBeDefined();
    expect(publicMetaRes.body.remainingDownloads).toBe(1);
    expect(publicMetaRes.body.isBurnOnRead).toBe(true);

    // 4. Anonymous public user downloads the encrypted file payload
    const downloadRes = await request(app).get(`/api/public/share/${linkToken}/download`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['x-aes-iv']).toBeDefined();
    expect(downloadRes.headers['x-aes-tag']).toBeDefined();

    // 5. Burn-on-Read: Next download attempt must return 410 Gone
    const secondDownloadRes = await request(app).get(`/api/public/share/${linkToken}/download`);
    expect(secondDownloadRes.status).toBe(410);

    const secondMetaRes = await request(app).get(`/api/public/share/${linkToken}`);
    expect(secondMetaRes.status).toBe(410);

    // 6. Test manual link revocation
    const multiLinkRes = await request(app)
      .post(`/api/files/${fileId}/ephemeral-link`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expiresInHours: 12, maxDownloads: 10 });
    expect(multiLinkRes.status).toBe(201);
    const link2Id = multiLinkRes.body.id;
    const link2Token = multiLinkRes.body.token;

    // Verify it's active initially
    const link2MetaBefore = await request(app).get(`/api/public/share/${link2Token}`);
    expect(link2MetaBefore.status).toBe(200);

    // Revoke link
    const revokeRes = await request(app)
      .delete(`/api/files/${fileId}/ephemeral-links/${link2Id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(revokeRes.status).toBe(200);

    // Access after revocation returns 410 Gone
    const link2MetaAfter = await request(app).get(`/api/public/share/${link2Token}`);
    expect(link2MetaAfter.status).toBe(410);
  });
});
