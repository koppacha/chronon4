import Avatar from "./avatar";
import CoverImage from "./cover-image";
import DateFormatter from "./date-formatter";
import {PostTitle} from "@/app/_components/post-title";
import {type Author} from "@/interfaces/author";
import Link from "next/link";

type Props = {
    id: string,
    title: string,
    coverImage: string,
    date: string,
    author: Author,
    tags: any,
    categories: any
};

export function PostHeader({id, title, coverImage, date, author, tags, categories}: Props) {

    const number = Number(id.split("-").pop())
    const link = String(number).padStart(5, "0")

    return (
        <>
            <div className="post-header">
                #{number}
            </div>
            <Link href={`/post/${link}`}><PostTitle>{title}</PostTitle></Link>
            <div className="tags-container">
                <DateFormatter dateString={date}/>
                <span className="tag-block">{categories[0]}</span>
                {tags?.map((tag:string, index:number) => (
                    <span key={index} className="tag-block">{tag}</span>
                ))}
            </div>
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
