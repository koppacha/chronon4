import RelatedList from "@/app/_components/related-list";
import TagList from "@/app/_components/tag-list";

export default function ToggleLists({slug, post}){
    return (
        <div>
            {Array.isArray(post.tags) &&
                post.tags.map((tag: string) => (
                    <div className="post-list" key={tag}>
                        <div className="list-title">同じタグを含む記事（{tag}）</div>
                        <TagList tag={tag}/>
                    </div>
                ))}
            <div className="post-list">
                <div className="list-title">前後の記事</div>
                <RelatedList slug={slug} key="related-list" />
            </div>
        </div>
    );
}