/**
 * @file Main Express application server.
 */

import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { router as waitlistRouter } from './routes/waitlist.js'; // Corrected import
import { router as healthRouter } from './routes/health.js';

// Helper for logging
const log = (event, fields = {}) => {
  console.log(JSON.stringify({ event, ...fields }));
};

// Determine __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy for IP addresses (nginx will be in front)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// Body parsing middleware (capped at 1kb)
app.use(express.json({ limit: '1kb' }));

// Register routes
app.use('/healthz', healthRouter);
app.use('/api/waitlist', waitlistRouter); // Corrected usage

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Basic route for the root
app.get('/', (req, res) => {
  log('page_view', { path: '/', ua: req.headers['user-agent'], ip: req.ip });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Central error-handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'SERVER_ERROR';
  const errorMessage = err.message || 'Something went wrong. Try again shortly.';

  log('server_error', {
    code: errorCode,
    message: errorMessage,
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack, // Minimal stack in prod
  });

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: errorMessage,
    },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log('server_started', { port: PORT, env: process.env.NODE_ENV || 'development' });
});
