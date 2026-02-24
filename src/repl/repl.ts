/**
 * Interactive REPL for Allegorithm.
 */

import * as readline from 'node:readline';
import * as fs from 'node:fs';
import { parse } from '../parser/index.js';
import { evalExpr } from '../evaluator/eval.js';
import { mkContext } from '../evaluator/context.js';
import type { EvalContext } from '../evaluator/context.js';
import { preludeBindings } from '../evaluator/prelude.js';
import { extendEnv, emptyEnv } from '../types/index.js';
import type { AlgValue } from '../types/index.js';
import { prettyPrint } from '../printer/printer.js';

// Ensure all special forms are registered
import '../index.js';

/** Check if parentheses are balanced in input. */
function isComplete(input: string): boolean {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (const ch of input) {
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '(') depth++;
    if (ch === ')') depth--;
  }
  return depth <= 0 && !inString;
}

/** Check if a result is nil (should be suppressed in REPL output). */
function isNil(v: AlgValue): boolean {
  return v.kind === 'atom' && v.isSymbol && v.value === 'nil';
}

/** Start the interactive REPL. */
export async function startRepl(): Promise<void> {
  let ctx = mkContext({
    env: extendEnv(emptyEnv(), preludeBindings()),
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'alg> ',
  });

  console.log('Allegorithm v0.1.0');
  console.log('Type :help for commands, :quit to exit.\n');
  rl.prompt();

  let buffer = '';

  const processLine = async (line: string) => {
    const trimmed = line.trim();

    // Handle commands
    if (buffer === '' && trimmed.startsWith(':')) {
      await handleCommand(trimmed, ctx, rl);
      // :reset returns a new context
      if (trimmed === ':reset') {
        ctx = mkContext({
          env: extendEnv(emptyEnv(), preludeBindings()),
        });
      }
      rl.prompt();
      return;
    }

    buffer += (buffer ? '\n' : '') + line;

    if (!isComplete(buffer)) {
      rl.setPrompt('...> ');
      rl.prompt();
      return;
    }

    const source = buffer;
    buffer = '';
    rl.setPrompt('alg> ');

    if (source.trim() === '') {
      rl.prompt();
      return;
    }

    try {
      const ast = parse(source);
      let result: AlgValue = { kind: 'atom', value: 'nil', isSymbol: true };
      for (const node of ast) {
        result = await evalExpr(node, ctx);
      }
      if (!isNil(result)) {
        console.log(prettyPrint(result));
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
    }

    rl.prompt();
  };

  rl.on('line', (line) => {
    processLine(line).catch((err) => {
      console.error(`Error: ${err.message}`);
      rl.prompt();
    });
  });

  rl.on('close', () => {
    console.log('\nFarewell.');
    process.exit(0);
  });
}

/** Handle REPL meta-commands. */
async function handleCommand(cmd: string, ctx: EvalContext, rl: readline.Interface): Promise<void> {
  const parts = cmd.split(/\s+/);
  const command = parts[0];

  switch (command) {
    case ':help':
      console.log(`
Commands:
  :help          Show this help
  :quit, :exit   Exit the REPL
  :load <file>   Load and evaluate a .alg file
  :readings      Show active reading stack
  :court         Show active court
  :facts         Dump evidence database
  :reset         Reset the environment
`.trim());
      break;

    case ':quit':
    case ':exit':
      console.log('Farewell.');
      process.exit(0);
      break;

    case ':load': {
      const filePath = parts.slice(1).join(' ');
      if (!filePath) {
        console.error(':load requires a file path');
        break;
      }
      try {
        const source = fs.readFileSync(filePath, 'utf-8');
        const ast = parse(source);
        let result: AlgValue = { kind: 'atom', value: 'nil', isSymbol: true };
        for (const node of ast) {
          result = await evalExpr(node, ctx);
        }
        if (!isNil(result)) {
          console.log(prettyPrint(result));
        }
      } catch (err: any) {
        console.error(`Error loading ${filePath}: ${err.message}`);
      }
      break;
    }

    case ':readings':
      if (ctx.readings.length === 0) {
        console.log('No active readings.');
      } else {
        for (const r of ctx.readings) {
          console.log(`  \uD83D\uDD2E ${r.name} (metric: ${r.metric})`);
        }
      }
      break;

    case ':court':
      if (!ctx.court) {
        console.log('No active court.');
      } else {
        console.log(`  Court: ${ctx.court.topic}`);
      }
      break;

    case ':facts': {
      const db = ctx.options.__evidenceDB as any;
      if (!db || !db.entries || db.entries.size === 0) {
        console.log('No evidence recorded.');
      } else {
        for (const [claim, entry] of db.entries) {
          const s = (entry as any).support?.length ?? 0;
          const r = (entry as any).refutation?.length ?? 0;
          let status = 'NEITHER';
          if (s > 0 && r > 0) status = 'BOTH';
          else if (s > 0) status = 'TRUE';
          else if (r > 0) status = 'FALSE';
          console.log(`  ${claim}: ${status} (${s} support, ${r} refutation)`);
        }
      }
      break;
    }

    case ':reset':
      console.log('Environment reset.');
      break;

    default:
      console.error(`Unknown command: ${command}. Type :help for available commands.`);
  }
}
