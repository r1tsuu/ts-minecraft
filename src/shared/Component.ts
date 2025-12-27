export interface Component {
  dispose?(): void
  update?(): void
}

export interface SanitizedComponent extends Component {
  dispose(): void
  update(): void
}

const ComponentSymbol = Symbol('Component')

/**
 * Class decorator to mark a class as a Component.
 * It adds a unique symbol to the prototype to identify it as a Component.
 * It also ensures that the class has dispose and update methods.
 * If they are not defined, it provides default no-op implementations.
 * @param target The target class to decorate
 * @return The decorated class
 * @example
 * @Component()
 * class MyComponent implements Component {
 *   // ...
 * }
 */
export function Component(): ClassDecorator {
  return (target) => {
    target.prototype[ComponentSymbol] = true

    if (!target.prototype.dispose) {
      target.prototype.dispose = () => {}
    }

    if (!target.prototype.update) {
      target.prototype.update = () => {}
    }
    return target
  }
}

export function isComponent(obj: any): obj is SanitizedComponent {
  return obj && obj[ComponentSymbol] === true
}
