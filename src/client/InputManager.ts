type KeyboardKey = 'KeyA' | 'KeyD' | 'KeyS' | 'KeyW' | 'Space'

export class InputManager {
  private keyboardState: Record<
    KeyboardKey,
    {
      isPressed: boolean
    }
  > = {
    KeyA: {
      isPressed: false,
    },
    KeyD: {
      isPressed: false,
    },
    KeyS: {
      isPressed: false,
    },
    KeyW: {
      isPressed: false,
    },
    Space: {
      isPressed: false,
    },
  }

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

  dispose: () => void = () => {}

  getMouseDelta(): {
    deltaX: number
    deltaY: number
  } {
    return {
      deltaX: this.mouseState.deltaX,
      deltaY: this.mouseState.deltaY,
    }
  }

  isKeyPressed(key: KeyboardKey): boolean {
    return this.keyboardState[key].isPressed
  }

  setup() {
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

  private onKeyDown = (event: KeyboardEvent) => {
    const keyState = this.keyboardState[event.code as KeyboardKey]

    if (keyState) {
      keyState.isPressed = true
    }
  }

  private onKeyUp = (event: KeyboardEvent) => {
    const keyState = this.keyboardState[event.code as KeyboardKey]

    if (keyState) {
      keyState.isPressed = false
    }
  }

  private onMouseDown = (event: MouseEvent) => {
    if (event.button === 0) {
      this.mouseState.isPressedLeft = true
    } else if (event.button === 2) {
      this.mouseState.isPressedRight = true
    }
  }

  private onMouseMove = (event: MouseEvent) => {
    this.mouseState.deltaX = event.movementX
    this.mouseState.deltaY = event.movementY
  }

  private onMouseUp = (event: MouseEvent) => {
    if (event.button === 0) {
      this.mouseState.isPressedLeft = false
    } else if (event.button === 2) {
      this.mouseState.isPressedRight = false
    }
  }
}
