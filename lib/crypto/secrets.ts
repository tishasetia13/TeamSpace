import 'server-only'
import crypto from 'node:crypto'

// ---------------------------------------------------------------------------
// Encrypting agent API keys.
//
// Every agent's API key is encrypted with AES-256-GCM *on the server* before it
// ever touches the database, and only ever decrypted on the server right before
// we call the provider. The master key lives in AGENT_KEY_SECRET (a server-only
// environment variable). So even if someone got a full dump of the database but
// NOT this env var, the stored keys would be useless gibberish to them.
//
// "GCM" also gives us tamper-detection for free: if the stored ciphertext is
// altered, decryption throws instead of returning garbage.
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm'

// Reads the 32-byte master key from the environment. Kept in a function (not a
// module-level constant) so that a missing key fails loudly at the moment we
// try to use it, with a clear message — not silently at import time.
function getMasterKey(): Buffer {
  const raw = process.env.AGENT_KEY_SECRET
  if (!raw) {
    throw new Error('AGENT_KEY_SECRET is not set. Add it to .env.local.')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(
      'AGENT_KEY_SECRET must decode to 32 bytes. Generate one with: openssl rand -base64 32',
    )
  }
  return key
}

// Encrypts a plaintext secret (e.g. an API key) into a single string that is
// safe to store in a text column. Format: "iv.tag.ciphertext", each part
// base64-encoded. The iv (a fresh random nonce per call) and tag are NOT
// secret — they're needed to decrypt and verify later.
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey()
  const iv = crypto.randomBytes(12) // 96-bit nonce, the standard size for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.')
}

// Reverses encryptSecret. Used from Step B onward, when an agent needs to read
// its key back to actually call its LLM. Throws if the stored value is
// malformed or has been tampered with.
export function decryptSecret(stored: string): string {
  const key = getMasterKey()
  const [ivB64, tagB64, dataB64] = stored.split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Stored secret is malformed.')
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
