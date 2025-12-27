import { ClientContainer } from './client/ClientContainer.ts'
import { MinecraftClient } from './client/MinecraftClient.ts'
window.container = ClientContainer
new MinecraftClient()
