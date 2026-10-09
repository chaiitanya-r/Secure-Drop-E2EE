import { Router } from 'express';
import { getAuditLogs, verifyAuditChainStatus } from '../controllers/auditController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', getAuditLogs);
router.get('/verify', verifyAuditChainStatus);

export const auditRouter = router;
