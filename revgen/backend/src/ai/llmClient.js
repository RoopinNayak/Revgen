// ─────────────────────────────────────────────
// RevGen — Ollama LLM Client (Day 7 Stage 1)
// ─────────────────────────────────────────────
//
// Standalone HTTP client for local Ollama REST API.
// Uses Node.js built-in `http` module — zero external dependencies.
//
// Uses the /api/chat endpoint for proper Qwen3 thinking control.
//
// SAFETY GUARANTEES:
// 1. Read-only — never mutates any database or external state.
// 2. 100% local — connects only to localhost:11434 (Ollama).
// 3. Graceful failure — returns null on any error (network, timeout, malformed).
// 4. No cloud LLM calls — fully offline capable.
// ─────────────────────────────────────────────

const http = require('http');

// ─── Configuration ──────────────────────────
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434', 10);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '180000', 10);

/**
 * Checks if the Ollama service is reachable and lists available models.
 *
 * @returns {Promise<Object|null>} Object with { available, models, model } or null on failure.
 */
async function isAvailable() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: '/api/tags',
        method: 'GET',
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const modelNames = (data.models || []).map((m) => m.name || m.model);
            const hasModel = modelNames.some(
              (name) => name === OLLAMA_MODEL || name.startsWith(OLLAMA_MODEL.split(':')[0])
            );
            resolve({
              available: true,
              models: modelNames,
              model: OLLAMA_MODEL,
              modelInstalled: hasModel,
              endpoint: `http://${OLLAMA_HOST}:${OLLAMA_PORT}`,
            });
          } catch {
            resolve({ available: false, reason: 'Invalid response from Ollama' });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({ available: false, reason: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ available: false, reason: 'Connection timeout' });
    });

    req.end();
  });
}

/**
 * Sends a prompt to Ollama's /api/chat endpoint with proper thinking control.
 * Uses the chat API for correct Qwen3 think/no-think behavior.
 *
 * @param {string} prompt - The user message prompt text.
 * @param {Object} [options] - Optional configuration overrides.
 * @param {string} [options.model] - Model name override.
 * @param {number} [options.temperature] - Sampling temperature (0.0–1.0).
 * @param {number} [options.timeoutMs] - Request timeout in milliseconds.
 * @param {boolean} [options.think] - Whether to enable thinking mode (default: false).
 * @returns {Promise<Object|null>} Parsed JSON object from LLM response, or null on any failure.
 */
async function generateCompletion(prompt, options = {}) {
  const model = options.model || OLLAMA_MODEL;
  const temperature = options.temperature ?? 0.3;
  const timeoutMs = options.timeoutMs || OLLAMA_TIMEOUT_MS;
  const think = options.think ?? false;

  const requestBody = JSON.stringify({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    stream: false,
    think: think,
    options: {
      temperature,
      num_predict: 4096,
    },
  });

  return new Promise((resolve) => {
    const startTime = Date.now();

    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          const elapsed = Date.now() - startTime;
          try {
            const ollamaResponse = JSON.parse(body);

            // Extract text from the chat response message
            const message = ollamaResponse.message || {};
            const rawText = message.content || '';

            if (!rawText || rawText.trim().length === 0) {
              console.warn(`[LLM Client] Empty response content (${elapsed}ms). Model may still be loading.`);
              resolve(null);
              return;
            }

            // Extract structured JSON from LLM output
            const parsed = extractJSON(rawText);
            if (parsed) {
              resolve({
                data: parsed,
                rawResponse: rawText,
                model: ollamaResponse.model || model,
                durationMs: elapsed,
                tokensEvaluated: ollamaResponse.eval_count || null,
              });
            } else {
              console.warn(`[LLM Client] Could not extract valid JSON from response (${elapsed}ms). Raw length: ${rawText.length}`);
              console.warn(`[LLM Client] First 500 chars: ${rawText.substring(0, 500)}`);
              resolve(null);
            }
          } catch (err) {
            console.warn(`[LLM Client] Failed to parse Ollama response (${elapsed}ms):`, err.message);
            resolve(null);
          }
        });
      }
    );

    req.on('error', (err) => {
      const elapsed = Date.now() - startTime;
      console.warn(`[LLM Client] Request error (${elapsed}ms):`, err.message);
      resolve(null);
    });

    req.on('timeout', () => {
      const elapsed = Date.now() - startTime;
      console.warn(`[LLM Client] Request timeout after ${elapsed}ms`);
      req.destroy();
      resolve(null);
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Extracts a valid JSON object from LLM text output.
 * Handles common LLM output patterns:
 * - Raw JSON object
 * - JSON wrapped in markdown code fences (```json ... ```)
 * - JSON embedded within surrounding text
 *
 * @param {string} text - Raw LLM response text.
 * @returns {Object|null} Parsed JSON object, or null if extraction fails.
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Try direct parse first (cleanest case)
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }
  } catch {
    // Continue to fallback strategies
  }

  // 2. Try extracting from markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // Continue
    }
  }

  // 3. Try finding first { ... } block via brace matching
  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let endIndex = -1;
    for (let i = firstBrace; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
    if (endIndex !== -1) {
      try {
        return JSON.parse(text.substring(firstBrace, endIndex + 1));
      } catch {
        // Final fallback failed
      }
    }
  }

  return null;
}

module.exports = {
  isAvailable,
  generateCompletion,
  extractJSON,
  OLLAMA_MODEL,
};
