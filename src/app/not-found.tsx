export default function NotFound() {
    return (
        <main className="container" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
            <div className="article">
                <h1 className="post-title">404 Not Found</h1>
                <p>指定されたページは見つかりませんでした。</p>
                <p><a href="/">トップページへ戻る</a></p>
            </div>
        </main>
    );
}
