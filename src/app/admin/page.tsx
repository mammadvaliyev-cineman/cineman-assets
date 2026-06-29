'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const tabs = ['Overview', 'Assets', 'Upload']

const stats = [
  { label: 'Total Assets', value: '12' },
  { label: 'Total Revenue', value: '$0' },
  { label: 'Active Subscribers', value: '0' },
  { label: 'Downloads', value: '0' },
]

const ASSET_TYPES = ['Video Clip', 'LUT', 'Sound Design', 'Motion Graphics']
const CATEGORIES = ['Aerial', 'Street', 'Nature', 'Abstract', 'Architecture', 'Action']
const PLANS = ['starter', 'pro', 'enterprise']

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('Overview')
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Video Clip')
  const [category, setCategory] = useState('Aerial')
  const [plan, setPlan] = useState('starter')
  const [tags, setTags] = useState('')
  const [assetFile, setAssetFile] = useState<File | null>(null)
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const assetInputRef = useRef<HTMLInputElement>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)

  function tabClass(tab: string) {
    if (activeTab === tab) {
      return 'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px border-[#E8B84B] text-[#E8B84B]'
    }
    return 'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px border-transparent text-gray-400 hover:text-white'
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !assetFile) {
      setResult({ ok: false, message: 'Title and asset file are required.' })
      return
    }
    setUploading(true)
    setResult(null)
    try {
      const ts = Date.now()
      const assetPath = ts + '-' + assetFile.name
      const { error: assetErr } = await supabase.storage
        .from('assets')
        .upload(assetPath, assetFile, { upsert: true })
      if (assetErr) throw assetErr
      const fileUrl = assetPath
      let thumbnailUrl = ''
      if (thumbFile) {
        const thumbPath = ts + '-' + thumbFile.name
        const { error: thumbErr } = await supabase.storage
          .from('thumbnails')
          .upload(thumbPath, thumbFile, { upsert: true })
        if (thumbErr) throw thumbErr
        const { data: thumbUrlData } = supabase.storage.from('thumbnails').getPublicUrl(thumbPath)
        thumbnailUrl = thumbUrlData.publicUrl
      }
      const tagsArray = tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      const { error: dbErr } = await supabase.from('assets').insert({
        title, type, category, plan,
        file_url: fileUrl,
        thumbnail_url: thumbnailUrl,
        tags: tagsArray,
      })
      if (dbErr) throw dbErr
      setResult({ ok: true, message: '"' + title + '" uploaded successfully!' })
      setTitle('')
      setTags('')
      setAssetFile(null)
      setThumbFile(null)
      if (assetInputRef.current) assetInputRef.current.value = ''
      if (thumbInputRef.current) thumbInputRef.current.value = ''
    } catch (err: unknown) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  const resultCls = !result ? '' : result.ok
    ? 'p-4 rounded-lg bg-green-900/30 text-green-400 border border-green-800'
    : 'p-4 rounded-lg bg-red-900/30 text-red-400 border border-red-800'

  return (
    <div className="py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          <span className="badge bg-[#E8B84B]/10 text-[#E8B84B] border border-[#E8B84B]/20">Admin</span>
        </div>
        <div className="flex gap-2 mb-8 border-b border-[#222222]">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={tabClass(tab)}>
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(stat => (
              <div key={stat.label} className="card p-6">
                <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-[#E8B84B]">{stat.value}</p>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'Assets' && (
          <div className="card p-6"><p className="text-gray-400">Asset management coming soon.</p></div>
        )}
        {activeTab === 'Upload' && (
          <div className="card p-8">
            <h2 className="text-2xl font-bold mb-6">Upload New Asset</h2>
            <form onSubmit={handleUpload} className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title *</label>
                <input className="input w-full" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Golden Hour Aerial Loop" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select className="input w-full" value={type} onChange={e => setType(e.target.value)}>
                    {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select className="input w-full" value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Plan</label>
                  <select className="input w-full" value={plan} onChange={e => setPlan(e.target.value)}>
                    {PLANS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tags (comma-separated)</label>
                <input className="input w-full" value={tags} onChange={e => setTags(e.target.value)}
                  placeholder="cinematic, aerial, 4K" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Asset File *</label>
                  <input ref={assetInputRef} type="file"
                    onChange={e => setAssetFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#E8B84B] file:text-black hover:file:bg-[#d4a43d] cursor-pointer" required />
                  {assetFile && <p className="text-xs text-gray-500 mt-1">{assetFile.name}</p>}
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Thumbnail (optional)</label>
                  <input ref={thumbInputRef} type="file" accept="image/*"
                    onChange={e => setThumbFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#333333] file:text-white hover:file:bg-[#444444] cursor-pointer" />
                  {thumbFile && <p className="text-xs text-gray-500 mt-1">{thumbFile.name}</p>}
                </div>
              </div>
              {result && <div className={resultCls}>{result.message}</div>}
              <button type="submit" disabled={uploading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                {uploading ? 'Uploading...' : 'Upload Asset'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
