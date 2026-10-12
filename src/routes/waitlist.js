/**
 * @file Implements the /api/waitlist POST endpoint.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isValidEmail } from '../lib/validate.js';
import { hasEmail, addEntry } from '../lib/store.js';

export function waitlistRouter(log) {
  const router = Router();

  // Rate limiting for the waitlist endpoint
  const waitlistLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute per IP
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Try again in a minute.',
      },
    },
    handler: (req, res, next, options) => {
      log({
        type: 'waitlist_submitted',
        outcome: 'rate_limited',
        ip: req.ip,
      });
      res.status(options.statusCode).send(options.message);
    },
  });

  router.post(
    '/',
    waitlistLimiter,
    (req, res, next) => {
      // Content-Type validation
      if (!req.is('application/json')) {
        log({
          type: 'waitlist_submitted',
          outcome: 'invalid',
          ip: req.ip,
        });
        return res.status(415).json({
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Content-Type must be application/json.',
          },
        });
      }
      next();
    },
    // Body parsing middleware (limit to 1kb as per API contract)
    Router().use(Router().json({ limit: '1kb' })),
    async (req, res) => {
      const { email } = req.body;
      const ip = req.ip; // Already configured with trust proxy in server.js

      if (!isValidEmail(email)) {
        log({
          type: 'waitlist_submitted',
          outcome: 'invalid',
          ip: ip,
        });
        return res.status(400).json({
          error: {
            code: 'INVALID_EMAIL',
            message: 'That does not look like an email address.',
          },
        });
      }

      try {
        if (await hasEmail(email)) {
          log({
            type: 'waitlist_submitted',
            outcome: 'duplicate',
            ip: ip,
          });
          return res.status(409).json({
            error: {
              code: 'ALREADY_JOINED',
              message: 'You are already on the list.',
            },
          });
        }

        await addEntry(email, ip);
        log({
          type: 'waitlist_submitted',
          outcome: 'joined',
          ip: ip,
        });
        return res.status(201).json({ status: 'joined' });
      } catch (error) {
        log({
          type: 'waitlist_store_error',
          message: error.message,
          ip: ip,
        });
        // Distinguish between STORE_UNAVAILABLE and other errors if necessary, but 500 is common for general server errors
        if (error.cause && error.cause.message === 'STORE_UNAVAILABLE') {
           return res.status(500).json({
             error: {
               code: 'STORE_UNAVAILABLE',
               message: 'Something went wrong. Try again shortly.',
             },
           });
        }

        return res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Something went wrong. Try again shortly.',
          },
        });
      }
    },
  );

  return router;
}
