import { ASTNode } from './ast.js';
import { Token, tokenize, TokenizerError } from './tokenizer.js';

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number,
  ) {
    super(`${message} at line ${line}, col ${col}`);
    this.name = 'ParseError';
  }
}

export function parse(source: string): ASTNode[] {
  const tokens = tokenize(source);
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function parseAtom(token: Token): ASTNode {
    switch (token.type) {
      case 'number':
        return { type: 'number', value: Number(token.value), line: token.line, col: token.col };
      case 'string':
        return { type: 'string', value: token.value, line: token.line, col: token.col };
      case 'symbol':
        return { type: 'symbol', name: token.value, line: token.line, col: token.col };
      default:
        throw new ParseError(`Unexpected token: ${token.value}`, token.line, token.col);
    }
  }

  function parseExpr(): ASTNode {
    const token = advance();
    if (!token) {
      throw new ParseError('Unexpected end of input', 1, 1);
    }

    // Quote sugar: 'expr => (quote expr)
    if (token.type === 'quote') {
      const quoted = parseExpr();
      return {
        type: 'list',
        elements: [
          { type: 'symbol', name: 'quote', line: token.line, col: token.col },
          quoted,
        ],
        line: token.line,
        col: token.col,
      };
    }

    // List
    if (token.type === 'lparen') {
      const elements: ASTNode[] = [];
      while (true) {
        const next = peek();
        if (!next) {
          throw new ParseError('Unmatched opening parenthesis', token.line, token.col);
        }
        if (next.type === 'rparen') {
          advance(); // consume ')'
          break;
        }
        elements.push(parseExpr());
      }
      return { type: 'list', elements, line: token.line, col: token.col };
    }

    if (token.type === 'rparen') {
      throw new ParseError('Unexpected closing parenthesis', token.line, token.col);
    }

    return parseAtom(token);
  }

  const forms: ASTNode[] = [];
  while (pos < tokens.length) {
    forms.push(parseExpr());
  }
  return forms;
}

export { TokenizerError, ParseError as ParserError };
