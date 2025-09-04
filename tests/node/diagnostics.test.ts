import { describe, test, expect } from 'vitest';
import { toShaderCodeError } from '../../src/node/diagnostics';
import { setLogLevel } from '../../src';

const ERROR_1 = 'ParseError { message: "expected assignment or increment/decrement, found \"}\"", labels: [(Span { start: 905, end: 906 }, "expected assignment or increment/decrement")], notes: [] }';

setLogLevel('INFO');

describe('diagnostics', () => {
  test('can get shader code error', () => {
    const error = toShaderCodeError(ERROR_1);
    expect(error).toBeDefined();
    expect(error?.message).toBe('expected assignment or increment/decrement, found \"}\"');
    expect(error?.span.start).toBe(905);
    expect(error?.span.end).toBe(906);
  });
});
