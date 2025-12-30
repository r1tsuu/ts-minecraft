import { BlocksRegistry } from '../../shared/BlocksRegistry.ts'
import { Config } from '../../shared/Config.ts'
import { PauseToggle } from '../../shared/events/client/PauseToggle.ts'
import { Listener, MinecraftEventBus } from '../../shared/MinecraftEventBus.ts'
import { System } from '../../shared/System.ts'
import { Throttle } from '../../shared/util.ts'
import { GameSession } from '../GameSession.ts'
import { PlayerUpdateSystem } from './PlayerUpdateSystem.ts'
import { RaycastingSystem } from './RaycastingSystem.ts'

@Listener()
export class SessionPlayerControlSystem extends System {
  private static readonly THROTTLE_DELAY_MS = 500

  constructor(
    private readonly gameSession: GameSession,
    private readonly blocksRegistry: BlocksRegistry,
    private readonly playerUpdateSystem: PlayerUpdateSystem,
    private readonly raycastingSystem: RaycastingSystem,
  ) {
    super()
  }

  @System.Update()
  update(): void {
    const inputManager = this.gameSession.inputManager
    const mouseMove = inputManager.getMouseDelta()

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

    this.playerUpdateSystem.setMovingLeft(player, inputManager.isKeyPressed('KeyA'))
    this.playerUpdateSystem.setMovingRight(player, inputManager.isKeyPressed('KeyD'))
    this.playerUpdateSystem.setMovingBackward(player, inputManager.isKeyPressed('KeyS'))
    this.playerUpdateSystem.setMovingForward(player, inputManager.isKeyPressed('KeyW'))

    if (inputManager.isKeyPressed('Space')) {
      this.playerUpdateSystem.tryJump(player)
    }

    if (inputManager.isPressedLeftMouse()) {
      this.handleBlockRemove()
    }

    if (inputManager.isPressedRightMouse()) {
      this.handleBlockPlace()
    }
  }

  @MinecraftEventBus.Handler(PauseToggle)
  protected onPauseToggle(): void {
    const player = this.gameSession.getSessionPlayer()

    const state = this.playerUpdateSystem.getMovementState(player)

    state.movingLeft = false
    state.movingRight = false
    state.movingBackward = false
    state.movingForward = false
  }

  @Throttle(SessionPlayerControlSystem.THROTTLE_DELAY_MS)
  private handleBlockPlace(): void {
    const raycaster = this.raycastingSystem
    if (raycaster.lookingAtBlock && raycaster.lookingAtNormal) {
      const blockToPlace = this.blocksRegistry.getBlockIdByName('grass')

      this.gameSession.world.addBlock(
        raycaster.lookingAtBlock.x + raycaster.lookingAtNormal.x,
        raycaster.lookingAtBlock.y + raycaster.lookingAtNormal.y,
        raycaster.lookingAtBlock.z + raycaster.lookingAtNormal.z,
        blockToPlace,
      )
    }
  }

  @Throttle(SessionPlayerControlSystem.THROTTLE_DELAY_MS)
  private handleBlockRemove(): void {
    const raycaster = this.raycastingSystem

    if (raycaster.lookingAtBlock) {
      this.gameSession.world.removeBlock(
        raycaster.lookingAtBlock.x,
        raycaster.lookingAtBlock.y,
        raycaster.lookingAtBlock.z,
      )
    }
  }
}
