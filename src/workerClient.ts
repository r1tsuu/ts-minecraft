import MinecraftWorker from "./worker.js?worker";
import type { MinecraftWorkerEvent, MinecraftClientEvent } from "./worker.js";

const minecraftWorker = new MinecraftWorker();

export const sendEventToWorker = (event: MinecraftClientEvent) => {
  minecraftWorker.postMessage(event);
};

export const listenToWorkerEvents = (
  callback: (event: MinecraftWorkerEvent) => void
) => {
  const onMessage = (msg: MessageEvent<MinecraftWorkerEvent>) => {
    callback(msg.data);
  };
  minecraftWorker.addEventListener("message", onMessage);

  return () => {
    minecraftWorker.removeEventListener("message", onMessage);
  };
};
