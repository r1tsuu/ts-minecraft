// This is only used as a prebuild step to generate the main HTML template for the UI.
// It uses jsxte to convert the JSX code into HTML string.
// This does not run in the browser.

import { renderToHtml } from "jsxte";
import { tv } from "tailwind-variants";
import {
  uiActionKey,
  uiActivePageKey,
  uiConditionKey,
  uiStateKey,
} from "../state.ts";

// Reusable component variants using tailwind-variants
const button = tv({
  base: `
    px-8 py-3
    text-xl
    font-bold
    border-2 border-b-4 border-r-3
    cursor-pointer 
    transition-all duration-100 
    flex justify-center items-center
    text-shadow-[1px_1px_2px_rgba(0,0,0,0.8)]
    disabled:cursor-not-allowed 
    disabled:opacity-50 
    disabled:shadow-none 
    disabled:translate-y-0
    min-w-50
    active:translate-y-0.5
    select-none
  `,
  variants: {
    variant: {
      primary: `
        bg-primary
        border-primary-dark
        border-b-primary-darker
        border-r-primary-darker
        shadow-[0_4px_0_var(--color-primary-darker)]
        hover:bg-primary-light
        hover:border-primary-medium
        hover:translate-y-px 
        hover:shadow-[0_3px_0_var(--color-primary-darker)]
        active:shadow-[0_2px_0_var(--color-primary-darker)]
      `,
      secondary: `
        bg-secondary
        border-secondary-dark
        border-b-secondary-darker
        border-r-secondary-darker
        shadow-[0_4px_0_var(--color-secondary-darker)]
        hover:bg-secondary-light
        hover:border-secondary-medium
        hover:translate-y-px 
        hover:shadow-[0_3px_0_var(--color-secondary-darker)]
        active:shadow-[0_2px_0_var(--color-secondary-darker)]
      `,
      success: `
        bg-success
        border-success-dark
        border-b-success-darker
        border-r-success-darker
        shadow-[0_3px_0_var(--color-success-darker)]
        hover:bg-success-light
        hover:border-success-medium
        active:shadow-[0_2px_0_var(--color-success-darker)]
      `,
      danger: `
        bg-danger
        border-danger-dark
        border-b-danger-darker
        border-r-danger-darker
        shadow-[0_3px_0_var(--color-danger-darker)]
        hover:bg-danger-light
        hover:border-danger-medium
        active:shadow-[0_2px_0_var(--color-danger-darker)]
      `,
    },
    size: {
      md: "px-6 py-2.5 text-lg",
      lg: "px-8 py-3 text-xl",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "lg",
  },
});

const input = tv({
  base: `
    px-5 py-2.5
    text-xl
    border-2
    transition-all duration-200
    focus:outline-none
    min-w-50
    text-shadow-[1px_1px_1px_rgba(0,0,0,0.5)]
  `,
  variants: {
    variant: {
      default: `
        border-primary
        bg-input-bg
        text-accent
        focus:border-primary-light
        focus:bg-input-focus-bg
        focus:shadow-[0_0_0_2px_var(--color-primary-focus)]
        placeholder:text-accent-muted
      `,
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const card = tv({
  base: `
    bg-overlay-bg
    border-2
    transition-all duration-100
  `,
  variants: {
    variant: {
      default: `
        border-primary
        shadow-[0_3px_0_var(--color-primary-darker),0_0_20px_rgba(0,0,0,0.5)]
        hover:shadow-[0_5px_0_var(--color-primary-darker),0_0_30px_rgba(0,0,0,0.6)]
      `,
      game: `
        border-primary-dark
        shadow-[0_2px_4px_rgba(0,0,0,0.8)]
      `,
    },
    padding: {
      sm: "p-3",
      md: "p-5",
      lg: "p-8",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "md",
  },
});

const title = tv({
  base: `
    font-bold
    text-center
    text-shadow-[3px_3px_0_#000,0_0_10px_var(--color-accent-glow)]
    text-accent
  `,
  variants: {
    size: {
      lg: "text-5xl mb-6",
      xl: "text-6xl mb-8",
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

const gameUIElement = tv({
  base: `
    p-2.5 
    w-max 
    bg-game-ui
    border border-primary-dark
    text-accent
    text-shadow-[1px_1px_2px_rgba(0,0,0,0.9)]
    backdrop-blur-sm
  `,
});

const Main = () => {
  return (
    <div class="font-press-start main overflow-hidden w-screen h-screen relative bg-background">
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
        backdrop-brightness-75
      "
      >
        <div
          data-active-page={uiActivePageKey("start")}
          id="menu_start"
          class="flex flex-col justify-center items-stretch gap-5"
        >
          <h1 class={title({ size: "xl" })}>Minecraft Clone</h1>
          <button
            data-condition={uiConditionKey("showLoadingButton")}
            class={button({ variant: "primary" })}
            disabled
          >
            Loading...
          </button>
          <button
            data-action={uiActionKey("startGame")}
            data-condition={uiConditionKey("showStartGameButton")}
            class={button({ variant: "success" })}
          >
            Start Game
          </button>
          <a
            class={button({ variant: "secondary" })}
            href="https://github.com/r1tsuu/ts-minecraft"
          >
            GitHub Repo
          </a>
        </div>
        <div
          data-active-page={uiActivePageKey("menuWorlds")}
          class="flex flex-col gap-6 max-w-4xl"
        >
          <h1 class={title()}>Select World</h1>
          <div
            id="worlds_list"
            data-items-variable={uiStateKey("worldList")}
            data-items-template="world_item_template"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto"
          ></div>
          <template id="world_item_template">
            <div
              class={
                card({ variant: "default", padding: "sm" }) +
                " flex flex-col gap-3"
              }
            >
              <div
                data-variable={uiStateKey("worldList.i.name")}
                class="
                  text-xl
                  font-bold
                  text-accent
                  text-shadow-[2px_2px_0_#000]
                  truncate
                "
              />
              <div
                data-variable={uiStateKey("worldList.i.seed")}
                class="text-xs text-accent-muted"
              />
              <div
                data-variable={uiStateKey("worldList.i.createdAt")}
                class="text-xs text-accent-muted"
              />
              <button
                data-action={uiActionKey("playWorld")}
                class={button({ variant: "success", size: "md" })}
              >
                Play
              </button>
              <button
                data-action={uiActionKey("deleteWorld")}
                class={button({ variant: "danger", size: "md" })}
              >
                Delete
              </button>
            </div>
          </template>
          <div
            data-condition={uiConditionKey("showWorldsNotFound")}
            class="text-center text-lg text-accent text-shadow-[1px_1px_2px_rgba(0,0,0,0.8)]"
          >
            <div>No worlds found.</div>
            <div>Create a new world to get started.</div>
          </div>
          <div class={card({ padding: "md" }) + " flex flex-col gap-4"}>
            <input name="worldName" class={input()} placeholder="Name" />
            <input name="worldSeed" class={input()} placeholder="Seed" />
            <button
              data-action="createWorld"
              class={button({ variant: "success" })}
            >
              Create New World
            </button>
            <button
              data-action="backToStart"
              class={button({ variant: "secondary" })}
            >
              Back to Start Menu
            </button>
          </div>
        </div>
        <div data-active-page={uiActivePageKey("worldLoading")}>
          <h1 class={title()}>
            Loading World:{" "}
            <span
              data-variable={uiStateKey("loadingWorldName")}
              class="text-success"
            />
          </h1>
        </div>
      </div>
      <div
        class="absolute top-2.5 left-2.5 w-full h-full flex flex-col gap-1.25 z-10 max-w-fit"
        data-condition={uiConditionKey("showGameUI")}
      >
        <div id="fps" class={gameUIElement()}>
          FPS:{" "}
          <span
            data-variable={uiStateKey("fps")}
            id="fps_value"
            class="data-[performance=good]:text-success data-[performance=average]:text-warning data-[performance=bad]:text-danger"
          />
        </div>
        <div id="position" class={gameUIElement()}>
          Position:{" "}
          <span data-variable={uiStateKey("position")} class="text-secondary" />
        </div>
        <div id="rotation" class={gameUIElement()}>
          Rotation:{" "}
          <span data-variable={uiStateKey("rotation")} class="text-secondary" />
        </div>
        <div class={gameUIElement()} data-variable={uiStateKey("pauseText")} />

        <div
          data-condition={uiConditionKey("showPauseMenu")}
          class="h-full w-full fixed cursor-default top-0 left-0 bg-pause-overlay backdrop-blur-md z-20"
        >
          <div
            class={
              card({ variant: "default", padding: "lg" }) +
              ` fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
              flex flex-col justify-center items-stretch
              gap-6 z-30
              border-4
              shadow-[0_12px_0_var(--color-primary-darker),0_0_60px_rgba(0,0,0,0.8)]
              min-w-100`
            }
          >
            <h1 class={title({ size: "xl" })}>Game Paused</h1>
            <div class="border-t-2 border-primary-dark/50 my-2"></div>
            <button
              data-action={uiActionKey("resumeGame")}
              class={button({ variant: "success" })}
            >
              Resume Game
            </button>
            <button
              data-action={uiActionKey("backToMenu")}
              class={button({ variant: "danger" })}
            >
              Exit to Main Menu
            </button>
          </div>
        </div>
      </div>
      <div
        data-condition={uiConditionKey("showCrosshair")}
        class="fixed top-1/2 left-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
      >
        {/** <!-- Vertical line --> */}
        <div class="absolute w-0.5 h-full left-1/2 -translate-x-1/2 bg-crosshair shadow-[0_0_4px_rgba(0,0,0,0.8)]"></div>
        {/** <!-- Horizontal line --> */}
        <div class="absolute h-0.5 w-full top-1/2 -translate-y-1/2 bg-crosshair shadow-[0_0_4px_rgba(0,0,0,0.8)]"></div>
      </div>
    </div>
  );
};

export const renderTemplate = () => {
  return renderToHtml(<Main />);
};
