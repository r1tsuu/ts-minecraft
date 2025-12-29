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

const classCode = `import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class ${eventName} extends MinecraftEvent {
  static readonly type = '${eventScope}.${eventName}'

  constructor() {
    super()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static deserialize(obj: any): ${eventName} {
    return new ${eventName}()
  }

  serialize() {
    return {}
  }
}
`

const filePath = path.join(folderPath, `${eventName}.ts`)

fs.writeFileSync(filePath, classCode, 'utf-8')
console.log(`Event class ${eventName} created at ${filePath}`)

const minecraftEventBusPath = path.resolve(import.meta.dirname, './src/shared/MinecraftEventBus.ts')

// Update the index.ts file in the event scope folder
const indexPath = path.join(folderPath, 'index.ts')
let indexContent = ''

if (fs.existsSync(indexPath)) {
  indexContent = fs.readFileSync(indexPath, 'utf-8')
}

// Add import for the new event
const importStatement = `import { ${eventName} } from './${eventName}.ts'\n`
if (!indexContent.includes(importStatement)) {
  indexContent = importStatement + indexContent
}

// Add event to the export object
const scopeName = eventScope.charAt(0).toUpperCase() + eventScope.slice(1)
const exportObjectRegex = new RegExp(`export const ${scopeName}Event = \\{([^}]*)\\}`, 's')
const match = indexContent.match(exportObjectRegex)

if (match) {
  const currentExports = match[1]
  const newExport = `  ${eventName},\n`

  if (!currentExports.includes(eventName)) {
    const updatedExports = currentExports.trimEnd() + '\n' + newExport
    indexContent = indexContent.replace(
      exportObjectRegex,
      `export const ${scopeName}Event = {${updatedExports}}`,
    )
  }
} else {
  // Create the export object if it doesn't exist
  indexContent += `\nexport const ${scopeName}Event = {\n  ${eventName},\n}\n\nexport type ${scopeName}Event = typeof ${scopeName}Event\n`
}

fs.writeFileSync(indexPath, indexContent, 'utf-8')
console.log(`${scopeName}Event index.ts updated with ${eventName}.`)

// Now update MinecraftEventBus.ts if needed (it should auto-import from index files)
// The eventTypes array in MinecraftEventBus.ts automatically picks up all events from the index files
console.log(
  `Event ${eventName} added successfully. MinecraftEventBus.ts will auto-discover it from the ${scopeName}Event exports.`,
)

await prettier.resolveConfig(indexPath).then(async (options) => {
  const formatted = await prettier.format(indexContent, {
    ...options,
    parser: 'typescript',
  })
  fs.writeFileSync(indexPath, formatted, 'utf-8')
  console.log(`${scopeName}Event index.ts formatted with Prettier.`)

  const eslintEngine = new eslint.ESLint({ fix: true })
  const results = await eslintEngine.lintFiles([indexPath, filePath])
  await eslint.ESLint.outputFixes(results)
  console.log(`Files linted with ESLint.`)
})
