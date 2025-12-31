const GameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'] as const

const isGameKey = (key: string): key is KeyboardKey => {
  return GameKeys.includes(key as KeyboardKey)
}

export type InputManager = ReturnType<typeof createInputManager>

export type KeyboardKey = (typeof GameKeys)[number]

export const createInputManager = (isPaused: () => boolean) => {
  const keyboardState = GameKeys.reduce<Record<KeyboardKey, { isPressed: boolean }>>(
    (acc, key) => {
      acc[key] = { isPressed: false }
      return acc
    },
    {} as Record<KeyboardKey, { isPressed: boolean }>,
  )

  const mouseState = {
    deltaX: 0,
    deltaY: 0,
    isPressedLeft: false,
    isPressedRight: false,
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (isPaused()) {
      resetKeyboardState()
      return
    }

    if (!isGameKey(event.code)) {
      return
    }

    const keyState = keyboardState[event.code]

    keyState.isPressed = true
  }

  const onKeyUp = (event: KeyboardEvent) => {
    if (isPaused()) {
      resetKeyboardState()
      return
    }

    if (!isGameKey(event.code)) {
      return
    }
    const keyState = keyboardState[event.code]

    keyState.isPressed = false
  }

  const onMouseDown = (event: MouseEvent) => {
    if (isPaused()) {
      return
    }

    if (event.button === 0) {
      mouseState.isPressedLeft = true
    } else if (event.button === 2) {
      mouseState.isPressedRight = true
    }
  }

  const onMouseMove = (event: MouseEvent) => {
    if (isPaused()) {
      return
    }

    mouseState.deltaX += event.movementX
    mouseState.deltaY += event.movementY
  }

  const onMouseUp = (event: MouseEvent) => {
    if (isPaused()) {
      return
    }

    if (event.button === 0) {
      mouseState.isPressedLeft = false
    } else if (event.button === 2) {
      mouseState.isPressedRight = false
    }
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)

  const dispose = () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('mousemove', onMouseMove)
  }

  const resetKeyboardState = () => {
    for (const key of GameKeys) {
      keyboardState[key].isPressed = false
    }
  }

  const resetMouseDelta = () => {
    mouseState.deltaX = 0
    mouseState.deltaY = 0
  }

  const getMouseDelta = () => {
    return {
      deltaX: mouseState.deltaX,
      deltaY: mouseState.deltaY,
    }
  }

  const isKeyPressed = (key: KeyboardKey): boolean => {
    return keyboardState[key].isPressed
  }

  const isPressedLeftMouse = (): boolean => {
    return mouseState.isPressedLeft
  }

  const isPressedRightMouse = (): boolean => {
    return mouseState.isPressedRight
  }

  return {
    dispose,
    getMouseDelta,
    isKeyPressed,
    isPressedLeftMouse,
    isPressedRightMouse,
    resetKeyboardState,
    resetMouseDelta,
  }
}
