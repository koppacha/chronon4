import { Metadata } from "next";
import { notFound } from "next/navigation";
import {getAllPosts, getPostById, getPostBySlug} from "@/lib/api";
import { CMS_NAME } from "@/lib/constants";
import markdownToHtml from "@/lib/markdownToHtml";
import Alert from "@/app/_components/alert";
import Container from "@/app/_components/container";
import Header from "@/app/_components/header";
import { PostBody } from "@/app/_components/post-body";
import { PostHeader } from "@/app/_components/post-header";
import fs from "fs";
import Link from "next/link";

export default async function Post({ params }: Params) {

  function zeroPad(num: number): string {
    return String(num).padStart(5, "0");
  }
  // URLに基づき該当記事を取得
  const post = getPostById(params.slug)

  // 前後記事のURLを生成
  const next = zeroPad(Number(params.slug) + 1)
  const prev = zeroPad(Number(params.slug) - 1)

  if (!post) {
    return notFound();
  }

  const content = await markdownToHtml(post.content || "");

  return (
    <main>
      <Container>
        <Header />
        <article className="mb-32 max-w-2xl mx-auto">
          <PostHeader
            id={post.number}
            title={post.title}
            coverImage={post.coverImage}
            date={post.date}
            author={post.author}
          />
          <PostBody content={content} />
        </article>
        <Link href={`/posts/${next}`}>Next</Link>
        <Link href={`/posts/${prev}`}>Prev</Link>
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
