import Avatar from "./avatar";
import CoverImage from "./cover-image";
import DateFormatter from "./date-formatter";
import {PostTitle} from "@/components/post-title";
import {type Author} from "@/interfaces/author";
import Link from "next/link";
import {id2slug} from "@/lib/chronon4";

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

    const category = Array.isArray(categories) ? categories[0] : categories

    return (
        <>
            <div className="post-header">
                {`#${Number(id)}`}
            </div>
            <Link href={`/post/${id}`}><PostTitle>{title}</PostTitle></Link>
            <div className="tags-container">
                <DateFormatter dateString={date}/>
                {category && <span className="tag-block">{category}</span>}
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
