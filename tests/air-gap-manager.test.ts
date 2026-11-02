import { describe, it, expect, beforeEach } from 'vitest';
import { AirGapManager, AirGapViolationException } from '../src/main/services/air-gap.manager';

describe('AirGapManager & Local Model Isolation Tests', () => {
  let airGap: AirGapManager;

  beforeEach(() => {
    airGap = new AirGapManager();
    // Reset to default disabled
    airGap.updateConfig({
      enabled: false,
      allowedHosts: ['127.0.0.1', 'localhost', '::1'],
      blockExternalNetwork: true,
      enforceLocalModels: true,
      defaultLocalModel: 'llama3:latest',
      localOllamaUrl: 'http://127.0.0.1:11434'
    });
  });

  describe('Network Egress Controls', () => {
    it('permits all network egress when Air-Gap is disabled', () => {
      expect(airGap.isAirGapEnabled()).toBe(false);
      expect(() => airGap.assertNetworkAllowed('https://api.anthropic.com/v1/messages')).not.toThrow();
      expect(() => airGap.assertNetworkAllowed('https://api.openai.com')).not.toThrow();
      expect(() => airGap.assertNetworkAllowed('http://localhost:11434')).not.toThrow();
    });

    it('permits localhost and loopback interfaces when Air-Gap is enabled', () => {
      airGap.updateConfig({ enabled: true });
      expect(airGap.isAirGapEnabled()).toBe(true);

      expect(() => airGap.assertNetworkAllowed('http://127.0.0.1:11434')).not.toThrow();
      expect(() => airGap.assertNetworkAllowed('http://localhost:8080')).not.toThrow();
      expect(() => airGap.assertNetworkAllowed('127.0.0.1')).not.toThrow();
      expect(() => airGap.assertNetworkAllowed('::1')).not.toThrow();
    });

    it('blocks external cloud endpoints with AirGapViolationException when Air-Gap is enabled', () => {
      airGap.updateConfig({ enabled: true });

      expect(() => airGap.assertNetworkAllowed('https://api.anthropic.com/v1/messages')).toThrow(
        AirGapViolationException
      );
      expect(() => airGap.assertNetworkAllowed('api.openai.com')).toThrow(AirGapViolationException);
      expect(() => airGap.assertNetworkAllowed('https://generativelanguage.googleapis.com')).toThrow(
        AirGapViolationException
      );
    });

    it('supports custom allowed local network hostnames', () => {
      airGap.updateConfig({
        enabled: true,
        allowedHosts: ['127.0.0.1', 'localhost', '::1', 'internal-ai-server.lan']
      });

      expect(() => airGap.assertNetworkAllowed('http://internal-ai-server.lan:5000/v1')).not.toThrow();
      expect(() => airGap.assertNetworkAllowed('https://external-service.com')).toThrow(
        AirGapViolationException
      );
    });
  });

  describe('Provider Resolution & Rerouting', () => {
    it('returns requested provider untouched when Air-Gap is disabled', () => {
      expect(airGap.resolveProvider('claude')).toBe('claude');
      expect(airGap.resolveProvider('codex')).toBe('codex');
      expect(airGap.resolveProvider('gemini')).toBe('gemini');
      expect(airGap.resolveProvider('ollama')).toBe('ollama');
    });

    it('seamlessly reroutes cloud providers to ollama when Air-Gap is enabled and enforceLocalModels is active', () => {
      airGap.updateConfig({
        enabled: true,
        enforceLocalModels: true
      });

      expect(airGap.resolveProvider('claude')).toBe('ollama');
      expect(airGap.resolveProvider('codex')).toBe('ollama');
      expect(airGap.resolveProvider('gemini')).toBe('ollama');
      expect(airGap.resolveProvider('ollama')).toBe('ollama');
    });

    it('rejects cloud providers with AirGapViolationException when Air-Gap is enabled and enforceLocalModels is false', () => {
      airGap.updateConfig({
        enabled: true,
        enforceLocalModels: false
      });

      expect(() => airGap.resolveProvider('claude')).toThrow(AirGapViolationException);
      expect(() => airGap.resolveProvider('codex')).toThrow(AirGapViolationException);
      expect(() => airGap.resolveProvider('gemini')).toThrow(AirGapViolationException);
      // Ollama must still be allowed
      expect(airGap.resolveProvider('ollama')).toBe('ollama');
    });
  });
});
