import {Post} from "@/interfaces/post";
import fs from "fs";
import matter from "gray-matter";
import {join} from "path";

const postsDirectory = join(process.cwd(), "posts");

// mdファイルを全探索
export function getPostSlugs(){
  return fs.readdirSync(postsDirectory, { recursive: true, encoding: "utf8" }).filter(file => file.endsWith('.md'));
}

export function getPostBySlug(slug: string) {
  const realSlug = slug.replace(/\.md$/, "");
  const fullPath = join(postsDirectory, `${realSlug}.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return { ...data, slug: realSlug, content } as Post;
}

export function getPostById(id: string){
  const slugs = getPostSlugs();
  const slug = slugs.find(slug => slug.endsWith(`${id}.md`))
  if(!slug){
    throw new Error(`No post with id ${id} found.`);
  }
  const fullPath = join(postsDirectory, slug);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return { ...data, slug: slug.replace(/\.md$/, ""), content } as Post;
}

export function getAllPosts(): Post[] {
  const slugs = getPostSlugs();
  return slugs
      .map((slug) => getPostBySlug(slug))
      // sort posts by date in descending order
      .sort((post1, post2) => (post1.date > post2.date ? -1 : 1));
}
