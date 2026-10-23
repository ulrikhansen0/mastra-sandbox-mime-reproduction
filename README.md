# SandboxFilesystem image reproduction

Minimal reproduction of an image being returned as text by Mastra's workspace `read_file` tool when it uses `SandboxFilesystem`.

## Run

Requires Node.js 24 and a POSIX shell (macOS or Linux).

```sh
git clone https://github.com/ulrikhansen0/mastra-sandbox-mime-reproduction.git
cd mastra-sandbox-mime-reproduction
npm ci --ignore-scripts
npm run reproduce
```

No API keys, LLM, cloud sandbox, Docker, environment file, or application code is needed. The script uses the real `SandboxFilesystem` and workspace tool, executes real local shell commands, and removes its temporary image afterward. Dependency install scripts are unnecessary for this reproduction.

## Expected

Reading the PNG should produce native media content for the model:

- `filesystem.stat('page.png').mimeType` is `image/png`.
- `read_file.toModelOutput(result)` returns `type: 'content'` containing the PNG as a media part.
- Both assertions pass.

## Actual

`npm run reproduce` prints:

```text
{ mimeType: null, resultType: 'string', modelOutput: null }
```

It then exits with code 1 on:

```text
AssertionError [ERR_ASSERTION]: read_file should return viewable image content
+ actual - expected

+ undefined
- 'content'
```

This is a runtime bug in the filesystem/tool interaction, before any model call; it is independent of `mastra dev`, `mastra build`, and the monorepo.

## Cause and proposed fix

The shell-backed `SandboxFilesystem.stat()` omits MIME metadata. The built-in workspace `read_file` checks `stat.mimeType` to choose native media output; missing metadata makes it take the text-reading path instead.

Populate MIME metadata for files using the same extension-based lookup as `LocalFilesystem`. Newer versions that delegate to a native provider should preserve provider-supplied MIME metadata and infer it only when absent. Directories should not receive an inferred file MIME type. The built-in media conversion needs no changes.

## Verified environment

- macOS 26.6.2, arm64
- Node.js 24.16.0
- npm 11.13.0
- `@mastra/core` 1.78.0
- `@mastra/code-sdk` 1.14.0

Both direct Mastra dependencies are pinned, with the full dependency graph recorded in `package-lock.json`.
