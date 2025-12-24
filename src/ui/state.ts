type ActiveUIPage = "start" | "menuWorlds" | "game" | "worldLoading";

export type UIState = {
  fps: string;
  position: string;
  rotation: string;
  pauseText: string;
  initializedGameUI: boolean;
  worldList: {
    id: number;
    name: string;
    seed: string;
    createdAt: string;
  }[];
  activePage: ActiveUIPage;
  loadingWorldName: string;
  isPaused: boolean;
  isInitialized: boolean;
};

// Helper type to get nested keys with "i" for arrays
type NestedKeys<T, Prefix extends string = ""> = {
  [K in keyof T]: T[K] extends Array<infer U>
    ? // @ts-expect-error
      `${Prefix}${K}` | NestedKeys<U, `${Prefix}${K}.i.`>
    : T[K] extends object
    ? // @ts-expect-error
      `${Prefix}${K}` | NestedKeys<T[K], `${Prefix}${K}.`>
    : // @ts-expect-error
      `${Prefix}${K}`;
}[keyof T];

export const uiStateKey = <K extends NestedKeys<UIState>>(key: K) => key;

export const uiActivePageKey = (page: ActiveUIPage) => page;

type UIAction = (args: { event: MouseEvent }) => void | Promise<void>;

export type UICondition = {
  showOverlay: () => boolean;
  showWorldsNotFound: () => boolean;
  showLoadingButton: () => boolean;
  showStartGameButton: () => boolean;
  showGameUI: () => boolean;
  showCrosshair: () => boolean;
  showPauseMenu: () => boolean;
};

export type UIActions = {
  startGame: UIAction;
  playWorld: UIAction;
  deleteWorld: UIAction;
  createWorld: UIAction;
  backToStart: UIAction;
  backToMenu: UIAction;
  resumeGame: UIAction;
};

export const uiActionKey = (type: keyof UIActions) => type;

export const uiConditionKey = (type: keyof UICondition) => type;
