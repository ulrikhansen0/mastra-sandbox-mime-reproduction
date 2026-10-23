import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { SandboxFilesystem } from '@mastra/code-sdk/agents/sandbox-filesystem'
import { createWorkspaceTools, Workspace } from '@mastra/core/workspace'

const run = promisify(execFile)
const workdir = await realpath(await mkdtemp(join(tmpdir(), 'mastra-image-repro-')))
try {
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7x8AAAAASUVORK5CYII=',
    'base64',
  )
  await writeFile(join(workdir, 'page.png'), image)
  const filesystem = new SandboxFilesystem({
    workdir,
    sandbox: {
      id: 'local-shell',
      async executeCommand(command, args = [], options) {
        const { stdout, stderr } = await run(command, args, {
          timeout: options?.timeout,
          maxBuffer: 1024 * 1024,
        })
        return { stdout, stderr, exitCode: 0 }
      },
    },
  })
  const tools = await createWorkspaceTools(new Workspace({ id: 'repro', filesystem }))
  const read = tools.mastra_workspace_read_file
  const result = await read.execute({ path: 'page.png', showLineNumbers: false }, {})
  const output = await read.toModelOutput(result)
  const stat = await filesystem.stat('page.png')
  console.log({ mimeType: stat.mimeType ?? null, resultType: typeof result, modelOutput: output ?? null })
  assert.equal(output?.type, 'content', 'read_file should return viewable image content')
  assert.ok(output.value.some(part => part.type === 'media' && part.mediaType === 'image/png'))
} finally {
  await rm(workdir, { recursive: true, force: true })
}
