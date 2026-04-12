### 総則

- 出力は日本語で回答してください。
- /blog ディレクトリ配下のファイルはブログ本文なので、特に指示がないかぎり読み取らないでください。

### プロジェクト概要

このプロジェクトはNext.jsを利用した個人ブログの独自CWS（コンテンツ管理システム）です。
ブログは本文をmdファイルで記述し、それをコンポーネントがHTMLに変換する形式となっています。
以下のような構造になっています。

- /src : フロントエンドおよびAPIを格納する。
- /prisma : データベース。いまのところ「いいね」ボタンの記録のために使用。
- /labs : ブログの一括修正などをローカルで実施するためのPythonスクリプト群。webアプリの構成とは無関係。
- /blog : ブログ本文の格納場所。あなた（GPT）は基本的にこれを読み取る必要はありません。

### 重要ファイルの把握メモ

#### /src/app

- `src/app/layout.tsx`
  アプリ全体の共通レイアウト。グローバルCSS、GA、RSSリンク、共通フッターを定義する。
- `src/app/globals.css`
  サイト全体の見た目を決めるグローバルCSS。
- `src/app/page.tsx`
  トップページ。最新記事一覧を本文込みで表示する。
- `src/app/post/[slug]/page.tsx`
  個別記事ページ。記事取得、公開可否判定、前後記事リンクを担当する。
- `src/app/date/[yyyy]/page.tsx` と `src/app/date/[yyyy]/[mm]/page.tsx`
  年別・月別アーカイブ一覧。
- `src/app/tag/[tag]/page.tsx`
  タグ別記事一覧とタグ説明文の表示。
- `src/app/rss.xml/route.ts`
  RSS配信エンドポイント。
- `src/app/not-found.tsx`
  404ページ。
- `src/app/api/recent/route.ts`
  最新記事一覧API。サイドメニューなどが依存する。
- `src/app/api/tags/route.ts`
  タグ統計API。
- `src/app/api/single/route.ts`
  単一記事取得API。

#### /src/lib

- `src/lib/archive.ts`
  アーカイブ記事メタ・本文取得の中心。タグ別・年月別一覧もここを通る。
- `src/lib/recent-posts.ts`
  最新記事取得の中心。トップページと `/api/recent` が依存する。
- `src/lib/post-detail.ts`
  個別記事本文の取得処理。公開遅延や404制御にも関わる。
- `src/lib/publication-delay.ts`
  掲載遅延の共通判定。日付ベースの公開可否をここで決める。
- `src/lib/render-post-body.ts`
  Markdown本文をHTMLへ変換し、リンク装飾まで行うサーバー側レンダラ。本文HTMLキャッシュの中心でもある。
- `src/lib/post-content.ts`
  本文HTMLの共通後処理。独自リンク、画像、YouTube埋め込みなどを担当する。
- `src/lib/rss.ts`
  RSS本文生成とRSS XML全体の組み立て。
- `src/lib/tag-stats.ts`
  タグ統計の集計処理。タグ一覧APIの母体。
- `src/lib/posts.ts`
  `/blog` 配下のMarkdownファイル一覧取得と本文読込。低レベルのファイルアクセス層。
- `src/lib/cache.ts`
  プロセス内TTLキャッシュ。記事メタや本文HTMLキャッシュの基礎。
- `src/lib/post-visibility.ts`
  準非公開記事の追加制御。掲載遅延とは別系統の非表示条件。
- `src/lib/year-color.ts`
  記事年に応じた色付けと、記事リンク判定の補助関数。
- `src/lib/tag-url.ts`
  タグ名とURLキーの相互変換。
- `src/lib/pagination.ts`
  一覧ページのページネーション処理。
- `src/lib/sanitizeHtml.ts`
  本文HTMLの簡易サニタイズ。iframe許可条件もここにある。
- `src/lib/markdownToHtml.ts`
  `remark` によるMarkdown→HTML変換の薄いラッパー。

#### /src/components

- `src/components/post-body.tsx`
  本文HTMLを表示するコンポーネント。現在はサーバー側でHTML完成後に描画する。
- `src/components/post-body-guard.tsx`
  本文表示前に非公開条件を確認するラッパー。
- `src/components/post-header.tsx`
  記事番号・タイトル・日付・カテゴリ・タグの表示を担当する。
- `src/components/post-footer.tsx`
  文字数、更新日時、LikeButton を表示する。
- `src/components/archive-article-list.tsx`
  月別・タグ別などの本文付き記事一覧を描画する主要コンポーネント。
- `src/components/archive-list.tsx`
  年別などのメタ情報中心の一覧表示に使う。
- `src/components/pagination-nav.tsx`
  一覧ページのページ送りUI。
- `src/components/side-menu.tsx`
  右側または下部に出る関連記事一覧。`/api/recent` に依存する。
- `src/components/tag-stats-list.tsx`
  タグ統計一覧の表示。`/api/tags` に依存する。
- `src/components/toggle-list.tsx`
  個別記事ページ下部の補助一覧群の切替UI。
- `src/components/tag-list.tsx` と `src/components/related-list.tsx`
  旧来の一覧取得ロジックに依存するため、挙動変更時は注意が必要。
- `src/components/markdown-styles.module.css`
  本文HTML向けの局所スタイル。YouTube埋め込み幅もここで制御している。

### 補足

- 本文描画・掲載遅延・404制御は `/src/app` だけでなく `/src/lib` の取得ロジックと強く結びついている。
- UIだけを直しても、`/src/lib` 側の取得条件が古いままだと挙動は揃わない。
