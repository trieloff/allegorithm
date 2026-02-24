export type ASTNode =
  | NumberNode
  | StringNode
  | SymbolNode
  | ListNode;

export interface NumberNode {
  type: 'number';
  value: number;
  line: number;
  col: number;
}

export interface StringNode {
  type: 'string';
  value: string;
  line: number;
  col: number;
}

export interface SymbolNode {
  type: 'symbol';
  name: string;
  line: number;
  col: number;
}

export interface ListNode {
  type: 'list';
  elements: ASTNode[];
  line: number;
  col: number;
}
