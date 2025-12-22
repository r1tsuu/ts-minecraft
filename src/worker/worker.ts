import { getBlockIdByName, initBlocksWorker } from "../block.js";
import seedrandom from "seedrandom";

import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import type { BlockInWorld } from "../types.js";
import { CHUNK_SIZE, WORLD_HEIGHT } from "../util.js";
import { getDatabaseClient } from "./database.ts";

initBlocksWorker();

const databaseClient = await getDatabaseClient();

let worlds = await databaseClient.fetchWorlds();

const getWorld = (id: number) => {
  const maybeWorld = worlds.find((w) => w.id === id);

  if (!maybeWorld) {
    throw new Error(`World with ID ${id} not found`);
  }

  return maybeWorld;
};

const noise = new SimplexNoise();

const generateChunk = async ({
  chunkX,
  chunkZ,
  worldID,
}: {
  chunkX: number;
  chunkZ: number;
  worldID: number;
}): Promise<{
  x: number;
  z: number;
  id: number;
  blocks: BlockInWorld[];
}> => {
  const existingChunk = await databaseClient.fetchChunk({
    worldID,
    x: chunkX,
    z: chunkZ,
  });

  if (existingChunk) {
    return {
      x: chunkX,
      z: chunkZ,
      id: existingChunk.id,
      blocks: existingChunk.data.blocks,
    };
  }

  const insertChunkData: Parameters<(typeof databaseClient)["createChunk"]>[0] =
    {
      worldID,
      data: {
        blocks: [],
      },
      x: chunkX,
      z: chunkZ,
    };

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = chunkX + x;
      const worldZ = chunkZ + z;
      const baseY = 30;
      const heightVariation = 12;
      const amplitude = heightVariation / 2;
      const frequency = 0.005;

      const yOffset = Math.floor(
        (noise.noise(worldX * frequency, worldZ * frequency) + 1) * amplitude
      );

      const height = baseY + yOffset;

      for (let y = 0; y <= height; y++) {
        const block = y === height ? "grass" : "dirt";
        insertChunkData.data.blocks.push({
          x,
          y,
          z,
          typeID: getBlockIdByName(block),
        });
      }
    }
  }

  const { id } = await databaseClient.createChunk(insertChunkData);

  return {
    blocks: insertChunkData.data.blocks,
    x: chunkX,
    z: chunkZ,
    id,
  };
};

const sendEventToClient = (event: MinecraftClientEvent) => {
  postMessage(event);
};

onmessage = async (msg: MessageEvent<MinecraftWorkerEvent>) => {
  switch (msg.data.type) {
    case "createWorld": {
      const { name: incomingName, seed } = msg.data.payload;

      let name = incomingName;

      let worldByName = worlds.find((w) => w.name === name);
      let attempt = 1;

      while (worldByName) {
        if (name.match(/\(_\(\d+\)\)$/)) {
          name = name.replace(/\(_\(\d+\)\)$/, `(_(${attempt}))`);
        } else {
          name = `${incomingName} (${attempt})`;
        }
        worldByName = worlds.find((w) => w.name === name);
        attempt++;
      }

      const world = await databaseClient.createWorld({ name, seed });
      worlds.push(world);

      sendEventToClient({
        type: "worldCreated",
        payload: world,
        uuid: msg.data.uuid,
        status: "SUCCESS",
      });

      break;
    }
    case "requestListWorlds": {
      sendEventToClient({
        type: "listWorldsResponse",
        payload: {
          worlds,
        },
        uuid: msg.data.uuid,
        status: "SUCCESS",
      });
      break;
    }

    case "deleteWorld": {
      const { worldID } = msg.data.payload;

      await databaseClient.deleteWorld(worldID);

      worlds = await databaseClient.fetchWorlds();

      sendEventToClient({
        type: "worldDeleted",
        payload: { worldID },
        uuid: msg.data.uuid,
        status: "SUCCESS",
      });
      break;
    }
    case "requestChunks":
      {
        const { chunksCoordinates } = msg.data.payload;

        const promises: Promise<{
          x: number;
          z: number;
          id: number;
          blocks: BlockInWorld[];
        }>[] = [];
        for (const coordinates of chunksCoordinates) {
          promises.push(
            generateChunk({
              chunkX: coordinates.x,
              chunkZ: coordinates.z,
              worldID: msg.data.payload.worldID,
            })
          );
        }

        const chunks = await Promise.all(promises);

        sendEventToClient({
          type: "chunksGenerated",
          payload: { chunks },
          uuid: msg.data.uuid,
          status: "SUCCESS",
        });
      }

      break;
  }
};

type Status = "SUCCESS" | "UNKNOWN_ERROR";

type BaseEvent<T extends string, Data> = {
  type: T;
  payload: Data;
  uuid?: string;
};

type BaseClientEvent<T extends string, Data> = BaseEvent<T, Data> & {
  status: Status;
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
  | BaseEvent<"initializeWorld", { worldID: number }>;

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
  | BaseClientEvent<"worldInitialized", { worldID: number }>;
