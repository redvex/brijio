import { createWebSocketServer } from "./server.js";

const host = process.env.WEBSOCKET_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.WEBSOCKET_PORT ?? "8787", 10);

if (Number.isNaN(port)) {
  throw new Error("WEBSOCKET_PORT must be a number.");
}

const server = await createWebSocketServer({ host, port });

console.log(`BrowserBridge WebSocket server listening on ${server.url}`);
