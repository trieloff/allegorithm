/**
 * Pretty-printer for all Allegorithm value types.
 *
 * printValue(v) → plain text representation
 * prettyPrint(v) → terminal-friendly with ANSI colors
 */

import type { AlgValue } from '../types/index.js';
import { TRUE, FALSE, BOTH, NEITHER } from '../types/index.js';

/** Plain text representation of any AlgValue. */
export function printValue(v: AlgValue): string {
  switch (v.kind) {
    case 'atom':
      if (v.isSymbol) return String(v.value);
      if (typeof v.value === 'string') return `"${v.value}"`;
      return String(v.value);

    case 'list':
      return `(${v.items.map(printValue).join(' ')})`;

    case 'closure':
      return `#<closure (${v.params.join(' ')})>`;

    case 'verdict':
      switch (v.bits) {
        case TRUE: return '\u2713 true';
        case FALSE: return '\u2717 false';
        case BOTH: return '\u26A1 BOTH (contradiction)';
        case NEITHER: return '\u25CB neither (underdetermined)';
      }
      break;

    case 'contra':
      return [
        `\u26A1 CONTRADICTION [tension: ${v.tension}] at "${v.site}"`,
        `  \u251C\u2500 yes: ${printValue(v.yes)}`,
        `  \u2514\u2500 no:  ${printValue(v.no)}`,
      ].join('\n');

    case 'hypothesis':
      return `? ${printValue(v.value)} [debt: "${v.debt}"]`;

    case 'authority':
      return `\uD83D\uDC64 ${v.name} (${v.authorityKind}, rank ${v.rank})`;

    case 'attestation':
      return `\uD83D\uDCDC ${v.authority.name} attests in ${v.court}`;

    case 'fable':
      return `\uD83D\uDCD6 <fable>`;

    case 'reading':
      return `\uD83D\uDD2E ${v.name}`;
  }
}

// ANSI color helpers
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;

/** Terminal-friendly representation with ANSI colors. */
export function prettyPrint(v: AlgValue): string {
  switch (v.kind) {
    case 'atom':
      if (v.isSymbol) return cyan(String(v.value));
      if (typeof v.value === 'string') return green(`"${v.value}"`);
      return yellow(String(v.value));

    case 'list':
      return `${dim('(')}${v.items.map(prettyPrint).join(' ')}${dim(')')}`;

    case 'closure':
      return dim(`#<closure (${v.params.join(' ')})>`);

    case 'verdict':
      switch (v.bits) {
        case TRUE: return green('\u2713 true');
        case FALSE: return red('\u2717 false');
        case BOTH: return yellow('\u26A1 BOTH (contradiction)');
        case NEITHER: return dim('\u25CB neither (underdetermined)');
      }
      break;

    case 'contra':
      return [
        yellow(`\u26A1 CONTRADICTION [tension: ${v.tension}] at "${v.site}"`),
        `  \u251C\u2500 yes: ${prettyPrint(v.yes)}`,
        `  \u2514\u2500 no:  ${prettyPrint(v.no)}`,
      ].join('\n');

    case 'hypothesis':
      return magenta(`? ${prettyPrint(v.value)} [debt: "${v.debt}"]`);

    case 'authority':
      return `\uD83D\uDC64 ${cyan(v.name)} ${dim(`(${v.authorityKind}, rank ${v.rank})`)}`;

    case 'attestation':
      return `\uD83D\uDCDC ${cyan(v.authority.name)} attests in ${cyan(v.court)}`;

    case 'fable':
      return dim(`\uD83D\uDCD6 <fable>`);

    case 'reading':
      return magenta(`\uD83D\uDD2E ${v.name}`);
  }
}
