import DateFormatter from "./date-formatter";

type Props = {
    update: string,
    size: number
};

export function PostFooter({update, size}: Props) {

    return (
        <>
            <div className="footer-container">
                <span>{Number(size).toLocaleString()} 文字</span> ー 最終更新：<span>{update}</span>
            </div>
        </>
    );
}
