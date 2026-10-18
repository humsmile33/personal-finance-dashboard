#!/usr/bin/env python3
"""
Personal Finance Dataset & Database Automated Syncer
---------------------------------------------------
1. Extracts password-protected ZIP export from Banksalad (default password: 1814)
2. Parses '가계부 내역' (transactions) and '뱅샐현황' (CF, BS, INS, INV)
3. Merges seamlessly with existing multi-year data (2023..2026+)
4. Updates finance_data.json, finance_data.js, and sheet.xlsx
5. Supports optional --push to commit and push to GitHub Pages
"""

import os
import sys
import argparse
import datetime
import zipfile
import json
import shutil
import subprocess
from collections import defaultdict
import openpyxl

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def to_date_str(val):
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.strftime('%Y-%m-%d')
    try:
        days = int(float(val))
        return (datetime.date(1899, 12, 30) + datetime.timedelta(days=days)).strftime('%Y-%m-%d')
    except:
        return str(val) if val is not None else ''

def to_time_str(val):
    if isinstance(val, datetime.time):
        return val.strftime('%H:%M')
    if isinstance(val, datetime.datetime):
        return val.strftime('%H:%M')
    try:
        frac = float(val)
        sec = int(round(frac * 86400))
        return f'{(sec // 3600) % 24:02d}:{(sec % 3600) // 60:02d}'
    except:
        return str(val) if val is not None else ''

def extract_zip(zip_path, password='1814', extract_to='/tmp/extracted_finance_sync'):
    if os.path.exists(extract_to):
        shutil.rmtree(extract_to)
    os.makedirs(extract_to, exist_ok=True)
    
    with zipfile.ZipFile(zip_path, 'r') as zf:
        if password:
            zf.setpassword(password.encode('utf-8'))
        zf.extractall(extract_to)
        
    xlsx_files = [os.path.join(extract_to, f) for f in os.listdir(extract_to) if f.endswith('.xlsx')]
    if not xlsx_files:
        raise FileNotFoundError("압축 해제된 폴더 내 .xlsx 파일을 찾을 수 없습니다.")
    return xlsx_files[0]

