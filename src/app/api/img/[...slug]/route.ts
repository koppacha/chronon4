// src/app/api/img/[...slug]/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { join } from 'path'
import { promises as fs } from 'fs'
import { extname } from 'path'

type RouteContext = {
  params: Promise<{ slug: string[] }>   // catch-all は string[]
}

export async function GET(
  req: NextRequest,
  { params }: RouteContext
) {
  const localPath = join(process.cwd(), 'blog', ...(await params).slug)
  const ext = extname(localPath).toLowerCase().slice(1) // 例: 'jpg'

  // 拡張子と MIME タイプの対応表
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    svg: 'image/svg+xml'
  }

  const contentType = mimeMap[ext]
  if (!contentType) {
    // 画像以外は 404
    return new NextResponse(null, { status: 404 })
  }

  try {
    const data = await fs.readFile(localPath)
    return new NextResponse(data, {
      headers: { 'Content-Type': contentType }
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}