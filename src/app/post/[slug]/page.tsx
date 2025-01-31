import markdownToHtml from "@/lib/markdownToHtml";
import Container from "@/components/container";
import Header from "@/components/header";
import PostBody from "@/components/post-body";
import { PostHeader } from "@/components/post-header";
import Link from "next/link";
import ToggleLists from "@/components/toggle-list";
import {baseUrl} from "@/lib/const";
import {Grid} from "@mui/material";
import SideMenu from "@/components/side-menu";

export const revalidate = 2592000;

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {

  // 記事を取得
  const { slug } = await params;
  const res = await fetch(`${baseUrl}/api/single?n=${slug}`, { next: { revalidate } });
  if (!res.ok) {
    return <>Not Found</>;
  }
  const post = await res.json();

  // 記事が存在しない or 非公開設定の場合は 404
  const hiddenFlg = post.tags?.includes("準非公開の記事") || Number(slug) < 6955;
  if (!res.ok) {
    return <>Not Found</>;
  }

  // Markdown を HTML に変換
  const content = await markdownToHtml(post.content || "");

  // 前後記事のURLを生成
  const zeroPad = (num: number) => String(num).padStart(5, "0");
  const prev = Number(slug) > 6955 && (
      <div className="grid-item">
        <Link href={`/post/${zeroPad(Number(slug) - 1)}`}>前の記事へ</Link>
      </div>
  );
  const next = new Date(post.date) < new Date() && (
      <div className="grid-item">
        <Link href={`/post/${zeroPad(Number(slug) + 1)}`}>次の記事へ</Link>
      </div>
  );

  return (
      <Container maxWidth="xl">
        <Grid container sx={{ display: "flex" }}>
          <Grid item xs={12}>
            <Header />
          </Grid>
          <Grid item xs={12} md={9} sx={{ order: { xs: 2, md: 1 } }}>
            <article className="article">
              <PostHeader
                  id={post.id}
                  title={post.title}
                  coverImage={post.coverImage}
                  date={post.date}
                  author={post.author}
                  tags={post.tags}
                  categories={post.category}
              />
              {
                hiddenFlg ?
                    <div>この記事は非公開に設定されています。</div> :
                    <PostBody category={post.category[0]} content={content} date={post.date} />
              }
            </article>
            <div className="grid-container">
              {prev}
              {next}
            </div>
            <br style={{ clear: "both" }} />
            <ToggleLists slug={slug} post={post} />
          </Grid>
          <Grid item xs={12} md={3} sx={{ order: { xs: 3, md: 2 } }}>
            <SideMenu />
          </Grid>

        </Grid>
      </Container>
  )
}
