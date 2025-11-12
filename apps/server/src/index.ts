import { createServer } from "node:http";
import { sentry } from "@hono/sentry";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { showRoutes } from "hono/dev";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { env } from "~/env";
import { handleError } from "~/libs/errors";
import { v1 } from "~/routes/v1";
import { webhooks } from "~/routes/webhooks";
import { SocketManager } from "~/socket";

/**
 * Create Hono app
 */
export const app = new Hono({ strict: false });

/**
 * Global Middleware
 * Order matters! requestId antes do logger
 */
app.use("*", requestId());
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: env.SOCKET_IO_CORS_ORIGIN,
    credentials: true,
  }),
);

// Sentry error tracking (optional)
if (env.SENTRY_DSN) {
  app.use("*", sentry({ dsn: env.SENTRY_DSN }));
}

/**
 * Health check endpoint
 */
app.get("/ping", (c) => {
  return c.json(
    {
      ping: "pong",
      timestamp: new Date().toISOString(),
      requestId: c.get("requestId"),
    },
    200,
  );
});

/**
 * Mount routes
 */
app.route("/v1", v1);
app.route("/webhooks", webhooks);

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      path: c.req.path,
    },
    404,
  );
});

/**
 * Global error handler
 */
app.onError(handleError);

/**
 * Development mode: show routes
 */
const isDev = env.NODE_ENV === "development";
const port = env.SERVER_PORT;

if (isDev) {
  showRoutes(app, { verbose: true, colorize: true });
}

console.log(`🚀 Starting server on port ${port}`);

/**
 * Start Bun server with Socket.io support
 */
const server = Bun.serve({
  port,
  fetch: app.fetch,
});

/**
 * Initialize Socket.io with the HTTP server
 */
// Bun doesn't expose a native Node.js HTTP server
// We need to use a workaround to get Socket.io working
// For now, we'll create a separate HTTP server for Socket.io
const httpServer = createServer();
const socketManager = new SocketManager(httpServer);

// Start HTTP server for Socket.io on the same port + 1
const socketPort = port + 1;
httpServer.listen(socketPort, () => {
  console.log(`🔌 Socket.io server listening on port ${socketPort}`);
});

/**
 * Graceful shutdown
 */
process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing HTTP server");

  await socketManager.close();
  server.stop();
  httpServer.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT signal received: closing HTTP server");

  await socketManager.close();
  server.stop();
  httpServer.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

export default server;
