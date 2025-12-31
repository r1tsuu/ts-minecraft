import * as THREE from 'three'

import type { Maybe } from '../../shared/Maybe.ts'
import type { MinecraftEventBus } from '../../shared/MinecraftEventBus.ts'
import type { Callback } from '../../shared/util.ts'
import type { GameLoop } from '../GameLoop.ts'
import type { LocalStorageManager } from '../LocalStorageManager.ts'
import type { GUIActions, GUIConditions, GUIState as GUIState } from './state.ts'

import { ExitWorld } from '../../shared/events/client/ExitWorld.ts'
import { JoinedWorld } from '../../shared/events/client/JoinedWorld.ts'
import { JoinWorld } from '../../shared/events/client/JoinWorld.ts'
import { PauseToggle } from '../../shared/events/client/PauseToggle.ts'
import { synchronize } from './synchronize.ts'

const getButtonFromEvent = (event: MouseEvent): HTMLButtonElement => {
  return event.currentTarget as HTMLButtonElement
}

const getIndexFromEvent = (event: MouseEvent): number => {
  const button = getButtonFromEvent(event)
  const indexAttr = button.getAttribute('data-index')
  const index = indexAttr ? parseInt(indexAttr, 10) : null

  if (index !== null && !isNaN(index)) {
    return index
  }

  throw new Error('Invalid index attribute')
}

const getCanvas = (): HTMLCanvasElement => {
  return document.getElementById('game_canvas') as HTMLCanvasElement
}

export type GUI = ReturnType<typeof createGUI>

export const createGUI = ({
  eventBus,
  getGameLoop,
  localStorageManager,
}: {
  eventBus: MinecraftEventBus
  getGameLoop: () => Maybe<GameLoop>
  localStorageManager: LocalStorageManager
}) => {
  const state: GUIState = {
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
    worldList: localStorageManager.getListWorlds(),
  }

  const onResizeSyncRenderer = () =>
    getGameLoop().tap((gameLoop) => gameLoop.setRendererSize(window.innerWidth, window.innerHeight))

  const worldNameInput = document.querySelector('input[name="worldName"]') as HTMLInputElement
  const worldSeedInput = document.querySelector('input[name="worldSeed"]') as HTMLInputElement
  const resumeButton = document.querySelector<HTMLButtonElement>('[data-action="resumeGame"]')!

  const resumeGame = async (): Promise<void> => {
    if (getGameLoop().isNone()) return

    if (!state.isPaused) return

    try {
      await getCanvas().requestPointerLock()
      setState({
        isPaused: false,
        pauseText: 'Press Escape to Pause',
      })
      eventBus.publish(new PauseToggle())
    } catch (e) {
      console.warn('Pointer lock request failed', e)
    }
  }

  const actions: GUIActions = {
    backToMenu: () => {
      eventBus.publish(new ExitWorld())
      setState({
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
      window.removeEventListener('resize', onResizeSyncRenderer)
    },
    backToStart: () => {
      setState({ activePage: 'start' })
    },
    createWorld: async ({ event }) => {
      const button = getButtonFromEvent(event)

      const name = worldNameInput.value.trim() || 'New World'
      const seed = worldSeedInput.value.trim() || crypto.randomUUID()
      button.disabled = true
      const world = localStorageManager.addWorld(name, seed)
      setState({
        worldList: [
          ...state.worldList,
          {
            createdAt: new Date(world.createdAt).toLocaleString(),
            name: world.name,
            seed: world.seed,
            uuid: world.uuid,
          },
        ],
      })
      button.disabled = false
      worldNameInput.value = 'New World'
      worldSeedInput.value = crypto.randomUUID().slice(0, 8)
    },
    deleteWorld: async ({ event }) => {
      const index = getIndexFromEvent(event)
      const world = state.worldList[index]
      localStorageManager.deleteWorld(world.uuid)
      setState({
        worldList: state.worldList.filter((w) => w.uuid !== world.uuid),
      })
    },
    playWorld: ({ event }) => {
      const index = getIndexFromEvent(event)
      const world = state.worldList[index]
      setState({
        activePage: 'worldLoading',
        loadingWorldName: world.name,
      })

      eventBus.publish(new JoinWorld(world.uuid))
    },
    resumeGame: async () => {
      await resumeGame()
    },
    startGame: () => {
      worldNameInput.value = 'New World'
      worldSeedInput.value = crypto.randomUUID().slice(0, 8)
      setState({ activePage: 'menuWorlds' })
    },
  }

  const conditions: GUIConditions = {
    showCrosshair: () => getGameLoop().isSome() && !state.isPaused,
    showGameUI: () => getGameLoop().isSome(),
    showOverlay: () => ['menuWorlds', 'start', 'worldLoading'].includes(state.activePage),
    showPauseMenu: () => state.isPaused,
    showWorldsNotFound: () => state.worldList.length === 0,
  }

  const setState = (
    newState: Partial<GUIState>,
    affectedQuerySelectors?: string | string[],
  ): void => {
    Object.assign(state, newState)
    synchronize(state, actions, conditions, affectedQuerySelectors)
  }

  const updateGameUI = (): void => {
    const maybeGameLoop = getGameLoop()
    if (!maybeGameLoop.isSome() || state.isPaused) return

    if (!state.initializedGameUI) {
      setState({ initializedGameUI: true })
    }

    const gameLoop = maybeGameLoop.value()

    const player = gameLoop.getClientPlayer()

    const frameCounter = gameLoop.getFrameCounter()

    setState(
      {
        fps: frameCounter.fps.toFixed(0),
        positionX: player.position.x.toFixed(),
        positionY: player.position.y.toFixed(),
        positionZ: player.position.z.toFixed(),
        rotationPitch: THREE.MathUtils.radToDeg(player.rotation.x).toFixed(),
        rotationYaw: THREE.MathUtils.radToDeg(player.rotation.y).toFixed(),
      },

      ['#fps', '#position', '#rotation'],
    )

    let performance: 'average' | 'bad' | 'good'

    if (frameCounter.fps < 30) {
      performance = 'bad'
    } else if (frameCounter.fps < 60) {
      performance = 'average'
    } else {
      performance = 'good'
    }

    document.getElementById('fps_value')!.setAttribute('data-performance', performance)
  }

  const onPointerLockChange = (): void => {
    const maybeGameLoop = getGameLoop()

    if (maybeGameLoop.isNone()) return

    const isLocked = document.pointerLockElement === getCanvas()

    if (!isLocked && !state.isPaused) {
      resumeButton.disabled = true
      setTimeout(() => {
        resumeButton.disabled = false
      }, 1000)

      console.log('Game paused due to pointer lock loss')

      setState({
        isPaused: true,
        pauseText: 'Click to Resume',
      })

      eventBus.publish(new PauseToggle())
      return
    }
  }

  const dispositions: Callback[] = []

  document.addEventListener('pointerlockchange', onPointerLockChange)
  dispositions.push(() => {
    document.removeEventListener('pointerlockchange', onPointerLockChange)
  })

  dispositions.push(
    eventBus.subscribe(JoinedWorld, () => {
      setState({
        activePage: 'game',
        loadingWorldName: ' ',
      })

      getCanvas()
        .requestPointerLock()
        .catch((e) => {
          console.warn('Pointer lock request failed', e)
        })

      onResizeSyncRenderer()
      window.addEventListener('resize', onResizeSyncRenderer)
    }),
  )

  const interval = setInterval(updateGameUI, 200)
  dispositions.push(() => {
    clearInterval(interval)
  })

  return {
    dispose: (): void => {
      for (const dispose of dispositions) {
        dispose()
      }
    },
    getCanvas,
  }
}
