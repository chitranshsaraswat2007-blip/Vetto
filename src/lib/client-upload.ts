export function uploadWithProgress<T = unknown>(
  url: string,
  data: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      let payload: { error?: string } | null = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload as T);
      } else {
        reject(new Error(payload?.error ?? "Upload failed."));
      }
    });
    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload."));
    });
    xhr.send(data);
  });
}

export async function postJson<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, { method: "POST" });
  let payload: { error?: string } | null = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? "The request failed.");
  }

  return payload as T;
}
