import { getPortalPreviewBannerInfo } from '@/actions/portal-preview.actions'
import PortalPreviewBanner from '@/components/portal/PortalPreviewBanner'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const preview = await getPortalPreviewBannerInfo()

  return (
    <div className="min-h-full flex flex-col">
      {preview.active && preview.companyId && preview.companyName && (
        <PortalPreviewBanner companyId={preview.companyId} companyName={preview.companyName} />
      )}
      <div className="flex-1">{children}</div>
    </div>
  )
}
