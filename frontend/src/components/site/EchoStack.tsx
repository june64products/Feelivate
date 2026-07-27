/**
 * EchoStack — the signature typographic "echo" effect.
 * Layers 4 faded repetitions of a word behind a solid foreground copy, each
 * shifted up-left in 0.04em increments. Pure Clash Display, no imagery.
 */
const LAYERS = [
  { opacity: 0.14, offset: -0.16 },
  { opacity: 0.22, offset: -0.12 },
  { opacity: 0.32, offset: -0.08 },
  { opacity: 0.44, offset: -0.04 },
];

export default function EchoStack({ text, fontSize = '11vw', color = 'var(--text-primary)' }: { text: string; fontSize?: string; color?: string }) {
  const base: React.CSSProperties = {
    color,
    fontSize,
    fontFamily: "'Clash Display', 'Inter', sans-serif",
    fontWeight: 700,
    lineHeight: 0.9,
    letterSpacing: '-0.05em',
    whiteSpace: 'nowrap',
  };
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {LAYERS.map((l, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ ...base, position: 'absolute', top: 0, left: `${l.offset}em`, opacity: l.opacity, pointerEvents: 'none', userSelect: 'none' }}
        >
          {text}
        </span>
      ))}
      <span style={{ ...base, position: 'relative' }}>{text}</span>
    </div>
  );
}
