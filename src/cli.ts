#!/usr/bin/env npx tsx
/**
 * CLI entry point for Allegorithm.
 *
 * Usage:
 *   allegorithm repl          Start the interactive REPL
 *   allegorithm run <file>    Execute a .alg file
 *   allegorithm --help        Show usage
 *   allegorithm               Start the REPL (default)
 */

import * as fs from 'node:fs';
import { run, mkDefaultContext } from './index.js';
import { prettyPrint } from './printer/printer.js';
import { startRepl } from './repl/repl.js';

const args = process.argv.slice(2);

function showHelp(): void {
  console.log(`
Allegorithm v0.1.0 — A language that speaks in the language of meaning.

Usage:
  allegorithm repl          Start the interactive REPL
  allegorithm run <file>    Execute a .alg file
  allegorithm --help        Show this help

If no command is given, the REPL starts.
`.trim());
}

async function main(): Promise<void> {
  const command = args[0];

  if (command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  if (command === 'run') {
    const filePath = args[1];
    if (!filePath) {
      console.error('Error: run requires a file path.');
      console.error('Usage: allegorithm run <file.alg>');
      process.exit(1);
    }

    let source: string;
    try {
      source = fs.readFileSync(filePath, 'utf-8');
    } catch (err: any) {
      console.error(`Error reading ${filePath}: ${err.message}`);
      process.exit(1);
    }

    try {
      const ctx = mkDefaultContext();
      const result = await run(source, ctx);
      // Print the final result if it's not nil
      if (!(result.kind === 'atom' && result.isSymbol && result.value === 'nil')) {
        console.log(prettyPrint(result));
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  if (command === 'repl' || command === undefined) {
    await startRepl();
    return;
  }

  console.error(`Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
