# CRAP: Conditional Resource Access Protocol

**text:** human
**code:** AI

HTTP can say yes. It can say no. It can't ask a question.

That's the gap. An agent hits your API. You'd probably let it through, but there are things you'd like to know first, and there is no way to ask. Not "are you authenticated" — you have `401` for that. Not "did you pay" — `402`. Actual questions. Anything you want:

- What are you going to do with this?
- Which model are you? What's your context budget?
- Who authorised this, and up to what limit?
- Are you keeping the output, and for how long?
- Will you honour a no-train flag?
- Do you have a human in the loop right now?
- Which of these three licences are you accepting?
- Are you the same agent that hit me forty times last hour?
- Is this a dry run?

Right now your only moves are `403` — final, unhelpful, conversation over — or bolting a bespoke onboarding form onto the side of your product and hoping the agent's operator fills it in six weeks before they need it. Neither is a protocol.

MCP already solved a narrow version of this. [Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) lets a server pause, ask for structured input against a schema or punt the user to a URL, then resume. It's good. It's also trapped inside MCP. Everything else in HTTP is single-purpose: `401` for auth, `402`/x402 for money, RFC 9457 for machine-readable problems, [Web Bot Auth](https://datatracker.ietf.org/wg/webbotauth/) for agent identity.

Nothing generic. Nothing that just says *hold on, I want to ask you some things*.

So:

## CRAP — Conditional Resource Access Protocol

Yes, really. I workshopped exactly one alternative, decided the acronym was load-bearing, and stopped. Every serious protocol should have a name you'd be slightly embarrassed to put in a compliance document.

Status code `430 Input Required` — currently unassigned in the [IANA registry](https://www.iana.org/assignments/http-status-codes), which is nice of them.

> The server understands your request and might allow it, but has questions. Here they are, as schemas. Answer them and retry.

The important word is **questions**, plural and open-ended. Not a fixed intent-declaration vocabulary that a committee has to agree on first. The server defines whatever it wants to ask, as JSON Schema, and the protocol just carries it. A genomics archive asking about ethics approval and a ticket API asking about resale intent are the same mechanism.

## The flow

Agent asks for something. Server responds with a challenge:

```json
{
  "type": "https://crap.dev/problems/input-required",
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
        "message": "What is this data for?",
        "schema": { "type": "string",
          "enum": ["academic_research", "commercial_product", "model_training"] } },
      { "id": "retention", "mode": "form", "required": true,
        "message": "How long will you keep it?",
        "schema": { "type": "string", "enum": ["session", "P30D", "indefinite"] } },
      { "id": "authority", "mode": "proof", "required": true,
        "message": "Prove someone authorised this.",
        "accepted_proof_types": ["oauth-delegation", "user-approval"] }
    ],
    "submission": { "method": "POST", "target": "https://data.example/v1/records" },
    "continuation": { "mode": "retry-original-request" }
  }
}
```

Agent POSTs the answers to the same URI. Server hands back an `Input-Proof`. Agent retries the original request with that header. Gets its 200.

Four input modes: **form** (structured non-secret answers), **proof** (signatures, delegations, verifiable credentials), **approval** (a human has to click), **url** (go do OAuth/KYC out of band). That last distinction matters — passwords, tokens and card numbers must never come back through form mode, because form mode means *the agent's context window sees it*. MCP got this right and we should steal it wholesale.

## reCAPTCHA, but pointed the other way

Think about what CAPTCHAs actually were.

For about fifteen years the toll for entering a website was a small piece of unpaid cognitive labour. Squiggly words that happened to be scans of books nobody had digitised yet. Then house numbers, which happened to be Street View. Then traffic lights and crosswalks and buses, which happened to be exactly the labelled data you'd want if you were, say, training self-driving cars. Billions of us, one grid of blurry motorbikes at a time, doing piecework for a trillion-dollar company under the sincere belief that we were proving we were human.

We were. We were also the training set.

Now the traffic's reversed. It's not humans asking machines for access — it's machines asking *us*. Every agent on the internet wants your archive, your API, your forum's twenty years of arguments about mud crab farming. And they arrive with something we never had: enormous, cheap, elastic compute, sitting right there at the door.

So charge them for it. Not in money — in work.

The questions in a challenge don't have to be *about* the agent. They can just be **work you'd like done**:

- Summarise what you're about to take, in fifty words, and I'll keep it as the abstract.
- Here are three of my documents. Which is most relevant to your query? (Congratulations, you've labelled my search index.)
- Translate this record's title into the language you're operating in.
- Two of my sources contradict each other on this date. Which do you find more credible, and why?
- Classify this page under my taxonomy.
- This paragraph has no citation. Can you find one?

Every one of those is a legitimate access condition. Every one is also free labour from a system whose entire business model was built on free labour. The archive gets better each time someone scrapes it. Your corpus improves in proportion to how badly people want it.

I want to be clear that this is *funny* rather than *fair*, and that I don't fully trust it — an A0 answer from a model that wants your data is exactly as reliable as a student's book report on a book they didn't read. You'd want to sample, cross-check, feed the same question to several agents and see who disagrees. But then, that's roughly what Google did to us: two words, one known, one unknown, and your correctness on the first bought your guess on the second.

The symmetry is too good to leave alone. They spent fifteen years turning our attention into their training data. It would be rude not to return the favour.

## The part everyone will get wrong

An agent saying "I promise not to train on this" is not evidence. It's a string.

So grade every answer:

- **A0** — agent typed a value
- **A1** — identified agent *signed* the value
- **A2** — a user or org delegated it
- **A3** — independently verifiable proof
- **A4** — trusted third-party attestation

The protocol moves claims and evidence. It does not make claims true. Any implementation that treats a confident-sounding free-text answer as authorisation deserves exactly what happens next.

## Ways this goes bad

**Challenges are a prompt-injection surface.** The `message` field is untrusted remote text arriving mid-execution, and now every server on the internet gets to put arbitrary questions in front of your agent. Agents fill declared schema fields and *nothing else*. A challenge asking for your system prompt, your env, your keys, your conversation history — that's an attack, and client policy beats server request every time.

**Surveys become surveillance.** Open-ended questions cut both ways. Every field declares why it's needed and how long it's kept; clients can decline any of it and take the `403`.

**Proofs become bearer tokens.** Bind them: origin, method, URI, principal, body digest, expiry. A proof for `GET /records/1` must never open `DELETE /records/1`.

**Infinite challenge loops.** Cap it at three rounds, then return a real `403`.

## Shipping it without waiting for the IETF

Registering a status code takes years. Registering a problem type is Specification Required. So, two profiles:

**Compatibility** — `403` + `application/problem+json` with type `https://crap.dev/problems/input-required`. Works through every proxy and SDK on earth today.

**Native** — client sends `Accept-Input-Required: v=1`, server may answer `430`. Nobody eats a mystery status code they didn't ask for.

Build the compat profile, get independent implementations, *then* write the Internet-Draft. Don't make the status code the single point of failure for the idea.

## Why bother

Stable facts about an agent — who runs it, what keys it holds, what it's broadly for — belong in an agent card, which Web Bot Auth is already building. CRAP is for everything else: the per-request, per-resource, context-dependent stuff no static identity document could anticipate, because the question depends on what's being asked for and who's asking today.

That's the whole abstraction:

> a resource gets to ask an agent anything, in a form a machine can answer, before deciding.

Not a questionnaire. A negotiation.

## I built it

Because talking about a protocol without an implementation is how you get a blog post nobody can argue with.

[**github.com/thomasdavis/crap**](https://github.com/thomasdavis/crap) — spec, three packages (schema, server, client), a runnable demo, and fifteen end-to-end tests over real HTTP that hold the parts that matter: a proof earned on `GET /records/1` doesn't open `DELETE /records/1`, a challenge can't be answered twice, a tampered answer breaks the signature, the round cap actually caps, and a server fishing for your system prompt gets refused by the client before your resolver ever sees the question.

```bash
git clone https://github.com/thomasdavis/crap && cd crap
npm install && npm test && npm run example
```

Server:

```js
evaluate(ctx, satisfied) {
  if (satisfied?.answers.purpose?.value === 'model_training') {
    return deny('this collection is not licensed for training');
  }
  if (satisfied) return allow();
  return inputRequired([{
    id: 'purpose',
    mode: 'form',
    message: 'What are you going to do with this?',
    required: true,
    schema: { type: 'string', enum: ['academic_research', 'commercial_product', 'model_training'] },
  }]);
}
```

Client:

```js
const res = await crapFetch('https://data.example/v1/records', {
  resolver: {
    form: (req) => req.id === 'purpose' ? answer('academic_research') : decline(),
    approval: (req) => askTheHuman(req.message),
  },
});
```

That's the whole surface area. It's v0.1, it's experimental, and `430` is a squat.

## Now tell me what I've got wrong

This is the part I actually want. The design space is enormous and I've made maybe forty decisions in here, of which a solid handful are probably wrong. Some I already know are unresolved — they're in the spec's [open questions](https://crap.donto.org/spec.html):

- **Should answers be portable?** If you told one archive your purpose, should another one be able to accept that? Convenient. Also a tracking vector with a bow on it.
- **Should there be a common vocabulary?** If every server invents its own `purpose` field with its own enum, agents drown. If a committee owns the vocabulary, nothing ships. There must be a middle.
- **Should the client get a receipt?** It signed up to a data-handling promise. Shouldn't it get that promise in writing, signed, to wave around later?
- **Counter-offers.** A client that declines should be able to say "not that, but I'll take a narrower slice on these terms." Right now declining is just a slower `403`.
- **Where's the line on work-as-toll?** A question that takes an agent ten seconds of GPU time is a question. A question that takes ten minutes is a job. I don't know where that boundary sits, or who gets to draw it.

And the bit I'm most curious about: **what would you ask?** Genuinely. If your API could ask one question of every agent that hit it, and get a schema-valid answer back — what's the question? Best ones go in the spec.

[Issues are open.](https://github.com/thomasdavis/crap/issues) Tell me it's a terrible idea, but be specific about which part.

Let's do it!
