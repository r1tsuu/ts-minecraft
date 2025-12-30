import type { EnvironmentType } from './util.ts'

export function getCurrentEnvironment(): EnvironmentType {
  if (typeof window !== 'undefined') {
    return 'Client'
  }

  return 'Server'
}

export const isClient = (): boolean => getCurrentEnvironment() === 'Client'

export const isServer = (): boolean => getCurrentEnvironment() === 'Server'
