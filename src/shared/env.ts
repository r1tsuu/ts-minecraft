import type { EnvironmentType } from './util.ts'

import { type Maybe, None, Some } from './Maybe.ts'

let environment: Maybe<EnvironmentType> = None()

export function getCurrentEnvironment(): EnvironmentType {
  return environment.expect('Environment has not been set yet.')
}

export function setCurrentEnvironment(env: EnvironmentType): void {
  environment = Some(env)
}

export const isClient = (): boolean => getCurrentEnvironment() === 'Client'

export const isServer = (): boolean => getCurrentEnvironment() === 'Server'
