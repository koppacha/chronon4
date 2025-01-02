import { CMS_NAME } from "@/lib/constants";

export function Intro() {
  return (
    <section className="flex-col md:flex-row flex items-center md:justify-between mt-16 mb-16 md:mb-12">
      <h1 className="text-5xl md:text-8xl font-bold tracking-tighter leading-tight md:pr-8">
        Chrononglyph
      </h1>
      <div className="info-container">
          このブログは、こっぱちゃ（@koppachappy）が個人的に思うことを書き残す日記系ブログです。
          2004年09月から１日１本相当の連載維持を目指して運営中。<br/>
          <br/>
          <strong>４代目開設および公開運営復帰について</strong><br/>
          2023年05月より他活動の影響で維持管理が難しくなり非公開運営を続けておりましたが、2024年09月より公開運営を再開しています。
          当面の間は2023年以降の記事のみ公開するプロトタイプ版運営となります。2022年以前の記事についてはコンプライアンスチェック後に順次公開予定です。
      </div>
    </section>
  );
}
