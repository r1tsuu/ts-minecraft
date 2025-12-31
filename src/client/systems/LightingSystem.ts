import { AmbientLight, Color, DirectionalLight, Fog } from 'three'

import { createSystemFactory } from './createSystem.ts'

// TODO: Expand light system to handle dynamic lights, day-night cycle, etc, for now its dumb
export const lightingSystemFactory = createSystemFactory((ctx) => {
  const backgroundColor = 0x87ceeb

  ctx.scene.fog = new Fog(backgroundColor, 1, 96)
  ctx.scene.background = new Color(backgroundColor)

  const sunLight = new DirectionalLight(0xffffff, 3)
  sunLight.position.set(500, 500, 500)
  ctx.scene.add(sunLight)
  const sunLight2 = new DirectionalLight(0xffffff, 3)
  sunLight2.position.set(-500, 500, -500)
  ctx.scene.add(sunLight2)

  const reflectionLight = new AmbientLight(0x404040, 0.5)
  ctx.scene.add(reflectionLight)

  return {
    name: 'LightingSystem',
  }
})
