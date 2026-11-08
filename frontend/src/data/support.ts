// Support nearby: community and crisis services in the Open Referral HSDS format.
// For now read from a sample file (src/mock/openreferral.json); a real HSDS API (e.g. 211) could replace it here.
import raw from '../mock/openreferral.json'

export interface SupportResource {
  id: string
  name: string
  organization: string
  description: string
  phone?: string
  phoneNote?: string
  url?: string
  hours?: string
  area?: string
  /** True for the sample listings: shown with a "check details" label. */
  sample: boolean
}

interface HsdsService {
  id: string
  name: string
  description?: string
  url?: string
  status?: string
  organization?: { name?: string; website?: string }
  phones?: { number?: string; description?: string }[]
  schedules?: { description?: string }[]
  service_areas?: { name?: string }[]
}

/** Maps an HSDS 3.0 paginated services response to what the UI shows. Inactive services are skipped. */
export function fromHsds(doc: { contents?: HsdsService[] }, sample: boolean): SupportResource[] {
  return (doc.contents ?? [])
    .filter((s) => (s.status ?? 'active') === 'active')
    .map((s) => ({
      id: s.id,
      name: s.name,
      organization: s.organization?.name ?? s.name,
      description: s.description ?? '',
      phone: s.phones?.[0]?.number,
      phoneNote: s.phones?.[0]?.description,
      url: s.url ?? s.organization?.website,
      hours: s.schedules?.[0]?.description,
      area: s.service_areas?.map((a) => a.name).filter(Boolean).join(', '),
      sample
    }))
}

export async function getSupportResources(): Promise<SupportResource[]> {
  return fromHsds(raw as { contents?: HsdsService[] }, true)
}
