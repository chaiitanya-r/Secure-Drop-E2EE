import request from 'supertest';
import { app } from '../src/app.js';
import { AuditLog } from '../src/models/AuditLog.js';

async function registerAndLogin(email: string, password: string) {
  await request(app).post('/api/auth/register').send({ email, password });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body.token as string;
}

describe('Tamper-Evident Hash-Chained Audit Log', () => {
  it('appends cryptographically chained logs and verifies mathematical integrity', async () => {
    const token = await registerAndLogin('auditor@example.com', 'mypassword123');

    // 1. Perform operations to populate the audit chain
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('Audit test file content'), 'audit_doc.pdf');
    expect(uploadRes.status).toBe(201);
    const fileId = uploadRes.body.id;

    const downloadRes = await request(app)
      .get(`/api/files/${fileId}/download`)
      .set('Authorization', `Bearer ${token}`);
    expect(downloadRes.status).toBe(200);

    const linkRes = await request(app)
      .post(`/api/files/${fileId}/ephemeral-link`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expiresInHours: 24, maxDownloads: 5 });
    expect(linkRes.status).toBe(201);

    // 2. Fetch audit logs via API
    const logsRes = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(logsRes.status).toBe(200);
    expect(logsRes.body.length).toBeGreaterThanOrEqual(3);

    // Verify properties on entries
    const firstEntry = logsRes.body[logsRes.body.length - 1]; // Sequence 1
    expect(firstEntry.sequence).toBe(1);
    expect(firstEntry.previousHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    expect(firstEntry.currentHash).toHaveLength(64);

    // 3. Cryptographic chain verification should pass initially
    const verifyRes1 = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(verifyRes1.status).toBe(200);
    expect(verifyRes1.body.isValid).toBe(true);
    expect(verifyRes1.body.totalEntries).toBeGreaterThanOrEqual(3);

    // 4. Simulate malicious tampering: directly mutate block #2 in the database
    const block2 = await AuditLog.findOne({ sequence: 2 });
    expect(block2).toBeDefined();
    await AuditLog.updateOne(
      { _id: block2!._id },
      { $set: { actorEmail: 'malicious_hacker@tampered.com' } }
    );

    // 5. Verification must detect the cryptographic discrepancy and fail
    const verifyRes2 = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(verifyRes2.status).toBe(200);
    expect(verifyRes2.body.isValid).toBe(false);
    expect(verifyRes2.body.brokenSequence).toBe(2);
    expect(verifyRes2.body.reason).toContain('tampering');
  });
});
