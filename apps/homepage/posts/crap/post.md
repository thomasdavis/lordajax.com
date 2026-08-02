# CRAP: Conditional Resource Access Protocol

**text:** human
**code:** AI

<div class="crap-hero">
<p class="crap-kicker">EXPERIMENTAL · v0.2 · <code>430</code> PROVISIONAL</p>
<p class="crap-sub">HTTP can authenticate a request, refuse it, or fulfil it. CRAP adds a fourth answer: <strong>I might fulfil this, but first satisfy these requirements.</strong></p>
<pre class="crap-wire"><code>GET  /records                          → 403 (or 430) + challenge
POST /.well-known/input-challenges/…   → 204 + Input-Proof
GET  /records  + Input-Proof           → 200 OK</code></pre>
<p class="crap-actions"><a href="#try-it">Run the exchange</a> <a href="https://github.com/thomasdavis/crap">Read the code</a> <a href="https://crap.donto.org/spec.html">Read the spec</a></p>
<p class="crap-facts">3 packages · 28 end-to-end tests · MIT · works on plain <code>403</code> today</p>
</div>

HTTP can say yes and it can say no, but it can't ask you a question.

I've been thinking about this because of agents. One turns up at your API, and you'd probably let it in, but there's stuff you'd like to know first and there's nowhere to put the question. Not "are you logged in", we have `401` for that. Not payment, `402` is reserved for that and everyone profiles their own scheme on top of it. I mean arbitrary application policy, the stuff that would actually change your mind about this specific request;

- What are you going to do with this?
- Who authorised it?
- How long are you keeping the result?
- Does a human need to approve this?

Right now you get two options. Return a `403`, which ends the conversation and tells the agent nothing about how to fix it. Or build some bespoke onboarding form on the side of your product and pray the agent's operator fills it out six weeks before they need anything. Neither of those is a protocol, they're just what you do when the protocol is missing.

MCP already solved a narrow version of this. [Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) lets a server stop mid-operation, ask for structured input against a schema (or send the user off to a URL), and then carry on. It's good! It's also stuck inside MCP, and everything HTTP has is single purpose. So I wrote one, and then I wrote the implementation, because talking about a protocol without building it is how you get a blog post nobody can argue with.

## The exchange

The server hands back a challenge. Smallest useful version;

```json
{
  "type": "https://crap.donto.org/problems/input-required",
  "status": 403,
  "challenge": {
    "id": "ch_zC4mV8xQ",
    "input_requests": [{
      "id": "purpose",
      "kind": "declaration",
      "message": "What is this data for?",
      "required": true,
      "schema": { "type": "string", "enum": ["research", "product", "training"] }
    }],
    "submission": { "target": "…/.well-known/input-challenges/ch_zC4mV8xQ/responses" }
  }
}
```

The agent POSTs its answers to that transaction resource, gets back a `204` with an `Input-Proof` header, then retries the original request with the proof attached and gets its 200. That's the whole state machine. The [full challenge document](https://crap.donto.org/spec.html#4-the-challenge) has another dozen fields, and every one of them is there to stop something bad happening, which I'll get to.

## Try it

Here's the exchange running in your browser. Nothing is sent anywhere, the server is about eighty lines of JavaScript on this page, but the logic is the same as the real thing including the bits that fail.

<div id="try-it" class="crap-play">
  <div class="crap-play-controls">
    <label><input type="checkbox" id="crap-native" checked> Send <code>Accept-Input-Required: v=2</code> <span class="crap-hint">(off = compatibility <code>403</code>)</span></label>
  </div>
  <div class="crap-play-cols">
    <div class="crap-play-col">
      <div class="crap-play-head">Exchange</div>
      <div id="crap-log" class="crap-log"></div>
    </div>
    <div class="crap-play-col">
      <div class="crap-play-head">Your answers</div>
      <div id="crap-answers" class="crap-answers"></div>
      <div class="crap-play-buttons">
        <button id="crap-start" type="button">1 · Request the records</button>
        <button id="crap-submit" type="button" disabled>2 · Submit answers</button>
        <button id="crap-retry" type="button" disabled>3 · Retry with proof</button>
        <button id="crap-abuse" type="button" disabled class="crap-danger">Try the proof on <code>DELETE</code></button>
        <button id="crap-reset" type="button" class="crap-ghost">Reset</button>
      </div>
    </div>
  </div>
</div>

## The implementation

