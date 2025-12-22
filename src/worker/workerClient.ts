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
