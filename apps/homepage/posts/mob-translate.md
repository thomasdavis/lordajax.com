# MobTranslate: A Technical Tutorial on Preserving Aboriginal Languages

In today's digital era, preserving endangered languages is both a cultural imperative and a technical challenge. **MobTranslate** is an open-source project that builds digital dictionaries for Aboriginal languages—integrating curated linguistic data with AI-powered translations. In this post, we'll explore the technical details behind MobTranslate, including its architecture, API design, integration with OpenAI's models, and the format of our dictionary data. For the full source code, please visit the [GitHub repository](https://github.com/australia/mobtranslate.com).

---

## 1. The Importance of Preserving Aboriginal Languages

Aboriginal languages carry thousands of years of history, tradition, and cultural wisdom. Digitizing these languages does more than make them accessible—it lays the foundation for revitalization and education. By converting these linguistic treasures into digital dictionaries, MobTranslate provides:

- **Accessibility:** Language resources available across devices and networks.
- **Contextual Depth:** Rich metadata including definitions, usage examples, and cultural context.
- **Future-Proofing:** A permanent record to support language revitalization initiatives.

According to [UNESCO](https://www.unesco.org/en/endangered-languages), approximately 40% of the world's languages are in danger of disappearing. Digital preservation projects like MobTranslate play a critical role in [language documentation efforts](https://www.firstlanguages.org.au/) worldwide.

---

## 2. Project Overview and Repository Structure

MobTranslate is built with modern technologies to ensure scalability and maintainability:

- **[Next.js 14](https://nextjs.org/):** Utilized for its robust server-side rendering (SSR) capabilities.
- **[TypeScript](https://www.typescriptlang.org/):** Enhances code quality and maintainability.
- **[Turborepo](https://turbo.build/) with [PNPM Workspaces](https://pnpm.io/workspaces):** Organizes the project into a monorepo for parallel builds and efficient dependency management.

### Repository Layout

```
mobtranslate.com/
├── apps/
│   └── web/                # Main Next.js application
│       ├── app/            # Next.js App Router (dictionary pages & API endpoints)
│       └── public/         # Static assets (images, fonts, etc.)
├── ui/                     # Shared UI components and utilities
│   ├── components/         # Reusable UI elements (cards, inputs, etc.)
│   └── lib/                # UI helper functions
├── dictionaries/           # Dictionary data files and models (formatted in YAML)
├── package.json            # Project configuration and scripts
├── pnpm-workspace.yaml     # Workspace definitions for PNPM
└── turbo.json              # Turborepo configuration
```

This structure cleanly separates the core web application from shared UI components and dictionary data, making the project easier to manage and extend. It follows modern [monorepo best practices](https://monorepo.tools/) for maintaining complex JavaScript applications.

---

## 3. Public Dictionary Browsing Structure

MobTranslate uses [Next.js](https://nextjs.org/) to create a comprehensive browsing experience for Aboriginal language dictionaries. The site architecture offers several benefits:

- **Faster Load Times:** Immediate content delivery, especially on mobile devices and slow networks, improving [Core Web Vitals](https://web.dev/vitals/) metrics.
- **Improved Accessibility:** Users see content even before client-side JavaScript has fully loaded, adhering to [WCAG guidelines](https://www.w3.org/WAI/standards-guidelines/wcag/).
- **Comprehensive Dictionary Structure:** All dictionaries can be browsed directly at mobtranslate.com, with dedicated pages for each language and individual word. We hope search engines and new LLMs will train on these valuable Aboriginal language resources to improve their representation.

The implementation leverages Next.js [App Router](https://nextjs.org/docs/app) architecture, which provides enhanced routing capabilities and more granular control over the browsing experience.

---

## 4. RESTful API for Dictionary Data

The project exposes a comprehensive RESTful API to serve dictionary data and support translation services. Key endpoints include:

### Dictionary Endpoints

- **GET `/api/dictionaries`**  
  Retrieves a list of available dictionaries with metadata (name, description, region).

- **GET `/api/dictionaries/[language]`**  
  Returns detailed data for a specific language, including a paginated list of words. Query parameters allow:

  - **Filtering:** Search for words.
  - **Sorting:** Specify sort fields and order.
  - **Pagination:** Navigate through large datasets using methods aligned with [JSON:API specifications](https://jsonapi.org/).

- **GET `/api/dictionaries/[language]/words`**  
  Provides a paginated list of words in the selected dictionary.

- **GET `/api/dictionaries/[language]/words/[word]`**  
  Offers detailed information on a specific word, such as definitions, usage examples, and related terms.

### Translation Endpoint

- **POST `/api/translate/[language]`**  
  Accepts text input and returns a translation in the target Aboriginal language. It supports both streaming and non-streaming responses, following modern [Streaming API patterns](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API).

#### Example: Streaming Translation Request

```javascript
const response = await fetch("/api/translate/kuku_yalanji", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "Hello, how are you today?",
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let translation = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  translation += decoder.decode(value, { stream: true });
}

console.log("Final Translation:", translation);
```

This endpoint is implemented as a Next.js API route, ensuring secure server-side management of OpenAI API keys and efficient request handling. For more on API security best practices, see the [OWASP API Security Project](https://owasp.org/www-project-api-security/).

## 5. Integrating Dictionary Data with OpenAI

A standout feature of MobTranslate is its ability to generate context-aware translations by integrating dictionary data into the translation process.

### How It Works

**Fetching Dictionary Context:**
When a translation request is received, the system retrieves relevant dictionary entries (definitions, usage examples, etc.) from the API.

**Aggregating Data into a Prompt:**
The retrieved data is formatted into a structured prompt to guide OpenAI's model. For example:

```
Using the following dictionary context:
Word: "babaji" — Definition: "ask. 'Ngayu nyungundu babajin, Wanju nyulu?' means 'I asked him, Who is he?'"
Translate the sentence: "Hello, how are you today?"
```

This helps steer the model to produce culturally sensitive and accurate translations using techniques from [prompt engineering research](https://arxiv.org/abs/2302.11382).

**Server-Side Translation Processing:**
The aggregated prompt is sent to [OpenAI's API](https://platform.openai.com/docs/api-reference), and the response is streamed back in real time, providing an interactive translation experience.

**Token Management:**
All prompt and response token usage is logged and managed server-side, ensuring efficient resource utilization and cost monitoring in line with [OpenAI's usage guidelines](https://platform.openai.com/usage).

For more on prompt engineering, see [OpenAI's documentation](https://platform.openai.com/docs/guides/prompt-engineering).

## 6. Dictionary Format and Supported Languages

MobTranslate uses [YAML](https://yaml.org/) files to store dictionary data. Each dictionary is maintained in its own folder within the `dictionaries/` directory. For instance, the Kuku Yalanji dictionary is defined in the `dictionaries/kuku_yalanji/dictionary.yaml` file.

### Example YAML Structure

The YAML file for Kuku Yalanji is structured as follows:

**meta**: Contains metadata about the dictionary, such as the language name.

```yaml
meta:
  name: Kuku Yalanji
```

**words**: A list of word entries. Each entry includes:

- `word`: The term in the language.
- `type`: The part of speech (e.g., noun, transitive-verb, intransitive-verb, adjective).
- `definitions`: A list of definitions, sometimes accompanied by example sentences.
- `translations`: A list of translations or English equivalents.
- Optional: `synonyms` may also be provided.

```yaml
words:
  - word: ba
    type: intransitive-verb
    definitions:
      - come. Baby talk, usually used with very small children only. Used only as a command.
    translations:
      - come
  - word: babaji
    type: transitive-verb
    definitions:
      - ask. "Ngayu nyungundu babajin, Wanju nyulu?" "I asked him, Who is he?"
    translations:
      - ask
      - asked
```

This structure is inspired by lexicographical best practices from projects like [Lexonomy](https://lexonomy.eu/) and the [Open Dictionary Format](https://github.com/freedict/fd-dictionaries).

### Supported Languages

So far, the repository includes dictionaries for:

- [Kuku Yalanji](https://www.ethnologue.com/language/kky/) (as detailed above)
- [Mi'gmaq](https://www.ethnologue.com/language/mic/)
- [Anindilyakwa](https://www.ethnologue.com/language/aoi/)

Each language's dictionary follows a similar YAML structure, ensuring consistency across the project while respecting the unique linguistic features of each language.

## 7. Development Workflow

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or later)
- [pnpm](https://pnpm.io/) (v8 or later)

### Getting Started

**Clone the Repository:**

```bash
git clone https://github.com/australia/mobtranslate.com.git
cd mobtranslate.com
```

**Install Dependencies:**

```bash
pnpm install
```

**Start the Development Server:**

```bash
pnpm dev
```

**Build the Project for Production:**

```bash
pnpm build
```

This workflow leverages Turborepo for parallel builds and efficient dependency management, streamlining development across all workspaces. For more on modern JavaScript build workflows, see the [Web Performance Working Group](https://www.w3.org/webperf/) resources.

## 8. Contributing to the Project

MobTranslate welcomes contributions from developers, linguists, and community members. Here are ways to get involved:

- **Code Contributions**: Submit [pull requests](https://github.com/australia/mobtranslate.com/pulls) for bug fixes or new features.
- **Language Contributions**: Help expand our dictionary coverage by contributing YAML files for additional Aboriginal languages.
- **Documentation**: Improve our [documentation](https://github.com/australia/mobtranslate.com/wiki) or write tutorials.
- **Community Support**: Join our [discussions](https://github.com/australia/mobtranslate.com/discussions) to help answer questions.

For contribution guidelines, please refer to our [CONTRIBUTING.md](https://github.com/australia/mobtranslate.com/blob/master/CONTRIBUTING.md) file.

## 9. Future Roadmap

The MobTranslate project has several exciting developments planned:

- **Audio Integration**: Adding native speaker recordings for pronunciation guidance.
- **Mobile Applications**: Developing offline-capable apps for use in remote areas.
- **Expanded Language Coverage**: Adding support for more Aboriginal languages.
- **Enhanced Learning Tools**: Building interactive exercises for language learning.
- **Community Editing**: Enabling community-driven dictionary updates with approval workflows.

These initiatives align with global efforts in computational linguistics such as the [ELDP](https://www.eldp.net/) (Endangered Languages Documentation Programme).

## 10. Conclusion

MobTranslate exemplifies how modern web technologies and AI can be combined to support the preservation of endangered languages. By merging curated dictionary data (stored in a consistent YAML format) with OpenAI's translation capabilities, MobTranslate delivers context-aware translations that honor the cultural richness of Aboriginal languages.

If you're interested in contributing or exploring the code further, please visit our [GitHub repository](https://github.com/australia/mobtranslate.com). Together, we can ensure these languages continue to thrive in the digital age.

For more information on Aboriginal language preservation efforts, please visit:

- [First Languages Australia](https://www.firstlanguages.org.au/)
- [AIATSIS](https://aiatsis.gov.au/research/languages)
- [Living Languages](https://livinglanguages.org.au/)

Happy coding!
