/**
 * CodeBlock — guide code display with syntax highlighting (story 8.4)
 * OWNER: Dev Team
 *
 * Static highlighting via Prism (javascript grammar) — NOT a Monaco mount
 * per block: a docs page must not pay an editor instance per snippet.
 * The token colors come from tokens.css (theme-aware La Ronde hues, scoped
 * under .guide-code). Input is our own static demo strings; Prism escapes
 * the rendered HTML.
 */

import { useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';

interface CodeBlockProps {
  code: string;
  /** Optional small uppercase label above the block (e.g. team name) */
  label?: string;
  /** Testid for the <pre> (guide-code-<topic>) */
  codeTestid: string;
  /** Testid for the copy button (guide-copy-<topic>) */
  copyTestid: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  label,
  codeTestid,
  copyTestid,
}) => {
  const [copied, setCopied] = useState(false);
  const grammar = Prism.languages.javascript;
  if (!grammar) {
    throw new Error('prism-javascript grammar failed to load');
  }
  const highlighted = Prism.highlight(code, grammar, 'javascript');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = code;
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand('copy');
      document.body.removeChild(fallback);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={styles.codeBlock}>
      {label && <div style={styles.codeLabel}>{label}</div>}
      <pre
        data-testid={codeTestid}
        className="guide-code language-javascript"
        style={styles.code}
      >
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
      <button data-testid={copyTestid} style={styles.copyButton} onClick={() => void copy()}>
        {copied ? 'Copié !' : 'Copier'}
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  codeBlock: {
    position: 'relative',
    margin: '0 0 12px',
    maxWidth: '640px',
  },
  codeLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    margin: '0 0 4px',
  },
  code: {
    margin: 0,
    padding: '12px 14px',
    background: 'var(--panel2)',
    borderRadius: '12px',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'var(--ink)',
    overflowX: 'auto',
    whiteSpace: 'pre',
  },
  copyButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '4px 10px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--panel)',
    color: 'var(--ink)',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
};
