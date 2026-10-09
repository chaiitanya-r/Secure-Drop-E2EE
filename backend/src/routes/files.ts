import { Router } from 'express';
import multer from 'multer';

import {
  downloadFile,
  getFileMetadata,
  listFiles,
  shareFile,
  uploadFile
} from '../controllers/fileController.js';
import {
  createEphemeralLink,
  listFileEphemeralLinks,
  revokeEphemeralLink
} from '../controllers/ephemeralController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validate.js';
import { shareSchema } from '../validators/fileSchemas.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const router = Router();

router.use(requireAuth);
router.get('/', listFiles);
router.post('/upload', upload.single('file'), uploadFile);
router.get('/:fileId', getFileMetadata);
router.get('/:fileId/download', downloadFile);
router.post('/:fileId/share', validateBody(shareSchema), shareFile);

// Ephemeral Link management routes (Authenticated)
router.post('/:fileId/ephemeral-link', createEphemeralLink);
router.get('/:fileId/ephemeral-links', listFileEphemeralLinks);
router.delete('/:fileId/ephemeral-links/:linkId', revokeEphemeralLink);

export const filesRouter = router;


