export interface VariableMap {
  [key: string]: any;
}

export interface ConsoleLog {
  type: 'log' | 'error' | 'warn';
  message: string;
}

export interface ExecutionStep {
  line: number;
  variables: VariableMap;
  callStack: string[];
  consoleOutput: ConsoleLog[];
  isError?: boolean;
  errorMessage?: string;
}

export type Timeline = ExecutionStep[];

export interface ExecutionResult {
  timeline: Timeline;
  error?: string;
}

export interface Breakpoint {
  line: number;
  enabled: boolean;
}