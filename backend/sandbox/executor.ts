import { instrumentCode } from '../tracer/instrumenter';
import { transpileCppToJs } from './cppTranspiler';
import { transpilePythonToJs } from './pythonTranspiler';
import { Timeline, ExecutionStep, ConsoleLog } from '../../types';

export const executeCode = (userCode: string, language: string = 'javascript'): Promise<Timeline> => {
  return new Promise((resolve, reject) => {
    const timeline: Timeline = [];
    const currentLogs: ConsoleLog[] = [];
    let lastLine = 0;

    try {
      let codeToInstrument = userCode;

      // Transpile if C++ or Python
      if (language === 'c++' || language === 'cpp') {
        try {
          codeToInstrument = transpileCppToJs(userCode);
        } catch (transpileError: any) {
          throw new Error(`Transpilation Failed: ${transpileError.message} `);
        }
      } else if (language === 'python' || language === 'py') {
        try {
          codeToInstrument = transpilePythonToJs(userCode);
        } catch (transpileError: any) {
          throw new Error(`Transpilation Failed: ${transpileError.message} `);
        }
      }

      const instrumented = instrumentCode(codeToInstrument);
      let stepCount = 0;
      const MAX_STEPS = 2000;

      const tracer = {
        stack: ['main'],
        currentLine: 1,
        _inputValues: [5, 10, 3, 7, 1, 42, 100, 0, -1, 99],
        _inputIndex: 0,

        enter: (name: string) => {
          tracer.stack.push(name);
        },

        exit: () => {
          if (tracer.stack.length > 1) { // Don't pop 'main'
            tracer.stack.pop();
          }
        },

        setLine: (line: number) => {
          tracer.currentLine = line;
          lastLine = line;
        },

        step: (line: number, vars: any) => {
          if (stepCount++ > MAX_STEPS) throw new Error("Execution limit exceeded (infinite loop detection).");

          tracer.currentLine = line;
          lastLine = line;

          const safeVars = JSON.parse(JSON.stringify(vars, (key, value) => {
            if (typeof value === 'function') return '[Function]';
            if (value === undefined) return 'undefined';
            if (Number.isNaN(value)) return 'NaN';
            return value;
          }));

          // Fix mapping for C++ line numbers?
          // Since the transpiler preserves newlines mostly (except removing headers), 
          // line mapping should be roughly accurate for the body of main.
          // However, we stripped headers, so JS line 1 might be C++ line 5.
          // For MVP, we assume the user focuses on the logic inside main.

          timeline.push({
            line,
            variables: safeVars,
            callStack: [...tracer.stack],
            consoleOutput: [...currentLogs]
          });
        },

        checkLoop: () => {
          if (stepCount > MAX_STEPS) return true;
          return false;
        },

        log: (...args: any[]) => {
          const message = args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
          ).join(' ');
          currentLogs.push({ type: 'log', message });
        },

        input: () => {
          // Return pre-seeded sample values for cin visualization
          const val = tracer._inputValues[tracer._inputIndex % tracer._inputValues.length];
          tracer._inputIndex++;
          currentLogs.push({ type: 'log', message: `[input] → ${val} ` });
          return val;
        }
      };

      const wrappedCode = `
const __tracer = arguments[0];
const console = {
  log: __tracer.log,
  error: __tracer.log,
  warn: __tracer.log
};

try {
          ${instrumented}
} catch (e) {
  throw e;
}
`;

      new Function(wrappedCode).call(null, tracer);

      resolve(timeline);

    } catch (e: any) {
      // Use the last known line number for the error
      let errorLine = lastLine;

      resolve([
        ...timeline,
        {
          line: errorLine,
          variables: timeline.length > 0 ? timeline[timeline.length - 1].variables : {},
          callStack: timeline.length > 0 ? timeline[timeline.length - 1].callStack : ['main'],
          consoleOutput: [
            ...currentLogs,
            { type: 'error', message: `Runtime Error: ${e.message} ` }
          ],
          isError: true,
          errorMessage: e.message
        }
      ]);
    }
  });
};
