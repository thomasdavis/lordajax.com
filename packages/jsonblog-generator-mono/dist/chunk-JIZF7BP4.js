// src/index.ts
import Handlebars from "handlebars";
import slugify from "slugify";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import RSS from "rss";

// src/logger.ts
import pino from "pino";
var logger = pino({
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
import MarkdownIt from "markdown-it";
var __filename = fileURLToPath(import.meta.url);
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
var md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});
Handlebars.registerHelper("formatDate", (date) => {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
});
Handlebars.registerHelper("slugify", (text) => {
  return slugify(text, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
});
Handlebars.registerHelper("eq", (a, b) => {
  return a === b;
});
Handlebars.registerHelper("add", (a, b) => {
  return a + b;
});
Handlebars.registerHelper("subtract", (a, b) => {
  return a - b;
});
Handlebars.registerHelper("multiply", (a, b) => {
  return a * b;
});
Handlebars.registerHelper("gt", (a, b) => {
  return a > b;
});
Handlebars.registerHelper("lt", (a, b) => {
  return a < b;
});
Handlebars.registerPartial("layout", templateFiles.layout);
Handlebars.registerPartial("content", "{{> @partial-block }}");
async function fetchFile(uri, basePath) {
  try {
    if (uri.startsWith("http")) {
      logger_default.debug({ uri }, "Fetching remote file");
      const response = await axios.get(`${uri}?cb=${(/* @__PURE__ */ new Date()).getTime()}`, {
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
            slug: slugify(item.title, {
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
            slug: slugify(item.title, {
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
            slug: slugify(item.title, {
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
          slug: slugify(item.title, {
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
      index: Handlebars.compile(templateFiles.index),
      post: Handlebars.compile(templateFiles.post),
      page: Handlebars.compile(templateFiles.page),
      pageGrid: Handlebars.compile(templateFiles.pageGrid),
      tag: Handlebars.compile(templateFiles.tag),
      category: Handlebars.compile(templateFiles.category)
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
        const tagSlug = slugify(tag, {
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
        const categorySlug = slugify(category, {
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
    const feed = new RSS({
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
        const tagSlug = slugify(tag, {
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
        const categorySlug = slugify(category, {
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

export {
  generateBlog,
  index_default
};
