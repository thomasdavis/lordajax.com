```markdown
# MobTranslate: A Technical Tutorial on Preserving Aboriginal Languages

In today’s digital era, preserving endangered languages is more than just an act of cultural preservation—it’s a technical challenge that requires modern tools and robust engineering practices. MobTranslate is our open-source project that builds digital dictionaries for Aboriginal languages, integrating curated linguistic data with AI-powered translations. In this post, we’ll walk you through the technical details of MobTranslate, explaining the architecture, API design, and the custom integration with OpenAI's models. You can find the full code on our [GitHub repository](https://github.com/australia/mobtranslate.com).

---

## Why Preserve Aboriginal Languages?

Aboriginal languages are rich with thousands of years of history, tradition, and cultural knowledge. They are more than just a means of communication; they are repositories of indigenous wisdom and worldviews. By digitizing these languages, MobTranslate not only makes language resources accessible but also provides a foundation for future language revitalization and education.

---

## Project Overview and Repository Structure

MobTranslate is built using a modern tech stack:

- **Next.js 14:** Utilized for its robust server-side rendering (SSR) capabilities, ensuring fast, reliable, and accessible pages.
- **TypeScript:** Enhances code quality and maintainability.
- **Turborepo with PNPM Workspaces:** Organizes the project into a monorepo, allowing for parallel builds and efficient dependency management.

### Repository Layout

Below is an overview of the repository structure:
```

mobtranslate.com/
├── apps/
│ └── web/ # Main Next.js application
│ ├── app/ # Next.js App Router, including dictionary pages & API endpoints
│ └── public/ # Static assets (images, fonts, etc.)
├── ui/ # Shared UI components and utilities
│ ├── components/ # Reusable UI elements (cards, inputs, etc.)
│ └── lib/ # UI helper functions
├── dictionaries/ # Dictionary data files and models
├── package.json # Project configuration and scripts
├── pnpm-workspace.yaml # Workspace definitions for PNPM
└── turbo.json # Turborepo configuration

````

This structure separates the core web application from UI components and dictionary data, making it easier to manage and extend the project.

---

## Server-Side Rendering for Performance

Using [Next.js](https://nextjs.org/) for SSR is a key part of our strategy. SSR not only speeds up the initial load times—especially on mobile devices and slow networks—but also ensures that users immediately see content even if client-side JavaScript hasn’t fully loaded. This approach improves accessibility and creates a more consistent user experience.

---

## RESTful API for Dictionary Data

MobTranslate exposes a set of RESTful API endpoints to access the digital dictionaries and translation services. Here’s a brief overview of the core endpoints:

### Dictionary Endpoints

- **GET `/api/dictionaries`**
  Retrieves a list of available dictionaries with metadata such as language name, description, and region.

- **GET `/api/dictionaries/[language]`**
  Returns detailed data for a specific language, including a paginated list of word entries. Query parameters allow filtering, sorting, and pagination.

- **GET `/api/dictionaries/[language]/words`**
  Provides a paginated list of all words within a selected dictionary.

- **GET `/api/dictionaries/[language]/words/[word]`**
  Delivers detailed information for a particular word, including definitions, usage examples, and related terms.

### Translation Endpoint

- **POST `/api/translate/[language]`**
  Accepts text input and returns a translation in the specified Aboriginal language. It supports both streaming and non-streaming responses.

#### Example: Streaming Translation Request

```javascript
const response = await fetch('/api/translate/kuku_yalanji', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello, how are you today?',
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let translation = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  translation += decoder.decode(value, { stream: true });
  // Process partial translation output as needed
}

console.log('Final Translation:', translation);
````

This endpoint is implemented as a Next.js API route, enabling server-side handling of requests and secure management of OpenAI API keys.

---

## Integrating Dictionary Data with OpenAI

One of the innovative aspects of MobTranslate is the integration of dictionary data with OpenAI’s language models to generate context-aware translations.

### How It Works

1. **Fetching Dictionary Context:**  
   When a translation request is initiated, the system retrieves the relevant dictionary entries from the REST API. For example, if a user wants to translate a sentence into Kuku Yalanji, the system gathers definitions, usage examples, and related terms from the Kuku Yalanji dictionary.

2. **Aggregating Context into a Prompt:**  
   The retrieved data is then formatted into a structured prompt. A sample prompt might look like this:

   ```
   Using the following dictionary context:
   Word: "babaji" — Definition: "ask. 'Ngayu nyungundu babajin, Wanju nyulu?' means 'I asked him, Who is he?'"
   Translate the sentence: "Hello, how are you today?"
   ```

   This helps steer the model to generate a translation that respects the linguistic and cultural nuances of the target language.

3. **Server-Side Translation Request:**  
   The prompt is sent from the server to OpenAI’s API. With token usage logged and managed server-side, the system ensures that resource use is monitored and API keys remain secure.

4. **Streaming Response:**  
   OpenAI’s response is streamed back to the client in real-time. This approach improves the interactive experience, as users see the translation build in real time.

For more details on prompt engineering, you might find [OpenAI’s documentation](https://platform.openai.com/docs/guides) useful.

---

## Running and Developing MobTranslate

### Prerequisites

Before you begin, make sure you have the following installed:

- **[Node.js](https://nodejs.org/)** (v18 or later)
- **[pnpm](https://pnpm.io/)** (v8 or later)

### Getting Started

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/australia/mobtranslate.com.git
   cd mobtranslate.com
   ```

2. **Install Dependencies:**

   ```bash
   pnpm install
   ```

3. **Start the Development Server:**

   ```bash
   pnpm dev
   ```

4. **Build the Project for Production:**

   ```bash
   pnpm build
   ```

These commands set up your local development environment, enabling you to work on the web application, API endpoints, or any part of the codebase.

---

## Conclusion

MobTranslate is an example of how modern web technologies and AI can work together to preserve and revitalize endangered languages. By carefully combining curated dictionary data with the capabilities of OpenAI’s models, we are able to offer translations that honor the depth and nuance of Aboriginal languages.

If you’re interested in contributing or learning more, please explore our [GitHub repository](https://github.com/australia/mobtranslate.com) and join the discussion on our issue tracker. Happy coding, and let’s work together to keep these languages alive for future generations!

```

```
