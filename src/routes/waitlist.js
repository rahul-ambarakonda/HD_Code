import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isValidEmail } from '../lib/validate.js';
import { addEntry, hasEmail } from '../lib/store.js';

export const router = Router();

// Rate limiting middleware for this route only
const waitlistLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  standardHeaders: true,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a minute.' } },
});

router.post('/api/waitlist',
  waitlistLimiter,
  (req, res, next) => {
    // Content-Type validation
    if (!req.is('application/json')) {
      return res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' } });
    }
    next();
  },
  // express.json({ limit: '1kb' }) middleware will be applied globally in server.js
  async (req, res, next) => {
    const { email } = req.body;
    const ip = req.ip; // req.ip is available due to trust proxy setting in server.js

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: { code: 'INVALID_EMAIL', message: 'That does not look like an email address.' } });
    }

    try {
      if (await hasEmail(email)) {
        // Log the duplicate submission for analytics
        console.log(JSON.stringify({ event: 'waitlist_submitted', outcome: 'duplicate', ip: ip }));
        return res.status(409).json({ error: { code: 'ALREADY_JOINED', message: 'You are already on the list.' } });
      }

      await addEntry(email, ip);
      // Log the successful submission for analytics
      console.log(JSON.stringify({ event: 'waitlist_submitted', outcome: 'joined', ip: ip }));
      return res.status(201).json({ status: 'joined' });
    } catch (error) {
      if (error.message === 'STORE_UNAVAILABLE') {
        // Log the store error for analytics/debugging
        console.error(JSON.stringify({ event: 'waitlist_store_error', message: error.message, ip: ip }));
        return res.status(500).json({ error: { code: 'STORE_UNAVAILABLE', message: 'Something went wrong. Try again shortly.' } });
      }
      // Catch any other unexpected errors
      console.error(JSON.stringify({ event: 'server_error', message: error.message, stack: error.stack, ip: ip }));
      return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' } });
    }
  }
);
