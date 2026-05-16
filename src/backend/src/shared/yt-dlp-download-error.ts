const YT_DLP_COOKIE_WIKI =
  'https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies';

const COOKIE_HINT =
  'Refresh your bind-mounted cookies.txt per the yt-dlp wiki (incognito export; do not browse YouTube on that account while downloading).';

export function formatYtDlpDownloadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('302') || lower.includes('http status: 302')) {
    return `${raw} — YouTube session redirect (HTTP 302). ${COOKIE_HINT} See ${YT_DLP_COOKIE_WIKI}`;
  }

  if (
    lower.includes('sign in') ||
    lower.includes('not a bot') ||
    lower.includes('cookies have been rotated')
  ) {
    return `${raw} — ${COOKIE_HINT} See ${YT_DLP_COOKIE_WIKI}`;
  }

  return raw;
}
