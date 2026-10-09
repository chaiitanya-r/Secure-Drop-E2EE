import Joi from 'joi';

export const shareSchema = Joi.object({
  targetUserId: Joi.string().hex().length(24),
  targetUserEmail: Joi.string().email(),
  encryptedAesKey: Joi.string().optional()
}).xor('targetUserId', 'targetUserEmail');


