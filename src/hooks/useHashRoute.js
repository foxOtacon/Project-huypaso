import { useCallback, useEffect, useState } from 'react';

function getRouteFromHash() {
  const hash = window.location.hash.slice(1);
  return hash || '/';
}

export function useHashRoute() {
  const [route, setRoute] = useState(getRouteFromHash);

  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((path) => {
    window.location.hash = path;
  }, []);

  return { route, navigate };
}
