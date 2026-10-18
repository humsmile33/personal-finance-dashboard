/**
 * [지출재무분석] 구글 스프레드시트 자동 동기화용 Google Apps Script (GAS)
 * -------------------------------------------------------------
 * 구글 스프레드시트 상단 메뉴 [확장 프로그램] > [Apps Script]에 붙여넣어 사용합니다.
 * 
 * 기능:
 * 1. 스프레드시트 상단에 [⚡ 가계부 관리] 메뉴 생성
 * 2. 신규 거래내역(JSON 또는 TSV)을 '2026_수입지출' 시트 최상단에 자동 삽입
 * 3. '통합_내역' 시트는 VSTACK 수식에 의해 전자동 동기화
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ 가계부 관리')
    .addItem('10월 18일 신규 내역 4건 자동 추가', 'appendOct18Transactions')
    .addItem('2026_수입지출 시트 바로가기', 'goTo2026Sheet')
    .addToUi();
}

function goTo2026Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('2026_수입지출');
  if (sheet) {
    ss.setActiveSheet(sheet);
  }
}

/**
 * 2026년 10월 18일 신규 4건 거래내역을 '2026_수입지출' 시트에 즉시 반영합니다.
 */
function appendOct18Transactions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('2026_수입지출');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert("'2026_수입지출' 시트를 찾을 수 없습니다.");
    return;
  }
  
  // 10월 18일 신규 4건 데이터
  var newRows = [
    ["2026-10-18", "14:10", "지출", "고정비_주거_통신_보험", "재산세 7월 11월", "지자체세입금(삼성페이)", -139690, "KRW", "Deep Oil", ""],
    ["2026-10-18", "12:01", "지출", "외식비", "간식류", "씨유(CU) 동탄한화점", -7320, "KRW", "Deep Oil", ""],
    ["2026-10-18", "10:33", "지출", "문화여가비", "흠취미", "NICE_산림휴양시설_1", -18500, "KRW", "KB국민 Liiv Mate카드", "용현자연휴양 캠핑"],
    ["2026-10-18", "07:25", "지출", "문화여가비", "흠취미", "한국해운조합", -31400, "KRW", "카카오페이 간편결제", "섬여행 배편"]
  ];
  
  // 2행에 4개 행을 삽입하여 기존 내역 위에 추가
  sheet.insertRowsBefore(2, newRows.length);
  sheet.getRange(2, 1, newRows.length, 10).setValues(newRows);
  
  SpreadsheetApp.getUi().alert("✅ 10월 18일 신규 거래 4건이 '2026_수입지출'에 추가되었습니다!\n\n'통합_내역' 시트도 VSTACK 수식에 의해 자동 갱신되었습니다.");
}
