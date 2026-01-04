export interface LeadScoreFactors {
  status: string;
  source: string;
  estimated_value?: string | number;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
}

export const calculateLeadScore = (data: LeadScoreFactors): number => {
  let score = 0;

  // 1. Contact Completeness (Max 20)
  if (data.email) score += 10;
  if (data.phone) score += 10;

  // 2. Company Profile (Max 15)
  if (data.company) score += 10;
  if (data.title) score += 5;

  // 3. Source Quality (Max 15)
  switch (data.source) {
    case 'referral':
      score += 15;
      break;
    case 'website':
      score += 10;
      break;
    case 'event':
      score += 10;
      break;
    case 'social':
      score += 5;
      break;
    default:
      score += 5;
  }

  // 4. Deal Value (Max 20)
  const value = Number(data.estimated_value) || 0;
  if (value > 50000) score += 20;
  else if (value > 10000) score += 15;
  else if (value > 5000) score += 10;
  else if (value > 0) score += 5;

  // 5. Status Progress (Max 30)
  switch (data.status) {
    case 'won':
      score += 30;
      break;
    case 'negotiation':
      score += 25;
      break;
    case 'proposal':
      score += 20;
      break;
    case 'qualified':
      score += 15;
      break;
    case 'contacted':
      score += 10;
      break;
    case 'new':
      score += 5;
      break;
  }

  return Math.min(score, 100);
};

export const getScoreGrade = (score: number) => {
  if (score >= 80) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-500/10', label: 'Hot' };
  if (score >= 60) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-500/10', label: 'Warm' };
  if (score >= 40) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-500/10', label: 'Cold' };
  return { grade: 'D', color: 'text-red-600', bg: 'bg-red-500/10', label: 'Junk' };
};
