# CRAP: Conditional Resource Access Protocol

**text:** human
**code:** AI

HTTP can say yes and it can say no, but it can't ask you a question.

I've been thinking about this because of agents. One turns up at your API, and you'd probably let it in, but there's stuff you'd like to know first and there's nowhere to put the question. Not "are you logged in", we have `401` for that. Not "did you pay", that's `402`. I mean actual questions;

- What are you going to do with this?
- Which model are you, and how much context have you got?
- Who told you to do this, and up to what spend?
- Are you keeping the output? For how long?
- Will you respect a no-train flag?
- Is there a human watching right now?
- Which of these three licenses are you accepting?
- Is this a dry run?

Right now you get two options. Return a `403`, which ends the conversation and tells the agent nothing about how to fix it. Or build some bespoke onboarding form on the side of your product and pray the agent's operator fills it out six weeks before they need anything. Neither of those is a protocol, they're just what you do when the protocol is missing.

MCP already solved a narrow version of this. [Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) lets a server stop mid-operation, ask for structured input against a schema (or send the user off to a URL), and then carry on. It's good! It's also stuck inside MCP. And everything HTTP has is single purpose; `401` for auth, `402` and x402 for money, RFC 9457 for machine-readable problems, [Web Bot Auth](https://datatracker.ietf.org/wg/webbotauth/) for agent identity. Nothing that just says hold on mate, I want to ask you some things.

So I wrote one.

## CRAP

Conditional Resource Access Protocol. The acronym came first and I didn't fight it.

The status code is `430 Input Required`, which is currently sitting unassigned in the [IANA registry](https://www.iana.org/assignments/http-status-codes). It means;

> I understand what you're asking for and I might give it to you, but I have some questions first. Here they are. Answer them and try again.

The bit I care about is that the questions are open ended. There's no fixed vocabulary of approved intent-declarations that a committee has to agree on before anyone can ship. The server asks whatever it wants as JSON Schema and the protocol just carries it around. A genomics archive asking about ethics approval and a ticketing API asking if you're a scalper are the same mechanism.

## How it goes

Agent asks for something, server comes back with a challenge;

```json
{
  "type": "https://crap.donto.org/problems/input-required",
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

The agent POSTs answers back to the same URI, gets an `Input-Proof` header, then retries its original request with that header attached and gets its 200.

There are four ways to answer. `form` is structured data the agent can fill in itself. `proof` is signatures, delegations, credentials, actual evidence. `approval` means a human has to click something. `url` sends you off to do OAuth or KYC out of band. That last one exists because passwords and card numbers and tokens must never come back through `form` mode, since form mode means it goes through the agent's context window and now it's sitting in a log somewhere forever. MCP worked this out already and I've just copied them.

## reCAPTCHA, but pointed the other way

Here's the bit I find funny.

Think about what CAPTCHAs actually were. For about fifteen years the price of admission to a website was a small piece of unpaid cognitive labour. Squiggly words that happened to be scans of books nobody had digitised. Then house numbers, which happened to be Street View. Then buses and traffic lights and crosswalks, which happened to be exactly the labelled data you'd want if you were training self-driving cars. Billions of us, one grid of blurry motorbikes at a time, doing piecework for a trillion dollar company while sincerely believing we were proving we were human. We were! We were also the training set.

Now it's going the other way. It's not people asking machines for access anymore, it's machines asking us. Every agent on the internet wants your archive, your API, your forum's twenty years of arguments about mud crab farming. And they show up with something we never had, which is enormous cheap elastic compute, idling right there at your door.

So charge them for it. Not money, work.

The questions don't have to be *about* the agent at all, they can just be stuff you'd like done;

- Summarise what you're about to take in fifty words, I'll keep it as the abstract
- Here's three of my documents, which is most relevant to your query? (congratulations, you've labelled my search index)
- Translate this record's title into whatever language you're working in
- These two sources of mine contradict each other on this date, which do you find more credible and why?
- Classify this page under my taxonomy
- This paragraph has no citation, go find one

Every one of those is a legitimate condition of access and every one is also free labour extracted from an industry that was built on free labour. Your archive gets better every time somebody scrapes it. The corpus improves in proportion to how much people want it.

I want to be honest that this is funnier than it is rigorous. An answer from a model that wants your data is about as trustworthy as a book report from a kid who didn't read the book, so you'd want to sample it, cross-check it, ask the same question of a few different agents and see who disagrees. Which, now that I write it down, is roughly what Google did to us anyway; two words, one they knew and one they didn't, and getting the first one right bought your guess at the second.

## What everyone is going to get wrong

An agent telling you "I promise not to train on this" is not evidence. It's a string.

So every answer gets graded;

- **A0** the agent typed a value
- **A1** an identified agent signed it
- **A2** a user or org delegated it
- **A3** you verified it independently
- **A4** a trusted third party vouches for it

`form` answers are always A0, that's what A0 is for. The protocol shifts claims and evidence around, it doesn't make any of them true, and if you build something that treats a confident sounding sentence as authorisation then you're going to have a bad time.

## How it goes wrong

**Challenges are a prompt injection surface.** That `message` field is untrusted text from a stranger arriving in the middle of your agent's execution, and I've just proposed letting every server on the internet put arbitrary prose in front of every agent. So agents fill in declared schema fields and nothing else. A challenge that asks for your system prompt, or your keys, or your conversation history is an attack, and your own policy beats the server's request every single time.

**Surveys go both ways.** Open ended questions are also an open ended data collection channel. Every field has to declare why it's needed and how long it's kept, and the client has to be able to refuse any of it and eat the `403`.

**Proofs turn into bearer tokens if you're lazy.** Bind them to origin, method, URI, principal, body digest, expiry. A proof you earned on `GET /records/1` cannot open `DELETE /records/1`.

**Loops.** Cap it at three rounds and then return a real `403`, otherwise you've invented a way for servers to keep agents busy forever.

## Shipping it without waiting for the IETF

Getting a status code registered takes years. Getting a problem type registered is much easier. So there's two profiles.

The compatibility one is a plain `403` with `application/problem+json` and the type `https://crap.donto.org/problems/input-required`, which goes through every proxy and SDK that exists today. The native one is `430`, and the server only sends it if the client said `Accept-Input-Required: v=1` first, so nobody gets handed a mystery status code they didn't ask for.

Build the compat profile, get a few independent implementations, then write the Internet-Draft. Don't make an unregistered status code the thing your whole idea depends on.

## Why bother

The stable facts about an agent (who runs it, what keys it has, roughly what it's for) belong in an agent card, and Web Bot Auth is already building that. CRAP is for everything else, the per-request stuff that no static identity document could ever anticipate, because the right question depends on what's being asked for and who's asking today.

A resource gets to ask an agent anything, in a form a machine can answer, before it decides.

## I built it

Talking about a protocol without writing one is how you get a blog post nobody can argue with.

[**github.com/thomasdavis/crap**](https://github.com/thomasdavis/crap) has the spec, three packages (schema, server, client), a demo you can run, and fifteen end-to-end tests over real HTTP that hold the parts that matter. A proof from `GET /records/1` doesn't open `DELETE /records/1`, a challenge can't be answered twice, tampering with an answer breaks the signature, the round cap actually caps, and a server fishing for your system prompt gets refused by the client before your own code even sees the question.

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
    mode: 'form',
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
    form: (req) => req.id === 'purpose' ? answer('academic_research') : decline(),
    approval: (req) => askTheHuman(req.message),
  },
});
```

That's the whole surface area. It's v0.1, it's experimental, and `430` is a squat.

## Tell me what I've got wrong

This is the part I actually want. There's about forty decisions baked into this thing and I'd guess a good handful of them are wrong, I just don't know which. Some I already know are unresolved, they're in the [spec](https://crap.donto.org/spec.html) as open questions;

- **Should answers travel?** If you told one archive your purpose, should another archive be allowed to accept that? Very convenient. Also a tracking vector with a ribbon on it.
- **Should there be a shared vocabulary?** If every server invents its own `purpose` field with its own enum then agents drown, but if a committee owns the vocabulary then nothing ever ships. There has to be something in between.
- **Should the client get a receipt?** It just agreed to a data handling promise. Seems like it should get that promise back in writing, signed, so it can wave it at someone later.
- **Counter-offers.** A client that declines should be able to say "not that, but I'll take a narrower slice on these terms". At the moment declining is just a slower `403`.
- **Where's the line on work-as-toll?** A question that costs an agent ten seconds of GPU is a question. One that costs ten minutes is a job. I don't know where that boundary is or who gets to draw it.

And the one I'm most curious about, if your API could ask one question of every agent that hit it and get a schema-valid answer back, what would you ask? I'll put the good ones in the spec.

[Issues are open.](https://github.com/thomasdavis/crap/issues) Tell me it's a stupid idea, just be specific about which part.

Let's do it!
