import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

type Props = {
    children: ReactNode;
};

export default function DateLayout({ children }: Props) {
    return children;
}
