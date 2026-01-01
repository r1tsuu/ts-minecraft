# Minecraft Clone with TypeScript, THREE.js

### [Visit](https://r1tsuu.github.io/ts-minecraft/)

## Implemented:

- Partial [ECS pattern](./src/shared/World.ts) without "components" - they are stored inside [entities](./src/shared/entities/Entity.ts). New game logic can easily be added with `createSystemFactory`, example - [chunk rendering](./src/client/systems/ChunkRenderingSystem.ts)
- Client - Server architecture through [Event Bus](./src/shared//MinecraftEventBus.ts), currently the "server" is executed via a [web worker](./src/singleplayer/SinglePlayerWorker.ts).
- Infinite world generation with terrain, trees, caves, ores
- Chunk rendering via chunk mesh generation - very fast.
- Movement, collission, raycasting/highlighting, block placement / block removal
- Simple inventory
- Created worlds are persisted currently to the [OPFS](./src/singleplayer/PrivateFileSystemWorldStorage.ts)

## TODO:

- Much more stuff
- Possibly support running the game straight up from Bun without a web browser using C/Rust FFI for OpenGL/GLFW

## Core Utilities

This project heavily relies on several functional programming utilities:

- **[Maybe.ts](./src/shared/Maybe.ts)** - Optional value type for null safety, eliminating null/undefined checks.
- **[Pipe.ts](./src/shared/Pipe.ts)** - Functional composition utility for chaining operations
- **[AsyncPipe.ts](./src/shared/AsyncPipe.ts)** - Asynchronous version of Pipe for handling promises
- **[HashMap.ts](./src/shared/HashMap.ts)** - Type-safe hash map implementation with functional methods

Using normal `Map`, `undefined`, or `null` is discouraged in this project.
