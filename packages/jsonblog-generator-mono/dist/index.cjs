var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default,
  generateBlog: () => generateBlog
});
module.exports = __toCommonJS(index_exports);
var import_handlebars = __toESM(require("handlebars"), 1);
var import_slugify = __toESM(require("slugify"), 1);
var fs = __toESM(require("fs"), 1);
var path = __toESM(require("path"), 1);
var import_url = require("url");
var import_axios = __toESM(require("axios"), 1);
var import_rss = __toESM(require("rss"), 1);

// src/logger.ts
var import_pino = __toESM(require("pino"), 1);
var logger = (0, import_pino.default)({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname"
    }
  },
  level: process.env.LOG_LEVEL || "info"
});
var logger_default = logger;

// src/index.ts
var import_markdown_it = __toESM(require("markdown-it"), 1);
var import_meta = {};
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = path.dirname(__filename);
var templateFiles = {
  index: fs.readFileSync(path.join(__dirname, "../templates/index.hbs"), "utf8"),
  post: fs.readFileSync(path.join(__dirname, "../templates/post.hbs"), "utf8"),
  page: fs.readFileSync(path.join(__dirname, "../templates/page.hbs"), "utf8"),
  pageGrid: fs.readFileSync(path.join(__dirname, "../templates/page-grid.hbs"), "utf8"),
  layout: fs.readFileSync(path.join(__dirname, "../templates/layout.hbs"), "utf8"),
  tag: fs.readFileSync(path.join(__dirname, "../templates/tag.hbs"), "utf8"),
  category: fs.readFileSync(path.join(__dirname, "../templates/category.hbs"), "utf8")
};
var tailwindCss = fs.readFileSync(path.join(__dirname, "../templates/tailwind.css"), "utf8");
var packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
var generatorName = packageJson.name;
var generatorVersion = packageJson.version;
var md = new import_markdown_it.default({
  html: true,
  linkify: true,
  typographer: true
});
import_handlebars.default.registerHelper("formatDate", (date) => {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
});
import_handlebars.default.registerHelper("slugify", (text) => {
  return (0, import_slugify.default)(text, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
});
import_handlebars.default.registerHelper("eq", (a, b) => {
  return a === b;
});
import_handlebars.default.registerHelper("add", (a, b) => {
  return a + b;
});
import_handlebars.default.registerHelper("subtract", (a, b) => {
  return a - b;
});
import_handlebars.default.registerHelper("multiply", (a, b) => {
  return a * b;
});
import_handlebars.default.registerHelper("gt", (a, b) => {
  return a > b;
});
import_handlebars.default.registerHelper("lt", (a, b) => {
  return a < b;
});
import_handlebars.default.registerPartial("layout", templateFiles.layout);
import_handlebars.default.registerPartial("content", "{{> @partial-block }}");
async function fetchFile(uri, basePath) {
  try {
    if (uri.startsWith("http")) {
      logger_default.debug({ uri }, "Fetching remote file");
      const response = await import_axios.default.get(`${uri}?cb=${(/* @__PURE__ */ new Date()).getTime()}`, {
        timeout: 3e4,
        // 30 second timeout
        maxContentLength: 10 * 1024 * 1024
        // 10MB max
      });
      logger_default.debug({ uri, status: response.status }, "Remote file fetched successfully");
      return response.data;
    } else {
      logger_default.debug({ uri, basePath }, "Reading local file");
      const filePath = path.resolve(basePath, uri.replace(/^\.\//, ""));
      if (!fs.existsSync(filePath)) {
        logger_default.warn({ filePath }, "File does not exist");
        return void 0;
      }
      const stats = fs.statSync(filePath);
      if (stats.size > 10 * 1024 * 1024) {
        logger_default.warn({ filePath, size: stats.size }, "File too large, skipping");
        return void 0;
      }
      const content = fs.readFileSync(filePath, "utf8");
      logger_default.debug({ filePath, size: content.length }, "Local file loaded successfully");
      return content;
    }
  } catch (error) {
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      logger_default.error({ uri, errorCode: error.code }, "Network error fetching file");
    } else if (error.response?.status) {
      logger_default.error({ uri, status: error.response.status }, "HTTP error fetching file");
    } else {
      logger_default.error({ error, uri }, "Unexpected error fetching file");
    }
    return void 0;
  }
}
async function processContent(items, type, basePath) {
  if (!items) return [];
  logger_default.info(`Processing ${items.length} ${type}s`);
  const processedItems = await Promise.all(
    items.map(async (item) => {
      let gridItems = "items" in item ? item.items : void 0;
      try {
        let content = item.content || "";
        if ("source" in item && item.source) {
          const fetchedContent = await fetchFile(item.source, basePath);
          if (fetchedContent) {
            content = fetchedContent;
          }
        }
        if ("itemsSource" in item && item.itemsSource) {
          const fetchedItems = await fetchFile(item.itemsSource, basePath);
          if (fetchedItems) {
            try {
              gridItems = JSON.parse(fetchedItems);
              logger_default.debug({ itemsSource: item.itemsSource }, "Loaded grid items from external file");
            } catch (error) {
              logger_default.error({ error, itemsSource: item.itemsSource }, "Failed to parse items JSON");
            }
          }
        }
        if (!content && (!("layout" in item) || item.layout !== "grid")) {
          return {
            ...item,
            content: "<p>Error: No content found</p>",
            slug: (0, import_slugify.default)(item.title, {
              lower: true,
              strict: true,
              remove: /[*+~.()'"!:@]/g
            }),
            ...gridItems && { items: gridItems }
          };
        }
        try {
          let rendered = content ? md.render(String(content)) : "";
          if (type === "post") {
            rendered = rendered.replace(/<h1[^>]*>.*?<\/h1>/, "");
          }
          return {
            ...item,
            content: rendered,
            slug: (0, import_slugify.default)(item.title, {
              lower: true,
              strict: true,
              remove: /[*+~.()'"!:@]/g
            }),
            ...gridItems && { items: gridItems }
          };
        } catch (error) {
          logger_default.error({ error, title: item.title }, "Failed to render markdown");
          return {
            ...item,
            content: "<p>Error: Failed to render content</p>",
            slug: (0, import_slugify.default)(item.title, {
              lower: true,
              strict: true,
              remove: /[*+~.()'"!:@]/g
            }),
            ...gridItems && { items: gridItems }
          };
        }
      } catch (error) {
        logger_default.error({ error, title: item.title, type }, "Failed to process content");
        return {
          ...item,
          content: "<p>Error: Failed to process content</p>",
          slug: (0, import_slugify.default)(item.title, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g
          }),
          ...gridItems && { items: gridItems }
        };
      }
    })
  );
  return processedItems.sort((a, b) => {
    if (type === "post" && "createdAt" in a && "createdAt" in b) {
      return new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime();
    }
    return 0;
  });
}
var generateBlog = async (blog, basePath, generatorConfig = {}) => {
  logger_default.info({ basePath, hasConfig: Object.keys(generatorConfig).length > 0 }, "Starting blog generation");
  const files = [];
  try {
    if (!blog) {
      throw new Error("Blog configuration is required");
    }
    if (!blog.site || !blog.site.title) {
      throw new Error("Blog site configuration with title is required");
    }
    if (!blog.basics || !blog.basics.name) {
      throw new Error("Blog basics configuration with author name is required");
    }
    logger_default.info("Processing posts...");
    const posts = await processContent(blog.posts, "post", basePath);
    logger_default.info(`Posts processed: ${posts.length}`);
    logger_default.info("Processing pages...");
    const pages = blog.pages ? await processContent(blog.pages, "page", basePath) : [];
    logger_default.info(`Pages processed: ${pages.length}`);
    const compiledTemplates = {
      index: import_handlebars.default.compile(templateFiles.index),
      post: import_handlebars.default.compile(templateFiles.post),
      page: import_handlebars.default.compile(templateFiles.page),
      pageGrid: import_handlebars.default.compile(templateFiles.pageGrid),
      tag: import_handlebars.default.compile(templateFiles.tag),
      category: import_handlebars.default.compile(templateFiles.category)
    };
    const postsPerPage = blog.settings?.postsPerPage || 10;
    const totalPages = Math.max(1, Math.ceil(posts.length / postsPerPage));
    logger_default.info("Generating paginated index pages...");
    const paginationTasks = [];
    for (let page = 1; page <= totalPages; page++) {
      const startIndex = (page - 1) * postsPerPage;
      const endIndex = startIndex + postsPerPage;
      const pagePosts = posts.slice(startIndex, endIndex);
      const pagination = {
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        isFirstPage: page === 1,
        isLastPage: page === totalPages
      };
      const pageData = {
        blog,
        posts: pagePosts,
        pages,
        pagination,
        generatorName,
        generatorVersion
      };
      if (page === 1) {
        paginationTasks.push(
          Promise.resolve({
            name: "index.html",
            content: compiledTemplates.index(pageData)
          })
        );
      }
      paginationTasks.push(
        Promise.resolve({
          name: `page/${page}/index.html`,
          content: compiledTemplates.index(pageData)
        })
      );
    }
    const paginationFiles = await Promise.all(paginationTasks);
    files.push(...paginationFiles);
    logger_default.info("Generating post pages...");
    const postFiles = await Promise.all(
      posts.map(async (post) => {
        logger_default.debug(`Generating post: ${post.title}`);
        return {
          name: `${post.slug}/index.html`,
          content: compiledTemplates.post({ blog, post, posts, pages, generatorName, generatorVersion })
        };
      })
    );
    files.push(...postFiles);
    logger_default.info("Generating static pages...");
    const pageFiles = await Promise.all(
      pages.map(async (page) => {
        logger_default.debug(`Generating page: ${page.title}`);
        const template = page.layout === "grid" ? compiledTemplates.pageGrid : compiledTemplates.page;
        return {
          name: `${page.slug}/index.html`,
          content: template({ blog, page, posts, pages, generatorName, generatorVersion })
        };
      })
    );
    files.push(...pageFiles);
    logger_default.info("Generating tag pages...");
    const tagMap = /* @__PURE__ */ new Map();
    for (const post of posts) {
      if (post.tags) {
        for (const tag of post.tags) {
          if (!tagMap.has(tag)) {
            tagMap.set(tag, []);
          }
          tagMap.get(tag).push(post);
        }
      }
    }
    const tagFiles = await Promise.all(
      Array.from(tagMap.entries()).map(async ([tag, tagPosts]) => {
        const tagSlug = (0, import_slugify.default)(tag, {
          lower: true,
          strict: true,
          remove: /[*+~.()'"!:@]/g
        });
        logger_default.debug(`Generating tag page: ${tag}`);
        return {
          name: `tag/${tagSlug}/index.html`,
          content: compiledTemplates.tag({ blog, tag, posts: tagPosts, pages, generatorName, generatorVersion })
        };
      })
    );
    files.push(...tagFiles);
    logger_default.info("Generating category pages...");
    const categoryMap = /* @__PURE__ */ new Map();
    for (const post of posts) {
      if (post.categories) {
        for (const category of post.categories) {
          if (!categoryMap.has(category)) {
            categoryMap.set(category, []);
          }
          categoryMap.get(category).push(post);
        }
      }
    }
    const categoryFiles = await Promise.all(
      Array.from(categoryMap.entries()).map(async ([category, categoryPosts]) => {
        const categorySlug = (0, import_slugify.default)(category, {
          lower: true,
          strict: true,
          remove: /[*+~.()'"!:@]/g
        });
        logger_default.debug(`Generating category page: ${category}`);
        return {
          name: `category/${categorySlug}/index.html`,
          content: compiledTemplates.category({ blog, category, posts: categoryPosts, pages, generatorName, generatorVersion })
        };
      })
    );
    files.push(...categoryFiles);
    logger_default.info("Generating RSS feed...");
    const siteUrl = blog.meta?.canonical || "https://example.com";
    const feed = new import_rss.default({
      title: blog.site.title,
      description: blog.site.description,
      generator: "JsonBlog Generator",
      feed_url: `${siteUrl}/rss.xml`,
      site_url: siteUrl,
      image_url: blog.basics.image,
      language: "en",
      pubDate: (/* @__PURE__ */ new Date()).toUTCString(),
      ttl: 60
    });
    const rssPosts = posts.slice(0, 20);
    for (const post of rssPosts) {
      const stripHtml = (html) => {
        return html.replace(/<[^>]*>/g, "").trim();
      };
      const plainTextContent = post.content ? stripHtml(post.content) : "";
      const description = post.description || plainTextContent.substring(0, 200) + (plainTextContent.length > 200 ? "..." : "");
      feed.item({
        title: post.title,
        description,
        url: `${siteUrl}/${post.slug}/`,
        guid: `${siteUrl}/${post.slug}/`,
        date: post.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        categories: [...post.tags || [], ...post.categories || []]
      });
    }
    files.push({
      name: "rss.xml",
      content: feed.xml({ indent: true })
    });
    logger_default.info("Generating sitemap...");
    const generateSitemap = () => {
      const urls = [];
      urls.push(`  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);
      for (const post of posts) {
        urls.push(`  <url>
    <loc>${siteUrl}/${post.slug}/</loc>
    <lastmod>${post.updatedAt || post.createdAt || (/* @__PURE__ */ new Date()).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
      }
      for (const page of pages) {
        urls.push(`  <url>
    <loc>${siteUrl}/${page.slug}/</loc>
    <lastmod>${page.updatedAt || page.createdAt || (/* @__PURE__ */ new Date()).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
      }
      for (const [tag] of tagMap) {
        const tagSlug = (0, import_slugify.default)(tag, {
          lower: true,
          strict: true,
          remove: /[*+~.()'"!:@]/g
        });
        urls.push(`  <url>
    <loc>${siteUrl}/tag/${tagSlug}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`);
      }
      for (const [category] of categoryMap) {
        const categorySlug = (0, import_slugify.default)(category, {
          lower: true,
          strict: true,
          remove: /[*+~.()'"!:@]/g
        });
        urls.push(`  <url>
    <loc>${siteUrl}/category/${categorySlug}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`);
      }
      for (let page = 2; page <= totalPages; page++) {
        urls.push(`  <url>
    <loc>${siteUrl}/page/${page}/</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`);
      }
      return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
    };
    files.push({
      name: "sitemap.xml",
      content: generateSitemap()
    });
    logger_default.info("Adding CSS file...");
    files.push({
      name: "main.css",
      content: tailwindCss
    });
    logger_default.info({ filesGenerated: files.length }, "Blog generation completed successfully");
    return files;
  } catch (error) {
    logger_default.error({ error }, "Blog generation failed");
    throw error;
  }
};
var index_default = generateBlog;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateBlog
});
