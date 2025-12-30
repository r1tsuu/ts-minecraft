import { BlocksRegistry } from '../../shared/BlocksRegistry.ts'
import { Config } from '../../shared/Config.ts'
import { PauseToggle } from '../../shared/events/client/PauseToggle.ts'
import { MinecraftEventBus } from '../../shared/MinecraftEventBus.ts'
import { System, SystemRegistry } from '../../shared/System.ts'
import { Throttle } from '../../shared/util.ts'
import { ClientContainer } from '../ClientContainer.ts'
import { GameSession } from '../GameSession.ts'
import { InputManager } from '../InputManager.ts'
import { World_Legacy } from '../WorldLegacy.ts'
import { PlayerUpdateSystem } from './PlayerUpdateSystem.ts'
import { RaycastingSystem } from './RaycastingSystem.ts'

@MinecraftEventBus.ClientListener()
export class SessionPlayerControlSystem extends System {
  private static readonly THROTTLE_DELAY_MS = 500
  private readonly gameSession = ClientContainer.resolve(GameSession).unwrap()
  private readonly inputManager = ClientContainer.resolve(InputManager).unwrap()
  private readonly playerUpdateSystem = ClientContainer.resolve(SystemRegistry)
    .andThen((registry) => registry.getSystem(PlayerUpdateSystem))
    .unwrap()

  @System.Update()
  update(): void {
    const mouseMove = this.inputManager.getMouseDelta()

    const player = this.gameSession.getSessionPlayer()

    player.rotation.y -= mouseMove.deltaX * Config.MOUSE_SENSITIVITY
    player.rotation.x -= mouseMove.deltaY * Config.MOUSE_SENSITIVITY

    player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x)) // Clamp the pitch between -90 and 90 degrees
    // clamp Y value
    if (player.rotation.y < 0) {
      player.rotation.y += Math.PI * 2
    } else if (player.rotation.y >= Math.PI * 2) {
      player.rotation.y -= Math.PI * 2
    }

    this.playerUpdateSystem.setMovingLeft(player, this.inputManager.isKeyPressed('KeyA'))
    this.playerUpdateSystem.setMovingRight(player, this.inputManager.isKeyPressed('KeyD'))
    this.playerUpdateSystem.setMovingBackward(player, this.inputManager.isKeyPressed('KeyS'))
    this.playerUpdateSystem.setMovingForward(player, this.inputManager.isKeyPressed('KeyW'))

    if (this.inputManager.isKeyPressed('Space')) {
      this.playerUpdateSystem.tryJump(player)
    }

    if (this.inputManager.isPressedLeftMouse()) {
      this.handleBlockRemove()
    }

    if (this.inputManager.isPressedRightMouse()) {
      this.handleBlockPlace()
    }
  }

  @MinecraftEventBus.Handler(PauseToggle)
  protected onPauseToggle(): void {
    const player = ClientContainer.resolve(GameSession).unwrap().getSessionPlayer()
    const playerUpdateSystem = ClientContainer.resolve(SystemRegistry)
      .andThen((registry) => registry.getSystem(PlayerUpdateSystem))
      .unwrap()

    const state = playerUpdateSystem.getMovementState(player)

    state.movingLeft = false
    state.movingRight = false
    state.movingBackward = false
    state.movingForward = false
  }

  @Throttle(SessionPlayerControlSystem.THROTTLE_DELAY_MS)
  private handleBlockPlace(): void {
    const world = ClientContainer.resolve(World_Legacy).unwrap()
    const raycaster = ClientContainer.resolve(RaycastingSystem).unwrap()
    const blocksRegistry = ClientContainer.resolve(BlocksRegistry).unwrap()

    if (raycaster.lookingAtBlock && raycaster.lookingAtNormal) {
      const blockToPlace = blocksRegistry.getBlockIdByName('grass')

      world.addBlock(
        raycaster.lookingAtBlock.x + raycaster.lookingAtNormal.x,
        raycaster.lookingAtBlock.y + raycaster.lookingAtNormal.y,
        raycaster.lookingAtBlock.z + raycaster.lookingAtNormal.z,
        blockToPlace,
      )
    }
  }

  @Throttle(SessionPlayerControlSystem.THROTTLE_DELAY_MS)
  private handleBlockRemove(): void {
    const world = ClientContainer.resolve(World_Legacy).unwrap()
    const raycaster = ClientContainer.resolve(RaycastingSystem).unwrap()

    if (raycaster.lookingAtBlock) {
      world.removeBlock(
        raycaster.lookingAtBlock.x,
        raycaster.lookingAtBlock.y,
        raycaster.lookingAtBlock.z,
      )
    }
  }
}
