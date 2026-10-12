/**
 * @file Health check endpoint.
 */

import { Router } from 'express';

export const router = Router();

router.get('/', (req, res) => {
  const uptime = Math.floor(process.uptime());
  res.status(200).json({ status: 'ok', uptime });
});
