import { Router } from 'express';

import { register, login, me, getPublicKeyByEmail } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/authSchemas.js';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.get('/me', requireAuth, me);
router.get('/public-key', requireAuth, getPublicKeyByEmail);

export const authRouter = router;


