import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

import { createQueryClient } from "../../shared/libs/query";
import { isNativePlatform } from "../../shared/libs/capacitor";

type QueryProviderProps = {
  children: ReactNode;
};

export const AppQueryProvider = ({ children }: QueryProviderProps) => {
  const [client] = useState<QueryClient>(() => createQueryClient());

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
};

