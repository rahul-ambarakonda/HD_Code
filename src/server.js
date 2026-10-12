import express from 'express';
import { router as healthRouter } from '../src/routes/health.js';
import helmet from 'helmet'; // Import helmet

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Log helper
function log(event, fields = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    event,
    ...fields,
  }));
}

// Apply helmet for security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// Trust proxy for rate limiting (if deployed behind Nginx)
app.set('trust proxy', 1);

// Serve static files
app.use(express.static('public'));

// Routes
app.use('/healthz', healthRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  log('server_error', {
    code: err.code || 'UNKNOWN_ERROR',
    message: err.message || 'Something went wrong.',
    stack: NODE_ENV === 'development' ? err.stack : undefined,
  });
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Something went wrong. Try again shortly.',
    },
  });
});

// Start the server
app.listen(PORT, () => {
  log('server_started', { port: PORT });
});

export { app }; // Export for testing