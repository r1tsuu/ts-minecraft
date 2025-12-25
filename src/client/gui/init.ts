import { MathUtils } from 'three'

import type { GUI, MinecraftClient } from '../../types.ts'
import type { GUIActions, GUIConditions, GUIState as GUIState } from './state.ts'

import { synchronize } from './synchronize.ts'

export const initGUI = ({ minecraft }: { minecraft: MinecraftClient }): GUI => {
  const state: GUIState = {
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

  const setState = (newState: Partial<GUIState>, affectedQuerySelectors?: string | string[]) => {
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

  const resumeButton = document.querySelector<HTMLButtonElement>('[data-action="resumeGame"]')!

  const onPointerLockChange = () => {
    if (!minecraft.gameContext) return

    const isLocked = document.pointerLockElement === minecraft.gameContext.renderer.domElement

    if (!isLocked && !state.isPaused && minecraft.gameContext) {
      resumeButton.disabled = true
      setTimeout(() => {
        resumeButton.disabled = false
      }, 1000) // prevent immediate re-clicking

      minecraft.gameContext.player.isMovingBackward = false
      minecraft.gameContext.player.isMovingForward = false
      minecraft.gameContext.player.isMovingLeft = false
      minecraft.gameContext.player.isMovingRight = false

      setState({
        isPaused: true,
        pauseText: 'Click to Resume',
      })
      return
    }
  }

  const resumeGame = async () => {
    if (!minecraft.gameContext) return
    if (!state.isPaused) return

    try {
      await minecraft.gameContext.renderer.domElement.requestPointerLock()
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
    if (minecraft.gameContext && !state.isPaused) {
      if (!state.initializedGameUI) {
        setState({ initializedGameUI: true }) // Trigger UI to show game elements
      }

      setState(
        {
          fps: minecraft.gameContext.frameCounter.fps.toFixed(0),
          positionX: minecraft.gameContext.player.position.x.toFixed(),
          positionY: minecraft.gameContext.player.position.y.toFixed(),
          positionZ: minecraft.gameContext.player.position.z.toFixed(),
          rotationPitch: MathUtils.radToDeg(minecraft.gameContext.player.pitch).toFixed(),
          rotationYaw: MathUtils.radToDeg(minecraft.gameContext.player.yaw).toFixed(),
        },
        ['#fps', '#position', '#rotation'],
      )

      let performance: 'average' | 'bad' | 'good'

      if (minecraft.gameContext.frameCounter.fps < 30) {
        performance = 'bad'
      } else if (minecraft.gameContext.frameCounter.fps < 60) {
        performance = 'average'
      } else {
        performance = 'good'
      }

      document.getElementById('fps_value')!.setAttribute('data-performance', performance)
    }
  }, 300)

  const actions: GUIActions = {
    backToMenu: async () => {
      console.log('Exiting world...')
      await minecraft.eventQueue.emitAndWaitResponse('EXIT_WORLD', {}, 'EXITED_WORLD')
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
      const world = minecraft.localStorageManager.addWorld(name, seed)
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
      minecraft.localStorageManager.deleteWorld(world.uuid)
      setState({
        worldList: state.worldList.filter((w) => w.uuid !== world.uuid),
      })
    },
    playWorld: async ({ event }) => {
      const index = getIndexFromEvent(event)
      const world = state.worldList[index]
      setState({
        activePage: 'worldLoading',
        loadingWorldName: world.name,
      })
      await minecraft.eventQueue.emitAndWaitResponse(
        'JOIN_WORLD',
        {
          worldUUID: world.uuid,
        },
        'JOINED_WORLD',
      )
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

  const conditions: GUIConditions = {
    showCrosshair: () => minecraft.gameContext !== null && !state.isPaused,
    showGameUI: () => minecraft.gameContext !== null,
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
