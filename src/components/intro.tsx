import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faCircleInfo,
    faCloud,
    faCommentDots,
    faPencil,
    faThumbsUp
} from "@fortawesome/free-solid-svg-icons";
import { faTwitter } from "@fortawesome/free-brands-svg-icons";
import Link from "next/link";
import prisma from "@/lib/prisma";
import UserSummary from "@/components/user-summary";
import DevAuthSwitcher from "@/components/dev-auth-switcher";
import { isDevAuthMockEnabled } from "@/lib/dev-auth";
import { GuestAccountMessage, IntroAuthAction } from "@/components/intro-auth";
import type { ReactNode } from "react";
import { getSessionSummary } from "@/lib/session-summary";

const DEFAULT_NOTICE = "お知らせ（2026/08/03）：現在、長期低迷により記事の更新が停止しています。8月下旬までに復帰予定です。";

export async function Intro({ children }: { children?: ReactNode }) {
    const [notice, sessionSummary] = await Promise.all([
        prisma.siteSetting.findUnique({ where: { key: "intro_notice" } })
            .then((setting) => setting?.value || DEFAULT_NOTICE)
            .catch(() => DEFAULT_NOTICE),
        getSessionSummary(),
    ]);
    return (
      <section className="intro-section mt-16 mb-16 md:mb-12">
          {isDevAuthMockEnabled() && <DevAuthSwitcher />}
          <h1 className="info-title text-5xl md:text-8xl font-bold tracking-tighter leading-tight md:pr-8">
              Chrononglyph
          </h1>
          {children}
          <div className="intro-content">
              <div className="info-container">
                  {notice}
                  {/*このブログは、"こっぱちゃ"の日記系個人ブログです。2004年より連載中。毎日00時更新、掲載は７日遅延します。執筆に際しAI不使用。*/}
                  {/*記事を読んだら「いいね <FontAwesomeIcon icon={faThumbsUp}/>」押して頂けると執筆の励みになります。*/}
                  <div className="intro-links">
                      <div className="intro-link-item"><Link href="https://x.com/koppacha">Twitter@koppacha<FontAwesomeIcon icon={faTwitter} /></Link></div>
                      <div className="intro-link-item"><Link href="https://bookmeter.com/users/121721">BookMater<FontAwesomeIcon icon={faBook} /></Link></div>
                      <div className="intro-link-item"><Link href="https://monochmo.com/">monochmo<FontAwesomeIcon icon={faCloud} /></Link></div>
                      <div className="intro-link-item"><Link href="https://note.com/koppacha">note<FontAwesomeIcon icon={faPencil} /></Link></div>
                      <div className="intro-link-item"><Link href="https://marshmallow-qa.com/902llv7nt5sunm2">marshmallow<FontAwesomeIcon icon={faCommentDots} /></Link></div>
                      <IntroAuthAction authenticated={sessionSummary.authenticated} />
                      <div className="intro-link-item"><Link href="/tag/このサイトについて">about<FontAwesomeIcon icon={faCircleInfo} /></Link></div>
                  </div>
              </div>
              <UserSummary summary={sessionSummary} />
          </div>
          <GuestAccountMessage
              authenticated={sessionSummary.authenticated}
              unavailable={sessionSummary.unavailable}
          />
      </section>
  );
}
