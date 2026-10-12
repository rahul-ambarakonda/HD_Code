import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  const uptime = Math.floor(process.uptime());
  res.status(200).json({ status: 'ok', uptime });
});

export { router };