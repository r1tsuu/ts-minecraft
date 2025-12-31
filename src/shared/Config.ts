export class Config {
  static readonly CHUNK_SIZE = 16
  static readonly WORLD_HEIGHT = 256
  static CHUNK_VOLUME = Config.CHUNK_SIZE * Config.CHUNK_SIZE * Config.WORLD_HEIGHT
  static readonly EULER_ORDER = 'YXZ'
  static readonly GRAVITY = 9.81
  static readonly MOUSE_SENSITIVITY = 0.002
  static readonly PLAYER_HEIGHT = 1.8
  static readonly PLAYER_JUMP_STRENGTH = 8
  static readonly PLAYER_WALK_SPEED = 5
  static readonly PLAYER_WIDTH = 0.6
  static readonly RENDER_DISTANCE = 2
  /**
   * Server autosave interval in milliseconds
   */
  static readonly SERVER_AUTOSAVE_INTERVAL_MS = 5_000
  static readonly SPAWN_CHUNK_RADIUS = 3
  static readonly TICK_RATE = 20

  static getTickDuration(): number {
    return 1000 / Config.TICK_RATE
  }
}

Object.freeze(Config)
