// import type { UUID } from '../types.ts'

// import { chain } from './Chain.ts'
// import { Chunk } from './entities/Chunk.ts'
// import { Maybe } from './Maybe.ts'
// import { apply, mapDecoder, mapEncoder } from './util.ts'

// type MinecraftEventMetadata = {
//   environment: 'Client' | 'Server'
//   isForwarded: boolean
// }

// const isCanceledSymbol = Symbol('isCanceled')

// type BaseMeta = {
//   timestamp: number
//   uuid: Maybe<UUID>
// }

// export abstract class Event<Meta extends object> {
//   eventMetadata: BaseMeta & Meta = {
//     timestamp: Date.now(),
//     uuid: Maybe.None<UUID>(),
//   } as BaseMeta & Meta

//   abstract readonly type: string
//   private [isCanceledSymbol] = false

//   cancel() {
//     this[isCanceledSymbol] = true
//   }

//   isCanceled(): boolean {
//     return this[isCanceledSymbol]
//   }

//   abstract serialize(): any
// }

// export abstract class MinecraftEvent extends Event<MinecraftEventMetadata> {}

// export class ResponseChunksLoad extends MinecraftEvent {
//   readonly type = 'Server.ResponseChunksLoad'

//   constructor(readonly chunks: Map<string, Chunk>) {
//     super()
//   }

//   static deserialize(obj: any): ResponseChunksLoad {
//     return chain(obj.chunks)
//       .map(apply(mapDecoder, Chunk.deserialize))
//       .map((chunks) => new ResponseChunksLoad(chunks))
//       .unwrap()
//   }

//   serialize() {
//     return chain(this.chunks)
//       .map(apply(mapEncoder, (chunk: Chunk) => chunk.serialize()))
//       .map((chunks) => ({ chunks }))
//       .unwrap()
//   }
// }
