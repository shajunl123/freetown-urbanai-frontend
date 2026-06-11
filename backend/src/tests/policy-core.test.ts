import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db.js';
import {
  authenticateToken,
  createOrUpdateUser,
  loginWithPassword,
} from '../services/authService.js';
import { chunkText } from '../services/chunkingService.js';
import { composePolicyAnswer } from '../services/answerComposerService.js';
import { ingestDocument } from '../services/corpusIngestionService.js';
import {
  createDocument,
  getDocument,
  listDocumentChunks,
} from '../services/documentRegistry.js';
import {
  debugRetrieval,
  retrieveEvidence,
  retrievalSources,
} from '../services/retrievalService.js';
import { extractTextFromFile } from '../services/textExtractionService.js';
import { ensureSession } from '../services/sessionManager.js';
import {
  canInspectSessionHistory,
  isCorpusOperator,
  isPlatformOwner,
} from '../permissions.js';
import { resolveProviderConfig } from '../providers/config.js';
import { getPolicyAnswerFromUpstream } from '../services/upstreamPolicyService.js';

beforeEach(() => {
  db.exec(`
    DELETE FROM request_log;
    DELETE FROM messages;
    DELETE FROM sessions;
    DELETE FROM auth_sessions;
    DELETE FROM users;
    DELETE FROM document_texts;
    DELETE FROM chunks;
    DELETE FROM documents;
    INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild');
  `);
});

async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => Promise<T> | T
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('local auth stores hashed passwords and authenticates bearer tokens', () => {
  const user = createOrUpdateUser({
    email: 'admin@example.test',
    name: 'Admin User',
    password: 'strong-password-123',
    role: 'admin',
  });

  const stored = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(user.id) as { password_hash: string; password_salt: string };

  assert.notEqual(stored.password_hash, 'strong-password-123');
  assert.ok(stored.password_salt.length > 0);

  const login = loginWithPassword('admin@example.test', 'strong-password-123');
  assert.ok(login);
  assert.equal(login.user.role, 'admin');

  const authenticated = authenticateToken(login.token);
  assert.equal(authenticated?.id, user.id);
});

test('chat sessions are bound to one authenticated user', () => {
  const userA = createOrUpdateUser({
    email: 'a@example.test',
    name: 'Briefing User A',
    password: 'strong-password-123',
    role: 'briefing_user',
  });
  const userB = createOrUpdateUser({
    email: 'b@example.test',
    name: 'Briefing User B',
    password: 'strong-password-123',
    role: 'briefing_user',
  });

  ensureSession('shared-session', userA.id);
  assert.throws(() => ensureSession('shared-session', userB.id), /another user/);
});

test('role permissions separate platform owner from corpus operator', () => {
  const admin = createOrUpdateUser({
    email: 'owner@example.test',
    name: 'Platform Owner',
    password: 'strong-password-123',
    role: 'admin',
  });
  const operator = createOrUpdateUser({
    email: 'operator@example.test',
    name: 'Corpus Operator',
    password: 'strong-password-123',
    role: 'operator',
  });
  const briefingUser = createOrUpdateUser({
    email: 'briefing@example.test',
    name: 'Briefing User',
    password: 'strong-password-123',
    role: 'briefing_user',
  });

  assert.equal(isPlatformOwner(admin.role), true);
  assert.equal(isPlatformOwner(operator.role), false);
  assert.equal(isPlatformOwner(briefingUser.role), false);

  assert.equal(isCorpusOperator(admin.role), true);
  assert.equal(isCorpusOperator(operator.role), true);
  assert.equal(isCorpusOperator(briefingUser.role), false);

  assert.equal(canInspectSessionHistory(admin, briefingUser.id), true);
  assert.equal(canInspectSessionHistory(operator, briefingUser.id), false);
  assert.equal(canInspectSessionHistory(operator, operator.id), true);
  assert.equal(canInspectSessionHistory(briefingUser, operator.id), false);
  assert.equal(canInspectSessionHistory(briefingUser, briefingUser.id), true);
});

test('provider config resolves openai-compatible env-driven settings', async () => {
  await withEnv(
    {
      MODEL_PROVIDER_TYPE: 'openai_compatible',
      MODEL_PROVIDER_MODEL: 'gpt-test',
      MODEL_PROVIDER_BASE_URL: 'https://openai-compatible.example/v1',
      MODEL_PROVIDER_API_KEY_ENV_VAR: 'DASHSCOPE_API_KEY',
      DASHSCOPE_API_KEY: 'dashscope-test-key',
      MODEL_PROVIDER_API_KEY: undefined,
      LEGACY_N8N_CHAT_WEBHOOK_URL: undefined,
      N8N_CHAT_WEBHOOK_URL: undefined,
    },
    () => {
      const config = resolveProviderConfig();
      assert.equal(config.type, 'openai_compatible');
      assert.equal(config.model, 'gpt-test');
      assert.equal(config.baseUrl, 'https://openai-compatible.example/v1');
      assert.equal(config.apiKey, 'dashscope-test-key');
    }
  );
});

