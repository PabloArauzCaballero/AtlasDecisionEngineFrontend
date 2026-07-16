interface RouteSkeletonProps {
  label?: string;
}

export function RouteSkeleton({ label = 'Cargando contenido' }: RouteSkeletonProps) {
  return (
    <section className="route-skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="skeleton-line skeleton-eyebrow" />
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-description" />
      <div className="skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="skeleton-card" key={index} />
        ))}
      </div>
      <div className="skeleton-table" />
    </section>
  );
}
