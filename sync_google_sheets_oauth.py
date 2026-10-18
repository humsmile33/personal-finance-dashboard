#!/usr/bin/env python3
"""
Direct Google Sheets OAuth2 Synchronizer
----------------------------------------
Uses Google Sheets API to directly update https://docs.google.com/spreadsheets/d/1743PbqYCLrt-bMSzvHitI79EFMeBsjAeF2y53hwLgrQ
without any manual copy-pasting.
"""

import os
import sys
import json
import gspread
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

SPREADSHEET_ID = '1743PbqYCLrt-bMSzvHitI79EFMeBsjAeF2y53hwLgrQ'
TOKEN_FILE = 'token.json'
CLIENT_SECRET_FILE = os.path.expanduser('~/Downloads/client_secret_150279053379-bj83rbeinge8ji2n495r3tf92r9r6qug.apps.googleusercontent.com.json')

def get_gspread_client():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CLIENT_SECRET_FILE):
                raise FileNotFoundError(f"OAuth Client Secret 파일을 찾을 수 없습니다: {CLIENT_SECRET_FILE}")
            
            print("🔑 구글 계정 인증 창을 엽니다. 브라우저에서 '허용'을 클릭해주세요...")
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
            creds = flow.run_local_server(port=8080)
            
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
            print(f"✅ 인증 토큰이 {TOKEN_FILE}에 저장되었습니다. (이후 재인증 불필요)")
            
    return gspread.authorize(creds)

def push_to_google_sheet(transactions_to_add=None):
    gc = get_gspread_client()
    print(f"📊 구글 스프레드시트 열기: {SPREADSHEET_ID}...")
    sh = gc.open_by_key(SPREADSHEET_ID)
    
    # 1. Update 2026_수입지출
    sheet_2026 = sh.worksheet('2026_수입지출')
    print("  -> '2026_수입지출' 시트 확인 완료")
    
    # New rows to insert (default: Oct 18 transactions)
    if transactions_to_add is None:
        transactions_to_add = [
            ["2026-10-18", "14:10", "지출", "고정비_주거_통신_보험", "재산세 7월 11월", "지자체세입금(삼성페이)", -139690, "KRW", "Deep Oil", ""],
            ["2026-10-18", "12:01", "지출", "외식비", "간식류", "씨유(CU) 동탄한화점", -7320, "KRW", "Deep Oil", ""],
            ["2026-10-18", "10:33", "지출", "문화여가비", "흠취미", "NICE_산림휴양시설_1", -18500, "KRW", "KB국민 Liiv Mate카드", "용현자연휴양 캠핑"],
            ["2026-10-18", "07:25", "지출", "문화여가비", "흠취미", "한국해운조합", -31400, "KRW", "카카오페이 간편결제", "섬여행 배편"]
        ]
        
    # Check if already present to avoid duplication
    existing_first_col = sheet_2026.col_values(1)
    existing_fifth_col = sheet_2026.col_values(6)
    
    truly_new = []
    for row in transactions_to_add:
        d = row[0]
        merchant = row[5]
        # If both date and merchant exist in the same row index, consider existing
        exists = False
        for idx in range(min(len(existing_first_col), 30)):
            if idx < len(existing_fifth_col) and existing_first_col[idx] == d and existing_fifth_col[idx] == merchant:
                exists = True
                break
        if not exists:
            truly_new.append(row)
            
    if truly_new:
        print(f"  -> 신규 {len(truly_new)}건을 '2026_수입지출' 2행에 삽입 중...")
        sheet_2026.insert_rows(truly_new, row=2, value_input_option='USER_ENTERED')
        print(f"  -> ✅ '2026_수입지출'에 {len(truly_new)}건 등록 완료!")
    else:
        print("  -> 이미 10월 18일 거래가 등록되어 있습니다.")
        
    print("🎉 구글 스프레드시트 업데이트가 100% 자동 완료되었습니다!")
    print(f"확인: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit")

if __name__ == '__main__':
    push_to_google_sheet()
