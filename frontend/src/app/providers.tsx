import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { queryClient } from './query-client';
import { router } from './router';

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4"
        id="toast-region"
      />
    </>
  );
}

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
