import { MathUtils } from 'three'

import type { MinecraftClient } from '../MinecraftClient.ts'
import type { GUIActions, GUIConditions, GUIState as GUIState } from './state.ts'

import { synchronize } from './synchronize.ts'

export class GUI {
  state: GUIState

  private actions: GUIActions
  private conditions: GUIConditions
  private dispositions: Function[] = []
  private gameInterval!: number
  private resumeButton: HTMLButtonElement
  private worldNameInput: HTMLInputElement
  private worldSeedInput: HTMLInputElement

  constructor(private readonly minecraft: MinecraftClient) {
    this.minecraft = minecraft

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
      worldList: minecraft.localStorageManager.getListWorlds(),
    }

    this.worldNameInput = document.querySelector('input[name="worldName"]') as HTMLInputElement
    this.worldSeedInput = document.querySelector('input[name="worldSeed"]') as HTMLInputElement
    this.resumeButton = document.querySelector<HTMLButtonElement>('[data-action="resumeGame"]')!

    this.actions = this.createActions()
    this.conditions = this.createConditions()

    this.setupEventListeners()
    this.startGameInterval()

    synchronize(this.state, this.actions, this.conditions)
  }

  dispose(): void {
    for (const dispose of this.dispositions) {
      dispose()
    }

    clearInterval(this.gameInterval)
  }

  getCanvas(): HTMLCanvasElement {
    return document.getElementById('game_canvas') as HTMLCanvasElement
  }

  setState(newState: Partial<GUIState>, affectedQuerySelectors?: string | string[]): void {
    Object.assign(this.state, newState)
    synchronize(this.state, this.actions, this.conditions, affectedQuerySelectors)
  }

  private createActions(): GUIActions {
    return {
      backToMenu: async () => {
        this.minecraft.eventQueue.emit('EXIT_WORLD', {})
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
        const world = this.minecraft.localStorageManager.addWorld(name, seed)
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
        this.minecraft.localStorageManager.deleteWorld(world.uuid)
        this.setState({
          worldList: this.state.worldList.filter((w) => w.uuid !== world.uuid),
        })
      },
      playWorld: async ({ event }) => {
        const index = this.getIndexFromEvent(event)
        const world = this.state.worldList[index]
        this.setState({
          activePage: 'worldLoading',
          loadingWorldName: world.name,
        })

        await this.minecraft.eventQueue.emitAndWaitResponse(
          'JOIN_WORLD',
          {
            worldUUID: world.uuid,
          },
          'JOINED_WORLD',
        )

        console.log('Joined world:', world.name)

        this.setState({
          activePage: 'game',
          loadingWorldName: ' ',
        })
        this.minecraft
          .getGameSession()
          .renderer.domElement.requestPointerLock()
          .catch((e) => {
            console.warn('Pointer lock request failed', e)
          })
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
      showCrosshair: () => this.minecraft.gameSession !== null && !this.state.isPaused,
      showGameUI: () => this.minecraft.gameSession !== null,
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
    if (!this.minecraft.gameSession) return

    const isLocked = document.pointerLockElement === this.minecraft.gameSession.renderer.domElement

    if (!isLocked && !this.state.isPaused && this.minecraft.gameSession) {
      this.resumeButton.disabled = true
      setTimeout(() => {
        this.resumeButton.disabled = false
      }, 1000)

      this.minecraft.gameSession.player.isMovingBackward = false
      this.minecraft.gameSession.player.isMovingForward = false
      this.minecraft.gameSession.player.isMovingLeft = false
      this.minecraft.gameSession.player.isMovingRight = false

      this.setState({
        isPaused: true,
        pauseText: 'Click to Resume',
      })
      return
    }
  }

  private async resumeGame(): Promise<void> {
    if (!this.minecraft.gameSession) return
    if (!this.state.isPaused) return

    try {
      await this.minecraft.gameSession.renderer.domElement.requestPointerLock()
      this.setState({
        isPaused: false,
        pauseText: 'Press Escape to Pause',
      })
    } catch (e) {
      console.warn('Pointer lock request failed', e)
    }
  }

  private setupEventListeners(): void {
    document.addEventListener('pointerlockchange', this.onPointerLockChange)

    this.dispositions.push(() => {
      document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    })
  }

  private startGameInterval(): void {
    this.gameInterval = setInterval(() => {
      if (this.minecraft.gameSession && !this.state.isPaused) {
        if (!this.state.initializedGameUI) {
          this.setState({ initializedGameUI: true })
        }

        this.setState(
          {
            fps: this.minecraft.gameSession.frameCounter.fps.toFixed(0),
            positionX: this.minecraft.gameSession.player.position.x.toFixed(),
            positionY: this.minecraft.gameSession.player.position.y.toFixed(),
            positionZ: this.minecraft.gameSession.player.position.z.toFixed(),
            rotationPitch: MathUtils.radToDeg(this.minecraft.gameSession.player.pitch).toFixed(),
            rotationYaw: MathUtils.radToDeg(this.minecraft.gameSession.player.yaw).toFixed(),
          },
          ['#fps', '#position', '#rotation'],
        )

        let performance: 'average' | 'bad' | 'good'

        if (this.minecraft.gameSession.frameCounter.fps < 30) {
          performance = 'bad'
        } else if (this.minecraft.gameSession.frameCounter.fps < 60) {
          performance = 'average'
        } else {
          performance = 'good'
        }

        document.getElementById('fps_value')!.setAttribute('data-performance', performance)
      }
    }, 300)
  }
}
