import { queryPolicyIntelligence } from './policyIntelligenceService';

export async function queryFlowise(prompt: string): Promise<string> {
  const response = await queryPolicyIntelligence(prompt, 'briefing');
  return response.answer;
}
