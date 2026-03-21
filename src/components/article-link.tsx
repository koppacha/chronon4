"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { type ReactNode } from "react";
import {
    DEFAULT_YEAR_COLOR_CLASS,
    getPostIdFromHref,
    getYearColorClass,
    isExternalHref,
    isInternalPostHref,
} from "@/lib/year-color";

type Props = {
    href?: string | null;
    children: ReactNode;
    className?: string;
    linkedPostDates?: Record<string, string>;
    rel?: string;
    target?: string;
    title?: string;
};

export default function ArticleLink({
    href,
    children,
    className = "",
    linkedPostDates = {},
    rel,
    target,
    title,
}: Props) {
    const external = isExternalHref(href);

    let yearColorClass = DEFAULT_YEAR_COLOR_CLASS;
    if (isInternalPostHref(href)) {
        const postId = getPostIdFromHref(href);
        yearColorClass = getYearColorClass(postId ? linkedPostDates[postId] : undefined);
    }

    const mergedClassName = `${className} ${yearColorClass}`.trim();

    if (!href) {
        return <span className={mergedClassName}>{children}</span>;
    }

    if (external) {
        return (
            <a href={href} className={mergedClassName} rel={rel} target={target} title={title}>
                {children} <FontAwesomeIcon icon={faUpRightFromSquare} />
            </a>
        );
    }

    return (
        <a href={href} className={mergedClassName} rel={rel} target={target} title={title}>
            {children}
        </a>
    );
}
