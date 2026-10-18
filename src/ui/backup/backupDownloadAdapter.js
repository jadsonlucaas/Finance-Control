function pad(value) {
  return String(value).padStart(2, '0');
}

export function buildBackupFileName({ now = new Date(), version = '1.0.0' } = {}) {
  const date = now instanceof Date ? now : new Date(now);
  const safeVersion = String(version || '1.0.0').replace(/[^a-zA-Z0-9._-]/g, '');
  return `finance-control-backup-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}-v${safeVersion}.json`;
}

export function createBackupDownloadAdapter(target = globalThis) {
  return {
    downloadJson(payload = {}, options = {}) {
      const documentRef = target.document;
      const urlApi = target.URL;
      const blobCtor = target.Blob;
      if (!documentRef || !urlApi?.createObjectURL || !blobCtor) {
        return { ok: false, code: 'DOWNLOAD_UNAVAILABLE' };
      }
      const fileName = options.fileName || buildBackupFileName({ now: options.now || new Date(), version: payload.backup_version });
      const blob = new blobCtor([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = urlApi.createObjectURL(blob);
      const anchor = documentRef.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      documentRef.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      urlApi.revokeObjectURL(url);
      return { ok: true, fileName, bytes: blob.size };
    }
  };
}
