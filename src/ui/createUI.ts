import { MathUtils } from 'three'

import type { MinecraftInstance, UIInstance } from '../types.ts'
import type { UIActions, UICondition, UIState } from './state.ts'

import { listenToWorkerEvents, sendEventToWorker } from '../worker/workerClient.ts'
import { synchronize } from './synchronize.ts'

export const createUI = ({
  minecraft,
  onCreateWorld,
  onDeleteWorld,
  onExitWorld,
  onWorldPlay,
}: {
  minecraft: MinecraftInstance
  onCreateWorld: (
    name: string,
    seed: string,
  ) => Promise<{
    createdAt: Date
    id: number
    name: string
    seed: string
  }>
  onDeleteWorld: (id: number) => Promise<void>
  onExitWorld: () => Promise<void>
  onWorldPlay: (id: number) => Promise<void>
}): UIInstance => {
  const state: UIState = {
    activePage: 'start',
    fps: 'Loading...',
    initializedGameUI: false,
    isInitialized: false,
    isPaused: false,
    loadingWorldName: '',
    pauseText: 'Press Escape to Pause',
    positionX: '',
    positionY: '',
    positionZ: '',
    rotationPitch: '',
    rotationYaw: '',
    worldList: [],
  }

  const setState = (newState: Partial<UIState>, affectedQuerySelectors?: string | string[]) => {
    Object.assign(state, newState)
    synchronize(state, actions, conditions, affectedQuerySelectors)
  }

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

  const worldNameInput = document.querySelector('input[name="worldName"]') as HTMLInputElement
  const worldSeedInput = document.querySelector('input[name="worldSeed"]') as HTMLInputElement

  const subscriptions: (() => void)[] = []

  subscriptions.push(
    listenToWorkerEvents((event) => {
      switch (event.type) {
        case 'listWorldsResponse': {
          setState({
            isInitialized: true,
            worldList: event.payload.worlds.map((world) => ({
              createdAt: new Date(world.createdAt).toLocaleString(),
              id: world.id,
              name: world.name,
              seed: world.seed,
            })),
          })
          break
        }
        case 'workerInitialized': {
          sendEventToWorker({ payload: {}, type: 'requestListWorlds' })
          break
        }
      }
    }),
  )

  const resumeButton = document.querySelector<HTMLButtonElement>('[data-action="resumeGame"]')!

  const onPointerLockChange = () => {
    if (!minecraft.game) return

    const isLocked = document.pointerLockElement === minecraft.game.renderer.domElement

    if (!isLocked && !state.isPaused && minecraft.game) {
      resumeButton.disabled = true
      setTimeout(() => {
        resumeButton.disabled = false
      }, 1000) // prevent immediate re-clicking

      minecraft.game.player.isMovingBackward = false
      minecraft.game.player.isMovingForward = false
      minecraft.game.player.isMovingLeft = false
      minecraft.game.player.isMovingRight = false

      setState({
        isPaused: true,
        pauseText: 'Click to Resume',
      })
      return
    }
  }

  const resumeGame = async () => {
    if (!minecraft.game) return
    if (!state.isPaused) return

    try {
      await minecraft.game.renderer.domElement.requestPointerLock()
      setState({
        isPaused: false,
        pauseText: 'Press Escape to Pause',
      })
    } catch (e) {
      console.warn('Pointer lock request failed', e)
    }
  }

  document.addEventListener('pointerlockchange', onPointerLockChange)

  subscriptions.push(() => {
    document.removeEventListener('pointerlockchange', onPointerLockChange)
  })

  const gameInterval = setInterval(() => {
    if (minecraft.game && !state.isPaused) {
      if (!state.initializedGameUI) {
        setState({ initializedGameUI: true }) // Trigger UI to show game elements
      }

      setState(
        {
          fps: minecraft.game.frameCounter.fps.toFixed(0),
          positionX: minecraft.game.player.position.x.toFixed(),
          positionY: minecraft.game.player.position.y.toFixed(),
          positionZ: minecraft.game.player.position.z.toFixed(),
          rotationPitch: MathUtils.radToDeg(minecraft.game.player.pitch).toFixed(),
          rotationYaw: MathUtils.radToDeg(minecraft.game.player.yaw).toFixed(),
        },
        ['#fps', '#position', '#rotation'],
      )

      let performance: 'average' | 'bad' | 'good'

      if (minecraft.game.frameCounter.fps < 30) {
        performance = 'bad'
      } else if (minecraft.game.frameCounter.fps < 60) {
        performance = 'average'
      } else {
        performance = 'good'
      }

      document.getElementById('fps_value')!.setAttribute('data-performance', performance)
    }
  }, 300)

  const actions: UIActions = {
    backToMenu: async () => {
      console.log('Exiting world...')
      await onExitWorld()
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
    },
    backToStart: () => {
      setState({ activePage: 'start' })
    },
    createWorld: async ({ event }) => {
      const button = getButtonFromEvent(event)

      const name = worldNameInput.value.trim() || 'New World'
      const seed = worldSeedInput.value.trim() || crypto.randomUUID()
      button.disabled = true
      const world = await onCreateWorld(name, seed)
      setState({
        worldList: [
          ...state.worldList,
          {
            createdAt: new Date(world.createdAt).toLocaleString(),
            id: world.id,
            name: world.name,
            seed: world.seed,
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
      onDeleteWorld(world.id)
      setState({
        worldList: state.worldList.filter((w) => w.id !== world.id),
      })
    },
    playWorld: async ({ event }) => {
      const index = getIndexFromEvent(event)
      const world = state.worldList[index]
      setState({
        activePage: 'worldLoading',
        loadingWorldName: world.name,
      })
      await onWorldPlay(world.id)
      setState({
        activePage: 'game',
        loadingWorldName: ' ',
      })
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

  const conditions: UICondition = {
    showCrosshair: () => minecraft.game !== null && !state.isPaused,
    showGameUI: () => minecraft.game !== null,
    showLoadingButton: () => state.isInitialized === false,
    showOverlay: () => ['menuWorlds', 'start', 'worldLoading'].includes(state.activePage),
    showPauseMenu: () => state.isPaused,
    showStartGameButton: () => state.isInitialized === true,
    showWorldsNotFound: () => state.worldList.length === 0,
  }

  synchronize(state, actions, conditions)

  return {
    destroy: () => {
      for (const unsubscribe of subscriptions) {
        unsubscribe()
      }

      clearInterval(gameInterval)
    },
    setState,
    state,
  }
}
