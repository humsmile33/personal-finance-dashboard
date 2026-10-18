/**
 * [지출재무분석] 구글 스프레드시트 실시간 자동 동기화용 Google Apps Script (GAS)
 * =========================================================================
 * 스프레드시트 ID: 1743PbqYCLrt-bMSzvHitI79EFMeBsjAeF2y53hwLgrQ
 * 
 * [설정 방법 (30초 소요)]
 * 1. 구글 스프레드시트 상단 메뉴 [확장 프로그램] > [Apps Script] 클릭
 * 2. 기존 코드를 모두 지우고 본 스크립트 전체를 붙여넣기
 * 3. 우측 상단 [배포] > [새 배포] 클릭
 *    - 유형 선택: "웹 앱 (Web App)"
 *    - 설명: "가계부 자동 동기화"
 *    - 다음 사용자 권한으로 실행: "나 (본인 계정)"
 *    - 액세스 권한이 있는 사용자: "모든 사용자 (Anyone)"
 *    - [배포] 클릭 후 생성된 '웹 앱 URL' 복사!
 * 4. 복사한 URL을 웹 대시보드 [데이터 관리]의 "구글 시트 연동 Webhook URL"에 입력하거나
 *    저장해두면, 앞으로 ZIP 파일을 등록할 때마다 구글 시트가 100% 자동 업데이트됩니다!
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ 가계부 관리')
    .addItem('🔄 통합_내역 수식 자동 복구 & 최신순 정렬', 'fixIntegratedSheetFormula')
    .addItem('10월 18일 신규 내역 중복 정리 및 반영', 'appendOct18Transactions')
    .addItem('2026_수입지출 시트로 이동', 'goTo2026Sheet')
    .addToUi();
}

function goTo2026Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('2026_수입지출');
  if (sheet) ss.setActiveSheet(sheet);
}

/**
 * '통합_내역' 시트의 A1 수식을 불변(INDIRECT) 수식으로 복구 및 최신순(SORT) 정렬
 * 신규 행을 상단에 삽입하더라도 수식 범위가 절대 밀리지(A10으로 변질) 않습니다.
 */
function fixIntegratedSheetFormula() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('통합_내역');
  if (!sheet) {
    SpreadsheetApp.getUi().alert("'통합_내역' 시트를 찾을 수 없습니다.");
    return;
  }
  
  var formula = '=LET(' +
    'raw, VSTACK(' +
      'INDIRECT("\'2026_수입지출\'!A2:J"),' +
      'INDIRECT("\'2025_수입지출\'!A2:J"),' +
      'INDIRECT("\'2024_수입지출\'!A2:J"),' +
      'INDIRECT("\'2023_수입지출\'!A2:J")' +
    '),' +
    'filtered, FILTER(raw, INDEX(raw, 0, 1) <> ""), ' +
    'sorted, SORT(filtered, 1, FALSE, 2, FALSE), ' +
    'dates, INDEX(sorted, 0, 1), ' +
    'years, ARRAYFORMULA(TEXT(dates, "yyyy")), ' +
    'months, ARRAYFORMULA(TEXT(dates, "yyyy-mm")), ' +
    'VSTACK(' +
      '{"날짜","시간","타입","대분류","소분류","내용","금액","화폐","결제수단","메모","연도","연월"}, ' +
      'HSTACK(sorted, years, months)' +
    ')' +
  ')';
  
  sheet.getRange("A1").setFormula(formula);
  if (SpreadsheetApp.getUi()) {
    SpreadsheetApp.getUi().alert("✅ '통합_내역' 시트의 수식이 정상 복구되었습니다!\n\n이제 2026년 10월 18일 최신 내역이 상단에 즉시 표시되며, 앞으로 데이터를 추가해도 수식이 밀리지 않습니다.");
  }
}

/**
 * 10월 18일 소비 이력 중복 체크 및 삽입 함수
 */
function appendOct18Transactions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('2026_수입지출');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert("'2026_수입지출' 시트를 찾을 수 없습니다.");
    return;
  }
  
  // 기존 10월 18일 데이터가 이미 있으면 중복 삽입 방지
  var firstVal = sheet.getRange(2, 1).getValue();
  var firstStr = firstVal instanceof Date ? Utilities.formatDate(firstVal, "Asia/Seoul", "yyyy-MM-dd") : String(firstVal);
  
  if (firstStr.indexOf("2026-10-18") === -1) {
    var newRows = [
      ["2026-10-18", "14:10", "지출", "고정비_주거_통신_보험", "재산세 7월 11월", "지자체세입금(삼성페이)", -139690, "KRW", "Deep Oil", ""],
      ["2026-10-18", "12:01", "지출", "외식비", "간식류", "씨유(CU) 동탄한화점", -7320, "KRW", "Deep Oil", ""],
      ["2026-10-18", "10:33", "지출", "문화여가비", "흠취미", "NICE_산림휴양시설_1", -18500, "KRW", "KB국민 Liiv Mate카드", "용현자연휴양 캠핑"],
      ["2026-10-18", "07:25", "지출", "문화여가비", "흠취미", "한국해운조합", -31400, "KRW", "카카오페이 간편결제", "섬여행 배편"]
    ];
    sheet.insertRowsBefore(2, newRows.length);
    sheet.getRange(2, 1, newRows.length, 10).setValues(newRows);
  }
  
  // 통합_내역 수식 자동 복구
  fixIntegratedSheetFormula();
}

/**
 * 웹 대시보드 또는 CLI에서 ZIP 업로드 시 호출되는 실시간 Webhook API
 */
function doPost(e) {
  try {
    var rawText = e.postData ? e.postData.contents : "";
    if (!rawText) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Empty body" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = JSON.parse(rawText);
    var targetYear = data.targetYear || "2026";
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = targetYear + "_수입지출";
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    var insertedCount = 0;
    if (data.transactions && data.transactions.length > 0) {
      var rows = data.transactions;
      sheet.insertRowsBefore(2, rows.length);
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      insertedCount = rows.length;
    }
    
    // 삽입 후 통합_내역 수식 항상 최신화
    fixIntegratedSheetFormula();
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      year: targetYear,
      insertedCount: insertedCount,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Google Apps Script Finance Webhook is running."
  })).setMimeType(ContentService.MimeType.JSON);
}
