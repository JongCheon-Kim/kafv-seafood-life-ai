# KAFV Seafood Life AI UI v0.1

통합 UI 기준판. 검증·LOCK된 KAFV Seafood Life MCP를 브라우저/PWA에서 호출한다.

## 데이터 흐름

UI → `kafv-seafood-life-mcp-api` `/mcp` → PRICE_MCP / ENCYCLOPEDIA_MCP / TOURISM_MCP

## UI LOCK 기준

- 기능 순서: 가격정보 → 수산물사전 → 시장 → 맛집 → 문화
- 하단 메뉴: 홈 → 최근기록 → 즐겨찾기 → 마이페이지
- 지도는 핵심 화면에서 제외하고 카드·사진·이미지 중심
- 수산물사전 이미지는 `image_key`와 `assets/seafood/<image_key>.webp`를 1:1 연결
- 실제 이미지가 없으면 fallback만 표시하며 가짜 URL을 생성하지 않음
- 관광 API `http://tong.visitkorea.or.kr` 이미지 URL은 HTTPS로 정규화하여 GitHub Pages mixed-content 차단을 방지
- 가격은 단위·규격·유통단계가 다른 행을 하나의 대표가격으로 합치지 않음
- `available / empty / unconfirmed / error` 상태를 구분

## 배포

GitHub Pages용 정적 PWA. 저장소 루트에 본 파일들을 업로드한 뒤 Settings → Pages에서 main/root 배포.
