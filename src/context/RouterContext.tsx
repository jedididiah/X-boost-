import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface RouterContextValue {
  pathname: string;
  search: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [locationState, setLocationState] = useState(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  }));

  useEffect(() => {
    const handlePopState = () => {
      setLocationState({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const [nextPath, nextQuery] = to.split('?');
    const normalizedPath = nextPath || '/';
    const normalizedSearch = nextQuery ? `?${nextQuery}` : '';
    const fullTarget = `${normalizedPath}${normalizedSearch}`;
    if (
      window.location.pathname !== normalizedPath ||
      window.location.search !== normalizedSearch
    ) {
      window.history.pushState({}, '', fullTarget);
      setLocationState({
        pathname: normalizedPath,
        search: normalizedSearch,
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <RouterContext.Provider value={{ ...locationState, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider');
  return ctx;
}
