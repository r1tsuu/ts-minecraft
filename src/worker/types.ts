import type { BlockInWorld } from "../types.ts";
import type { DatabasePlayerData, DatabaseWorldData } from "./database.ts";

export type Status = "SUCCESS" | "UNKNOWN_ERROR";

export type BaseEvent<T extends string, Data> = {
  type: T;
  payload: Data;
  uuid?: string;
};

export type BaseClientEvent<T extends string, Data> = BaseEvent<T, Data> & {
  status: Status;
};

export type ActiveWorld = {
  world: DatabaseWorldData;
  loadedChunks: {
    x: number;
    z: number;
    id: number;
    blocks: BlockInWorld[];
  }[];
};

export type MinecraftWorkerEvent =
  | BaseEvent<
      "requestChunks",
      {
        worldID: number;
        chunksCoordinates: {
          x: number;
          z: number;
        }[];
      }
    >
  | BaseEvent<
      "createWorld",
      {
        name: string;
        seed: string;
      }
    >
  | BaseEvent<"requestListWorlds", {}>
  | BaseEvent<"deleteWorld", { worldID: number }>
  | BaseEvent<"initializeWorld", { worldID: number }>
  | BaseEvent<"syncPlayer", { playerData: DatabasePlayerData }>
  | BaseEvent<"stopActiveWorld", {}>;

export type MinecraftClientEvent =
  | BaseClientEvent<
      "chunksGenerated",
      {
        chunks: {
          x: number;
          z: number;
          id: number;
          blocks: BlockInWorld[];
        }[];
      }
    >
  | BaseClientEvent<
      "worldCreated",
      {
        name: string;
        seed: string;
        createdAt: Date;
        id: number;
      }
    >
  | BaseClientEvent<
      "listWorldsResponse",
      {
        worlds: {
          name: string;
          seed: string;
          createdAt: Date;
          id: number;
        }[];
      }
    >
  | BaseClientEvent<"worldDeleted", { worldID: number }>
  | BaseClientEvent<"worldInitialized", ActiveWorld>
  | BaseClientEvent<"workerInitialized", {}>
  | BaseClientEvent<"playerSynced", {}>
  | BaseClientEvent<"activeWorldStopped", {}>;
