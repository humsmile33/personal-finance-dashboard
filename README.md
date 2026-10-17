# 신한 SOL 개인자산관리 & 매크로 현금흐름 대시보드
(Personal Income, Expense & Wealth Analytics Dashboard)

[![GitHub Pages](https://img.shields.io/badge/Deployment-GitHub%20Pages-0046FF?style=flat&logo=github)](https://humsmile33.github.io/personal-finance-dashboard/)
[![Design System](https://img.shields.io/badge/Design%20System-Shinhan%20SOL-0046FF)](https://humsmile33.github.io/personal-finance-dashboard/)

2023년부터 2026년(10월)까지 46개월간의 가계 금융 거래 원장(10,780건) 및 연간 결산 재무제표를 정밀 분석하여 구축된 **개인 자산관리 & 매크로 현금흐름 대시보드**입니다.
신한 SOL(신한 쏠) 디자인 시스템 가이드라인을 엄격히 준수하여 제작되었으며, 2027년 이후 신규 데이터가 추가되어도 자동으로 기간과 지표가 확장되도록 설계되었습니다.

---

## 🌐 웹 데모 (Live Demo)

- **배포 URL**: [https://humsmile33.github.io/personal-finance-dashboard/](https://humsmile33.github.io/personal-finance-dashboard/)

---

## 📌 주요 재무 분석 기능

### 1. 실질소득 vs 보전성 환급금 분리
- `출장비환급`, `엔빵환급`, `카드취소환급`, `보험비환급` 등 비용 회수성 항목을 실질 근로/금융 소득과 분리하여 가계의 실제 순수 가처분 소득을 왜곡 없이 산출합니다.

### 2. 정규화 월평균 (Normalized Monthly Run-rate)
- 12개월 전체가 기록된 2023~2025년과 10개월만 기록된 2026년을 공정하게 비교할 수 있도록 활동 개월 수 기반의 정규화 월평균 지표를 제공합니다.

### 3. 순수 투자 vs 연말 자산조정 분리
- 주거래통장 기반의 순수 자본 투자(`대분류 == "투자"`)와 회계적 평가 차액(`자산 추가`, `차액`)을 분리하여 일상 생활비나 투자 지표가 왜곡되지 않도록 전용 회계조정 로그에서 관리합니다.

### 4. 5대 인터랙티브 뷰 (Interactive Views)
1. **`● 홈 | 종합 재무현황`**: 신한 SOL 히어로 배너, 누적 순현금흐름 패널, 5대 Executive KPI, 재무 궤적 콤보 차트, 14.11억 자산 포트폴리오 스냅샷.
2. **`◇ 현금흐름 상세`**: 월간 흑자/적자 Waterfall 차트, 소득 구조 진화 분석, 인스티튜셔널 매트릭스 재무제표(Section 2 고도화).
3. **`📈 투자·자산 변동`**: 누적 및 월별 투자 집행 추이, 7대 자산군 포트폴리오 비중, 연말 자산조정 로그.
4. **`📊 연도별 재무비교`**: 주요 대분류 월평균 지출 YoY 비교, 가족 구성원별(공통생활, 영흠, 현정, 초원) 재무 비중 분석, 핵심 성과표.
5. **`☰ 항목별 지출·조회`**: 카테고리 도넛 & 소분류 Nested Bar 인터랙티브 드릴다운, 결제수단별 점유율, 10대 가맹점 랭킹, 10,780건 통합 거래내역 탐색기.

---

## 🛠 로컬 실행 방법

브라우저에서 [index.html](index.html)을 더블클릭하거나 터미널에서 다음 명령을 실행합니다:

```bash
./run_dashboard.sh
# 또는
python3 -m http.server 8080
```
브라우저에서 `http://localhost:8080`에 접속합니다.

---

## 📂 프로젝트 구조

```
├── index.html           # 대시보드 메인 웹 애플리케이션
├── app.css              # 신한 SOL 디자인 토큰 및 반응형 스타일
├── app.js               # 인터랙티브 상태 관리, 차트 및 데이터 엔진
├── chart.umd.min.js     # 로컬 번들링 Chart.js (오프라인 지원)
├── finance_data.js      # 브라우저 직접 로드용 전처리 데이터
├── finance_data.json    # JSON 규격 가계 금융 데이터
├── build_data.py        # 스프레드시트 파서 및 전처리 스크립트
├── sheet.xlsx           # 원본 엑셀 스프레드시트
└── run_dashboard.sh     # 로컬 실행 스크립트
```
