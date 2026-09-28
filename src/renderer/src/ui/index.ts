/** Design-system components (M08): presentational + callbacks, tokens only, no store/engine imports. */
import './ui.css';

export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { Field, Input, Select, type FieldProps, type InputProps, type SelectProps } from './Field';
export { Chip, Kicker, ProgressBar, StatNumeral, type ChipProps, type ProgressBarProps, type StatNumeralProps } from './Text';
export { Panel, Panel2, type PanelProps } from './Panel';
export { ErrorCard, OkCard, type ErrorCardProps, type OkCardProps } from './ErrorCard';
export { ThemeCard, type ThemeCardProps } from './ThemeCard';
export {
  ArtifactRow,
  CombatantRow,
  RecordRow,
  type ArtifactRowProps,
  type CombatantRowProps,
  type RecordRowProps,
  type RecordStatus,
} from './Rows';
export { EventRow, type EventRowProps, type EventVariant } from './EventRow';
export {
  DeterminismStrip,
  EmptyWell,
  SnapshotCard,
  WorldPlate,
  type DeterminismState,
  type DeterminismStripProps,
  type EmptyWellProps,
  type SnapshotCardProps,
  type WorldPlateProps,
} from './Plates';
export {
  Board,
  CombatOverBanner,
  TokenMark,
  TriggerOffer,
  type BoardPiece,
  type BoardProps,
  type CombatOverBannerProps,
  type TriggerOfferProps,
} from './Combat';
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
export { JsonView, type JsonViewProps } from './JsonView';
export type { AppErrorLike, ErrorCardLike, MoodLike } from './types';
