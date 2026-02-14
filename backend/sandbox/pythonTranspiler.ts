
/**
 * A "best-effort" Python to JavaScript transpiler for educational visualization.
 * 
 * Strategy:
 * 1. Convert indentation to braces {} to make it JS-compatible structure-wise.
 * 2. regex-replace Python syntax to JS equivalents.
 * 
 * Limitations:
 * - Depends heavily on clean indentation.
 * - Does not support complex Python features (decorators, list comprehensions beyond basic, classes).
 * - Focused on standard DSA patterns (loops, arrays, recursion).
 */

export function transpilePythonToJs(pythonCode: string): string {
    let js = pythonCode;

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: Indentation to Braces
    // ═══════════════════════════════════════════════════════════════════════

    // We need to insert { at the end of block-starting lines, and } when indentation decreases.
    const lines = js.split('\n');
    const processedLines: string[] = [];
    const indentStack: number[] = [0]; // Stack of indent levels

    // Helper to get indent level (count spaces)
    // Assuming 4 spaces or 1 tab = 1 indentation unit is NOT strictly enforced, just raw space count
    const getIndent = (line: string) => {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines or comments, but preserve them in output (without indent logic)
        if (!trimmed || trimmed.startsWith('#')) {
            processedLines.push(line);
            continue;
        }

        const currentIndent = getIndent(line);
        const lastIndent = indentStack[indentStack.length - 1];

        if (currentIndent > lastIndent) {
            // Indent increased -> The PREVIOUS line triggered a block (e.g., if, for, def)
            // We need to add a '{' to the PREVIOUS non-empty line
            indentStack.push(currentIndent);

            // Find last non-empty line index in processedLines
            for (let j = processedLines.length - 1; j >= 0; j--) {
                const prevLine = processedLines[j];
                if (prevLine.trim() && !prevLine.trim().startsWith('#')) {
                    // Check if it already has a brace (unlikely in Python but good for safety)
                    if (!prevLine.trim().endsWith('{')) {
                        // Remove colon if present
                        let cleanPrev = prevLine.replace(/:\s*$/, '');
                        processedLines[j] = cleanPrev + ' {';
                    }
                    break;
                }
            }
        } else if (currentIndent < lastIndent) {
            // Indent decreased -> Close blocks
            while (indentStack.length > 1 && currentIndent < indentStack[indentStack.length - 1]) {
                indentStack.pop();
                // Add a closing brace line with correct indentation
                const closingIndent = ' '.repeat(indentStack[indentStack.length - 1]);
                processedLines.push(`${closingIndent}}`);
            }
        }

        processedLines.push(line);
    }

    // Close any remaining blocks at the end of file
    while (indentStack.length > 1) {
        indentStack.pop();
        const closingIndent = ' '.repeat(indentStack[indentStack.length - 1]);
        processedLines.push(`${closingIndent}}`);
    }

    js = processedLines.join('\n');


    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: Syntax Replacement
    // ═══════════════════════════════════════════════════════════════════════

    // --- Variables ---
    // Python variables don't have keywords. In JS strict mode/instrumenter, we usually need `let`.
    // However, detecting usage vs declaration is hard with regex. 
    // The instrumenter (tracer) is robust enough to handle assignments to global/scoped variables 
    // if we don't strictly use 'let'. But for best results in strict mode sandbox, we might want 'let'.
    // For now, we will rely on checking if it's an assignment `var = val` at proper indentation.
    // NOTE: JS doesn't support `x = 5` without declaration in strict mode. 
    // Strategy: We will try to rely on the fact that existing JS instrumenter might handle `x = 5` 
    // by turning it into global access or we inject `let` for first assignments. 
    // SIMPLIFICATION: We will replace direct assignments with `let` if it looks like a declaration.

    // Convert 'None' -> 'null'
    js = js.replace(/\bNone\b/g, 'null');
    js = js.replace(/\bTrue\b/g, 'true');
    js = js.replace(/\bFalse\b/g, 'false');

    // --- Functions ---
    // def myFunc(a, b): -> function myFunc(a, b) {
    js = js.replace(/def\s+(\w+)\s*\(([^)]*)\)\s*\{/g, 'function $1($2) {');

    // --- Output ---
    // print("Hello") -> console.log("Hello")
    js = js.replace(/\bprint\s*\(/g, 'console.log(');

    // --- Control Flow ---
    // if x > 5: -> if (x > 5) {
    js = js.replace(/if\s+(.+)\s*\{/g, 'if ($1) {');
    // elif x > 5: -> else if (x > 5) {
    js = js.replace(/elif\s+(.+)\s*\{/g, 'else if ($1) {');
    // else: -> else {
    js = js.replace(/else\s*\{/g, 'else {');

    // while x < 5: -> while (x < 5) {
    js = js.replace(/while\s+(.+)\s*\{/g, 'while ($1) {');

    // --- Loops ---
    // for i in range(n): -> for (let i = 0; i < n; i++) {
    js = js.replace(/for\s+(\w+)\s+in\s+range\s*\(\s*([^,)]+)\s*\)\s*\{/g, 'for (let $1 = 0; $1 < $2; $1++) {');
    // for i in range(start, end): -> for (let i = start; i < end; i++) {
    js = js.replace(/for\s+(\w+)\s+in\s+range\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*\{/g, 'for (let $1 = $2; $1 < $3; $1++) {');
    // for i in range(start, end, step): -> for (let i = start; i < end; i += step) {
    js = js.replace(/for\s+(\w+)\s+in\s+range\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*\{/g, 'for (let $1 = $2; $1 < $3; $1 += $4) {');

    // for x in collection: -> for (let x of collection) {
    js = js.replace(/for\s+(\w+)\s+in\s+(\w+)\s*\{/g, 'for (let $1 of $2) {');

    // --- Arrays / Lists ---
    // list.append(x) -> list.push(x)
    js = js.replace(/\.append\s*\(/g, '.push(');
    // list.pop(i) is different in Python (index) vs JS (no arg = last).
    // Python: pop() -> last, pop(0) -> first.
    js = js.replace(/\.pop\s*\(\s*\)/g, '.pop()');
    js = js.replace(/\.pop\s*\(\s*0\s*\)/g, '.shift()');

    // len(x) -> x.length
    js = js.replace(/len\s*\(([^)]+)\)/g, '$1.length');

    // list.insert(i, x) -> splice(i, 0, x)
    js = js.replace(/(\w+)\.insert\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, '$1.splice($2, 0, $3)');

    // --- String/Math ---
    // str(x) -> String(x)
    js = js.replace(/\bstr\s*\(/g, 'String(');
    // int(x) -> parseInt(x)
    js = js.replace(/\bint\s*\(/g, 'parseInt(');
    // float(x) -> parseFloat(x)
    js = js.replace(/\bfloat\s*\(/g, 'parseFloat(');

    // Math methods
    // We expect user to `import math` in Python, but we can just use `Math.` global in JS.
    // math.floor(x) -> Math.floor(x)
    js = js.replace(/math\.(\w+)\s*\(/g, 'Math.$1(');

    // Integer Division // -> Math.floor( / )
    // We need to be careful not to match comments (which are # in Python but // in JS output later).
    // Luckily, we haven't converted # to // yet (that happens in Step 169).
    // Simple regex: `a // b` -> `Math.floor(a / b)`
    // This is simple and might fail for complex expressions `(a+b) // c`, but for MVP it covers `range(n // 2)`.
    js = js.replace(/([a-zA-Z0-9_]+)\s*\/\/\s*([a-zA-Z0-9_]+)/g, 'Math.floor($1 / $2)');
    // Handle complex case with parens: `(...) // (...)` -> `Math.floor(...) / (...))` ?? Too complex for regex.
    // Let's stick to simple space-surrounded // for now, assuming standard formatting.
    // Better: `//` -> `/` inside `Math.floor(...)` wrapper? No.
    // We will just replace `//` with `/` and wrapping is hard.
    // For `range(n // 2)`, we specifically need integer division if we want exact parity with Python, 
    // but JS loop `i < n/2` works fine if it stays float?
    // No, `i < 3.5` means `i` goes 0, 1, 2, 3. `i < 3` (int div) means 0, 1, 2.
    // So `n // 2` MUST be `Math.floor`.

    // Hacky fix for `range` specifically first:
    // range(x // y) -> range(Math.floor(x / y))
    js = js.replace(/range\s*\(\s*(.+)\s*\/\/\s*(.+)\s*\)/g, 'range(Math.floor($1 / $2))');

    // General case: ` // ` -> ` / ` is WRONG (comment).
    // We'll trust that we catch `//` before comments # are converted.
    js = js.replace(/\s+\/\/\s+/g, ' / '); // DANGEROUS if not wrapped in Math.floor, but better than syntax error.
    // Actually, let's just do the specific `range` fix + general `Math.floor` attempt.
    js = js.replace(/(\w+)\s*\/\/\s*(\w+)/g, 'Math.floor($1 / $2)');

    // --- Comments ---
    // Comments are # in Python. We kept them but JS uses //.
    // We need to replace # with // EXCEPT inside strings.
    // Simple regex for # outside quotes is risky, but for simple code:
    js = js.replace(/#/g, '//');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: Variable Declaration Injection
    // ═══════════════════════════════════════════════════════════════════════
    // In strict mode (or for instrumenter to verify scopes), vars need declaration.
    // We'll replace simple assignments "x = 5" with "var x = 5".
    // We use 'var' instead of 'let' to avoid redeclaration errors in loops/blocks if simple regex matches multiple times.

    // Regex for assignment: start of line (with indent), word, space, =, space, something
    // We must exclude:
    // - comparisons (==, !=, <=, >=) which are handled by lookahead/logic
    // - augmentations (+=, -=)
    // - valid JS keywords (if, for, while, return) although 'return x = 5' is valid JS, it's rare in Python to start line.

    const lines2 = js.split('\n');
    const declaredVars = new Set<string>();

    for (let i = 0; i < lines2.length; i++) {
        let line = lines2[i];
        // Match "   name = val"
        // Constraints: 
        // 1. Not inside string/comment (assumed simplified for MVP)
        // 2. Not a keyword like "class X", "def X" (already handled)
        // 3. Not "if x = 5" (syntax error in Python anyway)

        const assignmentMatch = line.match(/^(\s*)([a-zA-Z_]\w*)\s*=(?!=)(.*)/);
        if (assignmentMatch) {
            const indent = assignmentMatch[1];
            const name = assignmentMatch[2];
            const rest = assignmentMatch[3];

            // Avoid injecting for keywords just in case
            if (['if', 'while', 'for', 'return', 'else', 'elif'].includes(name)) continue;

            // If already declared in this scope... well, simplistic "var" is safe for re-declaration in JS.
            // But we should try to only add 'var' 
            lines2[i] = `${indent}var ${name} =${rest}`;
        }
    }

    js = lines2.join('\n');

    return js;
}
