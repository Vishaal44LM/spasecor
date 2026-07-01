import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

type SearchValue = string | number | boolean | null | undefined;
type NavigateOptions = {
  to: string;
  params?: Record<string, string | number>;
  search?: Record<string, SearchValue>;
  replace?: boolean;
};

type RouterContextValue = {
  pathname: string;
  search: URLSearchParams;
  params: Record<string, string>;
  navigate: (target: string | NavigateOptions) => void;
};

const RouterContext = createContext<RouterContextValue | null>(null);

function toPath(target: string | NavigateOptions) {
  if (typeof target === "string") return target;
  let path = target.to;
  Object.entries(target.params ?? {}).forEach(([key, value]) => {
    path = path.replace(`$${key}`, encodeURIComponent(String(value)));
    path = path.replace(`:${key}`, encodeURIComponent(String(value)));
  });
  const params = new URLSearchParams();
  Object.entries(target.search ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function RouterProvider({ children, params = {} }: { children: ReactNode; params?: Record<string, string> }) {
  const [locationKey, setLocationKey] = useState(0);

  useEffect(() => {
    const update = () => setLocationKey((v) => v + 1);
    window.addEventListener("popstate", update);
    window.addEventListener("spasecor:navigate", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("spasecor:navigate", update);
    };
  }, []);

  const navigate = useCallback((target: string | NavigateOptions) => {
    const path = toPath(target);
    const replace = typeof target === "object" && target.replace;
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    window.dispatchEvent(new Event("spasecor:navigate"));
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const value = useMemo<RouterContextValue>(() => {
    void locationKey;
    return {
      pathname: window.location.pathname,
      search: new URLSearchParams(window.location.search),
      params,
      navigate,
    };
  }, [locationKey, navigate, params]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouterContext() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("RouterProvider is missing");
  return ctx;
}

export function useNavigate() {
  return useRouterContext().navigate;
}

export function useParams<T extends Record<string, string> = Record<string, string>>() {
  return useRouterContext().params as T;
}

export function useSearch() {
  const search = useRouterContext().search;
  return {
    mode: search.get("mode") ?? undefined,
    redirect: search.get("redirect") ?? undefined,
    confirmed: search.get("confirmed") ?? undefined,
    token: search.get("token") ?? undefined,
    invite: search.get("invite") ?? undefined,
  };
}

export function usePathname() {
  return useRouterContext().pathname;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & NavigateOptions;

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, params, search, replace, onClick, ...props },
  ref,
) {
  const navigate = useNavigate();
  const href = toPath({ to, params, search, replace });
  return (
    <a
      ref={ref}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        navigate({ to, params, search, replace });
      }}
      {...props}
    />
  );
});