// MUST be first import - loads .env from project root before any other imports
import 'dotenv/config';

import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";


const app = express();
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '10mb' })); // Increase limit for file uploads
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Publicly serve uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'server', 'public', 'uploads')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    // Don't throw database connection errors - just log them
    if (err.code === 'XX000' || err.message?.includes('db_termination') || err.message?.includes('shutdown')) {
      console.error('Database connection error (non-fatal)');
      res.status(503).json({ message: 'Database temporarily unavailable. Please try again.' });
      return;
    }

    // Log full error details on server only (for debugging)
    console.error('Server error:', {
      message: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Hide sensitive error details from client
    const isSensitiveError = 
      err.message?.includes('password') ||
      err.message?.includes('token') ||
      err.message?.includes('secret') ||
      err.message?.includes('key') ||
      err.message?.includes('SQL') ||
      err.message?.includes('database') ||
      err.stack;

    const safeMessage = isSensitiveError 
      ? (status === 500 ? 'Internal Server Error' : 'An error occurred')
      : (err.message || "Internal Server Error");

    res.status(status).json({ message: safeMessage });
    
    // Only throw non-database errors
    if (!err.message?.includes('database') && !err.message?.includes('db_termination')) {
      throw err;
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
