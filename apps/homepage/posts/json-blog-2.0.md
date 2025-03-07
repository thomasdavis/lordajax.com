
**text:** Human-ish
**code:** AI

After spending some time with JsonBlog, I felt it was time for a revamp—introducing JsonBlog v2.1, now with full TypeScript support and a modular design. The essence remains: your entire blog resides in a single JSON file, while the rendering logic is managed through versioned npm packages.

## Why Opt for JSON as Content?

The standout feature of JsonBlog is encapsulating your blog's content and structure within a single JSON file. This approach offers several advantages:

1. **Git as Your CMS**: Your `blog.json` becomes just another file in your Git repository, granting you version control, history tracking, and collaborative capabilities effortlessly.

2. **Content Portability**: Being in JSON format, your blog can be stored anywhere:

   - Git repositories
   - Gists
   - S3 or other object storage services
   - CDNs
   - As a static file on any hosting platform
   - Even in a tweet (though that's a tight squeeze)

3. **Zero Lock-in**: Unlike traditional CMS platforms that entangle your content in databases or proprietary formats, your `blog.json` is pure data—yours to control and migrate as you see fit.

## Generators as NPM Packages

The true magic lies in how JsonBlog decouples content from presentation:

```typescript
// Your blog content - yours to keep
{
  "site": {
    "title": "Engineering Blog",
    "description": "Technical deep-dives"
  },
  "posts": [
    {
      "title": "Why JSON Blogs Rule",
      "source": "./posts/json-rules.md"
    }
  ]
}

// Your generator - versioned on npm
import { Generator } from '@jsonblog/types';

export const generator: Generator = async (blog) => {
  return {
    files: [
      {
        path: 'index.html',
        content: template(blog)
      }
    ]
  };
};
```

This setup means:

1. **Generators Persist**: Once a generator is published to npm, that version remains available indefinitely. Your blog will render consistently, even years down the line.

2. **Flexibility in Themes**: Switching themes is as simple as installing a different generator package. Your content remains untouched.

3. **No Dependencies for Content**: Your `blog.json` stands alone as data. The build tools and generators operate independently.

## A Glimpse into My Setup

This structure allows for:

- **Separation of Content and Presentation**: Content is version-controlled independently of its presentation.
- **Easy Theme Changes**: I can swap generators without altering the content.
- **Consistent Rendering**: Older posts render as they did originally.
- **Content Mobility**: I can relocate my content without disrupting the site.

## Project Structure

JsonBlog is organized into three main repositories:

- [jsonblog-cli](https://github.com/jsonblog/jsonblog-cli): The core CLI tool.
- [jsonblog-schema](https://github.com/jsonblog/jsonblog-schema): TypeScript schema definitions.
- [jsonblog-generator-boilerplate](https://github.com/jsonblog/jsonblog-generator-boilerplate): A template for creating generators.

Remember, these are merely tools. Your content lives in your `blog.json`, independent of any specific JsonBlog version.

## Getting Started

```bash
# Install the CLI
npm install -g jsonblog-cli

# Create your blog.json
{
  "site": { "title": "My Blog" },
  "posts": []
}

# Choose a generator
npm install @jsonblog/minimal-generator

# Build your site
jsonblog build blog.json
```

## The Strength of Decoupling

This architecture brings several benefits:

1. **Time Travel**: Want to revisit your blog's 2023 appearance? Use the generator version from that year.

2. **Multiple Outputs**: The same `blog.json` can generate various outputs:

   - Static sites
   - RSS feeds
   - JSON APIs
   - AMP sites
   - PDF books
     All achievable by employing different generators.

3. **Content Anywhere**: Your `blog.json` can reside in:
   - A GitHub repository
   - A CDN
   - Object storage services
   - A public Gist
     And your site will build consistently.

## Wrapping Up

JsonBlog v2.1 brings a TypeScript overhaul, but the core philosophy remains: your content is pure JSON, free to exist anywhere. Generators are npm packages that transform that JSON into your desired format.

Explore the repositories:

- CLI: [github.com/jsonblog/jsonblog-cli](https://github.com/jsonblog/jsonblog-cli)
- Schema: [github.com/jsonblog/jsonblog-schema](https://github.com/jsonblog/jsonblog-schema)
- Generator Boilerplate: [github.com/jsonblog/jsonblog-generator-boilerplate](https://github.com/jsonblog/jsonblog-generator-boilerplate)

I'm always open to feedback. Feel free to open issues or submit PRs with your ideas for improvement.
