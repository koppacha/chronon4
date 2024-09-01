import { Metadata } from "next";
import { notFound } from "next/navigation";
import {getAllPosts, getPostById, getPostBySlug, getPostsByDateRange} from "@/lib/api";
import { CMS_NAME } from "@/lib/constants";
import markdownToHtml from "@/lib/markdownToHtml";
import Alert from "@/app/_components/alert";
import Container from "@/app/_components/container";
import Header from "@/app/_components/header";
import { PostBody } from "@/app/_components/post-body";
import { PostHeader } from "@/app/_components/post-header";
import Link from "next/link";
import {hidden} from "next/dist/lib/picocolors";
import RelatedList from "@/app/_components/related-list";

export default async function Post({ params }: Params) {

  function zeroPad(num: number): string {
    return String(num).padStart(5, "0");
  }
  // URLに基づき該当記事を取得
  const post = getPostById(params.slug)

  // 前後記事のURLを生成
  const next = zeroPad(Number(params.slug) + 1)
  const prev = zeroPad(Number(params.slug) - 1)

  const hiddenFlg = (post.tags?.includes("準非公開の記事") || (Number(params.slug) < 6955))

  if (!post || hiddenFlg) {
    return notFound()
  }

  const content = await markdownToHtml(post.content || "");

  // @ts-ignore
  return (
    <main>
      <Container>
        <Header />
        <article className="article">
          <PostHeader
            id={post.slug}
            title={post.title}
            coverImage={post.coverImage}
            date={post.date}
            author={post.author}
            tags={post.tags}
            categories={post.categories}
          />
          <PostBody content={content} date={post.date} />
        </article>
        <div className="grid-container">
          <div className="grid-item"><Link href={`/post/${prev}`}>前の記事へ</Link></div>
          <div className="grid-item"><Link href={`/post/${next}`}>次の記事へ</Link></div>
        </div>
        <br style={{ clear: "both" }}/>
        <RelatedList slug={params.slug}/>
      </Container>
    </main>
  );
}

type Params = {
  params: {
    slug: string;
  };
};

export function generateMetadata({ params }: Params): Metadata {
  const post = getPostById(params.slug);

  if (!post) {
    return notFound();
  }

  const title = `${post.title} | Next.js Blog Example with ${CMS_NAME}`;

  return {
    title,
    openGraph: {
      title,
      images: "",
    },
  };
}

export async function generateStaticParams() {
  const posts = getAllPosts();

  return posts.map((post) => ({
    slug: post.slug,
  }));
}
