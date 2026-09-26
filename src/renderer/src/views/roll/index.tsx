/**
 * Roll surface (M11, FR-2/3/5) per `mocks/roll.html`: world list, import, then the forge form.
 * The `data-testid`s are the stable e2e contract (PROGRAM-CONFIG Conventions).
 */
import { Kicker } from '../../ui';
import { ForgeForm } from './ForgeForm';
import { ImportPanel } from './ImportPanel';
import { WorldList } from './WorldList';
import './roll.css';

export function RollView(): JSX.Element {
  return (
    <>
      <Kicker>Ruleswright · The Forge</Kicker>
      <h1 className="display roll-title">Roll a World</h1>
      <p className="roll-lede">A theme, a seed, a handful of knobs — the compiler does the rest.</p>
      <WorldList />
      <ImportPanel />
      <ForgeForm />
    </>
  );
}
