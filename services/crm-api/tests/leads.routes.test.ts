jest.mock('../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.tenantId = 'tenant-1';
    req.franchiseId = 'franchise-1';
    req.userId = 'user-1';
    next();
  }
}));

jest.mock('../src/events/crm-events.producer', () => ({
  crmEventsProducer: {
    publishLeadEvent: jest.fn()
  }
}));

import request from 'supertest';
import app from '../src/app';
import { LeadsService } from '../src/services/leads.service';
import { crmEventsProducer } from '../src/events/crm-events.producer';

describe('CRM Leads Routes', () => {
  const leadsServiceInstance = {
    getLeads: jest.fn(),
    getLead: jest.fn(),
    createLead: jest.fn(),
    updateLead: jest.fn(),
    deleteLead: jest.fn(),
    deleteLeads: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(LeadsService.prototype, 'getLeads').mockImplementation(leadsServiceInstance.getLeads);
    jest.spyOn(LeadsService.prototype, 'getLead').mockImplementation(leadsServiceInstance.getLead);
    jest.spyOn(LeadsService.prototype, 'createLead').mockImplementation(leadsServiceInstance.createLead);
    jest.spyOn(LeadsService.prototype, 'updateLead').mockImplementation(leadsServiceInstance.updateLead);
    jest.spyOn(LeadsService.prototype, 'deleteLead').mockImplementation(leadsServiceInstance.deleteLead);
    jest.spyOn(LeadsService.prototype, 'deleteLeads').mockImplementation(leadsServiceInstance.deleteLeads);
  });

  it('returns tenant/franchise scoped leads', async () => {
    leadsServiceInstance.getLeads.mockResolvedValue([
      {
        id: 'lead-1',
        tenant_id: 'tenant-1',
        franchise_id: 'franchise-1',
        first_name: 'Jane',
        last_name: 'Doe',
        company: 'Acme',
        title: null,
        email: null,
        phone: null,
        status: 'new',
        source: 'web',
        description: null,
        notes: null,
        estimated_value: null,
        expected_close_date: null,
        lead_score: null,
        qualification_status: null,
        custom_fields: null,
        owner_id: null,
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      }
    ]);

    const response = await request(app).get('/api/crm/v1/leads').set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(leadsServiceInstance.getLeads).toHaveBeenCalledWith('tenant-1', 'franchise-1');
  });

  it('creates a lead and emits created event', async () => {
    leadsServiceInstance.createLead.mockResolvedValue({
      id: 'lead-2',
      tenant_id: 'tenant-1',
      franchise_id: 'franchise-1',
      first_name: 'John',
      last_name: 'Smith',
      company: null,
      title: null,
      email: null,
      phone: null,
      status: 'new',
      source: 'referral',
      description: null,
      notes: null,
      estimated_value: null,
      expected_close_date: null,
      lead_score: null,
      qualification_status: null,
      custom_fields: null,
      owner_id: null,
      created_by: 'user-1',
      created_at: '2026-01-02T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z'
    });

    const response = await request(app)
      .post('/api/crm/v1/leads')
      .set('Authorization', 'Bearer test-token')
      .send({
        first_name: 'John',
        last_name: 'Smith',
        status: 'new',
        source: 'referral'
      });

    expect(response.status).toBe(201);
    expect(leadsServiceInstance.createLead).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      expect.objectContaining({ first_name: 'John', last_name: 'Smith' }),
      'franchise-1'
    );
    expect(crmEventsProducer.publishLeadEvent).toHaveBeenCalled();
  });

  it('deletes a single lead in tenant/franchise scope', async () => {
    leadsServiceInstance.deleteLead.mockResolvedValue(true);

    const response = await request(app)
      .delete('/api/crm/v1/leads/lead-9')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(204);
    expect(leadsServiceInstance.deleteLead).toHaveBeenCalledWith('tenant-1', 'lead-9', 'franchise-1');
    expect(crmEventsProducer.publishLeadEvent).toHaveBeenCalled();
  });

  it('bulk deletes leads in tenant/franchise scope', async () => {
    leadsServiceInstance.deleteLeads.mockResolvedValue(2);

    const response = await request(app)
      .delete('/api/crm/v1/leads')
      .set('Authorization', 'Bearer test-token')
      .send({ ids: ['lead-3', 'lead-4'] });

    expect(response.status).toBe(200);
    expect(response.body.data.deletedCount).toBe(2);
    expect(leadsServiceInstance.deleteLeads).toHaveBeenCalledWith('tenant-1', ['lead-3', 'lead-4'], 'franchise-1');
  });
});
