/**
 * GuidePage - /guide route (story 8.4)
 *
 * The dedicated documentation page: every action demonstrated by the real
 * engine GIFs, the read-side reference and the tick laws — the in-app twin
 * of docs/scripting.md. Data source: src/lib/scriptingGuide.ts (same assets
 * as the repo docs — one source of truth).
 */

import { useState } from 'react';
import { Appbar } from '@/components/layout/Appbar';
import { CodeBlock } from '@/components/guide/CodeBlock';
import { GUIDE_TOPICS } from '@/lib/scriptingGuide';

export const GuidePage: React.FC = () => {
  const [activeId, setActiveId] = useState<string>(GUIDE_TOPICS[0]?.id ?? '');

  const scrollTo = (id: string) => {
    setActiveId(id);
    document.getElementById(`topic-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={styles.page}>
      <Appbar />
      <div style={styles.body}>
        <div data-testid="guide-page" style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>Guide du script</h1>
            <p style={styles.sub}>
              Les 4 actions, le duel moveToward vs dribble et tout ce que ton script peut lire —
              démontrés par le vrai moteur. Le contrat complet vit dans script-ia-api.md.
            </p>
          </div>

          <div style={styles.columns}>
            <nav style={styles.toc} data-testid="guide-toc">
              {GUIDE_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  data-testid={`guide-toc-${topic.id}`}
                  style={{
                    ...styles.tocItem,
                    ...(topic.id === activeId ? styles.tocItemActive : {}),
                  }}
                  onClick={() => scrollTo(topic.id)}
                >
                  {topic.label}
                </button>
              ))}
            </nav>

            <div style={styles.content}>
              {GUIDE_TOPICS.map((topic) => (
                <section key={topic.id} id={`topic-${topic.id}`} style={styles.section}>
                  <div style={styles.titleRow}>
                    <h2 style={styles.sectionTitle}>{topic.title}</h2>
                    {topic.signature && <code style={styles.signature}>{topic.signature}</code>}
                  </div>

                  {topic.gif && (
                    <img
                      data-testid={`guide-visual-${topic.id}`}
                      src={topic.gif}
                      alt={topic.gifAlt ?? ''}
                      style={styles.gif}
                    />
                  )}

                  {topic.paragraphs.map((paragraph, index) => (
                    <p key={index} style={styles.paragraph}>
                      {paragraph}
                    </p>
                  ))}

                  {topic.warning && (
                    <div data-testid={`guide-warning-${topic.id}`} style={styles.warning}>
                      {topic.warning}
                    </div>
                  )}

                  {topic.facts && (
                    <div style={styles.facts}>
                      {topic.facts.map((fact) => (
                        <div key={fact.term} style={styles.factRow}>
                          <code style={styles.factTerm}>{fact.term}</code>
                          <span style={styles.factDescription}>{fact.description}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(topic.code ?? []).map((block, index) => (
                    <CodeBlock
                      key={index}
                      code={block.body}
                      label={block.label}
                      codeTestid={`guide-code-${topic.id}`}
                      copyTestid={`guide-copy-${topic.id}`}
                    />
                  ))}
                </section>
              ))}

              <div style={styles.footerNote}>
                Démonstrations générées par le vrai moteur — régénérables avec npm run
                docs:scripting. Version complète : docs/scripting.md.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  body: {
    flex: 1,
    padding: '20px 24px 32px',
    display: 'flex',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '980px',
    background: 'var(--panel)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    padding: '24px 26px',
    alignSelf: 'flex-start',
  },
  header: {
    marginBottom: '18px',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--ink)',
    margin: 0,
  },
  sub: {
    color: 'var(--muted)',
    fontSize: '12.5px',
    marginTop: 4,
    lineHeight: 1.5,
  },
  columns: {
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-start',
  },
  toc: {
    flex: 'none',
    width: '180px',
    position: 'sticky',
    top: '84px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  tocItem: {
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: 'var(--r-btn)',
    border: 'none',
    background: 'transparent',
    color: 'var(--ink)',
    fontSize: '12.5px',
    cursor: 'pointer',
    fontFamily: 'var(--mono)',
  },
  tocItemActive: {
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1.5px var(--corail)',
    fontWeight: 700,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  section: {
    scrollMarginTop: '84px',
    paddingBottom: '22px',
    marginBottom: '22px',
    borderBottom: '1px solid var(--line)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    margin: '0 0 10px',
  },
  sectionTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--ink)',
    margin: 0,
  },
  signature: {
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    color: 'var(--ink)',
    background: 'var(--panel2)',
    borderRadius: '8px',
    padding: '4px 8px',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  gif: {
    width: '100%',
    maxWidth: '640px',
    borderRadius: '14px',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    display: 'block',
    marginBottom: '12px',
  },
  paragraph: {
    fontSize: '13px',
    lineHeight: 1.55,
    color: 'var(--ink)',
    margin: '0 0 10px',
    maxWidth: '640px',
  },
  warning: {
    fontSize: '12.5px',
    lineHeight: 1.5,
    color: 'var(--ink)',
    background: 'rgba(255, 107, 87, 0.12)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 107, 87, 0.4)',
    borderRadius: '12px',
    padding: '10px 12px',
    margin: '0 0 12px',
    maxWidth: '640px',
  },
  facts: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    margin: '0 0 12px',
  },
  factRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'baseline',
  },
  factTerm: {
    flex: 'none',
    minWidth: '210px',
    fontFamily: 'var(--mono)',
    fontSize: '11.5px',
    color: 'var(--ink)',
  },
  factDescription: {
    fontSize: '12.5px',
    color: 'var(--muted)',
  },
  footerNote: {
    fontSize: '11px',
    color: 'var(--muted)',
  },
};
