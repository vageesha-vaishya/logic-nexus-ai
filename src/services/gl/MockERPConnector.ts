export type MockERPConnectorInput = {
  journalEntryId: string;
  tenantId: string;
  referenceId: string;
  type: 'INVOICE' | 'PAYMENT';
};

export type MockERPConnectorResult = {
  externalId: string;
};

export class MockERPConnector {
  static async syncJournalEntry(
    input: MockERPConnectorInput
  ): Promise<MockERPConnectorResult> {
    return {
      externalId: `MOCK-ERP-${input.tenantId}-${input.type}-${input.referenceId}-${input.journalEntryId}`,
    };
  }
}
