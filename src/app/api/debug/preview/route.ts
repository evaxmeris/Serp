import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// 调试目录
const DEBUG_DIR = path.join(process.cwd(), 'data', 'debug-previews')

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    
    // 确保目录存在
    if (!existsSync(DEBUG_DIR)) {
      await mkdir(DEBUG_DIR, { recursive: true })
    }
    
    const timestamp = Date.now()
    const dir = path.join(DEBUG_DIR, `preview-${timestamp}`)
    await mkdir(dir, { recursive: true })
    
    // 下载图片和视频
    const mediaItems = data.images || []
    const imgTags: string[] = []
    for (let i = 0; i < Math.min(mediaItems.length, 25); i++) {
      const item = typeof mediaItems[i] === 'string' ? { url: mediaItems[i], type: 'image' } : mediaItems[i]
      const url = item.url || ''
      const isVideo = item.type === 'video' || /\.(mp4|webm|mov|avi)$/i.test(url)
      if (!url) continue
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(15000) })
        if (resp.ok) {
          const buffer = Buffer.from(await resp.arrayBuffer())
          if (isVideo) {
            const b64 = buffer.toString('base64')
            imgTags.push(`<div class="img-box video-box"><video controls style="width:100%;height:140px"><source src="data:video/mp4;base64,${b64}" type="video/mp4"></video><div class="img-label">🎬 视频 #${i+1}</div></div>`)
          } else {
            const ext = url.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'jpg'
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
            const b64 = buffer.toString('base64')
            imgTags.push(`<div class="img-box"><img src="data:${mime};base64,${b64}" alt="#${i+1}"><div class="img-label">#${i+1}</div></div>`)
          }
        }
      } catch (e) {
        imgTags.push(`<div class="img-box"><div class="img-error">${isVideo ? '🎬' : '❌'} ${isVideo ? '视频' : '图片'}${i+1}下载失败</div></div>`)
      }
    }
    
    // 生成CSV
    const attrs = data.attributes || []
    let csv = '属性名,属性值\n'
    attrs.forEach((a: any) => {
      const name = (a.name || a.nameCn || '').replace(/"/g, '""')
      const value = (a.value || a.valueCn || '').replace(/"/g, '""')
      csv += `"${name}","${value}"\n`
    })
    await writeFile(path.join(dir, 'attributes.csv'), csv)
    
    // 生成描述文本文件
    const desc = (data.description || data.descriptionEn || '').replace(/<[^>]+>/g, '').substring(0, 5000)
    await writeFile(path.join(dir, 'description.txt'), desc)
    
    // 生成 HTML 预览
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>采集预览 - ${data.title || '未知'}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 24px; color: #333; }
  .container { max-width: 960px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 16px; word-break: break-all; }
  .section { background: #fff; border-radius: 10px; padding: 16px 20px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .section h2 { font-size: 14px; color: #555; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th { color: #888; background: #fafafa; position: sticky; top: 0; }
  .img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap: 10px; }
  .img-box { border: 1px solid #eee; border-radius: 6px; overflow: hidden; background: #fafafa; }
  .img-box img { width: 100%; height: 140px; object-fit: contain; display: block; }
  .img-label { padding: 4px 6px; font-size: 11px; color: #888; background: #fff; }
  .img-error { padding: 20px; text-align: center; color: #dc2626; font-size: 12px; }
  .desc-box { font-size: 13px; line-height: 1.6; color: #555; max-height: 300px; overflow-y: auto; white-space: pre-wrap; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; background: #dbeafe; color: #1d4ed8; margin-left: 6px; }
  .info-grid { display: grid; grid-template-columns: 100px 1fr; gap: 6px; font-size: 13px; }
  .info-grid .lbl { color: #888; }
  .info-grid .val { font-weight: 500; }
  .actions { display: flex; gap: 8px; margin-top: 16px; }
  .btn { padding: 8px 16px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
  .btn-primary { background: #059669; color: #fff; }
</style></head><body>
<div class="container">
  <h1>📦 采集预览</h1>
  <div class="meta">${data.pageUrl || ''}</div>

  <div class="section">
    <h2>📋 基本信息</h2>
    <div class="info-grid">
      <span class="lbl">标题</span><span class="val">${escHtml(data.title || '-')}</span>
      <span class="lbl">价格</span><span class="val">${escHtml(data.currency || '')} ${escHtml(data.price || '-')}</span>
      <span class="lbl">品牌</span><span class="val">${escHtml(data.brand || '-')}</span>
      <span class="lbl">MOQ</span><span class="val">${escHtml(data.moq || data.minOrderQuantity || '-')}</span>
    </div>
  </div>

  <div class="section">
    <h2>🏷️ 属性 <span class="badge">${attrs.length}</span></h2>
    ${attrs.length > 0 ? `<table><thead><tr><th>属性名</th><th>属性值</th></tr></thead><tbody>${
      attrs.map((a: any) => `<tr><td>${escHtml(a.name || '')}</td><td>${escHtml(a.value || '')}</td></tr>`).join('')
    }</tbody></table>` : `<p style="color:#aaa;font-size:13px">⚠️ 未检测到属性</p>`}
    ${data.attrDebugInfo ? `<p style="color:#d97706;font-size:12px;margin-top:8px">🔍 诊断: ${escHtml(data.attrDebugInfo)}</p>` : ''}
  </div>

  <div class="section">
    <h2>🖼️ 图片/视频 <span class="badge">${mediaItems.length}</span></h2>
    ${imgTags.length > 0 ? `<div class="img-grid">${imgTags.join('')}</div>` : '<p style="color:#aaa;font-size:13px">⚠️ 未检测到图片</p>'}
  </div>

  <div class="section">
    <h2>📝 描述</h2>
    <div class="desc-box">${escHtml(desc) || '-'}</div>
  </div>

  <div class="actions">
    <button class="btn btn-primary" onclick="window.print()">🖨️ 打印/保存 PDF</button>
  </div>
</div></body></html>`
    
    await writeFile(path.join(dir, 'preview.html'), html)
    
    return NextResponse.json({
      success: true,
      data: {
        dir: dir,
        fileCount: imgTags.length + 1 + 1 + 1, // images + csv + txt + html
        attributes: attrs.length,
        images: imgTags.length,
      }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

function escHtml(s: string) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