[**github.com/thomasdavis/crap**](https://github.com/thomasdavis/crap) has the spec, three packages (schema, server, client), a demo, and twenty-eight end-to-end tests over real HTTP.

```bash
git clone https://github.com/thomasdavis/crap && cd crap
npm install && npm test && npm run example
```

Server side you write a policy;

```js
evaluate(ctx, satisfied) {
  if (satisfied?.answers.purpose?.value === 'model_training') {
    return deny('this collection is not licensed for training');
  }
  if (satisfied) return allow();
  return inputRequired([{
    id: 'purpose',
    kind: 'declaration',
    actor: 'client',
    interaction: 'inline',
    message: 'What are you going to do with this?',
    required: true,
    schema: { type: 'string', enum: ['academic_research', 'commercial_product', 'model_training'] },
  }]);
}
```

Client side you write a resolver, which decides what your agent will and won't answer;

```js
const res = await crapFetch('https://data.example/v1/records', {
  resolver: {
    declaration: (req) => req.id === 'purpose' ? answer('academic_research') : decline(),
    approval: (req) => askTheHuman(req.message),
  },
});
```

That's the whole surface area.

## What can be asked for

Four independent facets, not one enum. I had `form | proof | approval | url` in v0.1 and it was wrong, because those aren't peers; `form` describes a representation, `proof` an evidence class, `approval` who decides, `url` a delivery channel. OAuth is all four at once and the enum couldn't say so.

| Facet | Values |
|---|---|
| `kind` | `declaration` · `evidence` · `approval` · `task` |
| `actor` | `client` · `user` · `organization` · `third_party` |
| `interaction` | `inline` · `out_of_band` |
| `binding` | `none` · `client_key` · `user_identity` · `organization_identity` |

Which composes properly. Purpose of use is an inline client declaration. Human confirmation is a user approval, out of band. OAuth delegation is out-of-band evidence bound to a user identity. A verifiable credential is third-party evidence, inline.

`inline` means the answer passes through the agent's context window and into somebody's logs forever, so passwords, keys, tokens and card numbers must never be requested that way. That's what `out_of_band` is for. MCP worked this out already and I've copied them.

## What the client can refuse

All of it, always, and this is load bearing rather than politeness. The client library refuses on your behalf before your own code sees the question if the challenge;

- asks for a system prompt, keys, environment, cookies or conversation history
- claims an issuer that isn't the origin that answered
- describes a scope that isn't the request you actually made
- points its submission target at a different origin
- carries a schema with keywords the client can't safely evaluate
- demands more `task` work than your budget allows

The last two need explaining. I dropped `pattern` and `format` from the allowed JSON Schema subset. `format` was advertised but never enforced, which is worse than absent because a server could believe it had constrained something. And `pattern` means compiling a stranger's regex, where JavaScript gives you no execution limit and a length cap buys nothing, since short expressions backtrack catastrophically just fine.

## Security, or: why the challenge has a dozen more fields

A proof binds method, exact target, content presence, content digest, principal and expiry. A proof you earned on `GET /records/1` cannot open `DELETE /records/1`, which is the demo button above.

Content presence binds **both ways**, which I got wrong the first time. It's not enough to check the digest when a body is present, because then a proof earned on a request with a body can be replayed on the same request with the body stripped off, and a proof earned without one can have a body smuggled in later. Presence itself has to be part of what's signed.

Targets compare verbatim. I was sorting query parameters to "canonicalise" them, which quietly changes meaning for repeated parameters and for any API where order matters, so now `?b=2&a=1` and `?a=1&b=2` are simply different requests.

Proofs carry no answer values. The first version base64'd the accepted answers into the header, signed but not encrypted, which puts your declared purpose and retention policy into every access log and telemetry pipeline between you and the origin. Now it's an opaque handle by default, with a stateless profile that carries a digest instead.

And the biggest one; the `message` field is untrusted remote text arriving in the middle of your agent's execution, and this protocol proposes letting every server on the internet put arbitrary prose in front of every agent. Agents fill declared schema fields and nothing else. Your policy beats the server's request every single time.

## Why not just use what exists

| Mechanism | What it expresses |
|---|---|
| `401` / `WWW-Authenticate` | authentication credentials |
| [RFC 9470](https://www.rfc-editor.org/rfc/rfc9470.html) | stronger or more recent authentication |
| `402` + payment profiles | payment |
| MCP elicitation | more input, inside an MCP interaction |
| [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) | a machine-readable description of a problem |
| [Web Bot Auth](https://datatracker.ietf.org/wg/webbotauth/) | who this agent is and who runs it |
| **CRAP** | application-defined, per-request requirements |

RFC 9470 is the closest relative and worth reading, because it's exactly this shape (server challenges, client goes and gets something, request is retried) scoped to authentication. Web Bot Auth is the complement rather than the competition; stable facts about an agent belong in an agent card, and CRAP is for the per-request stuff no static document could anticipate.

## `430` is optional and I'd like to be clear about that

The status code is the least interesting part and I'd rather it didn't sink the idea.

The normative wire format is a plain `403` with `application/problem+json` and the type `https://crap.donto.org/problems/input-required`, which goes through every proxy, gateway and SDK that exists today. Clients detect a challenge by the problem type, never by the status code. `430 Input Required` is an optional profile the server only uses if the client sent `Accept-Input-Required: v=2` first.

So if `430` never gets registered, nothing breaks. Getting a problem type registered is a much lower bar than a status code, and that's the piece that actually matters.

## Experimental application: computational tolls

This next part is the fun idea and also the one most likely to make a standards person close the tab, so it lives in its own section with a warning on it. It is not required to believe any of this for the protocol above to be useful.

Think about what CAPTCHAs actually were. For about fifteen years the price of admission to a website was a small piece of unpaid cognitive labour. Squiggly words that happened to be scans of books nobody had digitised. Then house numbers, which happened to be Street View. Then buses and traffic lights and crosswalks, which happened to be exactly the labelled data you'd want if you were training self-driving cars. Billions of us, one grid of blurry motorbikes at a time, doing piecework for a trillion dollar company while sincerely believing we were proving we were human. We were! We were also the training set.

Now it's going the other way. It's not people asking machines for access anymore, it's machines asking us. Every agent on the internet wants your archive, your API, your forum's twenty years of arguments about mud crab farming. And they show up with something we never had, which is enormous cheap elastic compute, idling right there at your door.

So charge them for it. Not money, work.

That's the `task` kind, and it's deliberately not a `declaration`, because it has a completely different cost and abuse profile. A task has to declare what it wants and what it costs;

```json
{
  "id": "classify",
  "kind": "task",
  "message": "Classify this document under the supplied taxonomy.",
  "output_schema": { "type": "string", "enum": ["policy", "correspondence", "report"] },
  "limits": { "max_duration_ms": 5000, "max_output_tokens": 500, "max_rounds": 1 },
  "compensation": { "type": "conditional_access" }
}
```

A task with no declared limits is rejected as unbounded, and the client refuses all tasks by default until you give it a budget in milliseconds. That way the cost is visible and refusing is mechanical rather than a judgement call.

The things you could ask for; summarise what you're about to take and I'll keep it as the abstract. Which of these three documents is most relevant to your query (congratulations, you've labelled my search index). Translate this record's title into whatever language you're working in. These two sources of mine disagree about a date, which do you find more credible. Your archive gets better every time somebody scrapes it.

I want to be honest that this is funnier than it is rigorous. Task output is self-asserted by a party with every incentive to answer fast rather than right, so you'd want to sample it, cross-check it, ask several agents and see who disagrees. Which, now that I write it down, is roughly what Google did to us anyway; two words, one they knew and one they didn't, and getting the first one right bought your guess at the second.

## What an answer is worth

An agent telling you "I promise not to train on this" is not evidence. It's a string.

Every accepted answer carries a class saying how it was established; `self_asserted`, `client_signed`, `delegated`, `independently_verified`, `third_party_attested`.

I originally had these as a ladder, A0 through A4, where a server could ask for "at least A2". That's intuitive and it's also false. Independent verification isn't inherently weaker than a third-party attestation, they answer different questions, and a user delegation isn't more of the same thing as a signed agent key, it's a claim about authority rather than identity. So they're an unordered set now, servers list what they'll take, and membership is checked instead of rank. All declarations and all task output are `self_asserted`, permanently, no matter how confident the sentence sounds.

## Tell me what I've got wrong

This is the part I actually want. Everything above has already been rewritten once because someone pointed out that the client would happily post your declarations to any origin a challenge named, which is a fairly bad bug to have shipped in a protocol about not oversharing. There'll be more.

Open questions, also in [the spec](https://crap.donto.org/spec.html#11-open-questions);

- **Should answers travel?** If you told one archive your purpose, should another archive be allowed to accept that? Very convenient. Also a tracking vector with a ribbon on it.
- **Should there be a shared vocabulary?** If every server invents its own `purpose` field with its own enum then agents drown, but if a committee owns the vocabulary then nothing ever ships.
- **Should the client get a receipt?** It just agreed to a data handling promise. Seems like it should get that promise back in writing, signed, so it can wave it at someone later.
- **Counter-offers.** A client that declines should be able to say "not that, but I'll take a narrower slice on these terms". At the moment declining is just a slower `403`.
- **Task economics.** `limits` makes the cost visible but not fair. Who decides five seconds of inference is a reasonable price for a document, and what stops a server asking a thousand agents the same question and calling the consensus a dataset?

And the one I'm most curious about, if your API could ask one question of every agent that hit it and get a schema-valid answer back, what would you ask? I'll put the good ones in the spec.

[Issues are open.](https://github.com/thomasdavis/crap/issues) Tell me it's a stupid idea, just be specific about which part.

Let's do it!

<p class="crap-colophon">Written by me. The implementation was built with AI assistance and is exercised by twenty-eight end-to-end protocol tests; the v0.2 rewrite came out of a review that found three real binding bugs in v0.1.</p>

<style>
.crap-hero{border:1px solid var(--jb-rule,#ddd8c9);border-radius:6px;padding:1.5rem;margin:2rem 0 2.5rem}
.crap-kicker{font-family:var(--jb-mono,ui-monospace,monospace);font-size:.7rem;letter-spacing:.14em;opacity:.65;margin:0 0 .75rem}
.crap-hero .crap-sub{font-size:1.05rem;margin:0 0 1.25rem}
.crap-wire{font-size:.8rem;line-height:1.7;overflow-x:auto;margin:0 0 1.25rem}
.crap-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin:0 0 .75rem}
.crap-actions a{display:inline-block;border:1px solid currentColor;border-radius:4px;padding:.35rem .8rem;font-family:var(--jb-mono,ui-monospace,monospace);font-size:.78rem;text-decoration:none}
.crap-facts{font-family:var(--jb-mono,ui-monospace,monospace);font-size:.72rem;opacity:.6;margin:0}
.crap-play{border:1px solid var(--jb-rule,#ddd8c9);border-radius:6px;padding:1rem;margin:1.5rem 0;font-family:var(--jb-mono,ui-monospace,monospace);font-size:.78rem}
.crap-play-controls{padding-bottom:.75rem;margin-bottom:.75rem;border-bottom:1px solid var(--jb-rule,#ddd8c9)}
.crap-play-controls label{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
.crap-hint{opacity:.55}
.crap-play-cols{display:grid;grid-template-columns:1fr;gap:1rem}
@media(min-width:820px){.crap-play-cols{grid-template-columns:1.15fr .85fr}}
.crap-play-head{font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;opacity:.55;margin-bottom:.5rem}
.crap-log{min-height:170px;max-height:420px;overflow-y:auto;line-height:1.55}
.crap-log .step{margin-bottom:.65rem;padding-left:.6rem;border-left:2px solid var(--jb-rule,#ddd8c9)}
.crap-log .step.ok{border-left-color:#2f7d4f}
.crap-log .step.bad{border-left-color:#b3402f}
.crap-log .lbl{opacity:.55}
.crap-log pre{margin:.3rem 0 0;font-size:.72rem;white-space:pre-wrap;word-break:break-word;padding:.5rem;border-radius:3px;background:rgba(127,127,127,.09)}
.crap-answers .q{margin-bottom:.7rem}
.crap-answers .qm{display:block;margin-bottom:.25rem}
.crap-answers select,.crap-answers input[type=text]{width:100%;font-family:inherit;font-size:.76rem;padding:.3rem}
.crap-answers .why{display:block;opacity:.55;font-size:.7rem;margin-top:.2rem}
.crap-play-buttons{display:flex;flex-direction:column;gap:.4rem;margin-top:.9rem}
.crap-play-buttons button{font-family:inherit;font-size:.76rem;padding:.45rem .6rem;border:1px solid currentColor;border-radius:4px;background:none;color:inherit;cursor:pointer;text-align:left}
.crap-play-buttons button:disabled{opacity:.35;cursor:default}
.crap-play-buttons .crap-danger{border-style:dashed}
.crap-play-buttons .crap-ghost{border-color:transparent;opacity:.6;padding-left:0}
/* Prose stays at the site's 40rem measure; wire diagrams, code, tables and the
   playground break out wider, because protocol examples are unreadable when
   they wrap. Scoped to this post via :has(). */
.crap-hero,
.crap-play,
.jb-prose:has(.crap-hero) > pre,
.jb-prose:has(.crap-hero) > table{width:min(58rem,calc(100vw - 3rem));margin-left:50%;transform:translateX(-50%)}
.jb-prose:has(.crap-hero) > table{display:block;overflow-x:auto}
@media(max-width:660px){.crap-hero,.crap-play,.jb-prose:has(.crap-hero) > pre,.jb-prose:has(.crap-hero) > table{width:100%;margin-left:0;transform:none}}
.crap-colophon{font-size:.8rem;opacity:.6;border-top:1px solid var(--jb-rule,#ddd8c9);padding-top:1rem;margin-top:2.5rem}
</style>

<script src="/assets/crap-playground.js" defer></script>
