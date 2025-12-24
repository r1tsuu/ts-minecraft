import { PGlite } from '@electric-sql/pglite'
import {
  type Generated,
  type JSONColumnType,
  Kysely,
  ParseJSONResultsPlugin,
  type Selectable,
  sql,
  type Updateable,
} from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'

import type { BlockInWorld, PlayerData, RawVector3 } from '../types.ts'

export type ChunkDatabaseData = {
  blocks: BlockInWorld[]
}

export type DatabasePlayerData = Selectable<DatabaseSchema['worlds']>['playerData']

export type DatabaseSchema = {
  _versionHistory: {
    createdAt: Generated<Date>
    current: boolean
    id: Generated<number>
    version: number
  }
  chunks: {
    chunkX: number
    chunkZ: number
    data: JSONColumnType<ChunkDatabaseData>
    id: Generated<number>
    worldID: number
  }
  worlds: {
    createdAt: Generated<Date>
    id: Generated<number>
    initialized: boolean
    name: string
    playerData: JSONColumnType<
      {
        direction: RawVector3 // Cannot use THREE.Vector3 in the database
        position: RawVector3 // Cannot use THREE.Vector3 in the database
        velocity: RawVector3 // Cannot use THREE.Vector3 in the database
      } & Omit<PlayerData, 'direction' | 'position' | 'velocity'>
    >
    seed: string
  }
}
export type DatabaseWorldData = Selectable<DatabaseSchema['worlds']>

// Increment this when making changes to the database schema
const DB_VERSION = 2

export const getDatabaseClient = async () => {
  const pg = new PGlite(`idb://minecraft_worker_db`)

  const tableExists = async (name: string) => {
    const result = await pg.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      )`,
      [name],
    )

    return result.rows[0]?.exists ?? false
  }

  const db = new Kysely<DatabaseSchema>({
    dialect: new PGliteDialect(pg),
    plugins: [new ParseJSONResultsPlugin()],
  })

  const dropTables = async () => {
    await db.schema.dropTable('chunks').ifExists().execute()
    await db.schema.dropTable('worlds').ifExists().execute()
  }

  if (!(await tableExists('_versionHistory'))) {
    await db.schema
      .createTable('_versionHistory')
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('version', 'integer', (col) => col.notNull())
      .addColumn('current', 'boolean', (col) => col.notNull())
      .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .execute()
  }

  const versionEntry = await db
    .selectFrom('_versionHistory')
    .where('current', '=', true)
    .where('version', '=', DB_VERSION)
    .select('id')
    .executeTakeFirst()

  if (!versionEntry) {
    console.log(`Setting up database schema for version ${DB_VERSION}...`)
    await dropTables()

    await db
      .updateTable('_versionHistory')
      .set({ current: false })
      .where('current', '=', true)
      .execute()

    await db
      .insertInto('_versionHistory')
      .values({
        current: true,
        version: DB_VERSION,
      })
      .execute()

    await db.schema
      .createTable('worlds')
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('name', 'text', (col) => col.notNull().unique())
      .addColumn('seed', 'text', (col) => col.notNull())
      .addColumn('initialized', 'boolean', (col) => col.notNull())
      .addColumn('playerData', 'json', (col) => col.notNull())
      .addColumn('createdAt', 'timestamp', (col) =>
        col
          .notNull()
          .defaultTo(sql`now()`)
          .notNull(),
      )
      .execute()

    await db.schema
      .createTable('chunks')
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('worldID', 'integer', (col) =>
        col.references('worlds.id').onDelete('cascade').notNull(),
      )
      .addColumn('chunkX', 'integer', (col) => col.notNull())
      .addColumn('chunkZ', 'integer', (col) => col.notNull())
      .addColumn('data', 'json', (col) => col.notNull())
      .addUniqueConstraint('unique_world_chunk', ['worldID', 'chunkX', 'chunkZ'])
      .execute()

    await db.schema.createIndex('idx_chunks_world_id').on('chunks').column('worldID').execute()

    console.log(`Database schema for version ${DB_VERSION} set up complete.`)
  }

  const createWorld = async ({ name, seed }: { name: string; seed: string }) => {
    const result = await db
      .insertInto('worlds')
      .values({
        initialized: false,
        name,
        playerData: JSON.stringify({ pitch: 0, x: 0, y: 100, yaw: 0, z: 0 }),
        seed,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result
  }

  const updateWorld = ({
    data,
    worldID,
  }: {
    data: Partial<{
      initialized: boolean
      playerData: DatabasePlayerData
    }>
    worldID: number
  }) => {
    const dataToSet: Updateable<DatabaseSchema['worlds']> = {}

    if ('initialized' in data) {
      dataToSet.initialized = data.initialized
    }

    if ('playerData' in data) {
      dataToSet.playerData = JSON.stringify(data.playerData)
    }

    return db.updateTable('worlds').set(dataToSet).where('id', '=', worldID).execute()
  }

  const createChunk = async ({
    chunkX,
    chunkZ,
    data,
    worldID,
  }: {
    chunkX: number
    chunkZ: number
    data: ChunkDatabaseData
    worldID: number
  }) => {
    const result = await db
      .insertInto('chunks')
      .values({ chunkX, chunkZ, data: JSON.stringify(data), worldID })
      .returning('id')
      .executeTakeFirstOrThrow()

    return result
  }

  const createChunks = async ({
    chunks,
    worldID,
  }: {
    chunks: { chunkX: number; chunkZ: number; data: ChunkDatabaseData }[]
    worldID: number
  }) => {
    const results = await db
      .insertInto('chunks')
      .values(
        chunks.map((chunk) => ({
          chunkX: chunk.chunkX,
          chunkZ: chunk.chunkZ,
          data: JSON.stringify(chunk.data),
          worldID,
        })),
      )
      .returningAll()
      .execute()

    return results
  }

  const fetchChunk = async ({
    chunkX,
    chunkZ,
    worldID,
  }: {
    chunkX: number
    chunkZ: number
    worldID: number
  }) => {
    const result = await db
      .selectFrom('chunks')
      .where('worldID', '=', worldID)
      .where('chunkX', '=', chunkX)
      .where('chunkZ', '=', chunkZ)
      .selectAll()
      .executeTakeFirst()

    return result
  }

  const fetchChunks = async ({
    coordinates,
    worldID,
  }: {
    coordinates: { chunkX: number; chunkZ: number }[]
    worldID: number
  }) => {
    const result = await db
      .selectFrom('chunks')
      .where('worldID', '=', worldID)
      .where((eb) =>
        eb.or(
          coordinates.map((coord) =>
            eb.and([eb('chunkX', '=', coord.chunkX), eb('chunkZ', '=', coord.chunkZ)]),
          ),
        ),
      )
      .selectAll()
      .execute()

    return result
  }

  const fetchWorlds = async () => {
    const results = await db.selectFrom('worlds').selectAll().execute()
    return results
  }

  const deleteWorld = async (worldID: number) => {
    await db.deleteFrom('worlds').where('id', '=', worldID).execute()
  }

  const destroy = async () => {
    await db.destroy()
    await pg.close()
  }

  const methods = {
    createChunk,
    createChunks,
    createWorld,
    deleteWorld,
    destroy,
    fetchChunk,
    fetchChunks,
    fetchWorlds,
    updateWorld,
  }

  for (const [name, func] of Object.entries(methods)) {
    methods[name as keyof typeof methods] = async (...args: any[]) => {
      try {
        return await (func as Function)(...args)
      } catch (error) {
        console.error(`Database error in ${name}:`, error)
        throw error
      }
    }
  }

  return methods
}
