import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import privateGalleryRouter from "./routes/private-gallery";
import contactRouter from "./routes/contact";
import { WebSocketServer } from "ws";
import { setupWebSocketServer } from "./services/chat";
import { pool } from "./db";
import { setupAuth } from "./auth";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

log("Starting server initialization...");

// Verifica connessione database
pool.connect()
  .then(() => {
    log("Database connected successfully");
    initializeServer();
  })
  .catch((err: Error) => {
    log("Database connection error:", err.message);
    process.exit(1);
  });

function initializeServer() {
  try {
    log("Setting up authentication...");
    setupAuth(app);
    log("Authentication setup complete");

    log("Setting up routes...");
    app.use(contactRouter);
    app.use(privateGalleryRouter);

    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        const duration = Date.now() - start;
        if (req.path.startsWith("/api")) {
          log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
        }
      });
      next();
    });

    (async () => {
      try {
        log("Registering main routes...");
        const server = registerRoutes(app);
        log("Main routes registered successfully");

        // Setup WebSocket server
        log("Setting up WebSocket server...");
        const wss = new WebSocketServer({ server, path: '/ws' });
        setupWebSocketServer(wss);
        log("WebSocket server setup complete");

        app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
          log(`Error: ${err.stack}`);
          res.status(500).json({ message: err.message });
        });

        if (app.get("env") === "development") {
          log("Setting up Vite middleware for development...");
          await setupVite(app, server);
          log("Vite middleware setup complete");
        } else {
          log("Setting up static file serving for production...");
          serveStatic(app);
          log("Static file serving setup complete");
        }

        const port = process.env.PORT || 5000;
        server.listen(port, () => {
          log(`Server running on port ${port}`);
        });

        process.on('SIGTERM', () => {
          log("Received SIGTERM signal, shutting down gracefully...");
          server.close(async () => {
            await pool.end();
            process.exit(0);
          });
        });
      } catch (error) {
        log(`Error during server initialization: ${(error as Error).message}`);
        process.exit(1);
      }
    })().catch((err: Error) => {
      log(`Server initialization error: ${err.message}`);
      process.exit(1);
    });
  } catch (error) {
    log(`Error during server setup: ${(error as Error).message}`);
    process.exit(1);
  }
}