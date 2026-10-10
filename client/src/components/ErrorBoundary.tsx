import * as Sentry from '@sentry/react';
import type { ReactNode } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';

// Without a boundary, any error thrown while rendering unmounts the whole tree
// and leaves a blank page (LIF-280). Two layers:
//
// - AppErrorBoundary wraps everything in main.tsx. It sits outside the router,
//   auth and theme providers — any of them may be what crashed — so its
//   fallback uses plain links and a full reload, nothing from context.
// - PageErrorBoundary wraps the page inside Layout, so a crash in one page
//   keeps the sidebar and the user can navigate away. Layout keys it by
//   pathname, which resets it on navigation.
//
// Sentry.ErrorBoundary reports with the component stack. React doesn't rethrow
// a caught render error to window.onerror in production, so each error reaches
// Sentry once — from whichever boundary caught it.

interface FallbackProps {
  title: string;
  body: string;
  actions: ReactNode;
}

function Fallback({ title, body, actions }: FallbackProps) {
  return (
    <div role="alert" className="mx-auto w-full max-w-md text-center">
      <h1 className="text-2xl font-bold text-foreground">
        {title}
        <span className="text-brand-orange">.</span>
      </h1>
      <p className="mt-2 text-muted-foreground">{body}</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">{actions}</div>
    </div>
  );
}

const reload = () => window.location.reload();

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <Fallback
            title="Something went wrong"
            body="Paypr hit an unexpected problem. Your subscriptions are safe — reloading usually fixes it."
            actions={
              <>
                <Button onClick={reload}>Reload</Button>
                {/* A real link, not navigate(): the router may be what crashed. */}
                <a href="/dashboard" className={buttonVariants({ variant: 'outline' })}>
                  Go to dashboard
                </a>
              </>
            }
          />
        </div>
      }
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <div className="py-16">
          <Fallback
            title="This page didn't load"
            body="Something went wrong showing this page. Try again, or pick another page from the menu."
            actions={
              <>
                <Button onClick={resetError}>Try again</Button>
                <Button variant="outline" onClick={reload}>
                  Reload
                </Button>
              </>
            }
          />
        </div>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
