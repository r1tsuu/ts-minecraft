import { initMinecraftClient } from './client/init.ts'

// for debugging
;(window as any)['MINECRAFT_CLIENT'] = initMinecraftClient()
