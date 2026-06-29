import { Asset } from '@/lib/mock-data'

const planColors: Record<string, string> = {
  starter: 'bg-gray-700 text-gray-200',
  pro: 'bg-blue-900/60 text-blue-300',
  enterprise: 'bg-[#E8B84B]/20 text-[#E8B84B]',
}

interface Props {
  assets: Asset[]
}

export default function AssetGrid({ assets }: Props) {
  if (assets.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No assets found.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {assets.map(asset => (
        <div key={asset.id} className="card group cursor-pointer">
          <div className="relative aspect-video overflow-hidden">
            <img
              src={asset.thumbnailUrl}
              alt={asset.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white font-semibold text-lg">▶ Preview</span>
            </div>
            <span className={`absolute top-2 right-2 badge ${planColors[asset.plan]}`}>
              {asset.plan}
            </span>
          </div>
          <div className="p-4">
            <h3 className="font-semibold mb-1 truncate">{asset.title}</h3>
            <p className="text-sm text-gray-400">{asset.type} &middot; {asset.category}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
