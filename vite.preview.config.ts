// 배포 전 로컬 미리보기: npm run preview:local
// 운영 서버 데이터를 읽되 로그인은 가짜(?role=admin / ?role=user), 저장은 서버로 보내지 않음 (preview/previewApi.ts)
import { defineConfig, mergeConfig } from 'vite'
import path from 'path'
import baseConfig from './vite.config.ts'

const apiFile = path.resolve(__dirname, 'src/api.ts')
const previewApiFile = path.resolve(__dirname, 'preview/previewApi.ts')

export default mergeConfig(baseConfig, defineConfig({
  plugins: [
    {
      name: 'preview-api',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        if (!importer || !/(^|\/)api$/.test(source)) return null
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
        return resolved && path.resolve(resolved.id) === apiFile ? previewApiFile : null
      },
    },
  ],
  server: { port: 5174, strictPort: true },
}))
