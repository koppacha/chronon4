import Avatar from "./avatar";
import CoverImage from "./cover-image";
import DateFormatter from "./date-formatter";
import { PostTitle } from "@/app/_components/post-title";
import { type Author } from "@/interfaces/author";

type Props = {
  id: string;
  title: string;
  coverImage: string;
  date: string;
  author: Author;
};

export function PostHeader({ id, title, coverImage, date, author }: Props) {
  return (
      <>
          <div className="mb-6 text-lg">
              #{id}<br/>
              <DateFormatter dateString={date}/>
          </div>
          <PostTitle>{title}</PostTitle>
          {/*<div className="hidden md:block md:mb-12">*/}
          {/*  <Avatar name={author.name} picture={author.picture} />*/}
          {/*</div>*/}
          {/*<div className="mb-8 md:mb-16 sm:mx-0">*/}
          {/*  <CoverImage title={title} src={coverImage} />*/}
          {/*</div>*/}
          <div className="max-w-2xl mx-auto">
              {/*<div className="block md:hidden mb-6">*/}
              {/*  <Avatar name={author.name} picture={author.picture} />*/}
              {/*</div>*/}
          </div>
      </>
  );
}
