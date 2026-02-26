import Link from "next/link";

type Props = {
    basePath: string;
    currentPage: number;
    totalPages: number;
};

function pageHref(basePath: string, page: number) {
    return `${basePath}?page=${page}`;
}

export default function PaginationNav({ basePath, currentPage, totalPages }: Props) {
    if (totalPages <= 1) return null;

    return (
        <div className="pagination-nav">
            {currentPage > 1 ? (
                <Link className="pagination-button" href={pageHref(basePath, currentPage - 1)}>
                    前へ
                </Link>
            ) : (
                <span className="pagination-button pagination-button-disabled">前へ</span>
            )}
            <span className="pagination-status">{currentPage} / {totalPages}</span>
            {currentPage < totalPages ? (
                <Link className="pagination-button" href={pageHref(basePath, currentPage + 1)}>
                    次へ
                </Link>
            ) : (
                <span className="pagination-button pagination-button-disabled">次へ</span>
            )}
        </div>
    );
}
