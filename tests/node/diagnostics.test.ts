import { toShaderCodeError } from '../../src/node/diagnostics';

const ERROR_1 = 'ParseError { message: "expected assignment or increment/decrement, found \"}\"", labels: [(Span { start: 905, end: 906 }, "expected assignment or increment/decrement")], notes: [] }';

describe('diagnostics', () => {
  test('can get shader code error', () => {
    const error = toShaderCodeError(ERROR_1);
    expect(error).toBeDefined();
    expect(error?.message).toBe('expected assignment or increment/decrement, found \"}\"');
    expect(error?.span.start).toBe(905);
    expect(error?.span.end).toBe(906);
  });
});
