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

import type { BlockInWorld, ChunkCoordinates, RawVector3, UUID } from '../types.ts'

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
    data: JSONColumnType<ChunkDatabaseData> // TODO: Store as binary blob instead of JSON
    uuid: UUID
  } & ChunkCoordinates
  players: {
    position: JSONColumnType<RawVector3>
    rotation: JSONColumnType<{
      x: number
      y: number
    }>
    uuid: UUID
    velocity: JSONColumnType<RawVector3>
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
const DB_VERSION = 6

const json = <T>(value: T): RawBuilder<string> => {
  return sql`CAST(${JSON.stringify(value)} AS JSONB)`
}

export class WorldDatabase {
  private db: Kysely<DatabaseSchema>
  private pg: PGlite

  private constructor(pg: PGlite, db: Kysely<DatabaseSchema>) {
    this.pg = pg
    this.db = db
  }

  static async create(databaseName: string): Promise<WorldDatabase> {
    const pg = new PGlite(`idb://${databaseName}`)

    const db = new Kysely<DatabaseSchema>({
      dialect: new PGliteDialect(pg),
      plugins: [new ParseJSONResultsPlugin()],
    })

    const instance = new WorldDatabase(pg, db)
    await instance.initialize(databaseName)

    return new Proxy(instance, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)

        if (typeof value === 'function' && typeof prop === 'string' && !prop.startsWith('_')) {
          return async function (this: WorldDatabase, ...args: any[]) {
            try {
              return await value.apply(this === receiver ? target : this, args)
            } catch (error) {
              console.error(`Database error in ${prop}:`, error)
              throw error
            }
          }
        }

        return value
      },
    })
  }

  async createChunk(chunk: DatabaseChunkData) {
    const result = await this.db
      .insertInto('chunks')
      .values({
        ...chunk,
        data: '',
      })
      .returning('uuid')
      .executeTakeFirstOrThrow()

    return result
  }

  async createChunks(chunks: DatabaseChunkData[]) {
    const results = await this.db
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

  async createPlayer(data: DatabasePlayerData) {
    return this.db
      .insertInto('players')
      .values({
        ...data,
        position: json(data.position),
        rotation: json(data.rotation),
        velocity: json(data.velocity),
      })
      .returning('uuid')
      .executeTakeFirstOrThrow()
  }

  async dispose() {
    await this.db.destroy()
    await this.pg.close()
  }

  async fetchChunk(chunkX: number, chunkZ: number): Promise<DatabaseChunkData | null> {
    const result = await this.db
      .selectFrom('chunks')
      .where('chunkX', '=', chunkX)
      .where('chunkZ', '=', chunkZ)
      .selectAll()
      .executeTakeFirst()

    return result ?? null
  }

  async fetchChunksByCoordinates(coordinates: ChunkCoordinates[]): Promise<DatabaseChunkData[]> {
    const result = await this.db
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

  async fetchChunksByUUIDs(uuids: UUID[]): Promise<DatabaseChunkData[]> {
    const result = await this.db
      .selectFrom('chunks')
      .where('uuid', 'in', uuids)
      .selectAll()
      .execute()

    return result
  }

  async fetchPlayers(): Promise<DatabasePlayerData[]> {
    return this.db.selectFrom('players').selectAll().execute()
  }

  async fetchWorldMeta(): Promise<DatabaseWorldMetaData> {
    return this.db.selectFrom('worldMeta').selectAll().executeTakeFirstOrThrow()
  }

  async updateChunks(chunks: DatabaseChunkData[]) {
    for (const chunk of chunks) {
      await this.db
        .updateTable('chunks')
        .set({
          data: json(chunk.data),
        })
        .where('uuid', '=', chunk.uuid)
        .execute()
    }
  }

  async updatePlayer(player: DatabasePlayerData) {
    await this.db
      .updateTable('players')
      .set({
        position: json(player.position),
        rotation: json(player.rotation),
        velocity: json(player.velocity),
      })
      .where('uuid', '=', player.uuid)
      .execute()
  }

  async updateWorldMeta(meta: Partial<DatabaseWorldMetaData>) {
    await this.db
      .updateTable('worldMeta')
      .set({
        ...meta,
        loadedChunks: meta.loadedChunks ? json(meta.loadedChunks) : undefined,
      })
      .execute()
  }

  private async dropTables(): Promise<void> {
    await this.db.schema.dropTable('chunks').ifExists().execute()
    await this.db.schema.dropTable('players').ifExists().execute()
  }

  private async initialize(databaseName: string): Promise<void> {
    if (!(await this.tableExists('_versionHistory'))) {
      await this.db.schema
        .createTable('_versionHistory')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('version', 'integer', (col) => col.notNull())
        .addColumn('current', 'boolean', (col) => col.notNull())
        .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
        .execute()
    }

    const versionEntry = await this.db
      .selectFrom('_versionHistory')
      .where('current', '=', true)
      .where('version', '=', DB_VERSION)
      .select('id')
      .executeTakeFirst()

    if (!versionEntry) {
      console.log(`Setting up database schema for version ${DB_VERSION}...`)
      await this.dropTables()

      await this.db
        .updateTable('_versionHistory')
        .set({ current: false })
        .where('current', '=', true)
        .execute()

      await this.db
        .insertInto('_versionHistory')
        .values({
          current: true,
          version: DB_VERSION,
        })
        .execute()

      await this.db.schema
        .createTable('chunks')
        .addColumn('uuid', 'uuid', (col) => col.primaryKey())
        .addColumn('chunkX', 'integer', (col) => col.notNull())
        .addColumn('chunkZ', 'integer', (col) => col.notNull())
        .addColumn('data', 'jsonb', (col) => col.notNull())
        .addUniqueConstraint('unique_world_chunk', ['chunkX', 'chunkZ'])
        .execute()

      await this.db.schema
        .createTable('players')
        .addColumn('uuid', 'uuid', (col) => col.primaryKey())
        .addColumn('position', 'jsonb', (col) => col.notNull())
        .addColumn('velocity', 'jsonb', (col) => col.notNull())
        .addColumn('rotation', 'jsonb', (col) => col.notNull())
        .execute()

      await this.db.schema
        .createTable('worldMeta')
        .addColumn('uuid', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('loadedChunks', 'jsonb', (col) => col.notNull())
        .addColumn('lastLoadedAt', 'timestamp')
        .addColumn('databaseName', 'text', (col) => col.notNull().unique())
        .execute()

      await this.db
        .insertInto('worldMeta')
        .values({
          databaseName,
          lastLoadedAt: null,
          loadedChunks: json([]),
        })
        .execute()

      console.log(`Database schema for version ${DB_VERSION} set up complete.`)
    }
  }

  private async tableExists(name: string): Promise<boolean> {
    const result = await this.pg.query<{ exists: boolean }>(
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
}
