import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faThumbsUp} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";

export function Intro() {
  return (
      <section className="flex-col md:flex-row flex items-center md:justify-between mt-16 mb-16 md:mb-12">
          <h1 className="info-title text-5xl md:text-8xl font-bold tracking-tighter leading-tight md:pr-8">
              Chrononglyph
          </h1>
          <div className="info-container">
              このブログは、こっぱちゃの日記系個人ブログです。2004年より連載中、原則日曜更新、執筆に際しAI不使用。
              記事を読んだら「いいね <FontAwesomeIcon icon={faThumbsUp}/>」押して頂けると執筆の励みになります。
              <hr style={{width: "100%", height: "1px"}}/>
              <Link href="https://x.com/koppacha">Twitter@koppacha</Link>
              <Link href="https://bookmeter.com/users/121721">BookMater</Link>
              <Link href="https://monochmo.com/">monochmo</Link>
              <Link href="https://note.com/koppacha">note</Link>
              <Link href="https://marshmallow-qa.com/902llv7nt5sunm2">marshmallow
                  (誤字脱字・情報の誤り・話題提供はこちら）</Link>
              about
          </div>
      </section>
  );
}
