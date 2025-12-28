import eslint from 'eslint'
import fs from 'fs'
import path from 'path'
import prettier from 'prettier'
const args = process.argv.slice(2)

const eventType = args[0]

if (!eventType) {
  console.error('Please provide an event type name as the first argument.')
  process.exit(1)
}

const [eventScope, eventName] = eventType.split('.')

const folderPath = path.resolve(
  import.meta.dirname,
  `./src/shared/events/${eventScope.toLowerCase()}`,
)

if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath, { recursive: true })
}

const classCode = `export class ${eventName}Payload {
  static readonly type = '${eventScope}.${eventName}'
  constructor() {}

  static decode(): ${eventName}Payload {
    return new ${eventName}Payload()
  }

  static encode(): any {
    return {}
  }
}
`

const filePath = path.join(folderPath, `${eventName}Payload.ts`)

fs.writeFileSync(filePath, classCode, 'utf-8')
console.log(`Event type class ${eventName}Payload created at ${filePath}`)

const minecraftEventBusPath = path.resolve(import.meta.dirname, './src/shared/MinecraftEventBus.ts')
let minecraftEventBusContent = fs.readFileSync(minecraftEventBusPath, 'utf-8')

minecraftEventBusContent = `
import { ${eventName}Payload } from './events/${eventScope.toLowerCase()}/${eventName}Payload.ts'
${minecraftEventBusContent}
`

const start = minecraftEventBusContent.indexOf('// EVENT TYPE DEFINITION START')
const arrayEnd = minecraftEventBusContent.indexOf(']', start)

const newEventTypeDefinition = `  ${eventName}Payload,`

minecraftEventBusContent =
  minecraftEventBusContent.slice(0, arrayEnd - 1) +
  `\n${newEventTypeDefinition}` +
  minecraftEventBusContent.slice(arrayEnd - 1)

fs.writeFileSync(minecraftEventBusPath, minecraftEventBusContent, 'utf-8')
console.log(`MinecraftEventBus.ts updated with ${eventName}Payload import and registration.`)

await prettier.resolveConfig(minecraftEventBusPath).then(async (options) => {
  const formatted = await prettier.format(minecraftEventBusContent, {
    ...options,
    parser: 'typescript',
  })
  fs.writeFileSync(minecraftEventBusPath, formatted, 'utf-8')
  console.log(`MinecraftEventBus.ts formatted with Prettier.`)

  const eslintEngine = new eslint.ESLint({ fix: true })
  const results = await eslintEngine.lintFiles([minecraftEventBusPath])
  await eslint.ESLint.outputFixes(results)
  console.log(`MinecraftEventBus.ts linted with ESLint.`)
})
