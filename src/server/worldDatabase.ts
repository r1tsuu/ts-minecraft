import { PGlite } from '@electric-sql/pglite'
import {
  type Generated,
  type JSONColumnType,
  Kysely,
  ParseJSONResultsPlugin,
  type RawBuilder,
  type Selectable,
  sql,
} from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'

import type { BlockInWorld, RawVector3, UUID } from '../types.ts'

export type ChunkDatabaseData = {
  blocks: BlockInWorld[]
}

export type DatabaseChunkData = Selectable<DatabaseSchema['chunks']>
export type DatabasePlayerData = Selectable<DatabaseSchema['players']>

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
    data: JSONColumnType<ChunkDatabaseData> // TODO: Store as binary blob instead of JSON
    uuid: UUID
  }
  players: {
    canJump: boolean
    direction: JSONColumnType<RawVector3>
    jumpStrength: number
    pitch: number
    position: JSONColumnType<RawVector3>
    uuid: UUID
    velocity: JSONColumnType<RawVector3>
    yaw: number
  }
  worldMeta: {
    databaseName: string
    lastLoadedAt: Date | null
    loadedChunks: JSONColumnType<
      {
        chunkX: number
        chunkZ: number
        uuid: UUID
      }[]
    >
    uuid: Generated<UUID>
  }
}

export type DatabaseWorldMetaData = Selectable<DatabaseSchema['worldMeta']>

// Increment this when making changes to the database schema
const DB_VERSION = 3

const json = <T>(value: T): RawBuilder<string> => {
  return sql`CAST(${JSON.stringify(value)} AS JSONB)`
}

export const getWorldDatabase = async ({ databaseName }: { databaseName: string }) => {
  const pg = new PGlite(`idb://${databaseName}`)

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
    await db.schema.dropTable('players').ifExists().execute()
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
      .createTable('chunks')
      .addColumn('uuid', 'uuid', (col) => col.primaryKey())
      .addColumn('chunkX', 'integer', (col) => col.notNull())
      .addColumn('chunkZ', 'integer', (col) => col.notNull())
      .addColumn('data', 'jsonb', (col) => col.notNull())
      .addUniqueConstraint('unique_world_chunk', ['chunkX', 'chunkZ'])
      .execute()

    await db.schema
      .createTable('players')
      .addColumn('uuid', 'uuid', (col) => col.primaryKey())
      .addColumn('canJump', 'boolean', (col) => col.notNull())
      .addColumn('direction', 'jsonb', (col) => col.notNull())
      .addColumn('jumpStrength', 'real', (col) => col.notNull())
      .addColumn('pitch', 'real', (col) => col.notNull())
      .addColumn('position', 'jsonb', (col) => col.notNull())
      .addColumn('velocity', 'jsonb', (col) => col.notNull())
      .addColumn('yaw', 'real', (col) => col.notNull())
      .execute()

    await db.schema
      .createTable('worldMeta')
      .addColumn('uuid', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('loadedChunks', 'jsonb', (col) => col.notNull())
      .addColumn('lastLoadedAt', 'timestamp')
      .addColumn('databaseName', 'text', (col) => col.notNull().unique())
      .execute()

    await db
      .insertInto('worldMeta')
      .values({
        databaseName,
        lastLoadedAt: null,
        loadedChunks: json([]),
      })
      .execute()

    console.log(`Database schema for version ${DB_VERSION} set up complete.`)
  }

  const createChunk = async (chunk: DatabaseChunkData) => {
    const result = await db
      .insertInto('chunks')
      .values({
        ...chunk,
        data: '',
      })
      .returning('uuid')
      .executeTakeFirstOrThrow()

    return result
  }

  const createChunks = async (chunks: DatabaseChunkData[]) => {
    const results = await db
      .insertInto('chunks')
      .values(
        chunks.map((chunk) => ({
          ...chunk,
          data: json(chunk.data),
        })),
      )
      .returningAll()
      .execute()

    return results
  }

  const fetchChunk = async ({
    chunkX,
    chunkZ,
  }: {
    chunkX: number
    chunkZ: number
  }): Promise<DatabaseChunkData | null> => {
    const result = await db
      .selectFrom('chunks')
      .where('chunkX', '=', chunkX)
      .where('chunkZ', '=', chunkZ)
      .selectAll()
      .executeTakeFirst()

    return result ?? null
  }

  const fetchChunksByCoordinates = async ({
    coordinates,
  }: {
    coordinates: { chunkX: number; chunkZ: number }[]
  }): Promise<DatabaseChunkData[]> => {
    const result = await db
      .selectFrom('chunks')
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

  const fetchChunksByUUIDs = async ({ uuids }: { uuids: UUID[] }): Promise<DatabaseChunkData[]> => {
    const result = await db.selectFrom('chunks').where('uuid', 'in', uuids).selectAll().execute()

    return result
  }

  const createPlayer = async (data: DatabasePlayerData) => {
    return db
      .insertInto('players')
      .values({
        ...data,
        direction: json(data.direction),
        position: json(data.position),
        velocity: json(data.velocity),
      })
      .returning('uuid')
      .executeTakeFirstOrThrow()
  }

  const fetchPlayers = async (): Promise<DatabasePlayerData[]> => {
    return db.selectFrom('players').selectAll().execute()
  }

  const updatePlayer = async (player: DatabasePlayerData) => {
    await db
      .updateTable('players')
      .set({
        canJump: player.canJump,
        direction: json(player.direction),
        jumpStrength: player.jumpStrength,
        pitch: player.pitch,
        position: json(player.position),
        velocity: json(player.velocity),
      })
      .where('uuid', '=', player.uuid)
      .execute()
  }

  const updateWorldMeta = async (meta: Partial<DatabaseWorldMetaData>) => {
    await db
      .updateTable('worldMeta')
      .set({
        ...meta,
        loadedChunks: meta.loadedChunks ? json(meta.loadedChunks) : undefined,
      })
      .execute()
  }

  const fetchWorldMeta = async (): Promise<DatabaseWorldMetaData> => {
    return db.selectFrom('worldMeta').selectAll().executeTakeFirstOrThrow()
  }

  const destroy = async () => {
    await db.destroy()
    await pg.close()
  }

  const methods = {
    createChunk,
    createChunks,
    createPlayer,
    destroy,
    fetchChunk,
    fetchChunksByCoordinates,
    fetchChunksByUUIDs,
    fetchPlayers,
    fetchWorldMeta,
    updatePlayer,
    updateWorldMeta,
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
