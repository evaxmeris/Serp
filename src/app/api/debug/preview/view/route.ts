import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const DEBUG_DIR = path.join(process.cwd(), 'data', 'debug-previews')

export async function GET(req: NextRequest) {
  try {
    const dirPath = req.nextUrl.searchParams.get('dir')
    if (!dirPath) {
      // 列出所有预览
      if (!existsSync(DEBUG_DIR)) {
        return new Response('<h1>暂无预览记录</h1>', { headers: { 'Content-Type': 'text/html;charset=utf-8' } })
      }
      const dirs = await readdir(DEBUG_DIR)
      const html = `<h1>📦 所有预览</h1><ul>${dirs.reverse().slice(0, 20).map(d => `<li><a href="?dir=${encodeURIComponent(path.join(DEBUG_DIR, d))}">${d}</a></li>`).join('')}</ul>`
      return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8' } })
    }
    
    // 安全检查：确保路径在 DEBUG_DIR 下
    const resolvedPath = path.resolve(dirPath)
    if (!resolvedPath.startsWith(path.resolve(DEBUG_DIR))) {
      return new Response('Invalid path', { status: 403 })
    }
    
    const previewFile = path.join(resolvedPath, 'preview.html')
    if (!existsSync(previewFile)) {
      return new Response('预览文件不存在', { status: 404 })
    }
    
    const content = await readFile(previewFile, 'utf-8')
    return new Response(content, { headers: { 'Content-Type': 'text/html;charset=utf-8' } })
  } catch (e: any) {
    return new Response('Error: ' + e.message, { status: 500 })
  }
}
