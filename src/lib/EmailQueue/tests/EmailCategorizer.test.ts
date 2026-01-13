import { describe, it, expect } from 'vitest';
import { EmailCategorizer } from '../EmailCategorizer';
import { EmailMetadata } from '../types';

describe('EmailCategorizer', () => {
  const categorizer = new EmailCategorizer(
    ['good-domain.com'],
    ['bad-domain.com'],
    [
      {
        id: 'rule1',
        name: 'Urgent Rule',
        priority: 10,
        condition: (email) => email.subject.includes('Super Urgent'),
        action: () => ({ category: 'Important', subCategory: 'SuperUrgent' })
      }
    ]
  );

  const baseEmail: EmailMetadata = {
    id: '1',
    subject: 'Hello',
    from: 'user@example.com',
    to: ['me@example.com'],
    body: 'Just saying hi',
    headers: {},
    receivedAt: new Date(),
    flags: []
  };

  it('should categorize based on whitelist', async () => {
    const email = { ...baseEmail, from: 'friend@good-domain.com' };
    const result = await categorizer.categorize(email);
    expect(result.category).toBe('Important');
    expect(result.ruleApplied).toBe('DomainWhitelist');
  });

  it('should categorize based on blacklist', async () => {
    const email = { ...baseEmail, from: 'spammer@bad-domain.com' };
    const result = await categorizer.categorize(email);
    expect(result.category).toBe('Spam');
    expect(result.ruleApplied).toBe('DomainBlacklist');
  });

  it('should categorize based on user rules', async () => {
    const email = { ...baseEmail, subject: 'This is Super Urgent' };
    const result = await categorizer.categorize(email);
    expect(result.category).toBe('Important');
    expect(result.subCategory).toBe('SuperUrgent');
    expect(result.ruleApplied).toBe('UserRule:Urgent Rule');
  });

  it('should categorize based on content keywords', async () => {
    const email = { ...baseEmail, body: 'You won a lottery prize' };
    const result = await categorizer.categorize(email);
    expect(result.category).toBe('Spam');
  });

  it('should categorize based on headers', async () => {
    const email = { ...baseEmail, headers: { 'x-priority': '1' } };
    const result = await categorizer.categorize(email);
    expect(result.category).toBe('Important');
  });

  it('should default to Inbox', async () => {
    const result = await categorizer.categorize(baseEmail);
    expect(result.category).toBe('Inbox');
  });
});
