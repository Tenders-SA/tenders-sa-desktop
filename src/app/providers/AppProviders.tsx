import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "../../components/common/ErrorBoundary";
import { logger } from "../../services/observability";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The transport (TASK-0.7) already applies its own bounded,
        // safe-idempotent retry policy. Retrying again here would
        // multiply attempts and defeat PERF-3's "no unbounded parent
        // requests" rule.
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary
      onError={(error) =>
        // The redactor reduces the Error to its class name; the
        // message is dropped because it can quote payload content.
        logger.error("shell.render.crashed", { error })
      }
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ErrorBoundary>
  );
}
