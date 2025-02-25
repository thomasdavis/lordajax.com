# Building JsonBlog: From JSON Files to Modern Static Sites

When I first created JsonBlog, the goal was simple: make blogging as straightforward as editing a JSON file. No databases, no complex CMS, just your content and a way to present it. Today, I'm excited to share how JsonBlog has evolved into a modern, TypeScript-powered static site generator while staying true to its roots.

## The Journey to v2.1

JsonBlog started as a weekend project to solve my own blogging needs. I wanted something that:

1. Used JSON as the primary data format
2. Kept content separate from presentation
3. Was easy to version control
4. Could be extended without learning a complex framework

The initial version worked well, but as the project grew, we needed to modernize while keeping these core principles intact.

## What's New in v2.1

### 1. Simplified Schema

We've streamlined the blog schema to focus on what matters most:

```typescript
interface Blog {
  site: {
    title: string;
    description: string;
  };
  basics: {
    name: string;
    label?: string;
    image?: string;
    url?: string;
  };
  posts: {
    title: string;
    description?: string;
    source?: string;
    createdAt?: string;
    updatedAt?: string;
  }[];
}
```

This cleaner structure makes it easier to understand and maintain your blog while providing all the essential features.

### 2. Better Content Management

The new version introduces several improvements to content handling:

- **Source-based Content**: Instead of embedding content directly in your JSON, use the `source` field to reference Markdown files
- **Improved Timestamps**: Proper `createdAt` and `updatedAt` fields for better content organization
- **Optional Fields**: More flexible schema with optional fields where it makes sense
- **Better Validation**: Clear error messages when something's not quite right

### 3. Modern Development Experience

The entire codebase has been modernized:

- **TypeScript Throughout**: Better type safety and developer experience
- **Structured Logging**: Clear, colorized logs with proper error context
- **Async/Await**: Modern async patterns for better performance
- **Better Build Process**: Faster, more reliable builds with improved file watching

### 4. Enhanced Generator System

The generator system is now more powerful and easier to use:

```typescript
// Create a custom generator
const generator = async (blog: Blog, basePath: string) => {
  // Generate your HTML files
  return [
    {
      name: "index.html",
      content: generateIndex(blog),
    },
    // ... more files
  ];
};
```

## Using JsonBlog Today

Getting started is as simple as:

```bash
# Install the CLI
npm install -g jsonblog-cli

# Create a new blog
jsonblog init

# Start the development server
jsonblog serve blog.json
```

Your blog.json file might look like this:

```json
{
  "site": {
    "title": "My Tech Blog",
    "description": "Thoughts on software and life"
  },
  "posts": [
    {
      "title": "Hello World",
      "source": "./posts/hello-world.md",
      "createdAt": "2025-02-26T00:00:00Z"
    }
  ]
}
```

## The Road Ahead

While v2.1 is a significant step forward, we're not stopping here. Some exciting things we're working on:

- **Theme System**: A pluggable theme system for easy customization
- **Better CLI Experience**: More intuitive commands and better error handling
- **Enhanced Development Tools**: Better debugging and development workflows
- **Improved Documentation**: More examples and better guides

## Why JsonBlog?

In a world of complex static site generators and heavyweight CMS solutions, JsonBlog stands out by being:

1. **Simple**: Your content is just JSON and Markdown
2. **Flexible**: Write generators in any language
3. **Modern**: TypeScript support, great DX
4. **Fast**: Quick builds, no unnecessary complexity
5. **Portable**: Easy to move, back up, and version control

## Join the Journey

JsonBlog is open source and welcomes contributions. Whether you're:

- Building a custom generator
- Improving the core
- Writing documentation
- Reporting bugs
- Suggesting features

Every contribution helps make JsonBlog better for everyone.

## Conclusion

JsonBlog v2.1 represents our commitment to keeping things simple while providing modern tools for developers. It's still the same concept - JSON files to static sites - but with all the features you'd expect in 2025.

Try it out, build something cool, and let me know what you think. The best way to get started is to check out our [GitHub repository](https://github.com/jsonblog/jsonblog-cli) or jump right in with `npm install -g jsonblog-cli`.
