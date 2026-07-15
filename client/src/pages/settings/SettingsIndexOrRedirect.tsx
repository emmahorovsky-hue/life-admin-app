import { Navigate, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import SettingsIndex from './SettingsIndex';

/** /settings index route: desktop bounces to the Account tab, mobile shows the menu. */
export default function SettingsIndexOrRedirect() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const location = useLocation();
  if (isDesktop) {
    // Preserve the query string — the email-change confirmation can land on
    // /settings with ?emailChanged=true and AccountPanel reads it.
    return <Navigate to={{ pathname: '/settings/account', search: location.search }} replace />;
  }
  return <SettingsIndex />;
}
