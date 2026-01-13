import { describe, it, expect } from 'vitest';
import { classifyEmailContent } from '../../_shared/classification-logic.ts';

describe('Email Classification Logic', () => {
  it('classifies feedback correctly', () => {
    const result = classifyEmailContent('Customer Survey', 'Please provide your feedback via this survey link.');
    expect(result.category).toBe('feedback');
  });

  it('classifies CRM/Support correctly', () => {
    const result = classifyEmailContent('Help needed', 'I have an issue with my order.');
    expect(result.category).toBe('crm');
  });

  it('classifies very negative sentiment', () => {
    const result = classifyEmailContent('Complaint', 'This is the worst service ever! I am very angry.');
    expect(result.sentiment).toBe('very_negative');
  });

  it('classifies negative sentiment', () => {
    const result = classifyEmailContent('Issue', 'I am disappointed with the delay.');
    expect(result.sentiment).toBe('negative');
  });

  it('classifies positive sentiment', () => {
    const result = classifyEmailContent('Thanks', 'Great job! I love the new feature.');
    expect(result.sentiment).toBe('positive');
  });

  it('classifies sales intent', () => {
    const result = classifyEmailContent('Pricing inquiry', 'How much does it cost to buy the premium plan?');
    expect(result.intent).toBe('sales');
  });

  it('classifies support intent', () => {
    const result = classifyEmailContent('Bug report', 'The system is broken and giving an error.');
    expect(result.intent).toBe('support');
  });

  it('defaults to neutral/non_crm/other', () => {
    const result = classifyEmailContent('Meeting', 'Let us meet tomorrow.');
    expect(result.category).toBe('non_crm');
    expect(result.sentiment).toBe('neutral');
    expect(result.intent).toBe('other');
  });
});
