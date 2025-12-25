import type { UUID } from '../../types.ts'

export type UIState = {
  activePage: ActiveUIPage
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

type ActiveUIPage = 'game' | 'menuWorlds' | 'start' | 'worldLoading'

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

export const uiStateKey = <K extends NestedKeys<UIState>>(key: K) => key

export const uiActivePageKey = (page: ActiveUIPage) => page

export type UIActions = {
  backToMenu: UIAction
  backToStart: UIAction
  createWorld: UIAction
  deleteWorld: UIAction
  playWorld: UIAction
  resumeGame: UIAction
  startGame: UIAction
}

export type UICondition = {
  showCrosshair: () => boolean
  showGameUI: () => boolean
  showLoadingButton: () => boolean
  showOverlay: () => boolean
  showPauseMenu: () => boolean
  showStartGameButton: () => boolean
  showWorldsNotFound: () => boolean
}

type UIAction = (args: { event: MouseEvent }) => Promise<void> | void

export const uiActionKey = (type: keyof UIActions) => type

export const uiConditionKey = (type: keyof UICondition) => type
