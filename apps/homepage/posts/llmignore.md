
# .llmignore

I just saw Vercel release a [lock file for their v0](https://x.com/rauchg/status/1897391285369233817) product. The idea being that their AI won't modify those files but only read them.

It makes sense that IDE's implement something similar. And I assume the best name for it would be `.llmignore`.

Even for my own personal workflows I think the agents would have far better outputs if they know they can't touch certain files of mine, and that they should work around them as best they can. So I would love to see this implemented, lots of other potential benefits;

- Keep optimized algorithms intact
- Preserve specialized implementations
- LLM's encourage to build off your code not change fundamentals
- Consistent behavior across LLM tools

## Implementation

Create a `.llmignore` file in your project root:

```
# .llmignore
# Highly optimized modules
src/core/rendering-engine.js
src/utils/critical-algorithms/*

# Legacy code
legacy/*

# Pattern matching
*.asm
src/ml/trained-models/*.py
```

### No access?

Maybe it's not required but no access could be useful. Something like;

```
# .llmignore
# Files LLM cannot read or modify
[no-access]
src/ml/models/*.pth    # Model weights
src/config/*-keys.json # API keys and secrets
*.asm                  # Assembly files
*.bin                  # Binary files

# Files LLM can read but not modify
[read-only]
legacy/*                   # Legacy code
src/ml/trained-models/*.py # Trained model scripts
```

Let's do it!