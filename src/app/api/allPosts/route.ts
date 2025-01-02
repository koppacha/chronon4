import { NextResponse } from "next/server";
import { getAllPostFiles } from "@/lib/posts";

export async function GET() {
    try {
        const files = await getAllPostFiles();
        return NextResponse.json(files, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}