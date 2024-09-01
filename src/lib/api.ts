import {Post} from "@/interfaces/post";
import fs from "fs";
import matter from "gray-matter";
import {join} from "path";

const postsDirectory = join(process.cwd(), "blog");

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
export function getRecentPostsById(): Post[] {
  const slugs = getPostSlugs();
  return slugs
      .map((slug) => getPostBySlug(slug))
      .filter(post => {
        const currentDate = new Date();
        const postDate = new Date(post.date);

        // 未来日付を除外
        if (postDate > currentDate) {
          return false;
        }
        // タイトルがfalsyなら除外
        return post.title;
      })
      // IDの大きい順にソート
      .sort((post1, post2) => (post1.slug > post2.slug ? -1 : 1))
      // 上位7つの投稿を取得
      .slice(0, 7);
}
export function getPostsByDateRange(startDate: string, endDate: string): Post[] {
  const slugs = getPostSlugs();
  const start = new Date(startDate);
  const end = new Date(endDate);

  return slugs
      .filter(slug => {
        // ファイル名から日付部分を抽出
        const datePart = slug.slice(0, 10); // yyyy-mm-dd 部分
        const postDate = new Date(datePart);
        return postDate >= start && postDate <= end;
      })
      .map(slug => getPostBySlug(slug))
      // 日付順にソート (降順)
      .sort((post1, post2) => (new Date(post1.date) > new Date(post2.date) ? -1 : 1));
}