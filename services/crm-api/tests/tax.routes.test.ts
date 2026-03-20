jest.mock('../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.tenantId = 'tenant-1';
    req.franchiseId = 'franchise-1';
    req.userId = 'user-1';
    next();
  }
}));

import request from 'supertest';
import app from '../src/app';
import { TaxService } from '../src/services/tax.service';

describe('Tax Routes', () => {
  const taxServiceInstance = {
    calculateTax: jest.fn(),
    uploadExemptionCertificate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TaxService.prototype, 'calculateTax').mockImplementation(taxServiceInstance.calculateTax);
    jest
      .spyOn(TaxService.prototype, 'uploadExemptionCertificate')
      .mockImplementation(taxServiceInstance.uploadExemptionCertificate);
  });

  it('calculates tax for valid payload', async () => {
    taxServiceInstance.calculateTax.mockResolvedValue({
      hasNexus: true,
      jurisdictions: ['US-CA'],
      jurisdictionCode: 'US-CA',
      totalTax: 8.25,
      breakdown: [{ level: 'JURISDICTION', rate: 0.0825, amount: 8.25 }],
      lineItems: [{ id: 'line-1', taxAmount: 8.25, taxRate: 0.0825 }]
    });

    const response = await request(app)
      .post('/api/v1/tax/calculate')
      .set('Authorization', 'Bearer test-token')
      .send({
        origin: {
          street: '1 Main St',
          city: 'Dallas',
          state: 'TX',
          zip: '75001',
          country: 'US'
        },
        destination: {
          street: '100 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
          country: 'US'
        },
        items: [{ id: 'line-1', amount: 100, taxCode: 'SaaS-001' }]
      });

    expect(response.status).toBe(200);
    expect(response.body.totalTax).toBe(8.25);
    expect(taxServiceInstance.calculateTax).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        destination: expect.objectContaining({ state: 'CA' }),
        items: expect.arrayContaining([expect.objectContaining({ amount: 100 })])
      })
    );
  });

  it('rejects invalid payload', async () => {
    const response = await request(app)
      .post('/api/v1/tax/calculate')
      .set('Authorization', 'Bearer test-token')
      .send({
        destination: {
          street: '100 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
          country: 'US'
        },
        items: [{ amount: 100 }]
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(taxServiceInstance.calculateTax).not.toHaveBeenCalled();
  });

  it('uploads tax exemption certificate for valid payload', async () => {
    taxServiceInstance.uploadExemptionCertificate.mockResolvedValue({
      certificateNumber: 'CERT-001',
      issuingAuthority: 'State Board',
      exemptionType: 'government',
      expirationDate: '2027-12-31',
      uploadedAt: '2026-03-20T00:00:00.000Z',
      uploadedBy: 'user-1'
    });

    const response = await request(app)
      .post('/api/v1/tax/exemptions/certificates')
      .set('Authorization', 'Bearer test-token')
      .send({
        accountId: 'account-1',
        certificateNumber: 'CERT-001',
        issuingAuthority: 'State Board',
        exemptionType: 'government',
        expirationDate: '2027-12-31'
      });

    expect(response.status).toBe(201);
    expect(taxServiceInstance.uploadExemptionCertificate).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      expect.objectContaining({
        accountId: 'account-1',
        certificateNumber: 'CERT-001'
      })
    );
    expect(response.body.certificateNumber).toBe('CERT-001');
  });

  it('rejects invalid tax exemption upload payload', async () => {
    const response = await request(app)
      .post('/api/v1/tax/exemptions/certificates')
      .set('Authorization', 'Bearer test-token')
      .send({
        accountId: 'account-1',
        certificateNumber: 1001,
        exemptionType: 'government',
        expirationDate: '2027-12-31'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(taxServiceInstance.uploadExemptionCertificate).not.toHaveBeenCalled();
  });
});
