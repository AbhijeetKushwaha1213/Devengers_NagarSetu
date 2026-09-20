/**
 * Shared formatting utilities
 */

export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} week${Math.ceil(diffDays / 7) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

export function truncateText(text: string, maxLength = 50): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input.trim().replace(/<[^>]*>/g, '');
}
