interface BlogSite {
    title: string;
    description: string;
}
interface BlogBasics {
    name: string;
    label?: string;
    image?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: {
        address?: string;
        postalCode?: string;
        city?: string;
        countryCode?: string;
        region?: string;
    };
    profiles?: Array<{
        network: string;
        username: string;
        url?: string;
    }>;
}
interface BlogPost {
    title: string;
    description?: string;
    source?: string;
    createdAt?: string;
    updatedAt?: string;
    content?: string;
    slug?: string;
    tags?: string[];
    categories?: string[];
    type?: 'ai' | 'human';
}
interface PageGridItem {
    title: string;
    description?: string;
    url?: string;
    thumbnail?: string;
    image?: string;
    featured?: boolean;
    date?: string;
    tags?: string[];
}
interface BlogPage {
    title: string;
    description?: string;
    source?: string;
    createdAt?: string;
    updatedAt?: string;
    content?: string;
    slug?: string;
    layout?: 'default' | 'grid';
    items?: PageGridItem[];
    itemsSource?: string;
}
interface Blog {
    site: BlogSite;
    basics: BlogBasics;
    posts: BlogPost[];
    pages?: BlogPage[];
    meta?: {
        canonical?: string;
        version?: string;
        lastModified?: string;
    };
    settings?: {
        postsPerPage?: number;
    };
}
interface GeneratedFile {
    name: string;
    content: string;
}

declare const generateBlog: (blog: Blog, basePath: string, generatorConfig?: Record<string, any>) => Promise<GeneratedFile[]>;

export { generateBlog as default, generateBlog };
