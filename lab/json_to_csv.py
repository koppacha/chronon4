import json
import csv

# JSONファイルの読み込み
with open('data.json', 'r', encoding='utf-8') as json_file:
    data = json.load(json_file)

# CSVファイルの書き出し
with open('output.csv', 'w', newline='', encoding='utf-8') as csv_file:
    if isinstance(data, list) and len(data) > 0:  # リスト形式かつ要素がある場合
        fieldnames = data[0].keys()  # 最初の要素のキーをヘッダーにする
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)
    else:
        print("JSONデータがリスト形式ではありません。")