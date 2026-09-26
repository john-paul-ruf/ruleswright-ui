import type { HTMLAttributes, ReactNode } from 'react';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  /** Kicker header; in the urban mood it carries the hazard stripe. */
  kicker?: ReactNode;
  /** Right side of the header row (chips, counts). */
  aside?: ReactNode;
  as?: 'section' | 'div' | 'aside' | 'article';
  /** Inner padding: s 16 · m 20 · l 24 (mock p-4/p-5/p-6); none for custom layouts. */
  pad?: 's' | 'm' | 'l' | 'none';
}

function makePanel(level: 'panel' | 'panel2') {
  return function PanelLevel({ kicker, aside, as: Tag = 'section', pad = 'm', className, children, ...rest }: PanelProps): JSX.Element {
    return (
      <Tag className={[level, pad !== 'none' ? `pad-${pad}` : '', className ?? ''].filter(Boolean).join(' ')} {...rest}>
        {(kicker !== undefined || aside !== undefined) && (
          <header className="panel-head section-head">
            {kicker !== undefined && <p className="kicker">{kicker}</p>}
            {aside}
          </header>
        )}
        {children}
      </Tag>
    );
  };
}

/** Surface card with a hairline border. */
export const Panel = makePanel('panel');
/** Nested surface2 card (wells, sub-panels). */
export const Panel2 = makePanel('panel2');
