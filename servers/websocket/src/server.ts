import { WebSocketServer, type WebSocket } from "ws";
import { parseWebSocketMessage } from "./protocol.js";

export type WebSocketServerOptions = {
  host?: string;
  port?: number;
};

export type BrowserBridgeWebSocketServer = {
  url: string;
  close: () => Promise<void>;
};

export async function createWebSocketServer(
  options: WebSocketServerOptions = {}
): Promise<BrowserBridgeWebSocketServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const server = new WebSocketServer({ host, port });

  server.on("connection", (socket) => {
    socket.on("message", (data) => {
      const result = parseWebSocketMessage(data.toString());

      if (!result.ok) {
        sendJson(socket, result.error);
        return;
      }

      broadcastJson(server, result.message);
    });
  });

  await waitForListening(server);

  return {
    url: `ws://${host}:${getPort(server)}`,
    close: () => closeServer(server)
  };
}

function broadcastJson(server: WebSocketServer, message: unknown): void {
  const serialized = JSON.stringify(message);

  for (const client of server.clients) {
    if (client.readyState === client.OPEN) {
      client.send(serialized);
    }
  }
}

function sendJson(socket: WebSocket, message: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function waitForListening(server: WebSocketServer): Promise<void> {
  if (server.address() !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
}

function getPort(server: WebSocketServer): number {
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("WebSocket server is not listening on a TCP port.");
  }

  return address.port;
}

function closeServer(server: WebSocketServer): Promise<void> {
  for (const client of server.clients) {
    client.close();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
