# GitHub Pages 배포

1. 새 저장소 `kafv-seafood-life-ai` 생성
2. ZIP 압축 해제 후 **폴더 안의 파일 전체**를 저장소 루트에 업로드
3. Settings → Pages → Deploy from a branch
4. Branch `main`, Folder `/(root)` → Save
5. GitHub Pages URL에서 홈 화면 확인
6. `고등어` 조회: 위치 미사용 시 가격·사전 확인
7. `현재 위치 사용` 후 다시 조회: 시장·맛집·문화 확인

## 주의
- 통합 Worker `kafv-seafood-life-mcp-api`는 직접 수정하지 않는다.
- UI의 API 주소는 `config.js`에서만 관리한다.
