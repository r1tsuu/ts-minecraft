import fs from 'fs'
import path from 'path'
const args = process.argv.slice(2)

const eventType = args[0]

if (!eventType) {
  console.error('Please provide an event type name as the first argument.')
  process.exit(1)
}

const eventScope = eventType.split('.')[0]

const folderPath = path.resolve(import.meta.dirname, `../shared/events/${eventScope}`)

if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath, { recursive: true })
}

const classCode = `export class ${eventType}Payload {
  static readonly type = '${eventScope}.${eventType}'
  constructor() {}

  static decode(): ${eventType}Payload {
    return new ${eventType}Payload()
  }

  static encode(): any {
    return {}
  }
}
`

const filePath = path.join(folderPath, `${eventType}Payload.ts`)

fs.writeFileSync(filePath, classCode, 'utf-8')
console.log(`Event type class ${eventType}Payload created at ${filePath}`)

const minecraftEventBusPath = path.resolve(import.meta.dirname, '../shared/MinecraftEventBus.ts')
let minecraftEventBusContent = fs.readFileSync(minecraftEventBusPath, 'utf-8').split('\n')

minecraftEventBusContent = [
  `import { ${eventType}Payload } from './events/${eventScope}/${eventType}Payload.ts'`,
  ...minecraftEventBusContent,
]

const eventTypeEnd = minecraftEventBusContent.findIndex((line) =>
  line.includes('// EVENT TYPE DEFINITION END'),
)

minecraftEventBusContent.splice(eventTypeEnd, 0, `  ${eventType}Payload,`)

fs.writeFileSync(minecraftEventBusPath, minecraftEventBusContent.join('\n'), 'utf-8')
console.log(`MinecraftEventBus.ts updated with ${eventType}Payload import and registration.`)
