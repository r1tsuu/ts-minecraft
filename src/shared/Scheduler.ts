import { preserveClassOriginalClassConstructor } from './util.ts'

interface ScheduleEveryMetadata {
  /**
   * If true, allows the task to be scheduled again even if the previous execution is still running.
   */
  allowOverlapping: boolean
  intervalMs: number
  propertyKey: string | symbol
  runImmediately: boolean
}

interface TaskState {
  isRunning: boolean
  promise: null | Promise<void>
}

const SCHEDULER_EVERY_KEY = Symbol('SCHEDULER_EVERY_METADATA_KEY')

export class Scheduler {
  private intervals = new WeakMap<any, number[]>()
  private taskStates = new WeakMap<any, Map<string | symbol, TaskState>>()

  registerInstance(instance: any): void {
    const constructor: any = instance.constructor
    const scheduledMethods: ScheduleEveryMetadata[] = constructor[SCHEDULER_EVERY_KEY] || []

    if (scheduledMethods.length === 0) return

    for (const method of scheduledMethods) {
      const boundMethod = instance[method.propertyKey].bind(instance)

      if (!this.taskStates.has(instance)) {
        this.taskStates.set(instance, new Map<string | symbol, TaskState>())
      }

      let taskState = this.taskStates.get(instance)!.get(method.propertyKey)!

      if (!taskState) {
        this.taskStates.get(instance)!.set(method.propertyKey, {
          isRunning: false,
          promise: null,
        })
        taskState = this.taskStates.get(instance)!.get(method.propertyKey)!
      }

      const executeTask = async () => {
        if (!method.allowOverlapping && taskState.isRunning) {
          return
        }

        taskState.isRunning = true

        try {
          await boundMethod()
        } catch (error) {
          console.error(`Error executing scheduled method ${String(method.propertyKey)}:`, error)
        } finally {
          taskState.isRunning = false
        }
      }

      if (method.runImmediately) {
        executeTask()
      }

      const interval = setInterval(() => {
        executeTask()
      }, method.intervalMs)

      if (!this.intervals.has(instance)) {
        this.intervals.set(instance, [])
      }

      this.intervals.get(instance)!.push(interval)
    }
  }

  unregisterInstance(instance: any): void {
    const intervals = this.intervals.get(instance)
    const taskStates = this.taskStates.get(instance)

    if (taskStates) {
      this.taskStates.delete(instance)
    }

    if (intervals) {
      for (const interval of intervals) {
        clearInterval(interval)
      }
      this.intervals.delete(instance)
    }
  }
}

const GLOBAL_SCHEDULER = new Scheduler()

/**
 * Decorator to run a method at regular intervals.
 * @param intervalMs - The interval in milliseconds at which to run the method.
 * @param options - Additional options.
 * @param options.runImmediately - If true, the method will be run immediately upon scheduling.
 * @param options.allowOverlapping - If true, allows the task to be scheduled again even if the previous execution is still running.
 * @returns A method decorator.
 * @example
 * ```typescript
 * class MyClass {
 *   @RunTask(1000, { runImmediately: true })
 *   myMethod() {
 *     console.log('This method runs every second, starting immediately.');
 *   }
 * }
 * ```
 */
export function RunTask(
  intervalMs: number,
  options: {
    allowOverlapping?: boolean
    disabled?: boolean
    runImmediately?: boolean
  } = {},
) {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    if (options.disabled) {
      return descriptor
    }

    if (!target.constructor[SCHEDULER_EVERY_KEY]) {
      target.constructor[SCHEDULER_EVERY_KEY] = []
    }

    const metadata: ScheduleEveryMetadata = {
      allowOverlapping: options.allowOverlapping ?? false,
      intervalMs,
      propertyKey,
      runImmediately: options.runImmediately ?? false,
    }

    target.constructor[SCHEDULER_EVERY_KEY].push(metadata)

    return descriptor
  }
}

/**
 * Decorator to mark a class as schedulable.
 * The class will be registered with the provided scheduler instance upon instantiation.
 * @param resolveScheduler - Optional function to resolve the scheduler instance. If not provided, the global scheduler will be used.
 * @returns A class decorator.
 * @example
 * ```typescript
 * @Schedulable()
 * class MySchedulableClass {
 *   @Every(1000)
 *   myScheduledMethod() {
 *     console.log('This method runs every second.');
 *   }
 * }
 * ```
 */
export function Schedulable(resolveScheduler?: () => Scheduler): ClassDecorator {
  // @ts-expect-error
  return function <T extends new (...args: any[]) => any>(Target: T): T {
    preserveClassOriginalClassConstructor(Target)
    return class extends Target {
      constructor(...args: any[]) {
        super(...args)
        const scheduler = resolveScheduler ? resolveScheduler() : GLOBAL_SCHEDULER
        scheduler.registerInstance(this)
        console.log(`Registered scheduled tasks for ${Target.name}`)

        const originalDispose = this.dispose?.bind(this)

        this.dispose = () => {
          originalDispose?.()
          scheduler.unregisterInstance(this)
          console.log(`Unregistered scheduled tasks for ${Target.name}`)
        }
      }
    }
  }
}
