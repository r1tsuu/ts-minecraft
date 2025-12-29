import { Event } from './Event.ts'

export type MinecraftEventMetadata = {
  environment: 'Client' | 'Server'
  isForwarded: boolean
}

export abstract class MinecraftEvent extends Event<MinecraftEventMetadata> {}
