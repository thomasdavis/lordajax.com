# 430 Input Required

**text:** human
**code:** AI

HTTP can say yes. It can say no. It can't say *not yet, tell me what you're doing first*.

That's the gap. An agent hits your API. You'd probably let it through, but you want to know: who authorised this, what's it for, how long are you keeping the data, does a human actually know this is happening. Right now your only moves are `403` (final, unhelpful) or bolting a bespoke onboarding form onto the side of your product. Neither is a protocol.

MCP already solved a version of this — [elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) lets a server pause, ask for structured input against a schema or punt the user to a URL, then resume. It's good. It's also trapped inside MCP. Everything else is single-purpose: `401` for auth, `402`/x402 for money, RFC 9457 for machine-readable problems, Web Bot Auth for agent identity.

Nothing generic. So:

## x430 — HTTP Elicitation

Status code `430 Input Required` — currently unassigned in the [IANA registry](https://www.iana.org/assignments/http-status-codes), which is nice of them.

> The server understands your request and might allow it, but needs you to satisfy these requirements first. Here they are. Retry when you're done.

Backronym for the disrespectful: **CRAP** — Conditional Resource Access Protocol.

## The flow

Agent asks for something. Server responds with a challenge:

```json
{
  "type": "https://x430.org/problems/input-required",
  "status": 430,
  "challenge": {
    "id": "ch_01K1XG8JX9",
    "expires_at": "2026-08-02T00:15:00Z",
    "scope": {
      "method": "GET",
      "target": "https://data.example/v1/records",
      "request_digest": "sha-256=:n4bQgYhMfWWaLq...:"
    },
    "input_requests": [
      { "id": "purpose", "mode": "form", "required": true,
        "schema": { "type": "string",
          "enum": ["academic_research", "commercial_product", "model_training"] } },
      { "id": "retention", "mode": "form", "required": true,
        "schema": { "type": "string", "enum": ["session", "P30D", "indefinite"] } },
      { "id": "authority", "mode": "proof", "required": true,
        "accepted_proof_types": ["oauth-delegation", "user-approval"] }
    ],
    "submission": { "method": "POST", "target": "https://data.example/v1/records" },
    "continuation": { "mode": "retry-original-request" }
  }
}
```

Agent POSTs the answers to the same URI. Server hands back an `Input-Proof`. Agent retries the original request with that header. Gets its 200.

Four input modes: **form** (structured non-secret data), **proof** (signatures, delegations, verifiable credentials), **approval** (a human has to click), **url** (go do OAuth/KYC out of band). That last distinction matters — passwords, tokens and card numbers must never come back through form mode, because form mode means *the agent's context window sees it*. MCP got this right and we should steal it wholesale.

## The part everyone will get wrong

An agent saying "I promise not to train on this" is not evidence. It's a string.

So grade everything:

- **A0** — agent typed a value
- **A1** — identified agent *signed* the value
- **A2** — a user or org delegated it
- **A3** — independently verifiable proof
- **A4** — trusted third-party attestation

The protocol moves claims and evidence. It does not make claims true. Any implementation that treats a confident-sounding free-text answer as authorisation deserves what happens next.

## Ways this goes bad

**Challenges are a prompt-injection surface.** The `message` field is untrusted remote text arriving mid-execution. Agents fill declared schema fields and *nothing else*. A challenge asking for your system prompt, your env, your keys, your conversation history — that's an attack, and client policy beats server request every time.

**Proofs become bearer tokens.** Bind them: origin, method, URI, principal, body digest, expiry. A proof for `GET /records/1` must never open `DELETE /records/1`.

**Servers use it to interrogate.** Every field declares why it's needed and how long it's kept. Clients can decline any of it.

**Infinite challenge loops.** Cap it at three rounds, then return a real `403`.

## Shipping it without waiting for the IETF

Registering a status code takes years. Registering a problem type is Specification Required. So do it in two profiles:

**Compatibility** — `403` + `application/problem+json` with type `https://x430.org/problems/input-required`. Works through every proxy and SDK on earth today.

**Native** — client sends `Accept-Input-Required: v=1`, server may answer `430`. Nobody eats a mystery status code they didn't ask for.

Build the compat profile, get two independent client and server implementations plus a gateway, *then* write the Internet-Draft. Don't make the status code the single point of failure for the idea.

## Why bother

Stable facts about an agent — who runs it, what keys it holds, what it's generally for — belong in an agent card, which [Web Bot Auth](https://datatracker.ietf.org/wg/webbotauth/) is already building. x430 is for the per-request stuff: what are you doing *right now*, who authorised *this*, what's your ceiling on *this transaction*.

That's the whole abstraction, and I think it's the interesting one:

> turning an unauthorised request into an authorised one through an explicit, machine-readable exchange of obligations and evidence.

Not a questionnaire. A negotiation.

Let's do it!
