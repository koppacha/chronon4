import csv
import json


def csv_to_json():
    input_file = "inputs/data.csv"
    output_file = "outputs/data.json"

    data = []
    with open(input_file, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 空白行をスキップ
            if any(row.values()):
                data.append(row)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    csv_to_json()
