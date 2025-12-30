import * as THREE from 'three'

import type { MinecraftClient } from '../MinecraftClient.ts'
import type { GUIActions, GUIConditions, GUIState as GUIState } from './state.ts'

import { ExitWorld } from '../../shared/events/client/ExitWorld.ts'
import { JoinedWorld } from '../../shared/events/client/JoinedWorld.ts'
import { JoinWorld } from '../../shared/events/client/JoinWorld.ts'
import { PauseToggle } from '../../shared/events/client/PauseToggle.ts'
import { eventBus, Handler, Listener } from '../../shared/MinecraftEventBus.ts'
import { Schedulable, ScheduleTask } from '../../shared/Scheduler.ts'
import { synchronize } from './synchronize.ts'

@Listener()
@Schedulable()
export class GUI {
  state: GUIState
  private actions: GUIActions
  private conditions: GUIConditions
  private dispositions: Function[] = []
  private resumeButton: HTMLButtonElement
  private worldNameInput: HTMLInputElement
  private worldSeedInput: HTMLInputElement

  constructor(private readonly client: MinecraftClient) {
    this.state = {
      activePage: 'start',
      fps: 'Loading...',
      initializedGameUI: false,
      isPaused: false,
      loadingWorldName: '',
      pauseText: 'Press Escape to Pause',
      positionX: '',
      positionY: '',
      positionZ: '',
      rotationPitch: '',
      rotationYaw: '',
      worldList: this.client.localStorageManager.getListWorlds(),
    }

    this.worldNameInput = document.querySelector('input[name="worldName"]') as HTMLInputElement
    this.worldSeedInput = document.querySelector('input[name="worldSeed"]') as HTMLInputElement
    this.resumeButton = document.querySelector<HTMLButtonElement>('[data-action="resumeGame"]')!

    this.actions = this.createActions()
    this.conditions = this.createConditions()

    document.addEventListener('pointerlockchange', this.onPointerLockChange)

    this.dispositions.push(() => {
      document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    })

    synchronize(this.state, this.actions, this.conditions)
  }

  dispose(): void {
    for (const dispose of this.dispositions) {
      dispose()
    }
  }

  getCanvas(): HTMLCanvasElement {
    return document.getElementById('game_canvas') as HTMLCanvasElement
  }

  setState(newState: Partial<GUIState>, affectedQuerySelectors?: string | string[]): void {
    Object.assign(this.state, newState)
    synchronize(this.state, this.actions, this.conditions, affectedQuerySelectors)
  }

  @Handler(JoinedWorld)
  protected onJoinedWorld(): void {
    this.setState({
      activePage: 'game',
      loadingWorldName: ' ',
    })

    this.getCanvas()
      .requestPointerLock()
      .catch((e) => {
        console.warn('Pointer lock request failed', e)
      })

    this.onResizeSyncRenderer()
    window.addEventListener('resize', this.onResizeSyncRenderer)
  }

  @ScheduleTask(200)
  protected updateGameUI(): void {
    if (!this.client.gameLoop.isSome() || this.state.isPaused) return

    if (!this.state.initializedGameUI) {
      this.setState({ initializedGameUI: true })
    }

    const gameLoop = this.client.gameLoop.value()

    const player = gameLoop.getClientPlayer()
    this.setState(
      {
        fps: gameLoop.frameCounter.fps.toFixed(0),
        positionX: player.position.x.toFixed(),
        positionY: player.position.y.toFixed(),
        positionZ: player.position.z.toFixed(),
        rotationPitch: THREE.MathUtils.radToDeg(player.rotation.x).toFixed(),
        rotationYaw: THREE.MathUtils.radToDeg(player.rotation.y).toFixed(),
      },

      ['#fps', '#position', '#rotation'],
    )

    let performance: 'average' | 'bad' | 'good'

    if (gameLoop.frameCounter.fps < 30) {
      performance = 'bad'
    } else if (gameLoop.frameCounter.fps < 60) {
      performance = 'average'
    } else {
      performance = 'good'
    }

    document.getElementById('fps_value')!.setAttribute('data-performance', performance)
  }

