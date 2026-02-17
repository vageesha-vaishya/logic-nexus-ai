import { useState } from 'react';
import { useQuoteContext } from './QuoteContext';

export function useQuoteData() {
  const {
    serviceTypes,
    services,
    carriers,
    ports,
    chargeCategories,
    chargeSides,
    chargeBases,
    serviceModes,
    tradeDirections,
    serviceLegCategories,
    containerTypes,
    containerSizes,
    accounts,
    contacts,
    opportunities,
    shippingTerms,
    currencies,
    isLoadingOpportunities,
    isLoadingServices,
    resolvedTenantId,
    setResolvedTenantId,
    setAccounts,
    setContacts,
    setOpportunities,
    setServices,
  } = useQuoteContext();

  const [resolvedContactLabels, setResolvedContactLabels] = useState<Record<string, string>>({});
  const [resolvedServiceLabels, setResolvedServiceLabels] = useState<Record<string, string>>({});
  const [resolvedCarrierLabels, setResolvedCarrierLabels] = useState<Record<string, string>>({});
  const [resolvedPackageCategoryLabels, setResolvedPackageCategoryLabels] = useState<Record<string, string>>({});
  const [resolvedPackageSizeLabels, setResolvedPackageSizeLabels] = useState<Record<string, string>>({});

  const refetchAccounts = () => {};

  const injectAccount = (acc: any) => {
    setAccounts(prev => [...prev, acc]);
  };

  const injectContact = (con: any) => {
    setContacts(prev => [...prev, con]);
  };

  const injectOpportunity = (opp: any) => {
    setOpportunities(prev => [...prev, opp]);
  };

  return {
    currencies,
    ports,
    carriers,
    shippingTerms,
    chargeCategories,
    chargeSides,
    chargeBases,
    serviceModes,
    tradeDirections,
    serviceLegCategories,
    containerTypes,
    containerSizes,
    accounts,
    opportunities,
    contacts,
    serviceTypes,
    services,
    isLoading: isLoadingServices,
    isLoadingOpportunities,
    setAccounts,
    setContacts,
    setOpportunities,
    setServices,
    resolvedContactLabels,
    resolvedServiceLabels,
    resolvedCarrierLabels,
    setResolvedContactLabels,
    setResolvedServiceLabels,
    setResolvedCarrierLabels,
    setResolvedTenantId,
    resolvedTenantId,
    refetchAccounts,
    injectAccount,
    injectContact,
    injectOpportunity,
    resolvedPackageCategoryLabels,
    resolvedPackageSizeLabels,
    setResolvedPackageCategoryLabels,
    setResolvedPackageSizeLabels,
  };
}
