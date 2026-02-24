export type TokenType =
  | 'lparen'
  | 'rparen'
  | 'string'
  | 'number'
  | 'symbol'
  | 'quote';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export class TokenizerError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number,
  ) {
    super(`${message} at line ${line}, col ${col}`);
    this.name = 'TokenizerError';
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  function peek(): string | undefined {
    return source[pos];
  }

  function advance(): string {
    const ch = source[pos++];
    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  function skipWhitespace(): void {
    while (pos < source.length) {
      const ch = peek()!;
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        advance();
      } else if (ch === ';') {
        // Comment: skip to end of line
        while (pos < source.length && peek() !== '\n') {
          advance();
        }
      } else {
        break;
      }
    }
  }

  function readString(): Token {
    const startLine = line;
    const startCol = col;
    advance(); // skip opening "
    let value = '';
    while (pos < source.length) {
      const ch = advance();
      if (ch === '"') {
        return { type: 'string', value, line: startLine, col: startCol };
      }
      if (ch === '\\') {
        if (pos >= source.length) {
          throw new TokenizerError('Unterminated escape sequence in string', line, col);
        }
        const esc = advance();
        switch (esc) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          default: value += '\\' + esc; break;
        }
      } else {
        value += ch;
      }
    }
    throw new TokenizerError('Unterminated string', startLine, startCol);
  }

  function isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  function isSymbolChar(ch: string): boolean {
    return (
      ch !== '(' &&
      ch !== ')' &&
      ch !== '"' &&
      ch !== "'" &&
      ch !== ';' &&
      ch !== ' ' &&
      ch !== '\t' &&
      ch !== '\n' &&
      ch !== '\r'
    );
  }

  function readNumberOrSymbol(): Token {
    const startLine = line;
    const startCol = col;
    let value = '';

    // Read the full token (everything up to whitespace/parens/quote/semicolon)
    while (pos < source.length && isSymbolChar(peek()!)) {
      value += advance();
    }

    // Try to parse as a number
    // Supports: 123, -123, 1.5, -1.5, 1/2 (ratio syntax later), 1e10, 1.5e-3
    if (isNumberLiteral(value)) {
      return { type: 'number', value, line: startLine, col: startCol };
    }

    return { type: 'symbol', value, line: startLine, col: startCol };
  }

  while (pos < source.length) {
    skipWhitespace();
    if (pos >= source.length) break;

    const ch = peek()!;
    const startLine = line;
    const startCol = col;

    if (ch === '(') {
      advance();
      tokens.push({ type: 'lparen', value: '(', line: startLine, col: startCol });
    } else if (ch === ')') {
      advance();
      tokens.push({ type: 'rparen', value: ')', line: startLine, col: startCol });
    } else if (ch === "'") {
      advance();
      tokens.push({ type: 'quote', value: "'", line: startLine, col: startCol });
    } else if (ch === '"') {
      tokens.push(readString());
    } else {
      tokens.push(readNumberOrSymbol());
    }
  }

  return tokens;
}

function isNumberLiteral(s: string): boolean {
  // Match integers, floats, and scientific notation
  // Optional leading sign, digits, optional decimal part, optional exponent
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s);
}
