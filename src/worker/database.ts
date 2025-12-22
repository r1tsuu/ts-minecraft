import { PGlite } from "@electric-sql/pglite";
import {
  Kysely,
  ParseJSONResultsPlugin,
  sql,
  type Generated,
  type JSONColumnType,
} from "kysely";
import { PGliteDialect } from "kysely-pglite-dialect";
import type { BlockInWorld } from "../types.ts";

export type ChunkDatabaseData = {
  blocks: BlockInWorld[];
};

export type DatabaseSchema = {
  worlds: {
    id: Generated<number>;
    name: string;
    seed: string;
    createdAt: Generated<Date>;
  };
  chunks: {
    id: Generated<number>;
    worldID: number;
    x: number;
    z: number;
    data: JSONColumnType<ChunkDatabaseData>;
  };
};

// Increment this when making changes to the database schema
const DB_VERSION = 1;

export const getDatabaseClient = async () => {
  const pg = new PGlite(`idb://minecraft_worker_db_v${DB_VERSION}`);

  const tableExists = async (name: string) => {
    const result = await pg.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      )`,
      [name]
    );

    return result.rows[0]?.exists ?? false;
  };

  const db = new Kysely<DatabaseSchema>({
    dialect: new PGliteDialect(pg),
    plugins: [new ParseJSONResultsPlugin()],
  });

  const hasTables = await tableExists("worlds");

  if (!hasTables) {
    console.log("Creating database tables...");

    await db.schema
      .createTable("worlds")
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull().unique())
      .addColumn("seed", "text", (col) => col.notNull())
      .addColumn("createdAt", "timestamp", (col) =>
        col
          .notNull()
          .defaultTo(sql`now()`)
          .notNull()
      )
      .execute();

    await db.schema
      .createTable("chunks")
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("worldID", "integer", (col) =>
        col.references("worlds.id").onDelete("cascade").notNull()
      )
      .addColumn("x", "integer", (col) => col.notNull())
      .addColumn("z", "integer", (col) => col.notNull())
      .addColumn("data", "json", (col) => col.notNull())
      .addUniqueConstraint("unique_world_chunk", ["worldID", "x", "z"])
      .execute();

    await db.schema
      .createIndex("idx_chunks_world_id")
      .on("chunks")
      .column("worldID")
      .execute();

    console.log("Database tables created.");
  }

  const createWorld = async ({
    name,
    seed,
  }: {
    name: string;
    seed: string;
  }) => {
    const result = await db
      .insertInto("worlds")
      .values({ name, seed })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  };

  const createChunk = async ({
    data,
    worldID,
    x,
    z,
  }: {
    worldID: number;
    x: number;
    z: number;
    data: ChunkDatabaseData;
  }) => {
    const result = await db
      .insertInto("chunks")
      .values({ worldID, x, z, data: JSON.stringify(data) })
      .returning("id")
      .executeTakeFirstOrThrow();

    return result;
  };

  const fetchChunk = async ({
    worldID,
    x,
    z,
  }: {
    worldID: number;
    x: number;
    z: number;
  }) => {
    const result = await db
      .selectFrom("chunks")
      .where("worldID", "=", worldID)
      .where("x", "=", x)
      .where("z", "=", z)
      .selectAll()
      .executeTakeFirst();

    return result;
  };

  const fetchWorlds = async () => {
    const results = await db.selectFrom("worlds").selectAll().execute();
    return results;
  };

  const deleteWorld = async (worldID: number) => {
    await db.deleteFrom("worlds").where("id", "=", worldID).execute();
  };

  const destroy = async () => {
    await db.destroy();
    await pg.close();
  };

  return {
    createWorld,
    createChunk,
    fetchWorlds,
    destroy,
    deleteWorld,
    fetchChunk,
  };
};