test('getPolicyAnswerFromUpstream normalizes openai-compatible provider output', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), 'https://openai-compatible.example/v1/chat/completions');
    assert.match(String(init?.body), /gpt-test/);
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                answer: 'OpenAI-compatible provider answer.',
                mode: 'briefing',
                caveats: ['Provider caveat'],
                claimSafety: {
                  level: 'careful',
                  explanation: 'Check approved source material.',
                },
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const response = await withEnv(
      {
        MODEL_PROVIDER_TYPE: 'openai_compatible',
        MODEL_PROVIDER_MODEL: 'gpt-test',
        MODEL_PROVIDER_BASE_URL: 'https://openai-compatible.example/v1',
        MODEL_PROVIDER_API_KEY: 'openai-test-key',
        LEGACY_N8N_CHAT_WEBHOOK_URL: undefined,
        N8N_CHAT_WEBHOOK_URL: undefined,
      },
      () =>
        getPolicyAnswerFromUpstream({
          sessionId: 'provider-openai-test',
          prompt: 'Prepare a briefing note',
          mode: 'briefing',
          evidence: [],
        })
    );

    assert.equal(response?.answer, 'OpenAI-compatible provider answer.');
    assert.equal(response?.claimSafety?.level, 'careful');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getPolicyAnswerFromUpstream normalizes anthropic provider output', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), 'https://api.anthropic.com/v1/messages');
    assert.match(String(init?.body), /claude-test/);
    return new Response(
      JSON.stringify({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              answer: 'Anthropic provider answer.',
              mode: 'briefing',
              caveats: ['Anthropic caveat'],
              claimSafety: {
                level: 'careful',
                explanation: 'Evidence should be checked.',
              },
            }),
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const response = await withEnv(
      {
        MODEL_PROVIDER_TYPE: 'anthropic',
        MODEL_PROVIDER_MODEL: 'claude-test',
        MODEL_PROVIDER_API_KEY: 'anthropic-test-key',
        MODEL_PROVIDER_BASE_URL: undefined,
        LEGACY_N8N_CHAT_WEBHOOK_URL: undefined,
        N8N_CHAT_WEBHOOK_URL: undefined,
      },
      () =>
        getPolicyAnswerFromUpstream({
          sessionId: 'provider-anthropic-test',
          prompt: 'Prepare a briefing note',
          mode: 'briefing',
          evidence: [],
        })
    );

    assert.equal(response?.answer, 'Anthropic provider answer.');
    assert.equal(response?.claimSafety?.level, 'careful');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getPolicyAnswerFromUpstream returns a safe fallback when provider is misconfigured', async () => {
  const response = await withEnv(
    {
      MODEL_PROVIDER_TYPE: 'openai_compatible',
      MODEL_PROVIDER_MODEL: 'gpt-test',
      MODEL_PROVIDER_API_KEY: '',
      MODEL_PROVIDER_API_KEY_ENV_VAR: undefined,
      LEGACY_N8N_CHAT_WEBHOOK_URL: undefined,
      N8N_CHAT_WEBHOOK_URL: undefined,
    },
    () =>
      getPolicyAnswerFromUpstream({
        sessionId: 'provider-misconfigured-test',
        prompt: 'Prepare a briefing note',
        mode: 'briefing',
        evidence: [],
      })
  );

  assert.match(response?.answer ?? '', /direct model provider is not currently available/i);
  assert.equal(response?.claimSafety?.level, 'careful');
});

test('extractTextFromFile normalizes html content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'urbanai-extract-'));
  const filePath = join(dir, 'brief.html');
  await writeFile(
    filePath,
    '<html><body><h1>Policy Brief</h1><p>Approved&nbsp;evidence &amp; notes.</p></body></html>',
    'utf8'
  );

  const extracted = await extractTextFromFile(filePath, 'brief.html');
  assert.equal(extracted.format, 'html');
  assert.match(extracted.content, /Policy Brief/);
  assert.match(extracted.content, /Approved evidence & notes/);
});

test('chunkText preserves headings in chunk metadata', () => {
  const text = `# Briefing Note\n\n${'A '.repeat(900)}\n\n## Evidence\n\n${'B '.repeat(900)}`;
  const chunks = chunkText(text);

  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0].section, 'Briefing Note');
  assert.ok(chunks.some((chunk) => chunk.section === 'Evidence'));
});

