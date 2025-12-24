import type { UIActions, UICondition, UIState } from './state.ts'

const bindStateToDOM = (
  container: HTMLElement,
  state: Record<string, any>,
  keyPrefix: string = '',
) => {
  for (const key in state) {
    const value = state[key]

    if (Array.isArray(value)) {
      const subContainer = container.querySelector(`[data-items-variable="${keyPrefix}${key}"]`)
      const templateId = subContainer?.getAttribute('data-items-template')
      const template = templateId
        ? (document.getElementById(templateId) as HTMLTemplateElement)
        : null

      if (subContainer && template) {
        subContainer.innerHTML = ''

        for (const [index, item] of value.entries()) {
          const clone = template.content.cloneNode(true) as HTMLElement
          clone.querySelectorAll(`[data-action]`).forEach((el) => {
            el.setAttribute('data-index', String(index))
          })

          bindStateToDOM(clone, item, `${keyPrefix}${key}.i.`)
          subContainer.appendChild(clone)
        }
      }
    } else
      container.querySelectorAll(`[data-variable="${keyPrefix}${key}"]`).forEach((el) => {
        el.textContent = String(value)
      })
  }
}

export const synchronize = (
  state: UIState,
  actions: UIActions,
  conditions: UICondition,
  /**
   * Optional list of query selectors to limit the synchronization scope
   * Useful for performance optimization when only specific parts of the UI need updating
   */
  affectedQuerySelectors?: string | string[],
) => {
  const containers: HTMLElement[] = []
  if (affectedQuerySelectors) {
    if (typeof affectedQuerySelectors === 'string') {
      affectedQuerySelectors = [affectedQuerySelectors]
    }
    for (const selector of affectedQuerySelectors) {
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        containers.push(el)
      })
    }
  } else {
    containers.push(document.body)
  }

  for (const container of containers) {
    bindStateToDOM(container, state, '')
  }

  for (const key in actions) {
    const actionFn = actions[key as keyof UIActions]

    for (const container of containers) {
      container.querySelectorAll<HTMLButtonElement>(`[data-action="${key}"]`).forEach((el) => {
        el.onclick = (event) => {
          actionFn({ event })
        }
      })
    }

    for (const key in conditions) {
      const conditionFn = conditions[key as keyof UICondition]
      const result = conditionFn()

      for (const container of containers) {
        container.querySelectorAll<HTMLElement>(`[data-condition="${key}"]`).forEach((el) => {
          if (!result) {
            el.setAttribute('data-condition-passed', 'false')
          } else {
            el.setAttribute('data-condition-passed', 'true')
          }
        })
      }
    }
  }

  for (const container of containers) {
    container.querySelectorAll<HTMLElement>(`[data-active-page]`).forEach((el) => {
      const page = el.getAttribute('data-active-page')

      if (page && state.activePage !== page) {
        el.setAttribute('data-condition-passed', 'false')
      } else {
        el.setAttribute('data-condition-passed', 'true')
      }
    })
  }
}
