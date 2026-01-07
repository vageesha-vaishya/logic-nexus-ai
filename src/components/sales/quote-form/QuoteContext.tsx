import { createContext, useContext, ReactNode } from 'react';
import { useQuoteData } from './useQuoteData';

type QuoteDataContextType = ReturnType<typeof useQuoteData>;

const QuoteDataContext = createContext<QuoteDataContextType | null>(null);

export function QuoteDataProvider({ children }: { children: ReactNode }) {
  const data = useQuoteData();

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
