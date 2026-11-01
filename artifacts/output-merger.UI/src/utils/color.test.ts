import { withAlpha } from './color';

describe('withAlpha', () => {
  it('should convert 6-digit hex colors to rgba with the given alpha', () => {
    expect(withAlpha('#0080FF', 0.3)).toBe('rgba(0, 128, 255, 0.3)');
    expect(withAlpha('#123456', 0.25)).toBe('rgba(18, 52, 86, 0.25)');
  });

  it('should expand 3-digit hex colors', () => {
    expect(withAlpha('#0af', 0.5)).toBe('rgba(0, 170, 255, 0.5)');
    expect(withAlpha('#F0A', 0.5)).toBe('rgba(255, 0, 170, 0.5)');
  });

  it('should accept uppercase hex colors', () => {
    expect(withAlpha('#0AF', 0.5)).toBe('rgba(0, 170, 255, 0.5)');
    expect(withAlpha('#ABCDEF', 1)).toBe('rgba(171, 205, 239, 1)');
  });

  it('should support alpha 0 and 1', () => {
    expect(withAlpha('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
    expect(withAlpha('#FFFFFF', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('should trim whitespace around valid hex colors', () => {
    expect(withAlpha('  #0af ', 0.5)).toBe('rgba(0, 170, 255, 0.5)');
  });

  it('should pass non-hex values through unchanged', () => {
    expect(withAlpha('red', 0.3)).toBe('red');
    expect(withAlpha('rgb(1,2,3)', 0.3)).toBe('rgb(1,2,3)');
    expect(withAlpha('#12345', 0.3)).toBe('#12345');
    expect(withAlpha('#1234567', 0.3)).toBe('#1234567');
    expect(withAlpha('', 0.3)).toBe('');
  });

  it('should return the original (untrimmed) string for non-hex values with whitespace', () => {
    expect(withAlpha(' red ', 0.3)).toBe(' red ');
  });
});
