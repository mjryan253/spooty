const YT_DLP_COOKIE_WIKI =
  'https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies';

const COOKIE_HINT =
  'Refresh your bind-mounted cookies.txt per the yt-dlp wiki (incognito export; do not browse YouTube on that account while downloading).';

const NOISY_EXIT_PATTERN =
  /exited with code 1.*unknown yt-dlp error/i;

export class YtDlpDownloadError extends Error {
  readonly stderr: string;

  constructor(message: string, options: { cause?: unknown; stderr?: string }) {
    super(message);
    this.name = 'YtDlpDownloadError';
    this.stderr = options.stderr ?? '';
  }
}

function messageFromUnknown(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** yt-dlp exit 1 with no parsed ERROR line, or HTTP 302 in stderr/message. */
export function isLikelyPostProcessingNoise(err: unknown): boolean {
  const raw = messageFromUnknown(err);
  const lower = raw.toLowerCase();
  if (lower.includes('302') || lower.includes('http status: 302')) {
    return true;
  }
  return NOISY_EXIT_PATTERN.test(raw);
}

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