test('ingestDocument advances a document to indexed with chunks', async () => {
  const fixturePath = fileURLToPath(
    new URL('../../fixtures/demo-corpus/climate-portfolio-brief.md', import.meta.url)
  );

  const doc = createDocument({
    title: 'Climate Portfolio Brief',
    type: 'MD',
    sourceType: 'test',
    fileName: 'climate-portfolio-brief.md',
    filePath: fixturePath,
    mimeType: 'text/markdown',
    approval: 'approved',
    sensitivity: 'internal',
  });

  const result = await ingestDocument(doc.id);
  const updated = getDocument(doc.id);

  assert.equal(updated?.ingestion_status, 'indexed');
  assert.ok(updated?.indexed_at);
  assert.equal(result.chunks.length, listDocumentChunks(doc.id).length);
  assert.ok(result.text.char_count > 0);
});

test('retrieveEvidence returns ranked indexed chunks with debug metadata', async () => {
  const fixturePath = fileURLToPath(
    new URL('../../fixtures/demo-corpus/aqs-partner-qa.txt', import.meta.url)
  );

  const doc = createDocument({
    title: 'AQS Partner QA',
    type: 'TXT',
    sourceType: 'test',
    fileName: 'aqs-partner-qa.txt',
    filePath: fixturePath,
    mimeType: 'text/plain',
    approval: 'approved',
    sensitivity: 'internal',
  });

  await ingestDocument(doc.id);

  const results = retrieveEvidence('partner q&a safe wording for briefing', { limit: 3 });
  assert.ok(results.length > 0);
  assert.equal(results[0].documentId, doc.id);
  assert.match(results[0].rankReason, /approved/);

  const debug = debugRetrieval('partner q&a safe wording for briefing', { limit: 3 });
  assert.ok(debug.terms.includes('partner'));
  assert.equal(debug.results[0].documentId, doc.id);
});

test('retrieveEvidence defaults to approved-only and requires explicit draft opt-in', async () => {
  const fixturePath = fileURLToPath(
    new URL('../../fixtures/demo-corpus/aqs-partner-qa.txt', import.meta.url)
  );

  const approved = createDocument({
    title: 'Approved AQS Partner QA',
    type: 'TXT',
    sourceType: 'test',
    fileName: 'aqs-partner-qa.txt',
    filePath: fixturePath,
    mimeType: 'text/plain',
    approval: 'approved',
    sensitivity: 'internal',
  });
  const draft = createDocument({
    title: 'Draft AQS Partner QA',
    type: 'TXT',
    sourceType: 'test',
    fileName: 'aqs-partner-qa.txt',
    filePath: fixturePath,
    mimeType: 'text/plain',
    approval: 'draft',
    sensitivity: 'internal',
  });

  await ingestDocument(approved.id);
  await ingestDocument(draft.id);

  const normalResults = retrieveEvidence('partner q&a safe wording for briefing', { limit: 5 });
  assert.ok(normalResults.some((result) => result.documentId === approved.id));
  assert.ok(!normalResults.some((result) => result.documentId === draft.id));

  const debugResults = retrieveEvidence('partner q&a safe wording for briefing', {
    includeDrafts: true,
    documentIds: [draft.id],
    limit: 5,
  });
  assert.ok(debugResults.some((result) => result.documentId === draft.id));

  const debug = debugRetrieval('partner q&a safe wording for briefing', { includeDrafts: true });
  assert.equal(debug.filters.includeDrafts, true);
  assert.ok(debug.filters.approvalStatuses.includes('draft'));
});

test('composePolicyAnswer returns retrieval-backed sources and caveats', () => {
  const evidence = [
    {
      chunkId: 'chunk-1',
      documentId: 'doc-1',
      documentTitle: 'Executive Brief',
      documentType: 'MD',
      chunkIndex: 0,
      content: 'Approved briefing support language for donor engagement.',
      snippet: 'Approved briefing support language for donor engagement.',
      section: 'Briefing',
      page: 1,
      score: -1.2,
      rankReason: 'fts=-0.8, approved',
      approvalStatus: 'approved',
      sensitivityLevel: 'internal',
    },
  ];

  const response = composePolicyAnswer({
    mode: 'briefing',
    evidence,
    upstreamResponse: null,
  });

  assert.match(response.answer, /Local corpus evidence was retrieved/);
  assert.equal(response.claimSafety?.level, 'careful');
  assert.match(response.claimSafety?.explanation ?? '', /approved corpus evidence/);
  assert.equal(response.sources?.length, 1);
  assert.equal(response.sources?.[0]?.documentId, 'doc-1');
  assert.equal(retrievalSources(evidence)[0]?.approvalStatus, 'approved');
});
