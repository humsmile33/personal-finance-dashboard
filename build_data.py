import zipfile, xml.etree.ElementTree as ET
import json
import datetime
from collections import defaultdict

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def serial_date_to_str(val):
    try:
        days = int(float(val))
        d = datetime.date(1899, 12, 30) + datetime.timedelta(days=days)
        return d.strftime('%Y-%m-%d')
    except:
        return str(val)

def serial_time_to_str(val):
    try:
        frac = float(val)
        total_sec = int(round(frac * 86400))
        hours = (total_sec // 3600) % 24
        minutes = (total_sec % 3600) // 60
        return f'{hours:02d}:{minutes:02d}'
    except:
        return str(val)

print("Opening sheet.xlsx...")
with zipfile.ZipFile('sheet.xlsx') as z:
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        ss_tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in ss_tree.findall('s:si', NS):
            ss.append(''.join([t.text or '' for t in si.findall('.//s:t', NS)]))

    # 1. Parse Annual Sheets (2023, 2024, 2025, 2026)
    year_sheet_map = {
        '2023': 'xl/worksheets/sheet2.xml',
        '2024': 'xl/worksheets/sheet3.xml',
        '2025': 'xl/worksheets/sheet4.xml',
        '2026': 'xl/worksheets/sheet5.xml'
    }

    annual_summaries = {}
    for y_str, sheet_path in year_sheet_map.items():
        tree = ET.fromstring(z.read(sheet_path))
        sheet_rows = {}
        for row in tree.findall('.//s:row', NS):
            r_idx = int(row.attrib.get('r'))
            vals = {}
            for c in row.findall('s:c', NS):
                ref = c.attrib.get('r')
                col = ''.join([ch for ch in ref if ch.isalpha()])
                t = c.attrib.get('t')
                v = c.find('s:v', NS)
                val = v.text if v is not None else ''
                if t == 's' and val != '':
                    val = ss[int(val)]
                vals[col] = val
            sheet_rows[r_idx] = vals

        # Customer Info
        r6 = sheet_rows.get(6, {})
        cust = {
            'name': r6.get('B', '한영흠'),
            'gender': r6.get('C', '남'),
            'age': int(float(r6.get('D', 0))) if r6.get('D') else (38 + int(y_str) - 2023),
            'creditScore': int(float(r6.get('E', 0))) if r6.get('E') else 1000
        }

        # Cash Flow & Balance Sheet parsing
        cf_items = []
        bs_items = []
        ins_items = []
        inv_items = []
        
        section = None
        curr_bs_cat = ''
        month_cols = ['E','F','G','H','I','J','K','L','M','N','O','P']
        
        for r_idx in sorted(sheet_rows.keys()):
            r = sheet_rows[r_idx]
            b = r.get('B', '').strip()
            
            if b == '2.현금흐름현황':
                section = 'CF'
                continue
            elif b == '3.재무현황':
                section = 'BS'
                continue
            elif b == '4.보험현황':
                section = 'INS'
                continue
            elif b == '5.투자현황':
                section = 'INV'
                continue
            elif b == '6.대출현황':
                section = 'LOAN'
                continue

            if section == 'CF':
                if b in ['항목', '최근 1년 동안의 현금흐름을 분석합니다.', '']:
                    continue
                item_name = b
                try: total = float(r.get('C', 0)) if r.get('C') else 0.0
                except: total = 0.0
                try: monthly_avg = float(r.get('D', 0)) if r.get('D') else 0.0
                except: monthly_avg = 0.0
                
                months_val = {}
                for m_idx, m_col in enumerate(month_cols, 1):
                    m_key = f'{y_str}-{m_idx:02d}'
                    v_str = r.get(m_col, '')
                    try: months_val[m_key] = float(v_str) if v_str else 0.0
                    except: months_val[m_key] = 0.0
                
                cf_items.append({
                    'item': item_name,
                    'total': total,
                    'monthlyAvg': monthly_avg,
                    'months': months_val
                })
            
            elif section == 'BS':
                if b in ['자산', '항목', '데이터를 내보낸 시점의 자산과 부채 상태를 분석합니다.', '']:
                    continue
                c = r.get('C', '').strip()
                e = r.get('E', '').strip()
                if b and b not in ['자산', '항목', '총자산', '순자산', '부채']:
                    curr_bs_cat = b
                if curr_bs_cat or c or e:
                    try: amt = float(e) if e else 0.0
                    except: amt = 0.0
                    if b in ['총자산', '순자산']:
                        bs_items.append({'category': b, 'product': b, 'amount': amt})
                    elif c or amt > 0:
                        bs_items.append({
                            'category': curr_bs_cat or '기타',
                            'product': c or curr_bs_cat,
                            'amount': amt
                        })
            
            elif section == 'INS':
                if b in ['금융사', '사용자가 보유한 보험상품 현황을 분석합니다.', '총계', '']:
                    continue
                ins_items.append({
                    'company': b,
                    'name': r.get('C', ''),
                    'status': r.get('E', ''),
                    'paidTotal': float(r.get('F', 0)) if r.get('F') else 0.0
                })
                
            elif section == 'INV':
                if b in ['투자상품종류', '사용자가 보유한 투자상품 현황을 분석합니다.', '총계', '']:
                    continue
                inv_items.append({
                    'type': b,
                    'company': r.get('C', ''),
                    'name': r.get('D', ''),
                    'principal': float(r.get('F', 0)) if r.get('F') else 0.0,
                    'valuation': float(r.get('G', 0)) if r.get('G') else 0.0,
                    'returnRate': float(r.get('H', 0)) if r.get('H') else 0.0
                })

        annual_summaries[y_str] = {
            'customer': cust,
            'cashFlow': cf_items,
            'balanceSheet': bs_items,
            'insurance': ins_items,
            'investments': inv_items
        }

    # 2. Parse All Transactions from 통합_내역 (sheet1.xml)
    tree1 = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    tx_rows = []
    
    reimb_items = {'기타수입_출장비환급', '기타수입_엔빵환급', '기타수입_카드취소환급', '기타수입_보험비환급'}
    
    for row in tree1.findall('.//s:row', NS):
        r_idx = int(row.attrib.get('r'))
        if r_idx == 1: continue
        vals = {}
        for c in row.findall('s:c', NS):
            ref = c.attrib.get('r')
            col = ''.join([ch for ch in ref if ch.isalpha()])
            t = c.attrib.get('t')
            v = c.find('s:v', NS)
            val = v.text if v is not None else ''
            if t == 's' and val != '':
                val = ss[int(val)]
            vals[col] = val
        
        date_str = serial_date_to_str(vals.get('A', ''))
        time_str = serial_time_to_str(vals.get('B', ''))
        tx_type = vals.get('C', '').strip()
        cat = vals.get('D', '').strip()
        subcat = vals.get('E', '').strip()
        merchant = vals.get('F', '').strip()
        try: amount = float(vals.get('G', 0))
        except: amount = 0.0
        currency = vals.get('H', 'KRW').strip()
        payment = vals.get('I', '').strip()
        memo = vals.get('J', '').strip()
        year = vals.get('K', '').strip()
        ym = vals.get('L', '').strip()

        if not ym and date_str and len(date_str) >= 7:
            ym = date_str[:7]
        if not year and date_str and len(date_str) >= 4:
            year = date_str[:4]
            
        # Quarter
        try:
            m_num = int(ym.split('-')[1])
            q_str = f'Q{(m_num - 1) // 3 + 1}'
        except:
            m_num = 1
            q_str = 'Q1'

        # Classification logic
        is_reimbursement = (tx_type == '수입' and (cat in reimb_items or subcat in reimb_items))
        is_real_income = (tx_type == '수입' and not is_reimbursement)
        is_pure_investment = (tx_type == '이체' and cat == '투자')
        is_reconciliation = (cat == '미분류' and merchant in ['자산 추가', '차액'])
        
        # Family Entity determination
        # Yeongheum (영흠), Hyeonjeong (현정), Chowon (초원), Shared (공통 생활)
        entity = 'Shared'
        comb_text = f'{cat} {subcat} {merchant} {memo} {payment}'
        if any(k in comb_text for k in ['초원', '쵼니', '초원이용품', '초원 미래에셋', '초원이 농협은행', '초원간식', '초원취미']):
            entity = 'Chowon'
        elif any(k in comb_text for k in ['현정', '조현정', '현정급여', '현정자금', '현정친구', '현정취미', '현정ISA']):
            entity = 'Hyeonjeong'
        elif any(k in comb_text for k in ['한영흠', '영흠', '흠 취미', '흠취미', '흠 강습비', '흠회사식사', '흠진료', '흠 부가급여', '흠 비정기', '흠 월정기']):
            entity = 'Yeongheum'
        elif is_pure_investment and ('한영흠' in comb_text or '신한 주거래' in payment):
            entity = 'Yeongheum'
        else:
            entity = 'Shared'

        tx_rows.append({
            'id': r_idx - 1,
            'date': date_str,
            'time': time_str,
            'type': tx_type,
            'category': cat,
            'subcategory': subcat,
            'merchant': merchant,
            'amount': amount,
            'currency': currency,
            'payment': payment,
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

print(f'Processed {len(tx_rows)} transactions.')

# Compute Active Months per Year
active_months_per_year = {}
for y in sorted(list(set(t['year'] for t in tx_rows))):
    months = set(t['yearMonth'] for t in tx_rows if t['year'] == y)
    active_months_per_year[y] = len(months)
print('Active months per year:', active_months_per_year)

# Top Merchants pre-analysis
merchant_totals = defaultdict(float)
merchant_counts = defaultdict(int)
for t in tx_rows:
    if t['type'] == '지출':
        merchant_totals[t['merchant']] += abs(t['amount'])
        merchant_counts[t['merchant']] += 1

top_merchants = sorted(
    [{'name': m, 'total': round(tot), 'count': merchant_counts[m]} for m, tot in merchant_totals.items() if m],
    key=lambda x: -x['total']
)[:50]

data_payload = {
    'metadata': {
        'lastUpdated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
        'availableYears': sorted(list(set(t['year'] for t in tx_rows))),
        'activeMonths': active_months_per_year,
        'customerProfile': {
            'name': '한영흠',
            'gender': '남',
            'latestAge': 41,
            'creditScore': 1000,
            'creditAgency': 'KCB',
            'scorePercentile': '상위 0.1%',
            'debt': 0
        }
    },
    'annualSummaries': annual_summaries,
    'topMerchants': top_merchants,
    'transactions': tx_rows
}

with open('finance_data.json', 'w', encoding='utf-8') as f:
    json.dump(data_payload, f, ensure_ascii=False, indent=2)

# Also write as javascript file data.js for seamless offline browser execution
with open('finance_data.js', 'w', encoding='utf-8') as f:
    f.write('window.FINANCE_DATA = ' + json.dumps(data_payload, ensure_ascii=False) + ';\n')

print("finance_data.json and finance_data.js successfully written!")
