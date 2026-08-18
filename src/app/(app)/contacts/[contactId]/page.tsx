import { ContactDetailView } from "./contact-detail-view"

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>
}) {
  const { contactId } = await params
  return <ContactDetailView contactId={contactId} />
}
