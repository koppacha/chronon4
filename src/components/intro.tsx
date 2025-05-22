import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faThumbsUp} from "@fortawesome/free-solid-svg-icons";

export function Intro() {
  return (
    <section className="flex-col md:flex-row flex items-center md:justify-between mt-16 mb-16 md:mb-12">
      <h1 className="info-title text-5xl md:text-8xl font-bold tracking-tighter leading-tight md:pr-8">
        Chrononglyph
      </h1>
      <div className="info-container">
          このブログは、こっぱちゃ（@koppachappy）の日記系ブログです。2004年より連載中。原則毎週日曜更新。<br/>
          いいねボタンを設置しました。記事を読んだら押して頂けると執筆の励みになります <FontAwesomeIcon icon={faThumbsUp} />
    </div>
    </section>
  );
}
