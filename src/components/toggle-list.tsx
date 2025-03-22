import RelatedList from "@/components/related-list";
import TagList from "@/components/tag-list";

export default function ToggleLists({slug, post}){
    return (
        <div style={{width:"100%"}}>
            {Array.isArray(post.tags) &&
                post.tags.map((tag: string) => (
                    <div className="post-list" key={tag}>
                        <div className="list-title">同じタグを含む記事（{tag}）</div>
                        <TagList tag={tag}/>
                    </div>
                ))}
            <div className="post-list">
                <div className="list-title">前後の記事</div>
            </div>
        </div>
    );
}