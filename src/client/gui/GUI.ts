import { MathUtils } from 'three'

import type { Maybe } from '../../shared/Maybe.ts'
import type { MinecraftEventBus } from '../../shared/MinecraftEventBus.ts'
import type { Callback } from '../../shared/util.ts'
import type { GameLoop } from '../GameLoop.ts'
import type { LocalStorageManager } from '../LocalStorageManager.ts'
import type { TexturesRegistry } from '../TexturesRegistry.ts'
import type { GUIActions, GUIConditions, GUIState as GUIState } from './state.ts'

import { Config } from '../../shared/Config.ts'
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

export interface GUI {
  dispose(): void
  getCanvas(): HTMLCanvasElement
  requestLock(): void
}

export const createGUI = ({
  eventBus,
  getGameLoop,
  localStorageManager,
  texturesRegistry,
}: {
  eventBus: MinecraftEventBus
  getGameLoop: () => Maybe<GameLoop>
  localStorageManager: LocalStorageManager
  texturesRegistry: TexturesRegistry
}): GUI => {
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

  type HotbarSlot = {
    isSelected: boolean
    quantity: number
    texture: string
  }

  let previousHotbarSlots: HotbarSlot[] = []

  const hotbarSlotsContainer = document.getElementById('hotbar_slots')!
  const hotbarSlotTemplate = document.getElementById('hotbar_item_template') as HTMLTemplateElement

  const updateGameUI = (): void => {
    const maybeGameLoop = getGameLoop()
    if (!maybeGameLoop.isSome() || state.isPaused) return

    if (!state.initializedGameUI) {
      setState({ initializedGameUI: true })
    }

    const gameLoop = maybeGameLoop.value()

    const player = gameLoop.getClientPlayer()

    const frameCounter = gameLoop.getFrameCounter()

    Iterator.from(player.getInventory().listItems()).take(9)

    const hotbarSlots: HotbarSlot[] = Iterator.from(player.getInventory().listItems())
      .take(Config.HOTBAR_SIZE)
      .map((stack, i) => ({
        isSelected: player.getActiveSlotIndex() === i,
        quantity: stack.map((s) => s.quantity).unwrapOrDefault(0),
        texture: stack.map((s) => texturesRegistry.getItemTexture(s.itemID)).unwrapOrDefault(''),
      }))
      .toArray()

    setState(
      {
        fps: frameCounter.fps.toFixed(0),
        positionX: player.position.x.toFixed(),
        positionY: player.position.y.toFixed(),
        positionZ: player.position.z.toFixed(),
        rotationPitch: MathUtils.radToDeg(player.rotation.x).toFixed(),
        rotationYaw: MathUtils.radToDeg(player.rotation.y).toFixed(),
      },
      ['#fps', '#position', '#rotation', '#hotbar'],
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

    if (JSON.stringify(previousHotbarSlots) !== JSON.stringify(hotbarSlots)) {
      previousHotbarSlots = hotbarSlots

      hotbarSlotsContainer.innerHTML = ''

      for (const slot of hotbarSlots) {
        const clone = hotbarSlotTemplate.content.cloneNode(true) as HTMLElement
        const img = clone.querySelector('img')!

        if (slot.texture) {
          img.src = slot.texture
        } else {
          img.remove()
        }

        // clone.querySelector('div')!.setAttribute('data-selected', slot.isSelected.toString())
        if (slot.isSelected) {
          const div = clone.querySelector('div')!
          div.setAttribute('class', div.getAttribute('selected-class') ?? '')
          div.setAttribute('data-selected', 'true')
        }

        if (slot.quantity > 0) {
          clone.querySelector('span')!.textContent = slot.quantity.toString()
        }

        hotbarSlotsContainer.appendChild(clone)
      }
    }
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

      onResizeSyncRenderer()

      // setState({ isPaused: true, pauseText: 'Click to Resume' })
      // eventBus.publish(new PauseToggle())

      window.addEventListener('resize', onResizeSyncRenderer)
    }),
  )

  const interval = setInterval(updateGameUI, 200)
  dispositions.push(() => {
    clearInterval(interval)
  })

  synchronize(state, actions, conditions)

  return {
    dispose: (): void => {
      for (const dispose of dispositions) {
        dispose()
      }
    },
    getCanvas,
    requestLock: async () => {
      getCanvas().requestPointerLock()
    },
  }
}
