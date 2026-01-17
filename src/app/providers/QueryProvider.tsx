import type { QueryClient} from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode} from "react";
import { useState } from "react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { createQueryClient } from "../../shared/libs/query";

type QueryProviderProps = {
  children: ReactNode;
};

export const AppQueryProvider = ({ children }: QueryProviderProps) => {
  const [client] = useState<QueryClient>(() => createQueryClient());

  return (
    <QueryClientProvider client={client}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};

