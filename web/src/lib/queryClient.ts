import { QueryClient } from '@tanstack/react-query'

// staleTime > 0 evita refetch ao trocar de página e voltar (o maior ganho de
// performance percebido); gcTime mantém o cache vivo um pouco além disso para
// navegação rápida entre abas.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
