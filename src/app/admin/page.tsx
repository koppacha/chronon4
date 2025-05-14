import prisma from '@/lib/prisma'

export default async function AdminPage() {
    const likes = await prisma.like.findMany({
        where: { flag: false },
        orderBy: { createdAt: 'desc' },
    })

    return (
        <main className="p-6">
            <h1 className="text-2xl font-bold mb-4">いいね管理</h1>
            <table className="table-auto">
                <thead>
                <tr><th>記事ID</th><th>SessionID</th><th>日時</th></tr>
                </thead>
                <tbody>
                {likes.map(l => (
                    <tr key={l.id}>
                        <td>{l.articleId}</td>
                        <td>{l.sessionId}</td>
                        <td>{l.createdAt.toLocaleString()}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </main>
    )
}