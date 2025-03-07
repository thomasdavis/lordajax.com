# Building a Smart Job Recommendation Engine with JSON Resume

**text:** AI
**code:** AI

I recently built a new feature for the [JSON Resume](https://jsonresume.org) registry that helps connect people with relevant job opportunities. The [jobs-graph](https://registry.jsonresume.org/thomasdavis/jobs-graph) takes your resume data and matches it with job postings from Hacker News, presenting everything in an interactive visualization.

## How It Works

The system processes data in several stages to create meaningful connections:

1. **Resume Processing**: Your `resume.json` gets converted to natural language using GPT-4o-mini, which preserves all your fields but makes the data more accessible for embedding.

2. **Job Collection**: The system pulls job listings from Hacker News "Who is Hiring?" posts via their API, then converts them to a standardized [JSON Resume job schema](https://jsonresume.org/job-description-schema).

3. **Company Enrichment**: For both resumes and jobs, the Perplexity API fetches dossiers and recent news about each company mentioned.

4. **Embedding Generation**: OpenAI's large embedding API converts the natural language versions of resumes and jobs into numerical vectors.

5. **Graph Construction**: The system finds the 20 most similar resume-to-job matches and calculates similarity between jobs, creating a network of connections.

All this data gets rendered as an interactive graph where you can:

- Filter jobs through text search
- Highlight remote positions or salary ranges with color contrast
- Mark jobs as "done" to track your progress

```python
# Simplified example of how embeddings are created and compared
import openai

# Generate embedding for resume
resume_text = "Full-stack developer with 5 years experience in React and Node.js..."
resume_embedding = openai.Embedding.create(
    model="text-embedding-3-large",
    input=resume_text
)["data"][0]["embedding"]

# Generate embedding for job
job_text = "Looking for a senior developer familiar with modern JavaScript frameworks..."
job_embedding = openai.Embedding.create(
    model="text-embedding-3-large",
    input=job_text
)["data"][0]["embedding"]

# Calculate similarity (simplified)
similarity = calculate_cosine_similarity(resume_embedding, job_embedding)
```

## Why This Approach Is Better

> The real power of this system comes from the combination of embeddings and real-time data. While traditional job boards match based on keywords, we're capturing semantic relationships between your experience and job requirements.

The jobs-graph approach has several advantages over traditional job matching:

| Approach        | Traditional Job Sites     | JSON Resume Jobs-Graph                     |
| --------------- | ------------------------- | ------------------------------------------ |
| Matching Method | Keyword matching          | Semantic embeddings                        |
| Data Freshness  | Often outdated            | Real-time from HN + Perplexity             |
| Context         | Limited company info      | Full company dossiers + news               |
| Visualization   | Linear list               | Interactive graph showing relationships    |
| Discoverability | Limited to direct matches | Can follow paths to adjacent opportunities |

> **Embedding structured vs. unstructured data**: There's an interesting trade-off here. Working with structured JSON is clean but misses semantic nuance. Converting to natural language first introduces some noise but captures more meaningful connections. After testing both approaches, the natural language route produced more relevant matches.

## Getting Started

Want to try it yourself? Here's how:

1. **Create your JSON Resume**: If you haven't already, build your resume following the [JSON Resume schema](https://jsonresume.org/schema/).

2. **Add it to the registry**: Create a GitHub gist named `resume.json` with your resume data and register at [registry.jsonresume.org](https://registry.jsonresume.org).

3. **Explore your job graph**: Once registered, you can view your personalized jobs-graph at `registry.jsonresume.org/[username]/jobs-graph`.

## What's Next?

I'm planning to expand this with:

- Integration with more job sources beyond Hacker News
- Improved filtering options (by industry, location, etc.)
- Enhanced visualization features for better exploration
- API access to the job-matching algorithm

## Contribute

The entire JSON Resume ecosystem is open source. If you'd like to help improve the jobs-graph or have ideas to share:

- Check out the [GitHub repository](https://github.com/jsonresume)
- Add issues or pull requests for new features
- Star the project to show support

Give it a try and let me know what you think! [Sign up for the registry](https://registry.jsonresume.org) today to see your personalized job recommendations.
