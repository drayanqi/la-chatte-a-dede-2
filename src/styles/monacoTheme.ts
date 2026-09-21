/**
 * La Ronde Monaco themes — the code panel speaks the same palette as the
 * rest of the UI (story 7.5, mockup .cl token colors):
 *
 * - LIGHT ("la-ronde"): Solarized-flavored — warm cream paper (#fdf6e3)
 *   instead of stark white, solarized token hues (green keywords, cyan
 *   strings, blue functions, magenta numbers), corail cursor as the brand
 *   accent. Pelo: "c'est trop blanc, je veux plus un truc genre solarized".
 * - DARK ("la-ronde-dark"): mockup [data-theme="dark"] code palette —
 *   keywords purple, strings green, functions blue, numbers corail.
 *
 * The editor keeps its own look by design (user directive): the rest of the
 * UI rides the theme tokens in tokens.css.
 */

import type * as Monaco from 'monaco-editor';

export const LA_RONDE_LIGHT_THEME = 'la-ronde';
export const LA_RONDE_DARK_THEME = 'la-ronde-dark';

export const defineLaRondeThemes = (monaco: typeof Monaco): void => {
  monaco.editor.defineTheme(LA_RONDE_LIGHT_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '93a1a1', fontStyle: 'italic' },
      { token: 'keyword', foreground: '859900' },
      { token: 'string', foreground: '2aa198' },
      { token: 'number', foreground: 'd33682' },
      { token: 'type.identifier', foreground: 'b58900' },
      { token: 'entity.name.function', foreground: '268bd2' },
      { token: 'delimiter', foreground: '657b83' },
    ],
    colors: {
      'editor.background': '#fdf6e3',
      'editor.foreground': '#657b83',
      'editorGutter.background': '#fdf6e3',
      'editor.lineHighlightBackground': '#eee8d5',
      'editorLineNumber.foreground': '#93a1a1',
      'editorLineNumber.activeForeground': '#586e75',
      'editorCursor.foreground': '#ff6b57',
      'editor.selectionBackground': '#ffc24440',
      'editor.inactiveSelectionBackground': '#ffc24420',
      'editorIndentGuide.background1': '#586e7526',
      'editorWidget.border': '#93a1a1',
      'editorError.foreground': '#dc322f',
      'editorWarning.foreground': '#b58900',
      'editorSuggestWidget.background': '#fdf6e3',
      'editorSuggestWidget.selectedBackground': '#eee8d5',
      'editorHoverWidget.background': '#fdf6e3',
    },
  });

  monaco.editor.defineTheme(LA_RONDE_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8fa89a', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c98ae8' },
      { token: 'string', foreground: '7fd39a' },
      { token: 'number', foreground: 'ff6b57' },
      { token: 'type.identifier', foreground: '6db3ef' },
      { token: 'entity.name.function', foreground: '6db3ef' },
      { token: 'delimiter', foreground: 'eaf6ee' },
    ],
    colors: {
      'editor.background': '#182a1f',
      'editor.foreground': '#eaf6ee',
      'editorGutter.background': '#182a1f',
      'editor.lineHighlightBackground': '#13221a',
      'editorLineNumber.foreground': '#4e6356',
      'editorLineNumber.activeForeground': '#8fa89a',
      'editorCursor.foreground': '#ff6b57',
      'editor.selectionBackground': '#ffc24440',
      'editor.inactiveSelectionBackground': '#ffc24420',
      'editorIndentGuide.background1': '#eaf6ee1f',
      'editorWidget.border': '#eaf6ee1f',
      'editorError.foreground': '#ff6b57',
      'editorWarning.foreground': '#ffc244',
      'editorSuggestWidget.background': '#182a1f',
      'editorSuggestWidget.selectedBackground': '#13221a',
      'editorHoverWidget.background': '#182a1f',
    },
  });
};
