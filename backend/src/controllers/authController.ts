import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';

import { User } from '../models/User.js';
import { encryptPrivateKeyWithPassword, generateRsaKeyPair } from '../security/crypto.js';
import { signJwt } from '../security/jwt.js';

const BCRYPT_ROUNDS = 12;

export async function register(req: Request, res: Response) {
  const email = (req.body.email as string).toLowerCase();
  const { password, role } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { publicKeyPem, privateKeyPem } = generateRsaKeyPair();
  const { ciphertextB64, saltB64, ivB64 } = encryptPrivateKeyWithPassword(privateKeyPem, password);

  const user = await User.create({
    email,
    passwordHash,
    role,
    rsaPublicKey: publicKeyPem,
    encryptedPrivateKey: ciphertextB64,
    privateKeySalt: saltB64,
    privateKeyIv: ivB64
  });

  // Auto-login after registration - return same structure as login
  const token = signJwt({ sub: user.id, role: user.role });
  res.status(201).json({
    token,
    email: user.email,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      rsaPublicKey: user.rsaPublicKey,
      encryptedPrivateKey: user.encryptedPrivateKey,
      privateKeySalt: user.privateKeySalt,
      privateKeyIv: user.privateKeyIv
    }
  });
}

export async function login(req: Request, res: Response) {
  const email = (req.body.email as string).toLowerCase();
  const { password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = signJwt({ sub: user.id, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      rsaPublicKey: user.rsaPublicKey,
      encryptedPrivateKey: user.encryptedPrivateKey,
      privateKeySalt: user.privateKeySalt,
      privateKeyIv: user.privateKeyIv
    }
  });
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    rsaPublicKey: req.user.rsaPublicKey
  });
}

export async function getPublicKeyByEmail(req: Request, res: Response) {
  const email = (req.query.email as string)?.toLowerCase();
  if (!email) {
    return res.status(400).json({ message: 'email query parameter is required' });
  }
  const user = await User.findOne({ email }).select('id email rsaPublicKey');
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({
    id: user.id,
    email: user.email,
    rsaPublicKey: user.rsaPublicKey
  });
}


