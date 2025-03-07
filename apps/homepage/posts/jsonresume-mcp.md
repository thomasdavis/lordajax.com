# Streamline Your Resume with JSON Resume MCP Server

**text:** AI
**code:** AI

Tired of manually updating your resume every time you finish a new project? The [JSON Resume MCP Server](https://github.com/jsonresume/mcp) is here to help. This tool automatically updates your [JSON Resume](https://jsonresume.org) by analyzing your code and adding your latest project details.

## What It Does

- **Resume Update:**  
  It checks for an existing resume on [GitHub Gists](https://gist.github.com) and updates it, or creates a new one if needed.
- **Code Analysis:**  
  It goes through your codebase to pick out relevant skills and project highlights.
- **AI-Powered Descriptions:**  
  By using [OpenAI](https://openai.com/api/), it generates professional and concise descriptions of your work.
- **Validation:**  
  Built with [TypeScript](https://www.typescriptlang.org/) and [Zod](https://github.com/colinhacks/zod), it ensures your resume meets the [JSON Resume standard](https://jsonresume.org/schema/).

## Getting Started

### Prerequisites

- A [GitHub account](https://github.com) with a personal access token (make sure it has gist permissions).
- An [OpenAI API key](https://openai.com/api/).
- [Node.js](https://nodejs.org) version 18 or higher.
- An IDE that supports MCP servers like [Windsurf](https://github.com/windsurf) or [Cursor](https://github.com/cursorapp).

### Installation

Install the MCP server globally using [npm](https://www.npmjs.com):

```bash
npm install -g @jsonresume/mcp
```

### Configuration

#### For Windsurf:

Add the following to your Windsurf settings:

```json
{
  "jsonresume": {
    "command": "npx",
    "args": ["-y", "@jsonresume/mcp"],
    "env": {
      "GITHUB_TOKEN": "your-github-token",
      "OPENAI_API_KEY": "your-openai-api-key",
      "GITHUB_USERNAME": "your-github-username"
    }
  }
}
```

Learn more about [Windsurf configuration](https://github.com/windsurf).

#### For Cursor:

Add this to your `~/.cursor/mcp_config.json`:

```json
{
  "mcpServers": {
    "jsonresume": {
      "command": "npx",
      "args": ["-y", "@jsonresume/mcp"],
      "env": {
        "GITHUB_TOKEN": "your-github-token",
        "OPENAI_API_KEY": "your-openai-api-key",
        "GITHUB_USERNAME": "your-github-username"
      }
    }
  }
}
```

For additional details, check out the [Cursor documentation](https://github.com/cursorapp).

## How It Works

Once set up, you simply ask your AI assistant something like:

> "Can you enhance my resume with details from my current project?"

The MCP server will then:

- Find or create your JSON Resume on [GitHub Gists](https://gist.github.com).
- Analyze your code to extract project details and skills.
- Generate a neat project description with [OpenAI](https://openai.com/api/).
- Update your resume automatically.

## Contributing and Testing

Interested in improving the tool? Check out the [GitHub repository](https://github.com/jsonresume/mcp) for:

- **Test Scripts:** Run tests like `npx tsx tests/check-openai.ts` or `node tests/test-mcp.js` found in the [tests directory](https://github.com/jsonresume/mcp/tree/main/tests).
- **Contribution Guidelines:** See the [CONTRIBUTING.md](https://github.com/jsonresume/mcp/blob/main/CONTRIBUTING.md) for details on how to get started.

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). For complete details, refer to the [LICENSE file](https://github.com/jsonresume/mcp/blob/main/LICENSE).

---

The JSON Resume MCP Server is a practical tool for developers who want to keep their resumes current without the hassle. For more information and to join the community, visit the [JSON Resume MCP Server GitHub repository](https://github.com/jsonresume/mcp).

Happy coding!
