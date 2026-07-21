"use strict";
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

// ../core/dist/index.js
var import_axios = __toESM(require("axios"), 1);
var fs = __toESM(require("fs"), 1);
var import_handlebars = __toESM(require("handlebars"), 1);
var import_markdown_it = __toESM(require("markdown-it"), 1);
var path = __toESM(require("path"), 1);
var import_rss = __toESM(require("rss"), 1);
var import_slugify = __toESM(require("slugify"), 1);
var import_pino = __toESM(require("pino"), 1);
var SLUGIFY_OPTS = {
  lower: true,
  strict: true,
  remove: /[*+~.()'"!:@]/g
};
function slug(text) {
  return (0, import_slugify.default)(text, SLUGIFY_OPTS);
}
function longFormDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
function registerBaseHelpers(hb) {
  hb.registerHelper("formatDate", longFormDate);
  hb.registerHelper("slugify", slug);
  hb.registerHelper("eq", (a, b) => a === b);
  hb.registerHelper("add", (a, b) => a + b);
  hb.registerHelper("subtract", (a, b) => a - b);
  hb.registerHelper("multiply", (a, b) => a * b);
  hb.registerHelper("gt", (a, b) => a > b);
  hb.registerHelper("lt", (a, b) => a < b);
  hb.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
  hb.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
  hb.registerHelper(
    "json",
    (value) => new hb.SafeString(JSON.stringify(value ?? null))
  );
}
var logger = (0, import_pino.default)({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname"
    }
  },
  // Quiet by default so the engine never spams CLI/consumer output; set
  // LOG_LEVEL=info or debug for verbose generation logs.
  level: process.env.LOG_LEVEL || "warn"
});
var logger_default = logger;
var md = new import_markdown_it.default({ html: true, linkify: true, typographer: true });
async function fetchFile(uri, basePath) {
  try {
    if (uri.startsWith("http")) {
      logger_default.debug({ uri }, "Fetching remote file");
      const response = await import_axios.default.get(`${uri}?cb=${(/* @__PURE__ */ new Date()).getTime()}`, {
        timeout: 3e4,
        maxContentLength: 10 * 1024 * 1024
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
async function processContent(items, type, basePath, stripPostTitle) {
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
              logger_default.debug(
                { itemsSource: item.itemsSource },
                "Loaded grid items from external file"
              );
            } catch (error) {
              logger_default.error({ error, itemsSource: item.itemsSource }, "Failed to parse items JSON");
            }
          }
        }
        if (!content && (!("layout" in item) || item.layout !== "grid")) {
          return {
            ...item,
            content: "<p>Error: No content found</p>",
            slug: slug(item.title),
            ...gridItems && { items: gridItems }
          };
        }
        try {
          let rendered = content ? md.render(String(content)) : "";
          if (type === "post" && stripPostTitle) {
            rendered = rendered.replace(/<h1[^>]*>.*?<\/h1>/, "");
          }
          const excerpt = rendered.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
          return {
            ...item,
            content: rendered,
            excerpt,
            slug: slug(item.title),
            ...gridItems && { items: gridItems }
          };
        } catch (error) {
          logger_default.error({ error, title: item.title }, "Failed to render markdown");
          return {
            ...item,
            content: "<p>Error: Failed to render content</p>",
            slug: slug(item.title),
            ...gridItems && { items: gridItems }
          };
        }
      } catch (error) {
        logger_default.error({ error, title: item.title, type }, "Failed to process content");
        return {
          ...item,
          content: "<p>Error: Failed to process content</p>",
          slug: slug(item.title),
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
function createGenerator(theme) {
  const { templatesDir, generatorName, generatorVersion } = theme;
  const cssSourceFile = theme.cssSourceFile ?? "main.css";
  const stripPostTitle = theme.stripPostTitle ?? true;
  const read = (name) => fs.readFileSync(path.join(templatesDir, name), "utf8");
  const readOptional = (name) => {
    const p = path.join(templatesDir, name);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : void 0;
  };
  const templateFiles = {
    index: read("index.hbs"),
    post: read("post.hbs"),
    page: read("page.hbs"),
    pageGrid: readOptional("page-grid.hbs"),
    layout: read("layout.hbs"),
    tag: read("tag.hbs"),
    category: read("category.hbs")
  };
  const css = read(cssSourceFile);
  const hb = import_handlebars.default.create();
  registerBaseHelpers(hb);
  if (theme.helpers) {
    for (const [name, fn] of Object.entries(theme.helpers)) {
      hb.registerHelper(name, fn);
    }
  }
  hb.registerPartial("layout", templateFiles.layout);
  hb.registerPartial("content", "{{> @partial-block }}");
  const compiledTemplates = {
    index: hb.compile(templateFiles.index),
    post: hb.compile(templateFiles.post),
    page: hb.compile(templateFiles.page),
    pageGrid: templateFiles.pageGrid ? hb.compile(templateFiles.pageGrid) : null,
    tag: hb.compile(templateFiles.tag),
    category: hb.compile(templateFiles.category)
  };
  return async function generateBlog2(blog, basePath, generatorConfig = {}) {
    logger_default.info(
      { basePath, hasConfig: Object.keys(generatorConfig).length > 0 },
      "Starting blog generation"
    );
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
      const posts = await processContent(blog.posts, "post", basePath, stripPostTitle);
      logger_default.info(`Posts processed: ${posts.length}`);
      logger_default.info("Processing pages...");
      const pages = blog.pages ? await processContent(blog.pages, "page", basePath, stripPostTitle) : [];
      logger_default.info(`Pages processed: ${pages.length}`);
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
            Promise.resolve({ name: "index.html", content: compiledTemplates.index(pageData) })
          );
        }
        paginationTasks.push(
          Promise.resolve({
            name: `page/${page}/index.html`,
            content: compiledTemplates.index(pageData)
          })
        );
      }
      files.push(...await Promise.all(paginationTasks));
      logger_default.info("Generating post pages...");
      const postFiles = await Promise.all(
        posts.map(async (post, i) => ({
          name: `${post.slug}/index.html`,
          content: compiledTemplates.post({
            blog,
            post,
            posts,
            pages,
            newerPost: posts[i - 1],
            olderPost: posts[i + 1],
            generatorName,
            generatorVersion
          })
        }))
      );
      files.push(...postFiles);
      logger_default.info("Generating static pages...");
      const pageFiles = await Promise.all(
        pages.map(async (page) => {
          const template = page.layout === "grid" && compiledTemplates.pageGrid ? compiledTemplates.pageGrid : compiledTemplates.page;
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
            if (!tagMap.has(tag)) tagMap.set(tag, []);
            tagMap.get(tag).push(post);
          }
        }
      }
      const tagFiles = await Promise.all(
        Array.from(tagMap.entries()).map(async ([tag, tagPosts]) => ({
          name: `tag/${slug(tag)}/index.html`,
          content: compiledTemplates.tag({
            blog,
            tag,
            posts: tagPosts,
            pages,
            generatorName,
            generatorVersion
          })
        }))
      );
      files.push(...tagFiles);
      logger_default.info("Generating category pages...");
      const categoryMap = /* @__PURE__ */ new Map();
      for (const post of posts) {
        if (post.categories) {
          for (const category of post.categories) {
            if (!categoryMap.has(category)) categoryMap.set(category, []);
            categoryMap.get(category).push(post);
          }
        }
      }
      const categoryFiles = await Promise.all(
        Array.from(categoryMap.entries()).map(async ([category, categoryPosts]) => ({
          name: `category/${slug(category)}/index.html`,
          content: compiledTemplates.category({
            blog,
            category,
            posts: categoryPosts,
            pages,
            generatorName,
            generatorVersion
          })
        }))
      );
      files.push(...categoryFiles);
      logger_default.info("Generating RSS feed...");
      const siteUrl = blog.site.url || blog.meta?.canonical || "https://example.com";
      const feedPubDate = posts.find((p) => p.createdAt)?.createdAt;
      const feed = new import_rss.default({
        title: blog.site.title,
        description: blog.site.description,
        generator: "JsonBlog Generator",
        feed_url: `${siteUrl}/rss.xml`,
        site_url: siteUrl,
        image_url: blog.basics.image,
        language: "en",
        ...feedPubDate ? { pubDate: feedPubDate } : {},
        ttl: 60
      });
      const stripHtml = (html) => html.replace(/<[^>]*>/g, "").trim();
      for (const post of posts.slice(0, 20)) {
        const plainTextContent = post.content ? stripHtml(post.content) : "";
        const description = post.description || plainTextContent.substring(0, 200) + (plainTextContent.length > 200 ? "..." : "");
        const item = {
          title: post.title,
          description,
          url: `${siteUrl}/${post.slug}/`,
          guid: `${siteUrl}/${post.slug}/`,
          categories: [...post.tags || [], ...post.categories || []]
        };
        if (post.createdAt) item.date = post.createdAt;
        feed.item(item);
      }
      let rssXml = feed.xml({ indent: true });
      rssXml = feedPubDate ? rssXml.replace(
        /<lastBuildDate>[^<]*<\/lastBuildDate>/,
        `<lastBuildDate>${new Date(feedPubDate).toUTCString()}</lastBuildDate>`
      ) : rssXml.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>\s*/, "");
      files.push({ name: "rss.xml", content: rssXml });
      logger_default.info("Generating sitemap...");
      const urls = [];
      urls.push(`  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);
      const lastmodLine = (d) => d ? `
    <lastmod>${d}</lastmod>` : "";
      for (const post of posts) {
        urls.push(`  <url>
    <loc>${siteUrl}/${post.slug}/</loc>${lastmodLine(post.updatedAt || post.createdAt)}
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
      }
      for (const page of pages) {
        urls.push(`  <url>
    <loc>${siteUrl}/${page.slug}/</loc>${lastmodLine(page.updatedAt || page.createdAt)}
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
      }
      for (const [tag] of tagMap) {
        urls.push(`  <url>
    <loc>${siteUrl}/tag/${slug(tag)}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`);
      }
      for (const [category] of categoryMap) {
        urls.push(`  <url>
    <loc>${siteUrl}/category/${slug(category)}/</loc>
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
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
      files.push({ name: "sitemap.xml", content: sitemap });
      logger_default.info("Adding CSS file...");
      files.push({ name: "main.css", content: css });
      logger_default.info({ filesGenerated: files.length }, "Blog generation completed successfully");
      return files;
    } catch (error) {
      logger_default.error({ error }, "Blog generation failed");
      throw error;
    }
  };
}

// src/index.ts
var fs2 = __toESM(require("fs"), 1);
var path2 = __toESM(require("path"), 1);
var import_url = require("url");
var import_meta = {};
var __dirname = path2.dirname((0, import_url.fileURLToPath)(import_meta.url));
var pkg = JSON.parse(fs2.readFileSync(path2.join(__dirname, "../package.json"), "utf8"));
var isoDate = (date) => {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
var generateBlog = createGenerator({
  templatesDir: path2.join(__dirname, "../templates"),
  cssSourceFile: "tailwind.css",
  generatorName: pkg.name,
  generatorVersion: pkg.version,
  helpers: { formatDate: isoDate }
});
var index_default = generateBlog;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateBlog
});
