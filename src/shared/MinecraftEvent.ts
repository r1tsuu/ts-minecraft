import { Event, type EventMetadata } from './Event.ts'

export type MinecraftEventMetadata = MinecraftEvent['metadata']

export abstract class MinecraftEvent extends Event<
  {
    environment: 'Client' | 'Server'
    isForwarded: boolean
  } & EventMetadata
> {}
