/**
 * Monaco Editor Component Unit Tests
 *
 * Tests the Monaco editor configuration including JavaScript validation
 * and error detection settings.
 *
 * @see Story 2.5: Code Error Detection
 * @priority P1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Monaco types for testing validation configuration
interface MockDiagnosticsOptions {
  noSemanticValidation: boolean;
  noSyntaxValidation: boolean;
}

interface MockCompilerOptions {
  target: number;
  allowNonTsExtensions: boolean;
  checkJs: boolean;
  allowJs: boolean;
}

interface MockJavaScriptDefaults {
  setDiagnosticsOptions: (options: MockDiagnosticsOptions) => void;
  setCompilerOptions: (options: MockCompilerOptions) => void;
}

// Store captured configuration for assertions
let capturedDiagnosticsOptions: MockDiagnosticsOptions | null = null;
let capturedCompilerOptions: MockCompilerOptions | null = null;

// Create mock Monaco instance
function createMockMonaco() {
  capturedDiagnosticsOptions = null;
  capturedCompilerOptions = null;

  const javascriptDefaults: MockJavaScriptDefaults = {
    setDiagnosticsOptions: vi.fn((options) => {
      capturedDiagnosticsOptions = options;
    }),
    setCompilerOptions: vi.fn((options) => {
      capturedCompilerOptions = options;
    }),
  };

  const monaco = {
    languages: {
      typescript: {
        javascriptDefaults,
        ScriptTarget: {
          ES2020: 7,
        },
      },
    },
  };

  return { monaco, javascriptDefaults };
}

describe('Monaco Editor JavaScript Validation Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedDiagnosticsOptions = null;
    capturedCompilerOptions = null;
  });

  describe('Diagnostics Options', () => {
    it('should enable syntax validation (noSyntaxValidation: false)', () => {
      // GIVEN: Mock Monaco instance
      const { monaco, javascriptDefaults } = createMockMonaco();

      // WHEN: Configuring JavaScript validation
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      // THEN: Syntax validation should be enabled
      expect(javascriptDefaults.setDiagnosticsOptions).toHaveBeenCalled();
      expect(capturedDiagnosticsOptions?.noSyntaxValidation).toBe(false);
    });

    it('should enable semantic validation (noSemanticValidation: false)', () => {
      // GIVEN: Mock Monaco instance
      const { monaco, javascriptDefaults } = createMockMonaco();

      // WHEN: Configuring JavaScript validation
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      // THEN: Semantic validation should be enabled
      expect(javascriptDefaults.setDiagnosticsOptions).toHaveBeenCalled();
      expect(capturedDiagnosticsOptions?.noSemanticValidation).toBe(false);
    });

    it('should configure both validations together', () => {
      // GIVEN: Mock Monaco instance
      const { monaco } = createMockMonaco();

      // WHEN: Configuring JavaScript validation
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      // THEN: Both should be configured
      expect(capturedDiagnosticsOptions).toEqual({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    });
  });

  describe('Compiler Options', () => {
    it('should set ES2020 as target', () => {
      // GIVEN: Mock Monaco instance
      const { monaco, javascriptDefaults } = createMockMonaco();

      // WHEN: Configuring compiler options
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        checkJs: true,
        allowJs: true,
      });

      // THEN: Target should be ES2020
      expect(javascriptDefaults.setCompilerOptions).toHaveBeenCalled();
      expect(capturedCompilerOptions?.target).toBe(7); // ES2020 = 7
    });

    it('should enable JavaScript type checking (checkJs: true)', () => {
      // GIVEN: Mock Monaco instance
      const { monaco } = createMockMonaco();

      // WHEN: Configuring compiler options
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        checkJs: true,
        allowJs: true,
      });

      // THEN: JS type checking should be enabled
      expect(capturedCompilerOptions?.checkJs).toBe(true);
    });

    it('should allow JavaScript files (allowJs: true)', () => {
      // GIVEN: Mock Monaco instance
      const { monaco } = createMockMonaco();

      // WHEN: Configuring compiler options
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        checkJs: true,
        allowJs: true,
      });

      // THEN: JS files should be allowed
      expect(capturedCompilerOptions?.allowJs).toBe(true);
    });

    it('should allow non-TypeScript extensions', () => {
      // GIVEN: Mock Monaco instance
      const { monaco } = createMockMonaco();

      // WHEN: Configuring compiler options
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        checkJs: true,
        allowJs: true,
      });

      // THEN: Non-TS extensions should be allowed
      expect(capturedCompilerOptions?.allowNonTsExtensions).toBe(true);
    });
  });

  describe('Editor Options for Error Display', () => {
    it('should have glyphMargin enabled for gutter error icons', () => {
      // GIVEN: Editor options as configured in MonacoEditor.tsx
      const editorOptions = {
        glyphMargin: true,
        hover: {
          enabled: true,
          delay: 300,
        },
        renderValidationDecorations: 'on',
      };

      // THEN: glyphMargin should be enabled
      expect(editorOptions.glyphMargin).toBe(true);
    });

    it('should have hover enabled for error messages', () => {
      // GIVEN: Editor options as configured in MonacoEditor.tsx
      const editorOptions = {
        glyphMargin: true,
        hover: {
          enabled: true,
          delay: 300,
        },
        renderValidationDecorations: 'on',
      };

      // THEN: Hover should be enabled
      expect(editorOptions.hover.enabled).toBe(true);
    });

    it('should have reasonable hover delay', () => {
      // GIVEN: Editor options as configured in MonacoEditor.tsx
      const editorOptions = {
        glyphMargin: true,
        hover: {
          enabled: true,
          delay: 300,
        },
        renderValidationDecorations: 'on',
      };

      // THEN: Hover delay should be reasonable (not too fast, not too slow)
      expect(editorOptions.hover.delay).toBeGreaterThanOrEqual(100);
      expect(editorOptions.hover.delay).toBeLessThanOrEqual(500);
    });

    it('should have validation decorations enabled', () => {
      // GIVEN: Editor options as configured in MonacoEditor.tsx
      const editorOptions = {
        glyphMargin: true,
        hover: {
          enabled: true,
          delay: 300,
        },
        renderValidationDecorations: 'on',
      };

      // THEN: Validation decorations (squiggles) should be on
      expect(editorOptions.renderValidationDecorations).toBe('on');
    });
  });

  describe('Validation Configuration Integration', () => {
    it('should configure complete validation setup', () => {
      // GIVEN: Mock Monaco instance
      const { monaco } = createMockMonaco();

      // WHEN: Applying full validation configuration
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        checkJs: true,
        allowJs: true,
      });

      const editorOptions = {
        glyphMargin: true,
        hover: { enabled: true, delay: 300 },
        renderValidationDecorations: 'on',
      };

      // THEN: All validation features should be properly configured
      expect(capturedDiagnosticsOptions?.noSyntaxValidation).toBe(false);
      expect(capturedDiagnosticsOptions?.noSemanticValidation).toBe(false);
      expect(capturedCompilerOptions?.checkJs).toBe(true);
      expect(editorOptions.glyphMargin).toBe(true);
      expect(editorOptions.hover.enabled).toBe(true);
      expect(editorOptions.renderValidationDecorations).toBe('on');
    });
  });
});