def sync_dataset(input_file, password='1814', push_git=False):
    # 1. Extract zip if zipfile
    if input_file.lower().endswith('.zip'):
        print(f"📦 ZIP 파일 감지: {input_file} (비밀번호: {'*' * len(password)})")
        target_xlsx = extract_zip(input_file, password=password)
        print(f"  -> 압축 해제 완료: {os.path.basename(target_xlsx)}")
    else:
        target_xlsx = input_file

    print(f"📊 신규 데이터 파싱 중: {target_xlsx}")
    wb_new = openpyxl.load_workbook(target_xlsx, data_only=True)
    
    if '가계부 내역' not in wb_new.sheetnames:
        raise ValueError("신규 파일에 '가계부 내역' 시트가 존재하지 않습니다.")

    ws_new_tx = wb_new['가계부 내역']
    ws_new_sum = wb_new['뱅샐현황'] if '뱅샐현황' in wb_new.sheetnames else None

    # 2. Parse new transactions from '가계부 내역'
    reimb_items = {'기타수입_출장비환급', '기타수입_엔빵환급', '기타수입_카드취소환급', '기타수입_보험비환급'}
    new_txs = []
    
    for r in range(2, ws_new_tx.max_row + 1):
        vals = [ws_new_tx.cell(r, c).value for c in range(1, 11)]
        if not any(vals):
            continue
        d_str = to_date_str(vals[0])
        t_str = to_time_str(vals[1])
        tx_type = str(vals[2] or '').strip()
        cat = str(vals[3] or '').strip()
        subcat = str(vals[4] or '').strip()
        merchant = str(vals[5] or '').strip()
        try: amount = float(vals[6] or 0.0)
        except: amount = 0.0
        curr = str(vals[7] or 'KRW').strip()
        pm = str(vals[8] or '').strip()
        memo = str(vals[9] or '').strip() if len(vals) > 9 and vals[9] is not None else ''

        if not d_str:
            continue

        ym = d_str[:7]
        year = d_str[:4]
        try:
            m_num = int(ym.split('-')[1])
            q_str = f'Q{(m_num - 1) // 3 + 1}'
        except:
            m_num = 1
            q_str = 'Q1'

        is_reimbursement = (tx_type == '수입' and (cat in reimb_items or subcat in reimb_items))
        is_real_income = (tx_type == '수입' and not is_reimbursement)
        is_pure_investment = (tx_type == '이체' and cat == '투자')
        is_reconciliation = (cat == '미분류' and merchant in ['자산 추가', '차액'])

        entity = 'Shared'
        comb_text = f'{cat} {subcat} {merchant} {memo} {pm}'
        if any(k in comb_text for k in ['초원', '쵼니', '초원이용품', '초원 미래에셋', '초원이 농협은행', '초원간식', '초원취미']):
            entity = 'Chowon'
        elif any(k in comb_text for k in ['현정', '조현정', '현정급여', '현정자금', '현정친구', '현정취미', '현정ISA']):
            entity = 'Hyeonjeong'
        elif any(k in comb_text for k in ['한영흠', '영흠', '흠 취미', '흠취미', '흠 강습비', '흠회사식사', '흠진료', '흠 부가급여', '흠 비정기', '흠 월정기']):
            entity = 'Yeongheum'
        elif is_pure_investment and ('한영흠' in comb_text or '신한 주거래' in pm):
            entity = 'Yeongheum'

        new_txs.append({
            'id': 0,
            'date': d_str,
            'time': t_str,
            'type': tx_type,
            'category': cat,
            'subcategory': subcat,
            'merchant': merchant,
            'amount': amount,
            'currency': curr,
            'payment': pm,
            'memo': memo,
            'year': year,
            'yearMonth': ym,
            'quarter': q_str,
            'month': m_num,
            'isReimbursement': is_reimbursement,
            'isRealIncome': is_real_income,
            'isPureInvestment': is_pure_investment,
            'isReconciliation': is_reconciliation,
            'entity': entity
        })

    years_in_new = sorted(list(set(t['year'] for t in new_txs if t['year'])))
    target_year = years_in_new[-1] if years_in_new else '2026'
    print(f"  -> 파싱된 {target_year}년 거래내역: {len(new_txs)}건")

    # 3. Load existing finance_data.json to get historical years (2023, 2024, 2025, etc.)
    with open('finance_data.json', 'r', encoding='utf-8') as f:
        existing_data = json.load(f)

    # Keep all transactions from other years
    historical_txs = [t for t in existing_data['transactions'] if t['year'] != target_year]
    old_target_txs = [t for t in existing_data['transactions'] if t['year'] == target_year]
    print(f"  -> 기존 과거 연도 거래내역: {len(historical_txs)}건 (기존 {target_year}년: {len(old_target_txs)}건)")

    # Find truly new transactions
    existing_keys = set(
        (t['date'], t['time'], t['type'], t['category'], t['subcategory'], t['merchant'], round(float(t['amount']), 2), t['payment'])
        for t in old_target_txs
    )
    truly_new_txs = []
    for t in new_txs:
        key = (t['date'], t['time'], t['type'], t['category'], t['subcategory'], t['merchant'], round(float(t['amount']), 2), t['payment'])
        if key not in existing_keys:
            truly_new_txs.append(t)

    print(f"  -> 🌟 신규 추가 거래 {len(truly_new_txs)}건 발견!")
    for idx, t in enumerate(truly_new_txs, 1):
        print(f"     [{idx}] {t['date']} {t['time']} | {t['type']} | {t['category']}/{t['subcategory']} | {t['merchant']} | {t['amount']:,.0f}원 | {t['payment']}")

    # Combine all transactions
    combined_txs = historical_txs + new_txs
    combined_txs.sort(key=lambda x: (x['date'], x['time']), reverse=True)
    for idx, t in enumerate(combined_txs, 1):
        t['id'] = idx

    print(f"  -> 📈 병합 완료된 총 거래내역: {len(combined_txs)}건")

    # 4. Parse Annual Summary from 뱅샐현황
    annual_summaries = existing_data.get('annualSummaries', {})

    if ws_new_sum:
        cust = {
            'name': ws_new_sum.cell(6, 2).value or '한영흠',
            'gender': ws_new_sum.cell(6, 3).value or '남',
            'age': int(float(ws_new_sum.cell(6, 4).value or 41)),
            'creditScore': int(float(ws_new_sum.cell(6, 5).value or 1000))
        }

        cf_items = []
        bs_items = []
        ins_items = []
        inv_items = []
        
        # Determine active month columns dynamically (e.g. 2026-01 to 2026-10)
        # Check row 11 headers
        month_col_indices = []
        for c in range(5, 17):
            header_val = str(ws_new_sum.cell(11, c).value or '')
            if header_val.startswith(target_year):
                month_col_indices.append((header_val, c))

        section = None
        curr_bs_cat = ''

        for r in range(1, ws_new_sum.max_row + 1):
            b = str(ws_new_sum.cell(r, 2).value or '').strip()
            if b == '2.현금흐름현황': section = 'CF'; continue
            elif b == '3.재무현황': section = 'BS'; continue
            elif b == '4.보험현황': section = 'INS'; continue
            elif b == '5.투자현황': section = 'INV'; continue
            elif b == '6.대출현황': section = 'LOAN'; continue

            if section == 'CF':
                if b in ['항목', '최근 1년 동안의 현금흐름을 분석합니다.', '']:
                    continue
                months_val = {}
                row_sum = 0.0
                for m_key, col_idx in month_col_indices:
                    v = ws_new_sum.cell(r, col_idx).value
                    try: amt = float(v) if v is not None else 0.0
                    except: amt = 0.0
                    months_val[m_key] = amt
                    row_sum += amt
                
                num_months = len(month_col_indices) if month_col_indices else 1
                cf_items.append({
                    'item': b,
                    'total': row_sum,
                    'monthlyAvg': row_sum / num_months,
                    'months': months_val
                })

            elif section == 'BS':
                if b in ['자산', '항목', '데이터를 내보낸 시점의 자산과 부채 상태를 분석합니다.']:
                    continue
                c = str(ws_new_sum.cell(r, 3).value or '').strip()
                e = ws_new_sum.cell(r, 5).value
                if b and b not in ['자산', '항목', '총자산', '순자산', '부채']:
                    curr_bs_cat = b
                if curr_bs_cat or c or e:
                    try: amt = float(e) if e is not None else 0.0
                    except: amt = 0.0
                    if b in ['총자산', '순자산']:
                        bs_items.append({'category': b, 'product': b, 'amount': amt})
                    elif c or amt > 0:
                        bs_items.append({'category': curr_bs_cat or '기타', 'product': c or curr_bs_cat, 'amount': amt})

            elif section == 'INS':
                if b in ['금융사', '사용자가 보유한 보험상품 현황을 분석합니다.', '총계', '']:
                    continue
                try: paid = float(ws_new_sum.cell(r, 6).value or 0.0)
                except: paid = 0.0
                ins_items.append({
                    'company': b,
                    'name': str(ws_new_sum.cell(r, 3).value or '').strip(),
                    'status': str(ws_new_sum.cell(r, 5).value or '').strip(),
                    'paidTotal': paid
                })

            elif section == 'INV':
                if b in ['투자상품종류', '사용자가 보유한 투자상품 현황을 분석합니다.', '총계', '']:
                    continue
                try: princ = float(ws_new_sum.cell(r, 6).value or 0.0)
                except: princ = 0.0
                try: val = float(ws_new_sum.cell(r, 7).value or 0.0)
                except: val = 0.0
                try: ret = float(ws_new_sum.cell(r, 8).value or 0.0)
                except: ret = 0.0
                inv_items.append({
                    'type': b,
                    'company': str(ws_new_sum.cell(r, 3).value or '').strip(),
                    'name': str(ws_new_sum.cell(r, 4).value or '').strip(),
                    'principal': princ,
                    'valuation': val,
                    'returnRate': ret
                })

        # Calculate exact total assets as sum of asset categories
        asset_sum = sum(i['amount'] for i in bs_items if i['category'] not in ['총자산', '순자산', '부채'])
        for bi in bs_items:
            if bi['category'] in ['총자산', '순자산']:
                bi['amount'] = asset_sum

        annual_summaries[target_year] = {
            'customer': cust,
            'cashFlow': cf_items,
            'balanceSheet': bs_items,
            'insurance': ins_items,
            'investments': inv_items
        }
        print(f"  -> {target_year}년 총자산: {asset_sum:,.0f}원 (CF: {len(cf_items)}개, BS: {len(bs_items)}개, INV: {len(inv_items)}개)")

    # 5. Compute metadata
    active_months_per_year = {}
    for y in sorted(list(set(t['year'] for t in combined_txs if t['year']))):
        months = set(t['yearMonth'] for t in combined_txs if t['year'] == y)
        active_months_per_year[y] = len(months)

    # Top Merchants
    merchant_totals = defaultdict(float)
    merchant_counts = defaultdict(int)
    for t in combined_txs:
        if t['type'] == '지출':
            merchant_totals[t['merchant']] += abs(t['amount'])
            merchant_counts[t['merchant']] += 1

    top_merchants = sorted(
        [{'name': m, 'total': round(tot), 'count': merchant_counts[m]} for m, tot in merchant_totals.items() if m],
        key=lambda x: -x['total']
    )[:50]

    latest_profile = annual_summaries.get(sorted(annual_summaries.keys())[-1], {}).get('customer', {})

    payload = {
        'metadata': {
            'lastUpdated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
            'availableYears': sorted(list(set(t['year'] for t in combined_txs if t['year']))),
            'activeMonths': active_months_per_year,
            'customerProfile': {
                'name': latest_profile.get('name', '한영흠'),
                'gender': latest_profile.get('gender', '남'),
                'latestAge': latest_profile.get('age', 41),
                'creditScore': latest_profile.get('creditScore', 1000),
                'creditAgency': 'KCB',
                'scorePercentile': '상위 0.1%',
                'debt': 0
            }
        },
        'annualSummaries': annual_summaries,
        'topMerchants': top_merchants,
        'transactions': combined_txs
    }

    # Write JSON and JS
    with open('finance_data.json', 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    with open('finance_data.js', 'w', encoding='utf-8') as f:
        f.write('window.FINANCE_DATA = ' + json.dumps(payload, ensure_ascii=False) + ';\n')

    print("💾 finance_data.json 및 finance_data.js 저장 완료!")

    # 6. Push to Git if requested
    if push_git:
        commit_msg = f"feat: update financial dataset via zip upload ({target_year} data, +{len(truly_new_txs)} txs)"
        print(f"🚀 GitHub 배포 실행...")
        subprocess.run(['git', 'add', 'finance_data.json', 'finance_data.js'], check=True)
        subprocess.run(['git', 'commit', '-m', commit_msg], check=True)
        subprocess.run(['git', 'push', 'origin', 'main'], check=True)
        print("✅ GitHub Pages 배포 완료!")

    return len(truly_new_txs)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Sync personal finance dataset with password-protected ZIP export.")
    parser.add_argument('file', help="Path to ZIP export or XLSX file")
    parser.add_argument('--password', '-p', default='1814', help="ZIP password (default: 1814)")
    parser.add_argument('--push', action='store_true', help="Commit and push changes to GitHub Pages")
    args = parser.parse_args()

    sync_dataset(args.file, password=args.password, push_git=args.push)
