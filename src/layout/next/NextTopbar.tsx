'use client';

import { Menu } from 'lucide-react';
import { useEnvironmentLabel } from '../../config/EnvironmentLabelProvider';
import { GlobalSearchBox } from '../../features/search/GlobalSearchBox';
import { NotificationCenter } from '../../notifications/NotificationCenter';
import { ThemeToggle } from '../../theme/ThemeToggle';
import { UserMenu } from './UserMenu';

interface NextTopbarProps {
  onMenu: () => void;
}

export function NextTopbar({ onMenu }: NextTopbarProps) {
  const environmentLabel = useEnvironmentLabel();

  return (
    <header className="topbar">
      <button
        className="icon-button menu-button"
        type="button"
        onClick={onMenu}
        aria-label="Abrir navegación"
      >
        <Menu />
      </button>
      <GlobalSearchBox />
      <div className="topbar-spacer" />
      {/* Antes decía "Production" siempre, incluso corriendo contra sandbox.
          Ahora se muestra el ambiente declarado en la configuración y, si no
          hay ninguno declarado, no se muestra nada: mejor un hueco que una
          afirmación falsa sobre dónde está trabajando el usuario. */}
      {environmentLabel ? (
        <div
          data-tutorial-id="environment-chip"
          className={`environment-chip ${environmentLabel === 'PRODUCTION' ? '' : 'environment-nonprod'}`}
          title={
            environmentLabel === 'PRODUCTION'
              ? 'Estás trabajando contra el ambiente productivo.'
              : `Estás trabajando contra ${environmentLabel}, no contra producción.`
          }
        >
          <span /> {environmentLabel}
        </div>
      ) : null}
      <ThemeToggle />
      <NotificationCenter />
      <UserMenu />
    </header>
  );
}
