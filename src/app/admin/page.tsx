'use client'

import { useState } from 'react'

const tabs = ['Overview', 'Assets', 'Upload']

const stats = [
  { label: 'Total Assets', value: '12' },
  { label: 'Total Revenue', value: '$0' },
  { label: 'Active Subscribers', value: '0' },
  { label: 'Downloads', value: '0' },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('Overview')

  return (
    <div className="py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          <span className="badge bg-[#E8B84B]/10 text-[#E8B84B] border border-[#E8B84B]/20">
            Admin
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-[#222222]">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-[#E8B84B] text-[#E8B84B]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview */}
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

        {/* Assets */}
        {activeTab === 'Assets' && (
          <div className="card p-6">
            <p className="text-gray-400">Asset management coming soon.</p>
          </div>
        )}

        {/* Upload */}
        {activeTab === 'Upload' && (
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Upload New Asset</h2>
            <div className="border-2 border-dashed border-[#333333] rounded-xl p-12 text-center">
              <p className="text-gray-400 mb-4">Drag and drop files here</p>
              <button className="btn-primary">Select Files</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
