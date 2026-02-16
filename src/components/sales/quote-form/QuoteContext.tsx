import { createContext, useContext, ReactNode } from 'react';
import { useQuoteRepositoryContext } from './useQuoteRepository';

type QuoteDataContextType = ReturnType<typeof useQuoteRepositoryContext>;

const QuoteDataContext = createContext<QuoteDataContextType | null>(null);

export function QuoteDataProvider({ children }: { children: ReactNode }) {
  const data = useQuoteRepositoryContext();

  return (
    <QuoteDataContext.Provider value={data}>
      {children}
    </QuoteDataContext.Provider>
  );
}

export function useQuoteContext() {
  const context = useContext(QuoteDataContext);
  if (!context) {
    throw new Error('useQuoteContext must be used within a QuoteDataProvider');
  }
  return context;
}

export type QuoteContextType = QuoteDataContextType;
