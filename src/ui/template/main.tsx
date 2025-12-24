// This is only used as a prebuild step to generate the main HTML template for the UI.
// It uses jsxte to convert the JSX code into HTML string.
// This does not run in the browser.

import { renderToHtml } from "jsxte";
import {
  uiActionKey,
  uiActivePageKey,
  uiConditionKey,
  uiStateKey,
} from "../state.ts";

const cn = (...classes: string[]) => {
  return classes.filter(Boolean).join(" ");
};

const button = cn(`
  px-8 py-3
  text-xl
  bg-button-bg
  border-2 border-gray-600 
  border-b-4 border-b-gray-900 
  border-r-2 border-r-gray-900 
  cursor-pointer 
  transition-all duration-100 
  shadow-[0_4px_0_#1a1a1a] 
  flex justify-center items-center
  text-shadow-button-text-shadow
  disabled:cursor-not-allowed 
  disabled:opacity-60 
  disabled:shadow-none 
  disabled:translate-y-0
  min-w-70
  hover:bg-button-hover-bg
  hover:border-gray-500 
  hover:translate-y-px 
  hover:shadow-[0_3px_0_#1a1a1a]
  active:translate-y-0.5 
  active:shadow-[0_2px_0_#1a1a1a]
`);

const input = cn(`
  px-5 py-2.5
  text-xl
  border-2 border-primary
  bg-input-bg
  transition-colors duration-300
  focus:outline-none
  focus:border-secondary
  focus:bg-input-focus-bg
  min-w-70
`);

const gameUiElement = cn(`
p-1.25 w-max bg-overlay-bg
`);

const title = cn(`
  text-5xl
  mb-6
  text-center
  font-bold
  text-shadow-[2px_2px_0_#000]
`);

const Main = () => {
  return (
    <div class="font-press-start main overflow-hidden w-screen h-screen relative">
      <canvas
        id="game_canvas"
        class="fixed top-0 left-0 w-full h-full"
        data-condition={uiConditionKey("showGameUI")}
      />
      <div
        data-condition={uiConditionKey("showOverlay")}
        class="
        fixed top-0 left-0 w-screen h-screen
        flex flex-col justify-center items-center
        bg-no-repeat bg-cover
        bg-[url('/overlay_bg.jpeg')]
        gap-2.5
        p-5
        z-10
      "
      >
        <div
          data-active-page={uiActivePageKey("start")}
          id="menu_start"
          class="flex flex-col justify-center items-stretch gap-5"
        >
          <h1 class={title}>Minecraft Clone</h1>
          <button
            data-condition={uiConditionKey("showLoadingButton")}
            class={button}
            disabled
          >
            Loading...
          </button>
          <button
            data-action={uiActionKey("startGame")}
            data-condition={uiConditionKey("showStartGameButton")}
            class={button}
          >
            Start Game
          </button>
          <a class={button} href="https://github.com/r1tsuu/ts-minecraft">
            GitHub Repo
          </a>
        </div>
        <div
          data-active-page={uiActivePageKey("menuWorlds")}
          class="flex flex-col gap-6 max-w-4xl"
        >
          <h1 class={title}>Select World</h1>
          <div
            id="worlds_list"
            data-items-variable={uiStateKey("worldList")}
            data-items-template="world_item_template"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto"
          ></div>
          <template id="world_item_template">
            <div
              class="
    group
    flex flex-col
    bg-overlay-bg
    p-3
    gap-2
    border-2 border-primary
    shadow-[0_3px_0_#000]
    transition-transform duration-100
    hover:shadow-[0_5px_0_#000]
  "
            >
              <div
                data-variable={uiStateKey("worldList.i.name")}
                class="
    text-xl
    font-bold
    text-shadow-[2px_2px_0_#000]
    truncate
  "
              />
              <div
                data-variable={uiStateKey("worldList.i.seed")}
                class="text-xs opacity-70"
              />
              <div
                data-variable={uiStateKey("worldList.i.createdAt")}
                class="text-xs opacity-70"
              />
              <button
                data-action={uiActionKey("playWorld")}
                class={`
 flex-1
      px-4 py-2
      text-lg
      bg-green-700
      border-2 border-green-900
      border-b-4
      shadow-[0_3px_0_#000]
      hover:bg-green-600
      active:translate-y-0.5
                `}
              >
                Play
              </button>
              <button
                data-action={uiActionKey("deleteWorld")}
                class={`
  px-4 py-2
      text-lg
      bg-red-700
      border-2 border-red-900
      border-b-4
      shadow-[0_3px_0_#000]
      hover:bg-red-600
      active:translate-y-0.5
                `}
              >
                Delete
              </button>
            </div>
          </template>
          <div
            data-condition={uiConditionKey("showWorldsNotFound")}
            class="text-center text-lg"
          >
            <div>No worlds found.</div>
            <div>Create a new world to get started.</div>
          </div>
          <div class="flex flex-col bg-overlay-bg p-5 gap-4 border border-primary">
            <input name="worldName" class={input} placeholder="Name" />
            <input name="worldSeed" class={input} placeholder="Seed" />
            <button data-action="createWorld" class={button}>
              Create New World
            </button>
            <button data-action="backToStart" class={button}>
              Back to Start Menu
            </button>
          </div>
        </div>
        <div data-active-page={uiActivePageKey("worldLoading")}>
          <h1 class={title}>
            Loading World:{" "}
            <span data-variable={uiStateKey("loadingWorldName")} />
          </h1>
        </div>
      </div>
      <div
        class="absolute top-2.5 left-2.5 w-full h-full flex flex-col gap-1.25 z-10 max-w-fit"
        data-condition={uiConditionKey("showGameUI")}
      >
        <div class={gameUiElement} id="fps">
          FPS: <span data-variable={uiStateKey("fps")} />
        </div>
        <div class={gameUiElement} id="position">
          Position: <span data-variable={uiStateKey("position")} />
        </div>
        <div class={gameUiElement} id="rotation">
          Rotation: <span data-variable={uiStateKey("rotation")} />
        </div>
        <div class={gameUiElement} data-variable={uiStateKey("pauseText")} />

        <div
          data-condition={uiConditionKey("showPauseMenu")}
          class="h-full w-full fixed cursor-default top-0 left-0 bg-black/80 backdrop-blur-sm z-20"
        >
          <div
            class="
          flex fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
          flex-col justify-center items-stretch
          gap-6 p-12 z-30 bg-overlay-bg border-4 border-primary
          shadow-[0_8px_0_#000,0_0_40px_rgba(0,0,0,0.5)]
          min-w-100
        "
          >
            <h1 class={cn(title, "mb-2 text-6xl")}>Game Paused</h1>
            <div class="border-t-2 border-primary/30 my-2"></div>
            <button data-action={uiActionKey("resumeGame")} class={button}>
              Resume Game
            </button>
            <button
              data-action={uiActionKey("backToMenu")}
              class={cn(button, "bg-red-700 hover:bg-red-600 border-red-900")}
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
      <div
        data-condition={uiConditionKey("showCrosshair")}
        class="fixed top-1/2 left-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
      >
        {/** <!-- Vertical line --> */}
        <div class="absolute w-0.5 h-full left-1/2 -translate-x-1/2 bg-crosshair"></div>
        {/** <!-- Horizontal line --> */}
        <div class="absolute h-0.5 w-full top-1/2 -translate-y-1/2 bg-crosshair"></div>
      </div>
    </div>
  );
};

export const renderTemplate = () => {
  return renderToHtml(<Main />);
};
