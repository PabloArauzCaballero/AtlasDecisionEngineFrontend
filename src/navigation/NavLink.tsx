'use client';

import Link, { useLinkStatus } from 'next/link';
import { useEffect, useId, type ReactNode } from 'react';
import { useNavigationProgress } from './useNavigationProgress';

/**
 * Reports this link's navigation state upward and renders an inline spinner.
 *
 * `useLinkStatus` only reports from inside a `<Link>`, so this has to be a
 * child component rather than a hook call in `NavLink` itself.
 */
function LinkPendingIndicator({ showSpinner }: { showSpinner: boolean }) {
  const { pending } = useLinkStatus();
  const { setPending } = useNavigationProgress();
  const id = useId();

  useEffect(() => {
    setPending(id, pending);
    // Unmounting mid-navigation must not leave the progress bar running.
    return () => setPending(id, false);
  }, [id, pending, setPending]);

  if (!pending || !showSpinner) return null;
  return <span className="inline-spinner nav-link-spinner" aria-hidden="true" />;
}

interface NavLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  'aria-current'?: 'page';
  /** Renders a spinner in the link while its route loads. */
  showSpinner?: boolean;
}

/**
 * A `<Link>` that feeds the shared route progress bar and shows its own
 * pending state, so a click on a slow route is acknowledged immediately.
 */
export function NavLink({
  href,
  children,
  className,
  onClick,
  showSpinner = true,
  'aria-current': ariaCurrent,
}: NavLinkProps) {
  return (
    <Link href={href} className={className} onClick={onClick} aria-current={ariaCurrent}>
      {children}
      <LinkPendingIndicator showSpinner={showSpinner} />
    </Link>
  );
}
