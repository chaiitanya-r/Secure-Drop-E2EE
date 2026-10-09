import request from 'supertest';
import crypto from 'crypto';
import { app } from '../src/app.js';
import { FileModel } from '../src/models/File.js';
import {
  aesEncrypt,
  generateAesKey,
  rsaEncryptAesKey,
  rsaDecryptAesKey,
  aesDecrypt
} from '../src/security/crypto.js';

async function registerAndLogin(email: string, password: string) {
  const regRes = await request(app).post('/api/auth/register').send({ email, password });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return {
    token: loginRes.body.token as string,
    user: loginRes.body.user,
    rsaPublicKey: regRes.body.user.rsaPublicKey as string
  };
}

describe('Zero-Knowledge Client-Side Encryption & Sharing', () => {
  it('supports client-side pre-encrypted uploads and zero-knowledge ACL sharing', async () => {
    const alice = await registerAndLogin('alice-zk@example.com', 'alicepassword123');
    const bob = await registerAndLogin('bob-zk@example.com', 'bobpassword123');

    // 1. Simulate client-side encryption (Alice in browser)
    const originalPlaintext = Buffer.from('TOP SECRET ZERO-KNOWLEDGE DOCUMENT');
    const clientAesKey = generateAesKey();
    const encryptedFile = aesEncrypt(originalPlaintext, clientAesKey);
    const encryptedCiphertextBuffer = Buffer.from(encryptedFile.ciphertext, 'base64');
    const aliceEncryptedAesKey = rsaEncryptAesKey(clientAesKey, alice.rsaPublicKey);

    // 2. Alice uploads pre-encrypted ciphertext to backend
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${alice.token}`)
      .field('isClientEncrypted', 'true')
      .field('originalFilename', 'confidential.pdf')
      .field('originalMimeType', 'application/pdf')
      .field('originalSize', originalPlaintext.length.toString())
      .field('aesIv', encryptedFile.iv)
      .field('aesAuthTag', encryptedFile.authTag)
      .field('encryptedAesKey', aliceEncryptedAesKey)
      .attach('file', encryptedCiphertextBuffer, 'confidential.pdf.enc');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.isClientEncrypted).toBe(true);
    const fileId = uploadRes.body.id;

    // Verify backend stored it with empty serverWrappedKey (Zero-Knowledge)
    const fileDoc = await FileModel.findById(fileId);
    expect(fileDoc?.isClientEncrypted).toBe(true);
    expect(fileDoc?.serverWrappedKey).toBe('');

    // 3. Alice retrieves Bob's public key from public-key endpoint
    const pubKeyRes = await request(app)
      .get('/api/auth/public-key?email=bob-zk@example.com')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(pubKeyRes.status).toBe(200);
    expect(pubKeyRes.body.rsaPublicKey).toBe(bob.rsaPublicKey);

    // 4. Alice re-encrypts the AES key for Bob in browser (Zero-Knowledge)
    const bobEncryptedAesKey = rsaEncryptAesKey(clientAesKey, pubKeyRes.body.rsaPublicKey);

    // 5. Alice shares with Bob providing the client-encrypted key
    const shareRes = await request(app)
      .post(`/api/files/${fileId}/share`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        targetUserEmail: 'bob-zk@example.com',
        encryptedAesKey: bobEncryptedAesKey
      });
    expect(shareRes.status).toBe(200);
    expect(shareRes.body.isZeroKnowledge).toBe(true);

    // 6. Bob fetches metadata and downloads file
    const bobMetaRes = await request(app)
      .get(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobMetaRes.status).toBe(200);
    expect(bobMetaRes.body.encryptedAesKey).toBe(bobEncryptedAesKey);
    expect(bobMetaRes.body.isClientEncrypted).toBe(true);

    const bobDownloadRes = await request(app)
      .get(`/api/files/${fileId}/download`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobDownloadRes.status).toBe(200);

    // 7. Verify ciphertext matches what was uploaded (server never tampered or decrypted)
    expect(bobDownloadRes.body).toEqual(encryptedCiphertextBuffer);
  });
});
