import { getBlockIdByName, initBlocksWorker } from "../block.js";

import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import type { BlockInWorld, RawVector3 } from "../types.js";
import {
  CHUNK_SIZE,
  findByXYZ,
  findByXZ,
  getChunksCoordinatesInRadius,
  rawVector3,
  RENDER_DISTANCE,
  WORLD_HEIGHT,
  zeroRawVector3,
} from "../util.js";
import { getDatabaseClient } from "./database.ts";
import type {
  ActiveWorld,
  MinecraftClientEvent,
  MinecraftWorkerEvent,
} from "./types.ts";

initBlocksWorker();

const databaseClient = await getDatabaseClient();

let worlds = await databaseClient.fetchWorlds();

let activeWorld: ActiveWorld | null = null;

const getActiveWorld = (): ActiveWorld => {
  if (!activeWorld) {
    throw new Error("Active world is not initialized");
  }

  return activeWorld;
};

const noise = new SimplexNoise();

const getChunks = async ({
  coordinates,
  worldID,
}: {
  worldID: number;
  coordinates: { x: number; z: number }[];
}) => {
  const dbChunks = await databaseClient.fetchChunks({
    worldID,
    coordinates,
  });

  const chunksToGenerate: { x: number; z: number }[] = [];
  const result: { x: number; z: number; id: number; blocks: BlockInWorld[] }[] =
    [];

  for (const coord of coordinates) {
    const existingChunk = findByXZ(dbChunks, coord.x, coord.z);

    if (!existingChunk) {
      chunksToGenerate.push(coord);
    } else {
      result.push({
        x: existingChunk.x,
        z: existingChunk.z,
        id: existingChunk.id,
        blocks: existingChunk.data.blocks,
      });
    }
  }

  const generatedChunks: {
    x: number;
    z: number;
    data: {
      blocks: BlockInWorld[];
    };
  }[] = [];

  for (const coord of chunksToGenerate) {
    const { x: chunkX, z: chunkZ } = coord;
    const blocks: BlockInWorld[] = [];

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
          blocks.push({
            x,
            y,
            z,
            typeID: getBlockIdByName(block),
          });
        }
      }
    }

    generatedChunks.push({
      x: chunkX,
      z: chunkZ,
      data: {
        blocks,
      },
    });
  }

  if (generatedChunks.length) {
    const createdChunks = await databaseClient.createChunks({
      worldID,
      chunks: generatedChunks,
    });

    for (const chunk of createdChunks) {
      result.push({
        x: chunk.x,
        z: chunk.z,
        id: chunk.id,
        blocks: chunk.data.blocks,
      });
    }
  }

  return result;
};

const getInitialPlayerPosition = ({
  centralChunk,
}: {
  centralChunk: {
    x: number;
    z: number;
    id: number;
    blocks: BlockInWorld[];
  };
}): RawVector3 => {
  let latestBlock: BlockInWorld | null = null;
  console.log(centralChunk.blocks);

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    const maybeBlock = findByXYZ(centralChunk.blocks, 0, y, 0);

    if (maybeBlock) {
      latestBlock = maybeBlock;
    } else {
      break;
    }
  }

  if (!latestBlock) {
    throw new Error("TODO: Include spawn platform generation");
  }

  return rawVector3(
    latestBlock.x,
    Math.floor(latestBlock.y) + 2,
    latestBlock.z
  );
};

const sendEventToClient = (event: MinecraftClientEvent) => {
  postMessage(event);
};

onmessage = async (msg: MessageEvent<MinecraftWorkerEvent>) => {
  try {
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

      case "initializeWorld": {
        const { worldID } = msg.data.payload;

        const world = worlds.find((w) => w.id === worldID);

        if (!world) {
          throw new Error("World not found");
        }

        const loadedChunks: {
          x: number;
          z: number;
          id: number;
          blocks: BlockInWorld[];
        }[] = [];

        if (!world.initialized) {
          console.log(world);
          const chunksCoordinates = getChunksCoordinatesInRadius({
            centerX: 0,
            centerZ: 0,
            chunkRadius: RENDER_DISTANCE * 3, // Generate extra chunks for initial world
          });

          const chunks = await getChunks({
            worldID: world.id,
            coordinates: chunksCoordinates,
          });

          for (const coordinates of getChunksCoordinatesInRadius({
            centerX: 0,
            centerZ: 0,
            chunkRadius: RENDER_DISTANCE,
          })) {
            const chunk = findByXZ(chunks, coordinates.x, coordinates.z);

            if (chunk) {
              loadedChunks.push(chunk);
            }
          }

          const centralChunk = findByXZ(chunks, 0, 0)!;
          const playerPosition = getInitialPlayerPosition({ centralChunk });

          world.playerData = {
            width: 0.6,
            height: 1.8,
            pitch: 0,
            yaw: 0,
            position: playerPosition,
            canJump: true,
            speed: 5,
            jumpStrength: 8,
            isMovingForward: false,
            isMovingBackward: false,
            isMovingLeft: false,
            isMovingRight: false,
            velocity: zeroRawVector3(),
            direction: zeroRawVector3(),
          };

          await databaseClient.updateWorld({
            worldID: world.id,
            data: {
              initialized: true,
              playerData: world.playerData,
            },
          });

          world.initialized = true;
        }

        activeWorld = {
          world,
          loadedChunks,
        };

        sendEventToClient({
          type: "worldInitialized",
          payload: activeWorld,
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

          const chunks = await getChunks({
            worldID: getActiveWorld().world.id,
            coordinates: chunksCoordinates,
          });

          sendEventToClient({
            type: "chunksGenerated",
            payload: { chunks },
            uuid: msg.data.uuid,
            status: "SUCCESS",
          });
        }

        break;

      case "syncPlayer": {
        const { playerData } = msg.data.payload;

        const activeWorld = getActiveWorld();

        activeWorld.world.playerData = playerData;

        await databaseClient.updateWorld({
          worldID: activeWorld.world.id,
          data: {
            playerData,
          },
        });

        sendEventToClient({
          type: "playerSynced",
          payload: {},
          uuid: msg.data.uuid,
          status: "SUCCESS",
        });

        break;
      }

      case "stopActiveWorld": {
        activeWorld = null;

        sendEventToClient({
          type: "activeWorldStopped",
          payload: {},
          uuid: msg.data.uuid,
          status: "SUCCESS",
        });
        break;
      }
    }
  } catch (error) {
    console.error("Error in worker message handler:", error);
  }
};

sendEventToClient({
  type: "workerInitialized",
  payload: {},
  status: "SUCCESS",
});
