import type { MinecraftClient } from './MinecraftClient.ts'

const GameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'] as const

const isGameKey = (key: string): key is KeyboardKey => {
  return GameKeys.includes(key as KeyboardKey)
}

export type KeyboardKey = (typeof GameKeys)[number]

export class InputManager {
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

  constructor(private readonly minecraft: MinecraftClient) {
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

    this.dispose = () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }

  dispose: () => void = () => {}

  private isPaused(): boolean {
    return this.minecraft.getGameSession().paused
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.isPaused()) {
      return
    }

    if (!isGameKey(event.code)) {
      return
    }

    const keyState = this.keyboardState[event.code]
    keyState.isPressed = true

    this.minecraft.eventQueue.emit('Client.Input.KeyDown', {
      keyCode: event.code,
    })
  }

  private onKeyUp = (event: KeyboardEvent) => {
    if (this.isPaused()) {
      return
    }

    if (!isGameKey(event.code)) {
      return
    }
    const keyState = this.keyboardState[event.code]
    keyState.isPressed = false

    this.minecraft.eventQueue.emit('Client.Input.KeyUp', {
      keyCode: event.code,
    })
  }

  private onMouseDown = (event: MouseEvent) => {
    if (this.isPaused()) {
      return
    }

    if (event.button === 0) {
      this.mouseState.isPressedLeft = true
      this.minecraft.eventQueue.emit('Client.Input.MouseLeftDown', {})
    } else if (event.button === 2) {
      this.mouseState.isPressedRight = true
      this.minecraft.eventQueue.emit('Client.Input.MouseRightDown', {})
    }
  }

  private onMouseMove = (event: MouseEvent) => {
    if (this.isPaused()) {
      return
    }

    this.mouseState.deltaX = event.movementX
    this.mouseState.deltaY = event.movementY
    this.minecraft.eventQueue.emit('Client.Input.MouseMove', {
      deltaX: event.movementX,
      deltaY: event.movementY,
    })
  }

  private onMouseUp = (event: MouseEvent) => {
    if (this.isPaused()) {
      return
    }

    if (event.button === 0) {
      this.mouseState.isPressedLeft = false
      this.minecraft.eventQueue.emit('Client.Input.MouseLeftUp', {})
    } else if (event.button === 2) {
      this.mouseState.isPressedRight = false
      this.minecraft.eventQueue.emit('Client.Input.MouseRightUp', {})
    }
  }
}