  private createActions(): GUIActions {
    return {
      backToMenu: () => {
        eventBus.publish(new ExitWorld())
        this.setState({
          activePage: 'start',
          fps: 'Loading...',
          initializedGameUI: false,
          isPaused: false,
          positionX: '',
          positionY: '',
          positionZ: '',
          rotationPitch: '',
          rotationYaw: '',
        })
        window.removeEventListener('resize', this.onResizeSyncRenderer)
      },
      backToStart: () => {
        this.setState({ activePage: 'start' })
      },
      createWorld: async ({ event }) => {
        const button = this.getButtonFromEvent(event)

        const name = this.worldNameInput.value.trim() || 'New World'
        const seed = this.worldSeedInput.value.trim() || crypto.randomUUID()
        button.disabled = true
        const world = this.client.localStorageManager.addWorld(name, seed)
        this.setState({
          worldList: [
            ...this.state.worldList,
            {
              createdAt: new Date(world.createdAt).toLocaleString(),
              name: world.name,
              seed: world.seed,
              uuid: world.uuid,
            },
          ],
        })
        button.disabled = false
        this.worldNameInput.value = 'New World'
        this.worldSeedInput.value = crypto.randomUUID().slice(0, 8)
      },
      deleteWorld: async ({ event }) => {
        const index = this.getIndexFromEvent(event)
        const world = this.state.worldList[index]
        this.client.localStorageManager.deleteWorld(world.uuid)
        this.setState({
          worldList: this.state.worldList.filter((w) => w.uuid !== world.uuid),
        })
      },
      playWorld: ({ event }) => {
        const index = this.getIndexFromEvent(event)
        const world = this.state.worldList[index]
        this.setState({
          activePage: 'worldLoading',
          loadingWorldName: world.name,
        })

        eventBus.publish(new JoinWorld(world.uuid))
      },
      resumeGame: async () => {
        await this.resumeGame()
      },
      startGame: () => {
        this.worldNameInput.value = 'New World'
        this.worldSeedInput.value = crypto.randomUUID().slice(0, 8)
        this.setState({ activePage: 'menuWorlds' })
      },
    }
  }

  private createConditions(): GUIConditions {
    return {
      showCrosshair: () => this.client.gameLoop.isSome() && !this.state.isPaused,
      showGameUI: () => this.client.gameLoop.isSome(),
      showOverlay: () => ['menuWorlds', 'start', 'worldLoading'].includes(this.state.activePage),
      showPauseMenu: () => this.state.isPaused,
      showWorldsNotFound: () => this.state.worldList.length === 0,
    }
  }

  private getButtonFromEvent(event: MouseEvent): HTMLButtonElement {
    return event.currentTarget as HTMLButtonElement
  }

  private getIndexFromEvent(event: MouseEvent): number {
    const button = this.getButtonFromEvent(event)
    const indexAttr = button.getAttribute('data-index')
    const index = indexAttr ? parseInt(indexAttr, 10) : null

    if (index !== null && !isNaN(index)) {
      return index
    }

    throw new Error('Invalid index attribute')
  }

  private onPointerLockChange = (): void => {
    const gameLoop = this.client.gameLoop

    if (gameLoop.isNone()) return

    const isLocked = document.pointerLockElement === this.getCanvas()

    if (!isLocked && !this.state.isPaused) {
      this.resumeButton.disabled = true
      setTimeout(() => {
        this.resumeButton.disabled = false
      }, 1000)

      console.log('Game paused due to pointer lock loss')

      this.setState({
        isPaused: true,
        pauseText: 'Click to Resume',
      })

      eventBus.publish(new PauseToggle())
      return
    }
  }

  private onResizeSyncRenderer = () => {
    this.client.gameLoop
      .map((game) => game.renderer)
      .tap((renderer) => renderer.setSize(window.innerWidth, window.innerHeight))
  }

  private async resumeGame(): Promise<void> {
    if (this.client.gameLoop.isNone()) return

    if (!this.state.isPaused) return

    try {
      await this.getCanvas().requestPointerLock()
      this.setState({
        isPaused: false,
        pauseText: 'Press Escape to Pause',
      })
      eventBus.publish(new PauseToggle())
    } catch (e) {
      console.warn('Pointer lock request failed', e)
    }
  }
}
