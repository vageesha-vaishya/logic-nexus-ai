export const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
  internal_review: { label: 'In Review', color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 hover:bg-red-200' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
};
