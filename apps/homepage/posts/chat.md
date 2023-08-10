# THIS IS A COMPLETE WORK IN PROGRESS, DON'T READ IT

Noobs guide to all the ai jazz

Purposefully I am going to write this in simple language, there will be incorrect truths but my goal is to get you from A to B.

In short, I am going to give a shitty answer as how things like ChatGPT seemingly "remembers" what is going on. Replace any ChatGPT with any LLM. This can be extrapolated in a million ways.

Unnecessary side note: This shit is cool as fuck, if you are disgruntled, then Hope would want to change your mind.

_The solution to solve_

Imagine building a chat bot, that could "remember" everything you have said, and also "remembered" what it replied.

As if to infer that the "conversation" has "memories".

When talking to a large language model, like most things all you have is an input and an output. So how to write a prompt;

```
User: Hey beautiful
System: Hello World
```

Now if I reply, I might ask it "What did I call you when I said hello"?

So the prompt would be

User: What did I call you when I said hello

It will have no idea with that prompt so you append text yada yada

```
User: Hey beautiful
System: Hello World
User: What did I call you when I said hello"
```

Now the system can respond

```
User: Hey beautiful
System: Hello World
User: What did I call you when I said hello
System: You called me beautiful
```

In short, you feed the prompt a transcript. A history of the conversation, for better or worse.

```
User: Hey beautiful
System: Hello World
User: What did I call you when I said hello"
System: You called me beautiful
User: How to find happiness?
System: If you go looking happiness, you’ve already lost it
```

In simple prompt engineering you can just pass a transcript, it works quite well.

Now imagine you have been talking to the thing for ten thousand messages, the LLM cannot contain the context. It is limited by the amount of tokens.

When you want it to ask about happiness, you may have alluded to that question before, and it may have answered it before. So how could you re-ask the question.

```
=== Memories ===----------------------------------------------------------------------------------
User: How to find happiness?
System: If you go looking happiness, you’ve already lost it

=== Conversation ===
User: Hey ugly
System: Ouch
User: What is happiness?
System: You have already asked me that before,if you going looking for it you already have lost it
```

So you want to inject some notes inside the limits

This part is complex but simple at the end of the day.

There is some cool shit called vector similarity.

Imagine a simple string similarity search, the word "ghost" is kind of similar to "jost" (fix this)

The word that gets thrown around is "embeddings". #todo

No idea what it means, but they are useful.

```
There was once a dog who called a cat a bad person
Some camels drew their portrait and the sand designed
No paper was appropriate, but the sphinx still won
No werewolf could have a man ride its back
```

Take those four strange sentences, and pass them to an embedding model. It creates an index of "shit" for each one.

So if I search for "mammal that loves sand", given the trained model, it would likely rank the sentence about a camel the highest.

Some camels drew their portrait and the sand designed

But the only way to search "mammal that loves sand" is to create an embedding of that sentence itself.

In essence, (explain etymology for essential for fun)
You have to create an embedding for everything.

Why does it matter?

There is only so much you can put in a prompt. Using natural language you have found the most relevant "memories".

Include in your prompt

```
System: I am a god that grows humans

Memories: some biblical quote

Conversation: some past messages

Question:
```

The LLM loves the context.

Explain memories
Demo
Code
What is an embedding
Who cares
Are you lonely?
Include links to the 12 types of prompt engineering
Use a local vector db
Store every message and show the prompt they can all hear each other
