import MinecraftWorker from "./worker.js?worker";
import type { MinecraftClientEvent, MinecraftWorkerEvent } from "./worker.js";

const minecraftWorker = new MinecraftWorker();

export const sendEventToWorker = (event: MinecraftWorkerEvent) => {
  minecraftWorker.postMessage(event);
};

export const listenToWorkerEvents = (
  callback: (event: MinecraftClientEvent) => void
) => {
  const onMessage = (msg: MessageEvent<MinecraftClientEvent>) => {
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
    if (msg.data.type === type) {
      callback(msg.data as Extract<MinecraftClientEvent, { type: T }>);
    }
  };
  minecraftWorker.addEventListener("message", onMessage);

  return () => {
    minecraftWorker.removeEventListener("message", onMessage);
  };
};

export const requestWorker = <
  TResponseEventType extends MinecraftClientEvent["type"],
  TEvent extends MinecraftWorkerEvent
>(
  event: TEvent,
  responseType: TResponseEventType
): Promise<Extract<MinecraftClientEvent, { type: TResponseEventType }>> => {
  const uuid = crypto.randomUUID();

  return new Promise((resolve) => {
    const unsubscribe = listenToWorkerEvent(responseType, (responseEvent) => {
      if ((responseEvent as any).uuid !== uuid) return;

      resolve(
        responseEvent as Extract<
          MinecraftClientEvent,
          { type: TResponseEventType }
        >
      );
      unsubscribe();
    });

    sendEventToWorker({ ...event, uuid });
  });
};
