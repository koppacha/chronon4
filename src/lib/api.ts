import {Post} from "@/interfaces/post";
import fs from "fs";
import matter from "gray-matter";
import {join} from "path";

const postsDirectory = join(process.cwd(), "_posts");

function getPostSlugs(dir: string = postsDirectory, slugs: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      getPostSlugs(fullPath, slugs);
    } else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
      const relativePath = fullPath.replace(`${postsDirectory}/`, '');
      slugs.push(relativePath);
    }
  }
  // return fs.readdirSync(postsDirectory);
  return slugs;
}
export function getPostBySlug(slug: string) {
  const realSlug = slug.replace(/\.md$/, "");
  const fullPath = join(postsDirectory, `${realSlug}.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return { ...data, slug: realSlug, content } as Post;
}

export function getAllPosts(): Post[] {
  const slugs = getPostSlugs();
  return slugs
      .map((slug) => getPostBySlug(slug))
      // sort posts by date in descending order
      .sort((post1, post2) => (post1.date > post2.date ? -1 : 1));
}
