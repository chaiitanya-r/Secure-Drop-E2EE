import { Router } from 'express';
import { getPublicLinkMetadata, downloadPublicFile } from '../controllers/ephemeralController.js';

const router = Router();

// Public routes - No authentication header required
router.get('/:token', getPublicLinkMetadata);
router.get('/:token/download', downloadPublicFile);

export const publicShareRouter = router;
