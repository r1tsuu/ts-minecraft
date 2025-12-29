import type { UUID } from '../types.ts'

import { Maybe } from './Maybe.ts'

const isCanceledSymbol = Symbol('isCanceled')

type BaseMeta = {
  timestamp: number
  uuid: Maybe<UUID>
}

export abstract class Event<Meta extends object> {
  static readonly type: string
  eventMetadata: BaseMeta & Meta = {
    timestamp: Date.now(),
    uuid: Maybe.None<UUID>(),
  } as BaseMeta & Meta
  private [isCanceledSymbol] = false

  cancel() {
    this[isCanceledSymbol] = true
  }

  isCanceled(): boolean {
    return this[isCanceledSymbol]
  }

  abstract serialize(): any
}
