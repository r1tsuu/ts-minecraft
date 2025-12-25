import type { UUID } from '../../types.ts'

export type GUIState = {
  activePage: ActiveGUIPage
  fps: string
  initializedGameUI: boolean
  isInitialized: boolean
  isPaused: boolean
  loadingWorldName: string
  pauseText: string
  positionX: string
  positionY: string
  positionZ: string
  rotationPitch: string
  rotationYaw: string
  worldList: {
    createdAt: string
    name: string
    seed: string
    uuid: UUID
  }[]
}

type ActiveGUIPage = 'game' | 'menuWorlds' | 'start' | 'worldLoading'

// Helper type to get nested keys with "i" for arrays
type NestedKeys<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends Array<infer U>
    ? // @ts-expect-error
        `${Prefix}${K}` | NestedKeys<U, `${Prefix}${K}.i.`>
    : T[K] extends object
      ? // @ts-expect-error
          `${Prefix}${K}` | NestedKeys<T[K], `${Prefix}${K}.`>
      : // @ts-expect-error
        `${Prefix}${K}`
}[keyof T]

export const stateKey = <K extends NestedKeys<GUIState>>(key: K) => key

export const activePageKey = (page: ActiveGUIPage) => page

export type GUIActions = {
  backToMenu: GUIAction
  backToStart: GUIAction
  createWorld: GUIAction
  deleteWorld: GUIAction
  playWorld: GUIAction
  resumeGame: GUIAction
  startGame: GUIAction
}

export type GUIConditions = {
  showCrosshair: () => boolean
  showGameUI: () => boolean
  showLoadingButton: () => boolean
  showOverlay: () => boolean
  showPauseMenu: () => boolean
  showStartGameButton: () => boolean
  showWorldsNotFound: () => boolean
}

type GUIAction = (args: { event: MouseEvent }) => Promise<void> | void

export const actionKey = (type: keyof GUIActions) => type

export const conditionKey = (type: keyof GUIConditions) => type
