import { CMS_NAME } from "@/lib/constants";

export function Intro() {
  return (
    <section className="flex-col md:flex-row flex items-center md:justify-between mt-16 mb-16 md:mb-12">
      <h1 className="info-title text-5xl md:text-8xl font-bold tracking-tighter leading-tight md:pr-8">
        Chrononglyph
      </h1>
      <div className="info-container">
          このブログは、こっぱちゃ（@koppachappy）が個人的に思うことを書き残す日記系ブログです。
          2004年09月から１日１本相当の連載維持を目指して運営中。掲載には最大７日程度の遅延が生じます。2022年以前の記事は非公開になっています。
      </div>
    </section>
  );
}
