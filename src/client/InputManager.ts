import { Component } from '../shared/Component.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GameSession } from './GameSession.ts'

const GameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'] as const

const isGameKey = (key: string): key is KeyboardKey => {
  return GameKeys.includes(key as KeyboardKey)
}

export type KeyboardKey = (typeof GameKeys)[number]

@Component()
export class InputManager implements Component {
  private dispositions: (() => void)[] = []

  private keyboardState = GameKeys.reduce<Record<KeyboardKey, { isPressed: boolean }>>(
    (acc, key) => {
      acc[key] = { isPressed: false }
      return acc
    },
    {} as Record<KeyboardKey, { isPressed: boolean }>,
  )

  private mouseState: {
    deltaX: number
    deltaY: number
    isPressedLeft: boolean
    isPressedRight: boolean
  } = {
    deltaX: 0,
    deltaY: 0,
    isPressedLeft: false,
    isPressedRight: false,
  }

  constructor() {
    const onKeyDown = this.onKeyDown.bind(this)
    const onKeyUp = this.onKeyUp.bind(this)
    const onMouseDown = this.onMouseDown.bind(this)
    const onMouseUp = this.onMouseUp.bind(this)
    const onMouseMove = this.onMouseMove.bind(this)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)

    this.dispositions.push(() => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
    })
  }

  dispose(): void {
    for (const dispose of this.dispositions) {
      dispose()
    }
  }

  getMouseDelta() {
    return {
      deltaX: this.mouseState.deltaX,
      deltaY: this.mouseState.deltaY,
    }
  }

  isKeyPressed(key: KeyboardKey): boolean {
    return this.keyboardState[key].isPressed
  }

  resetKeyboardState() {
    for (const key of GameKeys) {
      this.keyboardState[key].isPressed = false
    }
  }

  resetMouseDelta() {
    this.mouseState.deltaX = 0
    this.mouseState.deltaY = 0
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (ClientContainer.resolve(GameSession).unwrap().paused) {
      this.resetKeyboardState()
      return
    }

    if (!isGameKey(event.code)) {
      return
    }

    const keyState = this.keyboardState[event.code]

    keyState.isPressed = true
  }

  private onKeyUp = (event: KeyboardEvent) => {
    if (ClientContainer.resolve(GameSession).unwrap().paused) {
      this.resetKeyboardState()
      return
    }

    if (!isGameKey(event.code)) {
      return
    }
    const keyState = this.keyboardState[event.code]

    keyState.isPressed = false
  }

  private onMouseDown = (event: MouseEvent) => {
    if (ClientContainer.resolve(GameSession).unwrap().paused) {
      return
    }

    if (event.button === 0) {
      this.mouseState.isPressedLeft = true
    } else if (event.button === 2) {
      this.mouseState.isPressedRight = true
    }
  }

  private onMouseMove = (event: MouseEvent) => {
    if (ClientContainer.resolve(GameSession).unwrap().paused) {
      return
    }

    this.mouseState.deltaX += event.movementX
    this.mouseState.deltaY += event.movementY
  }

  private onMouseUp = (event: MouseEvent) => {
    if (ClientContainer.resolve(GameSession).unwrap().paused) {
      return
    }

    if (event.button === 0) {
      this.mouseState.isPressedLeft = false
    } else if (event.button === 2) {
      this.mouseState.isPressedRight = false
    }
  }
}
