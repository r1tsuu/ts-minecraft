import * as THREE from 'three'

import type { GUIActions, GUIConditions, GUIState as GUIState } from './state.ts'

import { MinecraftEventQueue } from '../../queue/MinecraftQueue.ts'
import { Scheduler } from '../../shared/Scheduler.ts'
import { ClientContainer } from '../ClientContainer.ts'
import { GameSession } from '../GameSession.ts'
import { LocalStorageManager } from '../LocalStorageManager.ts'
import { synchronize } from './synchronize.ts'

export class GUI {
  state: GUIState

  private actions: GUIActions
  private conditions: GUIConditions
  private dispositions: Function[] = []
  private resumeButton: HTMLButtonElement
  private worldNameInput: HTMLInputElement
  private worldSeedInput: HTMLInputElement

  constructor() {
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
      worldList: ClientContainer.resolve(LocalStorageManager).unwrap().getListWorlds(),
    }

    this.worldNameInput = document.querySelector('input[name="worldName"]') as HTMLInputElement
    this.worldSeedInput = document.querySelector('input[name="worldSeed"]') as HTMLInputElement
    this.resumeButton = document.querySelector<HTMLButtonElement>('[data-action="resumeGame"]')!

    this.actions = this.createActions()
    this.conditions = this.createConditions()

    this.setupEventListeners()
    ClientContainer.resolve(Scheduler).unwrap().registerInstance(this)

    synchronize(this.state, this.actions, this.conditions)
  }

  dispose(): void {
    for (const dispose of this.dispositions) {
      dispose()
    }

    MinecraftEventQueue.unregisterHandlers(this)
    ClientContainer.resolve(Scheduler).unwrap().unregisterInstance(this)
  }

  getCanvas(): HTMLCanvasElement {
    return document.getElementById('game_canvas') as HTMLCanvasElement
  }

  setState(newState: Partial<GUIState>, affectedQuerySelectors?: string | string[]): void {
    Object.assign(this.state, newState)
    synchronize(this.state, this.actions, this.conditions, affectedQuerySelectors)
  }

  @MinecraftEventQueue.Handler('Client.JoinedWorld')
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
  }

  @Scheduler.Every(200)
  protected updateGameUI(): void {
    const gameSession = ClientContainer.resolve(GameSession)
    if (gameSession.isNone() || this.state.isPaused) return

    if (!this.state.initializedGameUI) {
      this.setState({ initializedGameUI: true })
    }

    const player = gameSession.value.getCurrentPlayer()
    this.setState(
      {
        fps: gameSession.value.frameCounter.fps.toFixed(0),
        positionX: player.position.x.toFixed(),
        positionY: player.position.y.toFixed(),
        positionZ: player.position.z.toFixed(),
        rotationPitch: THREE.MathUtils.radToDeg(player.rotation.x).toFixed(),
        rotationYaw: THREE.MathUtils.radToDeg(player.rotation.y).toFixed(),
      },

      ['#fps', '#position', '#rotation'],
    )

    let performance: 'average' | 'bad' | 'good'

    if (gameSession.value.frameCounter.fps < 30) {
      performance = 'bad'
    } else if (gameSession.value.frameCounter.fps < 60) {
      performance = 'average'
    } else {
      performance = 'good'
    }

    document.getElementById('fps_value')!.setAttribute('data-performance', performance)
  }

  private createActions(): GUIActions {
    const eventQueue = ClientContainer.resolve(MinecraftEventQueue).unwrap()
    const localStorageManager = ClientContainer.resolve(LocalStorageManager).unwrap()
    return {
      backToMenu: () => {
        eventQueue.emit('Client.ExitWorld', {})
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
      },
      backToStart: () => {
        this.setState({ activePage: 'start' })
      },
      createWorld: async ({ event }) => {
        const button = this.getButtonFromEvent(event)

        const name = this.worldNameInput.value.trim() || 'New World'
        const seed = this.worldSeedInput.value.trim() || crypto.randomUUID()
        button.disabled = true
        const world = localStorageManager.addWorld(name, seed)
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
        localStorageManager.deleteWorld(world.uuid)
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

        eventQueue.emit('Client.JoinWorld', { worldUUID: world.uuid })
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
      showCrosshair: () => ClientContainer.resolve(GameSession).isSome() && !this.state.isPaused,
      showGameUI: () => ClientContainer.resolve(GameSession).isSome(),
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
    const gameSession = ClientContainer.resolve(GameSession)
    const eventQueue = ClientContainer.resolve(MinecraftEventQueue).unwrap()

    if (gameSession.isNone()) return

    const isLocked = document.pointerLockElement === this.getCanvas()

    if (!isLocked && !this.state.isPaused && gameSession) {
      this.resumeButton.disabled = true
      setTimeout(() => {
        this.resumeButton.disabled = false
      }, 1000)

      this.setState({
        isPaused: true,
        pauseText: 'Click to Resume',
      })

      eventQueue.emit('Client.PauseToggle', {})
      return
    }
  }

  private async resumeGame(): Promise<void> {
    const gameSession = ClientContainer.resolve(GameSession)
    if (gameSession.isNone()) return

    const eventQueue = ClientContainer.resolve(MinecraftEventQueue).unwrap()
    if (!this.state.isPaused) return

    try {
      await this.getCanvas().requestPointerLock()
      this.setState({
        isPaused: false,
        pauseText: 'Press Escape to Pause',
      })
      eventQueue.emit('Client.PauseToggle', {})
    } catch (e) {
      console.warn('Pointer lock request failed', e)
    }
  }

  private setupEventListeners(): void {
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    ClientContainer.resolve(MinecraftEventQueue).unwrap().registerHandlers(this)

    this.dispositions.push(() => {
      document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    })
  }
}
