import { formatYtDlpDownloadError } from './yt-dlp-download-error';

describe('formatYtDlpDownloadError', () => {
  it('adds cookie guidance for HTTP 302', () => {
    const msg = formatYtDlpDownloadError(
      new Error('yt-dlp exited with code 1: Unknown yt-dlp error\nhttp status: 302'),
    );
    expect(msg).toContain('HTTP 302');
    expect(msg).toContain('cookies.txt');
    expect(msg).toContain('yt-dlp/yt-dlp/wiki/Extractors');
  });

  it('adds cookie guidance for sign-in errors', () => {
    const msg = formatYtDlpDownloadError(
      'ERROR: Sign in to confirm you’re not a bot',
    );
    expect(msg).toContain('Sign in');
    expect(msg).toContain('cookies.txt');
  });

  it('returns the original message for unrelated errors', () => {
    const msg = formatYtDlpDownloadError(new Error('Network unreachable'));
    expect(msg).toBe('Network unreachable');
  });
});
