import MinecraftWorker from "./worker.js?worker";
import type { MinecraftClientEvent, MinecraftWorkerEvent } from "./worker.js";

const minecraftWorker = new MinecraftWorker();

const DEBUG = true;

export const sendEventToWorker = (event: MinecraftWorkerEvent) => {
  if (DEBUG) {
    console.log("Sending event to worker:", event);
  }

  minecraftWorker.postMessage(event);
};

export const listenToWorkerEvents = (
  callback: (event: MinecraftClientEvent) => void
) => {
  const onMessage = (msg: MessageEvent<MinecraftClientEvent>) => {
    if (DEBUG) {
      console.log("Received event from worker:", msg.data);
    }
    callback(msg.data);
  };
  minecraftWorker.addEventListener("message", onMessage);

  return () => {
    minecraftWorker.removeEventListener("message", onMessage);
  };
};

export const listenToWorkerEvent = <T extends MinecraftClientEvent["type"]>(
  type: T,
  callback: (event: Extract<MinecraftClientEvent, { type: T }>) => void
) => {
  const onMessage = (msg: MessageEvent<MinecraftClientEvent>) => {
    if (DEBUG) {
      console.log("Received event from worker:", msg.data);
    }
    if (msg.data.type === type) {
      callback(msg.data as Extract<MinecraftClientEvent, { type: T }>);
    }
  };
  minecraftWorker.addEventListener("message", onMessage);

  return () => {
    minecraftWorker.removeEventListener("message", onMessage);
  };
};

export const waitUntilWorkerEvent = <T extends MinecraftClientEvent["type"]>(
  type: T
): Promise<Extract<MinecraftClientEvent, { type: T }>> => {
  return new Promise((resolve) => {
    const unsubscribe = listenToWorkerEvent(type, (event) => {
      resolve(event);
      unsubscribe();
    });
  });
};

export const requestWorker = <
  TResponseEventType extends MinecraftClientEvent["type"],
  TEvent extends MinecraftWorkerEvent
>(
  event: TEvent,
  responseType: TResponseEventType
): Promise<Extract<MinecraftClientEvent, { type: TResponseEventType }>> => {
  if (!event.uuid) {
    event.uuid = crypto.randomUUID();
  }

  return new Promise((resolve) => {
    const unsubscribe = listenToWorkerEvent(responseType, (responseEvent) => {
      if ((responseEvent as any).uuid !== event.uuid) return;

      resolve(
        responseEvent as Extract<
          MinecraftClientEvent,
          { type: TResponseEventType }
        >
      );
      unsubscribe();
    });

    sendEventToWorker(event);
  });
};
