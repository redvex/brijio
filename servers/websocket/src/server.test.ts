import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import WebSocket from "ws";
import { createWebSocketServer } from "./server.js";

type JsonObject = Record<string, unknown>;

const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("WebSocket single-channel echo and pub/sub", () => {
  it("echoes a valid message back to the sender", async () => {
    const server = await startTestServer();
    const client = await connect(server.url);
    const message = { type: "message", id: "msg-1", payload: { text: "hello" } };

    const received = waitForJsonMessage(client);
    client.send(JSON.stringify(message));

    assert.deepEqual(await received, message);
    client.close();
  });

  it("broadcasts a valid message to other connected clients", async () => {
    const server = await startTestServer();
    const sender = await connect(server.url);
    const subscriber = await connect(server.url);
    const message = { type: "message", id: "msg-2", payload: { text: "fanout" } };

    const senderReceived = waitForJsonMessage(sender);
    const subscriberReceived = waitForJsonMessage(subscriber);
    sender.send(JSON.stringify(message));

    assert.deepEqual(await senderReceived, message);
    assert.deepEqual(await subscriberReceived, message);
    sender.close();
    subscriber.close();
  });

  it("returns a structured error for invalid JSON", async () => {
    const server = await startTestServer();
    const client = await connect(server.url);

    const received = waitForJsonMessage(client);
    client.send("{not valid json");

    assert.deepEqual(await received, {
      type: "error",
      error: {
        code: "invalid_json",
        message: "Message must be valid JSON."
      }
    });
    client.close();
  });

  it("returns a structured error for unsupported message envelopes", async () => {
    const server = await startTestServer();
    const client = await connect(server.url);

    const received = waitForJsonMessage(client);
    client.send(JSON.stringify({ type: "unknown", payload: { text: "hello" } }));

    assert.deepEqual(await received, {
      type: "error",
      error: {
        code: "invalid_message",
        message: "Message must be an object with type \"message\" and a payload property."
      }
    });
    client.close();
  });
});

async function startTestServer(): Promise<{ url: string }> {
  const server = await createWebSocketServer({ host: "127.0.0.1", port: 0 });
  servers.push(server);
  return { url: server.url };
}

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(url);
    client.once("open", () => resolve(client));
    client.once("error", reject);
  });
}

function waitForJsonMessage(client: WebSocket): Promise<JsonObject> {
  return new Promise((resolve, reject) => {
    client.once("message", (data) => {
      try {
        assert.equal(typeof data.toString(), "string");
        resolve(JSON.parse(data.toString()) as JsonObject);
      } catch (error) {
        reject(error);
      }
    });
    client.once("error", reject);
  });
}
