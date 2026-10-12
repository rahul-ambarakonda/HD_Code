/**
 * @file Main Express application server.
 */

import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { waitlistRouter } from './routes/waitlist.js';
import { healthRouter } from './routes/health.js';

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

// Register routes
app.use('/healthz', healthRouter(log));
app.use('/api/waitlist', waitlistRouter(log));

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
