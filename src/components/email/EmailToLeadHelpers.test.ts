import { describe, it, expect } from 'vitest';
import optionsConfig from '@/config/Options_Transport_Mode.json';
import interestedConfig from '@/config/Interested_Transport_Mode_checker_config.json';
import { parseTransportOptionsJSON, extractEmailAddress } from './email-to-lead-helpers';

describe('EmailToLead Configuration', () => {
    it('should load Options_Transport_Mode.json with valid system_prompt', () => {
        expect(optionsConfig).toBeDefined();
        expect(optionsConfig.system_prompt).toBeDefined();
        expect(typeof optionsConfig.system_prompt).toBe('string');
        expect(optionsConfig.system_prompt).toContain("strict JSON format");
    });

    it('should load Interested_Transport_Mode_checker_config.json with valid system_prompt', () => {
        expect(interestedConfig).toBeDefined();
        expect(interestedConfig.system_prompt).toBeDefined();
        expect(typeof interestedConfig.system_prompt).toBe('string');
        expect(interestedConfig.system_prompt).toContain("plain text");
    });
});

describe('parseTransportOptionsJSON', () => {
    it('should parse valid JSON array', () => {
        const input = `[{"seqNo": "1", "mode": "Test", "price": "100", "transitTime": "1 day", "bestFor": "Test", "interchangePoints": "None", "logic": "Test"}]`;
        const result = parseTransportOptionsJSON(input);
        expect(result).toHaveLength(1);
        expect(result[0].mode).toBe("Test");
    });

    it('should parse JSON object with options key', () => {
        const input = `{"options": [{"seqNo": "1", "mode": "Test", "price": "100", "transitTime": "1 day", "bestFor": "Test", "interchangePoints": "None", "logic": "Test"}]}`;
        const result = parseTransportOptionsJSON(input);
        expect(result).toHaveLength(1);
        expect(result[0].mode).toBe("Test");
    });

    it('should parse markdown wrapped JSON', () => {
        const input = "```json\n[{\"seqNo\": \"1\", \"mode\": \"Test\", \"price\": \"100\", \"transitTime\": \"1 day\", \"bestFor\": \"Test\", \"interchangePoints\": \"None\", \"logic\": \"Test\"}]\n```";
        const result = parseTransportOptionsJSON(input);
        expect(result).toHaveLength(1);
        expect(result[0].mode).toBe("Test");
    });

    it('should parse JSON with surrounding noise (fallback)', () => {
        const input = `Here is the JSON:
        [{"seqNo": "1", "mode": "Test", "price": "100", "transitTime": "1 day", "bestFor": "Test", "interchangePoints": "None", "logic": "Test"}]
        Hope this helps.`;
        const result = parseTransportOptionsJSON(input);
        expect(result).toHaveLength(1);
        expect(result[0].mode).toBe("Test");
    });

    it('should throw error on invalid format', () => {
        const input = "Just some text";
        expect(() => parseTransportOptionsJSON(input)).toThrow();
    });
});

describe('extractEmailAddress', () => {
    it('should extract email from name <email> format', () => {
        expect(extractEmailAddress('John Doe <john@example.com>')).toBe('john@example.com');
    });

    it('should extract email from simple email', () => {
        expect(extractEmailAddress('john@example.com')).toBe('john@example.com');
    });
});
