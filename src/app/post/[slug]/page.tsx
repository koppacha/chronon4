import { Metadata } from "next";
import { notFound } from "next/navigation";
import {getAllPosts, getPostById, getPostBySlug, getPostsByDateRange} from "@/lib/api";
import { CMS_NAME } from "@/lib/constants";
import markdownToHtml from "@/lib/markdownToHtml";
import Alert from "@/app/_components/alert";
import Container from "@/app/_components/container";
import Header from "@/app/_components/header";
import PostBody from "@/app/_components/post-body";
import { PostHeader } from "@/app/_components/post-header";
import Link from "next/link";
import {hidden} from "next/dist/lib/picocolors";
import RelatedList from "@/app/_components/related-list";
import TagList from "@/app/_components/tag-list";
import ToggleLists from "@/app/_components/toggle-list";

export default async function Post({ params }: Params) {

  function zeroPad(num: number): string {
    return String(num).padStart(5, "0");
  }
  function compareDate(postDate: string) :number {
    // 現在の日付を取得し、時間情報を削除（00:00:00に設定）
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // postDate も時間情報を削除（00:00:00に設定）
    const targetDate = new Date(postDate)
    targetDate.setHours(0, 0, 0, 0)

    // 日付を比較
    if (targetDate.getTime() === today.getTime()) {
      return 0 // 当日
    } else if (targetDate.getTime() > today.getTime()) {
      return 1 // 明日以降
    } else {
      return -1 // 昨日以前
    }
  }
  // URLに基づき該当記事を取得
  const post = getPostById(params.slug)

  // 前後記事のURLを生成
  const next = <div className="grid-item"><Link href={`/post/${zeroPad(Number(params.slug) + 1)}`}>次の記事へ</Link></div>
  const prev = <div className="grid-item"><Link href={`/post/${zeroPad(Number(params.slug) - 1)}`}>前の記事へ</Link></div>

  const hiddenFlg = (post.tags?.includes("準非公開の記事") || (Number(params.slug) < 6955))

  if (!post || hiddenFlg) {
    return notFound()
  }

  const content = await markdownToHtml(post.content || "");

  return (
      <main>
        <Container>
          <Header/>
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
            <PostBody content={content} date={post.date}/>
          </article>
          <div className="grid-container">
            {(Number(params.slug) > 6955) && prev}
            {compareDate(post.date) < 0 && next}
        </div>
        <br style={{ clear: "both" }}/>
        <ToggleLists slug={params.slug} post={post}/>
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

  const title = `${post.title} - Chrononglyph`;

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
