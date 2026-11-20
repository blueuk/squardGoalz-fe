// 프로필 사진: 원본을 서버로 보내지 않고 브라우저에서 정사각형으로 잘라 작게 줄임 (서버 저장 용량 최소화)

export const PROFILE_SIZE = 256;       // 저장 크기 (px)
const WEBP_QUALITY = 0.8;
const JPEG_QUALITY = 0.85;             // WebP로 저장하지 못하는 브라우저용
export const MAX_UPLOAD_BYTES = 100 * 1024; // 서버 제한과 같음

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했습니다.')); };
  img.src = url;
});

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));

// 가운데를 기준으로 정사각형으로 잘라 PROFILE_SIZE로 줄인 WebP (지원하지 않으면 JPEG)
// 휴대폰 사진의 회전 정보(EXIF)는 브라우저가 이미지를 그릴 때 적용함
export async function resizeProfileImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있습니다.');
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const size = Math.min(PROFILE_SIZE, side);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('사진을 처리하지 못했습니다.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  const webp = await toBlob(canvas, 'image/webp', WEBP_QUALITY);
  const blob = webp && webp.type === 'image/webp' ? webp : await toBlob(canvas, 'image/jpeg', JPEG_QUALITY);
  if (!blob) throw new Error('사진을 처리하지 못했습니다.');
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('사진을 충분히 줄이지 못했습니다. 다른 사진을 골라주세요.');
  return blob;
}

export const profileImageUrl = (teamUid: string, memberUid: string, version: string) =>
  `/profile/image/${teamUid}/${memberUid}?v=${version}`;
