export interface QueryExpression {
  clause(idx: number, alias?: string): string;
  values(): any[];
  logValues(): any[];
  instanceKey(): string;
}
