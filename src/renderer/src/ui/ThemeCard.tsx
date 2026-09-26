import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Chip } from './Text';
import type { MoodLike } from './types';

export interface ThemeCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  glyph: string;
  title: ReactNode;
  description?: ReactNode;
  /** The mood this theme maps to; its swatches and glyph render in that mood's tokens. */
  mood: MoodLike;
  selected: boolean;
}

/** Theme picker card (FR-2): glyph, palette swatches, accent glow when selected. */
export function ThemeCard({ glyph, title, description, mood, selected, className, ...rest }: ThemeCardProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={['panel', 'themecard', selected ? 'selected' : '', className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      <span className="themecard-top">
        <span className="themecard-glyph" data-mood={mood} aria-hidden="true">
          {glyph}
        </span>
        {selected && <Chip tone="accent">selected</Chip>}
      </span>
      <span className="display themecard-title">{title}</span>
      {description !== undefined && <span className="reading themecard-desc">{description}</span>}
      <span className="themecard-swatches" data-mood={mood} aria-hidden="true">
        <span className="swatch swatch-accent" />
        <span className="swatch swatch-accent2" />
        <span className="swatch swatch-base" />
      </span>
    </button>
  );
}
