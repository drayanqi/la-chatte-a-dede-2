/**
 * MonacoEditor Component Unit Tests
 *
 * Tests the Monaco editor wrapper component:
 * - Renders with container and loading state
 * - Passes correct props to Monaco
 * - Has required test IDs
 *
 * Note: Monaco Editor loads asynchronously in tests, so we verify
 * the wrapper behavior rather than Monaco internals. E2E tests
 * validate full Monaco functionality.
 *
 * @see Epic 2: AI Development Workspace
 * @see Story 2.2: Monaco Editor Integration
 * @priority P0
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock @monaco-editor/react before importing component
const mockEditorComponent = vi.fn();
vi.mock('@monaco-editor/react', () => ({
  default: (props: Record<string, unknown>) => {
    mockEditorComponent(props);
    // Return loading state in tests (Monaco doesn't actually load)
    if (props.loading) {
      return props.loading;
    }
    return (
      <div
        data-testid="mock-monaco-internal"
        data-theme={props.theme}
        data-value={props.value}
      />
    );
  },
}));

// Import after mock
import { MonacoEditor } from '@/components/editor/MonacoEditor';

describe('MonacoEditor Component', () => {
  const defaultProps = {
    value: 'function update() { return {}; }',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render container with data-testid', () => {
      // WHEN: Rendering the component
      render(<MonacoEditor {...defaultProps} />);

      // THEN: Container should have testid
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('should render with correct background color', () => {
      // WHEN: Rendering the component
      render(<MonacoEditor {...defaultProps} />);

      // THEN: Should have VSCode dark background
      const container = screen.getByTestId('monaco-editor');
      expect(container).toHaveStyle({ backgroundColor: '#1e1e1e' });
    });

    it('should pass value to Monaco Editor', () => {
      // GIVEN: Code to display
      const code = 'function update(me, ball) { me.moveTo(ball); }';

      // WHEN: Rendering the component
      render(<MonacoEditor value={code} onChange={vi.fn()} />);

      // THEN: Monaco should receive the value
      expect(mockEditorComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          value: code,
        })
      );
    });

    it('should pass vs-dark theme to Monaco Editor', () => {
      // WHEN: Rendering the component
      render(<MonacoEditor {...defaultProps} />);

      // THEN: Monaco should receive vs-dark theme
      expect(mockEditorComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'vs-dark',
        })
      );
    });

    it('should pass loading element to Monaco Editor', () => {
      // WHEN: Rendering the component
      render(<MonacoEditor {...defaultProps} />);

      // THEN: Monaco should receive loading element
      expect(mockEditorComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          loading: expect.anything(),
        })
      );
    });
  });

  describe('Monaco Configuration', () => {
    it('should configure JavaScript as default language', () => {
      // WHEN: Rendering the component
      render(<MonacoEditor {...defaultProps} />);

      // THEN: Monaco should be configured for JavaScript
      expect(mockEditorComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultLanguage: 'javascript',
        })
      );
    });

    it('should configure editor options', () => {
      // WHEN: Rendering the component
      render(<MonacoEditor {...defaultProps} />);

      // THEN: Monaco should receive editor options
      expect(mockEditorComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
          }),
        })
      );
    });

    it('should set height to 100%', () => {
      // WHEN: Rendering the component
      render(<MonacoEditor {...defaultProps} />);

      // THEN: Monaco should have 100% height
      expect(mockEditorComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          height: '100%',
        })
      );
    });
  });

  describe('Change Handling', () => {
    it('should pass onChange handler to Monaco Editor', () => {
      // GIVEN: onChange callback
      const handleChange = vi.fn();

      // WHEN: Rendering the component
      render(<MonacoEditor value="code" onChange={handleChange} />);

      // THEN: Monaco should receive an onChange handler
      expect(mockEditorComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          onChange: expect.any(Function),
        })
      );
    });

    it('should handle undefined value in onChange', () => {
      // GIVEN: onChange callback
      const handleChange = vi.fn();
      render(<MonacoEditor value="code" onChange={handleChange} />);

      // WHEN: Monaco calls onChange with undefined
      const monacoOnChange = mockEditorComponent.mock.calls[0][0].onChange;
      monacoOnChange(undefined);

      // THEN: Should call parent onChange with empty string
      expect(handleChange).toHaveBeenCalledWith('');
    });

    it('should pass actual value in onChange', () => {
      // GIVEN: onChange callback
      const handleChange = vi.fn();
      render(<MonacoEditor value="code" onChange={handleChange} />);

      // WHEN: Monaco calls onChange with new value
      const monacoOnChange = mockEditorComponent.mock.calls[0][0].onChange;
      monacoOnChange('new code');

      // THEN: Should call parent onChange with the value
      expect(handleChange).toHaveBeenCalledWith('new code');
    });
  });

  describe('Optional Props', () => {
    it('should call onMount handler when editor mounts', () => {
      // GIVEN: onMount callback
      const handleMount = vi.fn();

      // WHEN: Rendering with onMount
      render(<MonacoEditor {...defaultProps} onMount={handleMount} />);

      // THEN: Monaco should receive an onMount handler (wrapper)
      expect(mockEditorComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          onMount: expect.any(Function),
        })
      );

      // Simulate Monaco calling onMount
      const monacoOnMount = mockEditorComponent.mock.calls[0][0].onMount;
      const mockEditor = { addCommand: vi.fn() };
      monacoOnMount(mockEditor);

      // THEN: User's onMount should be called with editor
      expect(handleMount).toHaveBeenCalledWith(mockEditor);
    });

    it('should add Cmd+S keybinding when onSave is provided', () => {
      // GIVEN: onSave callback
      const handleSave = vi.fn();

      // WHEN: Rendering with onSave
      render(<MonacoEditor {...defaultProps} onSave={handleSave} />);

      // Simulate Monaco calling onMount
      const monacoOnMount = mockEditorComponent.mock.calls[0][0].onMount;
      const mockEditor = { addCommand: vi.fn() };
      monacoOnMount(mockEditor);

      // THEN: Should add command for Cmd+S
      expect(mockEditor.addCommand).toHaveBeenCalledWith(
        2097, // KeyMod.CtrlCmd | KeyCode.KeyS
        expect.any(Function)
      );

      // Verify the handler calls onSave
      const saveHandler = mockEditor.addCommand.mock.calls[0][1];
      saveHandler();
      expect(handleSave).toHaveBeenCalled();
    });
  });
});
