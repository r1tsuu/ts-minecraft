// This is only used as a prebuild step to generate the main HTML template for the UI.
// It uses jsxte to convert the JSX code into HTML string.
// This does not run in the browser.

import { renderToHtml } from 'jsxte'
import { tv } from 'tailwind-variants'

import { actionKey, activePageKey, conditionKey, stateKey } from '../state.ts'

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
  defaultVariants: {
    size: 'lg',
    variant: 'primary',
  },
  variants: {
    size: {
      lg: 'px-8 py-3 text-xl',
      md: 'px-6 py-2.5 text-lg',
    },
    variant: {
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
    },
  },
})

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
  defaultVariants: {
    variant: 'default',
  },
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
})

const card = tv({
  base: `
    bg-overlay-bg
    border-2
    transition-all duration-100
  `,
  defaultVariants: {
    padding: 'md',
    variant: 'default',
  },
  variants: {
    padding: {
      lg: 'p-8',
      md: 'p-5',
      sm: 'p-3',
    },
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
  },
})

const title = tv({
  base: `
    font-bold
    text-center
    text-shadow-[3px_3px_0_#000,0_0_10px_var(--color-accent-glow)]
    text-accent
  `,
  defaultVariants: {
    size: 'lg',
  },
  variants: {
    size: {
      lg: 'text-5xl mb-6',
      xl: 'text-6xl mb-8',
    },
  },
})

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
})

const Main = () => {
  return (
    <div class="font-press-start main overflow-hidden w-screen h-screen relative bg-background">
      <canvas
        class="fixed top-0 left-0 w-full h-full"
        data-condition={conditionKey('showGameUI')}
        id="game_canvas"
      />
      <div
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
        data-condition={conditionKey('showOverlay')}
      >
        <div
          class="flex flex-col justify-center items-stretch gap-5"
          data-active-page={activePageKey('start')}
          id="menu_start"
        >
          <h1 class={title({ size: 'xl' })}>Minecraft Clone</h1>
          <button
            class={button({ variant: 'primary' })}
            data-condition={conditionKey('showLoadingButton')}
            disabled
          >
            Loading...
          </button>
          <button
            class={button({ variant: 'success' })}
            data-action={actionKey('startGame')}
            data-condition={conditionKey('showStartGameButton')}
          >
            Start Game
          </button>
          <a class={button({ variant: 'secondary' })} href="https://github.com/r1tsuu/ts-minecraft">
            GitHub Repo
          </a>
        </div>
        <div class="flex flex-col gap-6 max-w-4xl" data-active-page={activePageKey('menuWorlds')}>
          <h1 class={title()}>Select World</h1>
          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto"
            data-items-template="world_item_template"
            data-items-variable={stateKey('worldList')}
            id="worlds_list"
          ></div>
          <template id="world_item_template">
            <div class={card({ padding: 'sm', variant: 'default' }) + ' flex flex-col gap-3'}>
              <div
                class="
                  text-xl
                  font-bold
                  text-accent
                  text-shadow-[2px_2px_0_#000]
                  truncate
                "
                data-variable={stateKey('worldList.i.name')}
              />
              <div class="text-xs text-accent-muted" data-variable={stateKey('worldList.i.seed')} />
              <div
                class="text-xs text-accent-muted"
                data-variable={stateKey('worldList.i.createdAt')}
              />
              <button
                class={button({ size: 'md', variant: 'success' })}
                data-action={actionKey('playWorld')}
              >
                Play
              </button>
              <button
                class={button({ size: 'md', variant: 'danger' })}
                data-action={actionKey('deleteWorld')}
              >
                Delete
              </button>
            </div>
          </template>
          <div
            class="text-center text-lg text-accent text-shadow-[1px_1px_2px_rgba(0,0,0,0.8)]"
            data-condition={conditionKey('showWorldsNotFound')}
          >
            <div>No worlds found.</div>
            <div>Create a new world to get started.</div>
          </div>
          <div class={card({ padding: 'md' }) + ' flex flex-col gap-4'}>
            <input class={input()} name="worldName" placeholder="Name" />
            <input class={input()} name="worldSeed" placeholder="Seed" />
            <button class={button({ variant: 'success' })} data-action="createWorld">
              Create New World
            </button>
            <button class={button({ variant: 'secondary' })} data-action="backToStart">
              Back to Start Menu
            </button>
          </div>
        </div>
        <div data-active-page={activePageKey('worldLoading')}>
          <h1 class={title()}>
            Loading World:{' '}
            <span class="text-success" data-variable={stateKey('loadingWorldName')} />
          </h1>
        </div>
      </div>
      <div
        class="absolute top-2.5 left-2.5 w-full h-full flex flex-col gap-1.25 z-10 max-w-fit"
        data-condition={conditionKey('showGameUI')}
      >
        <div class={gameUIElement()} id="fps">
          FPS:{' '}
          <span
            class="data-[performance=good]:text-success data-[performance=average]:text-warning data-[performance=bad]:text-danger"
            data-variable={stateKey('fps')}
            id="fps_value"
          />
        </div>
        <div class={gameUIElement()} id="position">
          Position: X: <span class="text-secondary" data-variable={stateKey('positionX')} /> Y:{' '}
          <span class="text-secondary" data-variable={stateKey('positionY')} /> Z:{' '}
          <span class="text-secondary" data-variable={stateKey('positionZ')} />
        </div>
        <div class={gameUIElement()} id="rotation">
          Rotation: Yaw: <span class="text-secondary" data-variable={stateKey('rotationYaw')} />°
          Pitch: <span class="text-secondary" data-variable={stateKey('rotationPitch')} />°
        </div>
        <div class={gameUIElement()} data-variable={stateKey('pauseText')} />

        <div
          class="h-full w-full fixed cursor-default top-0 left-0 bg-pause-overlay backdrop-blur-md z-20"
          data-condition={conditionKey('showPauseMenu')}
        >
          <div
            class={
              card({ padding: 'lg', variant: 'default' }) +
              ` fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
              flex flex-col justify-center items-stretch
              gap-6 z-30
              border-4
              shadow-[0_12px_0_var(--color-primary-darker),0_0_60px_rgba(0,0,0,0.8)]
              min-w-100`
            }
          >
            <h1 class={title({ size: 'xl' })}>Game Paused</h1>
            <div class="border-t-2 border-primary-dark/50 my-2"></div>
            <button class={button({ variant: 'success' })} data-action={actionKey('resumeGame')}>
              Resume Game
            </button>
            <button class={button({ variant: 'danger' })} data-action={actionKey('backToMenu')}>
              Exit to Main Menu
            </button>
          </div>
        </div>
      </div>
      <div
        class="fixed top-1/2 left-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
        data-condition={conditionKey('showCrosshair')}
      >
        {/** <!-- Vertical line --> */}
        <div class="absolute w-0.5 h-full left-1/2 -translate-x-1/2 bg-crosshair shadow-[0_0_4px_rgba(0,0,0,0.8)]"></div>
        {/** <!-- Horizontal line --> */}
        <div class="absolute h-0.5 w-full top-1/2 -translate-y-1/2 bg-crosshair shadow-[0_0_4px_rgba(0,0,0,0.8)]"></div>
      </div>
    </div>
  )
}

export const renderTemplate = () => {
  return renderToHtml(<Main />)
}
